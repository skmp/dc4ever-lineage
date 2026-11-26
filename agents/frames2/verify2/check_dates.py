#!/usr/bin/env python3
"""verify2: independent recompute of tour file last-change dates for a stratified random sample of stops / origins.
For each sampled entry: resolve the frame commit, check the file exists at that commit and holds the item's text
(git grep -F, path among the hits), recompute git log -1 --first-parent --format=%H %cs %as <commit> -- <path>,
apply the two frames.py date overrides, and compare with data/attract.json. Also reports whether plain (non first-parent)
log would differ.   python3 agents/frames2/verify2/check_dates.py [seed]   (about 10 s)"""
import json, random, subprocess, sys, os, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = json.load(open(os.path.join(ROOT, 'data/attract.json'))); F = json.load(open(os.path.join(ROOT, 'data/frames.json')))
fr = F['frames']; repo = {l['name']: l['repo'] for l in F['lanes']}; shared = {l['name']: l['shared_until'] for l in F['lanes']}
OVR = {'39c0550': ('2009-10-16', '2008-2010'), '1c16baeb0': ('2013-12-19', '2012-2013')}
def git(r, *a, check=True):
    p = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), *a], capture_output=True)
    if check and p.returncode: raise RuntimeError(p.stderr.decode())
    return p.stdout.decode('utf-8', 'replace')
rnd = random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else 7)
ents = []   # (tag, item, frame index, file entry)
for n, it in enumerate(A['items']):
    for s, sf in zip(it['stops'], it['stop_files']): ents.append(('stop', n, s[0], sf))
    if it['kind'] != 'file' and it.get('origin_file') is not None: ents.append(('origin', n, it['origin'], it['origin_file']))
    if it['kind'] == 'file': ents.append(('first', n, None, it['first_file']))
by = collections.defaultdict(list)
for e in ents:
    it = A['items'][e[1]]; f = fr[e[2]] if e[2] is not None else None
    by[(e[0], it['kind'], f['lane'] if f else '-', bool(e[3].get('range')))].append(e)
sample = []
for k, v in sorted(by.items()): sample += rnd.sample(v, min(2, len(v)))
# targeted: flycast / nulldc3 / nullDC4WiiU stops whose last change is in shared history
for ln in ('flycast', 'nulldc3', 'nullDC4WiiU'):
    cand = [e for e in ents if e[0] == 'stop' and fr[e[2]]['lane'] == ln]
    rnd.shuffle(cand); got = 0
    for e in cand:
        c = e[3]['commit']
        if subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo[ln] + '.git'), 'merge-base', '--is-ancestor', c, shared[ln]]).returncode == 0:
            sample.append(e); got += 1
        if got >= 3: break
res = collections.Counter(); rows = []
for tag, n, f, sf in sample:
    it = A['items'][n]
    if tag == 'first':   # find the frame: the earliest stop-ish frame is not stored; check against any frame of a lane holding the path
        f = next((s[0] for s, x in zip(it['stops'], it['stop_files']) if x == sf), None)
        if f is None:   # recompute from a frame where the path exists with that last change: search the item's lanes
            cands = [g for g in range(len(fr)) if fr[g]['lane'] in it['lanes'] and fr[g].get('commit') and fr[g]['date'] == it['first_frame_date']]
            f = cands[0] if cands else None
        if f is None: rows.append(f'?? first {it["title"]}: no frame'); res['unresolved'] += 1; continue
    F0 = fr[f]
    if F0.get('virtual'):
        ok = sf.get('label') == '2005-2008'; res['virtual-ok' if ok else 'BAD'] += 1; rows.append(f'{"ok" if ok else "BAD"} virtual {tag}'); continue
    ln = F0['lane']; r = repo[ln]; full = git(r, 'rev-parse', F0['commit'] + '^{commit}').strip(); p = sf['path']
    exists = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), 'cat-file', '-e', f'{full}:{p}']).returncode == 0
    # text check
    if it['kind'] == 'line': needle = max(it['text'].split('    '), key=len).strip()
    elif it['kind'] == 'segment': needle = max((l.strip() for l in it['code'].split('\n')), key=len)
    else: needle = None
    hit = None
    if it['kind'] == 'segment':   # fraction of the segment's non-trivial lines present in the file (whitespace-normalized)
        blob = git(r, 'show', f'{full}:{p}', check=False)
        have = {' '.join(l.split()) for l in blob.split('\n')}
        want = [' '.join(l.split()) for l in it['code'].split('\n') if len(l.strip()) > 8]
        hit = sum(w in have for w in want) >= max(1, 0.6 * len(want)); needle = None
    if needle:
        hits = git(r, 'grep', '-F', '-l', '-e', needle, full, check=False).split('\n')
        hits = [h.split(':', 1)[1] for h in hits if h]
        hit = p in hits
    o = git(r, 'log', '-1', '--first-parent', '--format=%H %cs %as', full, '--', p).split()
    o2 = git(r, 'log', '-1', '--format=%H %cs', full, '--', p).split()
    c, cd, ad = o
    exp_date, exp_rng = cd, None
    for k, (d, rg) in OVR.items():
        if c.startswith(k): exp_date, exp_rng = d, rg
    exp_label = f'{exp_rng} (dated {exp_date})' if exp_rng else exp_date
    if F0.get('approx'): exp_label += ' (approx.)'
    ok = exists and hit is not False and sf['commit'] == c[:12] and sf['date'] == exp_date and sf.get('range') == exp_rng and sf['label'] == exp_label and (exp_date <= F0['date'] or F0.get('date_range'))
    insh = shared.get(ln) and subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), 'merge-base', '--is-ancestor', c, shared[ln]]).returncode == 0
    res['ok' if ok else 'BAD'] += 1
    if o2[0] != c: res['nonfp-differs'] += 1
    rows.append(f'{"ok " if ok else "BAD"} {tag:6s} {it["kind"]:7s} {ln:15s} frame {F0["commit"][:9]} {F0["date"]} | {p} | git {c[:9]} {cd} (author {ad}) -> exp "{exp_label}" | data "{sf["label"]}"'
                f'{" | in shared history" if insh else ""}{" | text NOT in file" if hit is False else ""}{"" if exists else " | PATH MISSING"}'
                f'{" | non-first-parent log: " + o2[0][:9] + " " + o2[1] if o2[0] != c else ""}')
print('\n'.join(rows)); print(dict(res), 'sampled', len(sample))

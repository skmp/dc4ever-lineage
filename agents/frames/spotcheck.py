#!/usr/bin/env python3
"""spotcheck.py [DATA]: 10 lines, their origin frame from the frame data, checked against git.
For each line: the origin frame o (lane A, commit c) and A's previous frame p. Checks
  present : the trimmed text is in the tree of c (git grep -F)
  absent  : it is not in the tree of p (or o is A's first frame)
  -S      : the oldest commit that git log -S finds for the text, reachable from c; its committer month
            must be o's month or the line must predate the lane (inherited / imported)
Writes agents/frames/spotcheck.txt."""
import os, sys, subprocess, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tools'))
from frames_lib import Data, ROOT
d = Data(sys.argv[1] if len(sys.argv) > 1 else None)
FR = d.frames
def git(repo, *a):
    return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True, text=True, errors='replace').stdout
# (holder lane, which frame: -1 = last, path substring, text substring or None = random line with seed)
TARGETS = [
    ('nulldc3', -1, 'sh4', 'ToDo : Check This [26/4/05]', None),
    ('flycast', -1, '', 'and here are the new ones :D', None),
    ('reicast', -1, 'spg.cpp', 'Time to emulate that stuff correctly', None),
    ('flycast', -1, 'core/rend/', None, 11),
    ('reicast', 40, '', None, 12),
    ('nulldc3', -1, 'refsw3/', None, 13),
    ('nullDC4Wii', -1, '', None, 14),
    ('polly2', -1, 'rtl/', None, 15),
    ('nullDC', -1, 'nulldc/', None, 16),
    ('minicast', -1, '', None, 17),
]
out = []
for lane, which, pfx, needle, seed in TARGETS:
    states = list(d.lane_states(lane)); g, st = states[which]
    cands = []
    for ident, (path, lines, dom, status) in st.items():
        if pfx not in path: continue
        for li, (r, o, k) in enumerate(lines):
            if k == 0xFFFF: continue
            t = d.text[r].decode('utf-8', 'replace').strip()
            if needle:
                if needle in t: cands.append((path, li, t, o, k))
            elif len(t) >= 30 and '"' not in t and "'" not in t and not FR[o].get('virtual') and FR[o]['k'] > 0:
                cands.append((path, li, t, o, k))
    if not cands: out.append(f'{lane}: no candidate for {needle or pfx}'); continue
    cands.sort()
    path, li, t, o, k = cands[0] if needle else random.Random(seed).choice(cands)
    if FR[o].get('virtual'):   # nullDC-pre2008: must be in nullDCe's recovered 2009 tree and in nullDC
        e = d.lanes[d.lane_idx['nullDCe']]; n = d.lanes[d.lane_idx['nullDC']]
        ce = FR[e['frames'][0]]['commit']; hits = [FR[x]['date'] for x in n['frames'] if git(n['repo'], 'grep', '-F', '-l', '-e', t, FR[x]['commit'], '--').strip()]
        ine = bool(git(e['repo'], 'grep', '-F', '-l', '-e', t, ce, '--').strip())
        sn = git(n['repo'], 'log', '--reverse', '--format=%h %cs %s', '-S', t, 'master').strip().split('\n')[0]
        out.append(f"{'OK' if ine and hits else 'CHECK'}  {lane} @ {FR[g]['date']} {path}:{li + 1}\n    {t[:110]}\n    origin nullDC-pre2008 (virtual)  keep {k} of {d.man['possible'][o][d.lane_idx[lane]]}\n"
                   f"    in nullDCe 2009 tree {ce[:9]}: {ine}; in {len(hits)} nullDC frames from {hits[0] if hits else '-'}\n    nullDC git log -S oldest: {sn[:90]}")
        continue
    fo = FR[o]; A = fo['lane']; L = d.lanes[d.lane_idx[A]]; repo = L['repo']
    c = fo['commit']; kk = fo['k']; prev = FR[L['frames'][kk - 1]]['commit'] if kk > 0 else None
    pres = bool(git(repo, 'grep', '-F', '-l', '-e', t, c, '--').strip())
    absent = (not git(repo, 'grep', '-F', '-l', '-e', t, prev, '--').strip()) if prev else None
    s = git(repo, 'log', '--reverse', '--format=%h %cs %s', '-S', t, c).strip().split('\n')
    first = s[0] if s and s[0] else '(none)'
    month_ok = first.split(' ')[1][:7] == fo['date'][:7] if first != '(none)' else False
    if not month_ok and prev:   # the introducing commit may be on a merged branch: is it in (prev, c]?
        h = first.split(' ')[0]
        ia = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), 'merge-base', '--is-ancestor', h, prev]).returncode == 0
        month_ok = not ia
    poss = d.man['possible'][o][d.lane_idx[lane]]
    verdict = 'OK' if pres and absent is not False and (month_ok or kk == 0) else 'CHECK'
    out.append(f"{verdict}  {lane} @ {FR[g]['date']} {path}:{li + 1}\n    {t[:110]}\n    origin {d.origin_label(o)}  keep {k} of {poss}\n"
               f"    present at origin commit: {pres}; absent at previous lane frame {prev[:9] if prev else '-'}: {absent}\n"
               f"    git log -S oldest: {first[:90]}  (month match or inside (prev, origin]: {month_ok})")
txt = '\n'.join(out); print(txt)
open(os.path.join(ROOT, 'agents/frames/spotcheck.txt'), 'w').write(txt + '\n')

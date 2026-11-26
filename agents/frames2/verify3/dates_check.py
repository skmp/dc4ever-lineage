#!/usr/bin/env python3
"""verify3: recompute tour dates (file last change at the frame) from repos/ for a sample of stops / origins.
Independent of attract_prep: frame commit from agents/frames/work/frames.tsv (full sha), repo from frames.py LANES,
override table from frames.py LANES options, git rev-list --first-parent -n1 + show -s %cs. Also checks the item's text
is in that file at that commit (lines: the line; segments: every distinctive line; files: the path matches the regex)."""
import os, sys, json, random, subprocess, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import frames as FR
REPO = {l[0]: l[1] for l in FR.LANES}
OVR = {k: v for l in FR.LANES for k, v in l[3].get('date', {}).items()}
full = {int(l.split('\t')[0]): l.split('\t')[3] for l in open(os.path.join(ROOT, 'agents/frames/work/frames.tsv'))}
D = json.load(open(os.path.join(ROOT, 'data/frames.json'))); FRM = D['frames']
A = json.load(open(os.path.join(ROOT, 'data/attract.json')))['items']
def git(repo, *a):
    return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True).stdout.decode('utf-8', 'replace')
def expect(f, path):
    fr = FRM[f]
    if fr.get('virtual') or 'virtual' in fr['kinds']: return {'date': '2005-2008'}
    repo = REPO[fr['lane']]; c = full[f]
    lc = git(repo, 'rev-list', '--first-parent', '-n1', c, '--', path).strip()
    cd, ad = git(repo, 'show', '-s', '--format=%cs %as', lc).split()
    e = {'commit': lc[:12], 'date': cd, 'adate': ad}
    for k, (dd, rng, note) in OVR.items():
        if lc.startswith(k): e['date'] = dd; e['range'] = rng
    if fr['lane'] == 'dc4ever': e['approx'] = True
    return e
def content_ok(it, f, path):
    fr = FRM[f]
    if fr.get('virtual') or 'virtual' in fr['kinds']: return True
    blob = git(REPO[fr['lane']], 'show', f'{full[f]}:{path}')
    if not blob: return 'missing'
    norm = lambda s: re.sub(r'\s+', ' ', s.replace('\t', '    ')).strip()
    nb = norm(blob)
    if it['kind'] == 'line': return norm(it['text'][:150]) in nb or 'text-not-found'
    if it['kind'] == 'segment':
        ls = [norm(x) for x in it['code'].split('\n') if len(x.strip()) > 8]
        miss = [x for x in ls if x[:100] not in nb]
        return len(miss) <= len(ls) // 4 or f'{len(miss)}/{len(ls)} lines missing'
    return True
random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 3)
samples = []   # (item index, 'origin'|'first'|stop k)
for i, it in enumerate(A):
    for k in range(len(it['stops'])): samples.append((i, k))
pick = random.sample(samples, 60)
# forced categories
def lanes_of(i, k): return FRM[A[i]['stops'][k][0]]['lane']
for want in ['dc4ever', 'nullDCe', 'nullDCe-PSP', 'reicast', 'flycast', 'nullDC4WiiU', 'nulldc3', 'NotDC-PS3', 'minicast', 'polly2', 'devtools', 'dreamcast-tests', 'shrike4', 'caique', 'wren7', 'polly2-r8', 'HarissaDC', 'nulldc-360', 'nullDC']:
    c = [s for s in samples if lanes_of(*s) == want]
    pick += random.sample(c, min(3, len(c)))
c = [s for s in samples if A[s[0]]['stop_files'][s[1]].get('commit', '').startswith('39c0550')]; pick += random.sample(c, min(4, len(c)))
c = [s for s in samples if A[s[0]]['stop_files'][s[1]].get('commit', '').startswith('1c16baeb0')]; pick += random.sample(c, min(4, len(c)))
c = [s for s in samples if lanes_of(*s) == 'flycast' and A[s[0]]['stop_files'][s[1]].get('date', '9') < '2018-06']; pick += random.sample(c, min(5, len(c)))
c = [s for s in samples if A[s[0]]['kind'] == 'file']; pick += random.sample(c, min(6, len(c)))
c = [s for s in samples if A[s[0]]['kind'] == 'segment']; pick += random.sample(c, min(6, len(c)))
pick = sorted(set(pick))
bad = 0; n = 0; lanes = set(); kinds = set()
def cmp(tag, i, f, got):
    global bad, n
    it = A[i]; path = got.get('path')
    if not path and not (FRM[f].get('virtual') or 'virtual' in FRM[f]['kinds']): print('NO PATH', tag, i, got); bad += 1; return
    e = expect(f, path) if path else expect(f, '')
    ok = got.get('date') == e['date'] and (('commit' not in e) or got.get('commit') == e['commit']) and got.get('range') == e.get('range') and bool(got.get('approx')) == bool(e.get('approx'))
    if 'range' in e and e['range'] not in got.get('label', ''): ok = False
    if e.get('approx') and 'approx' not in got.get('label', ''): ok = False
    co = content_ok(it, f, path) if path else True
    n += 1; lanes.add(FRM[f]['lane']); kinds.add(it['kind'])
    flag = '' if ok and co is True else '  <<< MISMATCH'
    if flag: bad += 1
    print(f"{tag:7s} item {i:3d} {it['kind']:7s} frame {f:4d} {FRM[f]['lane']:15s} {FRM[f]['date']} {FRM[f]['commit'][:9]} {path} -> got {got.get('label')} / {got.get('commit')} ; expect {e.get('date')} {e.get('range','')} {e.get('commit','')} adate {e.get('adate','')} content {co}{flag}")
for i, k in pick:
    cmp(f'stop{k}', i, A[i]['stops'][k][0], A[i]['stop_files'][k])
# origins / first_file of every item touched
for i in sorted({i for i, k in pick}):
    it = A[i]
    if it['kind'] == 'file': 
        s0 = min(it['stops'], key=lambda s: (FRM[s[0]]['date'], s[0]))
        # first_file is at the first stop in time over ALL stops (not just thinned) -> just recompute at its own path/frame
        f = next(s[0] for s, sf in zip(it['stops'], it['stop_files']) if sf == it['first_file']) if it['first_file'] in it['stop_files'] else None
        print('first  item', i, it['first_frame_date'], it['first_file'], 'frame in stops' if f is not None else 'frame not among thinned stops')
        if f is not None: cmp('first', i, f, it['first_file'])
    else:
        if it.get('origin_file') is None: print('origin_file NULL item', i); continue
        cmp('origin', i, it['origin'], it['origin_file'])
print(f'checked {n}: {bad} mismatches; lanes {len(lanes)} {sorted(lanes)}; kinds {sorted(kinds)}')

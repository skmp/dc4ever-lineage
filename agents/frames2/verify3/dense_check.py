#!/usr/bin/env python3
"""verify3: dense lanes. Per lane-local first-parent commit: counted churn from numstat (lang_of / not vendored / not
binary), threshold max(1500, 3% of the lines of the latest frame at or before the parent). Report big commits that are
not 'commit and its parent both frames', and the largest frame-to-frame step."""
import os, sys, json, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from rules import lang_of, is_vendored
import frames as F
def git(repo, *a):
    return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True, check=True).stdout
data = json.load(open(os.path.join(ROOT, 'data', 'frames.json')))
for lane, repo, tip, opt in F.LANES:
    if lane not in F.DENSE: continue
    frs = [f for f in data['frames'] if f['lane'] == lane and 'virtual' not in f.get('kinds', [])]
    fset = {f['commit'][:12]: f for f in frs}
    out = git(repo, 'log', '--first-parent', '--reverse', '--no-renames', '--numstat', '--format=@%H', tip).decode('utf-8', 'replace')
    order = []; ch = {}; cur = None
    for l in out.split('\n'):
        if l.startswith('@'): cur = l[1:]; order.append(cur); ch[cur] = 0
        elif l and cur:
            a, r, p = l.split('\t', 2)
            if a == '-' or not lang_of(p, repo) or is_vendored(repo, p): continue
            ch[cur] += int(a) + int(r)
    start = 0
    if opt.get('not_in'):
        reach = set(git(opt['not_in'], 'rev-list', next(x[2] for x in F.LANES if x[1] == opt['not_in'])).decode().split())
        sh = [i for i, s in enumerate(order) if s in reach]; start = sh[-1] + 1 if sh else 0
    lines = 0; bad = []; nbig = 0; kinds = {}
    for f in frs:
        for k in f['kinds']: kinds[k] = kinds.get(k, 0) + 1
    for i in range(start, len(order)):
        s = order[i]
        if s[:12] in fset: pass
        T = max(1500, 0.03 * lines)
        if ch[s] >= T:
            nbig += 1
            ok = s[:12] in fset and (i == 0 or order[i - 1][:12] in fset)
            if not ok: bad.append((s[:10], ch[s], int(T)))
        if s[:12] in fset: lines = fset[s[:12]]['lines']
    # largest frame-to-frame step
    idx = [i for i in range(start, len(order)) if order[i][:12] in fset]
    worst = max(((sum(ch[order[j]] for j in range(a + 1, b + 1)), b - a, order[a][:9], order[b][:9]) for a, b in zip(idx, idx[1:])), default=None)
    print(f'{lane}: frames {len(frs)} kinds {kinds} big(by my numstat, gen not excluded) {nbig} not-framed {len(bad)} {bad[:12]} worst step {worst}')

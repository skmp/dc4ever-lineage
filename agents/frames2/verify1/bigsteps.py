#!/usr/bin/env python3
"""bigsteps.py: dense-lane frame-to-frame steps over several commits whose counted churn > 20000; lists the step's commits
with their own counted churn (numstat vs first parent) to see why no `big` frame split it."""
import sys, os, json, subprocess
R = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(R, 'tools'))
from rules import lang_of, is_vendored
FR = json.load(open(os.path.join(R, 'data/frames.json')))['frames']
repo = {'nullDC4Wii': 'BenoitAdam_nullDC4Wii', 'reicast': 'skmp_reicast-emulator', 'flycast': 'flyinghead_flycast'}
def cnt(out, r):
    c = 0
    for l in out.splitlines():
        if '\t' not in l: continue
        x, y, p = l.split('\t', 2)
        if x != '-' and lang_of(p, r) and not is_vendored(r, p): c += int(x) + int(y)
    return c
for ln in sys.argv[1:] or repo:
    r = repo[ln]; G = ['git', '-C', os.path.join(R, 'repos', r + '.git')]
    fs = [f for f in FR if f['lane'] == ln]
    for a, b in zip(fs, fs[1:]):
        cs = subprocess.run(G + ['rev-list', '--first-parent', a['commit'] + '..' + b['commit']], capture_output=True, text=True).stdout.split()
        if len(cs) < 2: continue
        c = cnt(subprocess.run(G + ['diff', '--no-renames', '--numstat', a['commit'], b['commit']], capture_output=True, text=True, errors='replace').stdout, r)
        if c <= 20000: continue
        per = []
        for s in cs:
            per.append((cnt(subprocess.run(G + ['show', '--first-parent', '--no-renames', '--numstat', '--format=', s], capture_output=True, text=True, errors='replace').stdout, r), s[:10]))
        per.sort(reverse=True)
        print(f'{ln} {a["date"]} {a["commit"][:10]} -> {b["date"]} {b["commit"][:10]}: {len(cs)} commits, step churn {c:,}, sum {sum(p[0] for p in per):,}, top {per[:3]}')

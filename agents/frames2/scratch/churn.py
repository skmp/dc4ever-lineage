#!/usr/bin/env python3
"""churn.py: counted-source churn per first-parent commit of the dense lanes, and how many commits pass thresholds."""
import sys, os, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tools'))
from rules import lang_of, is_vendored
import frames as FR
def churn(repo, tip):
    out = FR.git(repo, 'log', '--first-parent', '--reverse', '--no-renames', '--numstat', '--format=@%H %cs', tip).decode('utf-8', 'replace')
    res = []; tot = 0; cur = None
    for l in out.split('\n'):
        if l.startswith('@'):
            if cur: res.append(cur)
            s, d = l[1:].split(' '); cur = [s, d, 0, 0]
        elif l and cur:
            a, r, p = l.split('\t', 2)
            if a == '-' or not lang_of(p, repo) or is_vendored(repo, p): continue
            cur[2] += int(a) + int(r); tot += int(a) - int(r); cur[3] = tot
    if cur: res.append(cur)
    return res
for lane in sys.argv[1:]:
    _, repo, tip, opt = next(c for c in FR.LANES if c[0] == lane)
    r = churn(repo, tip)
    for lo, pct in ((1500, .03), (2000, .03), (3000, .03), (1500, .02), (1000, .02), (5000, .05)):
        n = sum(1 for s, d, c, t in r if c >= max(lo, pct * max(t, 1)))
        print(lane, len(r), f'>= max({lo}, {pct})', n)

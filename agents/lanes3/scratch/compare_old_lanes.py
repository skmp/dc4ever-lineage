#!/usr/bin/env python3
"""compare_old_lanes.py BEFORE_DATA AFTER_DATA: every frame of every lane present in both: same commit, same files
(path + line texts), and the origin of every line (lane, commit); keep counts compared separately."""
import sys, os, collections
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tools'))
from frames_lib import Data
A, B = Data(sys.argv[1]), Data(sys.argv[2])
ta, tb = A.text, B.text
def okey(D, o):
    f = D.frames[o]; return 'virtual' if f.get('virtual') else (f['lane'], f['commit'])
for L in A.lanes:
    ln = L['name']
    sa = list(A.lane_states(ln)); sb = list(B.lane_states(ln))
    ca = [A.frames[g]['commit'] for g, _ in sa]; cb = [B.frames[g]['commit'] for g, _ in sb]
    added = [c[:9] for c in cb if c not in ca]; removed = [c[:9] for c in ca if c not in cb]
    ia = {A.frames[g]['commit']: s for g, s in sa}
    ib = {B.frames[g]['commit']: s for g, s in sb}
    txt = org = keep = 0; orgch = collections.Counter(); n = 0
    for c in ca:
        if c not in ib: continue
        xa = {v[0]: v[1] for v in ia[c].values()}; xb = {v[0]: v[1] for v in ib[c].values()}
        if set(xa) != set(xb): txt += 1; continue
        for p in xa:
            la, lb = xa[p], xb[p]
            if [ta[r] for r, o, k in la] != [tb[r] for r, o, k in lb]: txt += 1; continue
            for (r1, o1, k1), (r2, o2, k2) in zip(la, lb):
                n += 1
                a1, b1 = okey(A, o1), okey(B, o2)
                if a1 != b1: org += 1; orgch[(a1 if a1 == 'virtual' else a1[0], b1 if b1 == 'virtual' else b1[0])] += 1
                if k1 != k2: keep += 1
    print(f'{ln:16s} frames {len(ca)} -> {len(cb)} added {added} removed {removed} | text/file diffs {txt} | lines {n} origin changed {org} {dict(orgch)} keep changed {keep}', flush=True)

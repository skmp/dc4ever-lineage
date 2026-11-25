#!/usr/bin/env python3
"""origin_changes.py BEFORE_DATA AFTER_DATA LANE: distinct lines of LANE's last frame whose origin lane changed, with
paths, grouped by (old, new) origin lane; prints counts and samples."""
import sys, os, collections, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tools'))
from frames_lib import Data
A, B = Data(sys.argv[1]), Data(sys.argv[2]); ln = sys.argv[3]
def ol(D, o):
    f = D.frames[o]; return 'virtual' if f.get('virtual') else f['lane']
sa = list(A.lane_states(ln))[-1][1]; sb = list(B.lane_states(ln))[-1][1]
xa = {v[0]: v[1] for v in sa.values()}; xb = {v[0]: v[1] for v in sb.values()}
by = collections.defaultdict(list); files = collections.defaultdict(collections.Counter)
for p in xa:
    for (r1, o1, k1), (r2, o2, k2) in zip(xa[p], xb[p]):
        if k1 == 0xFFFF: continue
        a, b = ol(A, o1), ol(B, o2)
        if a != b: by[(a, b)].append((p, B.text[r2].strip(), B.frames[o2]['commit'][:9], B.frames[o2]['date'])); files[(a, b)][p] += 1
random.seed(1)
for k, v in sorted(by.items(), key=lambda kv: -len(kv[1])):
    print(f'== {k[0]} -> {k[1]}: {len(v)} lines; top files {files[k].most_common(6)}')
    for s in random.sample(v, min(8, len(v))): print('   ', s)

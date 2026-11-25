#!/usr/bin/env python3
"""ctx.py LANE PATH_SUFFIX GREP [BEFORE AFTER]: line ids and text around GREP in the lane's last frame."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tools'))
from frames_lib import Data
D = Data(); ln, suf, g = sys.argv[1:4]; b, a = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (6, 12)
last = None
for gi, s in D.lane_states(ln): last = s
for path, lines, dom, st in last.values():
    if not path.endswith(suf): continue
    for i, (r, o, k) in enumerate(lines):
        if g.encode() in D.text[r]:
            for j in range(max(0, i - b), min(len(lines), i + a)):
                r2 = lines[j][0]; print(r2, D.text[r2].decode('utf8', 'replace').rstrip()[:160])
            print('---')

#!/usr/bin/env python3
"""remap_picks.py OLD_DATA NEW_DATA PICKS_IN PICKS_OUT: remap tour pick line ids by exact text (lines) and by their
line texts in order (segments). Prints every remap; fails if a text is missing from the new table."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tools'))
from frames_lib import Data
A, B = Data(sys.argv[1]), Data(sys.argv[2]); ta, tb = A.text, B.text
idx = {}
for i, t in enumerate(tb):
    if t in idx: print('duplicate text in new table', i, idx[t]); continue
    idx[t] = i
P = json.load(open(sys.argv[3])); n = ch = 0; bad = 0
def m(i):
    global bad
    t = ta[i]
    if t not in idx: bad += 1; print('MISSING', i, t[:80]); return i
    return idx[t]
for it in P['items']:
    if it['kind'] == 'line':
        new = m(it['id']); ch += new != it['id']; it['id'] = new; n += 1
    else:
        new = [m(i) for i in it['ids']]; ch += new != it['ids']; it['ids'] = new; n += 1
print(f'{n} items, {ch} remapped, {bad} missing')
assert not bad
json.dump(P, open(sys.argv[4], 'w'), indent=1)

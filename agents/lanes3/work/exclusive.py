#!/usr/bin/env python3
"""exclusive.py CHILD_REPO CHILD_REF TARGET=REPO:REF EXCL=REPO:REF ... : child's significant own lines found in TARGET
but in none of the EXCL sources (per file count + samples). Tests a direct copy edge between child and TARGET."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from novel import lines, R
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
child=lines(os.path.join(R,sys.argv[1]),sys.argv[2])
srcs=[a.split('=',1) for a in sys.argv[3:]]
def load(o):
    lab,rr=o; repo,ref=rr.rsplit(':',1); return lab,set(t for _,t in lines(os.path.join(R,repo),ref))
with ThreadPoolExecutor(8) as ex: sets=list(ex.map(load,srcs))
tgt=sets[0][1]; ex_=set().union(*[s for _,s in sets[1:]])
hits=[(p,t) for p,t in child if t in tgt and t not in ex_]
print(f"{len(hits)}/{len(child)} child lines in {sets[0][0]} only (not in {', '.join(l for l,_ in sets[1:])})")
for p,n in Counter(p for p,_ in hits).most_common(15): print(f"  {n:5d} {p}")
for p,t in hits[:25]: print("    ",p,"|",t.decode('utf-8','replace')[:100])

#!/usr/bin/env python3
"""filesrc.py CHILD_REPO CHILD_REF PATHREGEX LABEL=REPO:REF ...: for child files matching PATHREGEX, significant lines found in each source."""
import sys, os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from novel import lines, R
from collections import defaultdict
child=[(p,t) for p,t in lines(os.path.join(R,sys.argv[1]),sys.argv[2]) if re.search(sys.argv[3],p)]
srcs=[a.split('=',1) for a in sys.argv[4:]]
sets=[(l,set(t for _,t in lines(os.path.join(R,rr.rsplit(':',1)[0]),rr.rsplit(':',1)[1]))) for l,rr in srcs]
F=defaultdict(lambda:[0]+[0]*len(sets))
for p,t in child:
    F[p][0]+=1
    for i,(_,s) in enumerate(sets): F[p][i+1]+=t in s
print("lines | "+" ".join(f"{l:>8s}" for l,_ in sets)+"  path")
for p,v in sorted(F.items()): print(f"{v[0]:5d} | "+" ".join(f"{x:8d}" for x in v[1:])+"  "+p)

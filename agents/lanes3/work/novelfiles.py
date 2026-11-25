#!/usr/bin/env python3
"""novelfiles.py CHILD_REPO CHILD_REF BASE=REPO:REF [LABEL=REPO:REF ...]
Per child file: significant own lines / in base / novel; novel found in each other source; novel in none.
Then 3 sample 'in none' lines per file."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from novel import lines, R
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
child=lines(os.path.join(R,sys.argv[1]),sys.argv[2])
srcs=[a.split('=',1) for a in sys.argv[3:]]
def load(o):
    lab,rr=o; repo,ref=rr.rsplit(':',1); return lab,set(t for _,t in lines(os.path.join(R,repo),ref))
with ThreadPoolExecutor(8) as ex: sets=list(ex.map(load,srcs))
base=sets[0][1]; others=sets[1:]
F=defaultdict(lambda:[0,0,0,[0]*len(others),0,[]])
for p,t in child:
    f=F[p]; f[0]+=1
    if t in base: f[1]+=1; continue
    f[2]+=1; anyh=False
    for i,(lab,s) in enumerate(others):
        if t in s: f[3][i]+=1; anyh=True
    if not anyh:
        f[4]+=1
        if len(f[5])<3: f[5].append(t.decode('utf-8','replace')[:110])
print("lines inbase novel | "+" ".join(l for l,_ in others)+" | none  path")
for p,f in sorted(F.items(),key=lambda kv:-kv[1][2]):
    if f[2]==0: continue
    print(f"{f[0]:5d} {f[1]:5d} {f[2]:5d} | "+" ".join(f"{x:5d}" for x in f[3])+f" | {f[4]:5d}  {p}")
print("TOTAL", sum(f[0] for f in F.values()), sum(f[1] for f in F.values()), sum(f[2] for f in F.values()), [sum(f[3][i] for f in F.values()) for i in range(len(others))], sum(f[4] for f in F.values()))
print("\n# samples of novel lines found nowhere")
for p,f in sorted(F.items(),key=lambda kv:-kv[1][4]):
    if f[4]==0: continue
    print(p); [print("    ",x) for x in f[5]]

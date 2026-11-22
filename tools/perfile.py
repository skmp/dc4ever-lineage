#!/usr/bin/env python3
"""perfile.py A REF_A B REF_B: per-file count of A's significant lines found in B (top 12)."""
import sys, os, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from count import scan
def content(repo, ref):
    r=[e for e in scan(repo, ref) if e['cls']=='own']
    d={}
    for e in r:
        data=subprocess.run(['git','-C',repo,'show',f'{ref}:{e["path"]}'],capture_output=True).stdout
        d[e['path']]=[b' '.join(l.split()) for l in data.replace(b'\r',b'').split(b'\n') if len(b' '.join(l.split()))>=20]
    return d
a=content(sys.argv[1],sys.argv[2]); b=content(sys.argv[3],sys.argv[4]); bs=set(x for v in b.values() for x in v)
res=sorted(((sum(1 for t in v if t in bs),len(v),p) for p,v in a.items()), reverse=True)[:12]
for h,n,p in res: print(h,n,p)

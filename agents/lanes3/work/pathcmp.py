#!/usr/bin/env python3
"""pathcmp.py A REF_A B REF_B: per path (all files): same blob / same normalized (CRLF, trailing ws) / differs / only A / only B."""
import subprocess, sys
def tree(repo, ref):
    out=subprocess.run(['git','-C',repo,'ls-tree','-r','-z',ref],capture_output=True).stdout
    d={}
    for rec in out.split(b'\0'):
        if not rec: continue
        meta,p=rec.split(b'\t',1); m=meta.split()
        if m[1]==b'blob': d[p.decode('utf-8','replace')]=m[2].decode()
    return d
def norm(repo, sha):
    data=subprocess.run(['git','-C',repo,'cat-file','blob',sha],capture_output=True).stdout
    return b'\n'.join(l.rstrip() for l in data.replace(b'\r',b'').split(b'\n')).strip()
a=tree(sys.argv[1],sys.argv[2]); b=tree(sys.argv[3],sys.argv[4])
la={k.lower():k for k in a}; lb={k.lower():k for k in b}
cat={'same':[], 'norm':[], 'diff':[], 'onlyA':[], 'onlyB':[]}
for k in sorted(set(la)|set(lb)):
    if k not in lb: cat['onlyA'].append(la[k]); continue
    if k not in la: cat['onlyB'].append(lb[k]); continue
    x=a[la[k]]; y=b[lb[k]]
    if x==y: cat['same'].append(la[k])
    elif norm(sys.argv[1],x)==norm(sys.argv[3],y): cat['norm'].append(la[k])
    else: cat['diff'].append(la[k])
for c,v in cat.items():
    print(f"## {c}: {len(v)}")
    for p in v: print("   ",p)

#!/usr/bin/env python3
"""diffsize.py A REF_A B REF_B: for paths in both with differing normalized text: lines of A, lines kept from B, added, removed (difflib)."""
import subprocess, sys, difflib
def tree(repo, ref):
    out=subprocess.run(['git','-C',repo,'ls-tree','-r','-z',ref],capture_output=True).stdout
    d={}
    for rec in out.split(b'\0'):
        if not rec: continue
        meta,p=rec.split(b'\t',1); m=meta.split()
        if m[1]==b'blob': d[p.decode('utf-8','replace').lower()]=(p.decode('utf-8','replace'),m[2].decode())
    return d
def lines(repo, sha):
    data=subprocess.run(['git','-C',repo,'cat-file','blob',sha],capture_output=True).stdout
    return [l.rstrip() for l in data.replace(b'\r',b'').split(b'\n')]
a=tree(sys.argv[1],sys.argv[2]); b=tree(sys.argv[3],sys.argv[4])
T=[0,0,0,0]
rows=[]
for k in sorted(set(a)&set(b)):
    if a[k][1]==b[k][1]: continue
    x=lines(sys.argv[1],a[k][1]); y=lines(sys.argv[3],b[k][1])
    if b'\0' in b''.join(x): continue
    sm=difflib.SequenceMatcher(None,y,x,autojunk=False)
    kept=sum(bl.size for bl in sm.get_matching_blocks())
    if kept==len(x)==len(y): continue
    r=(len(x),kept,len(x)-kept,len(y)-kept,a[k][0]); rows.append(r)
    for i in range(4): T[i]+=r[i]
for r in sorted(rows,key=lambda r:-(r[2]+r[3])): print("%6d %6d +%-5d -%-5d %s"%r)
print("TOTAL A lines %d kept %d added %d removed %d"%tuple(T))

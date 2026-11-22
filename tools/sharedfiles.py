#!/usr/bin/env python3
"""sharedfiles.py REPO_A REF_A REPO_B REF_B: list source files whose normalized content is identical in both."""
import subprocess, sys, hashlib
sys.path.insert(0, __import__('os').path.dirname(__file__))
from rules import lang_of
def files(repo, ref):
    out=subprocess.run(['git','-C',repo,'ls-tree','-r','-z',ref],capture_output=True).stdout
    ents=[]
    for rec in out.split(b'\0'):
        if not rec: continue
        meta,path=rec.split(b'\t',1); m=meta.split(); path=path.decode('utf-8','replace')
        if m[1]==b'blob' and lang_of(path): ents.append((path,m[2].decode()))
    p=subprocess.run(['git','-C',repo,'cat-file','--batch'],input=('\n'.join(e[1] for e in ents)+'\n').encode(),capture_output=True).stdout
    pos=0; d={}
    for path,_ in ents:
        he=p.index(b'\n',pos); sz=int(p[pos:he].split()[2]); data=p[he+1:he+1+sz]; pos=he+2+sz
        n=b'\n'.join(l.rstrip() for l in data.replace(b'\r',b'').split(b'\n')).strip()
        if n.count(b'\n')>=3: d.setdefault(hashlib.sha1(n).hexdigest(),[]).append((path,n.count(b'\n')+1))
    return d
a=files(sys.argv[1],sys.argv[2]); b=files(sys.argv[3],sys.argv[4])
tot=0
for h in sorted(set(a)&set(b), key=lambda h:a[h][0][0]):
    print(f"{a[h][0][1]:6d}  {a[h][0][0]}  ==  {b[h][0][0]}"); tot+=a[h][0][1]
print("TOTAL shared lines", tot, "files", len(set(a)&set(b)))

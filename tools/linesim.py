#!/usr/bin/env python3
"""linesim.py REPO_A REF_A REPO_B REF_B: share of A's own-source lines (trimmed, >= 20 chars, not comments-only braces)
whose text also appears somewhere in B's own source. A rough line-provenance estimate, language-agnostic."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from count import scan
import subprocess
def lines(repo, ref):
    r=[e for e in scan(repo, ref) if e['cls']=='own']
    ids=subprocess.run(['git','-C',repo,'ls-tree','-r','-z',ref],capture_output=True).stdout.split(b'\0')
    m={}
    for rec in ids:
        if not rec: continue
        meta,p=rec.split(b'\t',1); m[p.decode('utf-8','replace')]=meta.split()[2].decode()
    want=[m[e['path']] for e in r]
    out=subprocess.run(['git','-C',repo,'cat-file','--batch'],input=('\n'.join(want)+'\n').encode(),capture_output=True).stdout
    pos=0; L=[]
    for _ in want:
        he=out.index(b'\n',pos); sz=int(out[pos:he].split()[2]); data=out[he+1:he+1+sz]; pos=he+2+sz
        for ln in data.replace(b'\r',b'').split(b'\n'):
            t=b' '.join(ln.split())
            if len(t)>=20: L.append(t)
    return L
a=lines(sys.argv[1],sys.argv[2]); b=set(lines(sys.argv[3],sys.argv[4]))
hit=sum(1 for t in a if t in b)
print(f"{hit}/{len(a)} significant lines of A found in B = {100*hit/max(1,len(a)):.1f}%")

#!/usr/bin/env python3
"""novel.py CHILD_REPO CHILD_REF BASE_REPO BASE_REF [LABEL=REPO:REF ...]
Significant lines (>= 20 chars, whitespace-collapsed) of the child's own source (count.py rules): how many are in the
base; of the rest ("novel vs base"), how many appear in each other lane's own source, and in their union."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tools'))
import subprocess
from count import scan
from concurrent.futures import ThreadPoolExecutor
def lines(repo, ref):
    r=[e for e in scan(repo, ref) if e['cls']=='own']
    ids=subprocess.run(['git','-C',repo,'ls-tree','-r','-z',ref],capture_output=True).stdout.split(b'\0')
    m={}
    for rec in ids:
        if not rec: continue
        meta,p=rec.split(b'\t',1); m[p.decode('utf-8','replace')]=meta.split()[2].decode()
    want=[(e['path'],m[e['path']]) for e in r]
    out=subprocess.run(['git','-C',repo,'cat-file','--batch'],input=('\n'.join(w for _,w in want)+'\n').encode(),capture_output=True).stdout
    pos=0; L=[]
    for p,_ in want:
        he=out.index(b'\n',pos); sz=int(out[pos:he].split()[2]); data=out[he+1:he+1+sz]; pos=he+2+sz
        for ln in data.replace(b'\r',b'').split(b'\n'):
            t=b' '.join(ln.split())
            if len(t)>=20: L.append((p,t))
    return L
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..','repos')
def main():
    global child
    child=lines(os.path.join(R,sys.argv[1]),sys.argv[2])
    base=set(t for _,t in lines(os.path.join(R,sys.argv[3]),sys.argv[4]))
    nov=[(p,t) for p,t in child if t not in base]
    print(f"child {sys.argv[1]}@{sys.argv[2]}: {len(child)} significant own lines; in base {sys.argv[3]}@{sys.argv[4]}: {len(child)-len(nov)} ({100*(len(child)-len(nov))/len(child):.1f}%); novel {len(nov)}")
    others=[a.split('=',1) for a in sys.argv[5:]]
    def load(o):
        lab,rr=o; repo,ref=rr.rsplit(':',1); return lab, set(t for _,t in lines(os.path.join(R,repo),ref))
    with ThreadPoolExecutor(8) as ex: sets=list(ex.map(load,others))
    U=set()
    for lab,s in sets:
        h=[x for x in nov if x[1] in s]; U|=set(h)
        print(f"  {lab:28s} {len(h):6d}/{len(nov)} novel lines = {100*len(h)/max(1,len(nov)):.1f}%   (all child lines found: {sum(1 for _,t in child if t in s)}/{len(child)} = {100*sum(1 for _,t in child if t in s)/len(child):.1f}%)")
    print(f"  {'union':28s} {len(U):6d}/{len(nov)} = {100*len(U)/max(1,len(nov)):.1f}%")
    
if __name__=='__main__': main()

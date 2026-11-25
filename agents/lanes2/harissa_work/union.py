import sys, os
sys.path.insert(0, os.path.abspath('../tools'))
import importlib.util
spec=importlib.util.spec_from_file_location('ls','../tools/linesim.py')
# reimplement lines() to avoid running module main
from count import scan
import subprocess
def lines(repo, ref):
    r=[e for e in scan(repo, ref) if e['cls']=='own']
    want=[e['sha'] for e in r]
    out=subprocess.run(['git','-C',repo,'cat-file','--batch'],input=('\n'.join(want)+'\n').encode(),capture_output=True).stdout
    pos=0; L=[]
    for e in r:
        he=out.index(b'\n',pos); sz=int(out[pos:he].split()[2]); data=out[he+1:he+1+sz]; pos=he+2+sz
        for ln in data.replace(b'\r',b'').split(b'\n'):
            t=b' '.join(ln.split())
            if len(t)>=20: L.append((e['path'],t))
    return L
a=lines('kernel64_HarissaDC.git','v0.3.0')
par={}
for l in open(sys.argv[1]):
    n,repo,ref=l.split(); par[n]=set(t for _,t in lines(repo,ref))
allp=set().union(*par.values())
hit=[(p,t) for p,t in a if t in allp]
print(f"union of all parents: {len(hit)}/{len(a)} = {100*len(hit)/len(a):.2f}%")
from collections import Counter
print("by file:", Counter(p for p,_ in hit).most_common(15))
for n in ['nullDC4Wii-head','nulldc-360','flycast-1103','NotDC-PS3']:
    h=[t for _,t in a if t in par[n]]
    print('\n==',n,len(h)); 
    for t in sorted(set(h),key=len,reverse=True)[:12]: print('  ',t.decode('utf-8','replace')[:120])

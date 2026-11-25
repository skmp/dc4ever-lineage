# loose check: lines >= 10 chars, all whitespace removed, lowercased; excludes lines that are only punctuation/keywords
import sys, os, subprocess, re
sys.path.insert(0, os.path.abspath('../tools'))
from count import scan
def lines(repo, ref):
    r=[e for e in scan(repo, ref) if e['cls']=='own']
    out=subprocess.run(['git','-C',repo,'cat-file','--batch'],input=('\n'.join(e['sha'] for e in r)+'\n').encode(),capture_output=True).stdout
    pos=0; L=[]
    for e in r:
        he=out.index(b'\n',pos); sz=int(out[pos:he].split()[2]); data=out[he+1:he+1+sz]; pos=he+2+sz
        for ln in data.replace(b'\r',b'').split(b'\n'):
            t=b''.join(ln.split()).lower()
            if len(t)>=10 and not t.startswith((b'//',b'/*',b'*')): L.append(t)
    return L
a=lines('kernel64_HarissaDC.git','v0.3.0')
for l in open(sys.argv[1]):
    n,repo,ref=l.split(); b=set(lines(repo,ref)); h=sum(1 for t in a if t in b)
    print(f"{n}: {h}/{len(a)} = {100*h/len(a):.1f}%")

#!/usr/bin/env python3
"""count.py REPO REF [--dirs DEPTH] [--json]
Counts source files/lines at REF (blob-level, no checkout). Classification and vendored rules
live in rules.py. --dirs prints per-directory breakdown (own vs vendored) to find vendored code."""
import subprocess, sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rules import lang_of, is_vendored, is_generated
def scan(repo, ref):
    out = subprocess.run(['git','-C',repo,'ls-tree','-r','-z','--long',ref], capture_output=True).stdout
    ents=[]
    for rec in out.split(b'\0'):
        if not rec: continue
        meta, path = rec.split(b'\t',1); m=meta.split()
        if m[1]!=b'blob': continue
        path=path.decode('utf-8','replace'); lang=lang_of(path)
        if lang: ents.append((path, m[2].decode(), int(m[3]), lang))
    # batch line counts
    ids=[e[1] for e in ents]
    res=[]
    if ids:
        p=subprocess.Popen(['git','-C',repo,'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
        import threading
        def feed():
            p.stdin.write(('\n'.join(ids)+'\n').encode()); p.stdin.close()
        threading.Thread(target=feed).start()
        for (path,bid,sz,lang) in ents:
            hdr=p.stdout.readline(); n=int(hdr.split()[2]); data=p.stdout.read(n); p.stdout.read(1)
            binary = b'\0' in data[:8000]
            lines = 0 if binary else data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
            cls = 'binary' if binary else ('vendored' if is_vendored(repo,path) else ('generated' if is_generated(repo,path,sz,lines,data[:600]) else 'own'))
            res.append(dict(path=path,lang=lang,lines=lines,bytes=sz,cls=cls))
        p.wait()
    return res
if __name__=='__main__':
    repo, ref = sys.argv[1], sys.argv[2]
    r=scan(repo,ref)
    if '--json' in sys.argv: print(json.dumps(r)); sys.exit()
    tot={}
    for e in r: t=tot.setdefault(e['cls'],[0,0]); t[0]+=1; t[1]+=e['lines']
    print(ref, {k:tuple(v) for k,v in tot.items()})
    if '--dirs' in sys.argv:
        d=int(sys.argv[sys.argv.index('--dirs')+1]); agg={}
        for e in r:
            k=('/'.join(e['path'].split('/')[:d]), e['cls']); a=agg.setdefault(k,[0,0]); a[0]+=1; a[1]+=e['lines']
        for (k,c),(f,l) in sorted(agg.items(), key=lambda x:-x[1][1])[:int(os.environ.get('TOP','40'))]:
            print(f"{l:8d} {f:5d} {c:9s} {k}")
    lang={}
    for e in r:
        if e['cls']=='own': a=lang.setdefault(e['lang'],[0,0]); a[0]+=1; a[1]+=e['lines']
    print(' own by lang:', {k:tuple(v) for k,v in sorted(lang.items(), key=lambda x:-x[1][1])})

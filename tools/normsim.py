#!/usr/bin/env python3
"""normsim.py CHILD_REPO CHILD_REF PARENT_REPO [rev-list args...]
Like blobsim, but hashes source content with CR and trailing whitespace stripped (CRLF-robust).
Caches per-blob normalized hashes."""
import subprocess, sys, hashlib
SRC = ('.c','.cpp','.cc','.h','.hpp','.cs','.s','.S','.asm','.inc','.java','.kt','.m','.mm','.glsl','.vert','.frag','.fx','.hlsl','.sv','.v','.svh','.py','.ts','.js')
cache={}
def norm_hashes(repo, ref):
    out = subprocess.run(['git','-C',repo,'ls-tree','-r',ref], capture_output=True, text=True, errors='replace').stdout
    ids=[]
    for l in out.splitlines():
        meta, path = l.split('\t',1); m=meta.split()
        if m[1]=='blob' and path.endswith(SRC): ids.append(m[2])
    need=[i for i in ids if (repo,i) not in cache]
    if need:
        p=subprocess.run(['git','-C',repo,'cat-file','--batch'],input=('\n'.join(need)+'\n').encode(),capture_output=True).stdout
        pos=0
        for i in need:
            hdr_end=p.index(b'\n',pos); sz=int(p[pos:hdr_end].split()[2]); data=p[hdr_end+1:hdr_end+1+sz]; pos=hdr_end+1+sz+1
            lines=[ln.rstrip() for ln in data.replace(b'\r',b'').split(b'\n')]
            cache[(repo,i)]=hashlib.sha1(b'\n'.join(lines).strip()).hexdigest()
    return set(cache[(repo,i)] for i in ids)
child=norm_hashes(sys.argv[1], sys.argv[2])
revs=subprocess.run(['git','-C',sys.argv[3],'rev-list']+sys.argv[4:],capture_output=True,text=True).stdout.split()
res=[]
for r in revs:
    p=norm_hashes(sys.argv[3], r); res.append((len(child&p),len(child),len(p),r))
res.sort(reverse=True)
for sh,c,p,r in res[:6]:
    info=subprocess.run(['git','-C',sys.argv[3],'log','-1','--format=%h %ad %s','--date=short',r],capture_output=True,text=True).stdout.strip()
    print(f"{sh:5d}/{c:5d} child vs {p:5d} parent  {info[:100]}")

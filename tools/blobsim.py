#!/usr/bin/env python3
"""blobsim.py CHILD_REPO CHILD_REF PARENT_REPO [rev-list args...]
For each commit of the parent (rev-list), Jaccard-like overlap of source blob ids with child ref.
Prints top matches: shared blobs / child blobs / parent blobs."""
import subprocess, sys
SRC = ('.c','.cpp','.cc','.h','.hpp','.cs','.s','.S','.asm','.inc','.java','.kt','.m','.mm','.glsl','.vert','.frag','.fx','.hlsl','.sv','.v','.svh','.py','.ts','.js')
def blobs(repo, ref):
    out = subprocess.run(['git','-C',repo,'ls-tree','-r',ref], capture_output=True, text=True).stdout
    s=set()
    for l in out.splitlines():
        meta, path = l.split('\t',1)
        m = meta.split()
        if m[1]=='blob' and path.endswith(SRC): s.add(m[2])
    return s
child = blobs(sys.argv[1], sys.argv[2])
revs = subprocess.run(['git','-C',sys.argv[3],'rev-list']+sys.argv[4:], capture_output=True, text=True).stdout.split()
res=[]
for r in revs:
    p = blobs(sys.argv[3], r)
    sh = len(child & p)
    res.append((sh, len(child), len(p), r))
res.sort(reverse=True)
for sh,c,p,r in res[:8]:
    info = subprocess.run(['git','-C',sys.argv[3],'log','-1','--format=%h %ad %s','--date=short',r],capture_output=True,text=True).stdout.strip()
    print(f"{sh:5d}/{c:5d} child  vs {p:5d} parent  {info[:100]}")

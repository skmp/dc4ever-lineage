import json,subprocess,sys,re
R='/home/skmp/projects/nulldc-lineage/repos/'
m=json.load(open('/home/skmp/projects/nulldc-lineage/data/manifest.json'))
ext=set('.c .cpp .cc .cxx .h .hpp .hh .hxx .inl .cs .s .S .asm .glsl .vert .frag .vs .ps .fs .fx .hlsl .metal .vsh .fsh .cg .comp .geom .vp .fp .java .kt .m .mm .sv .svh .v .vh .ts .tsx .py'.split())
snaps=json.load(open('/home/skmp/projects/nulldc-lineage/agents/collect/snapshots.json'))
for s in m['snapshots']:
    if sys.argv[1:] and s['id'] not in sys.argv[1:]: continue
    g=R+s['repo']+'.git'
    out=subprocess.run(['git','-C',g,'ls-tree','-r','-z','--format=%(objectname) %(path)',s['commit']],capture_output=True).stdout.decode('utf8','replace').split('\0')
    files=[]
    for l in out:
        if not l: continue
        o,p=l.split(' ',1)
        e='.'+p.rsplit('.',1)[-1] if '.' in p.rsplit('/',1)[-1] else ''
        if e in ext and not p.endswith('.d.ts'): files.append((o,p))
    # cat-file batch
    inp='\n'.join(o for o,_ in files)+'\n'
    pr=subprocess.run(['git','-C',g,'cat-file','--batch'],input=inp.encode(),capture_output=True).stdout
    i=0;n=0;L=0;nul=0;big=0
    for o,p in files:
        hdr_end=pr.index(b'\n',i);sz=int(pr[i:hdr_end].split()[2]);b=pr[hdr_end+1:hdr_end+1+sz];i=hdr_end+1+sz+1
        if b'\0' in b: nul+=1;continue
        n+=1;L+=b.count(b'\n')
    print(s['id'],'raw files',n,'lines',L,'| manifest',s['files'],s['lines'])

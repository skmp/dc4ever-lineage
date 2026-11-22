import json,gzip,subprocess,sys,collections,re
B='/home/skmp/projects/nulldc-lineage/'
m=json.load(open(B+'data/manifest.json'));S={s['id']:s for s in m['snapshots']}
D=json.load(open(B+'data/diffs.json'))
def lines(sid):
    s=S[sid];j=json.load(gzip.open(B+'data/snap/%02d.json.gz'%s['i']))
    paths=[f['p'] for f in j['files']]
    g=B+'repos/'+s['repo']+'.git'
    inp=''.join(f"{s['commit']}:{p}\n" for p in paths)
    out=subprocess.run(['git','-C',g,'cat-file','--batch'],input=inp.encode(),capture_output=True).stdout
    c=collections.Counter();i=0;nf=0;raw=0
    while i<len(out):
        e=out.index(b'\n',i);h=out[i:e].split();sz=int(h[2]);b=out[e+1:e+1+sz];i=e+1+sz+1;nf+=1
        t=b.decode('utf8','replace'); L=t.split('\n')
        if L and L[-1]=='': L=L[:-1]
        raw+=len(L)
        for l in L:
            k=' '.join(l.split())
            if k: c[k]+=1
    return c,nf,raw,len(paths),s
for a,b in [x.split('>') for x in sys.argv[1:]]:
    ca,nfa,ra,pa,sa=lines(a);cb,nfb,rb,pb,sb=lines(b)
    kept=sum((ca&cb).values())
    ia,ib=sa['i'],sb['i']
    print(f"{a}->{b}: files {nfa}/{sa['files']} {nfb}/{sb['files']} raw {ra}/{sa['lines']} {rb}/{sb['lines']} | norm {sum(ca.values())} vs {D['lines'][ia]}, {sum(cb.values())} vs {D['lines'][ib]} | kept {kept} vs {D['kept'][ia][ib]}")

#!/usr/bin/env python3
"""snapshot.py SPEC OUT_JSON: count every snapshot in SPEC (id|repo|ref|date|lane|why) and write snapshots.json."""
import sys, os, json, re, subprocess
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from count import scan
from rules import VRE, EXTRA
REPOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'repos')
def vroot(repo, path):
    key = repo
    for pre in EXTRA.get(key, []):
        m = re.search(pre, path)
        if m: return path[:m.end()].rstrip('/')
    for r in VRE:
        m = r.search(path)
        if m:
            # root = vendored dir plus one more component (the library)
            rest = path[m.end():].split('/')
            return (path[:m.end()] + (rest[0] if len(rest) > 1 else '')).rstrip('/')
    return '?'
def one(line):
    sid, repo, ref, date, lane, why = [x.strip() for x in line.split('|', 5)]
    g = os.path.join(REPOS, repo + '.git')
    full = subprocess.run(['git','-C',g,'rev-parse',ref+'^{commit}'],capture_output=True,text=True,check=True).stdout.strip()
    cdate = subprocess.run(['git','-C',g,'log','-1','--format=%ad','--date=short',full],capture_output=True,text=True).stdout.strip()
    r = scan(g, full)
    def tot(cls): 
        es=[e for e in r if e['cls']==cls]; return len(es), sum(e['lines'] for e in es)
    own=[e for e in r if e['cls']=='own']
    lang={}
    for e in own: a=lang.setdefault(e['lang'],[0,0]); a[0]+=1; a[1]+=e['lines']
    vend={}
    for e in r:
        if e['cls']=='vendored': a=vend.setdefault(vroot(repo,e['path']),[0,0]); a[0]+=1; a[1]+=e['lines']
    gen={}
    for e in r:
        if e['cls']=='generated': gen[e['path']]=e['lines']
    f,l = tot('own'); vf,vl = tot('vendored'); gf,gl = tot('generated'); bf,_=tot('binary')
    return dict(id=sid, repo=repo, ref=ref, commit=full, date=date, commit_date=cdate, lane=lane, why=why,
        files=f, lines=l, by_lang={k:{'files':v[0],'lines':v[1]} for k,v in sorted(lang.items(), key=lambda x:-x[1][1])},
        vendored={'files':vf,'lines':vl,'dirs':{k:{'files':v[0],'lines':v[1]} for k,v in sorted(vend.items(), key=lambda x:-x[1][1])}},
        generated={'files':gf,'lines':gl,'top':dict(sorted(gen.items(), key=lambda x:-x[1])[:10])}, binary_source_ext_files=bf)
if __name__=='__main__':
    lines=[l for l in open(sys.argv[1]) if l.strip() and not l.startswith('#')]
    with Pool(8) as p: res=p.map(one, lines)
    res.sort(key=lambda s:(s['date'], s['id']))
    dn=os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])),'datenotes.json')
    if os.path.exists(dn):
        notes=json.load(open(dn))
        for s in res: s.update(notes.get(s['id'],{}))
    out=dict(rules='tools/rules.py', spec='agents/collect/snapshots.spec', repos_dir='repos/',
        counted_languages=['C','C++','C/C++ header','C#','Assembly','Shader','Java','Kotlin','Objective-C','SystemVerilog','Verilog','TypeScript','Python'], snapshots=res,
        total_lines=sum(s['lines'] for s in res), total_files=sum(s['files'] for s in res),
        total_lines_with_vendored=sum(s['lines']+s['vendored']['lines'] for s in res),
        largest=max(res, key=lambda s:s['lines'])['id'])
    json.dump(out, open(sys.argv[2],'w'), indent=1)
    for s in res: print(f"{s['date']} {s['id']:24s} {s['files']:5d} {s['lines']:8d}  vend {s['vendored']['lines']:7d} gen {s['generated']['lines']:7d}  {s['commit'][:9]} {s['commit_date']}")
    print('TOTAL', out['total_files'], out['total_lines'], 'with vendored', out['total_lines_with_vendored'], 'largest', out['largest'])

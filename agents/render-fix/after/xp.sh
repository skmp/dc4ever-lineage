#!/bin/bash
# xp.sh NAME EXTRA: path C profile at 2560x1440 with URL knobs -> one summary line
cd $(dirname $0)/../../..
EXTRA="$2" node tools/verify/run.mjs eval --gpu --port 8743 --size 2560x1440 --js agents/render-fix/after/js/.prof.js --out agents/render-fix/after/.tmp > agents/render-fix/after/xp-$1.txt 2>&1
node -e '
const t=require("fs").readFileSync(process.argv[1],"utf8"); const r=JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("\n}")+2));
const mb=r.rec.map(x=>x.alloc.split(" ").filter(Boolean).reduce((a,s)=>a+ +s.split(":")[1],0)); const g=r.rec.map(x=>x.gpu).filter(x=>x!=null).sort((a,b)=>a-b);
console.log(process.argv[2], "frames",r.frames,"p50",r.p50,"p95",r.p95,"over100",r.over100,"gpu p50/p95",g[g.length>>1],g[Math.floor(g.length*0.95)],"allocMB",mb.reduce((a,b)=>a+b,0),"bakeLines",r.rec.reduce((a,x)=>a+x.bl,0),"loads",r.rec.reduce((a,x)=>a+x.loads,0))' agents/render-fix/after/xp-$1.txt $1

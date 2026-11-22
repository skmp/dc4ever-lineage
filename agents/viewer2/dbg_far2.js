await V.view('far');
const out = {};
for (const sk of ['', 't3', 'labels,floor,plates,segs,t3', 'labels,floor,plates,segs,t3,imp,deco']) {
  V.skip = new Set(sk.split(',')); await new Promise(r => setTimeout(r, 1500));
  const g = V.stats.gpu.slice(-3); out[sk || 'none'] = g.map(x => +x.toFixed(1));
}
return { cam: V.cam.p.map(Math.round), out, t3: V.stats.t3 };

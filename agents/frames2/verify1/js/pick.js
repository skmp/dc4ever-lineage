const A = V.attract, it = A.items.find(i => i.kind === 'line');
await A.showItem(it, 0);
const res = [];
for (const [x, y] of [[0.5, 0.5], [0.3, 0.5], [0.5, 0.4], [0.5, 0.6], [0.2, 0.5]]) { const p = V.pick(innerWidth * x, innerHeight * y); res.push(p ? { kind: p.kind, id: p.id, line: p.line, char: p.char, path: p.path, f: p.f } : null); }
return { want: it.id, stop: it.stops[0], res, cam: V.cam.p, wx: V.W[it.stops[0][0]].x, iw: innerWidth };

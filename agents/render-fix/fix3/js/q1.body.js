const ln = LNn('nullDC4Wii'); const k = Math.floor(ln.frames.length * 0.6); const r = [];
for (let q = k - 3; q <= k + 3; q++) { const w = V.W[ln.frames[q]]; r.push({ q, f: ln.frames[q], x: w.x, xs: ln.xs[q], title: w.shortTitle }); }
V.setX(V.W[ln.frames[k]].x + 1, { follow: false }); await sleep(300);
const L = V.live.find(l => l.lane === ln.li);
let dup = 0, minGap = 1e9; for (const l of V.LN) for (let q = 1; q < l.xs.length; q++) { const g = l.xs[q] - l.xs[q - 1]; if (g < 1) dup++; if (g < minGap) minGap = g; }
return { shots: {}, log: [], r, live: L && L.f, focus: ln.frames[k], dupLT1: dup, minGap };

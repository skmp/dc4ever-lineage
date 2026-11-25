const per = {}; let tot = 0, miss = 0; const ex = [];
for (const ln of V.LN) for (let q = 0; q < ln.frames.length; q++) { const f = ln.frames[q], w = V.W[f]; tot++;
  const g = V.laneFrameAt(ln.li, w.x + 1); if (g !== f) { miss++; per[ln.name] = (per[ln.name] || 0) + 1; if (ex.length < 8) ex.push({ lane: ln.name, f, title: w.shortTitle, got: V.W[g] && V.W[g].shortTitle, x: w.x, gx: V.W[g] && V.W[g].x }); } }
const neg = {}; for (const ln of V.LN) for (let q = 1; q < ln.xs.length; q++) if (ln.xs[q] < ln.xs[q - 1]) neg[ln.name] = (neg[ln.name] || 0) + 1;
return { shots: {}, log: [], tot, miss, per, neg, ex };

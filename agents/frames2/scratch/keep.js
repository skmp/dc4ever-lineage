const ln = V.LN.find(l => l.name === 'flycast'), w = V.W[ln.frames.at(-1)]; V.setX(w.x + 1); await V.ensureWall(w.i, 30000);
const h = {}; let n = 0;
for (const x of V.WALLS) if (x.inst) for (let j = 0; j < x.inst.length; j += 2) { const kk = ((x.inst[j + 1] >>> 20) & 1023) | ((x.inst[j] >>> 31) << 10); n++; if (kk > 1240) h[kk] = (h[kk] || 0) + 1; }
return { n, h };

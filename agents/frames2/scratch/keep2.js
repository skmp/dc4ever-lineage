const ln = V.LN.find(l => l.name === 'flycast'), w = V.W[ln.frames.at(-1)]; V.setX(w.x + 1); await V.ensureWall(w.i, 30000);
const out = [];
for (const x of V.WALLS) if (x.inst) for (let j = 0; j < x.inst.length; j += 2) { const kk = ((x.inst[j + 1] >>> 20) & 1023) | ((x.inst[j] >>> 31) << 10);
  if (kk > 1240 && kk !== 2047 && out.length < 12) out.push({ f: x.i, lane: V.F.frames[x.i].lane, w0: x.inst[j].toString(16), w1: x.inst[j + 1].toString(16), og: (x.inst[j] >>> 20) & 2047, kk }); }
return out;

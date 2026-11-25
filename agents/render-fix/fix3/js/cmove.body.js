// fix3: path C motion (one lane in 4 s, as the 20 s benchmark): per tick fading / hidden counts, draws
V.presMode = 'clock'; V.setX(V.xMax + V.U); const res = {};
for (const name of ['flycast', 'nullDC4Wii']) { const L = LNn(name);
  const at = f => { V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); };
  at(0); await ready(1500); const TL = []; const t0 = performance.now();
  const step = () => { const t = (performance.now() - t0) / 4000; at(Math.min(1, t)); TL.push([V.stats.fading, V.stats.hidden, V.stats.draws]); };
  V.on('tick', step); await sleep(4000); V.off('tick', step);
  const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * p)];
  const fa = TL.map(e => e[0]), hi = TL.map(e => e[1]);
  res[name] = { ticks: TL.length, fading50: q(fa, .5), fading95: q(fa, .95), fadingMax: Math.max(...fa), hidden50: q(hi, .5) };
}
return { shots: SHOTS, log: LOG, res };

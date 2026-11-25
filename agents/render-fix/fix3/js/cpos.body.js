// fix3: path C camera (flycast / nullDC4Wii lane flights) held at fixed points: fading / hidden wall counts and GPU ms
V.presMode = 'clock'; V.setX(V.xMax + V.U); const res = [];
for (const name of ['flycast', 'nullDC4Wii']) { const L = LNn(name);
  for (const f of [0.15, 0.35, 0.55, 0.75]) {
    V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]);
    await ready(1500); const n0 = V.stats.gpuN || 0; await sleep(700); const g = V.stats.gpu.slice(-Math.max(1, (V.stats.gpuN || 0) - n0)).sort((a, b) => a - b);
    res.push({ name, f, fading: V.stats.fading, hidden: V.stats.hidden, vis: V.stats.visibleWalls, draws: V.stats.draws, inst: V.stats.inst, imp: V.stats.imp, gpu50: +g[g.length >> 1].toFixed(2), n: g.length });
    if (f === 0.35) await snap('c-' + name + '-' + f);
  } }
return { shots: SHOTS, log: LOG, res };

// path C (lane flights) for DUR s with per-frame records: dt, cpu, PROF sections, bakes (alloc tiers/MB, done, lines), loads, inst
const DUR = +(new URLSearchParams(location.search).get('dur') || 15);
V.fixedQuality = false; V.presMode = 'clock'; V.setX(V.xMax + V.U, { follow: false });
const lanes = ['nullDC', 'reicast', 'flycast', 'nulldc3', 'nullDC4Wii'].map(LNn);
const step = t => { const passes = lanes.length, x = t * passes, i = Math.min(passes - 1, Math.floor(x)), f = x - i, L = lanes[i];
  V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); };
step(0); await V.whenReady({ timeout: 60000 });
let walls0 = V.load.walls, loads = 0; const onWall = () => loads++; V.on('wall', onWall);
const rec = []; let t0 = null, gN = V.stats.gpuN || 0;
await new Promise(res => {
  const tick = () => { const now = performance.now(); if (t0 === null) t0 = now; const t = Math.min(1, (now - t0) / (DUR * 1000)); step(t); if (t >= 1) { V.off('tick', tick); V.off('frame', fr); res(); } };
  const fr = ({ cpu, rawDt }) => { const g = (V.stats.gpuN || 0) !== gN ? V.stats.gpu.at(-1) : null; gN = V.stats.gpuN || 0;
    rec.push({ dt: +rawDt.toFixed(1), cpu: +cpu.toFixed(1), gpu: g == null ? null : +g.toFixed(1), prof: V.prof.cur.filter(x => x[1] > 1), alloc: V.bakeLog.alloc.join(' '), done: V.bakeLog.done, bl: V.bakeLog.lines, loads, inst: V.stats.inst, q: V.quality.step, sk: V.stats.skipped });
    loads = 0; };
  V.on('tick', tick); V.on('frame', fr);
});
V.off('wall', onWall);
const dts = rec.map(r => r.dt).sort((a, b) => a - b);
return { shots: {}, log: [], frames: rec.length, p50: dts[dts.length >> 1], p95: dts[Math.floor(dts.length * 0.95)], over100: dts.filter(d => d > 100).length, rec };

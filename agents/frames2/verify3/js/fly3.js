// verify3 perf: load, then flights at FIXED camera speeds (like for like across builds), rAF interval (vsync-capped)
const r = { load: { ...V.load }, walls: V.WALLS.length };
if (window.gc) { gc(); await new Promise(x => setTimeout(x, 300)); }
r.heapAfterLoadGC = +(performance.memory.usedJSHeapSize / 1048576).toFixed(0);
r.gpuAtLoad = +(V.stats.gpuBytes / 1048576).toFixed(0);
V.attract.stop(); V.setPlaying(false); V.presMode = 'clock';
const st = a => { a = a.slice().sort((p, q) => p - q); return { n: a.length, p50: +a[a.length >> 1].toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), p99: +a[Math.floor(a.length * 0.99)].toFixed(1), max: +a.at(-1).toFixed(0), over33: a.filter(x => x > 33.4).length } };
const lane = n => V.LN.find(l => l.name === n);
async function fly(name, dur, step) {
  const dts = []; let heap = 0; const t0 = performance.now(); let last = t0;
  while (performance.now() - t0 < dur * 1000) { step((performance.now() - t0) / 1000);
    await new Promise(q => requestAnimationFrame(q)); const n = performance.now(); dts.push(n - last); last = n; heap = Math.max(heap, performance.memory.usedJSHeapSize / 1048576); }
  r[name] = { ...st(dts.slice(2)), heapMax: +heap.toFixed(0), gpuMB: +(V.stats.gpuBytes / 1048576).toFixed(0) };
}
const SP = 5000;   // units / s
const xp = V.tm.xOfDate('2026-06-01'), p2 = lane('polly2'), zMax = V.LN.at(-1).z0 + V.LN.at(-1).L.width;
V.setX(V.xMax + V.U, { follow: false });
await fly('polly2Low5k', 15, t => { V.cam.p = [xp - 4000 + SP * t, 2500, p2.z0 - 1500]; V.setLook([1, -0.05, 0.12]); });
await fly('fpgaHigh5k', 15, t => { V.cam.p = [xp - 15000 + SP * t, 6000, zMax * 0.55]; V.setLook([0.85, -0.12, 0.5]); });
const xr = V.tm.xOfDate('2018-01-01'), rc = lane('reicast');
await fly('reicastLow5k', 15, t => { V.cam.p = [xr + SP * t, 2500, rc.z0 - 1500]; V.setLook([1, -0.05, 0.12]); });
const d4 = lane('dc4ever'), xd = V.W[d4.frames[0]].x;
V.setX(V.W[d4.frames.at(-1)].x + 1, { follow: false });
await fly('dc4everLow3k', 15, t => { V.cam.p = [xd - 3000 + 3000 * t, 2500, d4.z0 - 1500]; V.setLook([1, -0.05, 0.12]); });
V.setX(V.xMax + V.U, { follow: false });
const ov = V.overview();
await fly('overview', 8, () => { V.cam.p = ov.p; V.setLook(ov.dir); });
// the same stretch in the same TIME as on the old axis (verify2's densefly speed): crosses 2026-06..end in 15 s
await fly('polly2LowTimed', 15, t => { const x = xp + (V.xMax - xp) * t / 15; V.cam.p = [x - 4000, 2500, p2.z0 - 1500]; V.setLook([1, -0.05, 0.12]); });
if (window.gc) gc(); r.heapEndGC = +(performance.memory.usedJSHeapSize / 1048576).toFixed(0);
r.gpuEnd = +(V.stats.gpuBytes / 1048576).toFixed(0); r.loadedWalls = V.load.walls;
return r;

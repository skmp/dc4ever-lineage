// eval body (tools/verify/run.mjs eval --js): load times and memory, then a sweep along the whole timeline
const t0 = performance.now();
await V.whenReady({ timeout: 120000 });
const r = { load: { ...V.load }, readyMs: Math.round(performance.now() - t0), walls: V.WALLS.length, heap0: performance.memory.usedJSHeapSize / 1048576, gpu0: V.stats.gpuBytes / 1048576 };
const ov = V.overview(); V.cam.p = ov.p; V.setLook(ov.dir);
let heapMax = 0, gpuMax = 0; const dts = [];
const N = 400, x0 = V.xMin, x1 = V.xMax, tS = performance.now();
for (let i = 0; i <= N; i++) {
  V.setX(x0 + (x1 - x0) * i / N);
  const f0 = V.stats.frames; await new Promise(res => { const c = () => V.stats.frames > f0 ? res() : setTimeout(c, 2); c(); });
  dts.push(V.lastRawDt || 0);
  heapMax = Math.max(heapMax, performance.memory.usedJSHeapSize / 1048576); gpuMax = Math.max(gpuMax, V.stats.gpuBytes / 1048576);
}
dts.sort((a, b) => a - b);
Object.assign(r, { sweepMs: Math.round(performance.now() - tS), sweepP50: dts[N >> 1], sweepP95: dts[Math.floor(N * 0.95)], heapMax, gpuMax, heapEnd: performance.memory.usedJSHeapSize / 1048576, visible: V.stats.visibleWalls });
return r;

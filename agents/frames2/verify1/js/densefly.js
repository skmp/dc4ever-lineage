// fly through the densest stretch (2026-06 .. end) over the fpgadc lanes and the emulator lanes, then hold an overview;
// frame interval (rAF, vsync-capped in eval mode), GPU ms (timer query), heap
V.attract.stop(); V.setPlaying(false); V.presMode = 'clock';
const x0 = V.tm.xOfDate('2026-06-01'), x1 = V.xMax, zMax = V.LN.at(-1).z0 + V.LN.at(-1).L.width;
const st = a => { a = a.slice().sort((p, q) => p - q); return { n: a.length, p50: +a[a.length >> 1].toFixed(2), p95: +a[Math.floor(a.length * 0.95)].toFixed(2), p99: +a[Math.floor(a.length * 0.99)].toFixed(2), max: +a.at(-1).toFixed(2) }; };
async function run(dur, step) {
  const dts = [], gpu0 = V.stats.gpu.length; let heap = 0; const t0 = performance.now(); let last = t0;
  while (performance.now() - t0 < dur * 1000) { step((performance.now() - t0) / (dur * 1000));
    await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); dts.push(n - last); last = n; heap = Math.max(heap, performance.memory.usedJSHeapSize / 1048576); }
  return { frame: st(dts.slice(2)), gpu: V.stats.gpu.length > gpu0 + 5 ? st(V.stats.gpu.slice(gpu0)) : null, heapMax: +heap.toFixed(0), walls: V.load.walls, inst: V.stats.inst };
}
const r = {};
V.setX(x1 + V.U, { follow: false });
r.fly = await run(20, t => { const x = x0 + (x1 - x0) * t; V.cam.p = [x - 15000, 6000, zMax * 0.55]; V.setLook([0.85, -0.12, 0.5]); });
r.flyLow = await run(15, t => { const x = x0 + (x1 - x0) * t; const L = V.LN.find(l => l.name === 'polly2'); V.cam.p = [x - 4000, 2500, L.z0 - 1500]; V.setLook([1, -0.05, 0.12]); });
const ov = V.overview();
r.overview = await run(8, t => { V.cam.p = ov.p; V.setLook(ov.dir); });
r.heapEnd = performance.memory.usedJSHeapSize / 1048576; r.gpuMB = V.stats.gpuBytes / 1048576; r.walls = V.WALLS.length;
return r;

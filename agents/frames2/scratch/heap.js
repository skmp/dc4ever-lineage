const r0 = await (await fetch('agents/frames2/scratch/loadmem.js').catch(() => null));
const ov = V.overview(); V.cam.p = ov.p; V.setLook(ov.dir);
const N = 400, x0 = V.xMin, x1 = V.xMax;
for (let i = 0; i <= N; i++) { V.setX(x0 + (x1 - x0) * i / N); const f0 = V.stats.frames; await new Promise(res => { const c = () => V.stats.frames > f0 ? res() : setTimeout(c, 2); c(); }); }
const h1 = performance.memory.usedJSHeapSize / 1048576;
await new Promise(r => setTimeout(r, 15000));
let inst = 0, loaded = 0, metaN = 0; for (const w of V.WALLS) { if (w.inst) { inst += w.inst.byteLength; loaded++; } if (w.meta) metaN++; }
return { h1, h2: performance.memory.usedJSHeapSize / 1048576, total: performance.memory.totalJSHeapSize / 1048576, instMB: inst / 1048576, loaded, metaN };

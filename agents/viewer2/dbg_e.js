const lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
let msgs = 0; const s0 = V.stats.skipped, f0 = V.stats.frames;
V.presMode = 'now'; const x0 = V.W[V.LN[1].frames[0]].x, x1 = V.xMax; const t0 = performance.now();
let raf = 0; const rr = () => { raf++; if (performance.now() - t0 < 8000) requestAnimationFrame(rr); }; requestAnimationFrame(rr);
await new Promise(res => { const tick = () => { const t = (performance.now() - t0) / 8000; V.setX(x0 + (x1 - x0) * Math.min(1, t), { follow: false }); V.cam.p = [V.X - 26000, 11000, 30000]; V.setLook([26000, -9200, 40000]); if (t >= 1) { V.off('tick', tick); res(); } }; V.on('tick', tick); });
return { frames: V.stats.frames - f0, skipped: V.stats.skipped - s0, rafs: raf, longtasks: lt.length, ltSum: lt.reduce((a, b) => a + b, 0), lt: lt.slice(0, 30), walls: V.load.walls, worst: V.prof.worst.slice(0, 4) };

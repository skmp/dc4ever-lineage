V.dbgBake=[1200000,100000];
// low fly over polly2 through the dense stretch (as verify2/js/densefly.js flyLow) at a FIXED camera speed (units/s),
// plus the viewer's worst-frame profile (V.prof.worst) and the streaming / bake counters
await V.whenReady({ timeout: 120000 });
V.attract.stop(); V.setPlaying(false); V.presMode = 'clock';
const SPEED = +(globalThis.FLYSPEED || 0);
const x0 = V.tm.xOfDate('2026-06-01'), x1 = V.xMax;
const st = a => { a = a.slice().sort((p, q) => p - q); return { n: a.length, p50: +a[a.length >> 1].toFixed(2), p95: +a[Math.floor(a.length * 0.95)].toFixed(2), p99: +a[Math.floor(a.length * 0.99)].toFixed(2), max: +a.at(-1).toFixed(2) }; };
V.setX(x1 + V.U, { follow: false });
const L = V.LN.find(l => l.name === 'polly2');
const dur = 15, speed = SPEED || (x1 - x0) / dur;
V.prof.worst.length = 0;
const dts = [], cpus = []; const b0 = V.stats.baked || 0, w0 = V.load.walls; let heap = 0, uploads = 0;
const onW = () => uploads++; V.on('wall', onW); const AL = { r: 0, n: 0, mb: 0, lines: 0, bigF: [] };
const onF = (e) => { for (const a of V.bakeLog.alloc) { const [t, m] = a.split(':'); AL[t] = (AL[t] || 0) + 1; if (m === 'r') AL.r++; else { AL.n++; AL.mb += +m; } } AL.lines += V.bakeLog.lines; AL.bor = Math.max(AL.bor || 0, V.stats.borrowed || 0); AL.borSum = (AL.borSum || 0) + (V.stats.borrowed || 0); if (e.rawDt > 40) AL.bigF.push([Math.round(e.rawDt), Math.round(e.cpu), V.bakeLog.alloc.join(','), V.bakeLog.lines, V.stats.inst, V.stats.draws]); }; V.on('frame', onF);
const t0 = performance.now(); let last = t0;
while (performance.now() - t0 < dur * 1000) { const t = (performance.now() - t0) / 1000; const x = Math.min(x1, x0 + speed * t);
  V.cam.p = [x - 4000, 2500, L.z0 - 1500]; V.setLook([1, -0.05, 0.12]);
  await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); dts.push(n - last); last = n; cpus.push(V.stats.cpu.at(-1) || 0);
  heap = Math.max(heap, performance.memory.usedJSHeapSize / 1048576); }
V.off('wall', onW); V.off('frame', onF);
return { speed: Math.round(speed), x0, x1, wallsInRange: V.WALLS.filter(w => w.x >= x0 && w.x <= x0 + speed * dur).length,
  frame: st(dts.slice(2)), cpu: st(cpus.slice(2)), heapMax: Math.round(heap), baked: (V.stats.baked || 0) - b0, uploads, up: V.stats.up, upT: V.stats.upT, borrowed: V.stats.borrowed, AL, gpuMB: Math.round(V.stats.gpuBytes/1048576), worst: V.prof.worst.slice(0, 8) };

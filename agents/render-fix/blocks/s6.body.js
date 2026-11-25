// Gallery, a long WASD-like session over five lanes (bench path C shape, 40 s): which walls had an impostor at some point
// and lost it again (impostor LRU cap / pool eviction); then the s1e view again
V.attract && V.attract.stop();
V.presMode = 'gallery'; V.setX(V.xMax + V.U); V.emit('time');
const had = new Set(), lost = new Set(); let maxImp = { lo: 0, hi: 0 };
const track = () => { const cnt = { lo: 0, hi: 0 }, by = { lo: 0, hi: 0 };
  for (const w of V.WALLS) { if (w.imp && w.imp.ready) { had.add(w.i); cnt[w.imp.tier]++; by[w.imp.tier] += w.imp.bytes; } else if (had.has(w.i)) lost.add(w.i); }
  maxImp = { lo: Math.max(maxImp.lo, by.lo / 1048576 | 0), hi: Math.max(maxImp.hi, by.hi / 1048576 | 0), nlo: cnt.lo, nhi: cnt.hi }; };
const lanes = ['nullDC', 'reicast', 'flycast', 'nulldc3', 'nullDC4Wii'].map(n => V.LN.find(l => l.name === n));
const t0 = performance.now(), dur = 40;
const step = () => { const t = Math.min(1, (performance.now() - t0) / 1000 / dur), x = t * lanes.length, i = Math.min(lanes.length - 1, Math.floor(x)), f = x - i, L = lanes[i];
  V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); track(); };
V.on('tick', step); await sleep(dur * 1000 + 100); V.off('tick', step);
const ln = V.LN.find(l => l.name === 'flycast'); const xm = ln.xs[60];
V.cam.p = [xm - 50000, 20000, ln.z0 - 30000]; V.setLook([0.8, -0.25, 0.5]); await sleep(4000); await snap('s6-flycast-oblique-after-session');
const flyc = V.WALLS.filter(w => w.fr.lane === 'flycast');
return { shots: SHOTS, log: LOG, had: had.size, lostLater: lost.size, lostNowNoImp: [...lost].filter(i => !(V.W[i].imp && V.W[i].imp.ready)).length, maxImpMB: maxImp,
  loadedNow: V.load.walls, flycastWithImp: flyc.filter(w => w.imp && w.imp.ready).length, flycastTotal: flyc.length };

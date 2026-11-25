// pool filled by a gallery session, then read a wall that was never loaded, at reading range (what the tour does)
V.attract && V.attract.stop();
V.presMode = 'gallery'; V.setX(V.xMax + V.U); V.emit('time');
const lanes = ['reicast', 'flycast', 'nulldc3'].map(n => V.LN.find(l => l.name === n));
const t0 = performance.now(), dur = 30;
const step = () => { const t = Math.min(1, (performance.now() - t0) / 1000 / dur), x = t * lanes.length, i = Math.min(lanes.length - 1, Math.floor(x)), f = x - i, L = lanes[i];
  V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); };
V.on('tick', step); await sleep(dur * 1000 + 100); V.off('tick', step);
const rows = () => V.WALLS.filter(w => w.loaded).reduce((a, w) => a + Math.max(1, Math.ceil(w.n / 4096)), 0);
const r0 = rows();
const w = V.W[V.LN.find(l => l.name === 'NotDC-PS3').frames.at(-1)];
V.presMode = 'clock'; V.setX(w.x + 1, { follow: false }); V.emit('time');
const v = V.fitWall(w); V.cam.p = v.p; V.setLook(v.dir); await sleep(5000); await snap('s8a-notdcps3-fit-5s', { target: { f: w.i, loaded: w.loaded, imp: w.imp && w.imp.tier } });
const r = await V.ensureWall(w.i, 6000);
const k = w.meta.paths.findIndex(p => /\.(cpp|c)$/.test(p)), s = w.meta.slot[k];
const v2 = V.slotView(w, s, 30, 16); V.cam.p = v2.p; V.setLook(v2.dir); await sleep(3000); await snap('s8b-notdcps3-read-3s', { target: { f: w.i, loaded: w.loaded, imp: w.imp && w.imp.tier, ensure: !!r } });
return { shots: SHOTS, log: LOG, poolRowsAfterSession: r0, poolRowsEnd: rows() };

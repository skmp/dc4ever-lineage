// Now mode: latency from a lane's frame becoming the live wall to its lines being on the GPU (and baked), per lane
V.attract && V.attract.stop();
const ln = V.LN.find(l => l.name === 'flycast');
V.presMode = 'clock'; V.setX(ln.xs[40]); V.emit('time');
const place = () => { V.cam.p = [V.X - 14000, 6000, ln.z0 - 6000]; V.setLook([0.75, -0.2, 0.62]); };
place(); await sleep(3000);
const ev = []; const seen = new Map(); let t0 = performance.now();
const onWall = w => ev.push({ t: Math.round(performance.now() - t0), f: w.i, lane: w.fr.lane, ev: 'loaded' });
V.on('wall', onWall);
const watch = () => { for (const l of V.live) { const name = V.LN[l.lane].name; if (seen.get(name) !== l.f) { seen.set(name, l.f); const w = V.W[l.f];
  ev.push({ t: Math.round(performance.now() - t0), f: l.f, lane: name, ev: 'live', loaded: w.loaded, imp: !!(w.imp && w.imp.ready), n: w.n }); } }
  for (const l of V.live) { const w = V.W[l.f]; if (w.loaded && w.imp && w.imp.ready && !w._bk) { w._bk = 1; ev.push({ t: Math.round(performance.now() - t0), f: l.f, lane: V.LN[l.lane].name, ev: 'imp' }); } } };
V.setPlaying(true); t0 = performance.now(); V.on('tick', place); V.on('tick', watch);
await sleep(12000);
V.off('tick', place); V.off('tick', watch); V.off('wall', onWall); V.setPlaying(false);
// per live flycast / reicast frame: ms live, ms until loaded
const out = []; const lanes = ['flycast', 'reicast', 'nullDC4Wii', 'NotDC-PS3', 'nulldc3'];
for (const e of ev.filter(e => e.ev === 'live' && lanes.includes(e.lane))) {
  const nxt = ev.find(x => x.ev === 'live' && x.lane === e.lane && x.t > e.t), ld = ev.find(x => x.ev === 'loaded' && x.f === e.f && x.t >= e.t - 5000);
  out.push({ lane: e.lane, f: e.f, n: e.n, liveAt: e.t, liveMs: nxt ? nxt.t - e.t : null, loadedWhenLive: e.loaded, impWhenLive: e.imp, loadedAfterMs: e.loaded ? 0 : ld ? ld.t - e.t : null });
}
return { log: [], rows: out, q: V.quality.step };

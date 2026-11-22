// approach test: fly straight at a wall (clock mode, its lane's frame at the clock) at 5000 units/s from 60000 away and
// record the distance at which its lines arrive on the GPU, its sharp impostor is baked, its lines are drawn
const wait = ms => new Promise(r => setTimeout(r, ms));
V.attract && V.attract.stop(); V.fixedQuality = true; V.setQualityStep(0); V.flight = null; V.setPlaying(false);
const ln = V.LN.find(l => l.name === 'reicast'), w0 = V.W[ln.frames[Math.floor(ln.frames.length / 2)]];
V.presMode = 'clock'; V.setX(w0.x + 1, { follow: false }); await wait(200);
const w = V.W[V.laneFrameAt(ln.li)];
const zc = w.z0 + w.cols * 64, y = 2048, speed = 5000;
V.cam.p = [w.x - 60000, y, zc]; V.setLook([1, 0, 0]);
await wait(2500);
const ev = {}, t0 = performance.now();
await new Promise(res => {
  const tick = () => {
    const d = w.x - V.cam.p[0];
    if (!ev.loaded && w.loaded) ev.loaded = Math.round(d);
    if (!ev.hiImp && w.imp && w.imp.ready && w.imp.tier === 'hi') ev.hiImp = Math.round(d);
    if (!ev.anyImp && w.imp && w.imp.ready) ev.anyImp = Math.round(d);
    if (!ev.lines && V.stats.inst > 0) ev.lines = Math.round(d);
    if (d <= 600) { V.off('tick', tick); return res(); }
    V.cam.p = [w.x - Math.max(600, 60000 - speed * (performance.now() - t0) / 1000), y, zc];
  };
  V.on('tick', tick);
});
return { pres: V.pres(), soft: V.SOFT, loadedEnd: w.loaded, isSolid: V.isSolid(w), wallsLoaded: V.load.walls, step: V.quality.step, wall: w.i, lane: ln.name, cols: w.cols, lines: w.n, focalPx: V.focalPx(), distances: ev };

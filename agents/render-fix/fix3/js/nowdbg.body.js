const ln = LNn('flycast'); V.presMode = 'clock'; V.setX(ln.xs[40] + 1, { follow: false });
{ const w = V.W[ln.frames[40]], v = V.wallView(w, 20, 600, V.readDist(11)); V.cam.p = v.p; V.setLook(v.dir); }
await ready(800); const smp = []; let n = 0;
const mt = () => { n++; const L = V.live.find(l => l.lane === ln.li); if (!L || n % 5) return; const w = V.W[L.f];
  smp.push({ t: n, f: L.f, k: ln.frames.indexOf(L.f), A: +V.wallA(w).toFixed(2), S: V.isSolid(w), dx: Math.round(L.x - V.cam.p[0]), morph: !!L.morph, pres: V.pres(), dispX: Math.round(V.dispX(w) - V.cam.p[0]) }); };
V.presMode = 'now'; V.setPlaying(true); V.on('tick', mt); await sleep(2500); await snap('now-2.5s'); V.off('tick', mt); V.setPlaying(false);
return { shots: SHOTS, log: LOG, smp };

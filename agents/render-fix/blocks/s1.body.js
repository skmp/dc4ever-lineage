V.attract && V.attract.stop();
await sleep(1500); await snap('s1a-start-clock');
const ov = V.overview(); V.cam.p = ov.p; V.setLook(ov.dir); await sleep(3000); await snap('s1b-overview-clock-3s');
V.presMode = 'gallery'; V.emit('time'); await sleep(3000); await snap('s1c-overview-gallery-3s');
await sleep(8000); await snap('s1d-overview-gallery-11s');
// mid range: the flycast lane, oblique, about 60k units away
const ln = V.LN.find(l => l.name === 'flycast'); const xm = ln.xs[60];
V.cam.p = [xm - 50000, 20000, ln.z0 - 30000]; V.setLook([0.8, -0.25, 0.5]); await sleep(4000); await snap('s1e-flycast-oblique-gallery-4s');
await sleep(8000); await snap('s1f-flycast-oblique-gallery-12s');
V.presMode = 'clock'; V.setX(xm + 1); V.emit('time'); await sleep(4000); await snap('s1g-flycast-oblique-clock-4s');
return { shots: SHOTS, log: LOG };

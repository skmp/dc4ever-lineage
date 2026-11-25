V.attract && V.attract.stop();
const ln = V.LN.find(l => l.name === 'flycast');
V.presMode = 'gallery'; V.setX(V.xMax + V.U); V.emit('time');
// WASD-like flight along the flycast lane (Shift: 4 x 2000 u/s), looking slightly down the street
let x = ln.xs[30] - 6000; const z = ln.z0 + ln.L.width / 2 - 1500;
V.cam.p = [x, 3000, z]; V.setLook([1, -0.06, 0.02]); await sleep(3000); await snap('s2a-gallery-street-start');
const t0 = performance.now(); let k = 0;
const tick = () => { const t = (performance.now() - t0) / 1000; V.cam.p = [x + 8000 * t, 3000, z]; V.setLook([1, -0.06, 0.02]); };
V.on('tick', tick);
for (const s of [1.5, 3, 5, 8, 12]) { while ((performance.now() - t0) / 1000 < s) await sleep(20); await snap('s2b-gallery-fly-' + s + 's'); }
V.off('tick', tick);
await sleep(3000); await snap('s2c-gallery-stopped-3s');
// same in clock mode at the camera's time
V.presMode = 'clock'; V.setX(V.cam.p[0] + 20000); V.emit('time'); await sleep(2000); await snap('s2d-clock-2s');
// G overview then back: the walls that were sharp
return { shots: SHOTS, log: LOG };

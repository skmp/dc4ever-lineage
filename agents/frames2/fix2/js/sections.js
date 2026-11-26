// mean CPU ms per frame section (V.prof.cur) over a 10 s low fly at 5000 units/s
await V.whenReady({ timeout: 120000 }); V.attract.stop(); V.setPlaying(false); V.presMode = 'clock'; V.setX(V.xMax + V.U, { follow: false });
const L = V.LN.find(l => l.name === 'polly2'), x0 = V.tm.xOfDate('2026-06-01'), S = {}; let n = 0;
const onF = () => { for (const [k, v] of V.prof.cur) S[k] = (S[k] || 0) + v; n++; }; V.on('frame', onF);
const t0 = performance.now();
while (performance.now() - t0 < 10000) { const x = x0 + 5 * (performance.now() - t0); V.cam.p = [x - 4000, 2500, L.z0 - 1500]; V.setLook([1, -0.05, 0.12]); await new Promise(r => requestAnimationFrame(r)); }
V.off('frame', onF); for (const k in S) S[k] = +(S[k] / n).toFixed(3); return { n, S };

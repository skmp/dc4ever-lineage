V.fixedQuality = true; V.attract && V.attract.stop(); V.presMode = 'clock'; V.setX(V.xMax + V.U, { follow: false });
const ln = V.LN.find(l => l.name === 'flycast'), xm = ln.xs[60];
V.cam.p = [xm - 50000, 20000, ln.z0 - 30000]; V.setLook([0.8, -0.25, 0.5]);
await V.whenReady({ timeout: 60000 }); await new Promise(r => setTimeout(r, 1500));
const D = V.declutter;
return { occ: D.DLS.filter((l, i) => D.occ[i]).map(l => l.s.slice(0, 50)), cand: D.candidates };

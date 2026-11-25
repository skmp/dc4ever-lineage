// issue 3: all frames: lane street, oblique, high, read view of a non-clock frame, Clock (+ Gallery before)
const W = V.W;
for (const pres of V.wallA ? ['clock'] : ['clock', 'gallery']) {
  V.presMode = pres;
  { const L = LNn('reicast'), X = W[L.frames[40]].x + 1; V.setX(X, { follow: false }); V.cam.p = [X - 6000, 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); await ready(); await snap('a-lane-' + pres); }
  { const X = W[LNn('reicast').frames[40]].x + 1; V.setX(X, { follow: false }); lookAt([X - 30000, 9000, 40000], [X, 1500, 75000]); await ready(); await snap('a-obl-' + pres); }
  { const X = W[LNn('reicast').frames[40]].x + 1; V.setX(X, { follow: false }); lookAt([X - 90000, 60000, 10000], [X + 20000, 0, 70000]); await ready(); await snap('a-high-' + pres); }
  { const L = LNn('flycast'), w = W[L.frames[30]]; V.setX(W[L.frames[50]].x + 1, { follow: false });   // a frame that is not at the clock, read at 11 px per line
    const k = w.meta.paths.findIndex(p => /\.(cpp|c)$/.test(p)), s = w.meta.slot[k]; const v = V.slotView(w, s, 20, 11); V.cam.p = v.p; V.setLook(v.dir); await ready(); await snap('a-read-nonclock-' + pres); }
  { V.setX(V.xMax + V.U, { follow: false }); const v = V.overview(); V.cam.p = v.p; V.setLook(v.dir); await ready(); await snap('a-far-' + pres); }
}
{ V.presMode = 'now'; V.setX(W[LNn('reicast').frames[40]].x + 0.3 * V.U, { follow: false }); lookAt([V.X - 30000, 9000, 40000], [V.X, 1500, 75000]); await ready(); await snap('a-now'); V.presMode = 'clock'; }
return { shots: SHOTS, log: LOG };

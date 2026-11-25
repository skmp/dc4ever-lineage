// verify2: the plate step at alpha 0.5: head-on view of a non-focus flycast wall, held at distances around the 0.5 point
V.presMode = 'clock';
const L = LNn('flycast'), tgt = V.W[L.frames[30]], foc = V.W[L.frames[50]]; V.setX(foc.x + 1, { follow: false });
const zc = tgt.z0 + tgt.cols * 64; const r = [];
for (const d of [4700, 4500, 4420, 4380, 4300, 4100]) { V.cam.p = [tgt.x - d, 2048, zc]; V.setLook([1, 0, 0]); await ready(1200);
  await snap('step-' + d, { A: V.wallA(tgt), solid: V.isSolid(tgt) }); r.push({ d, A: +V.wallA(tgt).toFixed(3), solid: V.isSolid(tgt) }); }
// a moving camera crossing the 0.5 point: two consecutive frames
V.cam.p = [tgt.x - 5000, 2048, zc]; V.setLook([1, 0, 0]); await ready(1200);
let pair = null; const t0 = performance.now();
while (performance.now() - t0 < 4000) { V.cam.p = [V.cam.p[0] + 6, 2048, zc]; const A0 = V.wallA(tgt), S0 = V.isSolid(tgt);
  await new Promise(r => requestAnimationFrame(r));
  if (S0 && !V.isSolid(tgt)) { pair = { A0, A1: V.wallA(tgt), d: Math.round(tgt.x - V.cam.p[0]) }; break; } }
return { shots: SHOTS, log: LOG, r, pair };

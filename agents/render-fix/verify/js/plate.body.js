// verify (3b): the plate at the start of the near fade: the same head-on view of a non-focus flycast wall at 6100 and 5900 units
V.presMode = 'clock';
const L = LNn('flycast'), tgt = V.W[L.frames[30]], foc = V.W[L.frames[50]]; V.setX(foc.x + 1, { follow: false });
const zc = tgt.z0 + tgt.cols * 64; const r = [];
for (const d of [6100, 5900]) { V.cam.p = [tgt.x - d, 2048, zc]; V.setLook([1, 0, 0]); await ready(1500);
  const front = V.WALLS.filter(q => q.lane === tgt.lane && V.dispX(q) > V.cam.p[0] && V.dispX(q) <= tgt.x).map(q => [Math.round(V.dispX(q) - V.cam.p[0]), +V.wallA(q).toFixed(3), V.isSolid(q)]);
  await snap('plate-' + d, { A: V.wallA(tgt), solid: V.isSolid(tgt), front }); r.push({ d, A: V.wallA(tgt), solid: V.isSolid(tgt), front }); }
return { shots: SHOTS, log: LOG, r };

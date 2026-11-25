// verify2: the frame at the clock and the wall being read, from a set of own cameras: every lane's clock frame read head-on
// at 11 / 2.2 / 1.0 / 0.5 px per line (fitWall-like); and a non-focus wall read at 11 / 4 / 2.2 / 1.8 with a clock frame 1-3
// frames behind it; and a clock frame viewed from just behind an earlier frame (passing through)
V.presMode = 'clock';
const out = [];
for (const n of ['nullDC', 'reicast', 'NotDC-PS3', 'nullDC4Wii', 'flycast', 'nulldc3']) {
  const ln = LNn(n); if (!ln) continue; const k = Math.floor(ln.frames.length * 0.6), foc = V.W[ln.frames[k]]; V.setX(foc.x + 1, { follow: false });
  for (const px of [11, 2.2, 1.0, 0.5]) { const s = foc.meta.slot[Math.max(0, foc.meta.paths.findIndex(p => /\.(cpp|c|h)$/.test(p)))]; const v = V.slotView(foc, s, 20, px);
    V.cam.p = v.p; V.setLook(v.dir); await ready(700); const r = { lane: n, kind: 'focus', px, A: +V.wallA(foc).toFixed(2), S: V.isSolid(foc) };
    if (r.A < 0.99 || !r.S) await snap('focus-' + n + '-' + px, r); out.push(r); }
  // non-focus wall 2 frames before the clock frame, read
  const nf = V.W[ln.frames[k - 2]];
  for (const px of [11, 4, 2.2, 1.8]) { const s = nf.meta.slot[Math.max(0, nf.meta.paths.findIndex(p => /\.(cpp|c|h)$/.test(p)))]; const v = V.slotView(nf, s, 20, px);
    V.cam.p = v.p; V.setLook(v.dir); await ready(700); const r = { lane: n, kind: 'read-nonfocus', px, A: +V.wallA(nf).toFixed(2), S: V.isSolid(nf), readWall: V.readWall === nf.i, dist: Math.round(V.dispX(nf) - V.cam.p[0]), focusDx: Math.round(V.dispX(foc) - V.dispX(nf)) };
    if (r.A < 0.99 || !r.S) await snap('nonfocus-' + n + '-' + px, r); out.push(r); }
  // standing 200 units behind the frame before the clock frame (passed through it), looking at the clock frame
  const pv = V.W[ln.frames[k - 1]]; V.cam.p = [V.dispX(pv) + 30, 2048, foc.z0 + foc.cols * 64]; V.setLook([1, -0.05, 0.1]); await ready(700);
  { const r = { lane: n, kind: 'passed', A: +V.wallA(foc).toFixed(2), S: V.isSolid(foc), dist: Math.round(V.dispX(foc) - V.cam.p[0]) }; await snap('passed-' + n, r); out.push(r); }
}
return { shots: SHOTS, log: LOG, out, bad: out.filter(r => (r.kind !== 'read-nonfocus' || r.px >= 2.2) && (r.A < 0.99 || !r.S)) };

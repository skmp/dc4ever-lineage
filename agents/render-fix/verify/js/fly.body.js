// verify (3): fly straight down the flycast lane at a non-focus wall (clock on a later frame); per-tick alpha / solid of the
// target and of every wall in front within 9000; snapshots at set distances; then read checks at fixed px per line
V.presMode = 'clock';
const L = LNn('flycast'), tgt = V.W[L.frames[30]], foc = V.W[L.frames[50]];
V.setX(foc.x + 1, { follow: false });
const zc = tgt.z0 + tgt.cols * 64, fp = V.focalPx();
const at = d => { V.cam.p = [tgt.x - d, 2048, zc]; V.setLook([1, 0, 0]); };
at(9000); await ready(1500);
const TL = []; const D0 = 9000, D1 = 400, dur = 8; const t0 = performance.now();
const step = () => { const t = Math.min(1, (performance.now() - t0) / 1000 / dur), d = D0 + (D1 - D0) * t; at(d);
  const fr = []; for (const w of V.WALLS) { if (w.lane !== tgt.lane) continue; const x = V.dispX(w); if (x < V.cam.p[0] || x - V.cam.p[0] > 9000) continue; fr.push([w.i, Math.round(x - V.cam.p[0]), +V.wallA(w).toFixed(3), V.isSolid(w) ? 1 : 0]); }
  TL.push({ t: Math.round(performance.now() - t0), d: Math.round(d), A: +V.wallA(tgt).toFixed(3), S: V.isSolid(tgt) ? 1 : 0, ppl: +(2 * fp / d).toFixed(2), fr }); };
V.on('tick', step);
for (const d of [8000, 6500, 5000, 4000, 3200, 2600, 2000, 1500, 1100, 800, 500]) {
  const tt = (D0 - d) / (D0 - D1) * dur * 1000; while (performance.now() - t0 < tt) await sleep(10);
  await snap('fly-' + d, { tgtA: V.wallA(tgt), tgtSolid: V.isSolid(tgt) });
}
await sleep(300); V.off('tick', step);
// max per-tick alpha change of any wall, and plate (solid) flips while alpha near 1
let maxJump = 0, jumpAt = null, plateFlips = [];
const prev = new Map();
for (const e of TL) for (const [i, dx, A, S] of e.fr) { const p = prev.get(i); if (p) { const j = Math.abs(A - p[0]); if (j > maxJump) { maxJump = j; jumpAt = { i, d: e.d, dx, from: p[0], to: A }; }
  if (p[1] !== S) plateFlips.push({ i, dx, A, S, prevA: p[0] }); } prev.set(i, [A, S]); }
// read checks: the non-focus target at given px per line, held; and the focus wall up close
const reads = [];
for (const px of [11, 4, 2.2, 1.8, 1.4, 1.0]) { const k = tgt.meta.paths.findIndex(p => /\.(cpp|c)$/.test(p)), s = tgt.meta.slot[k]; const v = V.slotView(tgt, s, 20, px);
  V.cam.p = v.p; V.setLook(v.dir); await ready(800); await snap('read-nonfocus-' + px); reads.push({ px, A: V.wallA(tgt), solid: V.isSolid(tgt), dist: Math.round(tgt.x - V.cam.p[0]) }); }
for (const px of [11, 2.2, 1.0, 0.5]) { const k = foc.meta.paths.findIndex(p => /\.(cpp|c)$/.test(p)), s = foc.meta.slot[k]; const v = V.slotView(foc, s, 20, px);
  V.cam.p = v.p; V.setLook(v.dir); await ready(800); await snap('read-focus-' + px); reads.push({ focus: 1, px, A: V.wallA(foc), solid: V.isSolid(foc), dist: Math.round(foc.x - V.cam.p[0]) }); }
return { shots: SHOTS, log: LOG, maxJump, jumpAt, plateFlips: plateFlips.slice(0, 40), nFlips: plateFlips.length, reads, tl: TL.filter((e, i) => i % 6 === 0).map(e => [e.t, e.d, e.ppl, e.A, e.S]) };

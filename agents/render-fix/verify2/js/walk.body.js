// verify2: walk up to a non-focus flycast wall with the W key at the default speed (2000 u/s), release at given distances;
// per-tick alpha / solid of the target; snaps while walking and after stopping
V.presMode = 'clock';
const L = LNn('flycast'), tgt = V.W[L.frames[30]], foc = V.W[L.frames[50]];
V.setX(foc.x + 1, { follow: false });
const zc = tgt.z0 + tgt.cols * 64, fp = V.focalPx();
const res = [];
for (const [stopD, ctrl] of [[1800, 0], [1000, 0], [600, 0], [1000, 1]]) {
  V.cam.p = [tgt.x - 8000, 2048, zc]; V.setLook([1, 0, 0]); V.cam.speed = 2000; await ready(1500);
  const TL = []; const t0 = performance.now();
  const FR = [], prevA = new Map(); let mj = { j: 0 };
  const step = () => { const tt = Math.round(performance.now() - t0); TL.push([tt, Math.round(tgt.x - V.cam.p[0]), +V.wallA(tgt).toFixed(3), V.isSolid(tgt) ? 1 : 0, V.readWall === tgt.i ? 1 : 0, V.readWall]);
    for (const w of V.WALLS) { if (w.lane !== tgt.lane) continue; const dx = V.dispX(w) - V.cam.p[0]; if (dx < 0 || dx > 9000) continue; const A = V.wallA(w), p = prevA.get(w.i);
      if (p != null && Math.abs(A - p) > mj.j) mj = { j: +Math.abs(A - p).toFixed(3), i: w.i, t: tt, dx: Math.round(dx), from: +p.toFixed(3), to: +A.toFixed(3), readWall: V.readWall }; prevA.set(w.i, A); } };
  V.on('tick', step);
  if (ctrl) dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft' }));
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  let snapped = false;
  while (tgt.x - V.cam.p[0] > stopD) { await sleep(5); if (!snapped && tgt.x - V.cam.p[0] < 1600) { snapped = true; await snap('walk-moving-' + stopD + (ctrl ? 'c' : ''), { A: V.wallA(tgt) }); } }
  dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); if (ctrl) dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft' }));
  const tStop = performance.now() - t0; await sleep(80); await snap('walk-stop80ms-' + stopD + (ctrl ? 'c' : ''), { A: V.wallA(tgt) });
  await sleep(1500); await snap('walk-stopped-' + stopD + (ctrl ? 'c' : ''), { A: V.wallA(tgt) }); V.off('tick', step);
  // time after stop until A >= 0.99; min A while within 2800 and moving
  const after = TL.filter(e => e[0] >= tStop); const back = after.find(e => e[2] >= 0.99);
  const mov = TL.filter(e => e[0] < tStop && e[1] < 2800);
  res.push({ stopD, ctrl, maxJump: mj, stopAt: Math.round(tStop), backMs: back ? back[0] - Math.round(tStop) : null, finalD: TL[TL.length - 1][1], finalA: TL[TL.length - 1][2],
    movingBelow2800: { n: mov.length, maxA: Math.max(0, ...mov.map(e => e[2])), readTicks: mov.filter(e => e[4]).length }, tl: TL.filter((e, i) => i % 4 === 0) });
}
return { shots: SHOTS, log: LOG, res };

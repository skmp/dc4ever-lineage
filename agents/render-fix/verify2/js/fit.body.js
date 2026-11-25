// verify (3): the frame view (fitWall: boot view, lane buttons, the tour's glide stops) of the clock frame: is the frame at the
// clock visible (alpha, solid)? 6 frames per lane, clock on the frame; snapshot of the first few where it is not
V.presMode = 'clock';
const res = []; let nshot = 0;
for (const ln of V.LN) { const n = ln.frames.length, ks = [...new Set([0, 1, 2, 3, 4, 5].map(i => Math.round(i * (n - 1) / 5)))];
  for (const k of ks) { const w = V.W[ln.frames[k]]; V.setX(w.x + 1, { follow: false }); const v = V.fitWall(w); V.cam.p = v.p; V.setLook(v.dir);
    await sleep(450);
    const A = V.wallA(w), S = V.isSolid(w), cx = V.cam.p[0];
    const front = V.WALLS.filter(q => q.lane === w.lane && V.dispX(q) > cx && V.dispX(q) < w.x).map(q => ({ dx: Math.round(V.dispX(q) - cx), A: +V.wallA(q).toFixed(2), S: V.isSolid(q) }));
    const r = { lane: ln.name, k, date: w.fr.date, dist: Math.round(w.x - cx), A: +A.toFixed(2), S, front };
    const lf = V.live.find(l => l.lane === w.lane); r.live = !lf ? null : lf.f === w.i ? "self" : { A: +V.wallA(V.W[lf.f]).toFixed(2), S: V.isSolid(V.W[lf.f]), dx: Math.round(V.dispX(V.W[lf.f]) - cx) };
    res.push(r);
    if ((r.live === 'self' ? (A < 0.9 || !S) : !r.live || r.live.A < 0.9 || !r.live.S) && nshot < 4) { nshot++; await snap('fit-hidden-' + ln.name + '-' + k, r); }
  } }
const bad = res.filter(r => r.live === 'self' ? (r.A < 0.9 || !r.S) : !r.live || r.live.A < 0.9 || !r.live.S);
return { shots: SHOTS, log: LOG, n: res.length, nbad: bad.length, bad };

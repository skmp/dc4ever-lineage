// verify2: frames whose lane xs is out of order: the clock set to them (setX(w.x + 1), as search / bookmarks / tour / [ ] do)
// makes another frame the frame at the clock; is the requested wall visible in its frame view and when read at 11 px per line?
V.presMode = 'clock'; const res = []; let ns = 0;
for (const ln of V.LN) for (const f of ln.frames) { const w = V.W[f]; if (V.laneFrameAt(ln.li, w.x + 1) === f) continue;
  V.setX(w.x + 1, { follow: false }); const live = V.laneFrameAt(ln.li);
  const r = { lane: ln.name, title: w.shortTitle, clockFrame: V.W[live].shortTitle, dxClock: Math.round(V.W[live].x - w.x) };
  { const v = V.fitWall(w); V.cam.p = v.p; V.setLook(v.dir); await sleep(500); r.fitA = +V.wallA(w).toFixed(2); r.fitS = V.isSolid(w); }
  { const k = Math.max(0, w.meta.paths.findIndex(p => /\.(cpp|c|h)$/.test(p))); const v = V.slotView(w, w.meta.slot[k], 20, 11); V.cam.p = v.p; V.setLook(v.dir); await sleep(2000); r.camToClock = Math.round(V.W[live].x - V.cam.p[0]); r.readWall = V.readWall === f ? 'self' : V.readWall >= 0 ? V.W[V.readWall].shortTitle : -1;
    r.readA = +V.wallA(w).toFixed(2); r.readS = V.isSolid(w); if ((r.readA < 0.9) && r.camToClock < 0 && ns < 3) { ns++; await snap('unsorted-read-' + ln.name + '-' + f, r); } }
  res.push(r); }
return { shots: SHOTS, log: LOG, n: res.length, fitHidden: res.filter(r => r.fitA < 0.5).length, readHidden: res.filter(r => r.readA < 0.5).length, readHiddenClockBehindCam: res.filter(r => r.readA < 0.5 && r.camToClock < 0).length, res };

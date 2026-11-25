// issue 1: frames drawn as blocks. (a) the boot view, (b) a NotDC-PS3 wall fitted, (c) mid-glide into it (tour), (d) after a
// 25 s session over five lanes a mid-range oblique view of flycast, (e) Now playback following flycast: live walls drawn as T3
V.presMode = 'clock';
{ const w = V.WALLS.find(w => w.fr.lane === 'nullDC' && w.fr.date >= '2011-09'); V.setX(w.x + 1, { follow: false }); const v = V.fitWall(w); V.cam.p = v.p; V.setLook(v.dir);
  await ready(); await snap('b1-boot-view'); }
const ps3 = V.W[LNn('NotDC-PS3').frames.at(-1)];
{ V.setX(ps3.x + 1, { follow: false }); const v = V.fitWall(ps3); V.cam.p = v.p; V.setLook(v.dir); await ready(); await snap('b2-notdcps3-fit'); }
{ const ov = V.overview(); V.cam.p = ov.p; V.setLook(ov.dir); await ready(500);
  const k = ps3.meta.paths.findIndex(p => /\.(cpp|c)$/.test(p)), s = ps3.meta.slot[k]; const v = V.slotView(ps3, s, 30, 16);
  V.flyTo(v.p, v.dir, 2.5); await sleep(1700); await snap('b3-glide-1.7s'); await sleep(500); await snap('b3-glide-2.2s'); await sleep(2500); await snap('b3-glide-end'); }
{ // session
  V.presMode = V.wallA ? 'clock' : 'gallery'; V.setX(V.xMax + V.U, { follow: false });
  const lanes = ['nullDC', 'reicast', 'flycast', 'nulldc3', 'nullDC4Wii'].map(LNn), t0 = performance.now(), dur = 25;
  const step = () => { const t = Math.min(1, (performance.now() - t0) / 1000 / dur), x = t * lanes.length, i = Math.min(lanes.length - 1, Math.floor(x)), f = x - i, L = lanes[i];
    V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); };
  V.on('tick', step); await sleep(dur * 1000 + 100); V.off('tick', step);
  const ln = LNn('flycast'), xm = ln.xs[60];
  V.cam.p = [xm - 50000, 20000, ln.z0 - 30000]; V.setLook([0.8, -0.25, 0.5]); await sleep(4000); await snap('b4-flycast-oblique-after-session');
  await sleep(6000); await snap('b4-flycast-oblique-after-session-10s');
  V.presMode = 'clock'; V.setX(ln.xs[60] + 1, { follow: false }); await sleep(4000); await snap('b4-clock-same-camera');
}
{ // Now playback following flycast (as blocks/s4): how often a live wall in view is drawn as T3 (not loaded, no impostor)
  const ln = LNn('flycast'); V.presMode = 'clock'; V.setX(ln.xs[40], { follow: false });
  const place = () => { V.cam.p = [V.X - 14000, 6000, ln.z0 - 6000]; V.setLook([0.75, -0.2, 0.62]); };
  place(); await ready(1000);
  let ticks = 0, blank = 0; const changes = new Set(), blankF = new Set();
  const chk = () => { place(); const L = V.live.find(l => l.lane === ln.li); if (!L) return; ticks++; const w = V.W[L.f]; changes.add(L.f);
    if (!w.loaded && !(w.imp && w.imp.ready) && !(w.impLo && w.impLo.ready)) { blank++; blankF.add(L.f); } };
  V.setPlaying(true); V.on('tick', chk); await sleep(8000); await snap('b5-now-8s'); V.off('tick', chk); V.setPlaying(false);
  LOG.at(-1).extra = { ticks, t3Ticks: blank, liveFrames: changes.size, framesShownAsT3: blankF.size };
}
return { shots: SHOTS, log: LOG };

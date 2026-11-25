// verify (4): the tour for 30 s (sampled per tick: caption shown, marks on, the target lane's clock frame alpha while holding),
// a Now morph, a bookmark, search (worker + UI)
const errs = []; window.addEventListener('error', e => errs.push(String(e.message))); window.addEventListener('unhandledrejection', e => errs.push(String(e.reason)));
V.fixedQuality = false; V.attract.start('url');
const cap = document.getElementById('caption'); const S = { ticks: 0, capShown: 0, marks: 0, focusHidden: 0, focusTicks: 0, hiddenAt: [] };
const tick = () => { if (!V.attractOn) return; S.ticks++;
  const cs = getComputedStyle(cap); if (!cap.classList.contains('hidden') && +cs.opacity > 0.3) S.capShown++;
  // the lane the camera is in front of: the clock frame of the lane whose z range contains the camera; when the camera is within 6000 of it, is it visible?
  for (const L of V.live) { const w = V.W[L.f]; if (V.cam.p[2] < w.z0 || V.cam.p[2] > w.z0 + w.cols * 128) continue; const dx = L.x - V.cam.p[0]; if (dx < 0 || dx > 6000) continue;
    S.focusTicks++; if (V.wallA(w) < 0.5) { S.focusHidden++; if (S.hiddenAt.length < 20) S.hiddenAt.push([Math.round(performance.now()), w.shortTitle, Math.round(dx), +V.wallA(w).toFixed(2)]); } } };
V.on('tick', tick);
for (let s = 3; s <= 30; s += 3) { await sleep(3000); await snap('tour-' + s + 's', { attract: V.attractOn, cap: cap.classList.contains('hidden') ? '' : cap.textContent.slice(0, 120), capOp: getComputedStyle(cap).opacity }); }
V.off('tick', tick); V.attract.stop();
// Now morph: live flycast wall at reading range, play
const ln = LNn('flycast'); V.presMode = 'clock'; V.setX(ln.xs[40] + 1, { follow: false });
{ const w = V.W[ln.frames[40]], v = V.wallView(w, 20, 600, V.readDist(11)); V.cam.p = v.p; V.setLook(v.dir); }
await ready(800); let morphs = 0, liveHidden = 0, nt = 0; const mt = () => { if (V.morph) morphs++; nt++; const L = V.live.find(l => l.lane === ln.li); if (L && V.wallA(V.W[L.f]) < 0.99) liveHidden++; };
V.presMode = 'now'; V.setPlaying(true); V.on('tick', mt);
let morphShot = false; for (let i = 0; i < 60 && !morphShot; i++) { await sleep(100); if (V.morph) { await snap('now-morph'); morphShot = true; } }
await sleep(1500); V.off('tick', mt); V.setPlaying(false); V.presMode = 'clock';
// bookmark
const bm = await V.gotoBookmark('nullDC rec_v1 driver', { instant: true }); await ready(1200);
const bw = V.live.map(l => V.W[l.f]).find(w => V.cam.p[2] >= w.z0 && V.cam.p[2] <= w.z0 + w.cols * 128);
await snap('bookmark', { bmWall: bw && bw.shortTitle, bmA: bw && V.wallA(bw) });
// search: worker, then the UI box + click on the first result
const r = await V.search('Time to emulate', {});
document.getElementById('sq').value = 'Time to emulate'; document.getElementById('sq').dispatchEvent(new Event('input')); await sleep(2500);
const nres = document.querySelectorAll('#sres .res').length; const first = document.querySelector('#sres .res'); if (first) first.click(); await sleep(4000); await ready(1000);
const sw = V.live.map(l => V.W[l.f]).find(w => V.cam.p[2] >= w.z0 && V.cam.p[2] <= w.z0 + w.cols * 128);
await snap('search-click', { nres, sWall: sw && sw.shortTitle, sA: sw && V.wallA(sw) });
return { shots: SHOTS, log: LOG, S, now: { ticks: nt, morphTicks: morphs, liveHiddenTicks: liveHidden }, searchWorker: JSON.stringify(r).slice(0, 200), errs };

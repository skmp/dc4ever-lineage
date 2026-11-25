  const wait = ms => new Promise(r => setTimeout(r, ms));
  V.fixedQuality = true; V.setQualityStep(0); V.attract && V.attract.stop(); V.flight = null; V.setPlaying(false); V.soloFrame = null;
  document.getElementById('caption').classList.add('hidden');
  const LN = V.LN, W = V.W, L = LN.find(l => l.name === 'reicast');
  V.presMode = 'clock'; V.setX(W[L.frames[40]].x + 1, { follow: false });     // the clock stays at frame 40
  const w = W[L.frames[60]]; await V.ensureWall(w.i, 60000);                    // read frame 60 (not the clock frame)
  const k = w.meta.paths.findIndex(p => p.endsWith('.cpp')), s = w.meta.slot[k];
  const PX = 0.35; const v = V.slotView(w, s, 30, PX); V.cam.p = v.p; V.setLook(v.dir);
  await V.whenReady({ timeout: 60000 }); await wait(1500);
  const o = 4 * w.i; return { px: PX, wall: w.shortTitle, alpha: V.isSolid(w), draws: V.stats.draws, inst: V.stats.inst, cam: V.cam.p.map(Math.round), wx: w.x };

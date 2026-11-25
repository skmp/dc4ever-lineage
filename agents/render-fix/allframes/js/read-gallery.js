  const wait = ms => new Promise(r => setTimeout(r, ms));
  V.fixedQuality = true; V.setQualityStep(0); V.attract && V.attract.stop(); V.flight = null; V.setPlaying(false); V.soloFrame = null;
  document.getElementById('caption').classList.add('hidden');
  const LN = V.LN, W = V.W, ln = n => LN.find(l => l.name === n);
  const lookAt = (p, t) => { V.cam.p = p; V.setLook(t.map((v, i) => v - p[i])); };
  V.presMode = 'gallery';
  const L = ln("reicast"), w = W[L.frames[40]]; V.setX(w.x + 1, { follow: false }); const v = V.wallView(w, Math.floor(w.cols/2), 600, V.readDist(11)); V.cam.p = v.p; V.setLook([1, 0, 0.25]);
  await V.whenReady({ timeout: 60000 }); await wait(1500);
  const g = V.stats.gpu.slice(-60), s = V.stats;
  return { pres: V.pres(), X: V.X, cam: V.cam.p.map(Math.round), draws: s.draws, inst: s.inst, imp: s.imp, t3: s.t3, t4: s.t4, t5: s.t5, lineRuns: s.lineRuns, dispWalls: s.visibleWalls,
    gpuMB: Math.round(s.gpuBytes / 1048576), gpu_ms_mean: g.length ? +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(3) : null, gpu_ms_max: g.length ? +Math.max(...g).toFixed(3) : null,
    cpu_ms_mean: +(s.cpu.slice(-60).reduce((a, b) => a + b, 0) / Math.min(60, s.cpu.length)).toFixed(2), loaded: V.WALLS.filter(w => w.loaded).length, imps: V.WALLS.filter(w => w.imp).length };

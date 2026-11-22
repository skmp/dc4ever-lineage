const VIEW = 'street';
// fixed cameras for the LOD / title before-after shots (run.mjs eval --js; `V` is the viewer). VIEW is set by the wrapper.
const wait = ms => new Promise(r => setTimeout(r, ms));
V.attract && V.attract.stop(); V.fixedQuality = true; V.setQualityStep(0); V.quality.scale = 1; V.flight = null; V.setPlaying(false);
const ln = V.LN.find(l => l.name === 'flycast'), w = V.W[ln.frames.at(-1)];
const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
V.presMode = 'clock'; V.setX(w.x + 1, { follow: false });
const zc = w.z0 + w.cols * 64;
if (VIEW === 'far') { V.cam.p = [w.x - 26000, 6000, zc - 6000]; V.setLook(nrm([26000, -4000, 6000])); }
else if (VIEW === 'mid') { V.cam.p = [w.x - 6500, 3000, w.z0 + 2500]; V.setLook(nrm([6500, -900, 1200])); }
else if (VIEW === 'near') { V.cam.p = [w.x - 1100, 2600, w.z0 + 600]; V.setLook(nrm([1, -0.12, 1.25])); }
else if (VIEW === 'street') { const r = V.LN.find(l => l.name === 'reicast'); V.presMode = 'gallery'; V.setX(V.xMax + V.U, { follow: false });
  const x0 = r.xs[Math.floor(r.xs.length * 0.4)]; V.cam.p = [x0 - 9000, 5200, r.z0 - 2500]; V.setLook(nrm([1, -0.18, 0.55])); }
await wait(300);
await V.whenReady({ timeout: 90000 });
await wait(1500);
await V.whenReady({ timeout: 30000 });
await wait(800);
return { view: VIEW, cam: V.cam.p, stats: { draws: V.stats.draws, inst: V.stats.inst, imp: V.stats.imp, t3: V.stats.t3, t4: V.stats.t4, walls: V.load.walls }, titles: V.visibleTitles ? V.visibleTitles() : null };

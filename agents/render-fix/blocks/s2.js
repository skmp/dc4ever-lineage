// injected helpers (prepended to each eval script): classify visible walls, grab the canvas
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GH = 6 * V.U;
function proj(p) { const M = V.VP, x = p[0], y = p[1], z = p[2]; const w = M[3]*x + M[7]*y + M[11]*z + M[15]; if (w <= 1) return null;
  return [((M[0]*x + M[4]*y + M[8]*z + M[12]) / w + 1) / 2, (1 - (M[1]*x + M[5]*y + M[9]*z + M[13]) / w) / 2]; }
function screenFrac(x, w) { // rough: bbox of the projected corners, clipped to the screen
  const pts = []; for (const y of [0, 4096]) for (const z of [w.z0, w.z0 + w.cols * 128]) { const p = proj([x, y, z]); if (p) pts.push(p); }
  if (pts.length < 2) return 0; const cl = v => Math.max(0, Math.min(1, v));
  const xs = pts.map(p => cl(p[0])), ys = pts.map(p => cl(p[1])); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); }
function classify() {
  const pres = V.pres(), fp = V.focalPx(), LF = V.quality.lf, cp = V.cam.p, out = {}, list = [];
  for (const w of V.WALLS) {
    const x = V.dispX(w); let shown = false, solid = V.isSolid(w);
    if (pres === 'gallery' || solid) shown = solid;
    else { const lx = V.LN[w.lane]; if (Math.abs(w.x - V.X) <= GH) shown = true; }   // ghost
    if (!shown || cp[0] > x) continue;
    const fr = screenFrac(x, w); if (fr <= 0) continue;
    const dx = Math.max(0, x - cp[0]), dz = Math.max(0, w.z0 - cp[2], cp[2] - (w.z0 + w.cols * 128)), dy = Math.max(0, -cp[1], cp[1] - 4096);
    const d = Math.hypot(dx, dy, dz), ppl = 2 * fp / Math.max(1, d);
    let tier;
    if (solid && w.loaded && ppl >= LF[0]) tier = 'lines';
    else if (w.imp && w.imp.ready) tier = 'imp-' + w.imp.tier;
    else tier = ppl < V.LODP.t5 ? 'T5' : ppl < V.LODP.t4 ? 'T4' : 'T3';
    const k = (solid ? 'solid ' : 'ghost ') + tier;
    out[k] = out[k] || { n: 0, area: 0 }; out[k].n++; out[k].area = +(out[k].area + fr).toFixed(3);
    list.push({ f: w.i, lane: w.fr.lane, date: w.fr.date, solid, loaded: w.loaded, imp: w.imp ? w.imp.tier : null, tier, ppl: +ppl.toFixed(3), area: +fr.toFixed(3) });
  }
  list.sort((a, b) => b.area - a.area);
  return { pres, X: V.dateOfX ? V.X : 0, cam: cp.map(v => Math.round(v)), q: V.quality.step, walls: V.load.walls, stats: { t3: V.stats.t3, t4: V.stats.t4, t5: V.stats.t5, imp: V.stats.imp, inst: V.stats.inst, pendingBake: V.stats.pendingBake, wantQueue: V.stats.wantQueue, gpuMB: Math.round(V.stats.gpuBytes / 1048576) }, classes: out, top: list.slice(0, 12) };
}
const SHOTS = {}; const LOG = [];
async function snap(name, extra = {}) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = document.getElementById('gl'); SHOTS[name] = c.toDataURL('image/jpeg', 0.9); LOG.push({ name, t: Math.round(performance.now()), ...classify(), ...extra }); }
V.attract && V.attract.stop();
const ln = V.LN.find(l => l.name === 'flycast');
V.presMode = 'gallery'; V.setX(V.xMax + V.U); V.emit('time');
// WASD-like flight along the flycast lane (Shift: 4 x 2000 u/s), looking slightly down the street
let x = ln.xs[30] - 6000; const z = ln.z0 + ln.L.width / 2 - 1500;
V.cam.p = [x, 3000, z]; V.setLook([1, -0.06, 0.02]); await sleep(3000); await snap('s2a-gallery-street-start');
const t0 = performance.now(); let k = 0;
const tick = () => { const t = (performance.now() - t0) / 1000; V.cam.p = [x + 8000 * t, 3000, z]; V.setLook([1, -0.06, 0.02]); };
V.on('tick', tick);
for (const s of [1.5, 3, 5, 8, 12]) { while ((performance.now() - t0) / 1000 < s) await sleep(20); await snap('s2b-gallery-fly-' + s + 's'); }
V.off('tick', tick);
await sleep(3000); await snap('s2c-gallery-stopped-3s');
// same in clock mode at the camera's time
V.presMode = 'clock'; V.setX(V.cam.p[0] + 20000); V.emit('time'); await sleep(2000); await snap('s2d-clock-2s');
// G overview then back: the walls that were sharp
return { shots: SHOTS, log: LOG };

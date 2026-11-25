// injected helpers: classify visible walls (by the tier they are drawn in), grab the canvas, leak metric for titles
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GH = 6 * V.U;
V.fixedQuality = true; V.setQualityStep(0); V.attract && V.attract.stop(); V.flight = null; V.setPlaying(false); V.soloFrame = null;
document.getElementById('caption').classList.add('hidden');
const LNn = n => V.LN.find(l => l.name === n);
const lookAt = (p, t) => { V.cam.p = p; V.setLook(t.map((v, i) => v - p[i])); };
function proj(p) { const M = V.VP, x = p[0], y = p[1], z = p[2]; const w = M[3]*x + M[7]*y + M[11]*z + M[15]; if (w <= 1) return null;
  return [((M[0]*x + M[4]*y + M[8]*z + M[12]) / w + 1) / 2, (1 - (M[1]*x + M[5]*y + M[9]*z + M[13]) / w) / 2]; }
function screenFrac(x, w) { const pts = []; for (const y of [0, 4096]) for (const z of [w.z0, w.z0 + w.cols * 128]) { const p = proj([x, y, z]); if (p) pts.push(p); }
  if (pts.length < 2) return 0; const cl = v => Math.max(0, Math.min(1, v));
  const xs = pts.map(p => cl(p[0])), ys = pts.map(p => cl(p[1])); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); }
function classify() {
  const pres = V.pres(), fp = V.focalPx(), LF = V.quality.lf, cp = V.cam.p, out = {}, list = [];
  for (const w of V.WALLS) {
    const x = V.dispX(w); let shown, solid = V.isSolid(w), A = 1;
    if (V.wallA) { A = V.wallA(w); shown = A > 0; }
    else if (pres === 'gallery' || solid) shown = solid;
    else shown = Math.abs(w.x - V.X) <= GH;
    if (!shown || cp[0] > x) continue;
    const fr = screenFrac(x, w); if (fr <= 0) continue;
    const dx = Math.max(0, x - cp[0]), dz = Math.max(0, w.z0 - cp[2], cp[2] - (w.z0 + w.cols * 128)), dy = Math.max(0, -cp[1], cp[1] - 4096);
    const d = Math.hypot(dx, dy, dz), ppl = 2 * fp / Math.max(1, d);
    let tier;
    if ((solid || V.wallA) && w.loaded && ppl >= LF[0]) tier = 'lines';
    else if (w.imp && w.imp.ready) tier = 'imp-' + w.imp.tier;
    else if (w.impLo && w.impLo.ready) tier = 'imp-lo';
    else tier = ppl < V.LODP.t5 ? 'T5' : ppl < V.LODP.t4 ? 'T4' : 'T3';
    const k = (solid ? 'solid ' : 'faded ') + tier;
    out[k] = out[k] || { n: 0, area: 0 }; out[k].n++; out[k].area = +(out[k].area + fr * (V.wallA ? A : solid ? 1 : 0.3)).toFixed(3);
    list.push({ f: w.i, lane: w.fr.lane, date: w.fr.date, solid, A: +A.toFixed(2), loaded: w.loaded, tier, ppl: +ppl.toFixed(3), area: +fr.toFixed(3) });
  }
  list.sort((a, b) => b.area - a.area);
  const t3area = list.filter(l => l.tier === 'T3').reduce((a, l) => a + l.area * (l.solid ? 1 : V.wallA ? l.A : 0.3), 0);
  return { pres, cam: cp.map(v => Math.round(v)), q: V.quality.step, walls: V.load.walls, t3area: +t3area.toFixed(2), stats: { t3: V.stats.t3, t4: V.stats.t4, t5: V.stats.t5, imp: V.stats.imp, inst: V.stats.inst, draws: V.stats.draws, pendingBake: V.stats.pendingBake, wantQueue: V.stats.wantQueue, gpuMB: Math.round(V.stats.gpuBytes / 1048576) }, classes: out, top: list.slice(0, 8) };
}
// title leak metric (as agents/render-fix/leak/lib.js): title pixels whose ray meets a nearer solid wall before the title's wall plane
const inv = m => { const a = m, b = new Float64Array(16);
  const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = a;
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  const d = 1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
  b[0]=(a11*b11-a12*b10+a13*b09)*d;b[1]=(a02*b10-a01*b11-a03*b09)*d;b[2]=(a31*b05-a32*b04+a33*b03)*d;b[3]=(a22*b04-a21*b05-a23*b03)*d;
  b[4]=(a12*b08-a10*b11-a13*b07)*d;b[5]=(a00*b11-a02*b08+a03*b07)*d;b[6]=(a32*b02-a30*b05-a33*b01)*d;b[7]=(a20*b05-a22*b02+a23*b01)*d;
  b[8]=(a10*b10-a11*b08+a13*b06)*d;b[9]=(a01*b08-a00*b10-a03*b06)*d;b[10]=(a30*b04-a31*b02+a33*b00)*d;b[11]=(a21*b02-a20*b04-a23*b00)*d;
  b[12]=(a11*b07-a10*b09-a12*b06)*d;b[13]=(a00*b09-a01*b07+a02*b06)*d;b[14]=(a31*b01-a30*b03-a32*b00)*d;b[15]=(a20*b03-a21*b01+a22*b00)*d; return b; };
const ray = (Mi, px, py, cw, ch) => { const nx = px / cw * 2 - 1, ny = 1 - py / ch * 2;
  const un = (z) => { const x = Mi[0]*nx+Mi[4]*ny+Mi[8]*z+Mi[12], y = Mi[1]*nx+Mi[5]*ny+Mi[9]*z+Mi[13], zz = Mi[2]*nx+Mi[6]*ny+Mi[10]*z+Mi[14], w = Mi[3]*nx+Mi[7]*ny+Mi[11]*z+Mi[15]; return [x/w, y/w, zz/w]; };
  const a = un(-1), b = un(1); const d = b.map((v, i) => v - a[i]); const L = Math.hypot(...d); return d.map(v => v / L); };
const firstHit = (cam, d, walls) => { let best = [Infinity, null];   // any face (the back of a solid wall is an opaque plate too)
  for (const w of walls) { if (Math.abs(d[0]) < 1e-9) continue; const t = (w.x - cam[0]) / d[0]; if (t <= 0 || t >= best[0]) continue;
    const y = cam[1] + t * d[1], z = cam[2] + t * d[2]; if (y > -6 && y < 4102 && z > w.z0 && z < w.z0 + w.cols * 128) best = [t, w]; }
  return best; };
function leaks() {
  const cv = document.getElementById('gl'), cw = cv.width, ch = cv.height, cam = V.cam.p.slice(), Mi = inv(V.VP);
  const solid = V.WALLS.filter(w => V.isSolid(w)).map(w => ({ i: w.i, x: V.dispX(w), z0: w.z0, cols: w.cols, w }));
  const TT = V.titles, res = [];
  for (const w of V.WALLS) { const j = w.tj; if (TT.cur[j] <= 0.5) continue;
    const tx = TT.pos[4*j], ty = TT.pos[4*j+1], sz = TT.pos[4*j+2], bw = (TT.len[j] + 1.2) * sz * 0.5, bh = sz * 1.2, wx = V.dispX(w);
    let n = 0, leak = 0;
    for (let gx = 0; gx <= 8; gx++) for (let gy = 0; gy <= 2; gy++) {
      const px = tx + bw * gx / 8, py = ty + bh * (0.15 + 0.7 * gy / 2), d = ray(Mi, px, py, cw, ch); n++;
      const tw = Math.abs(d[0]) > 1e-9 ? (wx - cam[0]) / d[0] : Infinity;
      const [t, hw] = firstHit(cam, d, solid.filter(s => s.i !== w.i));
      if (hw && (tw <= 0 || t < tw)) leak++;
    }
    res.push({ title: w.shortTitle, leakFrac: +(leak / n).toFixed(2), sticky: ty <= 6.5 });
  }
  return { titles: res.length, leaking: res.filter(r => r.leakFrac > 0).length, worst: res.sort((a, b) => b.leakFrac - a.leakFrac).slice(0, 6) };
}
const SHOTS = {}; const LOG = [];
async function snap(name, extra = {}) { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = document.getElementById('gl'); SHOTS[name] = c.toDataURL('image/jpeg', 0.88);
  const s = V.stats, g = s.gpu.slice(-30);
  LOG.push({ name, t: Math.round(performance.now()), ...classify(), leaks: leaks(), gpu_ms: g.length ? +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(2) : null, cpu_ms: +(s.cpu.slice(-30).reduce((a, b) => a + b, 0) / 30).toFixed(2), labels: V.declutter.shown, titlesShown: V.titles.shown, ...extra }); }
const ready = async (ms = 1500) => { await V.whenReady({ timeout: 60000 }); await sleep(ms); };
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

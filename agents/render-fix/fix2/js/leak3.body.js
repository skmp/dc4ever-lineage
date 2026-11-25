// verify (2b): the leak metric with every wall drawn at alpha >= 0.5 as an occluder (faded walls draw no plate, but at
// 0.5-0.99 their text covers the view much as a solid wall's does); the leak.md scenes + my street views
function leaksA(thr) {
  const cv = document.getElementById('gl'), cw = cv.width, ch = cv.height, cam = V.cam.p.slice(), Mi = inv(V.VP);
  const occ = V.WALLS.filter(w => V.wallA(w) >= thr).map(w => ({ i: w.i, x: V.dispX(w), z0: w.z0, cols: w.cols, A: V.wallA(w), S: V.isSolid(w) }));
  const TT = V.titles, res = [];
  for (const w of V.WALLS) { const j = w.tj; if (TT.cur[j] <= 0.5) continue;
    const tx = TT.pos[4*j], ty = TT.pos[4*j+1], sz = TT.pos[4*j+2], bw = (TT.len[j] + 1.2) * sz * 0.5, bh = sz * 1.2, wx = V.dispX(w);
    let n = 0, leak = 0, by = null;
    for (let gx = 0; gx <= 8; gx++) for (let gy = 0; gy <= 2; gy++) {
      const px = tx + bw * gx / 8, py = ty + bh * (0.15 + 0.7 * gy / 2), d = ray(Mi, px, py, cw, ch); n++;
      const tw = Math.abs(d[0]) > 1e-9 ? (wx - cam[0]) / d[0] : Infinity;
      const [t, hw] = firstHit(cam, d, occ.filter(s => s.i !== w.i && Math.abs(s.x - wx) > 2));
      if (hw && (tw <= 0 || t < tw)) { leak++; by = by || { A: +hw.A.toFixed(2), solid: hw.S }; }
    }
    if (leak) res.push({ title: w.shortTitle, leakFrac: +(leak / n).toFixed(2), by });
  }
  return res.sort((a, b) => b.leakFrac - a.leakFrac);
}
V.presMode = 'clock'; const out = [];
const scenes = [];
{ const L = LNn('reicast'), f = L.frames[40], xf = V.W[f].x, z0 = L.z0, zc = z0 + L.L.width / 2;
  scenes.push(['leak-street-side', xf, [xf - 7000, 3000, z0 - 6000], [xf + 20000, 2200, z0 + 9000]], ['leak-street-low', xf, [xf - 9000, 1500, z0 - 2500], [xf + 30000, 3800, z0 + 10000]],
    ['leak-front-close', xf, [xf - 2600, 2600, zc - 2000], [xf + 10000, 4600, zc + 3000]], ['leak-across', xf, [xf - 14000, 5000, z0 + 3000], [xf + 30000, 1500, z0 + 40000]]); }
for (const [lane, k] of [['flycast', 60], ['nullDC4Wii', 120], ['NotDC-PS3', 10], ['nullDC', 20], ['nulldc3', 5]]) { const L = LNn(lane), kk = Math.min(k, L.frames.length - 1), xf = V.W[L.frames[kk]].x, z0 = L.z0, z1 = z0 + L.L.width;
  scenes.push(['s-' + lane + '-low', xf, [xf - 8000, 1200, z0 - 2000], [xf + 30000, 3500, z1 + 6000]], ['s-' + lane + '-other-side', xf, [xf - 12000, 6500, z1 + 3000], [xf + 25000, 1000, z0 - 4000]]); }
for (const [n, xf, p, t] of scenes) { V.setX(xf + 1, { follow: false }); lookAt(p, t); await ready(1200);
  const s = leaks(), a = leaksA(0.5); out.push({ n, titles: s.titles, leakSolid: s.leaking, leakA50: a.length, worst: a.slice(0, 4) }); }
return { shots: SHOTS, log: LOG, out };

// shared: place camera, wait, grab canvas, measure title leaks (title pixels whose ray hits a nearer solid wall first)
const wait = ms => new Promise(r => setTimeout(r, ms));
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
// first solid wall hit along a ray (front faces only: cam.x < wall x), returns [t, wall]
const firstHit = (cam, d, walls) => { let best = [Infinity, null];
  for (const w of walls) { if (Math.abs(d[0]) < 1e-9) continue; const t = (w.x - cam[0]) / d[0]; if (t <= 0 || t >= best[0]) continue;
    const y = cam[1] + t * d[1], z = cam[2] + t * d[2]; if (y > -6 && y < 4102 && z > w.z0 && z < w.z0 + w.cols * 128) best = [t, w]; }
  return best; };
async function shot(V, name, setup) {
  await setup(); await V.whenReady({ timeout: 90000 }); await wait(1200);   // titles fade in over ~0.1 s; let declutter settle
  const cv = document.querySelector('canvas'), cw = cv.width, ch = cv.height, cam = V.cam.p.slice(), Mi = inv(V.VP);
  const solid = V.WALLS.filter(w => V.isSolid(w)).map(w => ({ i: w.i, x: (V.live.find(l => l.f === w.i) || {}).x ?? w.x, z0: w.z0, cols: w.cols, w }));
  const TT = V.titles, res = [];
  for (const w of V.WALLS) { const j = w.tj; if (TT.cur[j] <= 0.5) continue;
    const tx = TT.pos[4*j], ty = TT.pos[4*j+1], sz = TT.pos[4*j+2], bw = (TT.len[j] + 1.2) * sz * 0.5, bh = sz * 1.2;
    const own = solid.find(s => s.i === w.i), wx = own ? own.x : w.x;
    let n = 0, leak = 0, by = new Map();
    for (let gx = 0; gx <= 8; gx++) for (let gy = 0; gy <= 2; gy++) {
      const px = tx + bw * gx / 8, py = ty + bh * (0.15 + 0.7 * gy / 2), d = ray(Mi, px, py, cw, ch); n++;
      const tw = Math.abs(d[0]) > 1e-9 ? (wx - cam[0]) / d[0] : Infinity;   // where this pixel's ray reaches the title's wall plane
      const [t, hw] = firstHit(cam, d, solid.filter(s => s.i !== w.i));
      if (hw && (tw <= 0 || t < tw)) { leak++; by.set(V.LN[hw.w.lane].name + '@' + hw.w.fr.date, (by.get(V.LN[hw.w.lane].name + '@' + hw.w.fr.date) || 0) + 1); }
    }
    res.push({ title: w.shortTitle, solid: V.isSolid(w), sticky: ty <= 6.5, rect: [tx|0, ty|0, (tx+bw)|0, (ty+bh)|0], size: +sz.toFixed(1), leakFrac: +(leak / n).toFixed(2), behind: [...by.keys()].slice(0, 3) });
  }
  const png = cv.toDataURL('image/png');
  return { name, pres: V.pres(), cam: cam.map(v => Math.round(v)), titles: res.sort((a, b) => b.leakFrac - a.leakFrac), labels: V.visibleLabels(), png };
}
const L = V.LN.find(l => l.name === 'reicast'), k = 40, f = L.frames[k], xf = V.W[f].x, z0 = L.z0, zc = z0 + L.L.width / 2;
const look = (p, t) => { V.cam.p = p; V.setLook(t.map((v, i) => v - p[i])); };
V.fixedQuality = true; V.setQualityStep(0); V.flight = null; V.attract && V.attract.stop(); V.setPlaying(false);
document.getElementById('caption').classList.add('hidden');
const out = [];
for (const pres of ['gallery', 'clock']) {
  out.push(await shot(V, 'street-side-' + pres, async () => { V.presMode = pres; V.setX(xf + 1, { follow: false }); look([xf - 7000, 3000, z0 - 6000], [xf + 20000, 2200, z0 + 9000]); }));
  out.push(await shot(V, 'street-low-' + pres, async () => { V.presMode = pres; V.setX(xf + 1, { follow: false }); look([xf - 9000, 1500, z0 - 2500], [xf + 30000, 3800, z0 + 10000]); }));
  out.push(await shot(V, 'front-close-' + pres, async () => { V.presMode = pres; V.setX(xf + 1, { follow: false }); look([xf - 2600, 2600, zc - 2000], [xf + 10000, 4600, zc + 3000]); }));
  out.push(await shot(V, 'across-' + pres, async () => { V.presMode = pres; V.setX(xf + 1, { follow: false }); look([xf - 14000, 5000, z0 + 3000], [xf + 30000, 1500, z0 + 40000]); }));
}
return out;

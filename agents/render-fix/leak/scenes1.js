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

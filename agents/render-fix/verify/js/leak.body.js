// issue 2: titles over nearer walls: the scenes of agents/render-fix/leak (reicast frame 40, 2018-09), Clock (+ Gallery before)
const L = LNn('reicast'), f = L.frames[40], xf = V.W[f].x, z0 = L.z0, zc = z0 + L.L.width / 2;
for (const pres of V.wallA ? ['clock'] : ['clock', 'gallery']) {
  const S = [['street-side', [xf - 7000, 3000, z0 - 6000], [xf + 20000, 2200, z0 + 9000]], ['street-low', [xf - 9000, 1500, z0 - 2500], [xf + 30000, 3800, z0 + 10000]],
    ['front-close', [xf - 2600, 2600, zc - 2000], [xf + 10000, 4600, zc + 3000]], ['across', [xf - 14000, 5000, z0 + 3000], [xf + 30000, 1500, z0 + 40000]],
    ['behind', [xf + 9000, 3500, zc + 2500], [xf - 20000, 2000, zc - 1000]]];
  for (const [n, p, t] of S) { V.presMode = pres; V.setX(xf + 1, { follow: false }); lookAt(p, t); await ready(1300); await snap('l-' + n + '-' + pres); }
}
return { shots: SHOTS, log: LOG };

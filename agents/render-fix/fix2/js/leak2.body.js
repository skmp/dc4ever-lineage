// verify (2): street views of my own in other lanes (clock on a mid frame), titles over nearer opaque walls (leak metric)
V.presMode = 'clock';
const S = [['flycast', 60], ['nullDC4Wii', 120], ['NotDC-PS3', 10], ['nullDC', 20], ['nulldc3', 5]];
for (const [lane, k] of S) { const L = LNn(lane), kk = Math.min(k, L.frames.length - 1), xf = V.W[L.frames[kk]].x, z0 = L.z0, z1 = z0 + L.L.width;
  V.setX(xf + 1, { follow: false });
  lookAt([xf - 8000, 1200, z0 - 2000], [xf + 30000, 3500, z1 + 6000]); await ready(1200); await snap('s-' + lane + '-low');
  lookAt([xf - 12000, 6500, z1 + 3000], [xf + 25000, 1000, z0 - 4000]); await ready(1200); await snap('s-' + lane + '-other-side');
}
return { shots: SHOTS, log: LOG };

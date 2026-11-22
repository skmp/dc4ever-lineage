const out = {};
const legendWall = () => (document.getElementById('legendbody').textContent.match(/nearest wall: (\S+)/) || [])[1];
for (const v of ['rec', 'fpgadc', 'fork', 'far']) { await V.view(v); await new Promise(r => setTimeout(r, 400)); out['legend-' + v] = { legend: legendWall(), nearest: V.man.snapshots[V.nearestWall()]?.id }; }
// tooltips on lines of several lanes
const tips = {};
for (const sid of ['flycast-head', 'nullDC4Wii-head', 'NotDC-PS3-0.8.3', 'nulldc-360-last', 'reicast-2013-import', 'nulldc-2011-09', 'dc4ever-2005', 'polly2-r8-develop']) {
  const s = V.man.snapshots.findIndex(x => x.id === sid), w = V.W[s];
  const k = V.snapJ[s].files.findIndex(f => f.n > 50); const v = V.fileView(s, k, 20); V.cam.p = v.p; V.setLook(v.dir);
  await new Promise(r => setTimeout(r, 500));
  // project line 20 of the file
  const j = w.fileStart[k] + 19, w1 = w.inst[2 * j + 1], col = w1 & 4095, row = (w1 >>> 12) & 2047;
  const p = [V.WX[s], 4096 - row * 2 - 1, w.z0 + col * 128 + 6], M = V.VP;
  const c = [0, 1, 2, 3].map(i => M[i] * p[0] + M[4 + i] * p[1] + M[8 + i] * p[2] + M[12 + i]);
  const sx = (c[0] / c[3] + 1) / 2 * innerWidth, sy = (1 - c[1] / c[3]) / 2 * innerHeight;
  const pk = V.pick(sx, sy); V.mouse = { x: sx, y: sy, over: true }; V.showTip(pk, true); await new Promise(r => setTimeout(r, 300));
  tips[sid] = document.getElementById('tip').innerText.replace(/\s+/g, ' ').slice(0, 700);
}
out.tips = tips;
V.setMode(4); await V.view('rec'); await new Promise(r => setTimeout(r, 800));
out.authorLegend = document.getElementById('legendbody').innerText.replace(/\s+/g, ' ').slice(0, 600);
return out;

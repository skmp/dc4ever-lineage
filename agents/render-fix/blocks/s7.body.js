// is the want set sticky? after a gallery session over 5 lanes: loaded walls, their want epoch, their distance now
V.attract && V.attract.stop();
V.presMode = 'gallery'; V.setX(V.xMax + V.U); V.emit('time');
const lanes = ['nullDC', 'reicast', 'flycast', 'nulldc3', 'nullDC4Wii'].map(n => V.LN.find(l => l.name === n));
const t0 = performance.now(), dur = 40;
const step = () => { const t = Math.min(1, (performance.now() - t0) / 1000 / dur), x = t * lanes.length, i = Math.min(lanes.length - 1, Math.floor(x)), f = x - i, L = lanes[i];
  V.cam.p = [L.xs[0] - 6000 + f * (L.xs.at(-1) - L.xs[0] + 8000), 3000, L.z0 + L.L.width / 2 - 1500]; V.setLook([1, -0.06, 0.02]); };
V.on('tick', step); await sleep(dur * 1000 + 100); V.off('tick', step);
const ln = V.LN.find(l => l.name === 'flycast'); const xm = ln.xs[60];
V.cam.p = [xm - 50000, 20000, ln.z0 - 30000]; V.setLook([0.8, -0.25, 0.5]);
let loadsAfter = 0; const onW = () => loadsAfter++; V.on('wall', onW);
const fp = V.focalPx(), ppl = w => { const x = V.dispX(w), c = V.cam.p; const d = Math.hypot(Math.max(0, x - c[0], c[0] - x), Math.max(0, -c[1], c[1] - 4096), Math.max(0, w.z0 - c[2], c[2] - w.z0 - w.cols * 128)); return 2 * fp / Math.max(1, d); };
const snapState = () => { const L = V.WALLS.filter(w => w.loaded), maxE = Math.max(...V.WALLS.map(w => w.wanted));
  const wantedNow = V.WALLS.filter(w => V.isSolid(w) && ppl(w) >= V.LODP.want && V.cam.p[0] <= V.dispX(w));
  return { loaded: L.length, loadedRows: L.reduce((a, w) => a + Math.max(1, Math.ceil(w.n / 4096)), 0), loadedWithCurrentEpoch: L.filter(w => w.wanted === maxE).length,
    loadedFarBelowWant: L.filter(w => ppl(w) < V.LODP.want).length, wantedByDistance: wantedNow.length, wantedByDistanceNotLoaded: wantedNow.filter(w => !w.loaded).map(w => w.i + ':' + ppl(w).toFixed(3)).slice(0, 12), f190: { loaded: V.W[190].loaded, wanted: V.W[190].wanted === maxE, wantD: V.W[190].wantD } }; };
const a = snapState(); await sleep(8000); const b = snapState(); V.off('wall', onW);
return { log: [], after: a, after8s: b, loadsIn8s: loadsAfter, wantQueue: V.stats.wantQueue };

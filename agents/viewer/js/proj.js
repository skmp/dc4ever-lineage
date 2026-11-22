await V.view('far'); await new Promise(r => setTimeout(r, 500));
const M = V.VP, P = p => { const c = [0, 1, 2, 3].map(i => M[i] * p[0] + M[4 + i] * p[1] + M[8 + i] * p[2] + M[12 + i]); return [Math.round((c[0] / c[3] + 1) / 2 * innerWidth), Math.round((1 - c[1] / c[3]) / 2 * innerHeight), Math.round(c[3])]; };
const L = V.layout.lanes, zMax = L.at(-1).z0 + L.at(-1).width, r = V.layout.ruler.find(r => r.year === 2010);
const w = V.W.find(w => w.snap.id === 'wren7-head'), d = V.W.find(w => w.snap.id === 'dc4ever-2005');
return { zMax, year2010: [P([r.x, -6, -1500]), P([r.x, -6, zMax])], wren7: [P([V.WX[w.s], 0, w.z0]), P([V.WX[w.s], 4096, w.z0])], dc4: [P([V.WX[d.s], 0, d.z0]), P([V.WX[d.s], 0, d.z0 + d.cols * 128])], x: [V.WX[w.s], V.WX[d.s]], cam: V.cam.p, f: V.camBasis().f };

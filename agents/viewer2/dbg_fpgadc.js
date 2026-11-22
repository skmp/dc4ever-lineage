await V.view('fpgadc');
const fs = V.WALLS.filter(w => V.LN[w.lane].L.group === 'fpgadc');
const disp = fs.filter(w => V.isSolid(w)).map(w => [w.i, w.fr.lane, Math.round(V.dispX(w)), w.z0]);
return { cam: V.cam.p.map(Math.round), f: V.camBasis().f, X: V.X, box: V.wallsBox(fs.map(w => w.i)), disp, stats: { t3: V.stats.t3, imp: V.stats.imp, vis: V.stats.visibleWalls } };

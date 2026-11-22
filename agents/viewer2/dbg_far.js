await V.view('far');
return { cam: V.cam.p.map(Math.round), f: V.camBasis().f, free: V.freeNDC(), xMin: V.xMin, xMax: V.xMax, stats: { t3: V.stats.t3, imp: V.stats.imp, vis: V.stats.visibleWalls, draws: V.stats.draws } };

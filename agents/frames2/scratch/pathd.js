const ln = V.LN.find(l => l.name === 'nulldc3'), f = ln.frames.at(-1), w = V.W[f];
V.presMode = 'clock'; V.setX(V.xMax + V.U); const d = V.readDist(12);
V.cam.p = [w.x - d, 2048, w.z0 + 2000]; V.setLook([1, 0, 0]);
await new Promise(r => setTimeout(r, 4000));
const near = V.WALLS.filter(o => Math.abs(o.x - w.x) < 3000 && o.lane === w.lane).map(o => [o.i, o.x - w.x, V.wallA(o), o.loaded]);
return { d, wx: w.x, f, loaded: w.loaded, a: V.wallA(w), near, readWall: V.readWall, stats: { draws: V.stats.draws, lines: V.stats.inst, vis: V.stats.visibleWalls, want: V.stats.wantQueue } };

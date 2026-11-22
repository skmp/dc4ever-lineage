await new Promise(r => setTimeout(r, 3000));
return { load: V.load, stats: { ...V.stats, dt: undefined, cpu: undefined, gpu: undefined }, X: V.X, date: V.dateOfX(V.X), live: V.live.length, walls: V.load.walls };

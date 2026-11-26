await V.whenReady({ timeout: 120000 });
await new Promise(r => setTimeout(r, 3000));
let paths = 0; for (const w of V.WALLS) if (w.meta) paths += w.meta.paths.length;
return { heap: Math.round(performance.memory.usedJSHeapSize / 1048576), paths, load: V.load };

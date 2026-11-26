globalThis.VIEW='low'; globalThis.DENSE=0;
// stationary view down the polly2 lane from outside it (as the dense low fly), with the density LOD at its default or off
// (globalThis.DENSE), plus the overview-style oblique over the fpgadc lanes
V.fixedQuality = true; V.setQualityStep(0); V.attract.stop(); document.getElementById('caption').classList.add('hidden');
V.presMode = 'clock'; V.setPlaying(false); V.setX(V.xMax + V.U, { follow: false });
if (globalThis.DENSE !== undefined) V.LODP.dense = globalThis.DENSE;
const L = V.LN.find(l => l.name === 'polly2'), x = V.tm.xOfDate('2026-08-01');
if (globalThis.VIEW === 'oblique') { const fs = V.WALLS.filter(w => V.LN[w.lane].L.group === 'fpgadc').map(w => w.i); const v = V.fitBox(V.wallsBox(fs), [0.62, -0.5, 0.6]); V.cam.p = v.p; V.setLook(v.dir); }
else { V.cam.p = [x - 4000, 2500, L.z0 - 1500]; V.setLook([1, -0.05, 0.12]); }
await V.whenReady({ timeout: 90000 }); await new Promise(r => setTimeout(r, 1500));
return { borrowed: V.stats.borrowed, baked: V.stats.baked, walls: V.load.walls, draws: V.stats.draws };

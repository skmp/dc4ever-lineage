await V.view('far');
const out = [];
for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 1000)); out.push({ gpu: V.stats.gpu.slice(-2).map(x => +x.toFixed(1)), dt: V.stats.dt.slice(-2).map(x => +x.toFixed(0)), cpu: +V.stats.cpu.at(-1).toFixed(1), draws: V.stats.draws, t3: V.stats.t3, t4: V.stats.t4, imp: V.stats.imp, inst: V.stats.inst, pb: V.stats.pendingBake, wq: V.stats.wantQueue, walls: V.load.walls, sk: V.stats.skipped, baked: V.stats.baked }); }
return out;

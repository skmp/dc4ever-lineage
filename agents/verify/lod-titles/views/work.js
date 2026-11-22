// work per path (GPU LOD path at fixed quality): bakes, line instances, draws, impostor runs, walls loaded; PATHS set by the wrapper
V.fixedQuality = true; V.setQualityStep(0);
const out = {};
for (const p of PATHS) {
  const b0 = V.stats.baked || 0; let n = 0, inst = 0, draws = 0, imp = 0, maxInst = 0;
  let up = 0; const fu = () => up++; V.on('wall', fu);
  const f = () => { n++; inst += V.stats.inst; draws += V.stats.draws; imp += V.stats.imp; maxInst = Math.max(maxInst, V.stats.inst); };
  V.on('frame', f); const r = await V.runBench(p, 8); V.off('frame', f); V.off('wall', fu);
  out[p] = { frames: n, bakes: (V.stats.baked || 0) - b0, inst_mean: Math.round(inst / n), inst_max: maxInst, draws_mean: +(draws / n).toFixed(1), impRuns_mean: +(imp / n).toFixed(1), walls: V.load.walls, uploads: up, skipped: r.skipped_rafs, gpu_ms: r.gpu_ms, frame_ms: r.frame_ms };
}
return out;

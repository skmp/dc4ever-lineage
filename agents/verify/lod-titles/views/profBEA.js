const PATHS = ['B','E','A'];
// per-section CPU ms (main.js PM marks) averaged over a short bench path; PATHS set by the wrapper
const out = {};
for (const p of PATHS) {
  const acc = {}; let n = 0;
  const f = () => { for (const [k, v] of V.prof.cur) acc[k] = (acc[k] || 0) + v; n++; };
  V.on('frame', f); const r = await V.runBench(p, 6); V.off('frame', f);
  for (const k in acc) acc[k] = +(acc[k] / n).toFixed(2);
  out[p] = { fps: r.fps_mean, cpu: r.cpu_ms, frames: n, sections: acc, steps: r.quality_steps };
}
return out;

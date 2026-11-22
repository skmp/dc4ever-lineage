const out = [];
const run = async (label, lane, dist, skip) => {
  V.skip.clear(); for (const s of skip) V.skip.add(s);
  const li = V.layout.lanes.findIndex(l => l.name === lane);
  const ss = V.layout.lanes[li].snaps.slice().sort((a, b) => V.eventOf[a] - V.eventOf[b]); const b = ss[2];
  V.fixedQuality = true; V.setQualityStep(0); V.setPres('gallery'); V.cam.p = [0, 50000, -50000]; await new Promise(r => setTimeout(r, 1500));
  V.setPres('now'); V.setTime(V.eventOf[b] - 1 + 0.02); V.follow = true; await new Promise(r => setTimeout(r, 300));
  const w = V.W[b], x = V.eventX(V.t); V.cam.p = [x - dist, 2900, w.z0 + 3400]; V.setLook([1, -0.1, 0.5]);
  V.playSpeed = 0.3; V.playing = true; const d = []; const h = ({ cpu }) => d.push([+V.lastRawDt.toFixed(0), +cpu.toFixed(0), V.stats.inst, V.stats.lineRuns, V.stats.imp]); V.on('frame', h);
  await new Promise(r => setTimeout(r, 4000)); V.listeners.frame.splice(V.listeners.frame.indexOf(h), 1); V.playing = false;
  out.push([label, d.length, d.slice(0, 6), Math.max(...d.map(x => x[0]))]);
};
await run('nulldc3 close', 'nulldc3', 900, []);
await run('nulldc3 close -labels', 'nulldc3', 900, ['labels']);
await run('nulldc3 close -segs', 'nulldc3', 900, ['segs']);
await run('nulldc3 close -imp', 'nulldc3', 900, ['imp']);
await run('nulldc3 close -deco', 'nulldc3', 900, ['deco']);
await run('nulldc3 close -plates-floor', 'nulldc3', 900, ['plates', 'floor']);
return out;

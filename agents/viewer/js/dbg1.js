const li = V.layout.lanes.findIndex(l => l.name === 'reicast');
const ss = V.layout.lanes[li].snaps.slice().sort((a, b) => V.eventOf[a] - V.eventOf[b]); const b = ss[2];
V.fixedQuality = false; V.setPres('now'); V.setTime(V.eventOf[b] - 1 + 0.2); V.follow = true;
const w = V.W[b], x = V.eventX(V.t); V.cam.p = [x - 900, 2900, w.z0 + 3400]; V.setLook([1, -0.1, 0.5]);
await new Promise(r => setTimeout(r, 2500));
return { b, t: V.t, x, WX: V.WX[b], WA: V.WA[b], morph: !!V.morph, stats: { inst: V.stats.inst, lineRuns: V.stats.lineRuns, imp: V.stats.imp, t3: V.stats.t3 }, cam: V.cam.p, noLines: V.noLines[b] };

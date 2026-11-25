// Now mode playback (P): the clock plays, each lane's frame rides on the clock plane; camera follows like pathE but nearer
V.attract && V.attract.stop();
const ln = V.LN.find(l => l.name === 'flycast');
V.presMode = 'clock'; V.setX(ln.xs[40]); V.emit('time');
const place = () => { V.cam.p = [V.X - 14000, 6000, ln.z0 - 6000]; V.setLook([0.75, -0.2, 0.62]); };
place(); await sleep(4000); await snap('s4a-paused-clock');
V.setPlaying(true); const t0 = performance.now(); V.on('tick', place);
const live = [];
for (const s of [1, 2, 3, 4, 6, 8, 10]) { while ((performance.now() - t0) / 1000 < s) await sleep(20);
  const L = V.live.map(l => ({ lane: V.LN[l.lane].name, f: l.f, loaded: V.W[l.f].loaded, imp: V.W[l.f].imp ? V.W[l.f].imp.tier : null, morph: !!l.morph }));
  await snap('s4b-now-' + s + 's', { live: L.filter(l => ['flycast', 'reicast', 'nulldc3', 'nullDC4Wii', 'minicast', 'NotDC-PS3'].includes(l.lane)) }); }
V.off('tick', place); V.setPlaying(false);
return { shots: SHOTS, log: LOG };

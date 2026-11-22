const li = V.layout.lanes.findIndex(l => l.name === 'nulldc3');
const ss = V.layout.lanes[li].snaps.slice().sort((a, b) => V.eventOf[a] - V.eventOf[b]); const b = ss[2];
V.fixedQuality = true; V.setQualityStep(0); V.setPres('now'); V.setTime(V.eventOf[b] - 1 + 0.25); V.follow = true;
await new Promise(r => setTimeout(r, 300));
const w = V.W[b], x = V.eventX(V.t); V.cam.p = [x - 2600, 2900, w.z0 + 3400]; V.setLook([1, -0.1, 0.5]);
await new Promise(r => setTimeout(r, 2000));
const out = [];
const rec = async (label) => { const d = []; const h = () => d.push(+V.lastRawDt.toFixed(1)); V.on('frame', h); await new Promise(r => setTimeout(r, 1200)); V.listeners.frame.splice(V.listeners.frame.indexOf(h), 1); out.push([label, d.slice(0, 8), Math.max(...d)]); };
await rec('steady0');
for (const s of [1, 2, 1, 2, 0, 2]) { V.setQualityStep(s); await rec('step' + s); }
V.quality.scale = 0.5; await rec('scale0.5');
V.quality.scale = 0.41; await rec('scale0.41');
V.quality.t0 = 20; await rec('t0=20');
return { out, morph: !!V.morph };

const ln = V.LN.find(l => l.name === 'dreamcast-tests'), W = V.W, fm = ln.frames[50];
V.presMode = 'clock'; V.setPlaying(false); V.setX(W[ln.frames.at(-1)].x + 1, { follow: false });
const n = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
V.cam.p = [W[ln.frames[0]].x - 6000, 9000, ln.z0 - 12000]; V.setLook(n([1, -0.25, 0.45]));
await V.whenReady({ timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
return { n: ln.frames.length, first: [W[ln.frames[0]].x, V.F.frames[ln.frames[0]].date], last: [W[ln.frames.at(-1)].x, V.F.frames[ln.frames.at(-1)].date] };

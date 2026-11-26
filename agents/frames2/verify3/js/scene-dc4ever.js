const ln = V.LN[0], W = V.W, f0 = ln.frames[0], f1 = ln.frames[30];
V.presMode = 'clock'; V.setPlaying(false); V.setX(W[ln.frames[101]].x + 1, { follow: false });
const n = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
V.cam.p = [W[f0].x - 3500, 5200, ln.z0 + ln.L.width + 9000]; V.setLook(n([1, -0.12, -0.55]));
await V.whenReady({ timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
return { xs: ln.frames.slice(0, 12).map(f => [W[f].x, V.F.frames[f].date, V.F.frames[f].files, V.F.frames[f].lines]), stats: V.stats.visibleWalls };

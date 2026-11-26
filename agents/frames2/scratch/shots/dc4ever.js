// dc4ever's walls 2004: one frame per commit, oblique, Clock just past the 40th frame
const ln = V.LN.find(l => l.name === 'dc4ever'), fs = ln.frames.slice(0, 40);
V.fixedQuality = true; V.setQualityStep(0); V.attract.stop(); document.getElementById('caption').classList.add('hidden');
V.presMode = 'clock'; V.setPlaying(false); V.setX(V.W[fs.at(-1)].x + 1, { follow: false });
const v = V.fitBox(V.wallsBox(fs), [0.75, -0.35, 0.55]); V.cam.p = v.p; V.setLook(v.dir);
await V.whenReady({ timeout: 90000 }); await new Promise(r => setTimeout(r, 800));
return fs.map(f => [V.F.frames[f].date, V.F.frames[f].files, V.F.frames[f].lines, V.W[f].x]);

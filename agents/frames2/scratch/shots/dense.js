// a dense burst: dreamcast-tests (103 frames in 2026-11) and its neighbours, oblique, with the ruler's month ticks
const ln = V.LN.find(l => l.name === (new URLSearchParams(location.search).get('lane') || 'dreamcast-tests')), fs = ln.frames;
V.fixedQuality = true; V.setQualityStep(0); V.attract.stop(); document.getElementById('caption').classList.add('hidden');
V.presMode = 'clock'; V.setPlaying(false); V.setX(V.W[fs.at(-1)].x + 1, { follow: false });
const bb = V.wallsBox(fs);
const v = V.fitBox(bb, [0.5, -0.32, 0.8]); V.cam.p = v.p; V.setLook(v.dir);
await V.whenReady({ timeout: 90000 }); await new Promise(r => setTimeout(r, 800));
return { n: fs.length, x0: V.W[fs[0]].x, x1: V.W[fs.at(-1)].x, first: V.F.frames[fs[0]].date, last: V.F.frames[fs.at(-1)].date };

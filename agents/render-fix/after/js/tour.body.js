// the tour for 40 s (snapshots every 5 s), then search + file panel + a bookmark: exceptions, T3 area, leaks
V.fixedQuality = false; V.attract.start('url');
for (let s = 5; s <= 40; s += 5) { await sleep(5000); await snap('t-tour-' + s + 's', { attract: V.attractOn, X: V.X }); }
V.attract.stop();
const r = await V.search('Time to emulate', {}); const hits = (r && (r.hits || r.results || r.res)) || r;
await V.gotoBookmark && V.gotoBookmark('nullDC rec_v1 driver', { instant: true }); await ready(1000); await snap('t-bookmark');
let fp = null; try { const w = V.W[V.LN.find(l => l.name === 'flycast').frames.at(-1)]; const k = w.meta.paths.findIndex(p => /spg\.cpp$/.test(p));
  if (V.filePanel) { await V.filePanel(w.i, w.meta.ident[k]); fp = true; } } catch (e) { fp = String(e); }
await ready(1500); await snap('t-filepanel', { fp });
return { shots: SHOTS, log: LOG, search: JSON.stringify(hits).slice(0, 300) };

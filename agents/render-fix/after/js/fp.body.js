// file panel: open it for flycast's last spg.cpp, click the nullDC row (sets the clock, flies there); search UI
const w = V.W[LNn('flycast').frames.at(-1)], k = w.meta.paths.findIndex(p => /spg\.cpp$/.test(p));
await V.filePanel({ ident: w.meta.ident[k], path: w.meta.paths[k], n: w.meta.n[k], w });
const rows = [...document.querySelectorAll('#filepanel .lrow')]; const row = rows.find(e => /nullDC$/.test(e.querySelector('.lname').textContent)) || rows[0];
row.click(); await sleep(3500); await ready(1500); await snap('fp-after-click', { rows: rows.length, X: V.X, pres: V.pres(), focus: V.live.map(l => V.W[l.f].shortTitle).filter(t => t.startsWith('nullDC ')) });
document.getElementById('sq').value = 'Time to emulate'; document.getElementById('sq').dispatchEvent(new Event('input')); await sleep(2500);
const first = document.querySelector('#sres > *'); const nres = document.querySelectorAll('#sres > *').length; if (first) first.click(); await sleep(3500); await ready(1500);
await snap('search-after-click', { nres, X: V.X });
return { shots: SHOTS, log: LOG };

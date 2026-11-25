// the tour, as the owner sees it: snapshots every 2.5 s for 55 s
V.attract.start('url'); const t0 = performance.now();
for (let s = 2.5; s <= 55; s += 2.5) { while ((performance.now() - t0) / 1000 < s) await sleep(20); await snap('s3-tour-' + String(s.toFixed(1)).padStart(4, '0'), { cap: document.getElementById('caption').textContent.slice(0, 90) }); }
V.attract.stop();
return { shots: SHOTS, log: LOG };

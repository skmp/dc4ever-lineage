// live tour for 150 s: caption changes, wall in reading range at each hold, page errors
const errs = []; addEventListener('error', e => errs.push(String(e.message))); addEventListener('unhandledrejection', e => errs.push('rej ' + e.reason));
const cap = document.getElementById('caption'), seen = []; let last = '';
V.attract.start('button'); const t0 = performance.now();
while (performance.now() - t0 < 150000) { await new Promise(r => setTimeout(r, 500));
  const t = cap.innerText; if (t && t !== last && cap.style.opacity !== '0') { last = t; seen.push({ t: Math.round((performance.now() - t0) / 1000), now: t.split('\n').filter(l => l.startsWith('now:')).at(-1), head: t.split('\n')[0].slice(0, 60), fps: V.stats.fps }); } }
V.attract.stop(); return { on: V.attract.on, captions: seen.length, seen, errs };

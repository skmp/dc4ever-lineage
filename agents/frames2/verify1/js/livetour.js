// the real tour loop for 70 s: captions seen, errors
const cap = document.getElementById('caption'), seen = new Set(), errs = [];
addEventListener('error', e => errs.push(String(e.message)));
V.attract.start('button');
const t0 = performance.now();
while (performance.now() - t0 < 70000) { await new Promise(r => setTimeout(r, 500)); if (!cap.classList.contains('hidden')) seen.add(cap.innerText.split('\n').filter(l => l.startsWith('now:')).join('|') + ' :: ' + cap.innerText.split('\n')[0].slice(0, 60)); }
return { on: V.attract.on, seen: [...seen], errs };

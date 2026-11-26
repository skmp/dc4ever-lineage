// inspector: after showItem, find the screen row where V.pick returns the item's line id; report the line delta
// between the centre pick and the item (same procedure on HEAD and the parent build)
const A = V.attract, out = { n: 0, hitNear: 0, deltas: {}, centre: [], tip: null, errs: [] };
const items = A.items.filter(i => i.kind === 'line').slice(0, 25);
for (const it of items) {
  await A.showItem(it, 0); out.n++;
  const c = V.pick(innerWidth / 2, innerHeight / 2);
  if (c && c.kind === 'line') { const st = A.route(it)[0]; out.centre.push(`${c.line - 1 - st[2]}`); }
  let found = null;
  for (let dy = -120; dy <= 120 && !found; dy += 2) for (let dx = -400; dx <= 400 && !found; dx += 25) {
    const p = V.pick(innerWidth / 2 + dx, innerHeight / 2 + dy); if (p && p.kind === 'line' && p.id === it.id) found = dy; }
  if (found !== null) { out.hitNear++; out.deltas[found] = (out.deltas[found] || 0) + 1; } else out.errs.push(it.text.slice(0, 40));
}
// tooltip: hover the centre and read the inspector text
const cv = document.querySelector('canvas');
cv.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true }));
await new Promise(r => setTimeout(r, 1500));
const tip = [...document.querySelectorAll('div')].filter(d => d.offsetParent && /first seen:/.test(d.innerText)).map(d => d.innerText).at(-1);
out.tip = tip ? tip.slice(0, 400) : null;
return out;

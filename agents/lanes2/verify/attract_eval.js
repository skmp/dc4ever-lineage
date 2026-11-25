V.attract.start('button');
const seen = []; const t0 = performance.now();
while (performance.now() - t0 < 20000) {
  await new Promise(r => setTimeout(r, 1000));
  const c = document.getElementById('caption');
  seen.push({ t: Math.round((performance.now() - t0) / 1000), on: V.attractOn, cap: c.classList.contains('hidden') ? null : c.textContent.slice(0, 90), X: Math.round(V.X) });
}
return { items: V.attract.items.length, picked: V.attract.items.filter(i => i.picked).length, seen };

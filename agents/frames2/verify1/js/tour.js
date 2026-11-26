// in-page: every tour item: every route stop resolves to a wall, slot, file path (== stop_files path) and the line id;
// caption wording per stop; showItem on stop 0 + centre pick for line items
const A = V.attract, F = V.F, W = V.W, items = A.items, out = { n: items.length, picked: items.filter(i => i.picked).length, errs: [], caps: [], pick: { line: 0, hit: 0, miss: [] } };
const err = s => { if (out.errs.length < 60) out.errs.push(s); };
const cap = document.getElementById('caption');
let nst = 0;
for (const [ii, it] of items.entries()) {
  const name = (it.text || it.title).slice(0, 50);
  const rt = A.route(it);
  for (const st of rt) {
    nst++;
    const [f, ident, line] = st, w = W[f]; if (!w) { err(`no wall ${name} f${f}`); continue; }
    const s = V.slotOf(w, ident); if (s === undefined) { err(`no slot ${name}`); continue; }
    const ww = await V.ensureWall(f, 30000); if (!ww) { err(`not loaded ${name} f${f}`); continue; }
    const k = w.slotToFile.get(s); if (k === undefined) { err(`hole ${name}`); continue; }
    const fc = it.stop_files[it.stops.indexOf(st)];
    if (!fc || fc.path !== w.paths[k]) err(`path ${name}: ${fc && fc.path} vs ${w.paths[k]}`);
    if (it.kind !== 'file') { const j = w.fileStart[k] + line, id = w.inst[2 * j] & 0xFFFFF;
      if (it.kind === 'line' && id !== it.id) err(`line id ${name}: ${id} != ${it.id}`);
      if (it.kind === 'segment' && !it.ids.includes(id)) err(`seg id ${name}`); }
    A.caption(it, st); const t = cap.innerText;
    if (!/now: .*file last changed/.test(t)) err(`caption ${name}: ${t.slice(-120)}`);
    if (it.kind !== 'file' && !/first seen in .*(file last changed|2005-2008)/.test(t)) err(`first ${name}: ${t.slice(0, 200)}`);
    if (fc && fc.range && !t.includes(fc.range)) err('range missing ' + name);
  }
  if (ii % 11 === 0) out.caps.push(cap.innerText);
}
out.stops = nst;
// showItem + pick at the centre for line items (sample all line items)
for (const it of items.filter(i => i.kind === 'line')) {
  await A.showItem(it, 0); out.pick.line++;
  let hit = false;
  for (let dy = -6; dy <= 6 && !hit; dy += 3) for (let dx = -300; dx <= 300 && !hit; dx += 20) { const p = V.pick(innerWidth / 2 + dx, innerHeight / 2 + dy); if (p && p.kind === 'line' && p.id === it.id) hit = true; }
  if (hit) out.pick.hit++; else if (out.pick.miss.length < 10) out.pick.miss.push(it.text.slice(0, 50));
}
out.heap = performance.memory.usedJSHeapSize / 1048576;
return out;

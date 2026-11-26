// verify3: every tour item. All stops: wall + slot + stop_files entry. Route stops (what the tour plays): wall loaded, file
// path at the slot == stop_files path, line id at the row == item id, caption shows exactly the precomputed labels.
const A = V.attract, W = V.W, items = A.items, cap = document.getElementById('caption');
const o = { items: items.length, picked: items.filter(i => i.picked).length, uniquePicked: items.filter(i => i.picked && i.unique).length,
  allStops: 0, routeStops: 0, errs: [], kinds: {}, sample: [] };
const err = s => { if (o.errs.length < 80) o.errs.push(s); };
const t0 = performance.now();
for (const [ii, it] of items.entries()) {
  const name = (it.text || it.title || '').slice(0, 50); o.kinds[it.kind] = (o.kinds[it.kind] || 0) + 1;
  if (!it.stop_files || it.stop_files.length !== it.stops.length) err('stop_files length ' + name);
  if (it.kind !== 'file' && !it.origin_file && it.origin_lane !== 'nullDC-pre2008') err('no origin_file ' + name);
  for (const [k, st] of it.stops.entries()) { o.allStops++;
    const w = W[st[0]]; if (!w) { err(`no wall ${name} f${st[0]}`); continue; }
    if (V.slotOf(w, st[1]) === undefined) err(`no slot ${name} f${st[0]}`);
    const fc = it.stop_files[k]; if (!fc || !fc.label || !fc.path) err(`bad stop_file ${name} ${k}`); }
  for (const st of A.route(it)) { o.routeStops++;
    const [f, ident, line] = st, w = W[f], s = V.slotOf(w, ident);
    const ww = await V.ensureWall(f, 30000); if (!ww) { err(`not loaded ${name} f${f}`); continue; }
    const kf = w.slotToFile.get(s), fc = it.stop_files[it.stops.indexOf(st)];
    if (kf === undefined) { err('hole ' + name); continue; }
    if (fc.path !== w.paths[kf]) err(`path ${name}: ${fc.path} vs ${w.paths[kf]}`);
    if (it.kind !== 'file') { const id = w.inst[2 * (w.fileStart[kf] + line)] & 0xFFFFF;
      if (it.kind === 'line' && id !== it.id) err(`id ${name}`); if (it.kind === 'segment' && !it.ids.includes(id)) err(`seg id ${name}`); }
    A.caption(it, st); const t = cap.innerText;
    const now = t.split('\n').filter(l => l.startsWith('now: ')).at(-1) || '';
    if (!now.includes(`, file last changed ${fc.label}`)) err(`now ${name}: ${now} want ${fc.label}`);
    if (!now.startsWith('now: ' + V.F.frames[f].lane)) err(`now lane ${name}: ${now}`);
    if (it.kind !== 'file') { const want = it.origin_file ? `first seen in ${it.origin_lane}, file last changed ${it.origin_file.label}` : `first seen in ${it.origin_lane} 2005-2008`;
      if (!t.includes(want)) err(`first ${name}: ${t.slice(0, 160)} want ${want}`); }
    else if (!t.includes(`first: file last changed ${it.first_file.label}`)) err('file first ' + name);
    if (/undefined|NaN|\bnull\b/.test(t)) err('bad text ' + name);
    if (ii % 15 === 0 && o.sample.length < 14) o.sample.push(t.replace(/\n/g, ' | ').slice(0, 260));
  }
}
o.sec = Math.round((performance.now() - t0) / 1000); return o;

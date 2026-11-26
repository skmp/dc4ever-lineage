// in-page: walls in time order / spacing / ruler, gap, release, clock consistency; titles; search; inspector
const L = V.layout, F = V.F, W = V.W, U = L.unit.month, tm = V.tm, r = { errs: [] };
const err = s => { if (r.errs.length < 40) r.errs.push(s); };
r.walls = V.WALLS.length; r.NF = V.NF;
let minGap = 1e9;
for (const ln of V.LN) {
  const fs = ln.frames;
  for (let q = 1; q < fs.length; q++) {
    const a = W[fs[q - 1]], b = W[fs[q]], fa = F.frames[fs[q - 1]], fb = F.frames[fs[q]];
    if (!(b.x > a.x)) err(`order ${ln.name} ${fa.date} ${fb.date}`);
    if (fa.date > fb.date) err(`date ${ln.name} ${fa.date} > ${fb.date}`);
    minGap = Math.min(minGap, b.x - a.x);
    if (b.x - a.x < U / 8 - 1) err(`spacing ${ln.name} ${b.x - a.x}`);
  }
  if (ln.xs.some((x, q) => x !== W[fs[q]].x)) err('xs mismatch ' + ln.name);
}
r.minGap = minGap;
// clock: date of a wall's x == the frame's month (day may be split for same-day frames)
let clockBad = 0, dayOff = 0;
for (const w of V.WALLS) { const fr = F.frames[w.i]; const m = tm.monthOfX(w.x), d = tm.dateOfMonth(m);
  if (d !== fr.date.slice(0, 7)) { clockBad++; if (clockBad < 6) err(`clock ${fr.lane} ${fr.date} -> ${d}`); }
  const want = tm.monthOfDate(fr.date); if (Math.abs(m - want) > 1.05 / 31) dayOff++; }
r.clockBad = clockBad; r.dayOff = dayOff;
// ruler years
for (const e of L.ruler) {
  if (e.year) { const x = tm.xOfDate(`${e.year}-01-01`); if (Math.abs(x - e.x) > 2) err(`ruler ${e.year} ${e.x} vs ${x}`);
    for (const w of V.WALLS) { const d = F.frames[w.i].date; if (d < `${e.year}-01-01` && w.x > e.x + 1) err(`wall ${F.frames[w.i].lane} ${d} right of ruler ${e.year}`); if (d >= `${e.year}-01-01` && w.x < e.x - 1) err(`wall ${d} left of ruler ${e.year}`); } }
  if (e.month) { const x = tm.xOfDate(e.month + '-01'); if (Math.abs(x - e.x) > 2) err(`month tick ${e.month} ${e.x} vs ${x}`); }
  if (e.gap) { for (const w of V.WALLS) { const d = F.frames[w.i].date.slice(0, 7); if (d >= e.from && d < e.to) err(`wall ${d} inside gap ${e.from}..${e.to}`); } }
}
r.ruler = { years: L.ruler.filter(e => e.year).length, months: L.ruler.filter(e => e.month).length, gaps: L.ruler.filter(e => e.gap).map(e => `${e.from}..${e.to}`) };
// releases
r.rel = (L.releases || []).slice(0, 3); let relBad = 0;
for (const e of L.releases || []) { const d = e.date || e.d; if (d && e.x != null && Math.abs(tm.xOfDate(d) - e.x) > 2 + U / 8) { relBad++; if (relBad < 5) err('release ' + JSON.stringify(e)); } }
r.relN = (L.releases || []).length; r.relBad = relBad;
// marks
r.marksSample = (L.marks || []).slice(0, 2);
// titles
const t = V.WALLS.filter(w => !w.title || /undefined|NaN/.test(w.title)); r.badTitles = t.length;
r.titleSamples = [W[0].title, W[V.LN.find(l => l.name === 'dreamcast-tests').frames[50]].title, W[V.LN.find(l => l.name === 'reicast').frames[60]].title];
// big-kind frames' notes shown?
const bigs = F.frames.filter(f => (f.kinds || []).includes('big')); r.bigN = bigs.length; r.bigSample = bigs.slice(0, 2).map(f => ({ d: f.date, note: f.date_note || f.note, kinds: f.kinds }));
// search
const s = await V.search('kinda wrong .. but meh', { max: 5000 }); r.search = { keys: Object.keys(s), n: s.hits ? s.hits.length : s.n ?? null, s: JSON.stringify(s).slice(0, 300) };
// x extent
r.xMin = V.xMin; r.xMax = V.xMax;
return r;

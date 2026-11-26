// verify3 in-page: clock picks each wall, clock date / HUD agree with frame dates, titles, search (through the UI), inspector
const r = { errs: [] }, err = s => { if (r.errs.length < 40) r.errs.push(s); }, sleep = ms => new Promise(x => setTimeout(x, ms));
const F = V.F, W = V.W, LN = V.LN;
let n = 0, tdBad = 0;
for (const w of V.WALLS) {
  const fr = F.frames[w.i];
  if (V.dateOfX(w.x) !== fr.date.slice(0, 7)) err(`dateOfX ${fr.lane} ${fr.date} -> ${V.dateOfX(w.x)}`);
  if (V.laneFrameAt(w.lane, w.x) !== w.i) err(`laneFrameAt at own x ${fr.lane} ${fr.date}`);
  const ln = LN[w.lane], k = ln.frames.indexOf(w.i);
  if (k > 0 && V.laneFrameAt(w.lane, w.x - 1) !== ln.frames[k - 1]) err(`laneFrameAt just before ${fr.lane} ${fr.date}`);
  if (!w.title || /undefined|NaN/.test(w.title) || !w.title.includes(fr.date.slice(0, 7))) err('title ' + w.title);
  n++;
}
r.walls = n;
// HUD date while the clock sits on a few dense-lane walls
const dt = LN.find(l => l.name === 'dreamcast-tests'), pl = LN.find(l => l.name === 'polly2');
r.hud = [];
for (const f of [dt.frames[0], dt.frames[50], dt.frames.at(-1), pl.frames[90], LN[0].frames[40]]) {
  V.presMode = 'clock'; V.setPlaying(false); V.setX(W[f].x + 1, { follow: false }); await sleep(300);
  r.hud.push(F.frames[f].lane + ' ' + F.frames[f].date + ' -> ' + document.getElementById('tdate').innerText);
}
r.titles = [W[dt.frames[50]].title, W[LN[0].frames[3]].title, W[pl.frames[100]].title];
// per-lane title uniqueness
for (const ln of LN) { const s = new Set(ln.frames.map(f => W[f].title)); if (s.size !== ln.frames.length) err(`dup titles in ${ln.L.name}: ${ln.frames.length - s.size}`); }
// search through the UI
document.getElementById('search').classList.remove('hidden');
const sq = document.getElementById('sq'); sq.value = 'kinda wrong .. but meh'; sq.dispatchEvent(new Event('input'));
for (let i = 0; i < 60 && !/distinct lines/.test(document.getElementById('sstat').innerText); i++) await sleep(250);
r.search = document.getElementById('sstat').innerText; const res = document.querySelector('#sres .res');
r.searchFirst = res ? res.innerText : null;
if (res) { const p0 = V.cam.p.slice(); res.click(); await sleep(6000); r.searchFly = { moved: Math.hypot(...V.cam.p.map((v, i) => v - p0[i])) | 0, stat: document.getElementById('sstat').innerText }; }
sq.value = 'gdrom'; document.getElementById('skind').value = 'path'; sq.dispatchEvent(new Event('input')); await sleep(1500); r.pathSearch = document.getElementById('sstat').innerText;
// inspector: centre pick after showItem for 30 line items
const A = V.attract; r.pick = { n: 0, hit: 0 };
for (const it of A.items.filter(i => i.kind === 'line').slice(0, 30)) {
  await A.showItem(it, Math.floor(it.stops.length / 2)); r.pick.n++; let hit = false;
  for (let dy = -120; dy <= 120 && !hit; dy += 2) for (let dx = -400; dx <= 400 && !hit; dx += 25) { const p = V.pick(innerWidth / 2 + dx, innerHeight / 2 + dy); if (p && p.kind === 'line' && p.id === it.id) hit = true; }
  if (hit) r.pick.hit++; else err('pick miss ' + it.text.slice(0, 40));
}
const cv = document.querySelector('canvas');
cv.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth / 2, clientY: innerHeight / 2 - 60, bubbles: true })); await sleep(1500);
r.tip = ([...document.querySelectorAll('div')].filter(d => d.offsetParent && /first seen/.test(d.innerText)).map(d => d.innerText).at(-1) || '').slice(0, 300);
r.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
return r;

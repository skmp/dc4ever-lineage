#!/usr/bin/env node
// attract_prep.mjs: the attract-mode list (FOLLOWUP item 2) -> data/attract.json.
// Curated lines and famous files, plus computed ones: the non-trivial lines that survive longest and spread widest
// (frames x lanes holding them), restricted to distinctive lines (comments or >= 24 chars, not common boilerplate).
// For every item: the frames holding it as camera stops (per lane: first, last, fork / release frames, a few between).
// Dates: every date the caption shows is the last change of the FILE holding the line / segment / file as of that frame
// (git log -1 --first-parent <frame commit> -- <path>, committer date, the field frames use), not the frame's date:
// origin_file for "first seen in" (the file at the origin frame), stop_files[k] for stops[k] ("now: ..."). A last change
// at a commit with a date override (frames.json date_range: nullDCe 39c0550, reicast 1c16baeb0, in any repo holding it)
// takes the override date and range; dc4ever dates stay approx (file mtimes); the virtual nullDC-pre2008 origin is 2005-2008.
//   node tools/attract_prep.mjs        (about 10 s; reads data/ and repos/, uses viewer/src/core.js)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as core from '../viewer/src/core.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), D = p => path.join(ROOT, 'data', p);
const F = JSON.parse(fs.readFileSync(D('frames.json'))), L = JSON.parse(zlib.gunzipSync(fs.readFileSync(D('layout.json.gz'))));
const meta = zlib.gunzipSync(fs.readFileSync(D('linemeta.bin.gz')));
const text = []; for (let c = 0; c < F.text_chunks; c++) text.push(...zlib.gunzipSync(fs.readFileSync(D(`text/lines-${String(c).padStart(3, '0')}.txt.gz`))).toString('utf8').split('\n').slice(0, F.chunk_lines));
const N = F.raw_lines, nFr = new Uint16Array(N), laneM = new Uint32Array(N), last = new Int16Array(N).fill(-1), origin = new Int16Array(N).fill(-1), firstIdent = new Int32Array(N).fill(-1);
const marks = new Map(L.marks.map(m => [m.frame, m]));
// pass 1: frames and lanes holding each line id
function* laneFrames(li) {
  let st = null; const lane = F.lanes[li];
  for (let c = 0; c < lane.chunks.length; c++) {
    const p = D(`lanes/${lane.name}/c${String(c).padStart(3, '0')}`);
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(p + '.json.gz'))), bin = new Uint8Array(zlib.gunzipSync(fs.readFileSync(p + '.bin.gz')));
    for (const fr of core.decodeChunk(j, bin)) { st = core.applyFrame(st, fr); yield [fr.f, st]; }
  }
}
for (let li = 0; li < F.lanes.length; li++) for (const [f, st] of laneFrames(li)) for (const [ident, file] of st) {
  const ids = file.ids, kp = file.kp, og = file.og;
  for (let l = 0; l < ids.length; l++) { if (kp[l] === 0xFFFF) continue; const id = ids[l];
    if (last[id] !== f) { last[id] = f; if (firstIdent[id] < 0) firstIdent[id] = ident; nFr[id]++; laneM[id] |= 1 << li; if (origin[id] < 0 || og[l] < origin[id]) origin[id] = og[l]; } }
}
const pop = x => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
const BORING = /^\s*(#\s*(include|define|endif|else|if|ifdef|ifndef|pragma)\b|\/\/\s*$|\/\*+\s*$|\*+\/\s*$|return\b|break;|case\b|default:|else\b|\{|\}|public:|private:|using namespace|extern "C")/;
const isComment = id => (meta[2 * id + 1] >> 7) & 1;
const score = id => pop(laneM[id]) * 3 + Math.log2(1 + nFr[id]);
const cand = [];
for (let id = 0; id < N; id++) {
  if (nFr[id] < 20) continue; const s = text[id] || ''; const t = s.trim();
  if (t.length < 24 || BORING.test(t) || (t.match(/\b[a-z]{3,}\b/gi) || []).length < 4 || /0x[0-9a-f]{4,}|__name__|GNU|MERCHANTAB|copyright|license|assembly is controlled|WITHOUT ANY|any later version/i.test(t)) continue;
  if (!isComment(id) && !/["']/.test(t)) continue;   // comments and string literals read as voices; plain code is shared boilerplate
  cand.push([score(id), id]);
}
cand.sort((a, b) => b[0] - a[0]);
const curated = [
  { grep: '//ToDo : Check This [26/4/05]', note: 'a dc4ever 2005 to-do, still in nullDC 3 (2026)' },
  { grep: '//and here are the new ones :D', note: 'a nullDC comment carried into reicast, flycast and nullDC 3' },
  { grep: '//Time to emulate that stuff correctly ;)', note: 'spg.cpp, the PowerVR sync pulse generator' },
];
const pickId = g => { let best = -1; for (let id = 0; id < N; id++) if (text[id] && text[id].includes(g) && (best < 0 || score(id) > score(best))) best = id; return best; };
const items = [];
for (const c of curated) { const id = pickId(c.grep); if (id >= 0) items.push({ kind: 'line', id, note: c.note, curated: true }); }
const seenText = new Set(items.map(i => text[i.id].trim()));
const seenFile = new Set(items.map(i => firstIdent[i.id])), perLane = new Map();
for (const [, id] of cand) { if (items.length >= 16) break; const t = text[id].trim(), ol = F.frames[origin[id]].lane;
  if (seenText.has(t) || seenFile.has(firstIdent[id]) || (perLane.get(ol) || 0) >= 3) continue;
  seenText.add(t); seenFile.add(firstIdent[id]); perLane.set(ol, (perLane.get(ol) || 0) + 1); items.push({ kind: 'line', id }); }
// hand-picked tour items (tools/attract_picks.json, from the curation workflow in agents/attract/): lines by id, segments
// as runs of line ids; pool 'unique' items only ever lived in one lineage and are highlighted as such
const PICKS = fs.existsSync(path.join(ROOT, 'tools/attract_picks.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/attract_picks.json'))).items : [];
const segs = [];
for (const p of PICKS) {
  if (p.kind === 'line') { if (seenText.has((text[p.id] || '').trim())) continue; seenText.add(text[p.id].trim()); items.push({ kind: 'line', id: p.id, note: p.note, curated: true, picked: true, pool: p.pool }); }
  else segs.push(p);
}
const trivialT = t => /^[\s{}();]*$/.test(t || '');
const segAnchor = segs.map(g => { const a = g.ids.findIndex(x => !trivialT(text[x])); return a < 0 ? 0 : a; });
const segByAnchor = new Map(); segs.forEach((g, k) => { const id = g.ids[segAnchor[k]]; if (!segByAnchor.has(id)) segByAnchor.set(id, []); segByAnchor.get(id).push(k); });
const segStops = segs.map(() => []);
// famous files (path regexes over the lane's file paths)
const famous = [
  { re: /(^|\/)rec_v1\/driver\.cpp$/, title: 'the SH4 dynarec (rec_v1 driver, nullDC 2006)' },
  { re: /(^|\/)rec_v2\/driver\.cpp$/, title: 'the SH4 dynarec v2 (nullDCe rec_v2)' },
  { re: /interpr\/sh4_opcodes\.cpp$/, title: 'the SH4 interpreter opcodes' },
  { re: /(^|\/)pvr\/spg\.cpp$/, title: 'spg.cpp: PowerVR video timing' },
  { re: /drkPvr\/Renderer_if\.cpp$|hw\/pvr\/Renderer_if\.cpp$/, title: 'the PowerVR renderer interface' },
  { re: /rend\/soft\/refsw\.cpp$/, title: 'refsw: the reference PowerVR software renderer' },
];
// pass 2: stops (frame, ident, line) for the chosen line ids and files
const want = new Map(items.map((it, k) => [it.id, k])), stops = items.map(() => []), fileStops = famous.map(() => []);
const pathAt = new Map(), originPath = new Map();   // 'f:ident' -> path; line id -> path of a file holding it at its origin frame
// a segment whose anchor is a short generic line ('/*': trivial, no origin of its own) falls back to its first
// distinctive line (> 8 chars, as the highlight marks) for "first seen"
const segAnchor2 = segs.map(g => g.ids.find(x => (text[x] || '').trim().length > 8));
const wantOrigin = new Set([...items.map(it => it.id), ...segs.map((g, k) => g.ids[segAnchor[k]]), ...segAnchor2.filter(x => x !== undefined)]);
// origins are by whitespace-collapsed text (agents/frames/FORMAT.md): the origin frame may hold the line as another raw id
const wsNorm = t => (t || '').replace(/\s+/g, ' ').trim(), normWant = new Map(), originFrames = new Set();
for (const id of wantOrigin) { const k = origin[id] + '|' + wsNorm(text[id]); if (!normWant.has(k)) normWant.set(k, []); normWant.get(k).push(id); originFrames.add(origin[id]); }
const originNormPath = new Map();
for (let li = 0; li < F.lanes.length; li++) for (const [f, st] of laneFrames(li)) {
  for (const [ident, file] of st) {
    pathAt.set(f + ':' + ident, file.path);
    for (let l = 0; l < file.ids.length; l++) { const id = file.ids[l]; if (origin[id] === f && wantOrigin.has(id) && !originPath.has(id)) originPath.set(id, file.path); }
    if (originFrames.has(f)) for (let l = 0; l < file.ids.length; l++) { const ws = normWant.get(f + '|' + wsNorm(text[file.ids[l]]));
      if (ws) for (const id of ws) if (!originNormPath.has(id)) originNormPath.set(id, file.path); }
    for (let l = 0; l < file.ids.length; l++) { const k = want.get(file.ids[l]); if (k !== undefined && !(stops[k].length && stops[k].at(-1)[0] === f)) stops[k].push([f, ident, l]); }
    for (let l = 0; l < file.ids.length; l++) { const ks = segByAnchor.get(file.ids[l]); if (!ks) continue;
      for (const k of ks) { const g = segs[k], st0 = l - segAnchor[k]; if (st0 < 0) continue; let m = 0, nt = 0;
        for (let q = 0; q < g.ids.length; q++) { if (trivialT(text[g.ids[q]])) continue; nt++; if (file.ids[st0 + q] === g.ids[q]) m++; }
        if (m >= Math.max(3, Math.ceil(nt * 0.75)) && !(segStops[k].length && segStops[k].at(-1)[0] === f)) segStops[k].push([f, ident, st0, g.ids.length]); } }
    famous.forEach((fm, k) => { if (fm.re.test(file.path) && !(fileStops[k].length && fileStops[k].at(-1)[0] === f)) fileStops[k].push([f, ident, 0, file.ids.length]); });
  }
}
const laneOf = f => F.frames[f].lane, dateOf = f => F.frames[f].date;
// last change of a file as of a frame (see the header)
const repoOf = new Map(F.lanes.map(l => [l.name, l.repo]));
const override = F.frames.filter(f => f.date_range && !f.virtual && f.commit).map(f => ({ c: f.commit, date: f.date, range: f.date_range }));
const gitCache = new Map(); let gitN = 0;
function fileChange(f, p) {
  const fr = F.frames[f];
  if (fr.virtual || !p) return { label: '2005-2008', date: '2005-2008' };
  const repo = repoOf.get(fr.lane), key = repo + ' ' + fr.commit + ' ' + p;
  if (!gitCache.has(key)) {
    gitN++;
    const out = execFileSync('git', ['-C', path.join(ROOT, 'repos', repo + '.git'), 'log', '-1', '--first-parent', '--format=%H %cs', fr.commit, '--', p]).toString().trim();
    if (!out) throw new Error(`no last change for ${p} at ${fr.lane} ${fr.commit}`);
    const [c, d] = out.split(' '), o = override.find(x => c.startsWith(x.c));
    const r = { commit: c.slice(0, 12), date: o ? o.date : d, path: p };
    if (o) { r.range = o.range; r.label = `${o.range} (dated ${o.date})`; } else r.label = d;
    if (fr.approx) { r.approx = true; r.label += ' (approx.)'; }
    if (r.date > fr.date && !fr.date_range) throw new Error(`file change after its frame: ${key} ${r.date} > ${fr.date}`);
    gitCache.set(key, r);
  }
  return gitCache.get(key);
}
const stopFiles = st => st.map(s => fileChange(s[0], pathAt.get(s[0] + ':' + s[1])));
const originFile = (id, o) => F.frames[o].virtual ? { label: '2005-2008', date: '2005-2008' } : (originPath.has(id) || originNormPath.has(id)) ? fileChange(o, originPath.get(id) || originNormPath.get(id)) : null;
// thin the stops: per lane first, last, marked (fork / tag / pin) frames, then evenly spaced, at most `max` in time order
function thin(st, max = 10) {
  const by = new Map(); for (const s of st) { const l = laneOf(s[0]); if (!by.has(l)) by.set(l, []); by.get(l).push(s); }
  const keep = new Set();
  for (const a of by.values()) { keep.add(a[0]); keep.add(a.at(-1)); }
  for (const s of st) if (keep.size < max && marks.has(s[0]) && marks.get(s[0]).kinds.some(k => k === 'fork' || k === 'import')) keep.add(s);
  const rest = st.filter(s => !keep.has(s)); for (let i = 0; keep.size < max && rest.length && i < 40; i++) keep.add(rest[Math.floor((i * 0.618 % 1) * rest.length)]);
  return [...keep].sort((a, b) => F.frames[a[0]].date.localeCompare(F.frames[b[0]].date) || a[0] - b[0]).slice(0, Math.max(max, by.size * 2));
}
const out = { format: 1, note: 'attract-mode list: tools/attract_prep.mjs', items: [] };
items.forEach((it, k) => {
  const id = it.id, o = origin[id], of = F.frames[o];
  const lanes = [...Array(F.lanes.length).keys()].filter(li => (laneM[id] >> li) & 1).map(li => F.lanes[li].name);
  out.items.push({ kind: 'line', id, text: text[id].replace(/\t/g, '    ').trim().slice(0, 160), curated: !!it.curated, picked: !!it.picked, unique: new Set(stops[k].map(s => laneOf(s[0]))).size === 1 /* present (in any form) in one lane only */, note: it.note || null,
    origin: o, origin_lane: of.virtual ? 'nullDC-pre2008' : of.lane, origin_frame_date: of.virtual ? '2005-2008' : of.date, origin_file: originFile(id, o), frames: nFr[id], lanes,
    stops: thin(stops[k]) });
  const L = out.items.at(-1); L.stop_files = stopFiles(L.stops);
});
segs.forEach((g, k) => {
  const st = segStops[k]; if (!st.length) { console.warn('segment without stops:', g.title); return; }
  const lanes = [...new Set(st.map(s => laneOf(s[0])))];
  let a = g.ids[segAnchor[k]];
  if ((origin[a] < 0 || (!originPath.has(a) && !originNormPath.has(a) && !F.frames[origin[a]].virtual)) && segAnchor2[k] !== undefined) { console.warn(`segment "${g.title}": anchor ${JSON.stringify(text[a].trim())} has no origin (trivial line) or is not in its origin frame; first seen from ${JSON.stringify(text[segAnchor2[k]].trim().slice(0, 60))}`); a = segAnchor2[k]; }
  const o = origin[a], of = F.frames[o];
  out.items.push({ kind: 'segment', title: g.title, note: g.note || null, curated: true, picked: true, unique: lanes.length === 1, n: g.ids.length, ids: g.ids, marks: [...new Set(g.ids.filter(x => (text[x] || '').trim().length > 8))],   // short generic lines (break;, };, else) repeat elsewhere: not highlighted
    code: g.ids.map(x => (text[x] || '').replace(/\t/g, '    ').trimEnd().slice(0, 120)).join('\n'),
    origin: o, origin_lane: of.virtual ? 'nullDC-pre2008' : of.lane, origin_frame_date: of.virtual ? '2005-2008' : of.date, origin_file: originFile(a, o), frames: st.length, lanes, stops: thin(st) });
  const L = out.items.at(-1); L.stop_files = stopFiles(L.stops);
});
famous.forEach((fm, k) => {
  if (!fileStops[k].length) return;
  const st = fileStops[k], lanes = [...new Set(st.map(s => laneOf(s[0])))];
  // first in time, not first in lane order (fileStops is filled lane by lane)
  const s0 = st.reduce((a, b) => (dateOf(b[0]).localeCompare(dateOf(a[0])) || b[0] - a[0]) < 0 ? b : a);
  out.items.push({ kind: 'file', title: fm.title, frames: st.length, lanes, first_frame_date: dateOf(s0[0]), first_file: fileChange(s0[0], pathAt.get(s0[0] + ':' + s0[1])), stops: thin(st) });
  const L = out.items.at(-1); L.stop_files = stopFiles(L.stops);
});
const noOrigin = out.items.filter(i => i.kind !== 'file' && !i.origin_file);
if (noOrigin.length) console.warn(`${noOrigin.length} items: the origin frame holds no file with the line (origin_file null)`);
console.log(`file last-change dates: ${gitN} git queries`);
fs.writeFileSync(D('attract.json'), JSON.stringify(out));
console.log(out.items.map(i => `${i.kind} ${i.frames} frames, ${i.lanes.length} lanes, ${i.stops.length} stops: ${i.text || i.title}`).join('\n'));

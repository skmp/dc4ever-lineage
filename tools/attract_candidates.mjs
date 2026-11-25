#!/usr/bin/env node
// attract_candidates.mjs: mine tour candidates for curation -> agents/attract/{lines,segs}.jsonl
// lines: distinctive single lines that survive and spread (looser than attract_prep's auto pick), with 2 lines of context.
// segs:  code segments (functions, blocks, comment runs) whose lines all travel together: runs of consecutive lines in a
//        lane's last frame where every non-trivial line is held by >= 2 lanes and >= 12 frames; scored by the lanes that
//        hold every line, length and frames.
//   node tools/attract_candidates.mjs   (reads data/, about 20 s)
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as core from '../viewer/src/core.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), D = p => path.join(ROOT, 'data', p);
const OUT = path.join(ROOT, 'agents/attract'); fs.mkdirSync(OUT, { recursive: true });
const F = JSON.parse(fs.readFileSync(D('frames.json')));
const meta = zlib.gunzipSync(fs.readFileSync(D('linemeta.bin.gz')));
const text = []; for (let c = 0; c < F.text_chunks; c++) text.push(...zlib.gunzipSync(fs.readFileSync(D(`text/lines-${String(c).padStart(3, '0')}.txt.gz`))).toString('utf8').split('\n').slice(0, F.chunk_lines));
const N = F.raw_lines, nFr = new Uint16Array(N), laneM = new Uint32Array(N), last = new Int16Array(N).fill(-1), origin = new Int16Array(N).fill(-1);
function* laneFrames(li) {
  let st = null; const lane = F.lanes[li];
  for (let c = 0; c < lane.chunks.length; c++) {
    const p = D(`lanes/${lane.name}/c${String(c).padStart(3, '0')}`);
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(p + '.json.gz'))), bin = new Uint8Array(zlib.gunzipSync(fs.readFileSync(p + '.bin.gz')));
    for (const fr of core.decodeChunk(j, bin)) { st = core.applyFrame(st, fr); yield [fr.f, st]; }
  }
}
const lastState = [];
for (let li = 0; li < F.lanes.length; li++) { let ls = null;
  for (const [f, st] of laneFrames(li)) { ls = [f, st];
    for (const [, file] of st) { const ids = file.ids, kp = file.kp, og = file.og;
      for (let l = 0; l < ids.length; l++) { if (kp[l] === 0xFFFF) continue; const id = ids[l];
        if (last[id] !== f) { last[id] = f; nFr[id]++; laneM[id] |= 1 << li; if (origin[id] < 0 || og[l] < origin[id]) origin[id] = og[l]; } } } }
  lastState.push(ls); }
const pop = x => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
const lanesOf = m => F.lanes.filter((_, li) => (m >> li) & 1).map(l => l.name);
const isComment = id => (meta[2 * id + 1] >> 7) & 1;
const orig = id => { const o = origin[id], of = F.frames[o]; return of ? (of.virtual ? 'nullDC-pre2008 2005-2008' : `${of.lane} ${of.date}`) : '?'; };
const trivial = t => /^[\s{}();]*$/.test(t);
const NOISE = /MERCHANTAB|WITHOUT ANY|GNU General|Free Software Foundation|SPDX|Permission is hereby|copyright|license/i;
// ---- lines
const lines = [], seenT = new Set();
for (let id = 0; id < N; id++) {
  if (nFr[id] < 8 || pop(laneM[id]) < 2) continue; const t = (text[id] || '').replace(/\t/g, '    ').trim();
  if (t.length < 16 || NOISE.test(t) || seenT.has(t) || /^#\s*(include|define|endif|pragma|if|else)/.test(t)) continue;
  const voice = isComment(id) || /"[^"]{6,}"/.test(t); if (!voice) continue;
  seenT.add(t); lines.push({ id, s: pop(laneM[id]) * 3 + Math.log2(1 + nFr[id]) + (/[!?:;][)(DPp]|xD|lol|hack|fixme|todo|wtf|ugly|magic|why|evil|dirty|shit|damn|crap|sega|hmm/i.test(t) ? 3 : 0) });
}
lines.sort((a, b) => b.s - a.s);
// context: where the line sits in some lane's last frame
const where = new Map(); for (const [f, st] of lastState) for (const [ident, file] of st) for (let l = 0; l < file.ids.length; l++) { const id = file.ids[l]; if (!where.has(id)) where.set(id, [f, ident, l, file]); }
const LN = Math.min(lines.length, 2400);
const lw = fs.createWriteStream(path.join(OUT, 'lines.jsonl'));
for (const { id } of lines.slice(0, LN)) { const w = where.get(id); let ctx = null, p = null;
  if (w) { const [, , l, file] = w; p = file.path; ctx = [-2, -1, 1, 2].map(d => file.ids[l + d]).map(x => x === undefined ? '' : (text[x] || '').replace(/\t/g, '    ').trimEnd()); }
  lw.write(JSON.stringify({ id, text: text[id].replace(/\t/g, '    ').trim(), path: p, before: ctx && ctx.slice(0, 2), after: ctx && ctx.slice(2), origin: orig(id), frames: nFr[id], lanes: lanesOf(laneM[id]) }) + '\n'); }
lw.end();
// ---- segments
const segs = [], seenS = new Set();
const shared = id => !!id && pop(laneM[id]) >= 2 && nFr[id] >= 12;
for (const [f, st] of lastState) for (const [ident, file] of st) {
  const ids = file.ids; let a = 0;
  while (a < ids.length) {
    if (!shared(ids[a]) || trivial(text[ids[a]] || '')) { a++; continue; }
    let b = a; while (b + 1 < ids.length && (shared(ids[b + 1]) || trivial(text[ids[b + 1]] || ''))) b++;
    // cut long runs into pieces at top-level closing braces / blank lines, 5..40 lines each
    let s = a;
    for (let i = a; i <= b; i++) { const t = text[ids[i]] || '';
      const end = i === b || (i - s >= 4 && (/^\}/.test(t) || (i - s >= 25 && t.trim() === ''))) || i - s >= 39;
      if (end) { const seg = Array.from(ids.slice(s, i + 1)); while (seg.length && trivial(text[seg.at(-1)] || '') && !/^\}/.test(text[seg.at(-1)] || '')) seg.pop();
        const nt = seg.filter(x => !trivial(text[x] || ''));
        if (nt.length >= 4 && nt.filter(x => /^\s*#|^\s*(extern|typedef|using)\b/.test(text[x] || '')).length * 2 < nt.length) { const body = seg.map(x => (text[x] || '').replace(/\t/g, '    ').trimEnd()).join('\n'); const key = body.replace(/\s+/g, ' ');
          if (!seenS.has(key) && !NOISE.test(body)) { seenS.add(key);
            const m = nt.reduce((acc, x) => acc & laneM[x], 0xFFFFFFFF), minF = Math.min(...nt.map(x => nFr[x])), nl = pop(m);
            if (nl >= 2) segs.push({ f, ident, line: s, n: seg.length, ids: seg, body, path: file.path, lanesAll: m, minF, com: nt.filter(isComment).length,
              s: nl * 3 + Math.log2(1 + minF) + Math.log2(nt.length) * 2 + (nt.some(isComment) ? 2 : 0) }); } }
        s = i + 1; } }
    a = b + 1;
  }
}
segs.sort((x, y) => y.s - x.s);
const SN = Math.min(segs.length, 1600);
const sw = fs.createWriteStream(path.join(OUT, 'segs.jsonl'));
segs.slice(0, SN).forEach((g, k) => sw.write(JSON.stringify({ sid: k, frame: g.f, lane: F.frames[g.f].lane, ident: g.ident, line: g.line, n: g.n, path: g.path, origin: orig(g.ids.find(x => !trivial(text[x] || ''))), min_frames: g.minF, lanes: lanesOf(g.lanesAll), ids: g.ids, body: g.body }) + '\n'));
sw.end();
// ---- unique: lines and segments held by exactly one lane (one lineage), long-lived within it
// long-lived: in >= 6 frames, or in every frame of a lane with fewer (young lanes such as nullDC4WiiU / HarissaDC)
const laneN = F.lanes.map(l => l.frames.length), uMin = m => Math.min(6, laneN[31 - Math.clz32(m)]);
const ul = [], seenU = new Set();
for (let id = 0; id < N; id++) {
  if (pop(laneM[id]) !== 1 || nFr[id] < uMin(laneM[id])) continue; const t = (text[id] || '').replace(/\t/g, '    ').trim();
  if (t.length < 16 || NOISE.test(t) || seenU.has(t) || /^#\s*(include|define|endif|pragma|if|else)/.test(t)) continue;
  if (!(isComment(id) || /"[^"]{6,}"/.test(t))) continue;
  seenU.add(t); ul.push({ id, s: Math.log2(1 + nFr[id]) + (/[!?:;][)(DPp]|xD|lol|hack|fixme|todo|wtf|ugly|magic|why|evil|dirty|shit|damn|crap|sega|hmm/i.test(t) ? 3 : 0) + Math.min(3, t.length / 30) });
}
ul.sort((a, b) => b.s - a.s);
const byLane = new Map(); for (const u of ul) { const ln = lanesOf(laneM[u.id])[0]; if (!byLane.has(ln)) byLane.set(ln, []); byLane.get(ln).push(u); }
const ULN = [...byLane.values()].flatMap(a => a.slice(0, 120));   // up to 120 per lane, so small lanes are represented
const uw = fs.createWriteStream(path.join(OUT, 'uniq_lines.jsonl'));
for (const { id } of ULN) { const w = where.get(id); let ctx = null, p = null;
  if (w) { const [, , l, file] = w; p = file.path; ctx = [-2, -1, 1, 2].map(d => file.ids[l + d]).map(x => x === undefined ? '' : (text[x] || '').replace(/\t/g, '    ').trimEnd()); }
  uw.write(JSON.stringify({ id, text: text[id].replace(/\t/g, '    ').trim(), path: p, before: ctx && ctx.slice(0, 2), after: ctx && ctx.slice(2), origin: orig(id), frames: nFr[id], lanes: lanesOf(laneM[id]) }) + '\n'); }
uw.end();
const us = [], seenUS = new Set(), uniq = id => !!id && pop(laneM[id]) === 1 && nFr[id] >= uMin(laneM[id]);
for (const [f, st] of lastState) for (const [ident, file] of st) {
  const ids = file.ids; let a = 0;
  while (a < ids.length) {
    if (!uniq(ids[a]) || trivial(text[ids[a]] || '')) { a++; continue; }
    let b = a; while (b + 1 < ids.length && (uniq(ids[b + 1]) || trivial(text[ids[b + 1]] || ''))) b++;
    let s = a;
    for (let i = a; i <= b; i++) { const t = text[ids[i]] || '';
      const end = i === b || (i - s >= 4 && (/^\}/.test(t) || (i - s >= 25 && t.trim() === ''))) || i - s >= 39;
      if (end) { const seg = Array.from(ids.slice(s, i + 1)); while (seg.length && trivial(text[seg.at(-1)] || '') && !/^\}/.test(text[seg.at(-1)] || '')) seg.pop();
        const nt = seg.filter(x => !trivial(text[x] || ''));
        if (nt.length >= 4 && nt.filter(x => /^\s*#|^\s*(extern|typedef|using)\b/.test(text[x] || '')).length * 2 < nt.length) { const body = seg.map(x => (text[x] || '').replace(/\t/g, '    ').trimEnd()).join('\n'); const key = body.replace(/\s+/g, ' ');
          if (!seenUS.has(key) && !NOISE.test(body)) { seenUS.add(key); const minF = Math.min(...nt.map(x => nFr[x]));
            us.push({ f, ident, line: s, n: seg.length, ids: seg, body, path: file.path, lane: F.frames[f].lane, minF, s: Math.log2(1 + minF) + Math.log2(nt.length) * 2 + (nt.some(isComment) ? 2 : 0) }); } }
        s = i + 1; } }
    a = b + 1;
  }
}
us.sort((x, y) => y.s - x.s);
const byLaneS = new Map(); for (const u of us) { if (!byLaneS.has(u.lane)) byLaneS.set(u.lane, []); byLaneS.get(u.lane).push(u); }
const USN = [...byLaneS.values()].flatMap(a => a.slice(0, 60));
const usw = fs.createWriteStream(path.join(OUT, 'uniq_segs.jsonl'));
USN.forEach((g, k) => usw.write(JSON.stringify({ sid: 'u' + k, frame: g.f, lane: g.lane, ident: g.ident, line: g.line, n: g.n, path: g.path, origin: orig(g.ids.find(x => !trivial(text[x] || ''))), min_frames: g.minF, lanes: [g.lane], ids: g.ids, body: g.body }) + '\n'));
usw.end();
console.log(`unique lines: ${ul.length} eligible, wrote ${ULN.length}; unique segments: ${us.length} eligible, wrote ${USN.length}`);
console.log(`lines: ${lines.length} eligible, wrote ${LN}; segments: ${segs.length} eligible, wrote ${SN} -> agents/attract/`);

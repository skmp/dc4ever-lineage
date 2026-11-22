#!/usr/bin/env node
// check_data.mjs: DESIGN 7.1 data / layout checks using viewer/src/core.js (the code the viewer runs).
//   node tools/verify/check_data.mjs     -> agents/verify/data-checks.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as core from '../../viewer/src/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const D = path.join(ROOT, 'data');
const gz = f => zlib.gunzipSync(fs.readFileSync(path.join(D, f)));
const man = JSON.parse(fs.readFileSync(path.join(D, 'manifest.json')));
const layout = JSON.parse(gz('layout.json.gz'));
const diffs = JSON.parse(fs.readFileSync(path.join(D, 'diffs.json')));
const NS = man.snapshots.length, CH = man.chunk_lines;
const results = []; const t0 = Date.now();
const check = (name, pass, numbers) => { results.push({ name, pass, ...numbers }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(numbers)}`); };

// text: raw lines, norm ids, linemeta
const rawLines = []; // Buffer slices
for (let c = 0; c < man.text_chunks; c++) {
  const b = gz(`text/lines-${String(c).padStart(3, '0')}.txt.gz`);
  let a = 0; const cnt = Math.min(CH, man.raw_lines - c * CH);
  for (let i = 0; i < cnt; i++) { let e = b.indexOf(10, a); if (e < 0) e = b.length; rawLines.push(b.subarray(a, e)); a = e + 1; }
}
const norm = new Uint32Array(man.raw_lines), nmap = new Map(), blank = [];
for (let i = 0; i < rawLines.length; i++) {
  const k = core.normKey(rawLines[i], 0, rawLines[i].length);
  let v = nmap.get(k); if (v === undefined) { v = nmap.size; nmap.set(k, v); blank.push(k.length === 0 ? 1 : 0); }
  norm[i] = v;
}
check('norm line count equals manifest', nmap.size === man.norm_lines, { norm: nmap.size, manifest: man.norm_lines });
const blankNorm = Uint8Array.from(blank);

// folding vs linemeta
const meta = gz('linemeta.bin.gz');
{ let bad = 0, badBox = 0; const out = new Uint8Array(4096);
  const rnd = mulberry(1); const N = 10000;
  for (let t = 0; t < N; t++) {
    const i = Math.floor(rnd() * rawLines.length), r = rawLines[i];
    const n = core.foldInto(r, 0, r.length, out, 0, 4096);
    if (Math.min(127, n) !== (meta[2 * i + 1] & 127)) bad++;
    const s = r.toString('utf8'); let cp = 0; for (const ch of s) if (ch.codePointAt(0) >= 0x80) cp++;
    let box = 0; for (let q = 0; q < Math.min(n, 4096); q++) if (out[q] === 0x7F) box++;
    if (box !== cp && !s.includes('�')) badBox++;
  }
  check('fold length equals linemeta (10k random lines)', bad === 0, { mismatches: bad });
  check('0x7F boxes equal non-ASCII code points (valid UTF-8 lines)', badBox === 0, { mismatches: badBox });
}

// walls: placement completeness, overlaps, streets
const snapJ = [], dec = [], walls = [];
const slotMaps = layout.lanes.map(l => core.laneSlotMap(l));
let placed = 0, overlaps = 0, outOfLane = 0;
for (let s = 0; s < NS; s++) {
  const j = JSON.parse(gz(`snap/${String(s).padStart(2, '0')}.json.gz`));
  const d = core.decodeSnapBin(gz(`snap/${String(s).padStart(2, '0')}.bin.gz`), j);
  const lw = layout.walls[s], lane = layout.lanes[lw.lane];
  const w = core.buildWall(j, d, lane, slotMaps[lw.lane], man.snapshots[s].anc, s);
  snapJ.push(j); dec.push(d); walls.push(w);
  placed += d.n;
  for (let i = 1; i < d.n; i++) if (w.P[i] <= w.P[i - 1]) overlaps++;
  if (d.n && w.P[d.n - 1] >= lane.cols * core.H) outOfLane++;
}
check('every line placed once (sum = 4,092,201)', placed === 4092201, { placed });
check('no two lines of a wall share a cell', overlaps === 0, { overlaps });
check('all lines inside their lane columns', outOfLane === 0, { walls_out: outOfLane });
{ let bad = 0, slotsN = 0;
  for (const l of layout.lanes) {
    const sl = l.slots.map(s => [s[2] * core.H + s[3], s[2] * core.H + s[3] + core.HDR + s[4] + core.GAP]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sl.length; i++) if (sl[i][0] < sl[i - 1][1]) bad++;
    for (const s of sl) if (s[1] > l.cols * core.H) bad++;
    slotsN += sl.length;
  }
  check('slots do not overlap and stay inside the lane', bad === 0, { slots: slotsN, bad });
}
{ // streets: every identity has one slot per lane, so each wall of the lane places it at the same L
  let moved = 0, total = 0, shifted = 0;
  for (let li = 0; li < layout.lanes.length; li++) {
    const lane = layout.lanes[li]; const seen = new Map();
    for (const s of lane.snaps) {
      const j = snapJ[s], w = walls[s], ordc = new Map();
      j.files.forEach((f, k) => { const o = ordc.get(f.id) || 0; ordc.set(f.id, o + 1); const key = f.id * 65536 + o;
        total++; if (seen.has(key) && seen.get(key) !== w.fileL[k]) moved++; seen.set(key, w.fileL[k]); });
    }
    if (lane.parent) { // fork ribbons: lateral shift in columns between the parent lane's slot and the child's
      const pl = layout.lanes.find(x => x.name === lane.parent), pm = slotMaps[layout.lanes.indexOf(pl)];
      for (const [key, L] of seen) { const p = pm.get(key); if (p && Math.abs(Math.floor(p.L / core.H) - Math.floor(L / core.H)) > 2) shifted++; }
    }
  }
  check('streets: same slot for an identity in every wall of its lane', moved === 0, { files: total, moved });
  results.push({ name: 'fork ribbons with lateral shift > 2 columns (info)', pass: true, shifted });
  console.log('INFO fork ribbons shifted > 2 columns:', shifted);
}

// decoder parity vs tools/prov_query.py: 500 random lines + spot checks
{ const rnd = mulberry(42); const picks = [];
  const byOrigin = new Map();
  for (let s = 0; s < NS; s++) for (let i = 0; i < dec[s].n; i += 97) { const o = dec[s].og[i]; if (!byOrigin.has(o)) byOrigin.set(o, []); byOrigin.get(o).push([s, i]); }
  const origins = [...byOrigin.keys()];
  while (picks.length < 500) { const o = origins[Math.floor(rnd() * origins.length)], arr = byOrigin.get(o); picks.push(arr[Math.floor(rnd() * arr.length)]); }
  const q = picks.map(([s, i]) => { const w = walls[s], j = snapJ[s];
    let k = 0; while (k + 1 < j.files.length && w.srcOff[k + 1] <= i) k++;
    // viewer path: instance -> (file, line) -> text/origin/keep
    const inst = w.posBySrc ? null : null; void inst;
    return { s, sid: man.snapshots[s].id, p: j.files[k].p, line: i - w.srcOff[k] + 1, k, i }; });
  const py = `import sys, json; sys.path.insert(0, 'tools')\nfrom prov_query import man, snap, text\nimport functools\nsn = functools.lru_cache(None)(snap)\nout = []\nfor sid, p, line in json.load(sys.stdin):\n    i, j, ids, og, kp = sn(sid)\n    f = next(f for f in j['files'] if f['p'] == p)\n    k = f['off'] + line - 1\n    out.append([text(ids[k]), og[k], kp[k]])\nprint(json.dumps(out))`;
  const res = JSON.parse(execFileSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(q.map(x => [x.sid, x.p, x.line])), maxBuffer: 1 << 26 }).toString());
  let bad = 0; const td = new TextDecoder();
  q.forEach((x, n) => {
    // viewer route: find the instance at the file's slot position + line, decode w0/w1
    const w = walls[x.s], k = x.k, j = w.fileStart[k] + x.line - 1;
    const w0 = w.inst[2 * j], w1 = w.inst[2 * j + 1];
    const id = w0 & 0xFFFFF, o = (w0 >>> 20) & 63, kp = (w1 >>> 23) & 63;
    const t = td.decode(rawLines[id]);
    const [pt, po, pk] = res[n];
    if (t !== pt || o !== po || (pk === 255 ? 63 : Math.min(62, pk)) !== kp) bad++;
  });
  check('decoder parity with prov_query.py (500 lines, stratified by origin)', bad === 0, { mismatches: bad });
  // spot checks
  const sc = fs.readFileSync(path.join(ROOT, 'agents/provenance/spotcheck.txt'), 'utf8').split('\n### ').slice(0);
  let n = 0, sbad = 0;
  for (const blk of sc) {
    const m = blk.match(/^(?:### )?(\S+) (.+):(\d+)\ntext\s*: .*\ntool\s*: origin=(\S+) keep=(\d+)/); if (!m) continue;
    const s = man.snapshots.findIndex(x => x.id === m[1]); if (s < 0) continue;
    const j = snapJ[s], k = j.files.findIndex(f => f.p === m[2]); if (k < 0) { sbad++; continue; }
    const w = walls[s], jj = w.fileStart[k] + (+m[3]) - 1;
    const o = (w.inst[2 * jj] >>> 20) & 63; n++;
    if (man.origins[o] !== m[4]) sbad++;
  }
  check('spot-check lines give the same origins', sbad === 0 && n >= 15, { checked: n, mismatches: sbad });
}

// morph accounting vs diffs.json
{ const pairs = [];
  for (let s = 0; s < NS; s++) for (const p of man.snapshots[s].parents.slice(0, 1)) pairs.push([p, s]);
  const rnd = mulberry(9); while (pairs.length < 39 + 10) { const a = Math.floor(rnd() * NS), b = Math.floor(rnd() * NS); if (a !== b) pairs.push([a, b]); }
  let bad = 0; const bads = []; const tm = Date.now();
  for (const [a, b] of pairs) {
    const r = core.buildMorph({ json: snapJ[a], dec: dec[a], wall: walls[a] }, { json: snapJ[b], dec: dec[b], wall: walls[b] }, norm, blankNorm);
    const K = diffs.kept[a][b], A = diffs.lines[b] - K, R = diffs.lines[a] - K;
    if (r.kept !== K || r.added !== A || r.removed !== R) { bad++; bads.push({ a, b, got: [r.kept, r.added, r.removed], want: [K, A, R] }); }
  }
  check(`morph kept/added/removed equal diffs.json (${pairs.length} pairs)`, bad === 0, { pairs: pairs.length, mismatches: bad, ms_per_pair: Math.round((Date.now() - tm) / pairs.length), bads: bads.slice(0, 5) });
}

fs.mkdirSync(path.join(ROOT, 'agents/verify'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'agents/verify/data-checks.json'), JSON.stringify({ date: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, results }, null, 1));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// decode every lane with viewer/src/core.js, compare per-frame line / file counts with frames.json, time it
import fs from 'node:fs'; import zlib from 'node:zlib';
import * as core from '../../viewer/src/core.js';
const F = JSON.parse(fs.readFileSync('data/frames.json'));
const L = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/layout.json.gz')));
let bad = 0, inst = 0; const t0 = Date.now(); let mt = 0, nm = 0, wt = 0;
for (const [li, lane] of F.lanes.entries()) {
  const slots = core.laneSlots(L.lanes[li]), rel = core.relatedMask(F, li);
  let st = null, prevK = -1, meta = new Map();
  for (let c = 0; c < lane.chunks.length; c++) {
    const p = `data/lanes/${lane.name}/c${String(c).padStart(3, '0')}`;
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(p + '.json.gz'))), bin = new Uint8Array(zlib.gunzipSync(fs.readFileSync(p + '.bin.gz')));
    for (const fr of core.decodeChunk(j, bin)) {
      const prev = st; st = core.applyFrame(st, fr); meta = core.applyMeta(meta, j.frames.find(x => x.f === fr.f));
      let n = 0; for (const f of st.values()) n += f.ids.length; inst += n;
      const R = F.frames[fr.f];
      if (n !== R.lines || st.size !== R.files || meta.size !== R.files) { bad++; if (bad < 5) console.log('mismatch', lane.name, fr.f, n, R.lines, st.size, R.files, meta.size); }
      const a = Date.now(); const w = core.buildWall(st, slots, L.lanes[li].cols, rel); wt += Date.now() - a;
      if (w.colStart[L.lanes[li].cols] !== n) { bad++; console.log('colStart', fr.f); }
      if (prev && nm < 60) { const b = Date.now(); const m = core.buildMorph(prev, st, slots); mt += Date.now() - b; nm++;
        let add = 0; for (const f of st.values()) if (f.add) for (const x of f.add) add += x;
        if (m.added !== add) { /* added counts include whitespace lines; report only */ } }
    }
  }
}
console.log({ bad, inst, ms: Date.now() - t0, wallMs: wt, morphMsAvg: (mt / Math.max(1, nm)).toFixed(1) });

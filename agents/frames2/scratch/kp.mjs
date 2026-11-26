import fs from 'node:fs'; import zlib from 'node:zlib';
import * as core from '../../../viewer/src/core.js';
const D = p => 'data/' + p, F = JSON.parse(fs.readFileSync(D('frames.json')));
const li = F.lanes.findIndex(l => l.name === process.argv[2]), lane = F.lanes[li], want = +process.argv[3];
let st = null;
for (let c = 0; c < lane.chunks.length; c++) {
  const p = D(`lanes/${lane.name}/c${String(c).padStart(3, '0')}`);
  const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(p + '.json.gz'))), bin = new Uint8Array(zlib.gunzipSync(fs.readFileSync(p + '.bin.gz')));
  for (const fr of core.decodeChunk(j, bin)) { st = core.applyFrame(st, fr);
    if (fr.f === want) { let bad = 0; for (const [id, f] of st) for (let l = 0; l < f.kp.length; l++) if (f.kp[l] !== 0xFFFF && f.kp[l] > 1240) { if (bad++ < 5) console.log(f.path, l, f.ids[l].toString(16), f.og[l], f.kp[l]); } console.log('bad', bad); process.exit(); } }
}

// every wall's x reads back as its frame's month on the clock (core.js timeMaps)
import fs from 'fs'; import zlib from 'zlib'; import { timeMaps } from '../../../../viewer/src/core.js';
const L = JSON.parse(zlib.gunzipSync(fs.readFileSync('data/layout.json.gz'))), F = JSON.parse(fs.readFileSync('data/frames.json'));
const tm = timeMaps(L); let bad = 0, n = 0;
for (const w of L.walls) { const f = F.frames[w.frame]; n++;
  if (tm.dateOfMonth(tm.monthOfX(w.x)) !== f.date.slice(0, 7)) { bad++; console.log(f.lane, f.date, w.x, tm.dateOfMonth(tm.monthOfX(w.x))); } }
console.log(`${n} walls, ${bad} clock mismatches`);

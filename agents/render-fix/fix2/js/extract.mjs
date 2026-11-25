// node extract.mjs OUT.txt DIR: shots -> DIR/*.jpg, log -> DIR/log.json, one summary line per shot
import fs from 'node:fs'; import path from 'node:path';
const [, , inp, dir] = process.argv; const txt = fs.readFileSync(inp, 'utf8');
const a = txt.indexOf('{'), b = txt.lastIndexOf('\n}'); const r = JSON.parse(txt.slice(a, b + 2));
fs.mkdirSync(dir, { recursive: true });
for (const [k, v] of Object.entries(r.shots || {})) fs.writeFileSync(path.join(dir, k + '.jpg'), Buffer.from(v.split(',')[1], 'base64'));
delete r.shots; fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(r, null, 1));
for (const l of r.log) console.log(l.name, l.pres, 'q' + l.q, 'walls', l.walls, 't3area', l.t3area, 'titles', l.leaks.titles, 'leaking', l.leaks.leaking, 'labels', l.labels, 'gpu', l.gpu_ms, 'cpu', l.cpu_ms, JSON.stringify(l.stats), '\n   ', JSON.stringify(l.classes), l.extra ? JSON.stringify(l.extra) : '');
for (const [k, v] of Object.entries(r)) if (k !== 'log') console.log(k, JSON.stringify(v));

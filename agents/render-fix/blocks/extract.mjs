// node extract.mjs OUT.txt DIR: pull the JSON result from a run.mjs eval log, write shots as .jpg and the log as .json
import fs from 'node:fs'; import path from 'node:path';
const [, , inp, dir] = process.argv; const txt = fs.readFileSync(inp, 'utf8');
const a = txt.indexOf('{'), b = txt.lastIndexOf('\n}'); const r = JSON.parse(txt.slice(a, b + 2));
fs.mkdirSync(dir, { recursive: true });
for (const [k, v] of Object.entries(r.shots || {})) fs.writeFileSync(path.join(dir, k + '.jpg'), Buffer.from(v.split(',')[1], 'base64'));
fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(r.log, null, 1));
for (const l of r.log) console.log(l.name, l.pres, 'q', l.q, 'walls', l.walls, JSON.stringify(l.stats), '\n   ', JSON.stringify(l.classes));

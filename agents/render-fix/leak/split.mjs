import fs from 'fs';
const [, , inp, dir] = process.argv; const t = fs.readFileSync(inp, 'utf8'); const a = t.indexOf('['), b = t.lastIndexOf(']');
const r = JSON.parse(t.slice(a, b + 1)); const sum = [];
for (const s of r) { fs.writeFileSync(`${dir}/${s.name}.png`, Buffer.from(s.png.split(',')[1], 'base64')); delete s.png; sum.push(s); }
fs.writeFileSync(`${dir}/summary-${inp.split('/').pop()}.json`, JSON.stringify(sum, null, 1));
for (const s of sum) { console.log(`== ${s.name} pres=${s.pres} cam=${s.cam} titles=${s.titles.length} leaking=${s.titles.filter(x => x.leakFrac > 0).length}`);
  for (const x of s.titles.filter(x => x.leakFrac > 0)) console.log('   ', x.leakFrac, x.sticky ? 'STICKY' : '', x.solid ? 'solid' : 'ghost', x.title, x.rect.join(','), 'behind', x.behind.join(' ')); }

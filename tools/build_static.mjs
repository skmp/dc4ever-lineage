#!/usr/bin/env node
// build_static.mjs: the public static build -> dist/ (FOLLOWUP: published later at nulldc.emudev.org/lineage/).
// Copies viewer/index.html + viewer/src/*.js and the data the viewer reads (data/: frames, lanes, text, font, layout,
// linemeta, identities, story, attract). Everything is addressed by relative paths, so dist/ works from any directory
// of any static host (or a file server); no server endpoint is used. The dev-only recording variant of the benchmark
// (the code between DEV-BEGIN / DEV-END markers in viewer/src) is removed, and the build fails if any of it survives.
//   node tools/build_static.mjs [outdir]        (default dist/; about 1 s)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const DATA = ['frames.json', 'layout.json.gz', 'linemeta.bin.gz', 'identities.json.gz', 'story.json', 'attract.json', 'font', 'lanes', 'text'];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'src'), { recursive: true });
const strip = s => s.replace(/\/\*\s*DEV-BEGIN[\s\S]*?DEV-END\s*\*\//g, '');
let bytes = 0, files = 0;
const put = (rel, buf) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); bytes += buf.length; files++; };
put('index.html', fs.readFileSync(path.join(ROOT, 'viewer/index.html')));
for (const f of fs.readdirSync(path.join(ROOT, 'viewer/src'))) {
  if (!f.endsWith('.js')) continue;
  const s = strip(fs.readFileSync(path.join(ROOT, 'viewer/src', f), 'utf8'));
  if (/DEV-BEGIN|DEV-END|__report|devRecord/.test(s)) throw new Error(`dev-only code left in ${f}`);
  put('src/' + f, Buffer.from(s));
}
const copy = (rel) => { const src = path.join(ROOT, 'data', rel), st = fs.statSync(src);
  if (st.isDirectory()) { for (const f of fs.readdirSync(src)) copy(path.join(rel, f)); return; }
  put(path.join('data', rel), fs.readFileSync(src)); };
for (const d of DATA) copy(d);
// absolute paths would break under /lineage/: refuse them in what the page loads
for (const f of ['index.html', ...fs.readdirSync(path.join(OUT, 'src')).map(f => 'src/' + f)]) {
  const s = fs.readFileSync(path.join(OUT, f), 'utf8');
  if (/(fetch|import|src=|href=)\s*\(?\s*['"`]\/(?!\/)/.test(s)) throw new Error(`absolute path in ${f}`);
}
console.log(`dist: ${files} files, ${(bytes / 1048576).toFixed(1)} MB -> ${path.relative(ROOT, OUT)}/`);

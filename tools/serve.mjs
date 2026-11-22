#!/usr/bin/env node
// serve.mjs: static server for the lineage viewer (no dependencies).
// Serves viewer/ at / and data/ at /data/. Binds 0.0.0.0 (WSL2 NAT does not forward localhost to Windows)
// and prints the URL at the WSL address. Sends COOP/COEP so SharedArrayBuffer works.
// POST /__report?name=<file> writes the JSON body to agents/verify/<file>.
//   node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || process.env.PORT || 8742);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

function resolve(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0]);
  let base = path.join(ROOT, 'viewer'), rel = p;
  if (p.startsWith('/data/')) { base = path.join(ROOT, 'data'); rel = p.slice(5); }
  const f = path.normalize(path.join(base, rel));
  if (!f.startsWith(base)) return null;
  return f.endsWith(path.sep) || rel === '/' ? path.join(f, 'index.html') : f;
}

const server = http.createServer((req, res) => {
  const h = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-cache' };
  if (req.method === 'POST' && req.url.startsWith('/__report')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'report.json').replace(/[^\w.\-]/g, '_');
    let body = []; req.on('data', d => body.push(d));
    req.on('end', () => {
      const dir = path.join(ROOT, 'agents', 'verify'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), Buffer.concat(body)); res.writeHead(200, h); res.end('ok');
    });
    return;
  }
  const f = resolve(req.url);
  if (!f) { res.writeHead(403, h); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, h); return res.end('not found'); }
    const ext = path.extname(f);
    // .gz files are served as opaque bytes (the viewer decompresses them): no Content-Encoding
    h['Content-Type'] = TYPES[ext] || 'application/octet-stream';
    h['Content-Length'] = st.size;
    res.writeHead(200, h);
    fs.createReadStream(f).pipe(res);
  });
});
server.listen(PORT, '0.0.0.0', () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  const wsl = addrs.find(a => !a.startsWith('172.17.')) || addrs[0] || '127.0.0.1';
  console.log(`nullDC lineage viewer on 0.0.0.0:${PORT}`);
  console.log(`open from Windows:  http://${wsl}:${PORT}/`);
  for (const a of addrs) if (a !== wsl) console.log(`  also:  http://${a}:${PORT}/`);
});

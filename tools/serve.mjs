#!/usr/bin/env node
// serve.mjs: static server for the lineage viewer (no dependencies).
// Serves viewer/ at / and data/ at /data/. Binds 0.0.0.0 (WSL2 NAT does not forward localhost to Windows)
// and prints the URL at the WSL address. Sends COOP/COEP.
// POST /__report?name=bench-<tag>-<A..E>.json stores a bench result (the page's ?bench=all run) in agents/verify/.
//   Only that name pattern, at most 4 MB of valid JSON per report and 200 report files; --no-report turns it off.
// The server listens on the network, so no request may take it down: every request is answered inside try/catch.
//   node tools/serve.mjs [port] [--no-report]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PORT = +(args.find(a => /^\d+$/.test(a)) || process.env.PORT || 8742);
const REPORTS = !args.includes('--no-report');
const REPORT_DIR = path.join(ROOT, 'agents', 'verify');
const REPORT_NAME = /^bench-[a-z0-9.-]{1,40}-[A-E]\.json$/, REPORT_MAX = 4 << 20, REPORT_FILES = 200;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const BASES = { viewer: path.join(ROOT, 'viewer'), data: path.join(ROOT, 'data') };

function resolve(url) {
  let p;
  try { p = decodeURIComponent(url.split('?')[0].split('#')[0]); } catch { return { status: 400 }; }   // malformed %-escape
  if (p.includes('\0') || !p.startsWith('/')) return { status: 400 };
  let base = BASES.viewer, rel = p;
  if (p === '/data' || p.startsWith('/data/')) { base = BASES.data; rel = p.slice(5) || '/'; }
  const f = path.normalize(path.join(base, rel));
  if (f !== base && !f.startsWith(base + path.sep)) return { status: 403 };
  return { file: rel.endsWith('/') ? path.join(f, 'index.html') : f };
}

const HDR = () => ({ 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
function reply(res, status, body = '', extra = {}) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { ...HDR(), 'Content-Type': 'text/plain; charset=utf-8', ...extra }); res.end(body);
}

function report(req, res) {
  if (!REPORTS) return reply(res, 403, 'reports are off (--no-report)\n');
  let name;
  try { name = new URL(req.url, 'http://x').searchParams.get('name') || ''; } catch { return reply(res, 400, 'bad url\n'); }
  if (!REPORT_NAME.test(name)) return reply(res, 400, 'name must match ' + REPORT_NAME + '\n');
  const len = +(req.headers['content-length'] || 0);
  if (len > REPORT_MAX) { reply(res, 413, 'too large\n'); req.destroy(); return; }
  const chunks = []; let n = 0, dead = false;
  req.on('data', d => { if (dead) return; n += d.length; if (n > REPORT_MAX) { dead = true; reply(res, 413, 'too large\n'); req.destroy(); } else chunks.push(d); });
  req.on('error', () => { dead = true; });
  req.on('end', () => {
    if (dead) return;
    try {
      const body = Buffer.concat(chunks); JSON.parse(body.toString('utf8'));
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      const f = path.join(REPORT_DIR, name);
      if (!fs.existsSync(f) && fs.readdirSync(REPORT_DIR).filter(x => REPORT_NAME.test(x)).length >= REPORT_FILES) return reply(res, 507, 'report limit reached\n');
      fs.writeFile(f, body, err => err ? reply(res, 500, 'write failed\n') : reply(res, 200, 'ok\n'));
    } catch (e) { reply(res, 400, 'body must be JSON\n'); }
  });
}

function serveFile(req, res) {
  const r = resolve(req.url);
  if (!r.file) return reply(res, r.status, http.STATUS_CODES[r.status] + '\n');
  fs.stat(r.file, (err, st) => {
    try {
      if (err || !st.isFile()) return reply(res, 404, 'not found\n');
      const h = HDR();
      // .gz files are served as opaque bytes (the viewer decompresses them): no Content-Encoding
      h['Content-Type'] = TYPES[path.extname(r.file)] || 'application/octet-stream';
      h['Content-Length'] = st.size;
      res.writeHead(200, h);
      if (req.method === 'HEAD') return res.end();
      const s = fs.createReadStream(r.file);
      s.on('error', () => res.destroy());
      s.pipe(res);
    } catch { reply(res, 500, 'error\n'); }
  });
}

const server = http.createServer((req, res) => {
  try {
    res.on('error', () => {});
    if (req.method === 'POST' && req.url.startsWith('/__report')) return report(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, 'method not allowed\n', { Allow: 'GET, HEAD' });
    serveFile(req, res);
  } catch (e) { try { reply(res, 500, 'error\n'); } catch { } }
});
server.on('clientError', (err, sock) => { try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { } });
server.listen(PORT, '0.0.0.0', () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  const wsl = addrs.find(a => !a.startsWith('172.17.')) || addrs[0] || '127.0.0.1';
  console.log(`nullDC lineage viewer on 0.0.0.0:${PORT}${REPORTS ? '' : ' (reports off)'}`);
  console.log(`open from Windows:  http://${wsl}:${PORT}/`);
  for (const a of addrs) if (a !== wsl) console.log(`  also:  http://${a}:${PORT}/`);
});

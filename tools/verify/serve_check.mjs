#!/usr/bin/env node
// serve_check.mjs: hostile requests against a throwaway tools/serve.mjs; the server must answer each and stay up.
//   node tools/verify/serve_check.mjs   -> agents/verify/serve-check.json
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8790 + Math.floor(Math.random() * 100);
const srv = spawn('node', [path.join(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
let exited = null; srv.on('exit', c => exited = c);
let err = ''; srv.stderr.on('data', d => err += d);
await new Promise(r => srv.stdout.once('data', r));
const raw = (text) => new Promise(res => { const s = net.connect(PORT, '127.0.0.1', () => s.end(text)); let b = ''; s.on('data', d => b += d); s.on('close', () => res(b.split('\r\n')[0])); s.on('error', e => res('ERR ' + e.code)); });
const req = (method, url, body, headers = {}) => fetch(`http://127.0.0.1:${PORT}${url}`, { method, body, headers }).then(r => r.status).catch(e => 'ERR ' + e.message);
const results = [];
const t = async (name, p, want) => { const got = await p; const pass = Array.isArray(want) ? want.includes(got) || want.some(w => String(got).startsWith(w)) : got === want; results.push({ name, got, want, pass }); console.log(pass ? 'PASS' : 'FAIL', name, got); };
await t('GET / works', req('GET', '/'), 200);
await t('malformed escape /%E0%A4%A', raw('GET /%E0%A4%A HTTP/1.1\r\nHost: x\r\n\r\n'), 'HTTP/1.1 400 Bad Request');
await t('malformed escape in /data/', raw('GET /data/%ZZ HTTP/1.1\r\nHost: x\r\n\r\n'), 'HTTP/1.1 400 Bad Request');
await t('NUL byte', raw('GET /%00 HTTP/1.1\r\nHost: x\r\n\r\n'), 'HTTP/1.1 400 Bad Request');
await t('traversal %2e%2e', raw('GET /%2e%2e/%2e%2e/etc/passwd HTTP/1.1\r\nHost: x\r\n\r\n'), ['HTTP/1.1 403', 'HTTP/1.1 404']);
await t('traversal into data sibling', raw('GET /data/..%2f..%2ftools/serve.mjs HTTP/1.1\r\nHost: x\r\n\r\n'), ['HTTP/1.1 403', 'HTTP/1.1 404']);
await t('directory without slash', req('GET', '/src'), 404);
await t('garbage request line', raw('\x16\x03\x01garbage\r\n\r\n'), ['HTTP/1.1 400', '']);
await t('PUT refused', req('PUT', '/x', 'y'), 405);
await t('report name ..', req('POST', '/__report?name=..', '{}'), 400);
await t('report name = directory', req('POST', '/__report?name=shots', '{}'), 400);
await t('report name with slash', req('POST', '/__report?name=bench-a%2F..-A.json', '{}'), 400);
await t('report not JSON', req('POST', '/__report?name=bench-selftest-A.json', 'not json'), 400);
await t('report too large (5 MB)', req('POST', '/__report?name=bench-selftest-A.json', 'x'.repeat(5 << 20)), [413, 'ERR']);
await t('report malformed url', raw('POST /__report?name=%E0%A4%A HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}'), 'HTTP/1.1 400 Bad Request');
await t('report ok', req('POST', '/__report?name=bench-selftest-A.json', '{"ok":1}'), 200);
fs.rmSync(path.join(ROOT, 'agents/verify/bench-selftest-A.json'), { force: true });
await t('still serving after all of it', req('GET', '/data/manifest.json'), 200);
await t('server process alive', Promise.resolve(exited === null ? 'alive' : 'exited ' + exited), 'alive');
srv.kill();
fs.writeFileSync(path.join(ROOT, 'agents/verify/serve-check.json'), JSON.stringify({ date: new Date().toISOString(), results, stderr: err.slice(-2000) }, null, 1));
process.exit(results.every(r => r.pass) ? 0 : 1);

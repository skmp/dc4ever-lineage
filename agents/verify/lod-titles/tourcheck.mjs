#!/usr/bin/env node
// tourcheck.mjs PORT [reduce]: the tour starts on load, the audio gate shows; the first click turns the score on and keeps
// the tour running; a later key hands control back. With 'reduce' (prefers-reduced-motion): no tour, the gate's
// 'start tour' button starts it. Headless llvmpipe, about 30 s.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = +process.argv[2] || 8751, REDUCE = process.argv[3] === 'reduce';
const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
const wsl = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('172.17.'))?.address || '127.0.0.1';
const udd = fs.mkdtempSync(path.join(path.dirname(new URL(import.meta.url).pathname), '.chrome-'));
const proc = spawn(CHROME, ['--headless=new', `--user-data-dir=${udd}`, '--remote-debugging-port=0', '--window-size=1280,720', '--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank'],
  { env: { ...process.env, GALLIUM_DRIVER: 'llvmpipe' }, stdio: ['ignore', 'ignore', 'pipe'] });
let err = ''; const wsUrl = await new Promise(r => proc.stderr.on('data', d => { err += d; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m) r(m[1]); }));
const port = new URL(wsUrl).port, page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map(), logs = [];
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400)); else if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ' ' + m.params.args.map(a => a.value ?? a.description).join(' ')); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
if (REDUCE) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.navigate', { url: `http://${wsl}:${PORT}/` });
for (let i = 0; i < 300; i++) { await sleep(100); if (await ev('!!(window.viewer && window.viewer.load.meta && window.viewer.load.firstFrame)')) break; }
await sleep(1500);
const state = async () => ev(`(() => { const V = window.viewer, g = document.getElementById('audiogate'); return { attract: V.attractOn, gate: !g.classList.contains('hidden'), tourBtn: !document.getElementById('gatetour').classList.contains('hidden'), score: !!(V.score && V.score.on), pinned: !!V.pinned, cam: V.cam.p.map(Math.round), titles: V.visibleTitles().length }; })()`);
const out = { reduce: REDUCE, onLoad: await state() };
if (process.env.SHOT) { const sh = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.env.SHOT, Buffer.from(sh.result.data, 'base64')); }
const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); };
if (REDUCE) {
  const b = await ev(`(() => { const r = document.getElementById('gatetour').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(b[0], b[1]); await sleep(1500); out.afterTourButton = await state();
} else {
  await click(640, 400); await sleep(1500); out.afterFirstClick = await state();
  await sleep(2000); out.twoSecondsLater = await state();
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 }); await sleep(300);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 }); await sleep(500);
  out.afterKey = await state();
}
out.logs = logs.slice(-10);
console.log(JSON.stringify(out, null, 1));
ws.close(); proc.kill('SIGKILL'); setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { } process.exit(0); }, 600);

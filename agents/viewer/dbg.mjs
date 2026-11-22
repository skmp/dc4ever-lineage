// quick debug: open page, wait N s, print logs + state
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os';
const soft = process.argv[2] === 'soft', wait = +(process.argv[3] || 8) * 1000, q = process.argv[4] || '?shots=1';
const udd = fs.mkdtempSync('/home/skmp/projects/nulldc-lineage/agents/viewer/.chrome-');
const proc = spawn(os.homedir() + '/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', ['--headless=new', `--user-data-dir=${udd}`, '--remote-debugging-port=0', '--window-size=1280,720', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=vulkan', 'about:blank'], { env: { ...process.env, GALLIUM_DRIVER: soft ? 'llvmpipe' : 'd3d12' }, stdio: ['ignore', 'ignore', 'pipe'] });
let eb = ''; const url = await new Promise(r => proc.stderr.on('data', d => { eb += d; const m = eb.match(/DevTools listening on (ws:\S+)/); if (m) r(m[1]); }));
const t = (await (await fetch(`http://127.0.0.1:${new URL(url).port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id) { pend.get(m.id)?.(m); } else if (m.method === 'Runtime.consoleAPICalled') console.log('console', m.params.type, m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 3000)); else if (m.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(m.params.exceptionDetails).slice(0, 3000)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable');
await send('Page.navigate', { url: 'http://172.22.167.46:8742/' + q });
await new Promise(r => setTimeout(r, wait));
if (process.env.EXPR) { const e = await send('Runtime.evaluate', { expression: process.env.EXPR, awaitPromise: true, returnByValue: true }); console.log('EXPR =>', JSON.stringify(e.result?.result?.value ?? e.result).slice(0, 4000)); }
const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({load: window.viewer?.load, stats: window.viewer && {...window.viewer.stats, dt: window.viewer.stats.dt.slice(-5), cpu: undefined, gpu: window.viewer.stats.gpu.slice(-3)}, r: window.viewer?.RENDERER, hud: document.getElementById("hud").innerText, loading: document.getElementById("loading").innerText})', returnByValue: true });
console.log(r.result?.result?.value || JSON.stringify(r));
if (process.argv[5]) { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.argv[5], Buffer.from(s.result.data, 'base64')); }
proc.kill('SIGKILL'); fs.rmSync(udd, { recursive: true, force: true }); process.exit(0);

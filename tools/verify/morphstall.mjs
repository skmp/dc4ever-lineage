#!/usr/bin/env node
// morphstall.mjs: Now-mode morph playback at close / near range (the case that stalled llvmpipe), per-frame records.
//   node tools/verify/morphstall.mjs [--gpu|--soft] [--size 2560x1440] [--secs 10] [--lanes reicast,nulldc3,flycast,polly2]
// For each lane: camera at the lane's live wall on the moving plane (close = 900, near = 2600 units), playback at 0.3 events/s
// over the lane's next arrival, adaptive quality on. Writes agents/verify/morphstall-<tag>-<size>.json.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const soft = !opt('gpu', false);
const [VW, VH] = String(opt('size', '2560x1440')).split('x').map(Number);
const SECS = +opt('secs', 10), PORT = +opt('port', 8742);
const LANES = String(opt('lanes', 'reicast,nulldc3,flycast,polly2')).split(',');
const CHROME = process.env.CHROME || path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
const wsl = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('172.17.')).address;
const XVFB = path.join(ROOT, 'agents/tools/xvfb/run-xvfb.sh');
let xv = null;
if (!soft) {
  for (let tries = 0; tries < 8 && !xv; tries++) {   // a display number may be taken: try another
    const disp = 70 + Math.floor(Math.random() * 60);
    const x = spawn(XVFB, [String(disp), `${VW}x${VH}`, '-displayfd', '1'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const ok = await new Promise(r => { x.stdout.once('data', () => r(true)); x.once('exit', () => r(false)); setTimeout(() => r(false), 8000); });
    if (ok) { xv = x; xv.disp = disp; } else x.kill();
  }
  if (!xv) throw new Error('Xvfb did not start');
}
const udd = fs.mkdtempSync(path.join(ROOT, 'agents/verify/.chrome-'));
const env = { ...process.env, GALLIUM_DRIVER: soft ? 'llvmpipe' : 'd3d12', ...(xv ? { DISPLAY: ':' + xv.disp } : {}) }; delete env.WAYLAND_DISPLAY;
const flags = [...(xv ? ['--ozone-platform=x11', '--window-position=0,0', '--kiosk'] : ['--headless=new']), '--user-data-dir=' + udd, '--remote-debugging-port=0',
  '--no-first-run', `--window-size=${VW},${VH}`, '--ignore-gpu-blocklist', '--enable-gpu', ...(soft ? ['--use-angle=vulkan'] : ['--use-gl=angle', '--use-angle=gl']),
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'];
const p = spawn(CHROME, flags, { env, stdio: ['ignore', 'ignore', 'pipe'] });
let e = ''; const wsu = await new Promise(r => p.stderr.on('data', d => { e += d; const m = e.match(/DevTools listening on (ws:\S+)/); if (m) r(m[1]); }));
const t = (await (await fetch(`http://127.0.0.1:${new URL(wsu).port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map(); const traceEv = []; let traceDone = null;
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  else if (m.method === 'Tracing.dataCollected') traceEv.push(...m.params.value); else if (m.method === 'Tracing.tracingComplete') traceDone?.(); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800)); return r.result.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://${wsl}:${PORT}/?shots=1${process.env.EXTRA || ''}` });
for (let i = 0; i < 300; i++) { await new Promise(r => setTimeout(r, 200)); try { if (await ev('!!(window.viewer&&window.viewer.load.firstFrame)')) break; } catch { } }
await ev('window.viewer.whenReady({timeout:90000, allBaked: true})');
const out = { size: [VW, VH], soft, renderer: await ev('window.viewer.RENDERER'), runs: {} };
const TRACE = !!opt('trace', false);
for (const lane of LANES) for (const [name, dist] of [['close', 900], ['near', 2600]]) {
  if (TRACE) await send('Tracing.start', { categories: 'toplevel,gpu,gpu.angle,v8,blink,cc,viz,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  const r = await ev(`(async()=>{ const V = window.viewer; const li = V.layout.lanes.findIndex(l => l.name === ${JSON.stringify(lane)});
    const ss = V.layout.lanes[li].snaps.slice().sort((a, b) => V.eventOf[a] - V.eventOf[b]); const b = ss[Math.min(ss.length - 1, 2)];
    V.fixedQuality = false; V.setQualityStep(0); V.setPres('now'); V.setTime(V.eventOf[b] - 1 + 0.02); V.follow = true; await new Promise(r => setTimeout(r, 300));
    const w = V.W[b], x = V.eventX(V.t); V.cam.p = [x - ${dist}, 2900, w.z0 + 3400]; V.setLook([1, -0.1, 0.5]);
    await new Promise(r => setTimeout(r, 1500)); V.playSpeed = 0.3; V.playing = true; const rec = []; const steps = new Set();
    const t0 = performance.now(); const h = ({ cpu }) => { rec.push([V.lastRawDt, cpu, V.morph ? 1 : 0, V.stats.inst, V.quality.step, V.morphStride || 0]); steps.add(V.quality.step); };
    V.on('frame', h);
    await new Promise(res => { const f = () => { if (performance.now() - t0 < ${SECS * 1000}) setTimeout(f, 100); else res(); }; f(); });
    V.listeners.frame.splice(V.listeners.frame.indexOf(h), 1); V.playing = false;
    const dts = rec.map(r => r[0]).slice(2).sort((a, b) => a - b); const q = p => +dts[Math.min(dts.length - 1, Math.floor(p * dts.length))].toFixed(1);
    const worst = rec.slice(2).map((r, i) => [i, ...r]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(r => r.map(v => +(+v).toFixed(1)));
    return { wall: V.man.snapshots[b].id, n: dts.length, p50: q(.5), p95: q(.95), p99: q(.99), max: q(1), over100: dts.filter(v => v > 100).length,
      steps: [...steps], morphFrames: rec.filter(r => r[2]).length, worst_i_dt_cpu_morph_lines_step_stride: worst }; })()`);
  out.runs[`${lane}-${name}`] = r; console.log(lane, name, JSON.stringify(r));
  if (TRACE) { const done = new Promise(r => traceDone = r); await send('Tracing.end'); await done;
    const long = traceEv.filter(e => e.ph === 'X' && e.dur > 250000).sort((a, b) => b.dur - a.dur).slice(0, 40);
    const names = {}; for (const e of traceEv) if (e.ph === 'X' && e.dur > 100000 && /angle|vk|Vk|Pipeline|Shader|Compile/i.test(e.name + e.cat)) { names[e.name] = (names[e.name] || 0) + e.dur / 1000; } console.log('  angle-ish', JSON.stringify(names));
    for (const e of long) console.log('  long', (e.dur / 1000).toFixed(0) + 'ms', e.name, e.cat, 'pid', e.pid, 'tid', e.tid, JSON.stringify(e.args).slice(0, 200));
    traceEv.length = 0; }
  if (process.env.EXTRA?.includes('glprof')) { console.log('  slow GL', JSON.stringify(await ev('(window.__glSlow || []).splice(0)')).slice(0, 1500)); }
}
const tag = soft ? 'llvmpipe' : 'gpu';
fs.writeFileSync(path.join(ROOT, `agents/verify/morphstall-${tag}-${VW}x${VH}.json`), JSON.stringify(out, null, 1));
p.kill('SIGKILL'); if (xv) xv.kill('SIGTERM'); setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { } process.exit(0); }, 800);

#!/usr/bin/env node
// run.mjs: headless Chromium driver over CDP (Node's built-in WebSocket), DESIGN 7.2 / 7.3 / 7.4.
//   node tools/verify/run.mjs probe  [--gpu|--soft] [--size WxH]
//   node tools/verify/run.mjs shots  [--gpu|--soft] [--size WxH] [--views far,rec,morph,fork]
//   node tools/verify/run.mjs bench  [--gpu|--soft] [--size WxH] [--paths A,B,C,D,E] [--dur 20] [--fixed]
// The server (tools/serve.mjs) must be running; the page is opened through the WSL address, not 127.0.0.1.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), cmd = args[0] || 'probe';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const OUT = typeof opt('out', false) === 'string' ? path.resolve(ROOT, opt('out')) : path.join(ROOT, 'agents', 'verify');
const soft = !!opt('soft', false);
const [VW, VH] = String(opt('size', '1280x720')).split('x').map(Number);
const PORT = +opt('port', 8742);
const CHROME = process.env.CHROME || path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
const wsl = Object.values(os.networkInterfaces()).flat().find(a => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('172.17.'))?.address || '127.0.0.1';
const BASE = `http://${wsl}:${PORT}/`;
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

// GPU path: a private Xvfb (agents/tools/xvfb, extracted from the Ubuntu deb, never installed) gives Chromium an X display
// that no one sees; Mesa d3d12 renders on the real GPU through /dev/dxg and presents with XPutImage. Headless Chromium has
// no GPU route on this WSL install (d3d12 has no surfaceless EGL configs and no Vulkan ICD), so --gpu runs headed on Xvfb.
const XVFB = path.join(ROOT, 'agents/tools/xvfb/run-xvfb.sh');
async function startXvfb() {
  for (let tries = 0; tries < 8; tries++) { try { return await startXvfb1(); } catch (e) { if (tries === 7) throw e; } }   // a display number may be taken
}
async function startXvfb1() {
  const disp = 70 + Math.floor(Math.random() * 60);
  const x = spawn(XVFB, [String(disp), `${VW}x${VH}`, '-displayfd', '1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  x.stderr.on('data', d => err += d);
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('Xvfb did not start: ' + err.slice(-500))), 8000);
    x.stdout.on('data', () => { clearTimeout(to); res(); }); x.once('exit', () => { clearTimeout(to); rej(new Error('Xvfb exited: ' + err.slice(-300))); }); });
  return { x, disp };
}
async function launch() {
  const udd = fs.mkdtempSync(path.join(OUT, '.chrome-'));
  const useX = !soft && fs.existsSync(XVFB) && opt('headless', false) !== true;
  const xv = useX ? await startXvfb() : null;
  const env = { ...process.env, GALLIUM_DRIVER: soft ? 'llvmpipe' : 'd3d12', ...(xv ? { DISPLAY: ':' + xv.disp } : {}) };
  delete env.WAYLAND_DISPLAY;
  const flags = [...(xv ? ['--ozone-platform=x11', '--window-position=0,0', '--kiosk'] : ['--headless=new']), `--user-data-dir=${udd}`, '--remote-debugging-port=0', `--window-size=${VW},${VH}`, '--no-first-run', '--no-default-browser-check',
    '--ignore-gpu-blocklist', '--enable-gpu', ...(soft ? ['--use-angle=vulkan'] : ['--use-gl=angle', '--use-angle=gl']), ...(cmd === 'bench' ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
    '--enable-precise-memory-info', ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(' ') : []), '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'];
  const proc = spawn(CHROME, flags, { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let errBuf = '';
  const wsUrl = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('chrome did not start: ' + errBuf.slice(-2000))), 20000);
    proc.stderr.on('data', d => { errBuf += d; const m = errBuf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(to); res(m[1]); } });
  });
  const port = new URL(wsUrl).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pend = new Map(), logs = [], trace = { ev: [], done: null };
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else if (m.method === 'Tracing.dataCollected') trace.ev.push(...m.params.value); else if (m.method === 'Tracing.tracingComplete') trace.done?.();
    else if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    else if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  const evalJS = async (expr, timeout = 180000) => {
    const r = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('eval timeout: ' + expr)), timeout))]);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value;
  };
  const close = () => { try { ws.close(); } catch { } proc.kill('SIGKILL'); if (xv) xv.x.kill('SIGTERM'); setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { } }, 800); };
  return { send, evalJS, logs, close, trace };
}
const T0 = Date.now(); const ts = (s) => console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(b, query = '') {
  const t0 = Date.now();
  await b.send('Page.navigate', { url: BASE + query });
  for (let i = 0; i < 600; i++) { await sleep(100); try { if (await b.evalJS('!!(window.viewer && window.viewer.load.firstFrame)', 2000)) break; } catch { } }
  return Date.now() - t0;
}

const tag = typeof opt('tag', false) === 'string' ? opt('tag') : (soft ? 'llvmpipe' : 'gpu');
const b = await launch();
try {
  if (cmd === 'probe') {
    const nav = await open(b, '?shots=1');
    const r = await b.evalJS(`(async () => { const V = window.viewer; const ms = await V.whenReady({timeout: 90000});
      return { renderer: V.RENDERER, soft: V.SOFT, crossOriginIsolated, sab: typeof SharedArrayBuffer, load: V.load, readyMs: ms, gpuMB: V.stats.gpuBytes/1048576,
        heapMB: performance.memory ? performance.memory.usedJSHeapSize/1048576 : null, bytes: performance.getEntriesByType('resource').reduce((a, e) => a + (e.transferSize || 0), 0) }; })()`);
    const head = await fetch(BASE);
    r.url = BASE; r.navMs = nav; r.coop = head.headers.get('cross-origin-opener-policy'); r.coep = head.headers.get('cross-origin-embedder-policy');
    // bytes before the first frame: resources that finished before firstFrame
    r.bytesBeforeFirstFrame = await b.evalJS(`performance.getEntriesByType('resource').filter(e => e.responseEnd <= window.viewer.load.firstFrame + 50).reduce((a, e) => a + (e.transferSize || 0), 0)`);
    r.pick = {};
    for (const v of ['rec', 'rec-mid', 'fork', 'far']) r.pick[v] = await b.evalJS(`window.viewer.view(${JSON.stringify(v)}).then(() => ({ projected_lines: window.viewer.pickTest(200), screen_samples: window.viewer.pickTest2(200) }))`);
    r.logs = b.logs.slice(-20);
    console.log(JSON.stringify(r, null, 1));
    fs.writeFileSync(path.join(OUT, `probe-${tag}.json`), JSON.stringify(r, null, 1));
  } else if (cmd === 'shots') {
    ts('open'); await open(b, '?shots=1' + (process.env.EXTRA || '')); ts('opened');
    const views = String(opt('views', 'far,read,read-mid,read-far,morph,attract,now,fork,fpgadc')).split(',');
    const res = {};
    for (const v of views) {
      ts('view ' + v); const info = await b.evalJS(`window.viewer.view(${JSON.stringify(v)})`); ts('ready');
      const shot = await b.send('Page.captureScreenshot', { format: 'png' }); ts('shot');
      const f = path.join(OUT, 'shots', `${v}-${tag}-${VW}x${VH}.png`);
      fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
      res[v] = { file: path.relative(ROOT, f), ready_ms: Math.round(info.ms), renderer: info.renderer };
      console.log(v, '->', res[v].file, `${res[v].ready_ms} ms`);
    }
    fs.writeFileSync(path.join(OUT, `shots-${tag}.json`), JSON.stringify({ size: [VW, VH], views: res, logs: b.logs.slice(-30) }, null, 1));
    if (b.logs.length) console.log(b.logs.slice(-10).join('\n'));
  } else if (cmd === 'seq') {   // seq --dir OUT [--order FILE] [--from N] [--to M]: video stills, every frame by date -> OUT/00000.png + OUT/frames.json
    const dir = path.resolve(opt('dir')); fs.mkdirSync(dir, { recursive: true });
    await open(b, '?shots=1&clean=1&tour=0' + (process.env.EXTRA || ''));
    const order = opt('order', false) ? JSON.parse(fs.readFileSync(path.resolve(opt('order')))).map(r => r.f) : await b.evalJS('window.viewer.framesByDate()');   // --order FILE: [{f}, ...]
    const from = +opt('from', 0), to = Math.min(order.length, +opt('to', order.length)), meta = [];
    for (let k = from; k < to; k++) {
      const info = await b.evalJS(`window.viewer.showFrame(${order[k]})`, 180000);
      const shot = await b.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(dir, String(k).padStart(5, '0') + '.png'), Buffer.from(shot.data, 'base64'));
      meta.push({ k, ...info }); console.log(k, info.lane, info.date, JSON.stringify(info.ms || {}), 'want', info.want);
    }
    fs.writeFileSync(path.join(dir, `frames-${from}-${to}.json`), JSON.stringify(meta, null, 1));
  } else if (cmd === 'eval') {   // eval --js FILE (an async function body; `V` is the viewer) [--shot NAME]
    await open(b, '?shots=1' + (process.env.EXTRA || ''));
    await b.evalJS('window.viewer.whenReady({timeout: 90000})');
    const body = fs.readFileSync(opt('js'), 'utf8');
    if (opt('trace', false)) await b.send('Tracing.start', { categories: 'toplevel,gpu,gpu.angle,viz,cc,v8,blink.user_timing', transferMode: 'ReportEvents' });
    const r = await b.evalJS(`(async () => { const V = window.viewer; ${body} })()`, 600000);
    if (opt('trace', false)) { const done = new Promise(r => b.trace.done = r); await b.send('Tracing.end'); await done;   // events > 20 ms: count, total, max
      const agg = {}; for (const e of b.trace.ev) if (e.ph === 'X' && e.dur > 20000) { const k = e.pid + ' ' + e.name; agg[k] = agg[k] || [0, 0, 0]; agg[k][0]++; agg[k][1] += e.dur / 1000; agg[k][2] = Math.max(agg[k][2], e.dur / 1000); }
      console.log('trace (events > 20 ms: count, total ms, max ms):'); for (const [k, v] of Object.entries(agg).sort((a, b) => b[1][1] - a[1][1]).slice(0, 30)) console.log('  ', k, v.map(x => Math.round(x)).join(' / ')); }
    console.log(JSON.stringify(r, null, 1));
    if (opt('shot', false)) { const shot = await b.send('Page.captureScreenshot', { format: 'png' });
      const f = path.join(OUT, 'shots', `${opt('shot')}-${tag}-${VW}x${VH}.png`); fs.writeFileSync(f, Buffer.from(shot.data, 'base64')); console.log('shot', f); }
    if (b.logs.length) console.log(b.logs.slice(-15).join('\n'));
  } else if (cmd === 'bench') {
    const paths = String(opt('paths', 'A,B,C,D,E')).split(','), dur = +opt('dur', 20), fixed = opt('fixed', false) ? '&fixed=1' : '';
    const all = {};
    for (const p of paths) {
      await open(b, `?shots=1&tag=${tag}-${VW}x${VH}${fixed}` + (process.env.EXTRA || ""));
      if (opt('trace', false)) await b.send('Tracing.start', { categories: 'toplevel,gpu,gpu.angle,viz,cc,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
      const r = await b.evalJS(`window.viewer.runBench(${JSON.stringify(p)}, ${dur})`, (dur + 150) * 1000);
      if (opt('trace', false)) { const done = new Promise(r => b.trace.done = r); await b.send('Tracing.end'); await done;
        const agg = {}; for (const e of b.trace.ev) if (e.ph === 'X' && e.dur > 50000) { const k = e.pid + ' ' + e.name; agg[k] = agg[k] || [0, 0, 0]; agg[k][0]++; agg[k][1] += e.dur / 1000; agg[k][2] = Math.max(agg[k][2], e.dur / 1000); }
        console.log('trace (events > 50 ms: count, total ms, max ms):'); for (const [k, v] of Object.entries(agg).sort((a, b) => b[1][1] - a[1][1]).slice(0, 25)) console.log('  ', k, v.map(x => Math.round(x)).join(' / '));
        b.trace.ev.length = 0; }
      fs.writeFileSync(path.join(OUT, `frames-${tag}-${VW}x${VH}-${p}.csv`), 'frame_ms,cpu_ms,gpu_ms,draws,lines,quality_step\n' + r.frames_csv + '\n');
      delete r.frames_csv; all[p] = r;
      console.log(p, JSON.stringify({ frame: r.frame_ms, cpu: r.cpu_ms, gpu: r.gpu_ms, fps: r.fps_mean, steps: r.quality_steps, lines_p95: r.lines_p95, over100: r.frames_over_100ms }));
    }
    fs.writeFileSync(path.join(OUT, `bench-${tag}-${VW}x${VH}.json`), JSON.stringify({ date: new Date().toISOString(), size: [VW, VH], paths: all, logs: b.logs.slice(-20) }, null, 1));
  }
} catch (e) { console.error('ERROR', e.message); console.error(b.logs.slice(-30).join('\n')); process.exitCode = 1; }
finally { b.close(); ts('closed'); setTimeout(() => process.exit(process.exitCode || 0), 800); }

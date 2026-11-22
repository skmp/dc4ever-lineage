#!/usr/bin/env node
// render_score.mjs: render the generative score (viewer/src/score.js) offline in headless Chromium with an
// OfflineAudioContext and write a WAV, plus a JSON with level / clipping / click / key measurements.
// The drive is a synthetic run through the lineage: the year goes 2004 -> 2026, fork pulses at fixed points, code
// density varies, and the last third is an attract-mode arc.
//   node tools/render_score.mjs [--dur 180] [--seed 2026] [--out agents/score]     (about 30 s for 3 minutes)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const DUR = +opt('dur', 180), SEED = +opt('seed', 2026), SR = 48000, OUT = path.resolve(ROOT, opt('out', 'agents/score'));
const CHROME = process.env.CHROME || path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
fs.mkdirSync(OUT, { recursive: true });
const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'score-chrome-'));
const proc = spawn(CHROME, ['--headless=new', `--user-data-dir=${udd}`, '--remote-debugging-port=0', '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let errBuf = '';
const wsUrl = await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('chrome did not start')), 20000);
  proc.stderr.on('data', d => { errBuf += d; const m = errBuf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(to); res(m[1]); } }); });
const port = new URL(wsUrl).port, page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
try {
  const src = fs.readFileSync(path.join(ROOT, 'viewer/src/score.js'), 'utf8');
  const t0 = Date.now();
  const info = await ev(`(async () => {
    const m = await import('data:text/javascript;base64,${Buffer.from(src).toString('base64')}');
    const ctx = new OfflineAudioContext(2, ${SR * DUR}, ${SR});
    const S = m.createScore(ctx, { seed: ${SEED}, volume: 0.6 });
    const D = ${DUR}, forks = [0.12, 0.3, 0.42, 0.55, 0.71].map(f => f * D);
    let fork = 0;
    for (let t = 0; t < D; t += 0.5) {
      const u = t / D; fork = forks.filter(x => x <= t).length;
      S.schedule(t, Math.min(D, t + 0.5), { year: 2004 + 22.9 * u, fork, density: 0.5 + 0.45 * Math.sin(u * 17), arc: u > 0.66 ? Math.sin((u - 0.66) / 0.34 * Math.PI) : 0 });
    }
    const buf = await ctx.startRendering();
    window.__ch = [buf.getChannelData(0), buf.getChannelData(1)];
    return { events: S.state.events, section: S.state.section, len: buf.length };
  })()`);
  // fetch as 16-bit PCM in pieces (base64 over CDP)
  const N = info.len, L = new Float32Array(N), R = new Float32Array(N), STEP = SR * 10;
  for (let a = 0; a < N; a += STEP) {
    const b64 = await ev(`(() => { const a = ${a}, n = Math.min(${STEP}, ${N} - a), f = new Float32Array(2 * n); f.set(window.__ch[0].subarray(a, a + n), 0); f.set(window.__ch[1].subarray(a, a + n), n);
      let s = ''; const u8 = new Uint8Array(f.buffer); for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); })()`);
    const f = new Float32Array(Buffer.from(b64, 'base64').buffer.slice(0)); const n = f.length / 2; L.set(f.subarray(0, n), a); R.set(f.subarray(n), a);
  }
  // WAV (16-bit stereo)
  const wav = Buffer.alloc(44 + N * 4); wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) { wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + 4 * i); wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + 4 * i); }
  const name = `score-seed${SEED}-${DUR}s`; fs.writeFileSync(path.join(OUT, name + '.wav'), wav);
  // measurements: peak, RMS, clipped samples, clicks (second-difference spikes far above the local level), key (chroma)
  let peak = 0, sum = 0, clip = 0; for (const ch of [L, R]) for (let i = 0; i < N; i++) { const v = Math.abs(ch[i]); peak = Math.max(peak, v); sum += v * v; if (v >= 0.999) clip++; }
  const rms = Math.sqrt(sum / (2 * N));
  let clicks = 0, worst = 0; const W = 480;
  for (const ch of [L, R]) for (let a = W; a + W < N; a += W) {
    let e = 0, dmax = 0; for (let i = a; i < a + W; i++) { e += ch[i] * ch[i]; const d2 = Math.abs(ch[i] - 2 * ch[i - 1] + ch[i - 2]); if (d2 > dmax) dmax = d2; }
    const lr = Math.sqrt(e / W) + 1e-4, ratio = dmax / lr; worst = Math.max(worst, ratio); if (ratio > 8 && dmax > 0.02) clicks++; }
  const chroma = new Float64Array(12), names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const goertzel = (x, a, n, f) => { const k = 2 * Math.cos(2 * Math.PI * f / SR); let s1 = 0, s2 = 0; for (let i = a; i < a + n; i++) { const s0 = x[i] + k * s1 - s2; s2 = s1; s1 = s0; } return s1 * s1 + s2 * s2 - k * s1 * s2; };
  for (let a = 0; a + 8192 < N; a += SR) for (let mnote = 36; mnote < 96; mnote++) chroma[mnote % 12] += goertzel(L, a, 8192, 440 * Math.pow(2, (mnote - 69) / 12));
  const tot = chroma.reduce((a, b) => a + b, 0), share = [...chroma].map(v => v / tot);
  const inKey = [2, 4, 5, 7, 9, 10, 0].reduce((a, pc) => a + share[pc], 0);
  const res = { file: path.relative(ROOT, path.join(OUT, name + '.wav')), seconds: DUR, seed: SEED, render_s: (Date.now() - t0) / 1000, events: info.events,
    peak: +peak.toFixed(4), peak_dbfs: +(20 * Math.log10(peak)).toFixed(2), rms_dbfs: +(20 * Math.log10(rms)).toFixed(2), clipped_samples: clip,
    click_windows: clicks, worst_d2_over_rms: +worst.toFixed(2), key_signature: 'one flat (D aeolian / F ionian pitch set)', in_key_energy: +inKey.toFixed(3),
    chroma: Object.fromEntries(names.map((n, i) => [n, +share[i].toFixed(3)])) };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
} finally { try { ws.close(); } catch { } proc.kill('SIGKILL'); setTimeout(() => fs.rmSync(udd, { recursive: true, force: true }), 500); }

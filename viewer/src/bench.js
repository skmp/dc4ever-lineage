// bench.js: scripted camera paths (DESIGN 7.3), screenshot views, /__report
export function initBench(V) {
  const { man, W, layout, Q } = V;
  const sid = id => man.snapshots.findIndex(s => s.id === id);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const smooth = t => t * t * (3 - 2 * t);
  const zMax = layout.lanes.at(-1).z0 + layout.lanes.at(-1).width, xMax = Math.max(...W.map(w => w.x));
  const lookAt = (p, target) => { V.cam.p = p; V.setLook(target.map((v, i) => v - p[i])); };

  V.whenReady = (opts = {}) => new Promise(res => {
    const t0 = performance.now();
    const check = () => {
      const all = V.load.walls === V.NS && V.load.text === man.text_chunks && V.normLines;
      const baked = !V.stats.pendingBake && (!opts.allBaked || !V.stats.unbaked);
      const morphOk = !opts.morph || V.morph;
      if ((all && baked && morphOk && V.stats.frames > 2) || performance.now() - t0 > (opts.timeout || 60000)) res(performance.now() - t0);
      else setTimeout(check, 100);
    };
    check();
  });
  V.on('frame', () => V.stats.frames++);

  // ---- views for screenshots
  V.view = async (name) => {
    V.fixedQuality = true; if (!Q.has('scale') && !Q.has('t0')) V.setQualityStep(0); V.follow = false;
    V.setPres('gallery'); V.flight = null; V.setMarks(null);
    if (name === 'far') { const v = V.overview(); V.cam.p = v.p; V.setLook(v.dir); }
    else if (name === 'rec') {
      const r = await V.gotoBookmark('nullDC rec_v1 driver', { instant: true });
      const v = V.fileView(r.s, r.k, 1); const d = 2 * V.focalPx() / 13, hw = d * Math.tan(Math.PI / 6) * innerWidth / innerHeight;
      V.cam.p = [V.WX[r.s] - d, v.p[1] - d * 0.45, v.p[2] - 60 + hw - 2]; V.setLook([1, 0, 0]);
    } else if (name === 'rec-mid') {
      const r = await V.gotoBookmark('nullDC rec_v1 driver', { instant: true });
      const v = V.fileView(r.s, r.k, 1); const d = 2 * V.focalPx() / 8.5; V.cam.p = [V.WX[r.s] - d, v.p[1] - d * 0.5, v.p[2] + d * 0.55]; V.setLook([1, -0.04, 0.12]);
    } else if (name === 'morph' || name === 'morph-wide') {   // Now mode, reicast r6 -> r7-rc1 in flight
      const b = sid('reicast-r7-rc1'); V.setPres('now'); V.setTime(V.eventOf[b] - 1 + (name === 'morph' ? 0.8 * 0.6 : 0.30));
      await new Promise(r => setTimeout(r, 300));    // let the camera-follow see the jump before placing the camera
      const w = W[b], x = V.eventX(V.t);
      if (name === 'morph') {   // frontal, glyphs readable, where the most lines are added (green, growing) and moving
        { const d = 2 * V.focalPx() / 10; V.cam.p = [x - d, 2048, w.z0 + 600]; V.setLook([1, 0, 0]); }   // near enough that the morph is drawn
        for (let i = 0; i < 400 && !(V.morph && V.morph.m.colB); i++) await new Promise(r => setTimeout(r, 50));
        const m = V.morph.m, cnt = new Map();
        for (let i = 0; i < m.nKA; i++) if (((m.inst[4 * i] >>> 26) & 3) === 1) { const p = m.inst[4 * i + 1], key = (p & 4095) * 64 + (((p >>> 12) & 2047) >> 5); cnt.set(key, (cnt.get(key) || 0) + 1); }
        const best = [...cnt].sort((a, b) => b[1] - a[1])[0][0], col = best >> 6, row = (best & 63) * 32 + 16;
        const d = 2 * V.focalPx() / 10; V.cam.p = [x - d, 4096 - row * 2, w.z0 + col * 128 + 60]; V.setLook([1, 0, 0]);
      } else lookAt([x - 9000, 5200, w.z0 - 2500], [x, 2000, w.z0 + w.cols * 64]);
    } else if (name === 'fork') { // the reicast fork point: nullDC 2011 + nullDCe 2009 imported into reicast 2013, r6 after it
      const v = V.fitBox(V.wallsBox(['nulldc-2011-09', 'nullDCe-2009', 'reicast-2013-import', 'reicast-r6', 'nulldc-360-2011'].map(sid)), [0.88, -0.42, 0.12]);
      V.cam.p = v.p; V.setLook(v.dir);
    } else if (name === 'fork2') { // reicast -> flycast and reicast -> nullDC 3
      const v = V.fitBox(V.wallsBox(['reicast-r19.07', 'flycast-v1.0', 'reicast-last', 'nulldc3-fpgadc-2023'].map(sid)), [0.7, -0.45, 0.55]);
      V.cam.p = v.p; V.setLook(v.dir);
    } else if (name === 'fpgadc') { // the hardware lanes: DreamSTer releases r1..r6b on minicast / polly2, r8, shrike4, caique, wren7, tests, devtools
      const ids = V.man.snapshots.filter(s => V.layout.lanes[V.layout.walls[s.i].lane].group === 'fpgadc').map(s => s.i);
      const v = V.fitBox(V.wallsBox(ids), [0.62, -0.5, 0.6]); V.cam.p = v.p; V.setLook(v.dir);
    } else if (name === 'refsw3') {
      const r = await V.gotoBookmark('refsw3 refcore tile', { instant: true }); void r;
    }
    const ms = await V.whenReady({ morph: name.startsWith('morph') });
    await new Promise(r => setTimeout(r, 400));
    return { ms, renderer: V.RENDERER, cam: V.cam.p, stats: { ...V.stats, dt: undefined, cpu: undefined, gpu: undefined } };
  };

  // ---- pick check (DESIGN 7.2.4): project random visible line cells to the screen, pick them back
  V.pickTest = (n = 200) => {
    const VP = V.VP, res = { tried: 0, ok: 0, bad: [] }; let guard = 0;
    while (res.tried < n && guard++ < n * 50) {
      const w = W[Math.floor(Math.random() * W.length)]; if (!w.loaded || !V.WA[w.s]) continue;
      const j = Math.floor(Math.random() * w.n), w1 = w.inst[2 * j + 1], col = w1 & 4095, row = (w1 >>> 12) & 2047;
      const p = [V.WX[w.s], 4096 - row * 2 - 1, w.z0 + col * 128 + 3];
      const c = [0, 1, 2, 3].map(i => VP[i] * p[0] + VP[4 + i] * p[1] + VP[8 + i] * p[2] + VP[12 + i]);
      if (c[3] <= 0) continue; const nx = c[0] / c[3], ny = c[1] / c[3];
      if (Math.abs(nx) > 0.95 || Math.abs(ny) > 0.95) continue;
      const sx = (nx + 1) / 2 * innerWidth, sy = (1 - ny) / 2 * innerHeight;
      const r = V.pick(sx, sy); if (r && r.s !== w.s) continue;   // occluded by a nearer wall
      res.tried++;
      const k = w.fileOfInst[j], line = j - w.fileStart[k] + 1;
      if (r && r.s === w.s && r.k === k && r.line === line) res.ok++;
      else if (res.bad.length < 5) res.bad.push({ want: [w.s, k, line], got: r && [r.s, r.k, r.line, r.kind] });
    }
    return res;
  };

  // screen-sample variant: random pixels -> pick -> the picked line's cell, projected with the GL matrix, contains the pixel
  V.pickTest2 = (n = 200) => {
    const VP = V.VP, res = { tried: 0, ok: 0, bad: [] };
    const proj = p => { const c = [0, 1, 2, 3].map(i => VP[i] * p[0] + VP[4 + i] * p[1] + VP[8 + i] * p[2] + VP[12 + i]); return [(c[0] / c[3] + 1) / 2 * innerWidth, (1 - c[1] / c[3]) / 2 * innerHeight]; };
    for (let g = 0; g < n * 20 && res.tried < n; g++) {
      const sx = Math.random() * innerWidth, sy = Math.random() * innerHeight, r = V.pick(sx, sy);
      if (!r || r.kind !== 'line') continue; res.tried++;
      const x = V.WX[r.s], z0 = r.w.z0 + r.col * 128, yt = 4096 - r.row * 2;
      const pts = [[x, yt, z0], [x, yt - 2, z0], [x, yt, z0 + 128], [x, yt - 2, z0 + 128]].map(proj);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), e = 0.75;
      if (sx >= Math.min(...xs) - e && sx <= Math.max(...xs) + e && sy >= Math.min(...ys) - e && sy <= Math.max(...ys) + e) res.ok++;
      else if (res.bad.length < 5) res.bad.push({ sx, sy, r: [r.s, r.col, r.row], box: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] });
    }
    return res;
  };

  // ---- scripted paths, 20 s each
  async function pathA() { // sh4_opcodes street through every wall that holds it
    const s0 = sid('nulldc3-refsw3'), k0 = V.snapJ[s0].files.findIndex(f => f.p === 'libswirl/hw/sh4/interpr/sh4_opcodes.cpp');
    const r = await fetch('data/identities.json.gz'); const ids = JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
    const vs = ids[V.snapJ[s0].files[k0].id].v.slice().sort((a, b) => V.eventOf[a[0]] - V.eventOf[b[0]]);
    const keys = vs.map(([s, k]) => V.fileView(s, k, 40).p);
    return t => { const x = t * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(x)), f = smooth(x - i); V.cam.p = lerp(keys[i], keys[i + 1], f); V.setLook([1, -0.05, 0.02]); };
  }
  const pathB = () => t => { const a = t * Math.PI * 2, c = [xMax / 2, 0, zMax / 2]; lookAt([c[0] - Math.cos(a) * 150000, 80000, c[2] + Math.sin(a) * 150000], c); };
  const pathC = () => { const lanes = layout.lanes.slice(0, 9); return t => { const passes = 5, x = t * passes, i = Math.floor(x), f = x - i;
    const L = lanes[(i * 2) % lanes.length]; V.cam.p = [-5000 + f * (xMax + 8000), 2500, L.z0 + L.width / 2 - 1000]; V.setLook([1, -0.02, 0]); }; };
  const pathD = () => { const s = sid('nulldc3-refsw3'), w = W[s], d = 2 * V.focalPx() / 12;
    return t => { V.cam.p = [V.WX[s] - d, 2048 + Math.sin(t * Math.PI * 6) * 1700, w.z0 + 200 + t * (w.cols * 128 - 400)]; V.setLook([1, 0, 0]); }; };
  const pathE = () => { V.setPres('now'); return t => { V.t = t * (V.NS - 1); const x = V.eventX(V.t); lookAt([x - 16000, 7000, 70000], [x, 1500, 95000]); }; };
  V.runBench = async (name, dur = 20) => {
    V.follow = false; V.fixedQuality = Q.get('fixed') === '1'; V.setPres('gallery');
    const mk = { A: pathA, B: pathB, C: pathC, D: pathD, E: pathE }[name];
    const step = await mk();
    step(0); const readyMs = await V.whenReady({ timeout: 120000, allBaked: true });
    const rec = []; let t0 = null; V.prof.worst.length = 0; V.bench = true; V.syncFrames = Q.get('sync') === '1'; let lastGpuN = V.stats.gpuN || 0;   // default: frame pacing by fences (main.js): dt is the real interval between rendered frames
    await new Promise(res => {
      const steps = new Set();
      const tick = () => {
        const now = performance.now(); if (t0 === null) t0 = now;
        const t = Math.min(1, (now - t0) / (dur * 1000)); step(t);
        if (t >= 1) { V.listeners.tick.splice(V.listeners.tick.indexOf(tick), 1); res(); }
      };
      V.on('tick', tick);
      V.on('frame', ({ dt, cpu }) => { if (t0 === null || V.bench === false) return; const gNew = (V.stats.gpuN || 0) !== lastGpuN ? V.stats.gpu.at(-1) : null; lastGpuN = V.stats.gpuN || 0;
        rec.push([V.lastRawDt, cpu, gNew, V.stats.draws, V.stats.inst, V.quality.step]); steps.add(V.quality.step); });
    });
    V.bench = false; V.syncFrames = false; const worst = V.prof.worst.slice(); V.prof.worst.length = 0;
    const col = i => rec.map(r => r[i]).filter(v => v != null).slice(2);
    const pc = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
    const dt = col(0), cpu = col(1), gpu = col(2);
    const out = { path: name, dur, frames: rec.length, renderer: V.RENDERER, soft: V.SOFT, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, canvas: [V.gl.canvas.width, V.gl.canvas.height],
      frame_ms: { p50: pc(dt, .5), p95: pc(dt, .95), p99: pc(dt, .99), max: pc(dt, 1) }, cpu_ms: { p50: pc(cpu, .5), p95: pc(cpu, .95), p99: pc(cpu, .99) },
      gpu_ms: gpu.length ? { p50: pc(gpu, .5), p95: pc(gpu, .95), p99: pc(gpu, .99) } : null,
      fps_mean: +(1000 * rec.length / dt.reduce((a, b) => a + b, 0)).toFixed(1),
      draws_p95: pc(col(3), .95), lines_p95: pc(col(4), .95), lines_max: pc(col(4), 1), quality_steps: [...new Set(col(5))],
      frames_over_100ms: dt.filter(v => v > 100).length, ready_ms: Math.round(readyMs), slowest_frames_cpu_sections: worst,
      load: V.load, gpu_bytes_est: V.stats.gpuBytes, js_heap_mb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null,
      frames_csv: rec.map(r => r.map(v => v == null ? '' : +(+v).toFixed(3)).join(',')).join('\n') };
    window.__bench = out;
    const tag = (Q.get('tag') || (V.SOFT ? 'llvmpipe' : 'gpu'));
    await fetch(`/__report?name=bench-${tag}-${name}.json`, { method: 'POST', body: JSON.stringify(out) }).catch(() => {});
    return out;
  };
  if (Q.has('bench')) setTimeout(async () => {
    const list = Q.get('bench') === 'all' ? ['A', 'B', 'C', 'D', 'E'] : Q.get('bench').split(','), res = {};
    for (const p of list) { res[p] = await V.runBench(p, +(Q.get('dur') || 20)); V.toast(`bench ${p}: p50 ${res[p].frame_ms.p50} ms, p95 ${res[p].frame_ms.p95} ms`); delete res[p].frames_csv; }
    V.toast('bench done: results posted to agents/verify/ on the server'); console.log('BENCH', JSON.stringify(res));
  }, 50);
}

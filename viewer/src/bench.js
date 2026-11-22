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
      const baked = !V.stats.pendingBake;
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
      const v = V.fileView(r.s, r.k, 1); V.cam.p = [V.WX[r.s] - 1800, v.p[1] - 900, v.p[2] + 300]; V.setLook([1, -0.1, 0.15]);
    } else if (name === 'morph' || name === 'morph-wide') {
      const b = sid('reicast-r7-rc1'); V.setPres('now'); V.setTime(V.eventOf[b] - 1 + 0.30);
      const w = W[b], x = V.eventX(V.t);
      if (name === 'morph') lookAt([x - 2600, 2900, w.z0 + 3400], [x, 2300, w.z0 + 5200]);
      else lookAt([x - 9000, 5200, w.z0 - 2500], [x, 2000, w.z0 + w.cols * 64]);
    } else if (name === 'fork') { // reicast born from nullDC + nullDCe (2013 import), flycast and nullDC 3 forking later
      const r = W[sid('reicast-2013-import')], n = W[sid('nulldc-2011-09')];
      lookAt([n.x - 16000, 52000, (n.z0 + r.z0) / 2 - 8000], [r.x + 4000, 0, r.z0 - 4000]);
    } else if (name === 'fork2') {
      const a = W[sid('reicast-r19.07')], b = W[sid('nulldc3-fpgadc-2023')];
      lookAt([a.x - 30000, 45000, a.z0 - 15000], [b.x - 6000, 0, (a.z0 + b.z0) / 2 + 8000]);
    } else if (name === 'fpgadc') {
      const z = layout.fpgadc.z0, x = W[sid('polly2-r1')].x;
      lookAt([x - 30000, 30000, z + 4000], [x + 20000, 0, z + 25000]);
    } else if (name === 'refsw3') {
      const r = await V.gotoBookmark('refsw3 refcore tile', { instant: true }); void r;
    }
    const ms = await V.whenReady({ morph: name.startsWith('morph') });
    await new Promise(r => setTimeout(r, 400));
    return { ms, renderer: V.RENDERER, cam: V.cam.p, stats: { ...V.stats, dt: undefined, cpu: undefined, gpu: undefined } };
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
    step(0); const readyMs = await V.whenReady({ timeout: 90000 });
    const rec = []; let t0 = null; V.bench = true;
    await new Promise(res => {
      const steps = new Set();
      const tick = () => {
        const now = performance.now(); if (t0 === null) t0 = now;
        const t = Math.min(1, (now - t0) / (dur * 1000)); step(t);
        if (t >= 1) { V.listeners.tick.splice(V.listeners.tick.indexOf(tick), 1); res(); }
      };
      V.on('tick', tick);
      V.on('frame', ({ dt, cpu }) => { if (t0 === null || V.bench === false) return; rec.push([dt * 1000, cpu, V.stats.gpu.at(-1) ?? null, V.stats.draws, V.stats.inst, V.quality.step]); steps.add(V.quality.step); });
    });
    V.bench = false;
    const col = i => rec.map(r => r[i]).filter(v => v != null).slice(2);
    const pc = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
    const dt = col(0), cpu = col(1), gpu = col(2);
    const out = { path: name, dur, frames: rec.length, renderer: V.RENDERER, soft: V.SOFT, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, canvas: [V.gl.canvas.width, V.gl.canvas.height],
      frame_ms: { p50: pc(dt, .5), p95: pc(dt, .95), p99: pc(dt, .99), max: pc(dt, 1) }, cpu_ms: { p50: pc(cpu, .5), p95: pc(cpu, .95), p99: pc(cpu, .99) },
      gpu_ms: gpu.length ? { p50: pc(gpu, .5), p95: pc(gpu, .95), p99: pc(gpu, .99) } : null,
      fps_mean: +(1000 * rec.length / dt.reduce((a, b) => a + b, 0)).toFixed(1),
      draws_p95: pc(col(3), .95), lines_p95: pc(col(4), .95), lines_max: pc(col(4), 1), quality_steps: [...new Set(col(5))],
      frames_over_100ms: dt.filter(v => v > 100).length, ready_ms: Math.round(readyMs),
      load: V.load, gpu_bytes_est: V.stats.gpuBytes, js_heap_mb: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null,
      frames_csv: rec.map(r => r.map(v => v == null ? '' : +(+v).toFixed(3)).join(',')).join('\n') };
    window.__bench = out;
    const tag = (Q.get('tag') || (V.SOFT ? 'llvmpipe' : 'gpu'));
    await fetch(`/__report?name=bench-${tag}-${name}.json`, { method: 'POST', body: JSON.stringify(out) }).catch(() => {});
    return out;
  };
  if (Q.has('bench')) setTimeout(() => V.runBench(Q.get('bench'), +(Q.get('dur') || 20)), 50);
}

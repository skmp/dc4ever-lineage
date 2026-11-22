// main.js: boot, scene, camera, frame loop, LOD, picking (DESIGN 4, 5)
import * as G from './gl.js';
import * as SH from './shaders.js';
import * as core from './core.js';
import { initUI } from './ui.js';
import { initBench } from './bench.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
if (Q.has('clean')) document.body.classList.add('shots');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shots') });
if (!gl) { document.getElementById('loading').textContent = 'WebGL2 is not available in this browser.'; throw new Error('no webgl2'); }
if (Q.has('glprof')) {   // debug: record GL calls that block the main thread (sync points) with their caller
  window.__glSlow = [];
  for (const k of Object.getOwnPropertyNames(WebGL2RenderingContext.prototype)) {
    const d = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, k); if (!d || typeof d.value !== 'function') continue;
    const f = d.value; gl[k] = function (...a) { const t = performance.now(); const r = f.apply(gl, a); const dt = performance.now() - t;
      if (dt > 30) window.__glSlow.push([k, Math.round(dt), new Error().stack.split('\n').slice(2, 5).join(' | ')]); return r; };
  }
}
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const RENDERER = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
const SOFT = Q.get('soft') === '1' || (Q.get('soft') !== '0' && /llvmpipe|swiftshader|softpipe|software/i.test(RENDERER));
const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
gl.getExtension('EXT_color_buffer_float');
const FOV = 60 * Math.PI / 180;
const H = core.H;
const t0Boot = performance.now();

// ------------------------------------------------------------------ state
export const V = {
  gl, RENDERER, SOFT, Q,
  cam: { p: [-9000, 9000, 60000], yaw: 0, pitch: -0.25, speed: 2000 },
  mode: 0, hideInc: true, pres: 'gallery', scale: 'event', t: 0, playing: false, playSpeed: 1,
  quality: { step: 0, t0: SOFT ? 10 : 6, scale: SOFT ? 0.5 : 1, t1min: SOFT ? 1.2 : 0.3, maxInst: SOFT ? 200000 : 3e6, bake: SOFT ? 0.25 : 2 },
  stats: { frames: 0, dt: [], cpu: [], gpu: [], draws: 0, inst: 0, imp: 0, t3: 0, baked: 0 },
  load: { boot: 0, firstFrame: 0, walls: 0, text: 0, textDone: 0, allText: 0, bytesBoot: 0 },
  WX: new Float32Array(64), WA: new Float32Array(64), noLines: new Uint8Array(64),
  skip: new Set((Q.get('skip') || '').split(',')),
  hover: null, pinned: null, hi: null, flight: null, morph: null, events: null, listeners: {},
};
if (Q.has('scale')) V.quality.scale = +Q.get('scale');
if (Q.has('t0')) V.quality.t0 = +Q.get('t0');
if (Q.has('scale') || Q.has('t0')) V.fixedQuality = true;
const on = (k, f) => (V.listeners[k] ||= []).push(f);
const emit = (k, ...a) => (V.listeners[k] || []).forEach(f => f(...a));
V.on = on; V.emit = emit;

async function gz(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  return new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
const getJSON = async url => (await fetch(url)).json();
const setLoading = s => { const e = document.getElementById('loading'); e.textContent = s; e.classList.toggle('hidden', !s); };

// ------------------------------------------------------------------ boot
setLoading('loading layout…');
const [man, layoutBytes, story, metrics, sdf] = await Promise.all([
  getJSON('data/manifest.json'), gz('data/layout.json.gz'), getJSON('data/story.json'), getJSON('data/font/metrics.json'), gz('data/font/sdf.r8.gz')]);
const layout = JSON.parse(new TextDecoder().decode(layoutBytes));
const NS = man.snapshots.length;
const snapJ = await Promise.all(man.snapshots.map((s, i) => gz(`data/snap/${String(i).padStart(2, '0')}.json.gz`).then(b => JSON.parse(new TextDecoder().decode(b)))));
Object.assign(V, { man, layout, story, snapJ, NS });
V.load.boot = performance.now() - t0Boot;

// walls
const W = []; let base = 0;
const slotMaps = layout.lanes.map(l => core.laneSlotMap(l));
const laneSlotsSorted = layout.lanes.map(l => {
  const a = l.slots.map((s, i) => ({ i, L: s[2] * H + s[3], end: s[2] * H + s[3] + core.HDR + s[4] + core.GAP, id: s[0], ord: s[1], cap: s[4] }));
  a.sort((x, y) => x.L - y.L); return a;
});
for (let s = 0; s < NS; s++) {
  const lw = layout.walls[s], L = layout.lanes[lw.lane], j = snapJ[s];
  const n = j.files.reduce((a, f) => a + f.n, 0);
  const fileSlot = new Int32Array(j.files.length), fileL = new Uint32Array(j.files.length), slotToFile = new Map(), ordc = new Map();
  j.files.forEach((f, k) => { const o = ordc.get(f.id) || 0; ordc.set(f.id, o + 1); const sl = slotMaps[lw.lane].get(f.id * 65536 + o); fileSlot[k] = sl.i; fileL[k] = sl.L; slotToFile.set(sl.i, k); });
  W.push({ s, lane: lw.lane, L, x: lw.x, z0: L.z0, cols: L.cols, n, base, loaded: false, fileSlot, fileL, slotToFile, snap: man.snapshots[s],
    parent: man.snapshots[s].parents.length ? man.snapshots[s].parents[0] : -1, imp: null, impKey: '' });
  base += n;
}
V.W = W; V.totalLines = base;
// events: snapshot arrival order
const events = layout.event_order; V.events = events;
const eventOf = new Int32Array(NS); events.forEach((s, k) => eventOf[s] = k); V.eventOf = eventOf;
const laneSnapsByEvent = layout.lanes.map(l => l.snaps.slice().sort((a, b) => eventOf[a] - eventOf[b]));

// ------------------------------------------------------------------ GL resources
const INSTW = 4096, INSTH = Math.ceil(base / INSTW);
const instTex = G.tex2D(gl, INSTW, INSTH, gl.RG32UI, gl.RG_INTEGER, gl.UNSIGNED_INT);
const LW = 2048, LH = Math.ceil(man.raw_lines / LW);
const offsTex = G.tex2D(gl, LW, LH, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, new Uint32Array(LW * LH).fill(0xFFFFFFFF));
const metaTex = G.tex2D(gl, LW, LH, gl.RG8UI, gl.RG_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array(LW * LH * 2));
const presTex = G.tex2D(gl, LW, LH, gl.RG32UI, gl.RG_INTEGER, gl.UNSIGNED_INT, new Uint32Array(LW * LH * 2));
const markArr = new Uint8Array(LW * LH);
const markTex = G.tex2D(gl, LW, LH, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, markArr);
const authTex = G.tex2D(gl, INSTW, INSTH, gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array(INSTW * INSTH).fill(0xFFFF));   // blame author per instance
const textTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, textTex);
gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8UI, 4096, 4096, 3);
gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
const atlasTex = G.tex2D(gl, metrics.width, metrics.height, gl.R8, gl.RED, gl.UNSIGNED_BYTE, sdf, gl.LINEAR);
const MORPHW = 4096, MORPHH = 160;
const morphTex = G.tex2D(gl, MORPHW, MORPHH, gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT);
let gpuBytes = INSTW * INSTH * 10 + LW * LH * (4 + 2 + 8 + 1) + 4096 * 4096 * 3 + metrics.width * metrics.height + MORPHW * MORPHH * 16;

// palette: rows 0 origin, 1 age, 2 repo of origin, 3 survival ramp
function srgb(c) { return c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)); }
function hex(rgb) { return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''); }
const palArr = new Uint8Array(64 * 8 * 4);
const setPal = (row, i, rgb) => { const o = (row * 64 + i) * 4; palArr[o] = rgb[0]; palArr[o + 1] = rgb[1]; palArr[o + 2] = rgb[2]; palArr[o + 3] = 255; };
const dnum = d => { const [y, m, dd] = d.split('-').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const laneOfOrigin = o => o === NS ? layout.lanes.findIndex(l => l.name === 'nullDC') : W[o].lane;
const originDate = o => o === NS ? 2007.5 : dnum(man.snapshots[o].order_date);
function cividis(t) { // approx cividis
  const s = [[0, 32, 77], [64, 77, 108], [124, 123, 120], [188, 175, 111], [253, 231, 55]].map(c => c.map(v => v / 255));
  const x = Math.max(0, Math.min(0.9999, t)) * 4, i = Math.floor(x), f = x - i; return s[i].map((v, k) => v + (s[i + 1][k] - v) * f);
}
for (let o = 0; o <= NS; o++) {
  setPal(0, o, layout.origin_rgb[o]);
  setPal(1, o, srgb(cividis((originDate(o) - 2003) / 23.9)));
  setPal(2, o, layout.lanes[laneOfOrigin(o)].rgb);
}
for (let i = 0; i < 64; i++) { const t = i / 63; setPal(3, i, srgb([0.85 - 0.65 * t, 0.25 + 0.35 * t, 0.25 + 0.7 * t])); }
const palTex = G.tex2D(gl, 64, 8, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, palArr);
const possArr = new Uint8Array(64 * 64);
for (let o = 0; o <= NS; o++) for (let w = 0; w < NS; w++) possArr[w * 64 + o] = layout.possible[o][w];
const possTex = G.tex2D(gl, 64, 64, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, possArr);
V.palette = { origin: o => hex(layout.origin_rgb[o]), age: o => hex([...palArr.slice((64 + o) * 4, (64 + o) * 4 + 3)]), lane: l => hex(layout.lanes[l].rgb), originDate, laneOfOrigin };

// blame (optional, tools/blame.py): handles and dates only. Author palette rows 4-7 (256 entries): top handles by lines
V.blame = null;
function authorPalette() {
  const B = V.blame; if (!B) return;
  const rank = B.authors.map((_, i) => i).sort((a, b) => B.total[b] - B.total[a]); B.rank = rank;
  const hsl = (h, s, l) => { const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)].map(v => Math.round(v * 255)); };
  B.rgb = new Array(B.authors.length);
  rank.forEach((a, r) => { B.rgb[a] = B.authors[a] === 'skmp' ? [240, 181, 74] : r < 28 ? hsl((r * 137.508 + 200) % 360, 0.62, r < 14 ? 0.62 : 0.5) : [86, 94, 110]; });
  for (let a = 0; a < Math.min(256, B.authors.length); a++) setPal(4 + (a >> 6), a & 63, B.rgb[a]);
  gl.bindTexture(gl.TEXTURE_2D, palTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 8, gl.RGBA, gl.UNSIGNED_BYTE, palArr);
}
V.authorPalette = authorPalette;
const loadBlame = () => gz('data/blame/commits.json.gz').then(b => {   // after the first frame: not needed to start
  const j = JSON.parse(new TextDecoder().decode(b));
  V.blame = { ...j, commitAuthor: Uint16Array.from(j.commits.map(c => c[1])), total: new Float64Array(j.authors.length) };
  authorPalette();
  for (const w of W) if (w.loaded) dw.postMessage({ type: 'blame', snap: w.s, commitAuthor: V.blame.commitAuthor });
  emit('blame');
}).catch(() => { V.blame = null; });

// programs
const P = {
  line: G.program(gl, SH.lineVS(false), SH.lineFS(), 'line'),
  morph: G.program(gl, SH.lineVS(true), SH.lineFS(), 'morph'),
  rect: G.program(gl, SH.rectVS, SH.rectFS, 'rect'),
  seg: G.program(gl, SH.lineSegVS, SH.lineSegFS, 'seg'),
  label: G.program(gl, SH.labelVS, SH.labelFS, 'label'),
  imp: G.program(gl, SH.impVS, SH.impFS, 'imp'),
};

// ------------------------------------------------------------------ static scene geometry
// rect instances: aR(4f) aX(2f) aC(4u8n) aW(2u8) -> 32 bytes
class RectBuf {
  constructor() { this.f = []; }
  add(z0, z1, y0, y1, x0, x1, rgba, wall, kind) { this.f.push([z0, z1, y0, y1, x0, x1, rgba, wall, kind]); }
  build() {
    const n = this.f.length, ab = new ArrayBuffer(n * 32), f32 = new Float32Array(ab), u8 = new Uint8Array(ab);
    this.f.forEach((r, i) => { f32.set(r.slice(0, 6), i * 8); u8.set(r[6], i * 32 + 24); u8[i * 32 + 28] = r[7]; u8[i * 32 + 29] = r[8]; });
    this.n = n; this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);
    this.bind(0); gl.bindVertexArray(null); this.f = null; gpuBytes += n * 32; return this;
  }
  bind(first) {
    const o = first * 32;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, o); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, o + 16); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 32, o + 24); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 2, gl.UNSIGNED_BYTE, 32, o + 28); gl.vertexAttribDivisor(3, 1);
  }
}
const ST_RGB = { new: [70, 200, 110], same: [90, 100, 125], edit: [230, 180, 60], move: [90, 160, 240], 'move+edit': [180, 120, 240], copy: [240, 110, 180] };
const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const plates = new RectBuf(), deco = new RectBuf(), t3 = new RectBuf(), floor = new RectBuf(), pinsR = new RectBuf();
const decoRange = [], holeRange = [];
const PLATE_PUSH = 3 << 2, T3_PUSH = 2 << 2, HDR_PUSH = 1 << 2;
// labels
const labStore = []; let labLen = 0; const labels = [], dlabels = [];   // dlabels: decluttered per frame (DESIGN 4.7)
function labText(s) { const o = labLen; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); labStore.push(c >= 32 && c < 127 ? c : 0x7F); } labLen += s.length; return o; }
// prio > 0: the label takes part in screen-space decluttering (higher wins; a loser is moved up / down by a line, else hidden)
function addLabel(s, z, y, dx, wall, U, Vv, rgba, billboard = 0, maxPx = 0, prio = 0) {
  if (!s.length) return; (prio > 0 ? dlabels : labels).push([z, y, dx, wall, ...U, ...Vv, labText(s), s.length, rgba, billboard, maxPx, prio]);
}
const segs = [], holeSegs = [], streetSegs = [], streetRange = [];   // streetRange: [wallA, wallB, first, count] // [z, y, s, xabs, wA, wB, rgba]
function seg(a, b) { segs.push(a, b); }
const trunc = (s, n) => s.length <= n ? s : '…' + s.slice(s.length - n + 1);

for (const w of W) {
  const L = w.L, j = snapJ[w.s], lane = L, rgb = L.rgb, wall = w.s;
  const plate = mixc([13, 15, 20], rgb, 0.06).concat(255);
  const deco0 = deco.f.length, hole0 = holeSegs.length;
  for (let c = 0; c < w.cols; c++) plates.add(w.z0 + c * 128 - 4, w.z0 + c * 128 + 124, -6, 4102, 0, 0, plate, wall, PLATE_PUSH);
  // files: header bars + labels + T3 quads per column segment
  j.files.forEach((f, k) => {
    const L0 = w.fileL[k], col = Math.floor(L0 / H), row = L0 % H, z = w.z0 + col * 128, ytop = 4096 - row * 2;
    deco.add(z, z + 120, ytop - 3.6, ytop, 0, 0, mixc([20, 24, 32], ST_RGB[f.st] || [128, 128, 128], 0.45).concat(255), wall, HDR_PUSH);
    const tag = `${f.n} lines | ${f.st}`;
    addLabel(trunc(f.p, Math.floor(118 / 1.25) - tag.length - 3) + '  ' + tag, z + 1, ytop - 0.3, 0, wall, [0, 0, 1.25], [0, 1.5, 0], [235, 240, 250, 255]);
    let a = L0 + core.HDR, e = a + f.n;
    while (a < e) { const c = Math.floor(a / H), r0 = a % H, r1 = Math.min(H, r0 + (e - a));
      t3.add(w.z0 + c * 128, w.z0 + c * 128 + 110, 4096 - r1 * 2, 4096 - r0 * 2, 0, 0, [f.o, 128, 0, 230], wall, T3_PUSH | 2); a += r1 - r0; }
  });
  // holes: lane slots without a file in this wall
  for (const sl of laneSlotsSorted[w.lane]) {
    if (w.slotToFile.has(sl.i)) continue;
    const col = Math.floor(sl.L / H), row = sl.L % H, rows = Math.min(core.HDR + sl.cap, H - row);
    const za = w.z0 + col * 128, zb = za + 120, ya = 4096 - (row + rows) * 2, yb = 4096 - row * 2, hc = [70, 76, 92, 140];
    const P4 = [[za, ya], [zb, ya], [zb, yb], [za, yb]];
    for (let q = 0; q < 4; q++) { const A = P4[q], B = P4[(q + 1) & 3]; holeSegs.push([A[0], A[1], 0, -1, wall, wall, hc], [B[0], B[1], 0, -1, wall, wall, hc]); }
  }
  decoRange.push([deco0, deco.f.length - deco0]); holeRange.push([hole0, holeSegs.length - hole0]);
  // wall title + districts
  const sn = man.snapshots[w.s];
  addLabel(`${lane.title}  |  ${sn.id}  |  ${sn.date_range ? sn.date_range + ' (git ' + sn.date + ')' : sn.order_date}  |  ${sn.files} files, ${sn.lines.toLocaleString('en')} lines`, w.z0, 4096 + 200, 0, wall, [0, 0, 40], [0, 50, 0], [...rgb, 255], 0, 0, 70);
  if (sn.date_note) addLabel(trunc(sn.date_note, 160), w.z0, 4096 + 80, 0, wall, [0, 0, 14], [0, 18, 0], [220, 190, 120, 255], 0, 0, 35);
  for (const d of L.districts) {
    const zc = w.z0 + d.col0 * 128;
    addLabel(d.path, zc, 4096 + 26, 0, wall, [0, 0, 6], [0, 9, 0], [200, 210, 225, 255], 0, 0, 10);
    floor.add(zc, w.z0 + d.col1 * 128 - 8, -2, -2, -160, 160, [...mixc([20, 24, 32], rgb, 0.35), 255], wall, 1);
  }
}
// pins: DreamSTer release markers
for (const p of layout.pins) { const w = W[p.snap];
  pinsR.add(w.z0 - 260, w.z0 - 60, -6, 4500, 0, 0, [255, 210, 90, 220], p.snap, HDR_PUSH);
  addLabel(p.label, w.z0 - 60, 4096 + 420, 0, p.snap, [0, 0, 60], [0, 70, 0], [255, 210, 90, 255], 12, 0, 80); }
// lanes: titles, floor bands
const Xmax = Math.max(...W.map(w => w.x)) + 8000;
for (const [li, L] of layout.lanes.entries()) {
  const first = Math.min(...L.snaps.map(s => W[s].x));
  floor.add(L.z0, L.z0 + L.width, -8, -8, first - 3000, Xmax, [...mixc([12, 14, 19], L.rgb, 0.12), 255], 255, 1);
  addLabel(L.title, L.z0, 4096 + 1800, first - 3500, 255, [0, 0, 160], [0, 180, 0], [...L.rgb, 255], 15, 0, 90);
  addLabel(L.name, L.z0, -10, first - 3200, 255, [0, 0, 260], [260, 0, 0], [...L.rgb, 200], 0, 0, 20);
  // street ribbons between consecutive walls of the lane (per shared slot)
  const ss = laneSnapsByEvent[li];
  for (let q = 1; q < ss.length; q++) {
    const a = W[ss[q - 1]], b = W[ss[q]]; streetRange.push([a.s, b.s, streetSegs.length]);
    for (const [slot, kb] of b.slotToFile) {
      if (!a.slotToFile.has(slot)) continue;
      const f = snapJ[b.s].files[kb], L0 = b.fileL[kb], z = b.z0 + Math.floor(L0 / H) * 128 + 60;
      const c = [...(ST_RGB[f.st] || [120, 120, 120]), f.st === 'same' ? 60 : 150];
      streetSegs.push([z, -30, 0, 0, a.s, b.s, c], [z, -30, 1, 0, a.s, b.s, c]);
    }
    streetRange.at(-1).push(streetSegs.length - streetRange.at(-1)[2]);
  }
}
// fpgadc group banner + moat
{ const fz = layout.fpgadc.z0, fx = Math.min(...W.filter(w => layout.lanes[w.lane].group === 'fpgadc').map(w => w.x));
  addLabel(layout.fpgadc.title, fz, 4096 + 4200, fx - 6000, 255, [0, 0, 300], [0, 340, 0], [120, 230, 220, 255], 18, 0, 100);
  floor.add(fz - 2900, fz - 100, -12, -12, fx - 8000, Xmax, [30, 60, 64, 255], 255, 1); }
// ruler: years, gaps, brackets
const zR0 = -6000, zR1 = -1500;
floor.add(zR0, zR1, -10, -10, 0, Xmax, [22, 26, 34, 255], 255, 1);
let lastYearX = -1e9;
for (const r of layout.ruler) {
  if (r.year) {
    if (r.x - lastYearX < 2600) continue; lastYearX = r.x; floor.add(zR0, zR1, -6, -6, r.x - 25, r.x + 25, [120, 130, 150, 255], 255, 1);
    addLabel(String(r.year), zR0 + 300, 1500, r.x - 1, 255, [0, 0, 380], [0, 420, 0], [190, 200, 220, 255], 13, 0, 60);
    const zEnd = Math.max(zR1 + 2000, ...layout.lanes.filter(L => Math.min(...L.snaps.map(s => W[s].x)) - 3000 <= r.x).map(L => L.z0 + L.width));   // lanes that exist by then
    seg([zR1, -6, 0, r.x, 255, 255, [120, 130, 150, 90]], [zEnd, -6, 0, r.x, 255, 255, [120, 130, 150, 40]]); }
  else addLabel(`... ${r.gap} ...`, zR0 + 300, 400, r.x, 255, [0, 0, 160], [0, 200, 0], [150, 160, 180, 255], 0, 0, 40);
}
for (const b of layout.brackets) {
  const L = layout.lanes[W[b.snap].lane];
  for (let x = b.x0; x < b.x1; x += 600) floor.add(L.z0 - 1400, L.z0 - 200, -4, -4, x, Math.min(b.x1, x + 300), [200, 150, 60, 200], 255, 1);
  addLabel(`real dates ${b.range}: ${trunc(b.note, 110)}`, L.z0 - 1350, 2, b.x0, 255, [0, 0, 22], [40, 0, 0], [230, 190, 120, 255], 0, 0, 30);
}
// lineage edges
const EDGE_RGB = { 'git-fork': [120, 200, 255], import: [240, 200, 110], 'fork-recovered': [240, 160, 90], concept: [150, 150, 165], copy: [255, 120, 200] };
V.edgeStyle = EDGE_RGB;
for (const e of layout.edges) {
  const a = W[e.from], b = W[e.to], za = a.z0 + a.cols * 64, zb = b.z0 + b.cols * 64, c = EDGE_RGB[e.kind];
  const N = 64, arch = !!e.arch, top = 4200 + 3500 * (e.arch || 1);
  for (let i = 0; i < N; i++) {
    const s0 = i / N, s1 = (i + 1) / N;
    if (e.kind === 'concept' && (i & 1)) continue;
    if (e.kind === 'fork-recovered' && (i % 4 === 3)) continue;
    if (e.kind === 'import' && (i < 6 || i > N - 7) && (i & 1)) continue;
    const pt = s => { const sm = s * s * (3 - 2 * s); return [za + (zb - za) * sm, arch ? 4200 + Math.sin(Math.PI * s) * (top - 4200) : -150 + Math.sin(Math.PI * s) * 60, s, 0, a.s, b.s, [...c, 230]]; };
    seg(pt(s0), pt(s1));
    if (!arch) { const q = s => { const p = pt(s); p[0] += 40; return p; }; seg(q(s0), q(s1)); }
  }
  const mid = (za + zb) / 2;
  // label at the middle of the arc (x half way between the walls in the gallery); decluttered against the others
  addLabel(e.label, mid, arch ? top + 400 : 900, (b.x - a.x) / 2, e.from, [0, 0, 40], [0, 50, 0], [...c, 255], 11, 0, e.kind === 'copy' ? 55 : 50);
}
plates.build(); deco.build(); t3.build(); floor.build(); pinsR.build();
// per-wall T3 ranges (t3 rects were added in wall order)
const t3Range = (() => { // recount exactly as emitted
  const r = []; let first = 0;
  for (const w of W) { let n = 0; snapJ[w.s].files.forEach((f, k) => { let a = w.fileL[k] + core.HDR, e = a + f.n; while (a < e) { const r0 = a % H, r1 = Math.min(H, r0 + (e - a)); n++; a += r1 - r0; } }); r.push([first, n]); first += n; }
  return r; })();
// segments buffer
function makeSegBuf(segs) {
  const n = segs.length, ab = new ArrayBuffer(n * 24), f32 = new Float32Array(ab), u8 = new Uint8Array(ab);
  segs.forEach((v, i) => { f32.set(v.slice(0, 4), i * 6); u8[i * 24 + 16] = v[4]; u8[i * 24 + 17] = v[5]; u8.set(v[6], i * 24 + 20); });
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 2, gl.UNSIGNED_BYTE, 24, 16);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 20);
  gl.bindVertexArray(null); gpuBytes += n * 24; return { vao, n };
}
const segBuf = makeSegBuf(segs), holeBuf = makeSegBuf(holeSegs), streetBuf = makeSegBuf(streetSegs);
// labels buffer: aP(4f) aU(3f) aV(3f) aT(2u32) aC(4u8n) aK(2f) -> 64 bytes; decluttered labels add aD (alpha, shift) at location 6
const labTex = (() => { const rows = Math.ceil(labLen / 4096) + 1, arr = new Uint8Array(rows * 4096); arr.set(labStore);
  gpuBytes += rows * 4096; return G.tex2D(gl, 4096, rows, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, arr); })();
function makeLabBuf(list, dynamic) {
  const n = list.length, ab = new ArrayBuffer(n * 64), f32 = new Float32Array(ab), u32 = new Uint32Array(ab), u8 = new Uint8Array(ab);
  list.forEach((l, i) => { f32.set(l.slice(0, 10), i * 16); u32[i * 16 + 10] = l[10]; u32[i * 16 + 11] = l[11]; u8.set(l[12], i * 64 + 48); f32[i * 16 + 13] = l[13]; f32[i * 16 + 14] = l[14]; });
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);
  const A = (loc, n, type, off, norm = false, int = false) => { gl.enableVertexAttribArray(loc); if (int) gl.vertexAttribIPointer(loc, n, type, 64, off); else gl.vertexAttribPointer(loc, n, type, norm, 64, off); gl.vertexAttribDivisor(loc, 1); };
  A(0, 4, gl.FLOAT, 0); A(1, 3, gl.FLOAT, 16); A(2, 3, gl.FLOAT, 28); A(3, 2, gl.UNSIGNED_INT, 40, false, true); A(4, 4, gl.UNSIGNED_BYTE, 48, true); A(5, 2, gl.FLOAT, 52);
  let dyn = null;
  if (dynamic) { dyn = { buf: gl.createBuffer(), data: new Float32Array(2 * n) };
    gl.bindBuffer(gl.ARRAY_BUFFER, dyn.buf); gl.bufferData(gl.ARRAY_BUFFER, dyn.data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 2, gl.FLOAT, false, 8, 0); gl.vertexAttribDivisor(6, 1); }
  gl.bindVertexArray(null);
  gpuBytes += n * 64; return { vao, n, dyn };
}
const labBuf = makeLabBuf(labels, false), dlabBuf = makeLabBuf(dlabels, true);
// ---- declutter (CPU, per frame): the same size rules as labelVS, greedy by priority with a grid of placed screen boxes
const DL = { cur: new Float32Array(dlabels.length), shift: new Int8Array(dlabels.length), shown: 0, hidden: 0, moved: 0 };
V.declutter = DL;
// static per-label numbers, so the per-frame pass allocates nothing: base point, |U|, |V|, U, V, kind
const DLS = dlabels.map(l => ({ w: l[3], z: l[0], y: l[1], dx: l[2], lu: Math.hypot(l[4], l[5], l[6]), lv: Math.hypot(l[7], l[8], l[9]),
  U: [l[4], l[5], l[6]], Vv: [l[7], l[8], l[9]], L: l[11], bb: l[13], maxPx: l[14], prio: l[15], wallPlane: l[13] < 0.5 && l[4] === 0 && l[7] === 0 }));
function declutter(dt, rgt, up, minPx) {
  const fp = focalPx(), cw = canvas.width, ch = canvas.height, cam = V.cam.p, M = VP;
  let ox = 0, oy = 0, ok = false;
  const proj = (x, y, z) => { const w = M[3] * x + M[7] * y + M[11] * z + M[15]; if (w <= 1) { ok = false; return; }
    ox = ((M[0] * x + M[4] * y + M[8] * z + M[12]) / w + 1) * 0.5 * cw; oy = (1 - (M[1] * x + M[5] * y + M[9] * z + M[13]) / w) * 0.5 * ch; ok = true; };
  const cand = DL.cand || (DL.cand = []); cand.length = 0;
  const occW = W.filter(ww => V.WA[ww.s]);
  for (let i = 0; i < DLS.length; i++) {
    const l = DLS[i], w = l.w, wa = w < 64 ? V.WA[w] : 1; if (wa <= 0) continue;
    const o0 = (w < 64 ? V.WX[w] : 0) + l.dx, o1 = l.y, o2 = l.z;
    if (l.wallPlane && cam[0] > o0) continue;
    const d = Math.hypot(o0 - cam[0], o1 - cam[1], o2 - cam[2]); let px = l.lv * 2 * fp / Math.max(d, 1), k = 1;
    if (l.bb > 1.5 && px < l.bb) { k = l.bb / px; px = l.bb; }
    if (px < minPx || (l.maxPx > 0 && px > l.maxPx)) continue;
    let U0, U1, U2, V0, V1, V2;
    if (l.bb > 0.5) { U0 = rgt[0] * l.lu * k; U1 = rgt[1] * l.lu * k; U2 = rgt[2] * l.lu * k; V0 = up[0] * l.lv * k; V1 = up[1] * l.lv * k; V2 = up[2] * l.lv * k; }
    else { U0 = l.U[0]; U1 = l.U[1]; U2 = l.U[2]; V0 = l.Vv[0]; V1 = l.Vv[1]; V2 = l.Vv[2]; }
    // drawn without depth test, so hide a label whose centre is behind a wall (analytic, like picking)
    const c0 = o0 + U0 * l.L / 2 - V0, c1 = o1 + U1 * l.L / 2 - V1, c2 = o2 + U2 * l.L / 2 - V2, dx = c0 - cam[0];
    let occluded = false;
    if (Math.abs(dx) > 1e-6) for (const ww of occW) {
      if (ww.s === w) continue;
      const t = (V.WX[ww.s] - cam[0]) / dx; if (t <= 0 || t >= 0.999) continue;
      const y = cam[1] + t * (c1 - cam[1]); if (y <= -6 || y >= 4102) continue;
      const z = cam[2] + t * (c2 - cam[2]); if (z > ww.z0 && z < ww.z0 + ww.cols * 128 - 4) { occluded = true; break; }
    }
    if (occluded) continue;
    cand.push({ i, o0, o1, o2, U0, U1, U2, V0, V1, V2, L: l.L, bb: l.bb > 0.5, pr: l.prio + (DL.cur[i] > 0.5 ? 0.5 : 0) });
  }
  cand.sort((a, b) => b.pr - a.pr);
  const grid = new Map(), G0 = 96;
  // visible UI panels count as occupied, so labels do not hide under the legend or the timeline
  if (!DL.panels || performance.now() - DL.panelsT > 500) { DL.panelsT = performance.now(); const k = cw / Math.max(1, canvas.clientWidth);
    DL.panels = [...document.querySelectorAll('.panel')].filter(e => e.getClientRects().length && e.id !== 'tip' && e.id !== 'loading').map(e => { const b = e.getBoundingClientRect(); return [b.left * k, b.top * k, b.right * k, b.bottom * k]; }); }
  const hit = (r) => { for (let gx = Math.floor(r[0] / G0); gx <= Math.floor(r[2] / G0); gx++) for (let gy = Math.floor(r[1] / G0); gy <= Math.floor(r[3] / G0); gy++) {
    const c = grid.get(gx * 65536 + gy); if (c) for (const q of c) if (q[0] < r[2] && r[0] < q[2] && q[1] < r[3] && r[1] < q[3]) return true; } return false; };
  const put = (r) => { for (let gx = Math.floor(r[0] / G0); gx <= Math.floor(r[2] / G0); gx++) for (let gy = Math.floor(r[1] / G0); gy <= Math.floor(r[3] / G0); gy++) {
    const k = gx * 65536 + gy; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(r); } };
  for (const r of DL.panels) put(r);
  const target = DL.target || (DL.target = new Uint8Array(dlabels.length)); target.fill(0); let moved = 0, placed = 0;
  const SH = [0, 0, 1, -1, 2, -2];
  for (const c of cand) {
    const nsh = c.bb ? 6 : 1; SH[0] = DL.shift[c.i];
    for (let q = 0; q < nsh; q++) {
      const sh = c.bb ? SH[q] : 0, b0 = c.o0 - 2 * c.V0 * sh, b1 = c.o1 - 2 * c.V1 * sh, b2 = c.o2 - 2 * c.V2 * sh;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, bad = false;
      for (let e = 0; e < 4 && !bad; e++) { const a = (e & 1) ? c.L : 0, v = (e & 2) ? 2 : 0;
        proj(b0 + c.U0 * a - c.V0 * v, b1 + c.U1 * a - c.V1 * v, b2 + c.U2 * a - c.V2 * v); if (!ok) { bad = true; break; }
        if (ox < x0) x0 = ox; if (ox > x1) x1 = ox; if (oy < y0) y0 = oy; if (oy > y1) y1 = oy; }
      if (bad) break;
      const r = [x0 - 3, y0 - 2, x1 + 3, y1 + 2];
      if (r[2] < 0 || r[0] > cw || r[3] < 0 || r[1] > ch) { target[c.i] = 1; DL.shift[c.i] = sh; break; }   // off screen: nothing to collide with
      if (r[2] - r[0] > cw * 1.5) break;
      if (!hit(r)) { put(r); placed++; target[c.i] = 1; if (sh) moved++; DL.shift[c.i] = sh; break; }
    }
  }
  const k = Math.min(1, dt * 10); let shown = 0; const data = dlabBuf.dyn.data;
  for (let i = 0; i < dlabels.length; i++) {
    let cv = DL.cur[i] + (target[i] - DL.cur[i]) * k; if (!target[i] && cv < 0.02) cv = 0; DL.cur[i] = cv;
    if (target[i]) shown++;
    data[2 * i] = cv; data[2 * i + 1] = DL.shift[i];
  }
  Object.assign(DL, { shown, hidden: cand.length - shown, moved, placed, candidates: cand.length });
  gl.bindBuffer(gl.ARRAY_BUFFER, dlabBuf.dyn.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
}
const emptyVAO = gl.createVertexArray();

// ------------------------------------------------------------------ workers
const dw = new Worker(new URL('./w_decode.js', import.meta.url), { type: 'module' });
const tw = new Worker(new URL('./w_text.js', import.meta.url), { type: 'module' });
dw.postMessage({ type: 'init', man, layout, snapJ: Object.fromEntries(snapJ.map((j, i) => [i, j])) });
let presReady = 0, normReady = false; const presCPU = new Uint32Array(man.raw_lines * 2);
V.presCPU = presCPU;
const morphCache = new Map(); let morphOnGPU = null; const textReq = new Map(); let reqN = 0;
dw.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'wall') {
    const w = W[m.snap];
    Object.assign(w, { inst: m.inst, P: m.P, fileStart: m.fileStart, fileOfInst: m.fileOfInst, colStart: m.colStart, loaded: true });
    G.uploadLinear(gl, instTex, INSTW, w.base, m.inst, 2, gl.RG_INTEGER, gl.UNSIGNED_INT);
    V.load.walls++; w.impKey = '';
    if (V.blame) dw.postMessage({ type: 'blame', snap: w.s, commitAuthor: V.blame.commitAuthor });
    if (V.load.walls === NS) V.load.allWalls = performance.now() - t0Boot;
    emit('wall', w);
  } else if (m.type === 'blame') {
    const w = W[m.snap]; if (m.missing) return;
    G.uploadLinear(gl, authTex, INSTW, w.base, m.auth, 1, gl.RED_INTEGER, gl.UNSIGNED_SHORT);
    w.commit = m.commit; w.authHist = new Map(m.hist);
    for (const [a, n] of m.hist) if (a !== 0xFFFF) V.blame.total[a] += n;
    V.load.blame = (V.load.blame || 0) + 1; authorPalette();
    if (V.mode === 4) invalidateImpostors();
    emit('blame', w);
  } else if (m.type === 'morph') {
    morphCache.set(m.key, m); if (morphCache.size > 8) morphCache.delete(morphCache.keys().next().value);
    emit('morph', m);
  }
};
tw.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'chunk') {
    // folded rows -> text array texture (split at layer boundaries)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, textTex);
    let r = 0;
    while (r < m.rows) { const gr = m.row0 + r, layer = gr >> 12, y = gr & 4095, k = Math.min(m.rows - r, 4096 - y);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, y, layer, 4096, k, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, m.bytes.subarray(r * 4096, (r + k) * 4096)); r += k; }
    G.uploadLinear(gl, offsTex, LW, m.first, m.offs, 1, gl.RED_INTEGER, gl.UNSIGNED_INT);
    const pr = new Uint32Array(m.pres.buffer, m.pres.byteOffset, m.count * 2);
    presCPU.set(pr, m.first * 2);
    G.uploadLinear(gl, presTex, LW, m.first, pr, 2, gl.RG_INTEGER, gl.UNSIGNED_INT);
    V.load.text++; presReady = 1;
    if (V.load.text === man.text_chunks) { V.load.allText = performance.now() - t0Boot; }
    emit('text');
  } else if (m.type === 'norm') { normReady = true; dw.postMessage({ type: 'norm', norm: m.norm, blank: m.blank }); morphCache.clear(); V.normLines = m.normLines; }
  else if (m.type === 'text' || m.type === 'search') { const f = textReq.get(m.req); textReq.delete(m.req); if (f) f(m); }
};
V.lineText = ids => new Promise(res => { const req = ++reqN; textReq.set(req, m => res(m.text)); tw.postMessage({ type: 'text', req, ids }); });
V.search = (q, opts) => new Promise(res => { const req = ++reqN; textReq.set(req, res); tw.postMessage({ type: 'search', req, q, ...opts }); });
let marksOn = false;
V.setMarks = (ids) => { if (!ids && !marksOn) return; marksOn = !!ids; markArr.fill(0); if (ids) for (const i of ids) markArr[i] = 1; gl.bindTexture(gl.TEXTURE_2D, markTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LW, LH, gl.RED_INTEGER, gl.UNSIGNED_BYTE, markArr); invalidateImpostors(); };
V.requestMorph = (a, b) => { const key = `${a}>${b}${normReady ? '' : '~'}`; if (morphCache.has(key)) return morphCache.get(key); if (!V._mreq?.has(key)) { (V._mreq ||= new Set()).add(key); dw.postMessage({ type: 'morph', a, b, key }); } return null; };

// load linemeta (bars need it), then text in the order the start view needs
gz('data/linemeta.bin.gz').then(meta => {
  const arr = new Uint8Array(LW * LH * 2); arr.set(meta);
  gl.bindTexture(gl.TEXTURE_2D, metaTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LW, LH, gl.RG_INTEGER, gl.UNSIGNED_BYTE, arr);
  V.load.meta = performance.now() - t0Boot; emit('meta');
});

// ------------------------------------------------------------------ camera
const keys = new Set();
function camBasis() {
  const c = V.cam, cp = Math.cos(c.pitch);
  const f = [cp * Math.cos(c.yaw), Math.sin(c.pitch), cp * Math.sin(c.yaw)];
  const r = G.norm(G.cross(f, [0, 1, 0])), u = G.cross(r, f);
  return { f, r, u };
}
V.camBasis = camBasis;
function setLook(dir) { const d = G.norm(dir); V.cam.yaw = Math.atan2(d[2], d[0]); V.cam.pitch = Math.asin(Math.max(-1, Math.min(1, d[1]))); }
V.setLook = setLook;
// smooth fly-to (zoom out, pan, zoom in)
V.flyTo = (p, dir, dur) => {
  const c = V.cam, p0 = c.p.slice(), d0 = camBasis().f, dist = Math.hypot(p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]);
  dur = dur ?? Math.min(2.5, Math.max(0.8, 0.45 * Math.log10(1 + dist)));
  V.flight = { p0, p1: p.slice(), d0, d1: G.norm(dir), t: 0, dur, lift: Math.min(dist * 0.35, 60000) };
};
function stepFlight(dt) {
  const F = V.flight; if (!F) return;
  F.t += dt / F.dur; const t = Math.min(1, F.t), s = t * t * (3 - 2 * t);
  const p = F.p0.map((v, i) => v + (F.p1[i] - v) * s); p[1] += Math.sin(Math.PI * s) * F.lift;
  const back = camBasis().f; void back;
  V.cam.p = p; setLook(F.d0.map((v, i) => v + (F.d1[i] - v) * s));
  if (t >= 1) V.flight = null;
}
// position to look at wall s column/row from a distance
V.wallView = (s, col, row, dist) => {
  const w = W[s]; const z = w.z0 + col * 128 + 60, y = 4096 - row * 2;
  return { p: [V.WX[s] - dist, y, z], dir: [1, 0, 0] };
};
V.fitWall = (s) => {
  const w = W[s], wid = w.cols * 128, aspect = canvas.width / canvas.height;
  const d = Math.max(wid / 2 / (Math.tan(FOV / 2) * aspect), 2300 / Math.tan(FOV / 2)) * 1.08;
  return { p: [V.WX[s] - d, 2048, w.z0 + wid / 2], dir: [1, 0, 0] };
};
// fit an axis-aligned box [[x0,y0,z0],[x1,y1,z1]] into the part of the screen the panels leave free, looking along f
V.fitBox = (bb, f, pts = null) => {   // pts: fit these points instead of the box corners (the box still gives the start)
  const aspect = canvas.clientWidth / canvas.clientHeight, [a, b] = bb;
  const box = pts || []; if (!pts) for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) box.push([x, y, z]);
  const free = (() => { const W0 = innerWidth, H0 = innerHeight, r = id => { const e = document.getElementById(id); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; };
    const lg = r('legend'), tl = r('timeline'), hud = r('hud');
    return [-0.96, lg ? 2 * (lg.left - 12) / W0 - 1 : 0.96, tl ? 1 - 2 * (tl.top - 8) / H0 : -0.96, hud ? 1 - 2 * (hud.bottom + 8) / H0 : 0.92]; })();
  f = G.norm(f); const rgt = G.norm(G.cross(f, [0, 1, 0])), up = G.cross(rgt, f), th = Math.tan(FOV / 2);
  let tgt = [0, 1, 2].map(i => (a[i] + b[i]) / 2), d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let it = 0; it < 40; it++) {
    const eye = tgt.map((v, i) => v - f[i] * d); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of box) { const v = c.map((q, i) => q - eye[i]), z = Math.max(1, G.dot(v, f)); const nx = G.dot(v, rgt) / (z * th * aspect), ny = G.dot(v, up) / (z * th);
      x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny); }
    const sc = Math.max((x1 - x0) / (free[1] - free[0]), (y1 - y0) / (free[3] - free[2]));
    const cx = (x0 + x1) / 2 - (free[0] + free[1]) / 2, cy = (y0 + y1) / 2 - (free[2] + free[3]) / 2;
    tgt = tgt.map((v, i) => v + rgt[i] * cx * d * th * aspect * 0.8 + up[i] * cy * d * th * 0.8);
    d *= 1 + (sc - 1) * 0.8;
  }
  return { p: tgt.map((v, i) => v - f[i] * d), dir: f };
};
V.wallsBox = (ss) => { const ws = ss.map(s => W[s]); return [[Math.min(...ws.map(w => V.WX[w.s])) - 2000, 0, Math.min(...ws.map(w => w.z0))], [Math.max(...ws.map(w => V.WX[w.s])), 4600, Math.max(...ws.map(w => w.z0 + w.cols * 128))]]; };
// overview: the whole scene (all walls, the ruler, the fpgadc banner)
V.overview = () => {   // fit the walls and the ruler: the lanes start later the further out they are, so the full box is half empty
  const zMax = layout.lanes.at(-1).z0 + layout.lanes.at(-1).width, pts = [];
  for (const w of W) for (const y of [0, 4600]) pts.push([V.WX[w.s], y, w.z0], [V.WX[w.s], y, w.z0 + w.cols * 128]);
  pts.push([-6000, 0, -6000], [Xmax, 0, -6000]);
  return V.fitBox([[-9000, 0, -6000], [Xmax, 4600, zMax]], V.Q.get('ovdir') ? V.Q.get('ovdir').split(',').map(Number) : [0.5, -0.62, -0.6], pts); };
V.fileView = (s, k, line = 0) => {
  const w = W[s], L0 = w.fileL[k] + (line > 0 ? core.HDR + line - 1 : 0), col = Math.floor(L0 / H), row = L0 % H;
  const dist = 2 * focalPx() / (V.quality.t0 + 5);
  return V.wallView(s, col, Math.min(H - 1, row + (line > 0 ? 0 : Math.round(dist * 0.25))), dist);
};
V.flyToFile = (s, k, line) => { const v = V.fileView(s, k, line); V.flyTo(v.p, v.dir); };
function focalPx() { return canvas.height / (2 * Math.tan(FOV / 2)); }
V.focalPx = focalPx;

// input
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
  keys.add(e.code); emit('key', e);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, moved: 0, b: e.button }; });
addEventListener('mouseup', e => { if (drag && drag.moved < 4 && e.target === canvas) emit('click', e); drag = null; });
addEventListener('mousemove', e => {
  V.mouse = { x: e.clientX, y: e.clientY, over: e.target === canvas };
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    if (drag.moved >= 4) { V.flight = null; V.cam.yaw += dx * 0.0035; V.cam.pitch = Math.max(-1.55, Math.min(1.55, V.cam.pitch - dy * 0.0035)); } }
});
canvas.addEventListener('dblclick', e => emit('dblclick', e));
canvas.addEventListener('wheel', e => { e.preventDefault(); V.cam.speed = Math.max(10, Math.min(100000, V.cam.speed * Math.exp(-e.deltaY * 0.0015))); }, { passive: false });

function moveCam(dt) {
  if (V.flight) { stepFlight(dt); return; }
  const { f, r } = camBasis(); let m = [0, 0, 0], any = false;
  const add = (v, s) => { m[0] += v[0] * s; m[1] += v[1] * s; m[2] += v[2] * s; any = true; };
  if (keys.has('KeyW')) add(f, 1); if (keys.has('KeyS')) add(f, -1);
  if (keys.has('KeyD')) add(r, 1); if (keys.has('KeyA')) add(r, -1);
  if (keys.has('KeyE') || keys.has('Space')) add([0, 1, 0], 1); if (keys.has('KeyQ') || keys.has('KeyC')) add([0, 1, 0], -1);
  if (!any) return;
  let sp = V.cam.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1) / (keys.has('ControlLeft') ? 4 : 1);
  V.cam.p = V.cam.p.map((v, i) => v + m[i] * sp * dt);
}

// ------------------------------------------------------------------ time: gallery / now
function eventX(t) { // camera / plane X at event time t
  const k = Math.max(0, Math.min(NS - 1, Math.floor(t))), f = Math.max(0, Math.min(1, t - k));
  const xa = W[events[k]].x, xb = W[events[Math.min(NS - 1, k + 1)]].x; return xa + (xb - xa) * f;
}
V.eventX = eventX;
function updateWalls() {
  V.noLines.fill(0); V.morph = null;
  if (V.pres === 'gallery') { for (const w of W) { V.WX[w.s] = w.x; V.WA[w.s] = 1; } return; }
  const t = V.t, k = Math.floor(t + 1e-6), f = t - k, plane = eventX(t);
  V.WA.fill(0);
  for (let li = 0; li < layout.lanes.length; li++) {
    let live = -1; for (const s of laneSnapsByEvent[li]) if (eventOf[s] <= k) live = s;
    if (live >= 0) { V.WX[live] = plane; V.WA[live] = 1; }
  }
  // arriving snapshot morphs in from its parent over the first 60 % of the step
  const b = k + 1 < NS ? events[k + 1] : -1;
  if (b >= 0 && f > 0) {
    const u = Math.min(1, f / 0.6), wb = W[b];
    const sameLane = laneSnapsByEvent[wb.lane].filter(s => eventOf[s] < eventOf[b]);
    const a = sameLane.length ? sameLane.at(-1) : wb.parent;
    if (u < 1 && a >= 0) {
      const m = V.requestMorph(a, b);
      if (sameLane.length) V.WA[a] = 0;
      V.WX[b] = plane; V.WA[b] = 1; V.noLines[b] = 1;
      if (m) V.morph = { a, b, u, m };
      else V.noLines[b] = 0;
    } else { if (sameLane.length) V.WA[sameLane.at(-1)] = 0; V.WX[b] = plane; V.WA[b] = 1; }
  }
}

// ------------------------------------------------------------------ impostors
const IMPW = SOFT ? 2 : 4, IMPH = SOFT ? 512 : 1024;
let impVersion = 0;
function invalidateImpostors() { impVersion++; }
V.invalidateImpostors = invalidateImpostors;
function impKey(w) { return `${V.mode}|${V.hideInc}|${impVersion}`; }
// incremental bake: a column range per call, scissor-cleared, so a rebake replaces columns in place
function bake(w, budget) {
  if (!w.imp) {
    const tex = G.tex2D(gl, w.cols * IMPW, IMPH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR_MIPMAP_LINEAR);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    w.imp = { tex, fbo, ready: false }; gpuBytes += w.cols * IMPW * IMPH * 4 * 1.34;
  }
  const key = impKey(w);
  if (!w.bk || w.bk.key !== key) w.bk = { key, c: 0 };
  let c1 = w.bk.c; const a = w.colStart[w.bk.c];
  while (c1 < w.cols && (c1 === w.bk.c || w.colStart[c1 + 1] - a <= budget)) c1++;
  const n = w.colStart[c1] - a;
  gl.bindFramebuffer(gl.FRAMEBUFFER, w.imp.fbo); gl.viewport(0, 0, w.cols * IMPW, IMPH);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST); gl.scissor(w.bk.c * IMPW, 0, (c1 - w.bk.c) * IMPW, IMPH);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  if (n > 0) {
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    useLine(P.line, w); gl.uniform1i(P.line.u.uBake, 1); gl.uniform1f(P.line.u.uBakeW, w.cols * 128);
    gl.uniform2i(P.line.u.uHi, -1, -1); gl.uniform1i(P.line.u.uBase, w.base + a);
    gl.bindVertexArray(emptyVAO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.uniform1i(P.line.u.uBake, 0);
  }
  gl.disable(gl.SCISSOR_TEST);
  w.bk.c = c1;
  if (c1 >= w.cols) {
    gl.bindTexture(gl.TEXTURE_2D, w.imp.tex); gl.generateMipmap(gl.TEXTURE_2D);
    w.impKey = key; w.imp.ready = true; w.bk = null; V.stats.baked++;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return n;
}

// ------------------------------------------------------------------ draw helpers
let VP, camP, camF, planes;
function bindTex(unit, target, tex, prog, name) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, tex); if (prog.u[name]) gl.uniform1i(prog.u[name], unit); }
function common(prog) {
  gl.useProgram(prog.p);
  if (prog.u.uVP) gl.uniformMatrix4fv(prog.u.uVP, false, VP);
  if (prog.u.uCam) gl.uniform3fv(prog.u.uCam, camP);
  if (prog.u.uFwd) gl.uniform3fv(prog.u.uFwd, camF);
  if (prog.u.uFocal) gl.uniform1f(prog.u.uFocal, focalPx());
  if (prog.u.uWX) gl.uniform1fv(prog.u.uWX, V.WX);
  if (prog.u.uWA) gl.uniform1fv(prog.u.uWA, V.WA);
}
function setupLineProg(prog) {
  common(prog);
  bindTex(0, gl.TEXTURE_2D, prog === P.morph ? morphTex : instTex, prog, 'uInst');
  bindTex(1, gl.TEXTURE_2D, metaTex, prog, 'uMeta'); bindTex(2, gl.TEXTURE_2D, offsTex, prog, 'uOffs');
  bindTex(3, gl.TEXTURE_2D_ARRAY, textTex, prog, 'uText'); bindTex(4, gl.TEXTURE_2D, atlasTex, prog, 'uAtlas');
  bindTex(5, gl.TEXTURE_2D, palTex, prog, 'uPal'); bindTex(6, gl.TEXTURE_2D, presTex, prog, 'uPres');
  bindTex(7, gl.TEXTURE_2D, markTex, prog, 'uMark'); bindTex(8, gl.TEXTURE_2D, possTex, prog, 'uPoss');
  bindTex(10, gl.TEXTURE_2D, authTex, prog, 'uAuth');
  gl.uniform1i(prog.u.uMode, V.mode); gl.uniform1i(prog.u.uHideInc, V.hideInc ? 1 : 0); gl.uniform1f(prog.u.uT0, V.quality.t0);
  gl.uniform1i(prog.u.uBake, 0); gl.uniform1i(prog.u.uPresReady, presReady);
  if (prog.u.uDenseMorph) gl.uniform1i(prog.u.uDenseMorph, 1);
  if (prog.u.uMorphGlyph) gl.uniform1i(prog.u.uMorphGlyph, 1);
}
function useLine(prog, w) {
  setupLineProg(prog);
  gl.uniform1i(prog.u.uBase, w.base); gl.uniform1f(prog.u.uWallX, V.WX[w.s]); gl.uniform1f(prog.u.uZ0, w.z0);
  gl.uniform1i(prog.u.uWall, w.s); gl.uniform1i(prog.u.uParent, w.parent);
}
function wallUniforms(prog, w) {
  gl.uniform1i(prog.u.uBase, w.base); gl.uniform1f(prog.u.uWallX, V.WX[w.s]); gl.uniform1f(prog.u.uZ0, w.z0);
  gl.uniform1i(prog.u.uWall, w.s); gl.uniform1i(prog.u.uParent, w.parent);
  const h = V.hi && V.hi.s === w.s ? V.hi : null;
  gl.uniform2i(prog.u.uHi, h ? w.base + h.a : -1, h ? w.base + h.b : -1);
}

// ------------------------------------------------------------------ pipeline warm-up
// ANGLE builds a pipeline per (program, blend / depth state, vertex layout, topology, target) the first time a draw needs
// it; on llvmpipe (lavapipe) each build of the line shader takes up to seconds. Issue every combination the frame uses once,
// with all vertices collapsed to one point (no fragments), while the loading banner is up.
function warmup() {
  const t0 = performance.now(), zero = new Float32Array(16);
  VP = zero; camP = new Float32Array(3); camF = new Float32Array([1, 0, 0]); planes = [];
  const run = (target) => {
    if (target === 'bake') { if (!warmup.fbo) { const t = G.tex2D(gl, 4, 4, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR_MIPMAP_LINEAR); warmup.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, warmup.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, warmup.fbo); gl.viewport(0, 0, 4, 4); gl.disable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 4, 4);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); useLine(P.line, W[0]); gl.uniform1i(P.line.u.uBake, 1);
      gl.bindVertexArray(emptyVAO); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1); gl.uniform1i(P.line.u.uBake, 0); gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); return; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.depthMask(true);
    common(P.rect); bindTex(5, gl.TEXTURE_2D, palTex, P.rect, 'uPal');
    gl.bindVertexArray(plates.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(deco.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    gl.depthMask(false);
    common(P.imp); gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    setupLineProg(P.line); wallUniforms(P.line, W[0]); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    setupLineProg(P.morph); gl.uniform1i(P.morph.u.uStride, 1); gl.uniform1i(P.morph.u.uBase, 0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    common(P.seg); gl.bindVertexArray(segBuf.vao); gl.drawArrays(gl.LINES, 0, 2);
    common(P.label); gl.bindVertexArray(labBuf.vao); gl.vertexAttrib2f(6, 1, 0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(dlabBuf.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1); gl.enable(gl.DEPTH_TEST);
    gl.bindVertexArray(null); gl.depthMask(true);
  };
  run('main'); run('bake');
  const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // wait for the builds here, not mid-flight
  V.load.warmupMs = performance.now() - t0;
}

// ------------------------------------------------------------------ frame
const syncPx = new Uint8Array(4);
const tqRing = []; let lastT = performance.now(), hudT = 0, frameN = 0, lastPresent = 0;
const frameTimes = [];
// frame pacing: at most two frames in flight. Without this, a browser running without vsync (and llvmpipe at any rate) lets
// the page queue seconds of GPU work; the next synchronous GL call (a texture allocation, a canvas resize) then waits for
// all of it, which is what produced the 1-3 s stalls during Now-mode morphs on llvmpipe.
const fences = []; V.stats.skipped = 0;
function gpuBusy() {
  while (fences.length && gl.getSyncParameter(fences[0], gl.SYNC_STATUS) === gl.SIGNALED) gl.deleteSync(fences.shift());
  return fences.length >= 2;
}
// per-section CPU times of the slowest frames (bench output), so spikes can be attributed
const PROF = { t: 0, cur: [], worst: [] };
function PM(name) { const t = performance.now(); PROF.cur.push([name, +(t - PROF.t).toFixed(2)]); PROF.t = t; }
V.prof = PROF;
function frame(now) {
  requestAnimationFrame(frame);
  if (gpuBusy()) { V.stats.skipped++; return; }
  if (SOFT && !V.bench && now - lastPresent < 30) return;   // llvmpipe: cap ~30 fps
  lastPresent = now;
  const rawDt = now - lastT, dt = Math.min(0.1, rawDt / 1000); lastT = now; frameN++;
  const c0 = performance.now(); PROF.t = c0; PROF.cur = [];
  V.stats.dt.push(rawDt); V.lastRawDt = rawDt; if (V.stats.dt.length > 240) V.stats.dt.shift();
  emit('tick', dt);
  if (V.playing) { V.t = Math.min(NS - 1, V.t + dt * V.playSpeed / 2.5); if (V.t >= NS - 1) V.playing = false; emit('time'); }
  const prevPlane = V.pres === 'now' ? eventX(V._lastT ?? V.t) : 0;
  updateWalls();
  if (V.pres === 'now' && V.follow !== false && !V.flight) { const d = eventX(V.t) - prevPlane; V.cam.p[0] += d; }
  V._lastT = V.t;
  moveCam(dt);
  // resize
  const scale = V.quality.scale * (devicePixelRatio || 1);
  const cw = Math.max(1, Math.round(canvas.clientWidth * scale)), ch = Math.max(1, Math.round(canvas.clientHeight * scale));
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  // matrices
  const { f, r, u } = camBasis(); camP = new Float32Array(V.cam.p); camF = new Float32Array(f);
  // near plane from the nearest visible wall
  let nearest = 1e9;
  for (const w of W) { if (!V.WA[w.s]) continue; const d = G.boxDist(V.cam.p, V.WX[w.s] - 1, -10, w.z0, V.WX[w.s] + 1, 4600, w.z0 + w.cols * 128); nearest = Math.min(nearest, d); }
  const near = Math.max(1, Math.min(4000, nearest * 0.4)), far = Math.max(near * 10, 900000);
  VP = G.mul(G.perspective(FOV, cw / ch, near, far), G.lookDir(V.cam.p, f));
  planes = G.frustumPlanes(VP);
  V.VP = VP;
  // GPU timer
  let q = null;
  if (tq) { q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); }

  PM('lod0');
  // ---- LOD selection
  const fp = focalPx(); const T1 = V.quality.t1min;
  if (V.morph) { // far morphs are sub-pixel: show the arriving wall (impostor) instead
    const wb = W[V.morph.b], x = V.WX[wb.s];
    const pp = 2 * fp / Math.max(1, G.boxDist(V.cam.p, x, 0, Math.min(wb.z0, W[V.morph.a].z0), x, 4096, Math.max(wb.z0 + wb.cols * 128, W[V.morph.a].z0 + W[V.morph.a].cols * 128)));
    if (pp < T1 * 0.25) { V.noLines[wb.s] = 0; V.morph = null; }
  }
  const lineRuns = [], impRuns = [], t3Walls = [], bakeCand = [], nearWalls = [];
  let budget = V.quality.maxInst, inst = 0;
  for (const w of W) {
    if (!V.WA[w.s]) continue;
    const x = V.WX[w.s], z1 = w.z0 + w.cols * 128;
    if (!G.boxVisible(planes, x - 1, -10, w.z0, x + 1, 4110, z1)) continue;
    if (V.cam.p[0] > x) continue;                          // behind: plate only
    const dW = G.boxDist(V.cam.p, x, 0, w.z0, x, 4096, z1), pW = 2 * fp / Math.max(dW, 1);
    if (pW >= (SOFT ? T1 : 0.08)) nearWalls.push(w);
    if (!w.loaded) { t3Walls.push(w); continue; }
    const stale = w.impKey !== impKey(w);
    if (pW < T1) { if (w.imp && w.imp.ready) impRuns.push([w, 0, w.cols]); else t3Walls.push(w); if (stale) bakeCand.push([dW, w]); continue; }
    if (V.noLines[w.s]) continue;
    let run = null, irun = null;
    for (let c = 0; c < w.cols; c++) {
      const za = w.z0 + c * 128, zb = za + 124;
      if (!G.boxVisible(planes, x - 1, -10, za, x + 1, 4110, zb)) { run = irun = null; continue; }
      const d = G.boxDist(V.cam.p, x, 0, za, x, 4096, zb), ppl = 2 * fp / Math.max(d, 1);
      if (ppl >= T1) { irun = null; if (run && run[2] === c) run[2] = c + 1; else { run = [w, c, c + 1, d]; lineRuns.push(run); } run[3] = Math.min(run[3], d); }
      else { run = null; if (irun && irun[2] === c) irun[2] = c + 1; else { irun = [w, c, c + 1]; impRuns.push(irun); } }
    }
    if (stale) bakeCand.push([dW, w]);
  }
  // nearest runs first under the instance budget; the rest fall back to impostors
  lineRuns.sort((a, b) => a[3] - b[3]);
  const drawRuns = [];
  for (const rr of lineRuns) { const w = rr[0], n = w.colStart[rr[2]] - w.colStart[rr[1]]; if (n === 0) continue;
    if (inst + n > budget && drawRuns.length) { impRuns.push([w, rr[1], rr[2]]); continue; } inst += n; drawRuns.push(rr); }
  PM('lod');
  // bake budget
  bakeCand.sort((a, b) => a[0] - b[0]);
  let bakeBudget = SOFT ? 40000 : 1500000; const nb = bakeCand.length;
  for (let i = 0; i < bakeCand.length && bakeBudget > 0; i++) bakeBudget -= Math.max(1, bake(bakeCand[i][1], bakeBudget));
  // background: pre-bake walls that are not visible yet, so later views do not stall
  let unbaked = 0;
  for (const w of W) if (w.loaded && w.impKey !== impKey(w)) { unbaked++; if (bakeBudget > 0 && !bakeCand.some(b => b[1] === w)) bakeBudget -= Math.max(1, bake(w, bakeBudget)); }
  V.stats.unbaked = unbaked;

  PM('bake');
  // ---- draw
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch);
  gl.clearColor(0.043, 0.051, 0.071, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.depthMask(true);
  let draws = 0;
  // plates (opaque depth prepass) + floor
  common(P.rect); bindTex(5, gl.TEXTURE_2D, palTex, P.rect, 'uPal'); gl.uniform1i(P.rect.u.uMode, V.mode);
  if (!V.skip.has('plates')) gl.bindVertexArray(plates.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, plates.n); draws++;
  if (!V.skip.has('floor')) gl.bindVertexArray(floor.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, floor.n); draws++;
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  if (!V.skip.has('deco')) { gl.bindVertexArray(deco.vao);
    for (const w of nearWalls) { const [a, n] = decoRange[w.s]; if (!n) continue; deco.bind(a); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); draws++; }
    gl.bindVertexArray(pinsR.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, pinsR.n); draws++; }
  // T3 file quads for walls without data / impostor
  if (t3Walls.length) { gl.bindVertexArray(t3.vao);
    for (const w of t3Walls) { const [a, n] = t3Range[w.s]; t3.bind(a); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); draws++; } }
  gl.depthMask(false);
  PM('plates+deco');
  // T2 impostors
  if (impRuns.length && !V.skip.has('imp')) { common(P.imp); gl.bindVertexArray(emptyVAO); gl.uniform1f(P.imp.u.uFade, 1);
    for (const [w, c0, c1] of impRuns) {
      if (!w.imp || !w.imp.ready) continue;
      bindTex(0, gl.TEXTURE_2D, w.imp.tex, P.imp, 'uImp');
      gl.uniform1f(P.imp.u.uWallX, V.WX[w.s]); gl.uniform1f(P.imp.u.uZ0, w.z0); gl.uniform1f(P.imp.u.uC0, c0); gl.uniform1f(P.imp.u.uC1, c1); gl.uniform1f(P.imp.u.uCols, w.cols);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); draws++; } }
  PM('imp');
  // T0/T1 lines
  if (drawRuns.length) { setupLineProg(P.line); gl.bindVertexArray(emptyVAO);
    let cur = null;
    for (const [w, c0, c1] of drawRuns) {
      if (cur !== w) { wallUniforms(P.line, w); cur = w; }
      const a = w.colStart[c0], n = w.colStart[c1] - a;
      gl.uniform1i(P.line.u.uBase, w.base + a);
      // uHi is in absolute instance index; the shader adds uBase to gl_InstanceID
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); draws++; } }
  PM('lines');
  // morph: column runs of the arriving wall (kept + added by B column, removed by A column), frustum-culled like the walls
  if (V.morph && V.morph.m.colB) {
    const M = V.morph, m = M.m, key = m.key;
    if (morphOnGPU !== key) { G.uploadLinear(gl, morphTex, MORPHW, 0, m.inst, 4, gl.RGBA_INTEGER, gl.UNSIGNED_INT); morphOnGPU = key; }
    setupLineProg(P.morph); gl.bindVertexArray(emptyVAO);
    const wb = W[M.b], wa = W[M.a], x = V.WX[M.b];
    gl.uniform1f(P.morph.u.uWallX, x); gl.uniform1f(P.morph.u.uZ0, wb.z0); gl.uniform1f(P.morph.u.uZ0A, wa.z0);
    gl.uniform1i(P.morph.u.uWall, M.b); gl.uniform1i(P.morph.u.uParent, M.a); gl.uniform1f(P.morph.u.uMorphT, M.u); gl.uniform2i(P.morph.u.uHi, -1, -1);
    const stride = V.morphStride; gl.uniform1i(P.morph.u.uStride, stride); gl.uniform1i(P.morph.u.uMorphGlyph, SOFT ? 0 : 1);
    const draw = (z0, cols, starts) => {
      let run = -1;
      const flush = (c1) => { const a = starts[run], n = Math.floor((starts[c1] - a) / stride); if (n > 0) { gl.uniform1i(P.morph.u.uBase, a); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); draws++; inst += n; } run = -1; };
      for (let c = 0; c < cols; c++) {
        const za = z0 + (c - 1) * 128, zb = z0 + (c + 2) * 128;   // one column of slack for lines in flight
        const vis = G.boxVisible(planes, x - 1, -10, za, x + 1, 4400, zb);
        if (vis && run < 0) run = c; else if (!vis && run >= 0) flush(c);
      }
      if (run >= 0) flush(cols);
    };
    draw(wb.z0, wb.cols, m.colB); if (SOFT ? V.morphRemoved : true) draw(wa.z0, wa.cols, m.colA);
  }
  PM('morph');
  // segments
  if (!V.skip.has('segs')) { common(P.seg); gl.uniform2f(P.seg.u.uFadeFar, 0, 0); gl.bindVertexArray(segBuf.vao); gl.drawArrays(gl.LINES, 0, segBuf.n); draws++;
    // street ribbons fade out by 40000 units: draw only the wall pairs that come that close
    gl.uniform2f(P.seg.u.uFadeFar, 12000, 40000); gl.bindVertexArray(streetBuf.vao);
    for (const [sa, sb, first, n] of streetRange) { if (!n || !V.WA[sa] || !V.WA[sb]) continue; const a = W[sa], b = W[sb];
      const x0 = Math.min(V.WX[sa], V.WX[sb]), x1 = Math.max(V.WX[sa], V.WX[sb]), z0 = Math.min(a.z0, b.z0), z1 = Math.max(a.z0 + a.cols * 128, b.z0 + b.cols * 128);
      if (G.boxDist(V.cam.p, x0, -40, z0, x1, -20, z1) > 40000 || !G.boxVisible(planes, x0, -40, z0, x1, -20, z1)) continue;
      gl.drawArrays(gl.LINES, first, n); draws++; }
    gl.uniform2f(P.seg.u.uFadeFar, 0, 0);
    gl.bindVertexArray(holeBuf.vao); for (const w of nearWalls) { const [a, n] = holeRange[w.s]; if (n && drawRuns.some(r => r[0] === w)) { gl.drawArrays(gl.LINES, a, n); draws++; } } }
  PM('segs');
  // labels
  common(P.label); bindTex(4, gl.TEXTURE_2D, atlasTex, P.label, 'uAtlas'); bindTex(9, gl.TEXTURE_2D, labTex, P.label, 'uLab');
  gl.uniform1f(P.label.u.uMinPx, SOFT ? 8 : 4); gl.uniform3fv(P.label.u.uRight, r); gl.uniform3fv(P.label.u.uUp, u);
  if (!V.skip.has('labels')) {
    gl.bindVertexArray(labBuf.vao); gl.vertexAttrib2f(6, 1, 0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, labBuf.n); draws++;
    if (!V.skip.has('declutter')) declutter(dt, r, u, SOFT ? 8 : 4); else { dlabBuf.dyn.data.fill(0); for (let i = 0; i < dlabels.length; i++) dlabBuf.dyn.data[2 * i] = 1; gl.bindBuffer(gl.ARRAY_BUFFER, dlabBuf.dyn.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dlabBuf.dyn.data); }
    // map labels (lane / wall titles, edges, years, pins) are drawn on top: decluttering keeps them apart, and a label
    // half hidden behind a wall reads as garbage
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(dlabBuf.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dlabBuf.n); draws++; gl.enable(gl.DEPTH_TEST); }
  gl.bindVertexArray(null); gl.depthMask(true);
  PM('labels');
  if (q) { gl.endQuery(tq.TIME_ELAPSED_EXT); tqRing.push(q); }
  fences.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)); gl.flush();
  PM('fence');
  if (V.syncFrames) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncPx);   // bench: wait for the GPU so frame times are real
  while (tqRing.length && gl.getQueryParameter(tqRing[0], gl.QUERY_RESULT_AVAILABLE)) {
    const qq = tqRing.shift(); if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { V.stats.gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6); V.stats.gpuN = (V.stats.gpuN || 0) + 1; if (V.stats.gpu.length > 240) V.stats.gpu.shift(); } gl.deleteQuery(qq); }
  if (tqRing.length > 8) gl.deleteQuery(tqRing.shift());
  PM('sync');
  const cpu = performance.now() - c0;
  if (cpu > 30) { PROF.worst.push([+cpu.toFixed(1), PROF.cur.filter(x => x[1] > 2)]); PROF.worst.sort((a, b) => b[0] - a[0]); PROF.worst.length = Math.min(PROF.worst.length, 12); }
  V.lastGpu = V.stats.gpu.length ? V.stats.gpu.at(-1) : null;
  V.stats.cpu.push(cpu); if (V.stats.cpu.length > 240) V.stats.cpu.shift();
  Object.assign(V.stats, { draws, inst, imp: impRuns.length, t3: t3Walls.length, lineRuns: drawRuns.length, gpuBytes, pendingBake: bakeCand.length, visibleWalls: drawRuns.length + impRuns.length + t3Walls.length });
  if (!V.load.firstFrame) { V.load.firstFrame = performance.now() - t0Boot; setLoading(''); loadBlame(); }
  adapt();
  emit('frame', { dt, cpu });
  if (now - hudT > 250) { hudT = now; emit('hud'); }   // DOM text re-raster is not free on software / emulated compositors
}
// adaptive quality (DESIGN 4.6)
const STEPS = SOFT ? [{ t0: 10, scale: 0.5 }, { t0: 12, scale: 0.45 }, { t0: 14, scale: 0.4 }, { t0: 16, scale: 0.33 }, { t0: 18, scale: 0.25 }] :
  [{ t0: 6, scale: 1 }, { t0: 8, scale: 1 }, { t0: 10, scale: 1 }, { t0: 10, scale: 0.85 }, { t0: 10, scale: 0.7 }];
function p90(a) { if (!a.length) return 0; const s = a.slice(-30).sort((x, y) => x - y); return s[Math.floor(s.length * 0.9)]; }
let adaptN = 0;
V.morphStride = SOFT ? 2 : 1; V.morphRemoved = true;
function adapt() {
  if (V.fixedQuality || ++adaptN % (SOFT ? 8 : 30)) return;
  if (V.morph) {   // morph frames: thin the moving lines first (every 2nd, 4th, 8th line), then hide the red ghosts
    const d = !SOFT && V.stats.gpu.length ? p90(V.stats.gpu) : p90(V.stats.dt), base = SOFT ? 2 : 1;   // GPU: GPU time (presentation is not ours to fix); llvmpipe: frame time
    if (d > (SOFT ? 70 : 12) && V.morphStride < 8) V.morphStride *= 2;
    else if (d > (SOFT ? 70 : 12)) V.morphRemoved = false;
    else if (d < (SOFT ? 40 : 6) && (V.morphStride > base || !V.morphRemoved)) { if (!V.morphRemoved) V.morphRemoved = true; else V.morphStride /= 2; }
  }
  const g = V.stats.gpu.length ? p90(V.stats.gpu) : p90(V.stats.dt) * 0.8;
  // llvmpipe is capped at ~30 fps (33 ms), so it steps back up below 40 ms
  const hi = SOFT ? 60 : 7, lo = SOFT ? 40 : 4; let s = V.quality.step;
  if (g > hi && s < STEPS.length - 1) s++; else if (g < lo && s > 0) s--;
  if (s !== V.quality.step) { V.quality.step = s; Object.assign(V.quality, STEPS[s]); }
}
V.setQualityStep = s => { V.quality.step = s; Object.assign(V.quality, STEPS[s]); };

// ------------------------------------------------------------------ picking (analytic, DESIGN 5.2)
V.pick = (mx, my) => {
  const { f, r, u } = camBasis(), th = Math.tan(FOV / 2), asp = canvas.clientWidth / canvas.clientHeight;
  const nx = (mx / canvas.clientWidth) * 2 - 1, ny = 1 - (my / canvas.clientHeight) * 2;
  const d = G.norm([0, 1, 2].map(i => f[i] + r[i] * nx * th * asp + u[i] * ny * th));
  const o = V.cam.p; let best = null;
  for (const w of W) {
    if (!V.WA[w.s] || Math.abs(d[0]) < 1e-9) continue;
    const x = V.WX[w.s]; if (o[0] > x) continue;
    const t = (x - o[0]) / d[0]; if (t <= 0 || (best && t >= best.t)) continue;
    const y = o[1] + t * d[1], z = o[2] + t * d[2];
    if (y < 0 || y > 4096 || z < w.z0 || z >= w.z0 + w.cols * 128) continue;
    best = { t, w, y, z };
  }
  if (!best) return null;
  const w = best.w, col = Math.floor((best.z - w.z0) / 128), zl = best.z - w.z0 - col * 128, row = Math.floor((4096 - best.y) / 2);
  const Pp = col * H + row, sl = laneSlotsSorted[w.lane];
  let lo = 0, hi = sl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sl[m].L <= Pp) lo = m + 1; else hi = m; }
  const slot = sl[lo - 1];
  const res = { s: w.s, w, col, row, zl, char: Math.floor(zl), dist: best.t };
  if (!slot || Pp >= slot.end || zl > 124) return { ...res, kind: 'empty' };
  const k = w.slotToFile.get(slot.i);
  if (k === undefined) return { ...res, kind: 'hole', slot };
  const f0 = snapJ[w.s].files[k]; res.k = k; res.file = f0;
  if (Pp < slot.L + core.HDR) return { ...res, kind: 'header' };
  const l = Pp - slot.L - core.HDR; if (l >= f0.n) return { ...res, kind: 'filegap' };
  res.line = l + 1; res.kind = 'line';
  if (w.loaded) { const j = w.fileStart[k] + l; res.j = j; const w0 = w.inst[2 * j], w1 = w.inst[2 * j + 1];
    res.id = w0 & 0xFFFFF; res.origin = (w0 >>> 20) & 63; res.flags = w0 >>> 26; res.keep = (w1 >>> 23) & 63;
    if (w.commit && w.commit[j] !== 0xFFFFFFFF) res.commit = w.commit[j]; }
  return res;
};
V.findLine = (s, k, grep) => new Promise(async res => {
  const w = W[s]; if (!w.loaded) return res(0);
  const f = snapJ[s].files[k], ids = []; for (let l = 0; l < f.n; l++) ids.push(w.inst[2 * (w.fileStart[k] + l)] & 0xFFFFF);
  const t = await V.lineText(ids); const i = t.findIndex(x => x && x.includes(grep)); res(i >= 0 ? i + 1 : 0);
});

// ------------------------------------------------------------------ data priority + start
function prioritySnaps() { // walls nearest the camera first
  return W.map(w => [G.boxDist(V.cam.p, w.x, 0, w.z0, w.x, 4096, w.z0 + w.cols * 128), w.s]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}
V.prioritySnaps = prioritySnaps;
V.loadAll = () => dw.postMessage({ type: 'load', snaps: prioritySnaps(), front: true });
updateWalls();
setLoading('preparing shaders…'); warmup();
initUI(V);
// start view: URL hash, bench, or the nullDC 3 street overview
if (!V.restoreHash || !V.restoreHash()) {
  const s0 = man.snapshots.findIndex(s => s.id === 'nulldc-2011-09');
  const v = V.fitWall(s0); V.cam.p = v.p; setLook(v.dir);
}
updateWalls();
V.loadAll();
{ // text chunks: those referenced by the nearest walls first (chunks follow snapshot time)
  const order = [...Array(man.text_chunks).keys()];
  const s0 = prioritySnaps()[0]; const near = eventOf[s0] / NS * man.text_chunks;
  order.sort((a, b) => Math.abs(a - near * 0.9) - Math.abs(b - near * 0.9));
  tw.postMessage({ type: 'init', man, order: Q.get('textorder') === 'linear' ? undefined : order });
}
initBench(V);
requestAnimationFrame(frame);
window.viewer = V;

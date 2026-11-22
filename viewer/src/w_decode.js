// w_decode.js: snapshot bins -> instance arrays (sorted by (col,row)), morph correspondence (DESIGN 6.2, 3.3)
import * as core from './core.js';
const BASE = new URL('../', import.meta.url).href;
let man, layout, fam, slotMaps, snapJ = [], walls = [], norm = null, blank = null;
const queue = []; let busy = false; const haveP = new Map();
export async function gunzip(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  return new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
const pad = s => String(s).padStart(2, '0');
async function loadWall(s) {
  if (walls[s]) return walls[s];
  if (haveP.has(s)) return haveP.get(s);
  const p = (async () => {
    const j = snapJ[s] || (snapJ[s] = JSON.parse(new TextDecoder().decode(await gunzip(BASE + `data/snap/${pad(s)}.json.gz`))));
    const bin = await gunzip(BASE + `data/snap/${pad(s)}.bin.gz`);
    const dec = core.decodeSnapBin(bin, j);
    const lw = layout.walls[s];
    const wall = core.buildWall(j, dec, layout.lanes[lw.lane], slotMaps[lw.lane], man.snapshots[s].anc, s, fam);
    const colStart = new Uint32Array(layout.lanes[lw.lane].cols + 1);
    for (let c = 0; c <= colStart.length - 1; c++) colStart[c] = core.lowerBound(wall.P, c * core.H);
    walls[s] = { json: j, dec, wall, colStart };
    return walls[s];
  })();
  haveP.set(s, p); return p;
}
async function pump() {
  if (busy) return; busy = true;
  while (queue.length) {
    const s = queue.shift(); if (walls[s] && walls[s].sent) continue;
    const t0 = performance.now();
    const w = await loadWall(s); w.sent = true;
    const W = w.wall;
    postMessage({ type: 'wall', snap: s, ms: performance.now() - t0, inst: W.inst.slice(), P: W.P.slice(), fileStart: W.fileStart.slice(),
      fileOfInst: W.fileOfInst.slice(), colStart: w.colStart.slice(), fileL: W.fileL.slice(), fileSlot: W.fileSlot.slice() });
  }
  busy = false;
}
onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    man = m.man; layout = m.layout; fam = core.familyOf(man); slotMaps = layout.lanes.map(l => core.laneSlotMap(l));
    for (const [s, j] of Object.entries(m.snapJ || {})) snapJ[+s] = j;
  } else if (m.type === 'load') {
    for (const s of m.snaps) if (!queue.includes(s) && !(walls[s] && walls[s].sent)) queue.push(s);
    if (m.front) { queue.sort((a, b) => m.snaps.indexOf(a) - m.snaps.indexOf(b)); }
    pump();
  } else if (m.type === 'norm') { norm = m.norm; blank = m.blank; }
  else if (m.type === 'blame') {   // per-instance commit index + author (DESIGN 6.3), in this wall's instance order
    const w = await loadWall(m.snap); let b;
    try { b = await gunzip(BASE + `data/blame/${pad(m.snap)}.bin.gz`); } catch { postMessage({ type: 'blame', snap: m.snap, missing: true }); return; }
    const src = new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2), W = w.wall, n = w.dec.n;
    const commit = new Uint32Array(n), auth = new Uint16Array(n), hist = new Map();
    for (let j = 0; j < n; j++) { const k = W.fileOfInst[j], c = src[W.srcOff[k] + j - W.fileStart[k]]; commit[j] = c;
      const a = c === 0xFFFFFFFF ? 0xFFFF : m.commitAuthor[c]; auth[j] = a; hist.set(a, (hist.get(a) || 0) + 1); }
    postMessage({ type: 'blame', snap: m.snap, commit, auth, hist: [...hist] }, [commit.buffer, auth.buffer]);
  } else if (m.type === 'morph') {
    const t0 = performance.now();
    const [wa, wb] = await Promise.all([loadWall(m.a), loadWall(m.b)]);
    const r = core.buildMorph(wa, wb, norm, blank);
    const so = core.sortMorphByColumn(r.inst, layout.lanes[layout.walls[m.b].lane].cols, layout.lanes[layout.walls[m.a].lane].cols);
    postMessage({ type: 'morph', key: m.key, a: m.a, b: m.b, inst: so.inst, colB: so.colB, colA: so.colA, nKA: so.nKA, kept: r.kept, added: r.added, removed: r.removed,
      exact: !!norm, ms: performance.now() - t0 }, [so.inst.buffer]);
  }
};

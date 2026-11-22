// core.js: pure data logic shared by the workers and the Node verifier (no DOM, no GL).
export const H = 2048, PITCH = 128, TEXTCOLS = 120, HDR = 2, GAP = 2, TEXMAX = 124;
export const F_HIT = 1, F_INCID = 2, F_DELNEXT = 4, F_HDR = 8;   // instance flags (6 bits)
export const M_KEPT = 0, M_ADDED = 1, M_REMOVED = 2;              // morph kinds

// ---- folding (identical to tools/viewer_prep.py fold) ----
// tab -> next multiple of 4, < 0x20 -> space, one 0x7F per non-ASCII code point (continuation bytes after a
// high byte dropped). Writes at most `max` bytes to out[o..]; returns the full folded length.
export function foldInto(src, a, b, out, o, max) {
  let n = 0, prevhi = false;
  for (let i = a; i < b; i++) {
    const x = src[i];
    if (x === 9) { const k = 4 - (n & 3); for (let j = 0; j < k; j++) { if (n < max) out[o + n] = 32; n++; } prevhi = false; }
    else if (x < 0x20) { if (n < max) out[o + n] = 32; n++; prevhi = false; }
    else if (x < 0x80) { if (n < max) out[o + n] = x; n++; prevhi = false; }
    else { if (!(x <= 0xBF && prevhi)) { if (n < max) out[o + n] = 0x7F; n++; } prevhi = true; }
  }
  return n;
}

// ---- normalisation key (provenance.cpp normalize): whitespace runs collapsed, trimmed; bytes as latin1 ----
export function normKey(src, a, b) {
  let s = '', ws = false;
  for (let i = a; i < b; i++) {
    const c = src[i];
    if (c === 32 || c === 9 || c === 11 || c === 12 || c === 13) ws = true;
    else { if (ws && s.length) s += ' '; ws = false; s += String.fromCharCode(c); }
  }
  return s;
}

// ---- snapshot bin: u32 ids[n], u8 origin[n], u8 keep[n] ----
export function decodeSnapBin(buf, json) {
  let n = 0; for (const f of json.files) n += f.n;
  const ids = new Uint32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + 4 * n));
  const og = buf.subarray(4 * n, 5 * n), kp = buf.subarray(5 * n, 6 * n);
  return { n, ids, og: new Uint8Array(og), kp: new Uint8Array(kp) };
}

// slot index for a lane: key identity*65536+ordinal -> slot record
export function laneSlotMap(lane) {
  const m = new Map();
  for (let i = 0; i < lane.slots.length; i++) {
    const [id, ord, col, row, cap] = lane.slots[i];
    m.set(id * 65536 + ord, { i, L: col * H + row, cap });
  }
  return m;
}

// per wall: file -> slot, instances sorted by linear position P (=> by (col,row))
// returns { inst: Uint32Array(2n) [w0,w1], P: Uint32Array(n), fileOrder, fileStart (instance index per file),
//           fileSlot, fileL, ids/og/kp in instance order, lineOf (file-local line per instance), fileOfInst }
export function buildWall(json, dec, lane, slotMap, anc, wallSnap, hideRunMin = 3) {
  const nf = json.files.length;
  const ordc = new Map(), fileSlot = new Int32Array(nf), fileL = new Uint32Array(nf), srcOff = new Uint32Array(nf);
  let off = 0;
  for (let k = 0; k < nf; k++) {
    const f = json.files[k]; srcOff[k] = off; off += f.n;
    const o = ordc.get(f.id) || 0; ordc.set(f.id, o + 1);
    const s = slotMap.get(f.id * 65536 + o);
    if (!s) throw new Error(`no slot for ${json.id} ${f.p}`);
    fileSlot[k] = s.i; fileL[k] = s.L;
  }
  const order = Array.from({ length: nf }, (_, k) => k).sort((a, b) => fileL[a] - fileL[b]);
  const n = dec.n, inst = new Uint32Array(2 * n), P = new Uint32Array(n), fileStart = new Uint32Array(nf + 1);
  const fileOfInst = new Uint16Array(n);
  let j = 0;
  const ancBig = BigInt(anc);
  const related = new Uint8Array(64);
  for (let o = 0; o < 41; o++) related[o] = (o === wallSnap || ((ancBig >> BigInt(o)) & 1n) === 1n) ? 1 : 0;
  // dc4ever (concept parent of nullDC) and nullDC-pre2008 count as related for every wall that descends from nullDC / nullDCe
  const nulldcFamily = [1, 2, 3, 4, 7].some(b => b === wallSnap || ((ancBig >> BigInt(b)) & 1n) === 1n);
  related[40] = nulldcFamily ? 1 : 0;
  if (nulldcFamily) related[0] = 1;
  for (const k of order) {
    const f = json.files[k]; fileStart[k] = j;
    const base = fileL[k] + HDR, s0 = srcOff[k];
    for (let l = 0; l < f.n; l++) {
      const id = dec.ids[s0 + l], o = dec.og[s0 + l], kp = dec.kp[s0 + l];
      const Pp = base + l, col = (Pp / H) | 0, row = Pp % H;
      inst[2 * j] = (id & 0xFFFFF) | ((o & 63) << 20);
      inst[2 * j + 1] = (col & 0xFFF) | ((row & 0x7FF) << 12) | ((kp === 255 ? 63 : Math.min(62, kp)) << 23);
      P[j] = Pp; fileOfInst[j] = k; j++;
    }
    // incidental: unrelated-origin lines (not in the wall's anc mask) in runs shorter than hideRunMin
    const fj = fileStart[k];
    let a = -1;
    for (let l = 0; l <= f.n; l++) {
      const un = l < f.n && dec.kp[s0 + l] !== 255 && !related[dec.og[s0 + l]];
      if (un && a < 0) a = l;
      if (!un && a >= 0) { if (l - a < hideRunMin) for (let q = a; q < l; q++) inst[2 * (fj + q)] |= F_INCID << 26; a = -1; }
    }
  }
  fileStart[nf] = n;
  return { inst, P, order, fileStart, fileSlot, fileL, srcOff, fileOfInst };
}

// lower bound in sorted u32 array
export function lowerBound(a, v, lo = 0, hi = a.length) {
  while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

// ---- morph correspondence a -> b (DESIGN 3.3), matching on norm ids ----
// wa / wb: { json, dec, wall (buildWall result) }; norm: Uint32Array raw->norm (or null: raw ids); blank: Uint8Array norm->is empty
// returns { inst: Uint32Array(4m) [w0, posB, posA, keep|seed<<8], kept, added, removed } (counts over non-blank lines)
export function buildMorph(wa, wb, norm, blankNorm) {
  const key = id => norm ? norm[id] : id;
  const isBlank = id => blankNorm ? blankNorm[key(id)] === 1 : false;
  const fa = wa.json.files, fb = wb.json.files;
  const usedA = new Uint8Array(wa.dec.n), matchB = new Int32Array(wb.dec.n).fill(-1);
  // pass 1: per identity (slot key identity+ordinal), in-order greedy
  const groupA = new Map();
  { const ordc = new Map();
    for (let k = 0; k < fa.length; k++) { const f = fa[k]; const o = ordc.get(f.id) || 0; ordc.set(f.id, o + 1); groupA.set(f.id * 65536 + o, k); } }
  { const ordc = new Map();
    for (let k = 0; k < fb.length; k++) {
      const f = fb[k]; const o = ordc.get(f.id) || 0; ordc.set(f.id, o + 1);
      const ka = groupA.get(f.id * 65536 + o); if (ka === undefined) continue;
      const A = fa[ka], a0 = wa.wall.srcOff[ka], b0 = wb.wall.srcOff[k];
      const pos = new Map();
      for (let l = 0; l < A.n; l++) { const kk = key(wa.dec.ids[a0 + l]); let q = pos.get(kk); if (!q) pos.set(kk, q = []); q.push(a0 + l); }
      const ptr = new Map();
      for (let l = 0; l < f.n; l++) {
        const kk = key(wb.dec.ids[b0 + l]); const q = pos.get(kk); if (!q) continue;
        let p = ptr.get(kk) || 0; if (p < q.length) { matchB[b0 + l] = q[p]; usedA[q[p]] = 1; ptr.set(kk, p + 1); }
      }
    } }
  // pass 2: across files
  const rest = new Map();
  for (let i = 0; i < wa.dec.n; i++) if (!usedA[i]) { const kk = key(wa.dec.ids[i]); let q = rest.get(kk); if (!q) rest.set(kk, q = []); q.push(i); }
  const ptr2 = new Map();
  for (let i = 0; i < wb.dec.n; i++) {
    if (matchB[i] >= 0) continue;
    const kk = key(wb.dec.ids[i]); const q = rest.get(kk); if (!q) continue;
    const p = ptr2.get(kk) || 0; if (p < q.length) { matchB[i] = q[p]; usedA[q[p]] = 1; ptr2.set(kk, p + 1); }
  }
  // instances: source index -> instance position
  const posOf = (w, src) => { return w.wall.posBySrc[src]; };
  ensurePosBySrc(wa); ensurePosBySrc(wb);
  let kept = 0, added = 0, removed = 0, m = 0;
  for (let i = 0; i < wb.dec.n; i++) { const bl = isBlank(wb.dec.ids[i]); if (matchB[i] >= 0) { if (!bl) kept++; } else if (!bl) added++; }
  let nrem = 0; for (let i = 0; i < wa.dec.n; i++) if (!usedA[i]) { nrem++; if (!isBlank(wa.dec.ids[i])) removed++; }
  const inst = new Uint32Array(4 * (wb.dec.n + nrem));
  const seed = (p) => (Math.imul(p ^ 0x9E3779B9, 0x85EBCA6B) >>> 24) & 0xFF;
  for (let i = 0; i < wb.dec.n; i++) {
    const pb = posOf(wb, i), ma = matchB[i];
    const kind = ma >= 0 ? M_KEPT : M_ADDED;
    const id = wb.dec.ids[i], o = wb.dec.og[i], kp = wb.dec.kp[i];
    inst[4 * m] = (id & 0xFFFFF) | ((o & 63) << 20) | (kind << 26);
    inst[4 * m + 1] = pb; inst[4 * m + 2] = ma >= 0 ? posOf(wa, ma) : 0xFFFFFFFF;
    inst[4 * m + 3] = (kp === 255 ? 63 : Math.min(62, kp)) | (seed(pb) << 8); m++;
  }
  for (let i = 0; i < wa.dec.n; i++) {
    if (usedA[i]) continue;
    const pa = posOf(wa, i), id = wa.dec.ids[i], o = wa.dec.og[i], kp = wa.dec.kp[i];
    inst[4 * m] = (id & 0xFFFFF) | ((o & 63) << 20) | (M_REMOVED << 26);
    inst[4 * m + 1] = 0xFFFFFFFF; inst[4 * m + 2] = pa;
    inst[4 * m + 3] = (kp === 255 ? 63 : Math.min(62, kp)) | (seed(pa) << 8); m++;
  }
  return { inst, kept, added, removed };
}
// packed (col | row<<12) of every source line, by source index
function ensurePosBySrc(w) {
  if (w.wall.posBySrc) return;
  const p = new Uint32Array(w.dec.n), W = w.wall;
  for (let j = 0; j < w.dec.n; j++) {
    const k = W.fileOfInst[j], l = j - W.fileStart[k];
    p[W.srcOff[k] + l] = (W.inst[2 * j + 1] & 0x7FFFFF);
  }
  W.posBySrc = p;
}

// w_text.js: text chunks -> folded corpus rows for the R8UI text texture, offsets, norm ids, presence; search + line text
import * as core from './core.js';
const BASE = new URL('../', import.meta.url).href;
let man, lines = [], normArr, blankArr, nmap = new Map(), blankList = [], done = 0, order = [];
const ROWW = 4096;
let nextRow = 0; const chunkRow = [];
async function gunzip(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  return new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
async function loadChunk(c) {
  const t0 = performance.now();
  const b = await gunzip(BASE + `data/text/lines-${String(c).padStart(3, '0')}.txt.gz`);
  const CH = man.chunk_lines, cnt = Math.min(CH, man.raw_lines - c * CH);
  // pass 1: folded bytes (truncated per line at TEXMAX)
  const starts = new Uint32Array(cnt + 1); let a = 0;
  for (let i = 0; i < cnt; i++) { starts[i] = a; let e = b.indexOf(10, a); if (e < 0) e = b.length; a = e + 1; }
  starts[cnt] = b.length + 1;
  const tmp = new Uint8Array(cnt * core.TEXMAX); const offs = new Uint32Array(cnt); let n = 0;
  for (let i = 0; i < cnt; i++) {
    const s = starts[i], e = starts[i + 1] - 1;
    const L = core.foldInto(b, s, e, tmp, n, core.TEXMAX);
    offs[i] = n; n += Math.min(L, core.TEXMAX);
    const k = core.normKey(b, s, e);
    let v = nmap.get(k); if (v === undefined) { v = nmap.size; nmap.set(k, v); blankList.push(k.length ? 0 : 1); }
    normArr[c * CH + i] = v;
  }
  const rows = Math.ceil(n / ROWW) || 1;
  const row0 = chunkRow[c] = nextRow; nextRow += rows;  // chunks start on row boundaries (in arrival order)
  const bytes = new Uint8Array(rows * ROWW); bytes.set(tmp.subarray(0, n));
  const base = row0 * ROWW; for (let i = 0; i < cnt; i++) offs[i] += base;
  // strings for tooltips / search
  const str = new TextDecoder().decode(b).split('\n');
  for (let i = 0; i < cnt; i++) lines[c * CH + i] = str[i];
  const pres = await gunzip(BASE + `data/text/presence-${String(c).padStart(3, '0')}.bin.gz`);
  done++;
  postMessage({ type: 'chunk', c, first: c * CH, count: cnt, row0, rows, bytes, offs, pres, ms: performance.now() - t0 }, [bytes.buffer, offs.buffer, pres.buffer]);
}
onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    man = m.man; normArr = new Uint32Array(man.raw_lines); lines = new Array(man.raw_lines);
    order = m.order && m.order.length ? m.order : [...Array(man.text_chunks).keys()];
    for (const c of order) await loadChunk(c);
    blankArr = Uint8Array.from(blankList);
    postMessage({ type: 'norm', norm: normArr, blank: blankArr, normLines: nmap.size });
    nmap = null;
  } else if (m.type === 'text') {
    postMessage({ type: 'text', req: m.req, ids: m.ids, text: m.ids.map(i => lines[i] ?? null) });
  } else if (m.type === 'search') {
    const t0 = performance.now(); const hits = []; const max = m.max || 10000;
    let re = null; if (m.regex) { try { re = new RegExp(m.q, m.ci ? 'i' : ''); } catch (err) { postMessage({ type: 'search', req: m.req, error: String(err) }); return; } }
    const q = m.ci ? m.q.toLowerCase() : m.q;
    for (let i = 0; i < lines.length && hits.length < max; i++) {
      const s = lines[i]; if (s === undefined) continue;
      if (re ? re.test(s) : (m.ci ? s.toLowerCase().includes(q) : s.includes(q))) hits.push(i);
    }
    postMessage({ type: 'search', req: m.req, hits: Uint32Array.from(hits), ms: performance.now() - t0, partial: done < man.text_chunks });
  }
};

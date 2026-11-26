await V.whenReady({ timeout: 120000 });
await new Promise(r => setTimeout(r, 3000)); const h0 = Math.round(performance.memory.usedJSHeapSize / 1048576); if (globalThis.gc) { gc(); gc(); }
const B = {}; const add = (k, v) => B[k] = (B[k] || 0) + v;
for (const w of V.WALLS) {
  if (w.meta) for (const k of ['slot', 'n', 'dom', 'st', 'ident']) add('meta.' + k, w.meta[k].byteLength), add('meta.paths', w.meta.paths.length * 8);
  if (w.loaded) { add('loaded', 1); for (const k of ['inst', 'colStart', 'fileStart', 'fileSlot', 'fileIdent', 'fst', 'fdom']) if (w[k]) add('w.' + k, w[k].byteLength); add('w.paths', (w.paths || []).length * 8); }
  if (w.cards) add('cards', 1);
}
for (const k in B) if (k !== 'loaded' && k !== 'cards') B[k] = +(B[k] / 1048576).toFixed(1);
return { h0, heap: Math.round(performance.memory.usedJSHeapSize / 1048576), B, walls: V.load.walls };

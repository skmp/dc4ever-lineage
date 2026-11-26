// search + pick on a dc4ever-origin line in a 2026 nulldc3 frame (origin index and keep above the old 9-bit limits)
const s = await V.search('Check This [26/4/05]', {});
const ln = V.LN.find(l => l.name === 'nulldc3'), w = V.W[ln.frames.at(-1)];
V.setX(w.x + 1); await V.ensureWall(w.i, 30000);
const k = w.meta.paths.findIndex(p => p.endsWith('interpr/sh4_opcodes.cpp')), sl = w.meta.slot[k];
const line = await V.findLine(w, w.slotToFile.get(sl), 'ToDo : Check This');
const v = V.slotView(w, sl, line + 1, 22); V.cam.p = v.p; V.setLook(v.dir); await V.whenReady({ timeout: 60000 });
const r = V.pick(innerWidth / 2, innerHeight / 2);
let maxOrig = 0, maxKeep = 0; for (const x of V.WALLS) if (x.inst) for (let j = 0; j < x.inst.length; j += 2) { const o = (x.inst[j] >>> 20) & 2047, kk = ((x.inst[j + 1] >>> 20) & 1023) | ((x.inst[j] >>> 31) << 10); if (o > maxOrig) maxOrig = o; if (kk !== 2047 && kk > maxKeep) maxKeep = kk; }
return { search: Array.isArray(s) ? s.length : (s && (s.hits || s.results || Object.keys(s))), line, pick: r && { kind: r.kind, path: r.path, origin: r.origin, originName: r.origin != null ? V.palette.originName(r.origin) : null, keep: r.keep, text: r.text }, maxOrig, maxKeep };

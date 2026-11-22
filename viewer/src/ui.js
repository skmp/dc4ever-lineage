// ui.js: HUD, legend / colour modes, timeline, minimap, tooltip, search, bookmarks, story, file panel, keys, URL hash
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MODES = ['origin', 'age', 'survival', 'diff vs previous', 'author', 'repo of origin'];
const IMPORT_ROOTS = { 'skmp_dc4ever': '2019 reconstruction', 'skmp_nullDCe': '2017 recovered archive', 'skmp_reicast-emulator': '1c16baeb', 'gligli_nulldc-360': '0330292', 'BenoitAdam_nullDC4Wii': 'e812c58', 'Mayo1970_NotDC-PS3': '5a32b94', 'skmp_minicast': '580d7b8' };

export function initUI(V) {
  const { man, layout, story, snapJ, W, NS } = V;
  const lanes = layout.lanes;
  const gh = s => s.repo.replace('_', '/');

  // ---------------- modes + legend
  const modesEl = $('modes');
  MODES.forEach((m, i) => { const b = document.createElement('button'); b.textContent = `${i + 1} ${m}`; b.onclick = () => setMode(i); modesEl.appendChild(b); });
  function setMode(i) {
    if (i === 4) { V.toast?.('author mode needs tools/blame.py (optional step, not built): lines show grey'); }
    V.mode = i; V.invalidateImpostors(); [...modesEl.children].forEach((b, k) => b.classList.toggle('on', k === i)); legend(); saveHash();
  }
  V.setMode = setMode;
  $('hideinc').onchange = e => { V.hideInc = e.target.checked; V.invalidateImpostors(); };
  function legend() {
    const el = $('legendbody'); const cur = nearestWall();
    const st = cur != null ? man.snapshots[cur] : null;
    let h = '';
    if (V.mode === 0 || V.mode === 5) {
      const cnt = cur != null ? (V.stats_json?.snapshots?.[cur]?.lines_by_origin || {}) : {};
      for (const [li, L] of lanes.entries()) {
        h += `<div class="lrow" data-lane="${li}"><span class="lname" title="${esc(L.title)}">${esc(L.name)}</span>`;
        if (V.mode === 5) h += `<span class="sw" style="background:${V.palette.lane(li)}"></span>`;
        else for (const s of L.snaps.slice().sort((a, b) => V.eventOf[a] - V.eventOf[b])) {
          const n = cnt[man.origins[s]] || 0;
          h += `<span class="sw" title="${esc(man.origins[s])}${n ? ': ' + n.toLocaleString('en') + ' lines in this wall' : ''}" style="background:${V.palette.origin(s)};${n ? 'outline:1px solid #fff' : ''}"></span>`;
        }
        h += '</div>';
      }
      const n40 = cnt['nullDC-pre2008'] || 0;
      h += `<div class="lrow"><span class="lname">nullDC-pre2008</span><span class="sw" style="background:${V.palette.origin(NS)}"></span><span class="small">${n40 ? n40.toLocaleString('en') + ' lines here; ' : ''}in both nullDCe 2009 and nullDC 2010: predates the late-2008 fork</span></div>`;
    } else if (V.mode === 1) {
      h += `<div class="small">origin date (order_date), 2003 → 2026, cividis-like ramp</div><div style="height:10px;background:linear-gradient(90deg,#00204d,#404d6c,#7c7b78,#bcaf6f,#fde737)"></div><div class="small">2003 ················· 2014 ················· 2026</div><div class="small">dc4ever, nullDCe 2009, reicast import and nullDC-pre2008 dates are inferred / imported (see the hatched ruler brackets)</div>`;
    } else if (V.mode === 2) {
      h += `<div class="small">keep / possible: later snapshots holding the line ÷ later snapshots in descending lanes</div><div style="height:10px;background:linear-gradient(90deg,rgb(217,64,64),rgb(51,153,242))"></div><div class="small">died soon ···················· still alive in 2026</div><div class="small">blank / brace-only lines: file colour at 40 %</div>`;
    } else if (V.mode === 3) {
      h += `<div class="lrow"><span class="sw" style="background:#6b7079"></span> kept (present in the previous snapshot = parents[0])</div><div class="lrow"><span class="sw" style="background:#4cf266"></span> added</div><div class="small">removed lines show as red ghosts during a Now-mode morph</div>`;
      if (st) h += `<div class="small">wall ${esc(st.id)} vs ${st.parents.length ? esc(man.snapshots[st.parents[0]].id) : '(no parent)'}</div>`;
    } else h += `<div class="small">Needs the optional blame step (tools/blame.py, handles and dates only). Not built in this run.</div>`;
    if (st) h += `<div class="small" style="margin-top:4px">nearest wall: <b>${esc(st.id)}</b> (${esc(st.order_date)})</div>`;
    el.innerHTML = h;
    el.querySelectorAll('[data-lane]').forEach(r => r.onclick = () => { const L = lanes[+r.dataset.lane]; const s = L.snaps[L.snaps.length - 1]; const v = V.fitWall(s); V.flyTo(v.p, v.dir); });
  }
  fetch('data/stats.json').then(r => r.json()).then(j => { V.stats_json = j; legend(); });
  setMode(0);
  function nearestWall() {
    let best = null, bd = 1e18;
    for (const w of W) { if (!V.WA[w.s]) continue; const dx = V.WX[w.s] - V.cam.p[0]; const dz = Math.max(w.z0 - V.cam.p[2], 0, V.cam.p[2] - (w.z0 + w.cols * 128));
      const d = (dx < -200 ? 1e9 : Math.abs(dx)) + dz; if (d < bd) { bd = d; best = w.s; } }
    return best;
  }
  V.nearestWall = nearestWall;

  // ---------------- toast
  const toastEl = document.createElement('div'); toastEl.className = 'panel hidden'; toastEl.style.cssText = 'left:50%;top:44px;transform:translateX(-50%);z-index:9';
  document.body.appendChild(toastEl); let toastT = 0;
  V.toast = (s) => { toastEl.textContent = s; toastEl.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.add('hidden'), 3500); };

  // ---------------- timeline
  const sl = $('tslider'), ev = V.events;
  const evDate = ev.map(s => man.snapshots[s].order_date);
  const dnum = d => { const [y, m, dd] = d.split('-').map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
  const evNum = evDate.map(dnum), cal0 = 2003, cal1 = evNum.at(-1);
  const calToT = c => { if (c <= evNum[0]) return 0; for (let k = 1; k < NS; k++) if (c <= evNum[k]) return k - 1 + (c - evNum[k - 1]) / Math.max(1e-6, evNum[k] - evNum[k - 1]); return NS - 1; };
  const tToCal = t => { const k = Math.floor(t), f = t - k; return k >= NS - 1 ? evNum[NS - 1] : evNum[k] + (evNum[k + 1] - evNum[k]) * f; };
  function drawTicks() {
    const el = $('ticks'); el.innerHTML = '';
    if (V.scale === 'event') { let last = ''; for (let k = 0; k < NS; k++) { const y = evDate[k].slice(0, 4); if (y === last) continue; last = y; const s = document.createElement('span'); s.style.left = (k / (NS - 1) * 100) + '%'; s.textContent = k > 0 && +y - +evDate[k-1].slice(0,4) > 1 ? '…' + y : y; s.style.fontSize = y === '2026' ? '11px' : ''; el.appendChild(s); } }
    else for (let y = 2004; y <= 2026; y += 2) { const s = document.createElement('span'); s.style.left = ((y - cal0) / (cal1 - cal0) * 100) + '%'; s.textContent = y; el.appendChild(s); }
  }
  function syncSlider() {
    if (V.scale === 'event') { sl.min = 0; sl.max = NS - 1; sl.value = V.t; }
    else { sl.min = cal0; sl.max = cal1; sl.value = tToCal(V.t); }
    const k = Math.min(NS - 1, Math.floor(V.t + 1e-6)), s = man.snapshots[ev[k]];
    $('tdate').textContent = `${s.order_date}  ${s.id}${s.date_range ? ' (real ' + s.date_range + ')' : ''}`;
  }
  sl.oninput = () => { V.t = V.scale === 'event' ? +sl.value : calToT(+sl.value); onTime(true); };
  function onTime(user) {
    syncSlider();
    if (V.pres === 'gallery' && (user || V.playing)) { V.cam.p[0] = V.eventX(V.t) - (V.galleryOffset ?? 2600); V.flight = null; }
  }
  V.on('time', () => onTime(false));
  V.setTime = (t, glide) => { V.t = Math.max(0, Math.min(NS - 1, t)); onTime(true); };
  $('tplay').onclick = () => togglePlay();
  function togglePlay() { V.playing = !V.playing; if (V.playing && V.t >= NS - 1) V.t = 0; $('tplay').textContent = V.playing ? '❚❚' : '▶'; }
  V.on('tick', () => { if (!V.playing && $('tplay').textContent !== '▶') $('tplay').textContent = '▶'; });
  $('tprev').onclick = () => V.setTime(Math.ceil(V.t - 1e-3) - 1);
  $('tnext').onclick = () => V.setTime(Math.floor(V.t + 1e-3) + 1);
  $('tspeed').onchange = e => V.playSpeed = +e.target.value;
  $('tpres').onclick = () => setPres(V.pres === 'gallery' ? 'now' : 'gallery');
  function setPres(p) {
    V.pres = p; $('tpres').textContent = p === 'gallery' ? 'Gallery' : 'Now'; $('tpres').classList.toggle('on', p === 'now');
    if (p === 'now') { V._lastT = V.t; }
  }
  V.setPres = setPres;
  $('tscale').onclick = () => { V.scale = V.scale === 'event' ? 'calendar' : 'event'; $('tscale').textContent = V.scale; drawTicks(); syncSlider(); };
  drawTicks(); syncSlider();

  // ---------------- minimap: X = time, rows = lanes (Z)
  const mm = $('mm'), mx = mm.getContext('2d'); const MW = mm.width, MH = mm.height;
  const zMax = lanes.at(-1).z0 + lanes.at(-1).width, xMax = Math.max(...W.map(w => w.x)) + 8000, xMin = -6000;
  const toM = (x, z) => [8 + (x - xMin) / (xMax - xMin) * (MW - 16), 16 + z / zMax * (MH - 24)];
  const fromM = (px, py) => [xMin + (px - 8) / (MW - 16) * (xMax - xMin), (py - 16) / (MH - 24) * zMax];
  let mmDirty = true; V.on('frame', () => { mmDirty = true; });
  function drawMinimap() {
    mx.fillStyle = '#0b0d12'; mx.fillRect(0, 0, MW, MH);
    mx.font = '9px system-ui'; mx.fillStyle = '#6b7488';
    for (const r of layout.ruler) if (r.year && r.year % 2 === 0) { const [x] = toM(r.x, 0); mx.fillRect(x, 10, 1, MH - 12); mx.fillText(String(r.year).slice(2), x - 5, 9); }
    for (const [li, L] of lanes.entries()) {
      const [, y0] = toM(0, L.z0), [, y1] = toM(0, L.z0 + L.width - 2000);
      mx.fillStyle = V.palette.lane(li) + '30'; mx.fillRect(8, y0, MW - 16, Math.max(2, y1 - y0));
      mx.fillStyle = V.palette.lane(li); mx.fillText(L.name, 2, (y0 + y1) / 2 + 3);
    }
    for (const e of layout.edges) {
      const a = W[e.from], b = W[e.to], [x0, y0] = toM(V.WX[a.s], a.z0 + a.cols * 64), [x1, y1] = toM(V.WX[b.s], b.z0 + b.cols * 64);
      const c = V.edgeStyle[e.kind]; mx.strokeStyle = `rgba(${c.join(',')},0.75)`; mx.setLineDash(e.kind === 'concept' ? [2, 3] : e.kind === 'import' ? [5, 2] : e.kind === 'fork-recovered' ? [1, 2] : []);
      mx.beginPath(); mx.moveTo(x0, y0); mx.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1); mx.stroke();
    }
    mx.setLineDash([]);
    for (const w of W) {
      if (!V.WA[w.s]) continue;
      const [x, y0] = toM(V.WX[w.s], w.z0), [, y1] = toM(V.WX[w.s], w.z0 + w.cols * 128);
      mx.fillStyle = V.palette.origin(w.s); mx.fillRect(x - 1, y0, Math.max(2, Math.sqrt(w.n) / 160), Math.max(2, y1 - y0));
    }
    for (const p of layout.pins) { const w = W[p.snap]; const [x, y] = toM(V.WX[w.s], w.z0); mx.fillStyle = '#ffd25a'; mx.fillRect(x - 2, y - 4, 4, 3); }
    // camera + frustum wedge
    const { f } = V.camBasis(); const [cx, cy] = toM(V.cam.p[0], V.cam.p[2]);
    const yaw = Math.atan2(f[2] * (MH - 24) / zMax, f[0] * (MW - 16) / (xMax - xMin));
    mx.fillStyle = 'rgba(124,196,255,0.25)'; mx.beginPath(); mx.moveTo(cx, cy); mx.arc(cx, cy, 40, yaw - 0.5, yaw + 0.5); mx.closePath(); mx.fill();
    mx.fillStyle = '#7cc4ff'; mx.beginPath(); mx.arc(cx, cy, 3, 0, 7); mx.fill();
  }
  setInterval(() => { if (mmDirty && !$('minimap').classList.contains('hidden')) { drawMinimap(); mmDirty = false; } }, 100);
  let mmDrag = false;
  mm.onmousedown = e => { mmDrag = true; mmMove(e); };
  addEventListener('mouseup', () => mmDrag = false);
  mm.onmousemove = e => { if (mmDrag) mmMove(e); };
  function mmMove(e) { const r = mm.getBoundingClientRect(); const [x, z] = fromM(e.clientX - r.left, e.clientY - r.top); V.flight = null; V.cam.p[0] = x; V.cam.p[2] = z; V.cam.p[1] = Math.max(V.cam.p[1], 1500); }

  // ---------------- HUD
  const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  V.on('hud', () => {
    const S = V.stats, Lo = V.load, c = V.cam.p, nw = nearestWall();
    const g = S.gpu.length ? `${pct(S.gpu, 0.5).toFixed(2)} / ${pct(S.gpu, 0.95).toFixed(2)} ms` : 'n/a (no timer query)';
    $('hud').innerHTML = `<b>${esc(V.RENDERER)}</b>${V.SOFT ? '  [software path]' : ''}
frame p50/p95 ${pct(S.dt, 0.5).toFixed(1)} / ${pct(S.dt, 0.95).toFixed(1)} ms  (${(1000 / Math.max(1e-3, pct(S.dt, 0.5))).toFixed(0)} fps)
cpu ${pct(S.cpu, 0.5).toFixed(2)} ms   gpu ${g}
draws ${S.draws}  lines ${S.inst.toLocaleString('en')}  runs ${S.lineRuns}  impostors ${S.imp}  T3 walls ${S.t3}
quality step ${V.quality.step} (glyphs at ≥${V.quality.t0} px/line, scale ${V.quality.scale})
speed ${V.cam.speed.toFixed(0)} u/s   pos ${c.map(v => v.toFixed(0)).join(', ')}
${V.pres === 'now' ? 'NOW' : 'gallery'}  t=${V.t.toFixed(2)}  ${nw != null ? 'wall ' + man.snapshots[nw].id : ''}
data: walls ${Lo.walls}/${NS}  text ${Lo.text}/${man.text_chunks}${V.normLines ? '' : ' (norm pending)'}  GPU ~${(S.gpuBytes / 1048576).toFixed(0)} MB${performance.memory ? '  JS ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : ''}${V.morph ? `\nmorph ${man.snapshots[V.morph.a].id} → ${man.snapshots[V.morph.b].id}: kept ${V.morph.m.kept} added ${V.morph.m.added} removed ${V.morph.m.removed}${V.morph.m.exact ? '' : ' (raw ids, approx)'}` : ''}`;
    if (Math.random() < 0.1) legend();
  });

  // ---------------- tooltip + hover
  const tip = $('tip'); let hoverT = 0, tipReq = 0;
  V.on('frame', () => {
    const now = performance.now(); if (now - hoverT < 100 || !V.mouse || V.pinned) return; hoverT = now;
    if (!V.mouse.over) { tip.classList.add('hidden'); V.hi = null; return; }
    const p = V.pick(V.mouse.x, V.mouse.y); V.hover = p;
    if (p && p.k !== undefined && p.w.loaded) V.hi = { s: p.s, a: p.w.fileStart[p.k], b: p.w.fileStart[p.k] + p.file.n }; else V.hi = null;
    showTip(p, false);
  });
  function showTip(p, pinned) {
    if (!p || p.kind === 'empty') { tip.classList.add('hidden'); return; }
    const sn = man.snapshots[p.s], f = p.file;
    let h = `<div><b>${esc(sn.id)}</b> <span class="small">${esc(sn.order_date)}${sn.date_range ? ' · real ' + esc(sn.date_range) : ''} · ${esc(gh(sn))} ${esc(sn.ref)}</span></div>`;
    if (p.kind === 'hole') h += `<div class="small">slot of a file that is not in this snapshot (street hole)</div>`;
    if (f) {
      h += `<div><code>${esc(f.p)}</code>${p.line ? ' : <b>' + p.line + '</b>' : ''} <span class="small">${f.n} lines · ${esc(f.st)}${f.sim != null ? ' · sim ' + f.sim.toFixed(2) : ''}${f.pred ? ' · from ' + esc(man.snapshots[f.pred[0]].id) : ''}</span></div>`;
    }
    if (p.kind === 'line' && p.id !== undefined) {
      const o = p.origin, os = o < NS ? man.snapshots[o] : null;
      h += `<pre id="tiptext">…</pre>`;
      h += `<div>origin <span class="sw" style="background:${V.palette.origin(o)}"></span><b>${esc(man.origins[o])}</b> <span class="small">${os ? esc(os.order_date) + ' · lane ' + esc(os.lane) : 'nullDC up to the late-2008 fork (in both nullDCe 2009 and nullDC 2010)'}</span></div>`;
      if (os && os.date_note) h += `<div class="small">${esc(os.date_note)}</div>`;
      if (p.flags & 2) h += `<div class="small">incidental match: unrelated-lane origin in a run of fewer than 3 lines${V.hideInc ? ' (drawn in the wall\'s own colour)' : ''}</div>`;
      const poss = layout.possible[o][p.s];
      h += `<div>keep <b>${p.keep === 63 ? 'n/a (blank / brace-only line)' : p.keep + ' of ' + poss + ' possible later snapshots'}</b></div>`;
      const pl = V.presCPU[2 * p.id], ph = V.presCPU[2 * p.id + 1];
      if (pl || ph) {
        h += '<div class="dots">present in: ';
        for (const s of V.events) { const on = s < 32 ? (pl >>> s) & 1 : (ph >>> (s - 32)) & 1; h += `<span title="${esc(man.snapshots[s].id)}" style="background:${on ? V.palette.lane(W[s].lane) : '#262b36'}"></span>`; }
        h += '</div>';
      }
      const rr = IMPORT_ROOTS[sn.repo];
      h += `<div class="small">author: blame step not built (optional). ${rr && o === p.s ? 'This wall is an imported snapshot (' + esc(rr) + '): authorship predates the import.' : ''}</div>`;
      h += `<div class="small">handle of the nullDC / reicast / nullDC 3 author: drk||Raziel (said "D R K Raziel")</div>`;
    }
    if (pinned && f) h += `<div style="margin-top:4px"><a style="color:#7cc4ff" target="_blank" rel="noopener" href="https://github.com/${esc(gh(sn))}/blob/${sn.commit}/${esc(f.p)}${p.line ? '#L' + p.line : ''}">open on GitHub</a> · <a href="#" id="tipfollow" style="color:#7cc4ff">follow this file</a> · <a href="#" id="tipclose" style="color:#7cc4ff">close</a></div>`;
    tip.innerHTML = h; tip.classList.remove('hidden');
    const x = Math.min(innerWidth - tip.offsetWidth - 10, (V.mouse?.x ?? 100) + 16), y = Math.min(innerHeight - tip.offsetHeight - 10, (V.mouse?.y ?? 100) + 16);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    if (p.id !== undefined) { const r = ++tipReq; V.lineText([p.id]).then(t => { if (r === tipReq && $('tiptext')) $('tiptext').textContent = t[0] ?? '(text not loaded yet)'; }); }
    if (pinned) {
      $('tipclose') && ($('tipclose').onclick = e => { e.preventDefault(); V.pinned = null; tip.classList.add('hidden'); });
      $('tipfollow') && ($('tipfollow').onclick = e => { e.preventDefault(); openFile(p.s, p.k); });
    }
  }
  V.showTip = showTip;
  V.on('click', e => {
    const p = V.pick(e.clientX, e.clientY);
    if (V.pinned || !p) { V.pinned = null; tip.classList.add('hidden'); return; }
    if (p.kind === 'header') { openFile(p.s, p.k); return; }
    V.pinned = p; showTip(p, true);
  });
  V.on('dblclick', e => { const p = V.pick(e.clientX, e.clientY); if (p && p.k !== undefined) V.flyToFile(p.s, p.k, p.line || 0); });

  // ---------------- file panel: follow an identity across every repo
  let identities = null;
  async function loadIdentities() {
    if (identities) return identities;
    const r = await fetch('data/identities.json.gz'); const b = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
    return identities = JSON.parse(b);
  }
  async function openFile(s, k) {
    const f = snapJ[s].files[k], ids = await loadIdentities(), I = ids[f.id];
    const vs = I.v.slice().sort((a, b) => V.eventOf[a[0]] - V.eventOf[b[0]]);
    let h = `<h3>File identity #${f.id}</h3><div class="small">${vs.length} versions across ${new Set(vs.map(v => W[v[0]].lane)).size} lanes. Click to fly; <button id="ride">ride the street</button></div>`;
    for (const [sn, fk] of vs) { const ff = snapJ[sn].files[fk];
      h += `<div class="res" data-s="${sn}" data-k="${fk}"><span class="sw" style="background:${V.palette.lane(W[sn].lane)}"></span>${esc(man.snapshots[sn].id)} <span class="small">${ff.n} lines · ${esc(ff.st)}</span><br><code>${esc(ff.p)}</code></div>`; }
    const el = $('filepanel'); el.innerHTML = h + '<div class="small"><a href="#" id="fpclose" style="color:#7cc4ff">close</a></div>'; el.classList.remove('hidden');
    el.querySelectorAll('.res').forEach(r => r.onclick = () => V.flyToFile(+r.dataset.s, +r.dataset.k, 0));
    $('fpclose').onclick = e => { e.preventDefault(); el.classList.add('hidden'); clearInterval(V._ride); };
    $('ride').onclick = () => { clearInterval(V._ride); let i = 0; const go = () => { if (i >= vs.length) return clearInterval(V._ride); V.flyToFile(vs[i][0], vs[i][1], 0); i++; }; go(); V._ride = setInterval(go, 2000); };
  }
  V.openFile = openFile;

  // ---------------- search
  const sq = $('sq'), sres = $('sres'), sstat = $('sstat');
  const allPaths = []; snapJ.forEach((j, s) => j.files.forEach((f, k) => allPaths.push({ s, k, p: f.p, id: f.id })));
  function fuzzy(q, t) { let i = 0, score = 0, last = -1; const tl = t.toLowerCase();
    for (const ch of q.toLowerCase()) { const j = tl.indexOf(ch, last + 1); if (j < 0) return -1; score += j === last + 1 ? 2 : 0; last = j; i++; }
    return score - t.length * 0.01 + (tl.endsWith(q.toLowerCase()) ? 5 : 0); }
  let sT = 0;
  sq.oninput = () => { clearTimeout(sT); sT = setTimeout(runSearch, 200); };
  sq.onkeydown = e => { if (e.key === 'Enter') { const r = sres.querySelector('.res'); r?.click(); } };
  $('skind').onchange = runSearch;
  async function runSearch() {
    const q = sq.value.trim(), kind = $('skind').value; if (!q) { sres.innerHTML = ''; V.setMarks(null); return; }
    if (kind === 'path') {
      const t0 = performance.now(); const by = new Map();
      for (const a of allPaths) { const sc = fuzzy(q, a.p); if (sc < 0) continue; const g = by.get(a.id) || { sc: -1e9, items: [] }; g.sc = Math.max(g.sc, sc); g.items.push(a); by.set(a.id, g); }
      const groups = [...by.values()].sort((a, b) => b.sc - a.sc).slice(0, 60);
      sstat.textContent = `${by.size} identities · ${(performance.now() - t0).toFixed(1)} ms`;
      sres.innerHTML = groups.map(g => { const it = g.items.sort((a, b) => V.eventOf[b.s] - V.eventOf[a.s]);
        return `<div class="res" data-s="${it[0].s}" data-k="${it[0].k}"><code>${esc(it[0].p)}</code><br><span class="small">${it.map(a => esc(man.snapshots[a.s].id)).join(' · ')}</span></div>`; }).join('');
      sres.querySelectorAll('.res').forEach(r => r.onclick = () => { V.flyToFile(+r.dataset.s, +r.dataset.k, 0); });
    } else {
      sstat.textContent = 'searching…';
      const r = await V.search(q, { regex: kind === 'regex', ci: !/[A-Z]/.test(q), max: 10000 });
      if (r.error) { sstat.textContent = r.error; return; }
      const hits = r.hits; V.setMarks(hits); V.searchHits = hits;
      sstat.textContent = `${hits.length}${hits.length >= 10000 ? '+' : ''} distinct lines · ${r.ms.toFixed(0)} ms${r.partial ? ' (text still loading)' : ''}`;
      const txt = await V.lineText([...hits.slice(0, 200)]);
      sres.innerHTML = [...hits.slice(0, 200)].map((id, i) => {
        const pl = V.presCPU[2 * id], ph = V.presCPU[2 * id + 1]; const in_ = V.events.filter(s => s < 32 ? (pl >>> s) & 1 : (ph >>> (s - 32)) & 1);
        const first = in_[0];
        return `<div class="res" data-id="${id}"><code>${esc((txt[i] || '').trim().slice(0, 140))}</code><br><span class="small">first: ${first != null ? esc(man.snapshots[first].id) : '?'} · in ${in_.length} snapshots · lanes ${[...new Set(in_.map(s => lanes[W[s].lane].name))].join(', ')}</span></div>`; }).join('');
      sres.querySelectorAll('.res').forEach(r => r.onclick = () => gotoLine(+r.dataset.id));
    }
  }
  function gotoLine(id) { // nearest loaded wall holding the line
    const order = V.prioritySnaps();
    for (const s of order) { const w = W[s]; if (!w.loaded) continue;
      for (let j = 0; j < w.n; j++) if ((w.inst[2 * j] & 0xFFFFF) === id) { const k = w.fileOfInst[j]; V.flyToFile(s, k, j - w.fileStart[k] + 1); return; } }
  }

  // ---------------- bookmarks
  const bmByTitle = new Map(story.bookmarks.map(b => [b.title, b]));
  V.gotoBookmark = async (b, opts = {}) => {
    if (typeof b === 'string') b = bmByTitle.get(b);
    const s = man.snapshots.findIndex(x => x.id === b.snap), k = snapJ[s].files.findIndex(f => f.p === b.path);
    let line = b.line || 0;
    if (b.grep) line = await V.findLine(s, k, b.grep) || line;
    if (opts.instant) { const v = V.fileView(s, k, line); V.cam.p = v.p; V.setLook(v.dir); } else V.flyToFile(s, k, line);
    return { s, k, line };
  };
  { let h = '', g = '';
    for (const b of story.bookmarks) { if (b.group !== g) { g = b.group; h += `<div class="small" style="margin-top:6px;color:#7cc4ff">${esc(g)}</div>`; }
      h += `<div class="res" data-t="${esc(b.title)}">${esc(b.title)}<br><code>${esc(b.snap)}: ${esc(b.path)}</code></div>`; }
    const user = JSON.parse(localStorage.getItem('lineage-bm') || '[]');
    if (user.length) { h += `<div class="small" style="margin-top:6px;color:#7cc4ff">yours</div>`; for (const u of user) h += `<div class="res" data-hash="${esc(u.hash)}">${esc(u.title)}</div>`; }
    h += `<div style="margin-top:6px"><button id="bmadd">bookmark this view</button></div>`;
    $('bmbody').innerHTML = h;
    $('bmbody').querySelectorAll('.res[data-t]').forEach(r => r.onclick = () => V.gotoBookmark(r.dataset.t));
    $('bmbody').querySelectorAll('.res[data-hash]').forEach(r => r.onclick = () => { location.hash = r.dataset.hash; V.restoreHash(); });
    $('bmadd').onclick = () => { const nw = nearestWall(); user.push({ title: `${man.snapshots[nw]?.id} @ ${V.cam.p.map(v => v.toFixed(0)).join(',')}`, hash: makeHash() }); localStorage.setItem('lineage-bm', JSON.stringify(user)); V.toast('bookmark saved (localStorage)'); };
  }

  // ---------------- story panel + tours
  { let h = `<p class="small">nullDC, nullDCe, reicast and nullDC 3 are by drk||Raziel (said "D R K Raziel", GitHub skmp). Handles only; no personal data.</p>`;
    story.chapters.forEach((c, i) => { h += `<div class="ch"><b>${i + 1}. ${esc(c.title)}</b><p>${esc(c.text)}</p><button data-fly="${i}">fly there</button> <button data-tour="${i}">guided tour</button></div>`; });
    $('storybody').innerHTML = h;
    $('storybody').querySelectorAll('[data-fly]').forEach(b => b.onclick = () => flyChapter(+b.dataset.fly));
    $('storybody').querySelectorAll('[data-tour]').forEach(b => b.onclick = () => tour(+b.dataset.tour)); }
  function flyChapter(i) { const c = story.chapters[i]; const s = man.snapshots.findIndex(x => x.id === c.snaps[0]); const v = V.fitWall(s); V.flyTo(v.p, v.dir); }
  async function tour(i) {
    const c = story.chapters[i]; const stops = [];
    for (const id of c.snaps) stops.push(() => { const s = man.snapshots.findIndex(x => x.id === id); const v = V.fitWall(s); V.flyTo(v.p, v.dir); });
    for (const t of c.bookmarks) if (bmByTitle.has(t)) stops.push(() => V.gotoBookmark(t));
    clearInterval(V._tour); let k = 0; const go = () => { if (k >= stops.length) return clearInterval(V._tour); stops[k++](); }; go(); V._tour = setInterval(go, 3500);
  }
  V.tour = tour;

  // ---------------- keys
  const toggle = id => $(id).classList.toggle('hidden');
  V.on('key', e => {
    const k = e.key;
    if (k >= '1' && k <= '6') setMode(+k - 1);
    else if (k === 'g' || k === 'G') { const v = V.overview(); V.flyTo(v.p, v.dir); }
    else if (k === 'p' || k === 'P') togglePlay();
    else if (k === ',') $('tprev').click(); else if (k === '.') $('tnext').click();
    else if (k === 'n' || k === 'N') setPres(V.pres === 'gallery' ? 'now' : 'gallery');
    else if (k === '/') { e.preventDefault(); $('search').classList.remove('hidden'); sq.focus(); }
    else if (k === 'b' || k === 'B') toggle('bookmarks');
    else if (k === 'm' || k === 'M') toggle('minimap');
    else if (k === 'l' || k === 'L') toggle('story');
    else if (k === 'h' || k === 'H' || k === '?') toggle('help');
    else if (k === 'Escape') { ['search', 'bookmarks', 'help'].forEach(i => $(i).classList.add('hidden')); V.pinned = null; tip.classList.add('hidden'); }
    else if (k === 'f' || k === 'F') { const p = V.hover; if (p && p.k !== undefined) V.flyToFile(p.s, p.k, p.line || 0); }
    else if (k === '[' || k === ']') streetStep(k === ']' ? 1 : -1);
    else if (k === '{' || k === '}') laneStep(k === '}' ? 1 : -1);
  });
  function streetStep(d) { // same slot in the lane's previous / next wall: same Z and Y, move X
    const s = nearestWall(); if (s == null) return; const L = lanes[W[s].lane];
    const ss = L.snaps.slice().sort((a, b) => V.eventOf[a] - V.eventOf[b]); const i = ss.indexOf(s) + d;
    if (i < 0 || i >= ss.length) { V.toast('end of this street'); return; }
    const dx = V.WX[ss[i]] - V.WX[s]; V.flyTo([V.cam.p[0] + dx, V.cam.p[1], V.cam.p[2]], V.camBasis().f, 0.8);
    V.toast(`${man.snapshots[ss[i]].id} (${man.snapshots[ss[i]].order_date})`);
  }
  function laneStep(d) {
    const s = nearestWall(); const li = s == null ? 0 : W[s].lane; const nl = lanes[(li + d + lanes.length) % lanes.length];
    let best = nl.snaps[0]; for (const t of nl.snaps) if (Math.abs(V.WX[t] - V.cam.p[0]) < Math.abs(V.WX[best] - V.cam.p[0])) best = t;
    const dz = nl.z0 - lanes[li].z0; V.flyTo([V.WX[best] - (s == null ? 3000 : V.WX[s] - V.cam.p[0]), V.cam.p[1], V.cam.p[2] + dz], V.camBasis().f, 1.0);
  }

  // ---------------- URL hash
  function makeHash() { const c = V.cam; return `#c=${c.p.map(v => v.toFixed(0)).join(',')},${c.yaw.toFixed(3)},${c.pitch.toFixed(3)}&m=${V.mode}&t=${V.t.toFixed(3)}&p=${V.pres}`; }
  function saveHash() { if (V.Q.has('bench') || V.Q.has('shots')) return; history.replaceState(null, '', makeHash()); }
  setInterval(saveHash, 1000);
  V.restoreHash = () => {
    const h = new URLSearchParams(location.hash.slice(1)); if (!h.get('c')) return false;
    const c = h.get('c').split(',').map(Number); V.cam.p = c.slice(0, 3); V.cam.yaw = c[3]; V.cam.pitch = c[4];
    if (h.has('m')) setMode(+h.get('m')); if (h.has('t')) V.t = +h.get('t'); if (h.get('p') === 'now') setPres('now');
    syncSlider(); return true;
  };
}

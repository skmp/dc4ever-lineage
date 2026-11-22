#!/usr/bin/env python3
"""viewer_prep.py: per-file layout for the lineage viewer (DESIGN.md 1.6, 6.1).

Writes data/layout.json.gz (lanes, slots, districts, walls, ruler, edges, colours),
data/linemeta.bin.gz (u8 indent, u8 len|comment<<7 per distinct line, after folding)
and data/story.json (chapters + bookmarks resolved to existing paths).

Folding (shared with viewer/src/fold.js, checked by tools/verify/check_data.mjs):
  tab -> spaces to the next multiple of 4; bytes < 0x20 -> space; every byte >= 0x80 that is not a
  UTF-8 continuation byte following a >= 0x80 byte -> 0x7F (one box per code point); continuation bytes dropped.
"""
import os, sys, json, gzip, math, struct, collections, time

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
D = os.path.join(ROOT, 'data')
t0 = time.time()
man = json.load(open(os.path.join(D, 'manifest.json')))
S = man['snapshots']
NS = len(S)
snaps = [json.load(gzip.open(os.path.join(D, f'snap/{s["i"]:02d}.json.gz'))) for s in S]

H = 2048          # lines per column
TEXT = 120
PITCH = 128
WALLGAP = 6000
HDR = 2           # header rows above a file
GAP = 2           # rows after a file
DGAP = 6          # rows before a second-level district that stays in the column

REPO_LANE = {
    'skmp_dc4ever': 'dc4ever', 'skmp_nullDC': 'nullDC', 'gligli_nulldc-360': 'nulldc-360', 'skmp_nullDCe': 'nullDCe',
    'BenoitAdam_nullDC4Wii': 'nullDC4Wii', 'Mayo1970_NotDC-PS3': 'NotDC-PS3', 'skmp_reicast-emulator': 'reicast',
    'flyinghead_flycast': 'flycast', 'skmp_nulldc3': 'nulldc3', 'skmp_minicast': 'minicast', 'skmp_polly2-rtl': 'polly2',
    'skmp_dreamcast-devtools': 'devtools', 'fpgadc_dreamcast-tests': 'dreamcast-tests', 'skmp_shrike4-rtl': 'shrike4',
    'skmp_caique-rtl': 'caique', 'skmp_wren7-rtl': 'wren7'}
LANES = ['dc4ever', 'nullDC', 'nulldc-360', 'nullDCe', 'nullDC4Wii', 'NotDC-PS3', 'reicast', 'flycast', 'nulldc3',
         'minicast', 'polly2', 'devtools', 'dreamcast-tests', 'shrike4', 'caique', 'wren7']
FPGA = set(LANES[9:])
LANE_INFO = {  # hue (OKLCH degrees), chroma, title, github repo, slot-order parent lane
    'dc4ever': (300, 0.13, 'dc4ever (C#)', 'skmp/dc4ever', None),
    'nullDC': (75, 0.14, 'nullDC', 'skmp/nullDC', None),
    'nulldc-360': (125, 0.14, 'nulldc-360 (Xbox 360)', 'gligli/nulldc-360', 'nullDC'),
    'nullDCe': (50, 0.15, 'nullDCe (PSP / Wii / PS3 / PS2)', 'skmp/nullDCe', 'nullDC'),
    'nullDC4Wii': (10, 0.14, 'nullDC4Wii', 'BenoitAdam/nullDC4Wii', 'nullDCe'),
    'NotDC-PS3': (340, 0.15, 'NotDC-PS3', 'Mayo1970/NotDC-PS3', 'nullDC4Wii'),
    'reicast': (255, 0.14, 'reicast', 'skmp/reicast-emulator', 'nullDC'),
    'flycast': (215, 0.12, 'flycast', 'flyinghead/flycast', 'reicast'),
    'nulldc3': (145, 0.15, 'nullDC 3 (devcast)', 'skmp/nulldc3', 'reicast'),
    'minicast': (178, 0.11, 'minicast (DreamSTer ARM side)', 'skmp/minicast', 'nulldc3'),
    'polly2': (192, 0.12, 'polly2-rtl (PowerVR2, SV)', 'skmp/polly2-rtl', None),
    'devtools': (205, 0.11, 'dreamcast-devtools (TS)', 'skmp/dreamcast-devtools', None),
    'dreamcast-tests': (225, 0.12, 'dreamcast-tests', 'fpgadc/dreamcast-tests', None),
    'shrike4': (240, 0.13, 'shrike4-rtl (SH4)', 'skmp/shrike4-rtl', None),
    'caique': (262, 0.13, 'caique-rtl (AICA)', 'skmp/caique-rtl', None),
    'wren7': (280, 0.13, 'wren7-rtl (ARM7)', 'skmp/wren7-rtl', None),
}

# ---------- OKLCH -> sRGB ----------
def oklch(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    def enc(x):
        x = min(1, max(0, x))
        return round(255 * (12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055))
    return [enc(r), enc(g), enc(bb)]

lane_of = [REPO_LANE[s['repo']] for s in S]
lane_snaps = {ln: [s['i'] for s in sorted(S, key=lambda s: (s['order_date'], s['i'])) if lane_of[s['i']] == ln] for ln in LANES}

# origin colours: lane hue, lightness stepped per snapshot within lane
orig_rgb = [None] * (NS + 1)
for ln, ss in lane_snaps.items():
    h, c = LANE_INFO[ln][0], LANE_INFO[ln][1]
    for k, si in enumerate(ss):
        L = 0.62 + (0.86 - 0.62) * (k / max(1, len(ss) - 1)) if len(ss) > 1 else 0.74
        orig_rgb[si] = oklch(L, c, h)
orig_rgb[NS] = oklch(0.70, 0.05, 75)  # nullDC-pre2008: desaturated amber
lane_rgb = {ln: oklch(0.74, LANE_INFO[ln][1], LANE_INFO[ln][0]) for ln in LANES}

# ---------- time axis ----------
dates = sorted({s['order_date'] for s in S})
rank = {d: i for i, d in enumerate(dates)}
wall_x = [WALLGAP * (rank[s['order_date']] + 1) for s in S]
def dnum(d):
    y, m, dd = map(int, d.split('-')); return y + (m - 1) / 12 + (dd - 1) / 365
def x_of_date(v):
    pts = [(dnum(d), WALLGAP * (rank[d] + 1)) for d in dates]
    if v <= pts[0][0]: return pts[0][1] - (pts[0][0] - v) * WALLGAP / 2
    for (a, xa), (b, xb) in zip(pts, pts[1:]):
        if a <= v <= b: return xa + (xb - xa) * (v - a) / (b - a) if b > a else xa
    return pts[-1][1] + (v - pts[-1][0]) * WALLGAP * 4
ruler = []
for y in range(2003, 2027):
    ruler.append({'x': round(x_of_date(y)), 'year': y})
for (a, b) in zip(dates, dates[1:]):
    gap = dnum(b) - dnum(a)
    if gap >= 1.5:
        ruler.append({'x': round((x_of_date(dnum(a)) + x_of_date(dnum(b))) / 2), 'gap': f'{gap:.0f} years'})
brackets = []
for s in S:
    if s.get('date_range'):
        y0, y1 = map(int, s['date_range'].split('-'))
        brackets.append({'snap': s['i'], 'range': s['date_range'], 'note': s.get('date_note', ''),
                         'x0': round(min(x_of_date(y0), wall_x[s['i']] - 2500)), 'x1': round(wall_x[s['i']] + 600)})
brackets.append({'snap': 7, 'range': '2005-2010 closed', 'note': 'nullDC was closed source 2005-2010; public svn starts 2010-05.',
                 'x0': round(x_of_date(2005.0)), 'x1': wall_x[2]})

# ---------- lane packing (streets) ----------
def dir_parts(p):
    parts = p.split('/')[:-1]
    return (parts[0] if parts else ''), ('/'.join(parts[:2]) if len(parts) > 1 else (parts[0] if parts else ''))

lanes_out = []
slotpos = {}  # lane -> {(identity, ordinal): linear position}
z = 0
for li, ln in enumerate(LANES):
    if ln == 'minicast': z += 3000  # fpgadc moat
    ss = lane_snaps[ln]
    cap = {}; latest = {}
    for si in ss:
        ordc = collections.Counter()
        for f in snaps[si]['files']:
            k = (f['id'], ordc[f['id']]); ordc[f['id']] += 1
            cap[k] = max(cap.get(k, 0), f['n']); latest[k] = f['p']
    parent = LANE_INFO[ln][4]
    ppos = slotpos.get(parent, {})
    keys = sorted(cap, key=lambda k: (latest[k].lower(), k))
    # inherited keys keep the parent's order; new keys ride behind their path-predecessor
    top_rank = {}
    for k in keys:
        t = dir_parts(latest[k])[0]
        if k in ppos: top_rank[t] = min(top_rank.get(t, 1e18), ppos[k])
    tops = sorted({dir_parts(latest[k])[0] for k in keys}, key=lambda t: (top_rank.get(t, 1e18), t.lower()))
    trk = {t: i for i, t in enumerate(tops)}
    sk = {}; prev = -1.0; prevtop = None
    for k in keys:
        t = dir_parts(latest[k])[0]
        if t != prevtop: prev = -1.0; prevtop = t
        if k in ppos: sk[k] = ppos[k]; prev = ppos[k]
        else: prev = prev + 1e-3; sk[k] = prev
    keys.sort(key=lambda k: (trk[dir_parts(latest[k])[0]], sk[k], latest[k].lower()))
    # pack
    col, row = 0, 0; slots = []; pos = {}; districts = []; cur_top = cur_sub = None
    for k in keys:
        top, sub = dir_parts(latest[k])
        need = HDR + cap[k] + GAP
        if cur_top is not None and top != cur_top:
            if row > 0: col += 1; row = 0
        elif cur_sub is not None and sub != cur_sub:
            if row > H // 2:
                col += 1; row = 0
            elif row > 0:
                row += DGAP
        if row > 0 and row + need > H: col += 1; row = 0
        if top != cur_top or sub != cur_sub:
            if districts and districts[-1]['path'] == (sub or top):
                pass
            else:
                districts.append({'path': sub or top or '(root)', 'top': top or '(root)', 'col0': col, 'row0': row})
        cur_top, cur_sub = top, sub
        L = col * H + row
        slots.append([k[0], k[1], col, row, cap[k]]); pos[k] = L
        L2 = L + need
        col, row = divmod(L2, H)
    ncols = col + (1 if row > 0 else 0)
    for d, nx in zip(districts, districts[1:] + [None]):
        d['col1'] = (nx['col0'] if nx and nx['row0'] == 0 else (nx['col0'] + 1 if nx else ncols)) if nx else ncols
    slotpos[ln] = pos
    width = ncols * PITCH
    h, c = LANE_INFO[ln][0], LANE_INFO[ln][1]
    lanes_out.append({'name': ln, 'title': LANE_INFO[ln][2], 'github': LANE_INFO[ln][3], 'group': 'fpgadc' if ln in FPGA else 'emu',
                      'parent': parent, 'z0': z, 'width': width, 'cols': ncols, 'snaps': ss, 'rgb': lane_rgb[ln],
                      'slots': slots, 'districts': districts})
    z += width + 2000

walls = [{'snap': s['i'], 'lane': LANES.index(lane_of[s['i']]), 'x': wall_x[s['i']]} for s in S]

# lineage edges (collect REPORT.md "Lineage graph")
E = lambda a, b, kind, label: {'from': a, 'to': b, 'kind': kind, 'label': label}
edges = [
    E(0, 2, 'concept', 'dc4ever -> nullDC: partial derivation, 0.6 % shared lines'),
    E(2, 1, 'fork-recovered', 'nullDC mainline -> nullDCe: late-2008 fork, recovered snapshot (49 % of lines)'),
    E(4, 5, 'import', 'nullDC trunk c563e07 -> nulldc-360: imported snapshot (93/203 files identical)'),
    E(4, 8, 'import', 'nullDC c563e07 -> reicast import 1c16baeb (39.6 % of lines)'),
    E(1, 8, 'import', 'nullDCe -> reicast import 1c16baeb (30.3 % of lines)'),
    E(12, 14, 'git-fork', 'reicast -> flycast: git fork 2018-10 (merged until 2019-05-17)'),
    E(15, 17, 'git-fork', 'reicast 95b673698 (2021-12-22) -> nullDC 3: git ancestry'),
    E(18, 21, 'import', 'nullDCe bad8d6a -> nullDC4Wii: imported verbatim (203/203 files)'),
    E(22, 26, 'import', 'nullDC4Wii ~9659506 -> NotDC-PS3: imported snapshot (229/272 files)'),
    E(17, 20, 'import', 'nullDC 3 fpgadc commits -> minicast: imported snapshot (513/533 files)'),
    E(17, 24, 'concept', 'nullDC 3 dumps + refsw-offline -> polly2-rtl: concept / dump format, no shared code'),
    E(37, 38, 'copy', 'refsw3 refcore -> polly2-rtl r8 tb/*/ref_copies*.h (~900 verbatim C++ lines)'),
    E(32, 33, 'copy', 'caique-rtl 5aa2376 -> NotDC-PS3 plugs/caiqueAICA (622 lines)'),
    E(3, 27, 'copy', 'nullDC 2010 DSP -> devtools aica_dsp_playground (322 lines)'),
    E(15, 27, 'copy', 'reicast DSP -> devtools aica_dsp_playground (371 lines)'),
    E(30, 31, 'concept', 'nullDC 3 -> shrike4-rtl (SH4): new code, 0.8 % shared lines'),
    E(30, 32, 'concept', 'nullDC 3 -> caique-rtl (AICA): new code, 1.0 % shared lines'),
    E(30, 34, 'concept', 'nullDC 3 -> wren7-rtl (ARM7): new code'),
    E(30, 36, 'concept', 'nullDC 3 refsw -> dreamcast-tests'),
    E(17, 27, 'concept', 'nullDC 3 -> dreamcast-devtools (TS)'),
]
pins = [{'snap': 23, 'label': 'DreamSTer r1'}, {'snap': 24, 'label': 'DreamSTer r1'}, {'snap': 25, 'label': 'DreamSTer r6'},
        {'snap': 28, 'label': 'DreamSTer r6b'}, {'snap': 29, 'label': 'DreamSTer r6b'}]

# survival denominators: possible[o][w] = later snapshots (order) in lanes descending from o's repo or w's repo
order = sorted(range(NS), key=lambda i: (S[i]['order_date'], i))
pos_in_order = {si: k for k, si in enumerate(order)}
desc = [int(s['desc']) for s in S]
possible = []
for o in range(NS + 1):
    osn = 2 if o == NS else o
    row = []
    for w in range(NS):
        m = desc[osn] | desc[w]
        row.append(sum(1 for t in range(NS) if (m >> t) & 1 and pos_in_order[t] > pos_in_order[osn]))
    possible.append(row)

layout = {
    'unit': {'char': 1, 'line': 2, 'colPitch': PITCH, 'textCols': TEXT, 'H': H, 'wallGap': WALLGAP, 'hdr': HDR, 'gap': GAP},
    'lanes': lanes_out, 'walls': walls, 'ruler': ruler, 'brackets': brackets, 'edges': edges, 'pins': pins,
    'origin_rgb': orig_rgb, 'event_order': order, 'possible': possible,
    'fpgadc': {'z0': lanes_out[LANES.index('minicast')]['z0'], 'title': 'fpgadc: hardware re-creation, 2026'},
}
with gzip.open(os.path.join(D, 'layout.json.gz'), 'wt', compresslevel=9) as f:
    json.dump(layout, f, separators=(',', ':'))

# ---------- linemeta ----------
def fold(b):
    out = bytearray(); prevhi = False
    for x in b:
        if x == 9:
            out.extend(b' ' * (4 - len(out) % 4)); prevhi = False
        elif x < 0x20:
            out.append(32); prevhi = False
        elif x < 0x80:
            out.append(x); prevhi = False
        else:
            if 0x80 <= x <= 0xBF and prevhi: pass
            else: out.append(0x7F)
            prevhi = True
    return bytes(out)
COMMENT = (b'//', b'/*', b'* ', b'*/', b'--', b'# ', b';')
meta = bytearray(2 * man['raw_lines']); folded_bytes = 0; n = 0
for c in range(man['text_chunks']):
    lines = gzip.open(os.path.join(D, f'text/lines-{c:03d}.txt.gz')).read().split(b'\n')
    cnt = min(man['chunk_lines'], man['raw_lines'] - c * man['chunk_lines'])
    for i in range(cnt):
        fl = fold(lines[i])
        ln = len(fl); st = fl.lstrip(b' ')
        ind = min(255, ln - len(st))
        com = 1 if (st.startswith(COMMENT) or st == b'*') else 0
        meta[2 * n] = ind; meta[2 * n + 1] = min(127, ln) | (com << 7)
        folded_bytes += min(ln, 124); n += 1
assert n == man['raw_lines'], (n, man['raw_lines'])
with gzip.open(os.path.join(D, 'linemeta.bin.gz'), 'wb', compresslevel=9) as f: f.write(bytes(meta))

# ---------- story + bookmarks ----------
sid = {s['id']: s['i'] for s in S}
def has(snap, path):
    return any(f['p'] == path for f in snaps[sid[snap]]['files'])
BM = [
    ('SH4 interpreter', 'sh4_opcodes 2005 line (dc4ever)', 'dc4ever-2005', 'DC/SH4.7091/sh4_opcodes_test.cs', 0, 'ToDo : Check This [26/4/05]'),
    ('SH4 interpreter', 'sh4_opcodes.cpp in reicast 2013', 'reicast-2013-import', 'newdc/hw/sh4/interpr/sh4_opcodes.cpp', 0, None),
    ('SH4 interpreter', 'sh4_opcodes.cpp in nullDC 3 refsw3', 'nulldc3-refsw3', 'libswirl/hw/sh4/interpr/sh4_opcodes.cpp', 189, None),
    ('SH4 interpreter', 'sh4_opcodes.cpp in flycast', 'flycast-head', 'core/hw/sh4/interpr/sh4_opcodes.cpp', 0, None),
    ('SH4 recompiler', 'nullDC rec_v1 driver', 'nulldc-2011-09', 'nulldc/nullDC/dc/sh4/rec_v1/driver.cpp', 0, None),
    ('SH4 recompiler', 'nullDC rec_v1 driver (2010-05)', 'nulldc-2010-05', 'nulldc/nullDC/dc/sh4/rec_v1/driver.cpp', 0, None),
    ('SH4 recompiler', 'nullDCe rec_v2 driver', 'nullDCe-2009', 'dc/sh4/rec_v2/driver.cpp', 0, None),
    ('SH4 recompiler', 'nullDCe rec_v2 shil', 'nullDCe-2009', 'dc/sh4/rec_v2/shil.cpp', 0, None),
    ('SH4 recompiler', 'reicast ARM dynarec', 'reicast-2013-import', 'newdc/rec-ARM/arm_dyna.cpp', 0, None),
    ('SH4 recompiler', 'reicast-last rec_arm (arm32)', 'reicast-last', 'libswirl/jit/backend/arm32/rec_arm.cpp', 0, None),
    ('SH4 recompiler', 'nullDC 3 rec_x64', 'nulldc3-refsw3', 'libswirl/jit/backend/x64/rec_x64.cpp', 0, None),
    ('SH4 recompiler', 'reicast rec_x64', 'reicast-last', 'libswirl/jit/backend/x64/rec_x64.cpp', 0, None),
    ('SH4 recompiler', 'flycast rec_x64', 'flycast-head', 'core/rec-x64/rec_x64.cpp', 0, None),
    ('PowerVR', 'dc4ever powervr.cs', 'dc4ever-2005', 'DC/PowerVR2DC/powervr.cs', 0, None),
    ('PowerVR', 'nullDC drkPvr d3dRend', 'nulldc-2011-09', 'nulldc/plugins/drkPvr/d3dRend.cpp', 0, None),
    ('PowerVR', 'nullDCe drkPvr glesRend', 'nullDCe-2009', 'plugs/drkPvr/glesRend.cpp', 0, None),
    ('PowerVR', 'nulldc-360 xenosRend', 'nulldc-360-last', 'plugins/drkPvr/xenosRend.cpp', 0, None),
    ('PowerVR', 'reicast gles.cpp', 'reicast-2013-import', 'newdc/rend/gles/gles.cpp', 0, None),
    ('PowerVR', 'refsw (nullDC 3 2023)', 'nulldc3-fpgadc-2023', 'libswirl/rend/soft/refsw.cpp', 0, None),
    ('PowerVR', 'refsw2 tile', 'nulldc3-v3.0.0-pre', 'libswirl/rend/refsw2/refsw_tile.cpp', 0, None),
    ('PowerVR', 'refsw3 refcore tile', 'nulldc3-refsw3', 'refsw3/refcore/refsw_tile.cpp', 0, None),
    ('FPGA', 'polly2 r6b peel_core', 'polly2-r6b', 'polly2-core/rtl/peel_core.sv', 0, None),
    ('FPGA', 'polly2 r8 ref_copies.h (refsw3 C++ copy)', 'polly2-r8-develop', 'tb/ref/ref_copies.h', 0, None),
    ('FPGA', 'shrike4 v1_core', 'shrike4-head', 'rtl/v1/v1_core.sv', 0, None),
    ('FPGA', 'caique aica_core', 'caique-head', 'rtl/v1/aica_core.sv', 0, None),
    ('FPGA', 'wren7 core', 'wren7-head', 'rtl/v1/wren7_core.sv', 0, None),
    ('Cross-lane copies', 'NotDC-PS3 caiqueAICA', 'NotDC-PS3-0.8.3', 'plugs/caiqueAICA/aica_model.cpp', 0, None),
    ('Cross-lane copies', 'devtools aica_dsp_playground dsp.h', 'devtools-v3.0.0-pre', 'experiments/aica_dsp_playground/dsp/dsp.h', 0, None),
    ('Oddities', 'fsca-table.h (4096 rows)', 'nulldc3-refsw3', 'libswirl/hw/sh4/fsca-table.h', 0, None),
    ('Oddities', 'naomi_roms.cpp (longest file)', 'flycast-head', 'core/hw/naomi/naomi_roms.cpp', 0, None),
]
def resolve(snap, path):
    if has(snap, path): return path
    base = path.rsplit('/', 1)[-1]
    c = [f['p'] for f in snaps[sid[snap]]['files'] if f['p'].endswith('/' + base) or f['p'] == base]
    if not c: return None
    # prefer the candidate sharing the most trailing path components
    def score(p):
        a, b = p.split('/')[::-1], path.split('/')[::-1]; n = 0
        for x, y in zip(a, b):
            if x != y: break
            n += 1
        return n
    return max(c, key=score)
bookmarks = []; missing = []
for g, title, snap, path, line, grep in BM:
    p = resolve(snap, path)
    if p is None: missing.append((snap, path)); continue
    bookmarks.append({'group': g, 'title': title, 'snap': snap, 'path': p, 'line': line, 'grep': grep})
chapters = [
    {'title': 'dc4ever, C#, 2003-2005', 'snaps': ['dc4ever-2005'], 'text': 'The second Dreamcast emulator by drk||Raziel (said "D R K Raziel"), written in C#. Its git dates are a 2019 reconstruction from backups (one commit per file at its mtime); the real work is 2003-2005. nullDC was partly derived from it in concept: 0.6 % of nullDC 2010 lines are shared, yet the 2005 line "{//ToDo : Check This [26/4/05]" still lives in nullDC 3.', 'bookmarks': ['sh4_opcodes 2005 line (dc4ever)', 'dc4ever powervr.cs']},
    {'title': 'nullDC, 2005-2013', 'snaps': ['nulldc-2010-05', 'nulldc-2010-12', 'nulldc-2011-09', 'nulldc-last'], 'text': 'nullDC was developed closed-source from 2005; the source went public on Google Code in 2010-05 (nullDC 1.0.x). The plugin architecture (drkPvr, nullAICA, ImgReader) and the rec_v1 SH4 recompiler are here.', 'bookmarks': ['nullDC rec_v1 driver', 'nullDC drkPvr d3dRend']},
    {'title': 'nullDCe, the late-2008 fork', 'snaps': ['nullDCe-2009', 'nullDCe-ps2-2024'], 'text': 'nullDCe forked from nullDC mainline in late 2008 for PSP / Wii / PS3 (and later PS2). The repo is a 2017 commit of a recovered archive; the latest in-source date is 2009-10. Lines present in both nullDCe 2009 and nullDC 2010 are coloured as nullDC-pre2008.', 'bookmarks': ['nullDCe rec_v2 driver', 'nullDCe rec_v2 shil', 'nullDCe drkPvr glesRend']},
    {'title': 'nulldc-360, 2011', 'snaps': ['nulldc-360-2011', 'nulldc-360-last'], 'text': 'gligli\'s Xbox 360 port, imported from nullDC svn trunk of 2011-09 (93 of 203 files identical) plus a Xenos renderer and a PPC dynarec.', 'bookmarks': ['nulldc-360 xenosRend']},
    {'title': 'reicast, 2013', 'snaps': ['reicast-2013-import', 'reicast-r6', 'reicast-r7-rc1', 'reicast-r8', 'reicast-r19.07', 'reicast-r20.04', 'reicast-last'], 'text': 'The newdc / nullDC-Android rewrite of 2012-2013, imported as one commit (1c16baeb). 39.6 % of its lines come from nullDC and 30.3 % from nullDCe. The ARM dynarec and the GLES renderer start here.', 'bookmarks': ['reicast ARM dynarec', 'reicast gles.cpp', 'sh4_opcodes.cpp in reicast 2013']},
    {'title': 'flycast, 2018-', 'snaps': ['flycast-v1.0', 'flycast-v2.0', 'flycast-v2.4', 'flycast-head'], 'text': 'flyinghead\'s git fork of reicast (2018-10; merged until 2019-05-17), the most active descendant today.', 'bookmarks': ['flycast rec_x64', 'naomi_roms.cpp (longest file)']},
    {'title': 'nullDC 3, 2023-', 'snaps': ['nulldc3-fpgadc-2023', 'nulldc3-v3.0.0-pre', 'nulldc3-refsw3'], 'text': 'nullDC 3 (devcast) is built on reicast 2021-12 and starts with the fpgadc refsw-offline work in 2023-07. refsw grows into refsw2 and the refsw3 refcore, the bit-exact reference for the PowerVR2 hardware work.', 'bookmarks': ['refsw (nullDC 3 2023)', 'refsw2 tile', 'refsw3 refcore tile', 'sh4_opcodes.cpp in nullDC 3 refsw3']},
    {'title': 'nullDC4Wii and NotDC-PS3, 2026', 'snaps': ['nullDC4Wii-first', 'nullDC4Wii-a0.50', 'nullDC4Wii-head', 'NotDC-PS3-first', 'NotDC-PS3-0.8.3'], 'text': 'nullDC4Wii imports nullDCe verbatim (2026-01); NotDC-PS3 imports nullDC4Wii (2026-09) and later carries plugs/caiqueAICA, a port of the caique-rtl AICA model.', 'bookmarks': ['NotDC-PS3 caiqueAICA']},
    {'title': 'fpgadc, 2026: the hardware re-creation', 'snaps': ['minicast-import', 'minicast-r1', 'minicast-r6b', 'polly2-r1', 'polly2-r6', 'polly2-r6b', 'polly2-r8-develop', 'shrike4-head', 'caique-head', 'wren7-head', 'dreamcast-tests-head', 'devtools-v3.0.0-pre'], 'text': 'The FPGA branch of the lineage: DreamSTer releases r1..r6b pin polly2-rtl (PowerVR2 in SystemVerilog) and minicast (the reicast-derived ARM side). polly2-rtl r8/develop is the new bit-exact model and carries verbatim refsw3 C++ in ref_copies*.h. shrike4 (SH4), caique (AICA), wren7 (ARM7), dreamcast-tests and dreamcast-devtools are new code.', 'bookmarks': ['polly2 r6b peel_core', 'polly2 r8 ref_copies.h (refsw3 C++ copy)', 'shrike4 v1_core', 'caique aica_core', 'wren7 core']},
]
story = {'author': {'handle': 'drk||Raziel', 'said': 'D R K Raziel', 'github': 'skmp'}, 'chapters': chapters, 'bookmarks': bookmarks}
json.dump(story, open(os.path.join(D, 'story.json'), 'w'), indent=1)

tot_slots = sum(len(l['slots']) for l in lanes_out)
print(f'layout: {len(lanes_out)} lanes, {tot_slots} slots, {sum(l["cols"] for l in lanes_out)} lane columns, '
      f'X extent {max(wall_x)}, Z extent {z}; folded text {folded_bytes/1e6:.1f} MB; {time.time()-t0:.1f}s')
for l in lanes_out: print(f'  {l["name"]:16s} z0={l["z0"]:7d} cols={l["cols"]:4d} snaps={l["snaps"]}')
if missing: print('MISSING bookmarks:', missing)

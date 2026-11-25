#!/usr/bin/env python3
"""viewer_prep.py [DATA]: layout for the time-frame lineage viewer (FOLLOWUP item 0; DESIGN.md 1.6, 6.1).

Reads DATA/frames.json and the lane chunks (tools/provenance/frames). Writes
  DATA/layout.json.gz  lanes (slots, districts), walls (one per frame), time axis (ruler, gaps, brackets), edges,
                       releases / tags / pins (marks), origin colours (one per frame)
  DATA/linemeta.bin.gz u8 indent, u8 len|comment<<7 per distinct raw line, after folding
  DATA/story.json      chapters and bookmarks, resolved to frames and existing paths

Slots: every file identity a lane ever holds gets one slot, sized to its longest version, so a file stays in place
in every frame of its lane (holes where it is absent). A child lane packs inherited identities in its parent's order.
The 48-snapshot version of this script (data-v1/) is in git history (a5cc5f3).

Folding (shared with viewer/src/core.js):
  tab -> spaces to the next multiple of 4; bytes < 0x20 -> space; every byte >= 0x80 that is not a
  UTF-8 continuation byte following a >= 0x80 byte -> 0x7F (one box per code point); continuation bytes dropped.
"""
import os, sys, json, gzip, math, collections, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from frames_lib import Data, ROOT
t0 = time.time()
D = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data'))
data = Data(D); man = data.man; FR = man['frames']; NF = len(FR); VIRT = man['virt']
LANES = [L['name'] for L in man['lanes']]; LI = {n: i for i, n in enumerate(LANES)}

H = 2048; TEXT = 120; PITCH = 128; HDR = 2; GAP = 2; DGAP = 6
MONTH = 4000          # world units per month on the time axis
GAPMAX = 6            # a stretch of more than this many months without frames is drawn as GAPMAX months
FPGA_FIRST = 'minicast'
LANE_INFO = {  # hue (OKLCH degrees), chroma, title, github repo, slot-order parent lane
    'dc4ever': (300, 0.13, 'dc4ever (C#)', 'skmp/dc4ever', None),
    'nullDC': (75, 0.14, 'nullDC', 'skmp/nullDC', None),
    'nulldc-360': (125, 0.14, 'nulldc-360 (Xbox 360)', 'gligli/nulldc-360', 'nullDC'),
    'HarissaDC': (100, 0.14, 'HarissaDC (Xbox 360)', 'kernel64/HarissaDC', 'nulldc-360'),
    'nullDCe': (50, 0.15, 'nullDCe (PSP / Wii / PS3 / PS2)', 'skmp/nullDCe', 'nullDC'),
    'nullDCe-PSP': (320, 0.15, 'nullDCe-PSP (PSP, 2021 restoration)', 'PSP-Archive/nulldce-psp', 'nullDCe'),
    'nullDC4Wii': (10, 0.14, 'nullDC4Wii', 'BenoitAdam/nullDC4Wii', 'nullDCe'),
    'NotDC-PS3': (340, 0.15, 'NotDC-PS3', 'Mayo1970/NotDC-PS3', 'nullDC4Wii'),
    'nullDC4WiiU': (30, 0.17, 'nullDC4WiiU (Wii U)', 'nulldc4wiiu/nulldc_wiiu', 'nullDC4Wii'),
    'reicast': (255, 0.14, 'reicast', 'skmp/reicast-emulator', 'nullDC'),
    'flycast': (215, 0.12, 'flycast', 'flyinghead/flycast', 'reicast'),
    'nulldc3': (145, 0.15, 'nullDC 3 (devcast)', 'skmp/nulldc3', 'reicast'),
    'minicast': (178, 0.11, 'minicast (DreamSTer ARM side)', 'skmp/minicast', 'nulldc3'),
    'polly2': (192, 0.12, 'polly2-rtl main (PowerVR2 FPGA core, r1..r6b)', 'skmp/polly2-rtl', None),
    'polly2-r8': (165, 0.12, 'polly2-rtl r8/develop (new bit-exact model, own history)', 'skmp/polly2-rtl', None),
    'devtools': (205, 0.11, 'dreamcast-devtools (TS)', 'skmp/dreamcast-devtools', None),
    'dreamcast-tests': (225, 0.12, 'dreamcast-tests', 'fpgadc/dreamcast-tests', None),
    'shrike4': (240, 0.13, 'shrike4-rtl (SH4)', 'skmp/shrike4-rtl', None),
    'caique': (262, 0.13, 'caique-rtl (AICA)', 'skmp/caique-rtl', None),
    'wren7': (280, 0.13, 'wren7-rtl (ARM7)', 'skmp/wren7-rtl', None),
}
assert set(LANE_INFO) == set(LANES), set(LANE_INFO) ^ set(LANES)
for ln in LANES: assert LANE_INFO[ln][4] is None or LANES.index(LANE_INFO[ln][4]) < LANES.index(ln)

def oklch(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b; m_ = L - 0.1055613458 * a - 0.0638541728 * b; s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s; g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    def enc(x):
        x = min(1, max(0, x)); return round(255 * (12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055))
    return [enc(r), enc(g), enc(bb)]

# ---------- lane states, decoded once (keyed by global frame) ----------
STATES = {}
for ln in LANES:
    for g, st in data.lane_states(ln): STATES[g] = {k: (v[0], v[1]) for k, v in st.items()}

# ---------- per-lane file history: longest version and latest path of every identity ----------
cap = collections.defaultdict(dict); latest = collections.defaultdict(dict)
for ln in LANES:
    for g in man['lanes'][LI[ln]]['frames']:
        for ident, (path, lines) in STATES[g].items():
            k = (ident, 0); cap[ln][k] = max(cap[ln].get(k, 0), len(lines)); latest[ln][k] = path

# ---------- origin colours: lane hue, lightness stepped by the frame's place in its lane ----------
orig_rgb = [None] * NF
for L in man['lanes']:
    h, c = LANE_INFO[L['name']][0], LANE_INFO[L['name']][1]; n = len(L['frames'])
    for k, g in enumerate(L['frames']):
        orig_rgb[g] = oklch(0.58 + (0.86 - 0.58) * (k / max(1, n - 1)) if n > 1 else 0.74, c, h)
orig_rgb[VIRT] = oklch(0.70, 0.05, 75)   # nullDC-pre2008: desaturated amber
lane_rgb = {ln: oklch(0.74, LANE_INFO[ln][1], LANE_INFO[ln][0]) for ln in LANES}

# ---------- time axis: months, long empty stretches compressed ----------
def mnum(d):   # months since 2000-01 as a float (day resolution)
    y, m, dd = map(int, d.split('-')); return (y - 2000) * 12 + (m - 1) + (dd - 1) / 31
fmonths = sorted({int(mnum(f['date'])) for f in FR})
knots = []; gaps = []; x = 0.0; prev = None
for m in fmonths:
    if prev is None: knots.append((m, 0.0))
    elif m - prev > GAPMAX + 1:
        x += MONTH; gx = x + (GAPMAX / 2) * MONTH; gaps.append((prev + 1, m, gx)); x += GAPMAX * MONTH; knots.append((m, x))
    else: x += (m - prev) * MONTH; knots.append((m, x))
    prev = m
def x_of(d):
    v = mnum(d) if isinstance(d, str) else d; mi = int(math.floor(v))
    for g0, g1, gx in gaps:
        if g0 <= v < g1: return gx - (GAPMAX / 2) * MONTH + (v - g0) / (g1 - g0) * GAPMAX * MONTH
    best = None
    for m, xx in knots:
        if m <= mi: best = (m, xx)
    if best is None: return knots[0][1] - (knots[0][0] - v) * MONTH
    return best[1] + (v - best[0]) * MONTH
# walls: same-day frames of a lane step 1/8 month apart so they do not coincide
walls = []; seen = collections.Counter()
for f in FR:
    if f.get('virtual'): continue
    key = (f['lane'], f['date']); xx = x_of(f['date']) + seen[key] * MONTH / 8; seen[key] += 1
    walls.append({'frame': f['i'], 'lane': LI[f['lane']], 'x': round(xx)})
ruler = []
for y in range(2002, 2027):
    m = (y - 2000) * 12
    if any(g0 <= m < g1 for g0, g1, gx in gaps) or m < fmonths[0] - 12 or m > fmonths[-1] + 1: continue
    ruler.append({'x': round(x_of(f'{y}-01-01')), 'year': y})
for g0, g1, gx in gaps:
    ruler.append({'x': round(gx), 'gap': f'{(g1 - g0) / 12:.1f} years without frames', 'from': f'{2000 + g0 // 12}-{g0 % 12 + 1:02d}', 'to': f'{2000 + g1 // 12}-{g1 % 12 + 1:02d}'})
brackets = []
for f in FR:
    if f.get('date_range') and not f.get('virtual'):
        y0, y1 = map(int, f['date_range'].split('-'))
        brackets.append({'frame': f['i'], 'lane': LI[f['lane']], 'range': f['date_range'], 'note': f.get('date_note', ''),
                         'x0': round(x_of(f'{y0}-01-01')), 'x1': round(x_of(f['date']))})
dc4 = man['lanes'][LI['dc4ever']]['frames']
brackets.append({'lane': LI['dc4ever'], 'range': '2002-2005 (file mtimes)', 'approx': True,
                 'note': 'dc4ever history was rebuilt in 2019 from backups, one commit per file at its file mtime: frame dates are approximate',
                 'x0': round(x_of(FR[dc4[0]]['date'])), 'x1': round(x_of(FR[dc4[-1]]['date']))})
nd0 = man['lanes'][LI['nullDC']]['frames'][0]
brackets.append({'lane': LI['nullDC'], 'range': '2005-2010 closed', 'note': 'nullDC was closed source 2005-2010; public svn starts 2010-05.',
                 'x0': round(x_of('2005-01-01')), 'x1': round(x_of(FR[nd0]['date']))})

# ---------- lane packing (streets) ----------
def dir_parts(p):
    parts = p.split('/')[:-1]
    return (parts[0] if parts else ''), ('/'.join(parts[:2]) if len(parts) > 1 else (parts[0] if parts else ''))
lanes_out = []; slotpos = {}; z = 0
for ln in LANES:
    c = cap[ln]; lt = latest[ln]
    parent = LANE_INFO[ln][4]; ppos = slotpos.get(parent, {})
    keys = sorted(c, key=lambda k: (lt[k].lower(), k))
    top_rank = {}
    for k in keys:
        t = dir_parts(lt[k])[0]
        if k in ppos: top_rank[t] = min(top_rank.get(t, 1e18), ppos[k])
    tops = sorted({dir_parts(lt[k])[0] for k in keys}, key=lambda t: (top_rank.get(t, 1e18), t.lower()))
    trk = {t: i for i, t in enumerate(tops)}
    sk = {}; prevv = -1.0; prevtop = None
    for k in keys:
        t = dir_parts(lt[k])[0]
        if t != prevtop: prevv = -1.0; prevtop = t
        if k in ppos: sk[k] = ppos[k]; prevv = ppos[k]
        else: prevv = prevv + 1e-3; sk[k] = prevv
    keys.sort(key=lambda k: (trk[dir_parts(lt[k])[0]], sk[k], lt[k].lower()))
    col, row = 0, 0; slots = []; pos = {}; districts = []; cur_top = cur_sub = None
    for k in keys:
        top, sub = dir_parts(lt[k]); need = HDR + c[k] + GAP
        if cur_top is not None and top != cur_top:
            if row > 0: col += 1; row = 0
        elif cur_sub is not None and sub != cur_sub:
            if row > H // 2: col += 1; row = 0
            elif row > 0: row += DGAP
        if row > 0 and row + need > H: col += 1; row = 0
        if (top != cur_top or sub != cur_sub) and not (districts and districts[-1]['path'] == (sub or top)):
            districts.append({'path': sub or top or '(root)', 'top': top or '(root)', 'col0': col, 'row0': row})
        cur_top, cur_sub = top, sub
        Lpos = col * H + row
        slots.append([k[0], k[1], col, row, c[k]]); pos[k] = Lpos
        col, row = divmod(Lpos + need, H)
    ncols = col + (1 if row > 0 else 0)
    for d, nx in zip(districts, districts[1:] + [None]):
        d['col1'] = (nx['col0'] if nx['row0'] == 0 else nx['col0'] + 1) if nx else ncols
    slotpos[ln] = pos
    if ln == FPGA_FIRST: z += 3000   # fpgadc moat
    width = ncols * PITCH
    lanes_out.append({'name': ln, 'title': LANE_INFO[ln][2], 'github': LANE_INFO[ln][3],
                      'group': 'fpgadc' if LANES.index(ln) >= LANES.index(FPGA_FIRST) else 'emu',
                      'parent': parent, 'z0': z, 'width': width, 'cols': ncols, 'frames': man['lanes'][LI[ln]]['frames'],
                      'rgb': lane_rgb[ln], 'approx': ln == 'dc4ever', 'slots': slots, 'districts': districts})
    z += width + 2000

# ---------- lineage edges (lane graph of tools/frames.py), labels with counts from the frame data ----------
def frame_at(ln, g):   # the lane's latest frame at or before global frame g
    fs = [x for x in man['lanes'][LI[ln]]['frames'] if x <= g]; return fs[-1] if fs else None
def by_origin_lane(g):
    c = collections.Counter(); tot = 0
    for path, lines in STATES[g].values():
        for r, o, k in lines:
            if k == 0xFFFF: continue
            tot += 1; c['nullDC-pre2008' if o == VIRT else FR[o]['lane']] += 1
    return c, tot
KIND = {'code': 'import', 'merge': 'git-merge', 'copy': 'copy', 'related': 'concept'}
GITFORK = {'flycast', 'nulldc3', 'nullDC4WiiU'}   # lanes sharing git history with their code parent
EDGE_TEXT = {
    ('nullDC', 'nulldc-360'): 'nullDC trunk c563e07 -> nulldc-360: imported snapshot',
    ('nullDC', 'reicast'): 'nullDC c563e07 -> reicast project import 1c16baeb (2012-2013 newdc rewrite)',
    ('nullDCe', 'reicast'): 'nullDCe -> reicast project import 1c16baeb',
    ('reicast', 'flycast'): 'reicast -> flycast: git fork (last shared commit 2018-09-03)',
    ('reicast', 'nulldc3'): 'reicast 95b673698 (2021-12-22) -> nullDC 3: git ancestry',
    ('nulldc3', 'minicast'): 'nullDC 3 fpgadc commits (d5d4eae1, 2024-07) -> minicast: imported snapshot',
    ('nullDCe', 'nullDC4Wii'): 'nullDCe bad8d6a -> nullDC4Wii: imported verbatim',
    ('nullDCe', 'nullDCe-PSP'): 'nullDCe 39c0550 -> nullDCe-PSP: PSP tree restored to build (2021)',
    ('reicast', 'nullDCe-PSP'): 'reicast -> nullDCe-PSP: FSCA table, disc image readers, scheduler, PSP register allocator',
    ('flycast', 'nullDCe-PSP'): 'flycast -> nullDCe-PSP: SHIL / SSA passes, GD-ROM fixes',
    ('nullDC', 'nullDCe-PSP'): 'nullDC -> nullDCe-PSP: vbaARM ARM7 (arm-new.h verbatim), nullAICA',
    ('nulldc-360', 'nullDCe-PSP'): 'nulldc-360 -> nullDCe-PSP: nullAICA / sound output lines',
    ('nullDC4Wii', 'NotDC-PS3'): 'nullDC4Wii ~9659506 -> NotDC-PS3: imported snapshot',
    ('nullDC4Wii', 'nullDC4WiiU'): 'nullDC4Wii 1459ccb -> nullDC4WiiU: git fork (native Wii U port)',
    ('nullDC4Wii', 'HarissaDC'): 'nullDC4Wii -> HarissaDC: studied (CREDITS.md), no shared code',
    ('nulldc-360', 'HarissaDC'): 'nulldc-360 -> HarissaDC: studied (CREDITS.md), no shared code',
    ('flycast', 'HarissaDC'): 'flycast -> HarissaDC: studied (CREDITS.md), no shared code',
    ('dc4ever', 'nullDC'): 'dc4ever -> nullDC: partial derivation (C# to C++)',
    ('dc4ever', 'nullDCe'): 'dc4ever -> nullDCe', ('dc4ever', 'reicast'): 'dc4ever -> reicast',
    ('nulldc3', 'polly2'): 'nullDC 3 dumps + refsw-offline -> polly2-rtl: concept / dump format',
    ('polly2', 'polly2-r8'): 'polly2-rtl main -> r8/develop: same repo, unrelated history (no merge-base)',
    ('nulldc3', 'polly2-r8'): 'refsw3 refcore -> polly2-rtl r8 tb/ (ref_copies*.h)',
    ('caique', 'NotDC-PS3'): 'caique-rtl 5aa2376 -> NotDC-PS3 plugs/caiqueAICA (ported model)',
    ('nullDC', 'devtools'): 'nullDC 2010 DSP -> devtools aica_dsp_playground',
    ('reicast', 'devtools'): 'reicast DSP -> devtools aica_dsp_playground',
    ('nulldc3', 'devtools'): 'nullDC 3 -> dreamcast-devtools (TS)',
    ('nulldc3', 'shrike4'): 'nullDC 3 -> shrike4-rtl (SH4): new code', ('nulldc3', 'caique'): 'nullDC 3 -> caique-rtl (AICA): new code',
    ('shrike4', 'caique'): 'shrike4-rtl -> caique-rtl', ('caique', 'wren7'): 'caique-rtl -> wren7-rtl (ARM7)',
    ('nulldc3', 'wren7'): 'nullDC 3 -> wren7-rtl (ARM7): new code', ('nulldc3', 'dreamcast-tests'): 'nullDC 3 refsw -> dreamcast-tests',
    ('polly2', 'dreamcast-tests'): 'polly2-rtl -> dreamcast-tests', ('shrike4', 'dreamcast-tests'): 'shrike4-rtl -> dreamcast-tests',
    ('caique', 'dreamcast-tests'): 'caique-rtl -> dreamcast-tests',
}
edges = []
for L in man['lanes']:
    ch = L['name']; first = L['frames'][0]; last = L['frames'][-1]
    for e in L['parents']:
        pl = e['lane']; kind = 'git-fork' if (e['kind'] == 'code' and ch in GITFORK) else KIND[e['kind']]
        to = first; fr_ = e.get('frame')
        if e['kind'] in ('related', 'copy'):
            # the first child frame holding lines first seen in the parent lane, from the parent's frame just before it
            to = next((g for g in L['frames'] if by_origin_lane(g)[0][pl]), first)
            fr_ = frame_at(pl, to)
            if fr_ is None: continue
        c, tot = by_origin_lane(last)
        n = c[pl] + (c['nullDC-pre2008'] if pl in ('nullDC', 'nullDCe') else 0)
        label = EDGE_TEXT.get((pl, ch), f'{pl} -> {ch}')
        if e['kind'] == 'merge': label = 'flycast merged reicast until 2019-05-17 (a6b773a23)'
        label += f": {n:,} lines of {ch} {FR[last]['date'][:7]} first seen in {pl}" + (f' ({100 * n / max(1, tot):.1f} %)' if kind != 'copy' else '')
        edges.append({'from': fr_, 'to': to, 'from_lane': LI[pl], 'to_lane': LI[ch], 'kind': kind, 'label': label, 'lines': n})

# ---------- releases, tags, pins, forks, imports ----------
marks = []
for f in FR:
    if f.get('virtual'): continue
    ks = set(f['kinds'])
    if ks & {'tag', 'pin', 'import', 'fork'}:
        marks.append({'frame': f['i'], 'lane': LI[f['lane']], 'kinds': [k for k in f['kinds'] if k != 'month'],
                      'tags': f.get('tags', []), 'labels': f.get('labels', []), 'release': bool(ks & {'tag', 'pin'})})
releases = [{**r, 'frames': [f['i'] for f in FR if ('DreamSTer ' + r['tag']) in f.get('tags', [])]} for r in man['releases']]
assert all(r['frames'] for r in releases), [r['tag'] for r in releases if not r['frames']]

layout = {
    'format': 2,
    'unit': {'char': 1, 'line': 2, 'colPitch': PITCH, 'textCols': TEXT, 'H': H, 'month': MONTH, 'hdr': HDR, 'gap': GAP},
    'lanes': lanes_out, 'walls': walls, 'ruler': ruler, 'brackets': brackets, 'edges': edges, 'marks': marks,
    'releases': releases, 'origin_rgb': orig_rgb,
    'time': {'month0': '2000-01', 'knots': [[m, round(xx)] for m, xx in knots], 'gaps': [[g0, g1, round(gx)] for g0, g1, gx in gaps],
             'note': f'x(date): months since 2000-01 (day resolution), piecewise linear through knots [month, x]; a gap [m0, m1, x] '
                     f'stands for months m0..m1 drawn as {GAPMAX} months centred on x; same-day walls of a lane step month/8'},
    'fpgadc': {'z0': lanes_out[LI[FPGA_FIRST]]['z0'], 'title': 'fpgadc: hardware re-creation, 2023-2026'},
}
with gzip.open(os.path.join(D, 'layout.json.gz'), 'wt', compresslevel=9) as f:
    json.dump(layout, f, separators=(',', ':'))

# ---------- linemeta ----------
def fold(b):
    out = bytearray(); prevhi = False
    for x in b:
        if x == 9: out.extend(b' ' * (4 - len(out) % 4)); prevhi = False
        elif x < 0x20: out.append(32); prevhi = False
        elif x < 0x80: out.append(x); prevhi = False
        else:
            if not (0x80 <= x <= 0xBF and prevhi): out.append(0x7F)
            prevhi = True
    return bytes(out)
COMMENT = (b'//', b'/*', b'* ', b'*/', b'--', b'# ', b';')
text = data.text; meta = bytearray(2 * len(text))
for n, ln in enumerate(text):
    fl = fold(ln); st = fl.lstrip(b' ')
    meta[2 * n] = min(255, len(fl) - len(st)); meta[2 * n + 1] = min(127, len(fl)) | ((1 if (st.startswith(COMMENT) or st == b'*') else 0) << 7)
with gzip.open(os.path.join(D, 'linemeta.bin.gz'), 'wb', compresslevel=9) as f: f.write(bytes(meta))

# ---------- story + bookmarks (frames) ----------
def pick(ln, sel):
    """frame of lane ln: 'first', 'last', a tag ('tag:v2.4'), a commit prefix ('c:761dc87') or a date ('<=2011-09-14')"""
    fs = man['lanes'][LI[ln]]['frames']
    if sel == 'first': return fs[0]
    if sel == 'last': return fs[-1]
    if sel.startswith('tag:'): return next(g for g in fs if sel[4:] in FR[g].get('tags', []))
    if sel.startswith('c:'): return next(g for g in fs if FR[g]['commit'].startswith(sel[2:]))
    if sel.startswith('<='): return [g for g in fs if FR[g]['date'] <= sel[2:]][-1]
    raise ValueError(sel)
def resolve(g, path, grep):
    ps = [v[0] for v in STATES[g].values()]
    if path in ps: return path
    b = path.rsplit('/', 1)[-1]; c = [p for p in ps if p.endswith('/' + b) or p == b]
    if grep:   # prefer a file that holds the grep text
        tx = data.text; hold = {v[0] for v in STATES[g].values() if any(grep.encode() in tx[r] for r, o, k in v[1])}
        c = [p for p in c if p in hold] or sorted(hold)[:1]
    if not c: return None
    def score(p):
        n = 0
        for x, y in zip(p.split('/')[::-1], path.split('/')[::-1]):
            if x != y: break
            n += 1
        return n
    return max(c, key=score)
BM = [  # group, title, lane, frame selector, path, line, grep
    ('SH4 interpreter', 'sh4_opcodes 2005 line (dc4ever)', 'dc4ever', 'last', 'DC/SH4.7091/sh4_opcodes_test.cs', 0, 'ToDo : Check This [26/4/05]'),
    ('SH4 interpreter', 'sh4_opcodes.cpp in reicast 2013', 'reicast', 'c:1c16baeb0', 'newdc/hw/sh4/interpr/sh4_opcodes.cpp', 0, None),
    ('SH4 interpreter', 'sh4_opcodes.cpp in nullDC 3 refsw3', 'nulldc3', 'last', 'libswirl/hw/sh4/interpr/sh4_opcodes.cpp', 189, None),
    ('SH4 interpreter', 'sh4_opcodes.cpp in flycast', 'flycast', 'last', 'core/hw/sh4/interpr/sh4_opcodes.cpp', 0, None),
    ('SH4 recompiler', 'nullDC rec_v1 driver', 'nullDC', 'c:c563e07', 'nulldc/nullDC/dc/sh4/rec_v1/driver.cpp', 0, None),
    ('SH4 recompiler', 'nullDC rec_v1 driver (2010-05)', 'nullDC', 'c:761dc87', 'nulldc/nullDC/dc/sh4/rec_v1/driver.cpp', 0, None),
    ('SH4 recompiler', 'nullDCe rec_v2 driver', 'nullDCe', 'first', 'dc/sh4/rec_v2/driver.cpp', 0, None),
    ('SH4 recompiler', 'nullDCe rec_v2 shil', 'nullDCe', 'first', 'dc/sh4/rec_v2/shil.cpp', 0, None),
    ('SH4 recompiler', 'reicast ARM dynarec', 'reicast', 'c:1c16baeb0', 'newdc/rec-ARM/arm_dyna.cpp', 0, None),
    ('SH4 recompiler', 'reicast-last rec_arm (arm32)', 'reicast', 'last', 'libswirl/jit/backend/arm32/rec_arm.cpp', 0, None),
    ('SH4 recompiler', 'nullDC 3 rec_x64', 'nulldc3', 'last', 'libswirl/jit/backend/x64/rec_x64.cpp', 0, None),
    ('SH4 recompiler', 'reicast rec_x64', 'reicast', 'last', 'libswirl/jit/backend/x64/rec_x64.cpp', 0, None),
    ('SH4 recompiler', 'flycast rec_x64', 'flycast', 'last', 'core/rec-x64/rec_x64.cpp', 0, None),
    ('PowerVR', 'dc4ever powervr.cs', 'dc4ever', 'last', 'DC/PowerVR2DC/powervr.cs', 0, None),
    ('PowerVR', 'nullDC drkPvr d3dRend', 'nullDC', 'c:c563e07', 'nulldc/plugins/drkPvr/d3dRend.cpp', 0, None),
    ('PowerVR', 'spg.cpp (Time to emulate that stuff correctly)', 'nullDC', 'c:761dc87', 'nulldc/plugins/drkPvr/spg.cpp', 0, 'Time to emulate that stuff correctly'),
    ('PowerVR', 'nullDCe drkPvr glesRend', 'nullDCe', 'first', 'plugs/drkPvr/glesRend.cpp', 0, None),
    ('PowerVR', 'nulldc-360 xenosRend', 'nulldc-360', 'last', 'plugins/drkPvr/xenosRend.cpp', 0, None),
    ('PowerVR', 'reicast gles.cpp', 'reicast', 'c:1c16baeb0', 'newdc/rend/gles/gles.cpp', 0, None),
    ('PowerVR', 'refsw (nullDC 3 2023)', 'nulldc3', 'first', 'libswirl/rend/soft/refsw.cpp', 0, None),
    ('PowerVR', 'refsw2 tile', 'nulldc3', 'tag:v3.0.0-pre', 'libswirl/rend/refsw2/refsw_tile.cpp', 0, None),
    ('PowerVR', 'refsw3 refcore tile', 'nulldc3', 'last', 'refsw3/refcore/refsw_tile.cpp', 0, None),
    ('FPGA', 'polly2 r6b peel_core', 'polly2', 'tag:DreamSTer r6b', 'polly2-core/rtl/peel_core.sv', 0, None),
    ('FPGA', 'polly2 r8 ref_copies.h (refsw3 C++ copy)', 'polly2-r8', 'last', 'tb/ref/ref_copies.h', 0, None),
    ('FPGA', 'polly2 r8 ref_copies_setup.h (refsw3 C++ copy)', 'polly2-r8', 'last', 'tb/isp_setup/ref_copies_setup.h', 0, None),
    ('FPGA', 'shrike4 v1_core', 'shrike4', 'last', 'rtl/v1/v1_core.sv', 0, None),
    ('FPGA', 'caique aica_core', 'caique', 'last', 'rtl/v1/aica_core.sv', 0, None),
    ('FPGA', 'wren7 core', 'wren7', 'last', 'rtl/v1/wren7_core.sv', 0, None),
    ('Ports 2021', 'nullDCe-PSP SH4 to MIPS JIT', 'nullDCe-PSP', 'last', 'psp/dc/sh4/rec_v2/psp_driver.cpp', 0, None),
    ('Ports 2026', 'nullDC4WiiU Wii U main', 'nullDC4WiiU', 'last', 'wiiu/main_wiiu.cpp', 0, None),
    ('Ports 2026', 'HarissaDC SH4 PowerPC JIT', 'HarissaDC', 'last', 'src/sh4/sh4_jit.cpp', 0, None),
    ('Cross-lane copies', 'NotDC-PS3 caiqueAICA', 'NotDC-PS3', 'last', 'plugs/caiqueAICA/aica_model.cpp', 0, None),
    ('Cross-lane copies', 'devtools aica_dsp_playground dsp.h', 'devtools', 'last', 'experiments/aica_dsp_playground/dsp/dsp.h', 0, None),
    ('Oddities', 'fsca-table.h (4096 rows)', 'nulldc3', 'last', 'libswirl/hw/sh4/fsca-table.h', 0, None),
    ('Oddities', 'naomi_roms.cpp (longest file)', 'flycast', 'last', 'core/hw/naomi/naomi_roms.cpp', 0, None),
    ('Oddities', 'and here are the new ones :D', 'flycast', 'last', 'core/hw/sh4/sh4_opcode_list.cpp', 0, 'and here are the new ones :D'),
]
bookmarks = []; missing = []
for gname, title, ln, sel, path, line, grep in BM:
    g = pick(ln, sel); p = resolve(g, path, grep)
    if p is None: missing.append((ln, sel, path)); continue
    bookmarks.append({'group': gname, 'title': title, 'lane': ln, 'frame': g, 'date': FR[g]['date'], 'path': p, 'line': line, 'grep': grep})
def span(ln): fs = man['lanes'][LI[ln]]['frames']; return [fs[0], fs[-1]]
chapters = [
    {'title': 'dc4ever, C#, 2002-2005', 'lanes': ['dc4ever'], 'text': 'The second Dreamcast emulator by drk||Raziel (said "D R K Raziel"), written in C#. Its git history is a 2019 reconstruction from backups (one commit per file at its file mtime), so its frames are approximate; the real work is 2003-2005. nullDC was partly derived from it in concept, yet the 2005 line "{//ToDo : Check This [26/4/05]" still lives in nullDC 3.', 'bookmarks': ['sh4_opcodes 2005 line (dc4ever)', 'dc4ever powervr.cs']},
    {'title': 'nullDC, 2005-2013', 'lanes': ['nullDC'], 'text': 'nullDC was developed closed-source from 2005; the source went public on Google Code in 2010-05 (nullDC 1.0.x). The plugin architecture (drkPvr, nullAICA, ImgReader) and the rec_v1 SH4 recompiler are here.', 'bookmarks': ['nullDC rec_v1 driver', 'nullDC drkPvr d3dRend', 'spg.cpp (Time to emulate that stuff correctly)']},
    {'title': 'nullDCe, the late-2008 fork', 'lanes': ['nullDCe'], 'text': 'nullDCe forked from nullDC mainline in late 2008 for PSP / Wii / PS3 (and later PS2). The repo is a 2017 commit of a recovered archive; the latest in-source date is 2009-10, so its first frame is dated 2009-10 (range 2008-2010). Lines present in both nullDCe 2009 and nullDC are coloured as nullDC-pre2008.', 'bookmarks': ['nullDCe rec_v2 driver', 'nullDCe rec_v2 shil', 'nullDCe drkPvr glesRend']},
    {'title': 'nullDCe-PSP, the 2021 restoration', 'lanes': ['nullDCe-PSP'], 'text': 'In 2021 the PSP homebrew scene took nullDCe\'s recovered archive (39c0550, published 2017) and kept its PSP build. xiro and hlide got it compiling and running again; it was uploaded to PSP-Archive on 2021-02-04. To revive it they pulled small pieces of reicast and flycast into the 2009 core: the FSCA sine table, GD-ROM and SHIL fixes. From June to August 2021 the vbaARM ARM7 and nullAICA sound plugins came over from nullDC and nulldc-360, with reicast\'s disc image readers and scheduler, flycast\'s SSA pass and a PSP static register allocator. Work stopped in October 2021, and no code went back into another lane.', 'bookmarks': ['nullDCe-PSP SH4 to MIPS JIT']},
    {'title': 'nulldc-360, 2011-2012', 'lanes': ['nulldc-360'], 'text': 'gligli\'s Xbox 360 port, imported from nullDC svn trunk of 2011-09 plus a Xenos renderer and a PPC dynarec.', 'bookmarks': ['nulldc-360 xenosRend']},
    {'title': 'reicast, 2013-2021', 'lanes': ['reicast'], 'text': 'The newdc / nullDC-Android rewrite of 2012-2013, imported as one commit (1c16baeb), then developed in the open with releases r6 .. r20.04. The ARM dynarec and the GLES renderer start here.', 'bookmarks': ['reicast ARM dynarec', 'reicast gles.cpp', 'sh4_opcodes.cpp in reicast 2013']},
    {'title': 'flycast, 2018-', 'lanes': ['flycast'], 'text': 'flyinghead\'s git fork of reicast (last shared commit 2018-09-03; merged reicast until 2019-05-17), the most active descendant today, with releases v1.0 .. v2.7.', 'bookmarks': ['flycast rec_x64', 'naomi_roms.cpp (longest file)', 'and here are the new ones :D']},
    {'title': 'nullDC 3, 2023-', 'lanes': ['nulldc3'], 'text': 'nullDC 3 (devcast) is built on reicast 2021-12 and starts with the fpgadc refsw-offline work in 2023-07. refsw grows into refsw2 and the refsw3 refcore, the bit-exact reference for the PowerVR2 hardware work.', 'bookmarks': ['refsw (nullDC 3 2023)', 'refsw2 tile', 'refsw3 refcore tile', 'sh4_opcodes.cpp in nullDC 3 refsw3']},
    {'title': 'nullDC4Wii, NotDC-PS3 and nullDC4WiiU, 2026', 'lanes': ['nullDC4Wii', 'NotDC-PS3', 'nullDC4WiiU'], 'text': 'nullDC4Wii imports nullDCe verbatim (2026-01) and ships about 90 tagged alphas; NotDC-PS3 imports nullDC4Wii (2026-09) and later carries plugs/caiqueAICA, a port of the caique-rtl AICA model. nullDC4WiiU is a git fork of nullDC4Wii at 1459ccb (2026-10-25): from 2026-11-07 a native Wii U (Aroma) port with a GX2 renderer, a JIT with fastmem and a HOME menu, released as v0.800-U1 .. U2.2. It shares no code with nullDC4Wii\'s own short-lived Wii U attempt (2026-11-13, removed 11-17).', 'bookmarks': ['NotDC-PS3 caiqueAICA', 'nullDC4WiiU Wii U main']},
    {'title': 'HarissaDC, Xbox 360, 2026', 'lanes': ['HarissaDC'], 'text': 'A Dreamcast emulator for the Xbox 360 whose credits say it studied nullDC4Wii, nulldc-360 and flycast but did not copy them. The measurements agree: no own file is identical to any lane, and at most 0.5 % of its lines appear in any one lane (under 1 % in all of them together), the same level as unrelated repos. Its source arrives in one dump on 2026-11-03 (v0.2.0).', 'bookmarks': ['HarissaDC SH4 PowerPC JIT']},
    {'title': 'fpgadc: the hardware re-creation', 'lanes': ['minicast', 'polly2', 'polly2-r8', 'devtools', 'dreamcast-tests', 'shrike4', 'caique', 'wren7'], 'text': 'The FPGA branch of the lineage. Every DreamSTer release pins a polly2-rtl commit (PowerVR2 in SystemVerilog) and a minicast commit (the nullDC-3-derived ARM side); each pin is a release frame: r1, r2, r2b and r3 on 2026-07-17, r4 = r5 on 2026-07-18 (r5 repins nothing), r6 on 2026-07-30 and r6b on 2026-10-24. polly2-rtl r8/develop is its own lane: the new bit-exact model has its own root commit (no merge-base with main) and carries verbatim refsw3 C++ in tb/ ref_copies*.h. shrike4 (SH4), caique (AICA), wren7 (ARM7), dreamcast-tests and dreamcast-devtools are new code.', 'bookmarks': ['polly2 r6b peel_core', 'polly2 r8 ref_copies.h (refsw3 C++ copy)', 'shrike4 v1_core', 'caique aica_core', 'wren7 core']},
]
for c in chapters: c['frames'] = {ln: span(ln) for ln in c['lanes']}
story = {'author': {'handle': 'drk||Raziel', 'said': 'D R K Raziel', 'github': 'skmp'}, 'chapters': chapters, 'bookmarks': bookmarks}
json.dump(story, open(os.path.join(D, 'story.json'), 'w'), indent=1)

print(f'layout: {len(lanes_out)} lanes, {sum(len(l["slots"]) for l in lanes_out)} slots, {sum(l["cols"] for l in lanes_out)} columns, '
      f'{len(walls)} walls, X extent {max(w["x"] for w in walls)}, Z extent {z}, {len(edges)} edges, {len(marks)} marks; '
      f'{len(bookmarks)} bookmarks; {time.time() - t0:.1f}s')
for l in lanes_out: print(f'  {l["name"]:16s} z0={l["z0"]:7d} cols={l["cols"]:4d} slots={len(l["slots"]):5d} frames={len(l["frames"])}')
for e in edges: print('  edge', e['kind'], e['label'])
if missing: print('MISSING bookmarks:', missing); sys.exit(1)

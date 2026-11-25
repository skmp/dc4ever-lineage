# dc4ever lineage viewer: design

A 3D fly-through of the source code of every snapshot of the nullDC family,
from dc4ever (2003-2005) to nullDC 3 and the fpgadc hardware re-creation
(2026). It is inspired by Rik Arends' Makepad code visualizer, which flies
over 2.5M lines at 120+ fps with the code still readable. This viewer adds
what a commenter asked for there: **a time axis**, plus **lineage**. Every
snapshot is a wall of readable code. Walls stand on a time axis, repos run as
parallel lanes that branch at fork points, and the same file sits in the same
place through time, so it reads as a street.

Inputs (already built and committed, see `agents/collect/REPORT.md` and
`data/manifest.json`):

- 40 snapshots in 17 repos: 13,566 files and 4,092,201 counted lines.
- 736,094 distinct lines (41 MB unpacked, 11.4 MB gz).
- 41 origins (40 snapshots plus `nullDC-pre2008`).
- 4,914 file identities.
- Per-line origin and keep arrays, presence masks, and 40x40 diffs.

Scale this design must handle:

| | value |
|---|---|
| largest snapshot | nulldc3-refsw3: 244,109 lines, 584 files |
| most files | shrike4-head: 1,482 files |
| longest file | flycast core/hw/naomi/naomi_roms.cpp: 8,517 lines |
| everything at once | 4.09M line instances, about 120M glyphs |

Glyph-level work must therefore be bounded by screen pixels, not by corpus
size. That is the main technical decision below (section 4.2).

---

## 1. Spatial layout

### 1.1 Units and axes

- 1 world unit = one monospace character advance. Line pitch = 2 units,
  because the glyph cell is 1 x 2.
- **X = time** (past to future). **Y = up**: line 1 is at the top of a wall
  and lines run downward. **Z = lateral**: lanes, and within a lane the
  directory districts.
- Columns: a file column is 120 characters of text plus an 8-unit gutter,
  so the column pitch is 128 units. Text beyond 120 characters fades over
  the last 4 cells and shows a `›` marker; the full line is in the tooltip.
- Column height **H = 2048 lines** (4096 units). This is the same for all
  lanes, so readability does not change from lane to lane.
  - nulldc3-refsw3 packs to about 130 columns: a wall about 16.6k wide and
    4.1k tall (about 4:1).
  - wren7 packs to 4 columns.

### 1.2 A snapshot is a wall ("page wall")

Each snapshot is an upright wall in the YZ plane at x = X(snapshot). Its text
faces -X, so a camera flying forward in time reads each wall in turn, like a
flipbook. Seen from behind (+X side), a wall shows only its dim backplate and
labels, never mirrored text.

Inside a wall:

- **Files are text columns at true line counts.** Small files stack top to
  bottom in a column. Each file has a 2-line header bar that shows its path
  and is coloured by file status (new / same / edit / move / move+edit /
  copy). Files are separated by a 2-line gap.
- A file longer than H continues at the top of the next column, with a
  continuation chevron. A file that starts mid-column and would overflow
  starts in a fresh column instead.
- **Directories are districts.** A top-level directory change always starts a
  new column. A second-level change does too when the current column is more
  than half full; otherwise it gets a divider rule and a 6-line gap.
- Each district has:
  - a floor strip under the wall, tinted by its dominant origin;
  - a banner above the wall with its directory name. The banner uses the same
    SDF font at about 40x scale, plus a constant-screen-size billboard when it
    is far away.
- District membership comes from the `dirs` table in `snap/SS.json.gz`,
  which also gives lines per origin for the banner's origin bar.

### 1.3 Lanes: a git graph in 3D

Each repo is a lane, a band in Z. The collect step's `fpgadc` lane is split
into one sub-lane per repo, so there are 16 lanes. In Z order, chosen to keep
fork edges short:

```
dc4ever | nullDC | nulldc-360 | nullDCe | nullDC4Wii | NotDC-PS3 | reicast |
flycast | nulldc3 || minicast | polly2 | devtools | dreamcast-tests | shrike4 |
caique | wren7
```

- The fpgadc group (after `||`) gets a 3000-unit moat and its own banner:
  "fpgadc: hardware re-creation, 2026". It reads as its own lane group
  branching from nullDC 3 / refsw.
- Lane band width = the lane's widest wall + 2000 units of margin.
- A wall sits on its lane's band at X(snapshot).

Lineage edges are drawn between walls as ribbons on the floor (y = -200). In
the minimap they show as curves. Edge kinds come from the manifest `parents`
and the collect edges:

| kind | style | instances |
|---|---|---|
| git fork (true ancestry) | solid, lane colour | reicast -> flycast (2018-10-20; last merge 2019-05-17), reicast 95b673698 -> nulldc3 |
| imported snapshot | solid with dashes at the join | nullDC c563e07 -> nulldc-360; nullDC + nullDCe -> reicast import; nullDCe bad8d6a -> nullDC4Wii; nullDC4Wii ~9659506 -> NotDC-PS3; nulldc3 fpgadc -> minicast |
| fork from a recovered snapshot | dotted | nullDC mainline -> nullDCe (late 2008) |
| concept only, 0% code | thin dotted | dc4ever -> nullDC; nulldc3 dumps / refsw-offline -> polly2 main |
| verbatim cross-lane copy | arched ribbon above the walls, labelled with the line count | refsw3 refcore -> polly2 r8 ref_copies (~900 lines); caique -> NotDC-PS3 plugs/caiqueAICA (622); nullDC 2010 + reicast DSP -> devtools aica_dsp_playground (322 + 371) |
| submodule pin | tick marks | DreamSTer r1 / r6 / r6b on the polly2 and minicast lanes. DreamSTer has no wall of its own: 454 Python lines, shown as release markers. |

Coincidental matches are not drawn as edges: shrike4's asm directives and
Python idioms (spot check #18).

### 1.4 Time axis

The dates are irregular: 2005, a 2009-2014 cluster, sparse 2018-2022, then 21
snapshots in 2026. Pure calendar X would crowd 2026 into nothing. So:

- **X = 6000 x rank(order_date)**, where the rank counts distinct `order_date`
  values. Snapshots of different lanes that share a date share an X.
  - 6000 > wall height, so standing between two walls you see the whole next
    wall.
  - Total X extent is about 200k units.
- A **date ruler** on the floor shows real years. The rank-to-date mapping is
  piecewise linear, and gap segments are labelled "4 years" and so on.
- Dates that are not real dates are drawn as hatched brackets on the ruler,
  using text from `agents/collect/datenotes.json`:
  - dc4ever: real 2003-2005, git says 2002 and 2019 because the history was
    rebuilt from backups;
  - nullDC: 2005-2010 closed history, not public;
  - nullDCe: 2008-2010, imported 2017;
  - reicast import: 2012-2013 private newdc;
  - nulldc-360: code 2011-2012.
- `order_date` is used, not the git date: nulldc-360-last is placed at
  2012-09, nulldc-last at 2013-03 and reicast-last at 2021-12. caique-head is
  placed before NotDC-PS3-0.8.3.

### 1.5 Streets: file identity lined up through time

All walls in a lane share **one packing**, computed over the union of the
file identities that occur in any of the lane's snapshots:

- A slot is (column, row0, capacity). Capacity = the identity's maximum line
  count over the lane's snapshots. A file therefore sits at exactly the same
  place in every wall of its lane.
- Looking along +X at a slot, you see that file's versions one behind another
  through time: a street.
- Moves and renames tracked by identity keep their slot. reicast's
  `newdc/...` becomes `libswirl/...` in the same place. The district uses the
  identity's path in the lane's latest snapshot that holds it.
- If a snapshot has several files with the same identity, the k-th one gets
  its own slot (slot key = identity + ordinal).
- A file absent from a snapshot leaves a hole, drawn as a dim outline:
  "not in this snapshot".
- Between consecutive walls of a lane, a faint floor ribbon joins each
  identity's slot, coloured by the file status in the later wall. This makes
  streets visible from far away.
- **Across lanes:** a child lane is packed in its parent's slot order first.
  Inherited identities come in the parent's column order, and new identities
  are inserted into their districts. So an inherited file sits at nearly the
  same relative offset. Its fork ribbon runs from the parent slot to the child
  slot, and a short lateral bend shows the shift.

The cost is holes: union capacity is larger than any single snapshot. That is
acceptable, and it is the price of streets.

### 1.6 Layout output (new offline step)

`tools/viewer_prep.py` works on per-file metadata only (no per-line work,
about 2 s). It writes `data/layout.json.gz`:

```jsonc
{
  "unit": {"char": 1, "line": 2, "colPitch": 128, "textCols": 120, "H": 2048, "wallGap": 6000},
  "lanes": [
    {"name": "nulldc3", "group": "emu", "z0": 123456, "width": 18600, "cols": 141,
     "snaps": [17, 30, 37],
     "slots": [/* flat u32 triples per slot key: identity, ordinal<<16|col, row0<<16|cap */],
     "districts": [{"path": "libswirl/rend", "depth": 2, "col0": 40, "col1": 52}]}
  ],
  "walls": [{"snap": 37, "lane": 8, "x": 192000}],
  "ruler": [{"x": 0, "date": "2005-09-15", "note": "real 2003-2005"}],
  "edges": [{"from": 15, "to": 17, "kind": "git-fork", "label": "4012 shared commits"}]
}
```

The same step writes:

- `data/linemeta.bin.gz`: per distinct line, u8 indent and u8 visible length,
  after tab expansion and clamping. This is about 1.5 MB raw.
- `data/story.json`: section 5.5.

---

## 2. Colour

### 2.1 Palette

- Dark background `#0b0d12`. Text is drawn in its line's colour; backplates
  are near-black, tinted 6% toward the wall's own lane colour.
- **Each lane has a hue** in OKLCH: nullDC amber, nullDCe orange, dc4ever
  violet, nulldc-360 lime, reicast blue, flycast cyan, nulldc3 green,
  nullDC4Wii and NotDC-PS3 rose and magenta. The fpgadc sub-lanes share teal
  to indigo hues.
- Within a lane, snapshots step in lightness from L = 0.58 (oldest) to 0.86
  (newest), at chroma 0.11-0.15, so the 41 origins stay distinct but read as
  families.
- `nullDC-pre2008` (origin 40, inferred, undated) is desaturated amber. It
  has a legend footnote: "in both nullDCe 2009 and nullDC 2010: predates the
  late-2008 fork".
- The palette is a 256 x 8 RGBA texture: one row per mode, plus spare rows.
  Switching mode is a uniform change for the near and middle tiers.

### 2.2 Modes (keys 1-6)

1. **Origin** (default): colour = `origins[o]` of the line. The legend lists
   lanes with their snapshot swatches, and each swatch has a count for the
   current wall from `stats.json`.
   - Toggle "hide incidental matches" (on by default): a line whose origin is
     in an unrelated lane (not in the wall's `anc` mask) counts as a copy only
     inside a run of 3 or more such consecutive lines. Isolated hits, such as
     `return 0;` or argparse boilerplate, take the file's own-lane colour and
     get a small dot. The run test is computed in the decode worker.
2. **Age**: origin `order_date`, on a perceptual sequential ramp (cividis-like
   in OKLab) from 2003 to 2026.
   - Origins whose dates are inferred or imported (dc4ever, nullDCe-2009,
     reicast import, nullDC-pre2008) get a 1-texel dashed underline.
   - A sub-toggle shows age relative to the viewed snapshot instead.
3. **Survival**: keep / possible. `possible` = the number of later snapshots
   in lanes that descend from the origin's repo or from the viewed repo (the
   same definition the provenance step used for keep, from the `desc` masks).
   - The ramp runs red (died soon) to blue (still alive in 2026).
   - Blank and brace-only lines (keep = 255) take their file's colour at 40%.
   - Lines that are absent from the lane's next snapshot get a red tick:
     "deleted next".
4. **Diff vs previous**: the previous snapshot is `parents[0]` (the lane
   predecessor, or the fork parent for a lane's first wall).
   - A line is *kept* if its presence mask has the parent's bit: neutral grey.
   - Otherwise it is *added*: bright green.
   - Removed lines exist only in the parent. They show as red ghosts during a
     morph and as a per-file "-N" badge on the header bar.
5. **Author** (optional, needs blame, section 6.3): the top 12 handles in the
   view get categorical colours; everything else is grey.
6. **Repo of origin**: lane hue only, with no snapshot steps. This is the
   coarse view of who wrote what where.

---

## 3. Time slider, play, and morph

### 3.1 Two presentations

- **Clock** (default; originally named Gallery, `pm=gallery` still opens it): every frame stands at its X. The time slider at
  the bottom moves the camera's target date. The camera glides along X and
  stays at its current Z and Y, so you stay on your street.
- **Now**: each lane shows a single *live wall* on a common moving plane,
  x = X(t). Lanes not yet born are absent.
  - A fork appears as the child's wall peeling off sideways from the parent's
    band, sliding in Z over 0.6 s.
  - The camera rides along with the plane.

### 3.2 Time model

- The slider has two scales:
  - **event time** (default): the 40 snapshot arrivals, evenly spaced;
  - **calendar time**: real dates, with the hatched gaps from 1.4.
- Play / pause, speed (0.25x to 4x) and step back / forward are on the bar
  and on the keys `P`, `,` and `.`.
- In event time, each arrival takes 2.5 s at 1x: 1.5 s of morph, then 1 s of
  hold.

### 3.3 Morph a -> b

The morph runs within one lane, or from a fork parent into a child.

**Correspondence.** This is built in the decode worker in about 10 ms for
240k lines.

1. For each identity (slot key) in both snapshots, group a's lines by line id.
2. Assign b's lines in order to the earliest unused match in a. Same line id
   plus same identity counts as kept. This is greedy, in-order LCS-like
   matching: exact for unchanged runs, and stable for blocks moved within a
   file.
3. Lines with the same id but in different identities are matched in a second
   pass, so code moved between files flies across the wall.
4. Lines in b with no match are added. Lines in a with no match are removed.

Each morph instance is 16 bytes: `lineId|origin|flags`, `posB`, `posA` (or
none), and `seed`.

**Animation.** Stagger comes from `seed` (a hash of the row), so motion flows
down the columns instead of popping.

| phase | t range | what happens |
|---|---|---|
| removed | 0.00-0.35 | lines tint red, then fade out and collapse right to left |
| kept and moved | 0.20-0.80 | lines move from posA to posB along a shallow arc (ease in-out); a line changing column rises a little in Y so moving blocks are visible |
| added | 0.60-1.00 | lines grow left to right from their indent in green, then settle to the mode colour |

File header bars morph their status colour. Absent-to-present slots fill in.

**Check.** The kept / added / removed counts the morph builds must equal
`diffs.json` for the pair, using the same rule: non-blank, whitespace
collapsed, multiset. The verifier checks this (section 7).

---

## 4. Rendering

### 4.1 Stack

- Raw **WebGL2** with ES modules and no build step. three.js is not used: the
  viewer needs about six custom programs, instancing, `texelFetch` on integer
  textures, and a render-to-texture impostor cache. three.js's scene graph and
  material system would do no real work here and would cost more than they
  save. `gl.js` holds about 300 lines of helpers.
- `WEBGL_multi_draw` is used when present (Chrome has it), with a draw-call
  loop as the fallback. `EXT_disjoint_timer_query_webgl2` provides GPU timing.

### 4.2 Text without per-glyph instances

Per-glyph instancing would be about 120M quads for the corpus. The viewer
draws **one instanced quad per line** instead, and the fragment shader
computes which character cell it is in.

The whole deduplicated corpus is GPU-resident once:

- **Text texture**: `TEXTURE_2D_ARRAY`, R8UI, 4096 x 4096 layers, 3 layers
  (48 MB). It holds the 736k distinct lines after load-time folding:
  - tabs are expanded to 4;
  - each non-ASCII code point becomes byte 0x7F, which renders as a hollow
    box;
  - the result is one byte per column.
  It is uploaded chunk by chunk with `texSubImage3D` as chunks arrive. 4096
  is used rather than 8192 so the texture fits any WebGL2 implementation,
  including llvmpipe.
- **Offset table**: R32UI, 2048 x 360. Line id -> byte offset of the folded
  line.
- **Line meta**: RG8UI. Line id -> (indent, length).

**Per-snapshot instance texture**: RG32UI, 8 bytes per line, 33 MB for all 40
snapshots. Instances are sorted by (column, row), so a column's rows are
contiguous.

```
w0 = lineId[0:20] | origin[20:26] | flags[26:32]     (flags: hit, selected, deleted-next, incidental, cont)
w1 = col[0:12]    | row[12:23]    | keep[23:29]      (keep 0..39; 63 = blank or brace-only)
```

Instances are fetched with `gl_InstanceID + uBase`, so no attributes are
rebound per tile. The vertex shader:

- builds the world position from the lane origin, wall X and (col, row);
- sizes the quad to the line's visible length (from line meta);
- in a morph, lerps posA to posB.

**Glyph fragment shader**, per pixel:

1. `cell = floor(local.x)`.
2. `byte = texelFetch(text, offset + cell)`.
3. Sample the SDF atlas at the glyph cell.
4. Coverage = `smoothstep` over `fwidth` (screen-space anti-aliasing).
5. Output in sRGB.

That is three dependent fetches per covered pixel. Cost is bounded by screen
area, not by corpus size.

**Font atlas** (offline, `tools/font/mkatlas.cpp`):

- C++, using the system FreeType (2.13) and an exact Euclidean distance
  transform.
- Font: DejaVu Sans Mono, already on this machine at
  `/usr/share/fonts/truetype/dejavu/`, under a permissive licence. Only the
  derived atlas is written into `data/font/`, together with the licence text.
- Glyphs: ASCII 0x20-0x7E plus the 0x7F box.
- Single-channel SDF: 48 x 96 px cells, 8 px spread, in a 16 x 6 grid (a
  768 x 576 R8 PNG). Metrics go to `data/font/metrics.json`.
- Monospace at these sizes does not need MSDF corner sharpness. If the
  verifier's readability check fails at the target size, the tool can switch
  to MSDF (`msdf-atlas-gen` output in the same layout) without changing the
  shader interface.

### 4.3 LOD tiers

The quantity that drives LOD is **ppl**, the projected pixels per line:

```
ppl = 2 * focalPx / distance
focalPx = viewportH / (2 * tan(fovY / 2))    // fovY = 60°: 1247 px at 1440p
```

| tier | when | what is drawn |
|---|---|---|
| T0 glyphs | ppl >= 6 (distance < about 415 units at 1440p; fully crisp at ppl >= 9, about 280 units) | line quads, glyph shader |
| T1 bars | 0.75 <= ppl < 6 | the same instances, bar shader: one rounded bar from indent to length per line. This is Makepad's "code shape" look. Comment lines are drawn at 60% alpha, using a comment-start flag in line meta. |
| T2 impostors | 0.04 <= ppl < 0.75 | one textured quad per tile, from a GPU-baked, mipmapped impostor (4.5) |
| T3 file quads | ppl < 0.04, or impostor not yet baked | one quad per file per column segment, in the file's dominant-origin colour, from snap json. Directory districts as single quads beyond that. |

- Tier boundaries crossfade over a 15% band of ppl, using screen-space
  dithered alpha (no sorting needed).
- Tiers 0 and 1 share instance data, so the switch costs nothing.
- T3 is available as soon as `manifest.json`, `layout.json.gz` and the 40 snap
  jsons (about 0.4 MB) are loaded. You can fly the whole lineage at once
  before any per-line data arrives.

### 4.4 Tiles, culling, streaming

- **Tile** = 16 columns of one wall: about 32k lines at most. Each tile has
  an AABB. There are about 350 tiles in all.
- **CPU, each frame:**
  - frustum-cull the tiles;
  - distance-cull them against the far plane, which tracks fly speed;
  - choose a tier per tile from ppl at the tile's nearest point.
- **Oblique views:** a near tile spans a large depth range. For tiles that
  contain any T0 or T1, the CPU splits them into cells of 1 column x 256 rows,
  intersects each cell with the frustum, and chooses a tier per cell.
  - The visible row band per column becomes a (base, count) run in the sorted
    instance texture.
  - Runs are merged per program and submitted with one `multiDrawArraysInstanced`
    call per program.
- **Draw order:** opaque backplates front to back first, writing depth. This
  acts as a depth prepass, so farther walls are rejected early. Then T2 and
  T3, then T1 and T0 with depth test LEQUAL, then labels and ribbons.
- **Streaming priority:** a fetch queue ordered by the tile's projected screen
  area divided by distance, with snapshots around the camera's date first.
  - Per snapshot: `snap/SS.bin.gz` (about 0.2 MB gz on average), decoded in a
    worker into the RG32UI layout and transferred.
  - Text chunks are fetched in the order the visible tiles reference them.
    Lines without text yet draw as T1 bars, so there are no holes.
  - `presence-*.bin.gz` (155 KB) loads early, for diff mode and search.
- **Residency budgets (desktop):** all text (48 + 3 + 1.5 MB); all instance
  textures (33 MB); impostor cache 96 MB, LRU. Total about 190 MB of GPU
  memory.

### 4.5 Impostors (T2)

- An impostor is baked per tile by rendering its T1 bars into an RGBA8 render
  target, then calling `generateMipmap`.
  - Resolution scales with need: 256² for far tiles, 512² for mid tiles.
  - Each impostor is baked in the current colour mode. Categorical indices do
    not mipmap, so final colours are stored.
- Mode switch, morph frame, or highlight change: rebakes are budgeted at 2
  tiles per frame, nearest first. Stale impostors keep showing until rebaked.
- During play in Now mode, live walls far from the camera draw T3 instead of
  rebaking each frame.

### 4.6 Frame budget: 120 fps at 2560 x 1440 on a desktop GPU (8.33 ms)

| part | budget |
|---|---|
| CPU: input, camera, tile cull, LOD, cell bands | <= 0.6 ms |
| CPU: draw submission (<= 12 multi-draws plus about 40 small calls) | <= 0.6 ms |
| CPU: DOM, HUD and tooltip (updated at 10 Hz, not per frame) | <= 0.3 ms |
| GPU: backplates and depth | <= 0.3 ms |
| GPU: T0 glyphs (covered px <= 3.7M x overdraw <= 1.5, 3 fetches/px) | <= 2.0 ms |
| GPU: T1 bars (<= 600k instances visible) | <= 0.8 ms |
| GPU: T2 and T3 | <= 0.3 ms |
| GPU: impostor bakes (<= 2 tiles/frame) | <= 1.0 ms |
| GPU: ribbons, labels, minimap | <= 0.3 ms |
| **GPU total** | **<= 4.7 ms** (headroom for compositing and vsync jitter) |

**Adaptive quality.** The viewer keeps rolling 30-frame p90 values of GPU
time (timer query) and CPU time.

- If GPU p90 > 7 ms: first shrink the T0 radius by raising the ppl threshold
  6 -> 8 -> 10, then lower the render scale 1.0 -> 0.85 -> 0.7, then cut the
  bake budget to 1 tile per frame.
- When GPU p90 < 4 ms, the steps are undone in reverse order.
- The HUD shows the active step.

### 4.7 Degraded path: llvmpipe or SwiftShader

The software path is detected two ways:

- `WEBGL_debug_renderer_info` matches `llvmpipe|SwiftShader|softpipe`;
- or the first 60 frames have a median above 30 ms.

On that path:

- render scale 0.5, no MSAA, capped at 30 fps;
- the T0 threshold is ppl >= 10, and T1 is drawn only within 3x the T0
  distance;
- beyond that, T3 only: no impostor baking except 1 tile per 4 frames for the
  wall nearest the camera;
- at most 200k instances and 60 draw calls per frame;
- only the walls within ±2 events of the camera's date have instance textures
  resident;
- morph runs at half the instance density: ghosts are skipped and adds fade
  instead of growing.

The target is >= 20 fps at 1280 x 720 on this 32-thread box under llvmpipe.

On WSL the GPU path needs `GALLIUM_DRIVER=d3d12`, because the default is
llvmpipe. The HUD always prints the renderer string, so a run never claims
GPU numbers while on llvmpipe.

---

## 5. Interaction

### 5.1 Fly controls

| input | action |
|---|---|
| W A S D | move forward, left, back, right |
| Q / E (or C / Space) | move down / up |
| Shift / Ctrl | 4x faster / 4x slower |
| mouse-look | pointer lock on click or right-drag; Esc releases |
| scroll wheel | fly speed, exponential from 10 to 100,000 units/s (shown in the HUD) |
| G | overview of the whole lineage, flown to with the smooth path below |
| `[` / `]` | **time travel on the street**: same identity and same line, in the lane's previous or next wall. The camera keeps its offset from the slot. |
| `{` / `}` | previous / next lane, same date |
| F, double-click, or click a file header | fly to the file: stop 180 units in front of its first line, column centred |
| 1-6 | colour mode |
| P | play / pause |
| `,` / `.` | step one event back / forward |
| `/` | search |
| B | bookmarks |
| M | minimap |
| L | lineage story panel |
| H | help |

- Fly-to paths use the van Wijk–Nuij smooth zoom: zoom out, pan, zoom in,
  over 0.8-2.5 s depending on distance. Any input cancels the flight.
- **Follow a file:** the file panel lists every version of the identity across
  all repos (from `identities.json.gz`, "v": [[snap, file], ...]), with line
  counts and status. Choosing one flies there; "ride the street" auto-steps
  `]` every 2 s.
- The URL hash holds the camera position and direction, mode, time and
  selected file, so any view is a shareable link.

### 5.2 Hover tooltip and pick

Picking is analytic and needs no GPU readback.

1. Intersect the ray with the planes x = X(wall) of walls whose lane band
   contains the hit Z, nearest first.
2. Hit -> (lane, col, row) -> the slot via binary search in the lane's
   sorted slot index.
3. Slot -> identity -> the snapshot's file with that identity -> the line
   index.
4. Line index -> line id, origin, keep, and the presence mask.

This costs microseconds per frame.

The tooltip shows (DOM, updated at 10 Hz):

- path, snapshot (id, date and ref) and line number;
- the full untruncated line text;
- **origin snapshot**: id, date, lane, plus the real-date note when one
  applies;
- keep and survival;
- **present-in strip**: 40 dots in snapshot order, lit from the presence mask,
  coloured by lane;
- file status and similarity versus its predecessor;
- **author handle** from blame (section 6.3), shown as "last changed by
  `<handle>` in `<short sha>` `<date>`". If that commit is one of the known
  import or reconstruction roots, the tooltip says "imported snapshot (`<sha>`,
  `<date>`); real authorship predates it" instead of implying authorship. The
  roots are dc4ever 2019, nullDCe 2017, reicast 1c16baeb, nulldc-360 0330292,
  nullDC4Wii e812c58, NotDC-PS3 5a32b94 and minicast 580d7b8.
- Click pins the tooltip. A pinned tooltip offers "open on GitHub":
  `https://github.com/<repo>/blob/<commit>/<path>#L<n>`, public repos only.

### 5.3 Search (`/`)

- **Path search:** fuzzy subsequence match over all paths in the 40 snap
  jsons, run in the main thread, under 5 ms. Results are grouped by identity
  and show each identity's snapshots.
- **Text search:** substring or regex in the search worker, over the folded
  corpus (41 MB, about 60 ms per query). The worker shares the text with the
  main thread through a `SharedArrayBuffer`, because the server sends the
  COOP/COEP headers.
  - It returns up to 10k line ids. For the current wall, the worker maps them
    to instance positions.
  - Each hit is listed with its "first appearance" (origin) and its lanes,
    from the presence masks.
  - Hits get the `hit` flag: a glow in T0 and T1, and a beacon pillar above
    the column in T2 and T3.
  - Enter flies to the next hit.

### 5.4 Bookmarks

Bookmarks are stored as (snapshot id, path, line) and resolved to an identity
at load, so they survive pipeline reruns. They ship in `data/story.json`;
user bookmarks go to `localStorage`.

| group | bookmarks |
|---|---|
| SH4 interpreter | `sh4_opcodes.cpp` street (dc4ever `DC/SH4.7091/sh4_opcodes_test.cs` -> reicast `newdc/hw/sh4/interpr/sh4_opcodes.cpp` -> nulldc3 `libswirl/hw/sh4/interpr/sh4_opcodes.cpp` -> flycast `core/hw/sh4/interpr/sh4_opcodes.cpp`). Includes the 2005 line `{//ToDo : Check This [26/4/05]` (spot check #1), still in nullDC 3. |
| SH4 recompiler | nullDC `nulldc/nullDC/dc/sh4/rec_v1/driver.cpp`; nullDCe `dc/sh4/rec_v2/driver.cpp` + `shil.cpp`; reicast `newdc/rec-ARM/arm_dyna.cpp` (-> `libswirl/jit/backend/arm32/rec_arm.cpp`); `rec_x64.cpp` (reicast / nulldc3 / flycast) |
| PowerVR | dc4ever `DC/PowerVR2DC/powervr.cs`; nullDC `nulldc/plugins/drkPvr/d3dRend.cpp`; nullDCe `plugs/drkPvr/glesRend.cpp`; nulldc-360 `plugins/drkPvr/xenosRend.cpp`; `ta_vtx.cpp`; reicast `rend/gles/gles.cpp`; refsw `libswirl/rend/soft/refsw.cpp` -> refsw2 `libswirl/rend/refsw2/refsw_tile.cpp` -> refsw3 `refsw3/refcore/refsw_tile.cpp` |
| FPGA | polly2 r6b `polly2-core/rtl/peel_core.sv`; polly2 r8 `tb/ref/ref_copies.h` (the refsw3 C++ copy); shrike4 `rtl/v1/v1_core.sv`; caique `rtl/v1/aica_core.sv`; wren7 `rtl/v1/wren7_core.sv` |
| Cross-lane copies | NotDC-PS3 `plugs/caiqueAICA/aica_model.cpp`; devtools `experiments/aica_dsp_playground/dsp/dsp.h` |
| Oddities | `fsca-table.h` (4096 rows since the reicast import); flycast `core/hw/naomi/naomi_roms.cpp` (the longest file) |

### 5.5 Minimap and story panel

**Minimap** (bottom left, a 2D canvas, redrawn only when something changes):

- It is the top-down git graph: X = time with the year ruler, rows = lanes.
- Walls are ticks with thickness proportional to line count. Fork, import and
  copy edges use the styles from 1.3.
- It shows the camera position and frustum wedge.
- Click teleports there; drag scrubs time.
- An inset shows the current wall's district map with the camera rectangle.

**Lineage story panel** (right, collapsible; `data/story.json`, written from
the collect and provenance facts):

1. dc4ever, C#, 2003-2005. The git dates are a 2019 reconstruction; nullDC
   was partly derived from it.
2. nullDC, 2005-2013. Source public from 2010-05; 2005-2010 closed.
3. nullDCe, the late-2008 fork for PSP / Wii / PS3.
4. nulldc-360, 2011.
5. reicast, 2013: the newdc rewrite, 39.6% of its lines from nullDC.
6. flycast, 2018-.
7. nullDC 3, 2023-: built on reicast 2021-12, fpgadc refsw-offline. 32.8k of
   today's nullDC 3 lines date from 2010 or earlier.
8. nullDC4Wii and NotDC-PS3, 2026.
9. fpgadc, 2026: DreamSTer r1..r6b, polly2-rtl (main and r8/develop), shrike4,
   caique, wren7, dreamcast-tests, devtools.

Each chapter has a "fly there" button and a guided tour, a camera spline
through its bookmarks. The author handle is shown as `drk||Raziel`, with the
note "said D R K Raziel". No personal data appears beyond handles already in
git.

---

## 6. Data format and loader

### 6.1 Files

**Existing** (`data/`, 19.7 MB):

- `manifest.json`
- `text/lines-NNN.txt.gz` (12)
- `text/presence-NNN.bin.gz` (12)
- `snap/SS.json.gz` and `snap/SS.bin.gz` (40 each)
- `identities.json.gz`
- `diffs.json`
- `stats.json`

The reference decoder is `tools/prov_query.py`.

**New** (`tools/viewer_prep.py`, `tools/font/mkatlas`, `tools/blame.py`):

| file | size | contents |
|---|---|---|
| `layout.json.gz` | about 150 KB | 1.6 |
| `linemeta.bin.gz` | about 0.8 MB | u8 indent and u8 length per line id, after folding; bit 7 of length = starts with a comment marker |
| `story.json` | | chapters, bookmarks, edge labels |
| `font/sdf.png`, `font/metrics.json` | | font atlas and metrics |
| `blame/SS.bin.gz` (optional) | | per line, u16 index into `blame/commits-<repo>.json.gz` (`{sha7, handle, date}`, no emails, no subjects) |

### 6.2 Loader pipeline

All workers are ES-module workers and decode with `DecompressionStream('gzip')`.
The files are served as `application/octet-stream`, not with
`Content-Encoding`, so they are not double-decoded.

1. **Boot, under 0.5 MB:** manifest + layout + font + 40 snap jsons + story.
   Draw T3 for everything. The first frame should appear within 1 s on the
   local server.
2. **Decode worker:**
   - `SS.bin` -> the u32 ids / u8 origins / u8 keeps split (as in
     `prov_query.py`);
   - plus the lane slots -> the RG32UI instance array, sorted by (col, row);
   - plus the incidental-run flags.
   - Results are transferred as ArrayBuffers; the main thread uploads them
     with `texSubImage2D`.
3. **Text worker:**
   - fetch chunks in priority order;
   - fold tabs and non-ASCII;
   - build the folded byte stream and the offset table;
   - hand slices to the main thread for `texSubImage3D` upload;
   - keep the SharedArrayBuffer for search and tooltips.
4. **Presence and blame** load lazily, on the first diff-mode use, search, or
   author mode or hover.

**Server:** `tools/serve.mjs`. Node 22 with no dependencies; it serves
`viewer/` and `data/`.

- It binds 0.0.0.0 and sends COOP/COEP headers.
- It prints `http://<WSL address from hostname -I>:8742/`, because WSL2 NAT
  does not forward localhost to Windows.
- It also accepts `POST /__report`, which the verifier uses (7.3) to write
  JSON into `agents/verify/`.

### 6.3 Blame (optional step)

`tools/blame.py` runs `git blame --line-porcelain <commit> -- <path>` for
every counted file of every snapshot, in a pool of 16 processes.

- It keeps only the author name (the handle as it is in git) and the commit
  date. Emails and subjects are dropped.
- Expected run time is about 10 minutes, dominated by the reicast, flycast and
  nulldc3 histories. It runs once, caching in `agents/viewer/work/`.
- This is "last changed by", not "originally written by": the origin snapshot
  answers the second question. The tooltip labels both accordingly.

### 6.4 Code layout

```
viewer/index.html
viewer/src/main.js        camera, frame loop, adaptive quality
viewer/src/gl.js          tiny WebGL2 helpers, timer queries
viewer/src/layout.js      lane / wall / slot math, analytic pick
viewer/src/data.js        fetch queue, worker clients, residency LRU
viewer/src/w_decode.js    snapshot bins -> instances, morph correspondence
viewer/src/w_text.js      text chunks -> folded corpus, search
viewer/src/render/        plates.js text.js bars.js impostor.js filequads.js ribbons.js labels.js
viewer/src/ui/            timeline.js minimap.js tooltip.js search.js bookmarks.js story.js legend.js hud.js
viewer/src/bench.js       scripted camera paths, stats, /__report
tools/viewer_prep.py  tools/font/mkatlas.cpp  tools/blame.py  tools/serve.mjs
tools/verify/run.mjs      headless Chromium driver (CDP over Node's built-in WebSocket)
```

---

## 7. Measurement plan for the verifier

All outputs go to `agents/verify/`. Each run stays well under a minute unless
noted. Every result JSON records the renderer string, viewport, device pixel
ratio and commit.

### 7.1 Data and layout correctness (Node or Python, no browser)

1. **Placement completeness.** Every line of every snapshot gets exactly one
   (lane, col, row). The sum must be 4,092,201, and no two lines in one wall
   may share a cell. No slot may overlap another; slots must stay within the
   lane's column count and H.
2. **Streets.** For every lane and identity, the slot is identical across all
   of the lane's walls. Report the number of fork ribbons whose lateral shift
   is more than 2 columns.
3. **Decoder parity.** Use `agents/provenance/pick.py` to pick 500 random
   (snapshot, path, line) triples, stratified by origin. For each, text,
   origin and keep from `viewer/src/w_decode.js` (run under Node) must equal
   `tools/prov_query.py`, with 0 mismatches. Add the 20 spot-check lines from
   `spotcheck.txt`, which must give the same origins.
4. **Folding.** Visible lengths in `linemeta` equal a reference fold over 10k
   random lines. Each 0x7F count equals the number of non-ASCII code points.
5. **Morph accounting.** For the 39 parent -> child pairs plus 10 random
   pairs, the morph's kept, added and removed counts equal `diffs.json` exactly.

### 7.2 Rendering correctness (headless Chromium, `?bench=` URLs)

Use `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`, driven over
CDP by `tools/verify/run.mjs`.

1. **Readability.** At bookmark "sh4_opcodes 2005 line", at 2560 x 1440, take
   a screenshot.
   - Crop the line's cell rectangle, which the page computes from the layout,
     and run tesseract on it if it is installed. Otherwise compare it to a
     golden made by drawing the same string with Canvas2D in DejaVu Sans Mono
     at the same px size; the bar is SSIM >= 0.9.
   - Pass: the text is exact, or SSIM >= 0.9, at ppl 9 and 12.
2. **Tier coverage.** Run the 5 scripted paths and log the instances per tier
   per frame. Assert:
   - T0 is never drawn for a cell whose ppl is below the threshold;
   - no visible tile is blank: every frustum tile drew at least T3.
3. **Colour modes.** For 200 random visible lines per mode, read the pixel at
   the line's bar centre (T1) and check it equals the palette entry for that
   line's origin, keep or diff status, within ±2 per channel.
4. **Pick.** For 200 random screen points on walls, the pick result (snapshot,
   path, line) equals the line whose cell rectangle contains the point.
5. **Goldens.** Take 8 fixed views: overview, nulldc3 street, refsw3 T0,
   fpgadc group, fork at reicast -> flycast, the caique -> NotDC-PS3 arch,
   and mid-morph at t = 0.5 on two pairs. Perceptual diff them against
   approved images in `agents/verify/golden/`. The first run creates the
   goldens for human review.

### 7.3 Performance

**Instruments.** Timer queries give GPU time per frame. CPU time is
`performance.now()` around the frame. rAF deltas give presented fps. Chromium
runs with `--disable-gpu-vsync --disable-frame-rate-limit` so frame rate is
not capped at 60. The JS heap is read from `performance.memory`, and the GPU
residency is read from the viewer's own byte counters.

**Five scripted camera paths,** 20 s each with a fixed seed:

| path | what it does |
|---|---|
| A | glide along the nulldc3 sh4_opcodes street through all 40 dates (`]` steps) |
| B | wide overview orbit of all lanes |
| C | fast fly at 50k u/s, 2005 -> 2026, through the emu lanes |
| D | T0-heavy reading crawl over the refsw3 wall (max glyph pixels) |
| E | Now-mode play 2005 -> 2026 at 4x (morph load) |

Report p50, p95 and p99 of GPU ms, CPU ms and frame ms; the draw calls and
instances per tier; and the adaptive quality steps taken.

**Targets:**

| renderer | viewport | target |
|---|---|---|
| desktop GPU (Windows Chrome, measured by the user, or WSL Chromium with `GALLIUM_DRIVER=d3d12` and the renderer string showing D3D12) | 2560 x 1440 | frame p95 <= 8.3 ms and p99 <= 11 ms on paths A-D at quality step 0; path E p95 <= 8.3 ms with at most 1 adaptive step |
| llvmpipe, degraded path | 1280 x 720 | p50 <= 50 ms (>= 20 fps) on A-E |
| either | | no frame > 100 ms after load, except the first upload of a text chunk (logged separately) |

**Load:**

| measure | target |
|---|---|
| first frame with T3 | <= 1.0 s |
| first readable T0 at the start bookmark | <= 2.5 s |
| all text resident | <= 6 s on the local server |
| bytes before first T0 | <= 1.5 MB |

**Memory:**

| measure | target |
|---|---|
| GPU, desktop | <= 256 MB |
| GPU, llvmpipe path | <= 96 MB |
| JS heap | <= 400 MB |

### 7.4 Access check

`tools/serve.mjs` is reachable at `http://<WSL address>:8742/`. The verifier
fetches `/` through the WSL address, not 127.0.0.1, and asserts that COOP and
COEP are present, which proves `SharedArrayBuffer` works (`crossOriginIsolated`
is true in the page).

### 7.5 Output

`agents/verify/results-<date>.json` with every assertion: name, pass/fail,
numbers. `agents/verify/frames-<path>.csv` with per-frame data. The goldens
and screenshots go alongside.

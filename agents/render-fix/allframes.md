# Request 3: "all frames should always be rendered except when close to camera"

Everything for this note is under `agents/render-fix/allframes/`. That folder holds the eval scripts (`js/`), the shots
(`base/shots`, `proto-out/shots`), the bench JSON and CSV files (`bench-*`, `bench2-*`, `bench3-*`, `bench4-*`), the
prototype as diffs (`proto-main.diff`, `proto-bench.diff`) and a private copy of the viewer (`proto/`). The prototype ran
on its own server, port 8761, which is now stopped. The working tree `viewer/` was not touched and nothing was
committed. GPU: Mesa d3d12 on Xvfb.

## Today (viewer/src/main.js)

- `updateDisplay()` (main.js:697-747) writes `(x, alpha, solid)` for each wall into `wallArr` / `wallTex`.
  - **Clock** (the default): each lane's frame at the clock is solid. Frames within GH = 6 months (main.js:687) are
    ghosts with alpha 0.05-0.30 and no plates. `solidRelease` walls are solid (main.js:71-74: every DreamSTer pin, and
    at most one tag per month per lane). All other walls are not drawn: dispList is about 54-64 of the 395 walls.
  - **Gallery** (main.js:709): all 395 walls are solid.
  - **Now**: the live wall rides at X and morphs; ghosts and releases are shown as in Clock.
- The "behind" fade (main.js:730-741): when the camera reads the live wall from less than 3200 units, the lane's walls
  behind that wall fade out. This applies to the live (clock) wall only.
- LOD (`frame()`): only solid walls are streamed (`want`), baked or carded. Ghosts draw an impostor if one exists,
  otherwise T3 quads. Rect items with flag 32 (the plates) are dropped when the wall is not solid (shaders.js:182).
- Titles (main.js:416-420): tier 2 is each lane's frame at the clock, tier 1 is the other solid walls, tier 0 the ghosts.

## Measured: what "every wall solid" (today's Gallery) costs

Single views at 1920x1080, after `whenReady` plus 1.5 s. Mean GPU time over 60 frames. "GPU MB" is the viewer's own
estimate of GPU memory.

| view (`js/*.js`) | mode | walls drawn | draws | line inst. | GPU ms | CPU ms | GPU MB | loaded walls |
|---|---|---|---|---|---|---|---|---|
| obl (oblique, 30k away) | clock | 64 | 64 | 0 | 0.11 | 0.82 | 145 | 1 |
| | gallery | 395 | 306 | 0 | 0.30 | 1.22 | 145 | 1 |
| | **all frames (proto)** | 395 | 306 | 0 | 0.34 | 1.30 | 179 | 9 |
| high (from above) | clock | 64 | 69 | 0 | 0.12 | 0.96 | 145 | 1 |
| | gallery | 395 | 162 | 0 | 0.21 | 1.27 | 145 | 1 |
| | **all frames** | 395 | 162 | 0 | 0.23 | 1.26 | 179 | 9 |
| lane (in reicast, 6000 before the clock frame) | clock | 64 | 82 | 138k | 0.98 | 0.84 | 206 | 4 |
| | gallery | 395 | 241 | 232k | 1.52 | 1.40 | 300 | 18 |
| | **all frames** | 393 | 227 | 98k | 1.00 | 1.49 | 329 | 24 |
| read (clock frame, 11 px/line) | clock | 54 | 56 | 2.7k | 0.25 | 0.81 | 165 | 2 |
| | gallery | 395 | 236 | 77k | 0.83 | 1.43 | 305 | 18 |
| | **all frames** | 352 | 139 | 2.7k | 0.38 | 1.11 | 253 | 14 |

Benchmark at 2560x1440, 15 s per path. Paths A, B and C run in Gallery today. "clock" in the C row is path C forced
to today's Clock mode (`&cclock=1`).

| path | today | today Clock | all frames (proto) |
|---|---|---|---|
| B orbit | 137.8 fps, GPU p95 0.25 ms | | 132.9 fps, GPU p95 0.25 ms |
| C lane flights | Gallery: 58.6 / 65.3 fps (2 runs), GPU p95 36-53 ms, 10-15 frames > 100 ms, 421 bakes | **111.4 fps, GPU p95 11 ms, 0 frames > 100 ms, 143 bakes** | 52-58 fps, GPU p95 53-63 ms, 15-17 frames > 100 ms, 532 bakes |
| D close reading (Clock) | 134.9 fps | | 133.1 fps |
| E live playback (Now) | 124.7 fps, 96 draws p95, 28 bakes | | 109 fps, 390 draws p95, 190 bakes, 1 frame > 100 ms |
| A file street | Gallery: 91.5 fps, 4 frames > 100 ms | | 91.8 fps, 1 frame > 100 ms |

What the numbers say:

- **Far views cost little.** With all walls at their X, the far field is T4 / T5 batches (main.js `drawRanges`: one
  draw once more than 300 or 120 walls use the tier). That means 160-310 draws and 0.2-0.3 ms of GPU. Today's Clock
  mode at the same views: 64 draws, 0.1 ms.
- **Flights along a lane are the cost.** Path C drops from 111 fps (today's Clock) to 52-65 fps, with 10-17 frames
  over 100 ms, because 3-4 times as many walls are streamed and baked (143 bakes in Clock, 421-548 with all walls).
  - The slow frames all stall in the `pre` section: 120-200 ms of CPU before the LOD pass. That is a wait on a GPU
    backlog, not CPU work.
  - Cutting the bake budget from 1.2 M to 300 k lines per frame did not help (52.7 fps, 9 frames over 100 ms;
    `bench4-*`). So the stall is not the bake draws. The likely sources are instance-pool uploads and the allocation
    plus mipmapping of new impostor textures. I did not chase this further.
  - Gallery has this problem today. Making all walls the default would bring it to every lane flight, so it must be
    fixed first, probably together with the "frames render in blocks" investigation.
- **Memory.** Every wall's impostors and lines can never be resident together:
  - Low-res impostors for all 395 walls: 1057 MB, against a 192 MB cap (`IMP.capLo`).
  - Lines of all walls: 43.8 M, against an instance pool of 8.4 M (2048 rows x 4096).
  - So the far field must stay on T3 / T4 / T5 (static buffers, already built for every wall), and LRU churn sets the
    cost. Measured: 300-330 MB in the lane view with all walls (206 MB in Clock), within the existing caps.
- **Stacked walls.**
  - 107 of the 395 walls are within 500 units of a later frame in the same lane, and 144 within 1000 units.
  - Examples: reicast and nullDC4Wii have pairs only 16 units apart; nullDC4Wii has 97 consecutive gaps under one
    month.
  - With every wall solid, these become slabs of near-identical walls, with text showing through the gaps (see the r8
    and r8.1 titles in `base/shots/read-gallery`).
  - Today's Clock hides them by allowing at most one solid release per month.

## Design

### What is shown

Every wall is drawn solid at its own X in the default presentation. The clock no longer decides **visibility**; it
decides the **focus**: in each lane, the frame at the clock. The focus frame:

- gets the tier-2 title;
- is the reference for colour mode 4 (diff vs previous) and for the morph;
- is never faded;
- gets the "behind" fade (below).

### "Close": which walls fade

A wall fades when all of the following hold:

1. it is **in front of the camera**: `wall.x > cam.x`. Walls behind the camera are back-facing and culled already;
2. it is **near**: `d = boxDist(camera, wall rectangle) < d1`;
3. it is **not the focus** of its lane, nor the morph source in Now;
4. it is **not being read**: its px per line at that distance is below `read`.

Fade: `a = max(smoothstep(d0, d1, d), smoothstep(0.7 * read, read, ppl))`.

- `d0 = 2800` and `d1 = 6000` world units. These are geometric: with the 60 degree FOV, a 4096-high wall fills the
  screen height at 3547 units and 59 % of it at 6000. So "close" means "the wall covers most of the screen". The
  values do not depend on resolution.
- `read = 2.2` px per line: the token tier, where file structure becomes legible. This one does depend on resolution:
  the wall stays solid from 850 units at 1080p and 1130 units at 1440p.
- The result: a wall in your lane turns translucent between about 6000 and 2800 units and is gone below that. It comes
  back solid once you are close enough to read it, so walking up to any wall to read it works without moving the clock.

Why use the distance to the wall's nearest point (boxDist) and not the distance along X or along the view ray:

- it is smooth everywhere;
- it fades the walls you are inside the street of, and leaves walls beside the street alone once they are more than
  d1 away sideways;
- it needs no ray tests.

Measured with the prototype:

- **Lane view** (`proto-out/shots/lane-allf` vs `base/shots/lane-gallery` and `lane-clock`): the 2018-07, r7 and
  2018-08 walls between the camera and the clock frame faded. The clock frame, 6000 units ahead, reads clearly.
- **Reading reicast r20.01 while the clock is on another frame** (`ncr11-allf`, `ncr1-allf`): solid at 11 px per line;
  faded at 1.2 px per line (1560 units), where the walls behind it show instead.

### How the fade is drawn

A fading wall (a < 1) takes the ghost path:

- solid flag = 0, so no plates and no depth write, and it leaves `occList` (title occlusion);
- an impostor at alpha a (or T3 quads until one is baked);
- at a < 0.02 it is not drawn.

A fading wall can stay in the stream and bake lists, so its impostor is ready when it fades. Measured: that does not
change the cost (`bench2-allf-nobake`: 548 bakes vs 532).

Two things are still missing from the prototype:

- **Easing over time.** Ease each wall's alpha towards its target over about 0.25 s, as titles already do with
  `TT.cur`. Without it, a focus change (a clock step, `[`, `]`, a search hit) makes the old clock wall in front of the
  camera disappear in a single frame.
- **An outline floor (optional).** Keep the ghost outline (main.js:202) at about 0.15 so a faded wall still reads as
  "a frame is here". The owner's "except when close to camera" fits floor = 0, which is what the prototype uses
  (`&nff=` sets it).

### The "behind" fade, generalised

Today, only the live wall's lane-mates behind it fade when you read closely. With every wall solid, this has to apply
to whichever wall is being read: the focus, or any wall at reading range. Otherwise the next frame of a stack, 16 to
500 units behind, shows its text through the gaps between columns as a second layer.

### Stacks (a decision for the owner)

Frames less than about 1000 units apart in one lane (144 walls in 33 stacks) are drawn as one slab: the latest frame is
solid, and the stack's title shows "+N". The frame the clock lands on (or that a search, bookmark or `[`, `]` targets)
replaces it while it is the focus. This is a literal exception to "all frames". The alternative is to keep them all and
rely on the behind fade, which costs 107-144 more walls in the stream / bake lists and slab-like clutter from oblique
angles. The prototype keeps all of them.

### How the other features fit

- **Clock slider, `.` / `,`, PageUp / PageDown:** they move the focus. The focus wall is solid at its own X, the fade
  re-targets with easing, and the gate stays the marker.
- **Now (playing):**
  - The live wall rides on the clock plane and stands in for frames k and k+1 at their own X (the prototype hides
    them).
  - Every other frame is solid at its X, and the near fade applies.
  - Measured on path E: 109 fps vs 125, draws 96 -> 390, bakes 28 -> 190.
  - Optionally, keep Now with neighbours only (today's look) for playback, since the morph is the point there.
- **Search, bookmarks, file panel, `[` / `]`, tour:** they all set the clock to their wall already (ui.js:191, 226,
  234, 251, 261; attract.js:91, 130). So their target is the focus and is never faded, with no new code.
  - Flights pass through lane walls; the near fade turns that into a fade instead of the near plane cutting through
    walls.
  - Flights already arc up to 60000 units.
- **Titles:**
  - Every solid wall is a tier-1 candidate. That costs about 0.4-0.6 ms of CPU (the 1.1-1.5 ms vs 0.8 ms above),
    mostly the O(candidates x occluders) `occluded()` test.
  - Faded walls drop to tier 0, fade with their alpha, and stop occluding.
  - The heading leak gets worse with every wall solid (`leak.md`: 9-13 of 10-16 titles leak in Gallery views vs 2-10
    in Clock). The title occlusion fix from request 2 is a **prerequisite**.
- **File cards:** they stay on the 12 nearest solid walls; faded walls lose them.
- **Gallery and ghosts:**
  - Gallery merges into Clock: they differ only by the focus. N cycles Clock and Now; `pres=gallery` in old hashes
    maps to Clock.
  - The ghost mode (the GH window) goes; the ghost render path stays, for faded walls.
  - `solidRelease` is no longer needed for visibility; the release marks stay.
  - Bench paths A, B and C, and the `hero` view, switch from `'gallery'` to `'clock'`.
  - README: rewrite the presentation table and the Wall titles section.
- **Soft (llvmpipe):** keep today's Clock. 395 walls at llvmpipe frame rates are not affordable, and GH is already
  smaller there.

## The change (files)

- `viewer/src/main.js`:
  - `updateDisplay()`: all frames solid; `nearFade()` (in the prototype diff); alpha easing; the generalised behind
    fade; optionally stacks.
  - The LOD loop: stream / bake faded walls with a > 0.1.
  - Remove GH, the ghost loop and the gallery branch; update `cyclePres` and the `layoutTitles` tiers.
- `viewer/src/bench.js`: `'gallery'` -> `'clock'`.
- `viewer/src/ui.js`: the N button labels and the hash alias.
- `viewer/README.md`, `DESIGN.md`.
- Size: about 60-100 lines. Of that, the prototype's 90-line diff is about 40 lines of logic, most of it
  `nearFade()`.
- **Before shipping**, fix the streaming / bake stall on lane flights (path C: 111 -> 52-65 fps, up to 17 frames over
  100 ms; the stall is in `pre` and does not respond to the bake budget), and land the title-leak fix.

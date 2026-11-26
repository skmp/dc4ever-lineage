# frames2: denser frames, file last-change dates in the tour

Commits: f65fd62 (frames, layout, dates, viewer), 0756069 (agent outputs), c3bbabc (fix round 1), and the fix round 2
commit described at the end. The baseline for every before / after comparison is bed89b0, the last commit before
frames2. Tour details are in `tour-changes.md` and the verifier notes in `verify1-*.md` and `verify2-*.md`.

## A1. Sparse lanes: every commit that changes counted source is a frame

`tools/frames.py` gives a frame (kind `commit`) to every lane-local first-parent commit that changes counted source.
This applies to every lane except nullDC4Wii, reicast and flycast, the three with more than 250 source-changing
lane-local commits. The tag, fork, import and DreamSTer pin frames stay. As before, a frame whose counted source
equals the previous frame's is dropped, unless it is a marked frame. Counted source follows the same rules as before
(`tools/rules.py`: no vendored, generated or binary files).

dc4ever, the owner's example, now has 102 frames, one commit per wall: from 2004-04-09 (1 file, 22 lines) to
2005-09-15 (29 files, 25,494 lines).

The lane has 138 commits. The 36 that are not frames touch only files the rules do not count:
- .resx, .csproj, .ico and README files;
- in 5 commits (82cf419, 105f112, 6f2e399, 8ad75d2, fcfa0e8), only `DC/SH4.7091/sh4_managed_recomplier.cs`.

That file is UTF-16 (it starts with the byte-order mark ff fe), so git and the rules treat it as binary and do not count
it. The task's measurement of 107 source-changing commits counted these 5, which is why dc4ever has 102 frames and not
107. Counting the file would mean adding UTF-16 decoding to the counting rules for every lane. I left the rules as they
are; say if you want it counted.

Frames per lane, old -> new (virtual frames not counted):

| lane | old | new | lane | old | new |
|---|---:|---:|---|---:|---:|
| dc4ever | 13 | 102 | reicast | 84 | 140 |
| nullDC | 20 | 133 | flycast | 100 | 148 |
| nulldc-360 | 10 | 119 | nulldc3 | 14 | 105 |
| HarissaDC | 4 | 5 | minicast | 9 | 35 |
| nullDCe | 3 | 7 | polly2 | 11 | 183 |
| nullDCe-PSP | 6 | 13 | polly2-r8 | 1 | 10 |
| nullDC4Wii | 98 | 135 | devtools | 3 | 50 |
| NotDC-PS3 | 7 | 102 | dreamcast-tests | 1 | 103 |
| nullDC4WiiU | 4 | 57 | shrike4 | 2 | 10 |
| caique | 3 | 11 | wren7 | 2 | 4 |
| **total** | **395** | **1,472** | | | |

## A2. Dense lanes: monthly and marked frames, plus big commits

The rule is in `tools/frames.py` (`BIG_MIN, BIG_PCT = 1500, 0.03`).

- **Big commit:** its counted churn (lines added plus lines removed in counted files, from git numstat against the first
  parent) is at least `max(1500, 3 % of the lane's counted lines before the commit)`.
- **Generated and binary files are left out of the churn:** any file entry with 200 or more changed lines is checked with
  the frame rule's `is_generated` on the blob.
- **Frames added:** every big commit, and the commit just before it, so that the frame-to-frame step is the big commit
  alone. A commit where the churn accumulated since the previous candidate reaches the threshold also becomes a frame.

| lane | big commits | accumulated-churn frames | `big` frames | frames old -> new |
|---|---:|---:|---:|---|
| nullDC4Wii | 17 | 13 | 40 | 98 -> 135 |
| reicast | 24 | 18 | 58 | 84 -> 140 |
| flycast | 26 | 9 | 51 | 100 -> 148 |

Each of the three lanes gained tens of frames, as the task asked. verify2 found that every frame-to-frame step with
heavy churn is the big commit alone, plus commits with no counted churn. The largest multi-commit step left is
nullDC4Wii 1c8d8fd0f..32e5684f5: 16,358 lines over 3 commits, none of them over the threshold on its own.

## A3. Layout: the time axis stretches where frames are dense

`tools/viewer_prep.py` gives every frame a time: its date. When a lane has n frames on one day, the j-th sits at
day + j/n.

The time axis is one global piecewise-linear map, stored as knots [month, x]. Walking the times in order, x grows with
the base map: 4,000 units per month, with long empty stretches compressed as before. Wherever a lane's next wall would
come closer than MONTH/8 = 500 units to its previous wall, x is pushed out to keep that spacing. So the stretching is
local, and walls always stay in time order.

All of these read the same knots: the year ruler, the 4 gap markers, the 8 release ticks, the clock (monthOfX /
xOfDate), the timeline and the tour's camera stops. A month drawn more than 2x wide gets a month tick on the ruler;
there are 18 such months, the widest being 2026-07 at 22x.

**Extent of the walls: old 2,968 .. 931,081 (232.0 months of x), new 1,032 .. 1,376,584 (343.9 months), 1.48x.**
There are 592 knots, and none has zero width (fix round 2).

## A4. Downstream

All of these work with the new frames:
- provenance (`make -C tools/provenance run-frames`, about 40 s);
- the lane graph (fork frames);
- `tools/verify/check_frames.py`: 1,472 frames, 0 problems;
- the viewer and the tour.

Two viewer changes were needed:

- **Room for 2,047 frames.** The wall texture is 1024 x n, origin and keep are 11 bits each in the instances, and the
  palette is wider.
- **The keep-offset bug.** `core.decodeChunk` read the keep array 2 bytes off in frames with an odd line count. It
  rounded the keep offset up to 4 bytes, but `tools/provenance/frames.cpp` writes keep right after origin with no
  padding. Old frames had the bug too, so some trivial lines (keep 2047) were read as non-trivial, and the other way
  round. `tour-changes.md` describes the one tour item this changed.

## B. Tour dates are the file's last change

`tools/attract_prep.mjs` precomputes every date the caption shows and stores it in `data/attract.json`. The date is the
last change of the file that holds the line, segment or file at that frame:
`git log -1 --first-parent --format='%H %cs' <frame commit> -- <path>` in the lane's repo. That is the committer date,
the field the frames use. In dc4ever the author and committer dates are the same (the rebuilt history sets both to the
file mtime), so no other field is needed.

Which date goes where:
- "first seen in" uses `origin_file`, the file at the origin frame;
- each stop's "now:" uses `stop_files[k]`;
- segments and file items work the same way; a file item's "first:" uses `first_file`, its earliest stop in time.

Edge cases:
- **Date overrides.** A file last changed at a commit with a date override in frames.py shows the override's range,
  never the commit date: nullDCe 39c0550 reads "2008-2010 (dated 2009-10-16)" and reicast 1c16baeb0 reads "2012-2013
  (dated 2013-12-19)". This holds in any repo that contains the commit, including a 2024 nullDCe frame whose file still
  dates from 39c0550.
- **dc4ever** dates stay marked "(approx.)".
- **The virtual nullDC-pre2008 origin** reads 2005-2008.
- **Shared history.** In lanes forked with shared git history (flycast, nulldc3, nullDC4WiiU), a file last changed in
  the shared history shows that date.

Caption wording: "now: flycast, file last changed 2015-02-25", "first seen in nullDCe, file last changed 2008-2010
(dated 2009-10-16)".

The built tour has 2,218 stop dates:
- 1,315 differ from the frame date;
- 215 show an override range;
- 52 are dc4ever approximate dates.

verify1 checked 145 of them against git and verify2 another 60; all match.

Examples (old caption = the frame's date, new = the file's last change; the full list is in
`scratch/date_examples_all.txt`):

| item | old ("now:") | new (file last changed) |
|---|---|---|
| line `{//ToDo : Check This [26/4/05]` | nullDCe 2024-09-27 | 2008-2010 (dated 2009-10-16), dc/sh4/sh4_cpu.cpp @ 39c0550 |
| line `//there were at least 4 gdrom implementations ...` | nullDC 2023-07-10 | 2010-05-09, gdrom_if.h @ 1fe9c6d |
| segment "a hand-encoded Xenon dot product" | nulldc-360 2022-02-11 | 2011-11-25, emitter/3DMath.h @ d139e0f |
| line `//how bout a decoded switch list ? ...` | flycast 2018-10-20 | 2015-02-25, sh4_opcode_list.cpp @ e82d6a8 (history shared with reicast) |
| segment "dc4ever's 2004 block builder, in C#" | dc4ever 2005-09-15 | 2004-04-15 (approx.), cachedInt.cs |

## Tour

The tour keeps the same 142 picks (100 shared + 42 unique), with ids remapped by text. Every pick keeps its text, kind
and unique / shared status. One note changed: "Held in 278 snapshots" is now 568. Details are in `tour-changes.md`.

## Counts in the repo

viewer/index.html (title, description, og and twitter tags), README.md and viewer/README.md all say "1,472 frames in 20
lanes".

## A5. Performance (real GPU: Xvfb + Mesa d3d12, 2560x1440)

One alternating run per side of `fix2/ab.sh` (about 6 min per side): bed89b0 against fix round 2. Raw logs are in
`fix2/perf/`. The verify2 column is HEAD c3bbabc as verify2 measured it (`verify2/perf/`), before the fix-round-2
viewer changes.

**Bench paths** (vsync off). Columns: fps, then frame p50 / p95 / p99 in ms.

| path | bed89b0 | c3bbabc (verify2) | fix round 2 |
|---|---|---|---|
| A file street | 104; 3.0 / 22 / 41 | 83-127; 5.6 / 30 / 61 | 85; 6.0 / 30 / 56 |
| B orbit | 132; 2.7 / 21 / 22 | 116-164 | 123; 4.5 / 22.5 / 25 |
| C lane flights | 88; 5.0 / 25 / 46 | 64-70; 9.7 / 42 / 81 | 74; 8.1 / 34 / 50 |
| D close reading | 128 | 128-136 | 134 |
| E live playback | 113 | 101 | 106 |

**Dense stretch** (verify2's `densefly.js`: vsync-capped rAF interval, p95 / p99 in ms, frames in 15 s):

| | bed89b0 | c3bbabc (verify2) | fix round 2 |
|---|---|---|---|
| high fly | 18.3 / 24.6 | 19 / 37-42 | 19.5 / 39 |
| low fly over polly2 | 17.9 / 18.9 (893) | 36-37 / 72-80 (759-760) | **20.7 / 30.5 (882)** |
| overview | 17.8 / 18.2 | 19 / 19 | 18.7 / 20.2 |
| low fly at a fixed 5,000 units/s (`pf-s5000.js`) | 18.0 / 23.5 (892) | | 18.4 / 22.6 (882) |

**Load and memory:**

| | bed89b0 | fix round 2 |
|---|---|---|
| first frame / all text | 449 ms / 1.54 s | 520 ms / 1.94 s |
| JS heap after load (as read) | 62 MB | 199 MB |
| JS heap after load, after a forced GC (`heap2.js`) | 27 MB (14 walls loaded) | 64 MB (75 walls loaded) |
| heap max over the timeline sweep | 73 MB | 236 MB |
| GPU estimate at load | 188 MB | 231 MB |
| GPU estimate after the dense fly | 537 MB | 483 MB (c3bbabc: 739) |

What these numbers mean:

- **The dense flights are not like for like.** The densefly script crosses 2026-06 .. the end in 15 s. That stretch
  was 23k units long in bed89b0 and is 252k units long now (polly2 has 177 commits in four months). So the new run flies
  11x faster and passes 646 walls instead of 122. At the same camera speed (fixed 5,000 units/s), the fix-round-2
  viewer holds 60 fps just as bed89b0 does.
- **Where c3bbabc lost time at 17k units/s: impostor bakes.** In 15 s it ran about 1,000 bakes, 293 of them sharp (hi,
  6 MB each), and created 1.4 GB of new textures. Draw calls were around 700 a frame. Uploads into the instance texture
  could each stall for up to 75 ms.
- **The JS heap read "after load" is mostly garbage V8 has not collected yet.** After a forced GC the live heap is
  64 MB against 27 MB. The difference is the 75 walls loaded at the start view against 14 (instances kept for picking,
  32 MB). Nothing leaks: the GPU estimate after the dense fly is now lower than bed89b0's.
- **CPU per frame is about 3 ms against 1.3 ms in the bench paths.** Every per-frame pass over the walls (display,
  near fade, LOD, titles) now covers 1,472 walls instead of 395. The worst parts are titles (0.9 ms) and LOD (0.7 ms),
  measured with `fix2/js/sections.js`. That costs fps in the vsync-off bench (C: 88 -> 74) but stays well inside a
  16.7 ms frame. Close reading (D) is unchanged.

## Fix round 2

The two verify2 reports asked for this report, for the A5 regression to be addressed, and for some minor items.
Changes, in the order of the issues:

1. **REPORT.md (major):** this file. It covers the A2 rule and counts, the A3 extent and the A5 numbers.
   `tour-changes.md`'s links to it now resolve.
2. **A5 performance (major):** level of detail for distant walls, without dropping frames (`viewer/src/main.js`).
   - **Density LOD** (`LODP.dense`, 12 px). Take a far wall: one below `LODP.lo` px per line, or, while the camera passes
     the lane's walls too fast, one below the line threshold. If its outline on screen lies within 12 px of a nearer
     wall of its lane (every corner moved less than that), it is not streamed or baked. It shows that wall's impostor,
     or its own if it already has one.
     - Never thinned: frames at the clock, sharp-impostor walls, the morph target and release walls.
     - At most 450-560 walls a frame take a nearer wall's impostor (`V.stats.borrowed`).
     - Screenshots with the LOD on and off differ in 32 and 141 pixels of 2,073,600 (`fix2/shots/low-dense*`,
       `oblique-dense*`).
   - **The fast-flight rule now counts walls passed per second.** `LODP.fast` (no sharp bakes and no far -> lo
     upgrades above 25,000 units/s) is scaled by each wall's spacing in its lane (`gapK`: spacing / month, at most 1).
     So with walls 500 apart the limit is 3,125 units/s. Sharp bakes in the 17k units/s low fly dropped from 293 to 6-13.
   - **Plates are drawn in runs.** Each run of walls contiguous in the plate buffer is one draw. Walls in between whose
     plate the shader drops, or the GPU clips, may join a run. Draw calls fell from ~700 to ~200 a frame.
   - **Wall uploads send whole rows straight from the wall's array,** and only the last partial row through a small
     padded buffer. There is no longer a rows x 32 KB zero-filled copy per wall. Upload time in the fly halved
     (650 -> 310 ms over 15 s).
   - **Instrumentation:** `V.stats.up` / `upT` (upload time) and finer `V.prof` sections (`tick`, `disp`, `near`).
     `tools/verify/run.mjs eval` gained `--trace` (main-thread and GPU-process events over 20 ms), and `CHROME_FLAGS`
     passes extra Chromium flags (`--js-flags=--expose-gc` for `heap2.js`).
   - **Result:** the dense low fly went from 36-37 / 72-80 ms (p95 / p99) to 20.7 / 30.5, and from 760 to 882 frames
     in 15 s. Lane flights went from 64-70 to 74 fps. The GPU estimate after the dense fly went from 739 to 483 MB.
     Bake count is what is left: every wall the camera passes closely still needs one far impostor as it comes near
     (about 450 in that flight).
3. **dc4ever UTF-16 commits (minor):** explained under A1. The rules are unchanged.
4. **Stale attract.json size in the frames.json manifest (minor):** `attract_prep.mjs` now runs
   `tools/frames_manifest.py --sizes` after writing attract.json. Sizes are refreshed (406,340 bytes).
5. **`tools/provenance/frames` left modified (minor):** the build output was tracked even though `.gitignore` lists it.
   It is now untracked (`git rm --cached`), and `make -C tools/provenance` builds it.
6. **Wall signs (minor):** a wall's sign shows the day (YYYY-MM-DD) when its lane has more than one frame in that month
   (for example "dreamcast-tests 2026-11-20 a932980"), and the month otherwise. See
   `fix2/shots/dense-dreamcast-tests-gpu-1920x1080.png`.
7. **viewer/README.md tour paragraph (minor):** it now says the caption dates are the file's last change, with the
   override, approximate and pre-2008 cases.
8. **Zero-width time steps (minor):** `viewer_prep.py` rounds knots to whole units before it places the walls. A knot
   that would round onto the previous one goes one unit further. There are now 0 zero-width steps (2 before), and
   29 walls moved by 1 unit.

Rebuilt: `data/layout.json.gz` and `data/frames.json` (sizes), then attract.json (`attract_prep.mjs`, 31 s, unchanged:
the line ids and stops are the same) and `dist/` (`build_static.mjs`).

Checks after the rebuild:
- `check_frames.py`: 1,472 frames, 0 problems.
- verify2's `layout_check.py` and in-page `layout.js`: 0 errors. Minimum gap 500 in every lane. Clock and day checks:
  0 off.
- dist/ matches viewer/ + data/ (the DEV block is stripped from bench.js as intended).

The video (agents/video) was not re-rendered.

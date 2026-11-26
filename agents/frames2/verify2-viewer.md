# frames2 verification 2: viewer, layout, tour, performance

Verifier notes for HEAD c3bbabc (fix round), on top of f65fd62 / 0756069. Baseline for comparisons: bed89b0 (the last
commit before frames2), served from a detached worktree on a separate port. Everything was run on the real GPU
(tools/verify/run.mjs `--gpu`: Xvfb + Mesa d3d12). I changed no code. Scripts: `verify2/js/`, `verify2/*.py`,
`verify2/ab.sh`. Logs: `verify2/*.log`, `verify2/perf/`. Shots: `verify2/out/shots/`.

## Verdict: not accepted

The data, the layout, the viewer and the tour all work, and requirements A1 to A4 and B are met. Two things still do
not meet the task:

1. **`agents/frames2/REPORT.md` still does not exist.** Verifier 1 already raised this, and the fix round did not add
   it. The task asks for these to be reported: the big-commit rule and the counts per dense lane (A2), the old vs new
   total X extent (A3), and the before / after performance numbers (A5). Some of this is in commit messages and in
   viewer/README.md, but the perf numbers exist only as raw logs. `tour-changes.md` still says "see REPORT.md" for
   the keep-offset decoder bug, which points to a missing file.
2. **A5: there is a clear performance regression, it is not reported, and no level-of-detail was added.** The viewer
   is still usable. The worst case is the low fly over the densest stretch (2026-06 to the end, over polly2):
   frame-interval p95 goes from 18 ms to 36 ms and p99 from 18.5 ms to 72-80 ms, which is about 51 fps instead of
   60. JS heap after load is 2.5 to 3.5 times higher. See the table below. Whether this counts as "regresses badly"
   is for the owner to decide, but the task requires the numbers in the report, and they are not there.

## Layout (independent check from data/layout.json.gz + data/frames.json: `verify2/layout_check.py`)

- 1,472 walls in 20 lanes. In every lane the walls are strictly increasing in x and in date order. The minimum gap is
  500 = MONTH/8 in every lane (wren7: 1,509). Nothing overlaps or coincides inside a lane.
- The time map is one global piecewise-linear map with 592 knots and month strictly increasing. Every wall sits
  inside its own day, [x(d), x(d + 1/31 month)], so 0 of 1,472 walls are off. 432 knot segments are stretched.
  **Trivial:** there are 2 zero-width knot segments (x repeats after rounding). core.monthOfX guards the division,
  so nothing visible comes of it.
- Extent: old 2,968 .. 931,081 (232.0 months of x); new 1,032 .. 1,376,584 (343.9 months), 1.48x.
- In-page check (`verify2/js/layout.js`, viewer's own V.tm / V.LN / V.W):
  - 0 errors.
  - Clock: monthOfX(wall.x) gives the frame's month for all 1,472 walls. The verify1 flycast 2021-12 exception is
    fixed by the epsilon.
  - Ruler: 18 years and 18 month ticks at xOfDate within 2 units, no wall on the wrong side of a year line, and no
    wall inside any of the 4 gaps.
  - 8 release ticks match their dates.
  - No title is empty or contains undefined / NaN.
  - 149 frames have the `big` kind.
  - Search ("kinda wrong .. but meh") returns 2 hits in 23 ms.
- dc4ever: 102 walls from 2004-04-09 (1 file, 22 lines), growing 2 / 3 / 4 / 5 files commit by commit, to 2005-09-15
  (29 files, 25,494 lines). The shot `dense-dc4ever` shows the lane growing wall by wall.
- Dense bursts: dreamcast-tests has 103 walls over 2026-11-17 .. 20, and nullDC4WiiU has 57 walls in 2026-11. The
  `dense-*` shots show them in order and evenly spaced, with nothing coinciding. `far`, `fork` (rewritten to find
  frames by commit) and `fpgadc` render correctly.
  - **Minor UX:** the sign on each wall shows only the month (e.g. "dreamcast-tests 2026-11 a932980"), so in a
    burst 103 signs read the same month and differ only by hash. The hover title and the HUD do show the day.

## Tour (`verify2/js/tour.js`, `verify2/date_sample.py`, `verify2/js/cap-*.js`, `verify2/js/livetour.js`)

- 164 items, 142 of them picked. Every one of the 656 route stops resolves to a wall, a slot and a loaded file. The
  file path equals `stop_files[k].path`, and the line id at that row is the item's id (for segments, one of its
  ids). Every caption contains "now: <lane>, file last changed ..." and "first seen in <lane>, file last changed ..."
  (or 2005-2008). 0 errors (run took 6 min).
- Compared with bed89b0's attract.json:
  - The same 142 picks by kind + text.
  - 42 unique before and after, and no item changed unique status.
  - One note changed (Maple DMA "Held in 278 -> 568 snapshots"); 568 equals the item's frame count. No other note
    states a frame count.
- No item lacks origin_file, first_file or a stop_files entry.
- Dates against git: 60 random stops (seed 7) checked with `git log -1 --first-parent --format='%H %cs' <frame
  commit> -- <path>`. All 60 match, including override ranges. 30 of the 60 differ from the frame's date.
- Caption shots (`cap-*`):
  - Unique dc4ever line: "file last changed 2004-11-03 (approx.)".
  - reicast stop: "now: reicast, file last changed 2012-2013 (dated 2013-12-19)".
  - nullDCe stop: "2008-2010 (dated 2009-10-16)".
  - flycast stop in shared history: "file last changed 2015-02-25".
  - File item: "first: file last changed 2010-05-09".
- Live tour (60 s, `start('button')`): 4 captions, 0 page errors. 60 s covers only one item's stops at the tour's
  pace.
- Inspector: after showItem, the item's line is always 54 px above the screen centre, and the centre pick is 2 lines
  below it. This holds for 25 of 25 items on HEAD and 25 of 25 on bed89b0, so it is not a regression. The tooltip
  renders (shot `pick-8743`): lane, date, path, line, and "trivial" for keep 2047.
- No console errors in any run.

## Performance (GPU, 2560x1440, bed89b0 vs HEAD alternating, 2 rounds, about 11 min: `verify2/ab.sh`)

Bench paths (vsync off): fps, frame p50 / p95 / p99 ms, cpu p50 ms.

| path | bed89b0 r1 / r2 | HEAD r1 / r2 |
|---|---|---|
| A file street | 103 / 104 fps; 3.1 / 22 / 41; cpu 1.1 | 83 / 127 fps; 5.6 / 30 / 61 and 3.0 / 22 / 39; cpu 2.4 / 1.4 |
| B orbit | 127 / 130; 3.0 / 21 / 22; cpu 1.5 | 116 / 164; 4.9 / 23 / 25 and 2.6 / 20 / 22; cpu 3.4 / 1.5 |
| C lane flights | 84 / 87; 5.5 / 26 / 44; cpu 1.4 | 64 / 70; 9.7 / 42 / 81 and 8.9 / 39 / 60; cpu 2.6 |
| D close reading | 134 / 129 | 128 / 136 |
| E live playback | 112 / 117; cpu 1.0 | 101 / 101; cpu 1.8 |

Dense stretch (vsync-capped rAF interval, ms):

| | bed89b0 | HEAD |
|---|---|---|
| high fly p95 / p99 | 18 / 21, 18 / 20 | 19 / 37, 19 / 42 |
| low fly over polly2 p95 / p99 (frames in 15 s) | 18 / 19 (894), 18 / 19 (898) | 37 / 72 (759), 36 / 80 (760) |
| overview p95 | 18, 18 | 19, 19 |

Load and memory:

| | bed89b0 | HEAD |
|---|---|---|
| first frame | 459 / 527 ms | 548 / 524 ms |
| allText | 1.6 / 1.9 s | 1.9 / 1.9 s |
| JS heap after load | 108 / 70 MB | 263 / 272 MB |
| heap max during the timeline sweep | 127 / 93 MB | 388 / 297 MB |
| heap max in the dense fly | 174-186 MB | 315-410 MB |
| GPU estimate at load | 188 MB | 236 MB |
| GPU estimate after the dense fly | 537 MB | 739 MB |

Summary: C (lane flights) loses about 20 % of its fps, and its p99 roughly doubles. The dense low fly drops from a
steady 60 fps to about 51 fps, with 70-80 ms hitches. D (close reading) and the overview are unchanged. A, B and E
are within noise to 20 % slower. Neither the sweep nor any run hung.

## Counts

- viewer/index.html (title, description, og and twitter), viewer/README.md and the root README all say "1,472 frames
  in 20 lanes". data has 1,472 non-virtual frames in 20 lanes. Nothing else in viewer/ states a frame count.
- viewer/README.md describes the new frame rule and the stretched axis.
- **Minor:** viewer/README.md's tour paragraph does not mention the file-last-change dates. index.html's help text
  does.
- dist/ is identical to viewer/ + data/ (diff -rq is empty).
- `tools/verify/check_frames.py`: 1,472 frames, 0 problems, max keep 1,237.

## Other

- The working tree has an uncommitted change to `tools/provenance/frames`, the built binary (231,664 -> 232,176
  bytes). It is probably a rebuild, but it is uncommitted.

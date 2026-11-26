# frames2 verification 3: viewer, layout, tour, performance

Verifier notes for HEAD 6be2ad1 (fix round 2). The baseline is bed89b0 (the last commit before frames2). I served it from
a temporary detached worktree on port 8771 and removed the worktree afterwards. HEAD was served by the running preview
server on port 8743, which serves viewer/ and data/ from the working tree; that tree is clean for viewer/ and data/.
Every run used the real GPU (`tools/verify/run.mjs --gpu`: Xvfb + Mesa d3d12). I changed no code.

Files:
- scripts: `verify3/layout3.py`, `verify3/js/*.js`, `verify3/ab3.sh`
- logs: `verify3/*.log`, `verify3/*.txt`, `verify3/perf/`
- shots: `verify3/out/shots/`

## Verdict: accepted

Requirements A1 to A5 and B are met, and nothing I tested is broken. The open points are all minor (see the end).

## Layout (`layout3.py`, written independently: it mirrors core.timeMaps, not viewer_prep)

- **Walls:** 1,472 in 20 lanes, which equals the number of non-virtual frames in frames.json.
- **Knots:** 592. Month and x are both strictly increasing, so there are no zero-width steps.
- **Order and spacing in every lane:**
  - frame k order, date order and x order agree;
  - the minimum gap is 500 = MONTH/8 in every lane (wren7: 1,509);
  - 0 overlaps or coincidences.
- **Time map:** all 1,472 walls lie inside their own day [x(d), x(d+1/31)]. dateOfMonth(monthOfX(x)) equals the frame's
  month for every wall.
- **Ruler:**
  - Year lines sit at xOfDate(Y-01-01) to within 2 units. No wall lies left of its own year line or right of the next
    one.
  - The 18 stretched-month ticks sit at their month.
  - None of the 4 gap markers has a frame dated inside its gap, and each marker sits mid-gap.
- **Release pins:** every pin frame is dated on or before its release and has the pinned commit.
- **Extent:** 1,032 .. 1,376,584, which is 343.9 months of x. The old extent is 232.0, so this is 1.48x, as the report
  says.
- **In-page check (`viewer3.js`):** for all 1,472 walls:
  - `V.dateOfX(w.x)` gives the frame's month;
  - `V.laneFrameAt(lane, w.x)` gives the wall itself, and at w.x - 1 it gives the previous wall, so the clock picks each
    wall in turn, dense bursts included;
  - every title is non-empty and contains the date.
- **dc4ever:** 102 frames. 36 of the 138 lane commits have no frame. I checked them against git:
  - 31 touch only non-source files (.resx, .csproj, .ico, .user, .suo, .txt, .md, .sln, .vsmdi);
  - 5 touch only the UTF-16 file `DC/SH4.7091/sh4_managed_recomplier.cs` (fcfa0e8, 8ad75d2, 6f2e399, 105f112,
    82cf419), which the counting rules treat as binary.

  This matches REPORT.md. The shot `scene-dc4ever` shows the lane growing wall by wall.
- **Dense bursts:** the shot `scene-dense` shows dreamcast-tests with 103 walls over 2026-11-17 .. 20, evenly spaced, in
  order, with day-level signs. The shot `scene-overview` shows the whole scene; the ruler and lanes are correct and all
  1,472 walls are in the display list.

## Tour (`tour3.js`, `dates3.txt`, `cap-*.js`, `livetour3.js`)

- **Items:** 164, of which 142 are picked (42 of them unique).
  - Against bed89b0's attract.json, the picks are the same 142 by kind + text.
  - No pick changed its unique status.
  - One note changed: "Held in 278 -> 568 snapshots", and 568 is the item's frame count. No other note states a count.
  - The 22 unpicked computed items differ, as expected.
- **Stops:**
  - All 2,218 stops have a wall, a slot and a stop_files entry with a path and a label.
  - The tour plays 656 route stops. For every one, the wall loads, the file path at the slot equals stop_files.path,
    and the line id at the row equals the item id (for segments, one of its ids).
  - The caption's "now:" line is exactly `now: <lane>[ tag], file last changed <label>`, and "first seen in <lane>, file
    last changed <label>" (or 2005-2008) is exactly right too.
  - 0 errors in 2,218 / 656 stops (run time 4 s).
- **Dates against git:** `git log -1 --first-parent --format='%H %cs %as' <frame commit> -- <path>`. 0 mismatches in:
  - 100 random stops (seed 2026), 60 of them different from the frame date and 8 of them on an override commit;
  - all 103 origin_file dates;
  - all 6 first_file dates.
- **Edge cases:**
  - Override commits always show their range: 149 labels "2008-2010 (dated 2009-10-16)" and 93 labels "2012-2013
    (dated 2013-12-19)". No date from 39c0550 or 1c16baeb0 appears without its range.
  - In dc4ever, author date = committer date and every label says "(approx.)".
  - The virtual origin reads "2005-2008" (55 items).
- **Caption shots (`cap-*`, 1920x1080):**
  - unique dc4ever line ("2004-11-03 (approx.)");
  - reicast override;
  - nullDCe override (segment);
  - a flycast stop whose file was last changed in the history shared with reicast ("2013-12-28", frame 2018-10-20);
  - a file item ("first: file last changed 2010-05-09");
  - a polly2 dense-lane unique line.
- **Live tour:** 150 s from `start('button')`, 10 caption changes over 3 items, all in the new wording, 0 page errors.
  The full tour is about 40 s per item, so playing all 142 live would take about 1.5 h. All stops are covered by the
  programmatic check above instead.
- **Inspector:** after showItem at a middle stop, the item's line is found by `V.pick` near the screen centre for 30 of
  30 line items. The hover tooltip renders "first seen in ..., file last changed ...".
- **Search through the UI:** "kinda wrong .. but meh" gives "2 distinct lines in 233 ms". Clicking the first result flies
  the camera (697k units) to nullDCe 2024-09-27. A path search for "gdrom" gives 40 files at the clock.
- No console or page errors in any run.

## Counts

- viewer/index.html (title, description, og and twitter tags), README.md and viewer/README.md all say "1,472 frames in 20
  lanes". This equals the data: 1,472 non-virtual frames in 20 lanes. No other frame count is stated in viewer/.
- `tools/verify/check_frames.py`: 1,472 frames, 0 problems (54 s).
- dist/ equals viewer/ + data/, except bench.js (its DEV block is stripped, as intended) and README.md.
- The frames2 commits add no home paths and no IPs.

## Performance (GPU, 2560x1440, bed89b0 vs HEAD alternating, 2 rounds, about 12 min: `verify3/ab3.sh`)

**Bench paths** (vsync off). Each cell is fps, then frame p50 / p95 / p99 in ms.

| path | bed89b0 r1 / r2 | HEAD r1 / r2 |
|---|---|---|
| A file street | 103 / 105; 3.1 / 22 / 40 | 86 / 87; 5.9 / 27 / 47 |
| B orbit | 131 / 130; 2.9 / 21 / 22 | 126 / 124; 4.6 / 23 / 24 |
| C lane flights | 87 / 84; 5.2 / 26-30 / 45-48 | 69 / 69; 9.0 / 38 / 55-60 |
| D close reading | 132 / 133 | 133 / 136 |
| E live playback | 113 / 113 | 104 / 109 |

**Flights at a fixed camera speed** (`fly3.js`), so the comparison is like for like. Values are the vsync-capped rAF
interval in ms, p95 / p99 (frames over 33 ms). Each cell gives round 1, then round 2.

| flight | bed89b0 | HEAD |
|---|---|---|
| low over polly2, 5,000 u/s, 15 s | 17.9 / 19.0 (3), 17.9 / 18.7 (2) | 18.4 / 35.3 (9), 18.5 / 25.5 (6) |
| high over fpgadc, 5,000 u/s | 17.9 / 20.4 (7), 18.1 / 22.8 (6) | 18.2 / 19.2 (5), 18.2 / 21.8 (5) |
| low over reicast 2018+, 5,000 u/s | 18.4 / 23.3 (6), 18.5 / 24.1 (6) | 21.3 / 30.7 (6), 21.6 / 27.4 (5) |
| low along dc4ever, 3,000 u/s | 18.0 / 18.8 (1), 17.9 / 18.8 (2) | 19.6 / 25.4 (3), 18.8 / 20.7 (2) |
| overview, 8 s | 18.0 / 18.4, 17.9 / 18.5 | 19.5 / 20.4, 18.7 / 19.9 |
| polly2 low, 2026-06 .. end in 15 s (11x faster on the new axis) | 17.9 / 18.7, 17.9 / 18.8 | 24.1 / 38.5 (14), 21.1 / 31.9 (6) |

p50 is 16.6-16.8 ms in every flight, on both builds.

**Load and memory:**

| | bed89b0 | HEAD |
|---|---|---|
| first frame | 421 / 478 ms | 506 / 563 ms |
| all text loaded | 1.57 / 1.58 s | 1.89 / 1.98 s |
| JS heap after the flights, after gc() | 92 / 85 MB | 186 / 174 MB |
| JS heap max during the flights | 251 MB | 239 MB |
| GPU estimate at load | 188 MB | 231 MB |
| GPU estimate after the flights | 660 / 678 MB | 622 / 638 MB |

What the numbers mean:
- The regression is moderate and the viewer stays usable. The worst case is the vsync-off lane-flight bench (C), which
  goes from 85 to 69 fps.
- At an equal camera speed, every flight holds 60 fps at p50, and p95 is within 3.5 ms of bed89b0. p99 is up to about
  35 ms in the polly2 low fly, a few hitches in 15 s.
- The GPU memory estimate is lower than bed89b0's, and the live JS heap is about 2x.
- My dense-fly p99 numbers are somewhat worse than REPORT.md's 22.6 ms for the 5,000 u/s low fly: 25.5 and 35.3 ms
  here. The p95 numbers agree.

## Minor points (none blocking)

1. **Hover titles repeat.** 64 walls have the same hover title (lane | date | files, lines) as another wall of their
   lane, because the commits fall on the same day with the same file and line counts (e.g. nulldc3 2025-01-23, 4
   walls). The title has no commit hash. The sign shows the hash, so the walls can still be told apart.
2. **The timeline date shows only the month.** The timeline HUD (`#tdate`) reads "2026-11 (every frame; ...)" in the
   dreamcast-tests burst of 103 walls. The day is visible on the wall signs, the lower-left HUD and the colour legend.
3. **dc4ever's UTF-16 commits.** The owner said "every commit should get a frame", and 5 dc4ever commits that change the
   UTF-16 C# file have none. The rules do not count that file, so these frames would look identical to their
   neighbours anyway. REPORT.md raises this and leaves it to the owner.
4. **Dense-fly p99** is a bit higher than REPORT.md states (see above).

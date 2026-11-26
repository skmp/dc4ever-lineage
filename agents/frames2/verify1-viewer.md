# frames2 verification 1: viewer, layout, tour, performance

Verifier notes for commits f65fd62 (frames + dates + viewer) and 0756069 (agent outputs). Lens: viewer, layout, tour,
performance. I checked against data/, git and a GPU Chromium (tools/verify/run.mjs, `--gpu`: Xvfb + Mesa d3d12). I fixed
nothing in the code. Scripts are in `verify1/js/` and `verify1/bigsteps.py`, A/B runs in `verify1/perf/`, shots in
`verify1/out/shots/`.

## Verdict: not accepted yet. Everything works; the missing parts are reporting and docs

Requirements A and B work in the data and in the viewer. Three things are missing or wrong:

1. **`agents/frames2/REPORT.md` does not exist.** The task asks for these to be reported: the big-commit rule and the
   counts per dense lane (A2), the old vs new X extent (A3), and the before / after performance numbers (A5).
   `tour-changes.md` links to "REPORT.md" for the keep-offset bug. Parts of this are in the commit message. The perf
   numbers exist only as raw logs.
2. **`viewer/README.md` is out of date.** It still says "395 frames in 20 lanes" and "A frame is the last commit of a
   month ...", and "X is time (4000 units per month)" is no longer true now that the axis stretches. The task asks for
   every place in the viewer that states the frame count to be updated. index.html and the root README are correct.
3. **Performance got noticeably worse and no level-of-detail was added** (numbers below). The viewer is still usable.
   The agent's own perf-before / perf-after logs show a smaller drop than my alternating A/B run does.

## Layout (data/layout.json.gz and the viewer's V.W / V.LN / V.tm)

- 1,475 walls, 20 lanes, NF = 1,476 (one virtual frame). Per lane, walls are strictly increasing in x and in date
  order. The minimum gap between walls in a lane is 500 = MONTH/8, as required. `V.LN[].xs` matches the walls.
  There are no overlaps or coincident walls.
- Extent: old 2,968 .. 931,081 (232.0 months of x); new 1,032 .. 1,378,165 (344.3 months), 1.48x. There are 593 knots
  and 18 stretched months; the largest is 2026-07 at 22x.
- Year ruler: all 18 years sit at xOfDate(Y-01-01) within 2 units, and every wall is on the correct side of every year
  line. All 18 month ticks match xOfDate. No wall falls inside any of the 4 gaps. All 8 release ticks match their dates.
- Clock: for 1,474 of 1,475 walls, monthOfX(wall.x) gives the frame's month, and every wall is within 1 day of its
  date. **Minor:** the exception is flycast 2021-12-01, which reads 2021-11 (the wall x is rounded to 1 unit, just
  left of the month knot). The tour and the jumps call setX(w.x + 1), so the HUD date is still right there.
- Titles: no title is empty or contains undefined / NaN. Kinds `commit` and `big` are left out of the title, as
  intended (examples: "dreamcast-tests | 2026-11-18 | 181 files, 28,820 lines").
- dc4ever: 102 walls from 2004-04-09 (1 file, 22 lines) to 2005-09-15. The shot `dense-dc4ever` shows the lane growing
  one commit at a time. Of the 138 dc4ever commits, the 36 that are not frames touch only non-counted files:
  .resx / .csproj / .ico / README, and sh4_managed_recomplier.cs, which git stores as binary (UTF-16), so it is not
  counted. (The task's figure of "107 counted" probably included those 5 binary commits.) This is consistent with the
  counting rules.
- Dense bursts (`dense-polly2`, `dense-nullDC4WiiU`, `densefly` shots) are readable: walls in order, month ticks on the
  floor, nothing coincides.
- A2 big steps: `bigsteps.py flycast` lists the 4 flycast steps that span several commits and exceed 20k churn.
  - 3 of them are a single big commit preceded by commits with 0 counted churn. The "commit before" frame was dropped
    because its source is identical, so the step is the big commit alone.
  - The 4th, 2022-01, shows 21.6k net diff, but its 20 commits add up to only 3.6k. This is a diff artefact on the
    generated libretro_core_options_intl.h, so no large change is hidden.
  - Dense lanes gained: nullDC4Wii 98 -> 134, reicast 84 -> 141, flycast 100 -> 151 (152 `big` frames in total).
- `tools/verify/check_frames.py`: 1,475 frames, 0 problems; max keep 1,240, which is below the new 11-bit 2,047 limit.
- Bit-field widening (origin and keep 11 bits, flags moved to w1): the shader, core.buildWall / buildMorph,
  main.js pick and the ui tooltip are consistent. The palette and poss textures are PALW = 2,048 wide, and the wall
  texture is 1024 x 2.

## Tour (data/attract.json)

- 164 items, 142 of them picked (100 shared + 42 unique, the same split as before). Comparing the picked items with
  the previous commit's attract.json by kind + text: the same 142, no change in unique status. One note changed
  (Maple DMA "Held in 278 -> 571 snapshots"); 571 equals the item's frame count.
- All 656 route stops of all 164 items, run in the page: each resolves to a wall, a slot and a loaded file. The
  file's path equals `stop_files[k].path`. For lines the instance id at that row equals the item id; for segments it
  is one of the segment's ids. Every caption contains "now: <lane>, file last changed ..." and "first seen in <lane>,
  file last changed ..." (or 2005-2008). Override stops show the range. 0 errors.
- Dates checked against git independently: 150 random (frame, file) pairs, using `git log -1 --first-parent
  <frame> -- <path>` and `cat-file -e`. Commit and %cs date match in every case. The 11 override cases (39c0550,
  1c16baeb0) show "2008-2010 (dated 2009-10-16)" and "2012-2013 (dated 2013-12-19)". 78 of the 150 differ from the
  frame date, so the change has a visible effect.
- 258 sampled stops: the item's text appears in `git show <frame>:<path>`.
- The dc4ever author and committer dates are identical (0 commits differ), so %cs is the file mtime. The approx
  label is kept.
- Live tour (`start('button')`, 70 s): 5 distinct captions, no page errors (shot `livetour`).
- Inspector: picking at the screen centre after showItem lands 2 lines below the tour line (209 vs 207). The parent
  build does the same, so this is not a regression. Search: "kinda wrong .. but meh" returns 2 hits in 24 ms.
- No console errors or exceptions in any run.

## Performance (2560x1440, GPU, parent bed89b0 on a separate port vs HEAD; alternating, 2 rounds)

Bench paths (vsync off; fps, frame p50 / p95 ms, cpu p50 ms):

| path | parent r1 / r2 | HEAD r1 / r2 |
|---|---|---|
| A file street | 106 / 159 fps; 2.9 / 1.7, p95 22 / 20; cpu 1.1 / 0.6 | 81 / 94 fps; 5.5 / 4.6, p95 30 / 26; cpu 2.6 / 1.9 |
| B orbit | 132 / 176; 2.8 / 1.7 | 117 / 148; 4.7 / 3.6; cpu 3.2 / 2.2 |
| C lane flights | 87 / 123; 5.0 / 2.8, p95 26 / 21 | 66 / 65; 9.6 / 9.5, p95 40 / 42 |
| D close reading | 137 / 181 | 130 / 130 |
| E live playback | 115 / 146 | 106 / 106 |

Densest stretch (2026-06 .. end, vsync-capped rAF interval):

- High fly: p95 18.1 / 17.9 -> 19.0 / 19.9; p99 25 / 19 -> 39 / 40.
- Low fly over polly2: p95 17.8 / 17.9 -> 18.9 / 37.1; p99 18.6 -> 40 / 70.
- Overview: unchanged, about 18 ms p95.

Load and memory:

- First frame: 426 / 542 -> 528 / 549 / 548 / 561 ms.
- allText: 1.3-1.6 -> 2.0 s.
- JS heap after load: 68-90 -> 262-270 MB (about 3.5x); max during the sweep 89-93 -> 287-395 MB.
- GPU estimate: 188 -> 236 MB at load; 540 -> 740 MB in the dense fly.

Per-frame CPU time roughly doubles, and C (lane flights) roughly halves its fps. p50 stays under 10 ms. The dense
low fly has more hitches: p99 40-70 ms against 19 ms.

**Minor:** one of the five HEAD load / sweep runs (mem-head-1, straight after a bench run) hung until the 600 s eval
timeout. The page stopped producing frames during the timeline sweep. It did not happen again in 4 more runs, and
none of the 4 parent runs hung.

## Smaller notes

- The tour still plays all 164 items: the 142 picks, 19 computed lines, 3 curated lines that are not picked, and
  6 files. This is unchanged from before.
- `agents/frames2/verify1-data.md` (another verifier) is untracked, as is this verify1/ folder.

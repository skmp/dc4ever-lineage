# frames2 verify3: data and dates

Verifier: an independent check of HEAD 6be2ad1 against bed89b0. The lens is data and dates. I did not change any code.
Scripts and output are in `verify3/`:
- `sparse_check.py`
- `dense_check.py`
- `dates_check.py` (+ `dates_check.txt`)
- `dates_all.py`

All of them recompute from `repos/` and `tools/rules.py` / the `frames.py` config. None of them uses the selection or
date code under test.

## Frames

**Sparse lanes** (`sparse_check.py`, 23 s). For each lane-local first-parent commit, the script computes its counted set:
(path, blob) after `lang_of`, `is_vendored`, binary and `is_generated`. A commit is source-changing when its set
differs from the set of its chain predecessor.

| lane | lane-local | source-changing | frames | missing | extra (marked) |
|---|---:|---:|---:|---:|---|
| dc4ever | 138 | 102 | 102 | 0 | - |
| nullDC | 148 | 133 | 133 | 0 | - |
| nulldc-360 | 122 | 119 | 119 | 0 | - |
| HarissaDC | 7 | 4 | 5 | 0 | 1 tag |
| nullDCe | 8 | 7 | 7 | 0 | - |
| nullDCe-PSP | 23 | 13 | 13 | 0 | - |
| NotDC-PS3 | 106 | 101 | 102 | 0 | 1 tag |
| nullDC4WiiU | 79 | 55 | 57 | 0 | 2 tags |
| nulldc3 | 109 | 104 | 105 | 0 | d5d4eae1 fork |
| minicast | 34 | 33 | 35 | 0 | 2 pins |
| polly2 | 189 | 177 | 183 | 0 | 6 pins |
| polly2-r8 | 16 | 10 | 10 | 0 | - |
| devtools | 56 | 50 | 50 | 0 | - |
| dreamcast-tests | 124 | 103 | 103 | 0 | - |
| shrike4 | 12 | 10 | 10 | 0 | - |
| caique | 13 | 11 | 11 | 0 | - |
| wren7 | 4 | 4 | 4 | 0 | - |

Every source-changing commit of every sparse lane is a frame, and every extra frame is a tag, pin or fork.

dc4ever has 102 frames. The other 5 of the task's "107" change only the UTF-16 `sh4_managed_recomplier.cs`, which the
rules count as binary. REPORT.md discloses this.

**Dense lanes.** Using the implementation's own `churn()` (which excludes generated files), I listed every big commit
(churn >= max(1500, 3 % of the lines before it)) and the frame-to-frame step that contains it:

| lane | big commits in steps | steps with a big commit plus other churn | big commit before the first frame |
|---|---:|---:|---|
| nullDC4Wii | 16 | 0 | e812c58, the import frame |
| reicast | 23 | 0 | 1c16baeb0, the import frame |
| flycast | 26 | 0 | - |

Counting the import commits, that gives 17 / 24 / 26 big commits, the same as the REPORT. `big` frames: 40 / 58 / 51.

My cruder numstat count (no generated-file exclusion) flags further commits. I checked them: they are
`libretro_core_options_intl.h` translation dumps, khronos `gl2ext.h`, `arm7_cached_gen.inc` and the like. The rest are
big commits whose parent was dropped as an identical-source frame, which is correct, because the step is still the big
commit alone.

**Duplicates and identical source.** Across 1,472 frames:
- 0 duplicate commits in a lane;
- 0 consecutive frames with identical counted files where the later one is month / commit / big only;
- 0 date-order inversions within a lane.

**Marked frames.** Every FORKS and IMPORTS entry and every DreamSTer pin is a frame with that kind.

Every tag that matches a lane's tag pattern is on a frame, except HarissaDC `v0.1.0-dev` (f255979). That commit is
documentation only, so the "nothing counted yet" rule drops it. It was not a frame in bed89b0 either, so this is not a
regression.

**Lane graph.** All 14 code / merge edges with a frame point at a frame of the right lane and commit. The edge
commits for flycast, nulldc3 and nullDC4WiiU equal their `shared_until`.

**check_frames.py** (54 s): 1,472 frames, 0 problems.

**Provenance spot check.** 13 tour lines across dc4ever, nullDC, nullDCe, flycast, polly2 and NotDC-PS3. Each line is
in its `origin_file` at the origin commit (git grep), and absent from the lane's previous frame. For the NotDC-PS3 k=0
origin, the text is also absent from nullDC4Wii 9659506, nullDCe, reicast and flycast. nulldc3 has the comment, but in
a different line form.

**Layout.** In every lane, walls are in strictly increasing x with a minimum gap of exactly 500. There are 0
cross-lane date/x inversions. The extent is 1,032..1,376,584, as reported.

## Dates (requirement B)

`dates_check.py` (seed 7) samples 203 entries: 60 random stops, plus forced picks from each lane holding stops, from
39c0550 and 1c16baeb0 last changes, from flycast files last changed before 2018-06, from file items and from segments,
plus the origins / first_file of every item touched. They cover 15 lanes and all three kinds. Stops exist only in
15 lanes; dreamcast-tests, shrike4, caique, wren7 and polly2-r8 hold no tour item.

`dates_all.py` (39 s) then recomputed every stored date: 2,376 entries (all stop_files plus origin_file), with
`rev-list --first-parent -n1 <full frame sha> -- <path>`, then `%cs`, then the override table from `frames.py`.

| check | result |
|---|---|
| Date mismatches | 0 of 2,376 |
| Last-change commit mismatches | 0 of 2,376 |
| Override range on an entry | 238, all labelled "2008-2010 / 2012-2013 (dated ...)" |
| dc4ever entries, all "(approx.)" | 63 |
| Entries that differ from the frame date | 1,320 |
| flycast / nulldc3 / nullDC4WiiU entries last changed in shared history | 273 |
| Virtual nullDC-pre2008 origins | "2005-2008" |

The overrides also apply to 39c0550 inside nullDCe-PSP / 2024 nullDCe frames.

**Date field.** dc4ever's committer and author dates are identical on every commit (0 differ), so `%cs` is the file
mtime. For 39c0550 both fields are 2017-11-20, so the override is required, and it is applied.

**Content.** The sample checked that each stop's text (lines), at least 75 % of its distinctive code lines (segments),
or its path (files) is in the stored file at the frame commit. All pass, with one exception. Two segment **origins**
hold only some of the segment's lines. That is expected: "first seen" is the anchor line's origin, and the anchor line
is present.

**Viewer.** `attract.js` `caption()` only displays the precomputed labels: "first seen in X, file last changed ...",
"now: lane, file last changed ..." and the file items' "first: file last changed ...". Stop objects keep their
identity through `route()`, so `it.stops.indexOf(stop)` finds the right `stop_files[k]`.

## Tour picks

These are compared with bed89b0's `tools/attract_picks.json` and `data/attract.json`:
- 142 picks before and after;
- pools: 53 shared lines, 47 shared segments, 17 unique lines, 25 unique segments, unchanged;
- the built picked items have the same 142 (kind, text / code) keys;
- the unique flags are identical, and every built pick's flag equals its pick's pool;
- picks differ in their ids only, plus one note: "Held in 278 snapshots" became "568", and 568 equals the item's
  frames.

No other note states a count that changed. The ones with "four lineages" have 4 lanes.

## Counts in the repo

index.html (title, description, og, twitter), README.md and viewer/README.md say "1,472 frames in 20 lanes". No
"395 frames" is left in viewer/, tools/ or README. dist/data matches data/ (attract, frames, layout).

No home paths or IPs were added in the committed changes.

## Issues

None blocking. Two notes, both pre-existing:
- HarissaDC tag v0.1.0-dev is not a frame. It is docs-only, by rule.
- A segment's origin_file is the anchor line's file at the anchor's origin, which may hold only part of the segment.

## Verdict

ACCEPT. Requirements A1, A2, A3 (the data side) and B are met, and the tour picks are intact.

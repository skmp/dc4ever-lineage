# frames2 verification 1: data and dates

Verifier: independent check of commits f65fd62 and 0756069 (data / dates lens). Scripts and outputs are in
`agents/frames2/verify1/`. Every run took under 35 s.

## Verdict: not accepted (one major gap: no REPORT.md). The data and the dates are correct.

## Frames (requirement A)

- **Sparse lanes, every source-changing commit** (`verify1/check_sparse.py`, about 3 s). For each of the 17 sparse lanes
  I took the lane-local first-parent chain (after `shared_until` for lanes that share history with their parent) and
  marked every commit whose counted own-file set (path, blob, using the rules.py vendored / generated / binary rules)
  differs from the previous commit's. I diffed that list against `agents/frames/frames.json`: no commit is missing in
  any lane. The only extra frames are marked ones (HarissaDC 1 tag, NotDC-PS3 1 tag, nullDC4WiiU 2 tags, nulldc3 1
  fork, minicast 2 pins, polly2 6 pins).
  dc4ever has 102 frames out of 138 commits. 31 commits touch no counted source (.suo, .csproj, README), and 5 change only
  `DC/SH4.7091/sh4_managed_recomplier.cs`. That file is UTF-16, so the existing rules treat it as binary. This was
  already the case before frames2, but it means the dc4ever managed recompiler never appears in the lineage.
- **Dense lanes, big commits** (`verify1/check_dense.py`, about 14 s, output in `check_dense.txt`). I recomputed churn
  with `git log --numstat` against the first parent, threshold max(1500, 3 % of counted lines before the commit). There
  are 17, 25 and 28 lane-local big commits in nullDC4Wii, reicast and flycast, and every one is a frame except flycast
  44fa364f3. That commit rewrites the 2.6 MB `libretro_core_options_intl.h`, which rules.py counts as generated (over
  2 MB), so its counted source is unchanged and the frame is dropped correctly. The churn sum in frames.py does not apply
  `is_generated`, so the commit was still chosen and its predecessor 7029e1615 was added as a `big` frame (minor).
  The `big` frame counts are 38, 59 and 55 (big commit, the commit before it, and accumulated churn). These are tens per
  lane, as asked. The largest frame-to-frame steps that remain are single big commits (for example reicast 3bc91425e,
  257k lines, one commit).
- **Duplicates and identical source.** No (lane, commit) appears twice. No droppable frame has the same counted file set
  as the previous frame of its lane; 12 marked frames repeat the previous source, which is allowed. Within each lane
  the dates are in order.
- **Marked frames.** The counts match the previous build exactly: tag 138, pin 13, fork 10, import 7, virtual 1. 11 old
  `month` frames are gone (dc4ever 7, nulldc-360 1, flycast 2, nullDC4Wii 1). In each case an earlier `commit` / `big`
  frame of the same lane now holds the identical source, so nothing is lost.
- **Lane graph.** Every parent edge resolves to a frame of the named lane at the named commit. The edges are identical to
  the previous build, and each lane's `frames` list matches its frames.
- **check_frames.py** passes: 1475 frames, 409,747 file versions, 0 problems (31 s).
- **Provenance spot checks.** For 12 random tour lines, `git grep` finds the text in the origin frame's tree, and it is
  absent from the lane's previous frame where one exists. 2 of the 12 have the virtual pre2008 origin.
- **Layout** (data/layout.json.gz). In every lane the walls are in time order and strictly increasing, at least 500
  units apart (= MONTH/8). The extent grew from 2968..931081 to 1032..1378165, about 1.48x. The viewer reads the same
  knots through `core.timeMaps`.

## Dates (requirement B)

- **Sample** (`verify1/check_dates.py`, output in `check_dates.txt`). I checked 76 stops and origins plus 3 virtual ones,
  across all 20 lanes and covering lines, segments and file items. For each, the file path was found independently with
  `git grep -F` on the item's text at the frame commit, and the last change was recomputed. The sample covers:
  - dc4ever (approx.);
  - nullDCe files last changed in 39c0550: date 2017-11-20 in git, shown as "2008-2010 (dated 2009-10-16)";
  - reicast 1c16baeb0 files: "2012-2013 (dated 2013-12-19)";
  - 8 flycast / nulldc3 / nullDC4WiiU stops whose file last changed in shared parent history (273 such stops in all).

  All 76 match. The one early mismatch came from my own search needle, not the data. The path was confirmed by hand.
- **Full recheck** (`verify1/check_all_dates.py`). All 2,326 stop / origin / first-file entries were recomputed and
  match. Every entry is dated no later than its frame (overrides excepted), and every label carries the right "approx."
  / range text. Virtual origins are "2005-2008". No label contains 2017-11-20. 1,315 of 2,218 stops now show a date
  different from the frame date. The override range is used by 127 nullDCe stops and 88 reicast stops.
- **Date field.** In dc4ever the author date and committer date are identical (the file mtimes), so `%cs` is right.
- **Viewer.** `attract.js` shows "first seen in <lane>, file last changed <label>" and "now: <lane>, file last changed
  <label>". `stops.indexOf(stop)` works because `route()` returns the same stop objects. `dist/data/attract.json` is
  identical to `data/attract.json`.
- **Minor:** for a file item, `first_file` / "first:" is taken from `fileStops[k][0]`. That is the first frame in *lane
  order*, not in time order. "the PowerVR renderer interface" therefore reads "first: file last changed 2010-05-09"
  (nullDC), while its first stop is nullDCe 39c0550, "2008-2010 (dated 2009-10-16)". The bug already existed in
  `first_date` and now carries over.

## Tour picks

There are 142 picks before and after (100 shared + 42 unique). Comparing with the attract.json and attract_picks.json
of bed89b0:
- every picked text, segment title and code is still present, and no new ones appeared;
- no item changed its unique flag, and pool and unique agree;
- one item gained lanes: "decoded switch list" now also lists flycast and nulldc3. It is still shared, and its note says
  "several".
- the shil segment's "first seen" lane changed from dc4ever to nullDCe, as explained in tour-changes.md.
- the one stated frame count was updated: the Maple DMA note went from 278 to 571 snapshots, and 571 = the item's
  `frames`. Every "four lineages" note has 4 lanes.

## Issues

1. **major**: `agents/frames2/REPORT.md` does not exist. The task requires the agent to report:
   - the big-commit rule and the per-lane counts (A2);
   - the old and new X extent (A3);
   - the before / after performance numbers (A5).

   `tour-changes.md` says "see REPORT.md". Some of this is only in the commit message (rule, extent) or in raw logs
   (`run-frames.log` for the counts, `perf-*.log` for the numbers).
2. minor: the churn for big commits includes generated files (over 2 MB) that the frame comparison excludes. As a
   result flycast 44fa364f3 is chosen and its predecessor is added, then the big commit itself is dropped.
3. minor: the file-item "first:" date uses the first frame in lane order, not in time order (PowerVR renderer
   interface).
4. note: dc4ever has 102 of 138 commits as frames. 5 commits change only the UTF-16 recompiler, which the existing rules
   do not count. It is worth telling the owner, since he asked for "every dc4ever commit".

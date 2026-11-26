# frames2 verification 2: data and dates

I am an independent verifier. This round checks HEAD c3bbabc (the fix round) on top of f65fd62 / 0756069, through the
data / dates lens. I wrote my own scripts in `agents/frames2/verify2/` and did not reuse the verify1 scripts. I changed
no code. Every run was under a minute (check_frames.py took 57 s).

## Verdict: not accepted

The data and the dates are correct, and nothing in this lens is broken. The one gap is that `agents/frames2/REPORT.md`
still does not exist. verify1 flagged it as major and the fix round did not add it.

The task asks for these to be reported:
- A2: the big-commit rule and the counts per lane;
- A3: the old and new X extent;
- A5: the before / after performance numbers.

`tour-changes.md` sends readers to REPORT.md twice: for the keep-offset bug and for the date examples. That link is
broken.

## Dates (requirement B): `verify2/check_dates.py`, about 10 s, output in `check_dates.txt`

I took a stratified random sample (seed 7). It has up to 2 entries per bucket, where a bucket is kind (stop / origin /
first-file) x item kind x lane x override, plus 3 targeted stops each for flycast, nulldc3 and nullDC4WiiU. That gives
148 entries: 145 git checks and 3 virtual ones.

For each entry I did the following:
1. Resolved the frame commit.
2. Checked that the path exists in that commit's tree.
3. Checked that the file holds the item's text. For lines, the path must be among the `git grep -F` hits. For
   segments, at least 60 % of the distinctive lines must be present, whitespace-normalised.
4. Recomputed `git log -1 --first-parent --format='%H %cs %as' <frame commit> -- <path>`.
5. Applied the 39c0550 and 1c16baeb0 overrides and the dc4ever "(approx.)" suffix, then compared commit, date, range
   and label with `data/attract.json`.

**Result: 145 / 145 dates match, and the 3 virtual entries read "2005-2008".** The sample covers:
- dc4ever (approx.);
- nullDCe files last changed at 39c0550, including a nullDCe 2024 frame (c3e0c9bf0) whose Renderer_if.cpp still dates
  from 39c0550 and so shows "2008-2010 (dated 2009-10-16)";
- reicast 1c16baeb0 files: "2012-2013 (dated 2013-12-19)";
- flycast / nulldc3 / nullDC4WiiU stops whose last change is in the shared parent history;
- segments, file items per stop, and the file items' "first:" entries.

No label anywhere contains 2017.

Four segment *origins* initially showed as "text not in file". These are correct. A segment's origin is its anchor line,
so the origin file holds only part of the segment, and 2 to 7 of its lines are there in every case.

Other notes on dates:
- In 39 of the 145 entries, a plain (not first-parent) `git log` would give a different commit. The implementation uses
  first-parent, as specified, which matches the way frames are chosen.
- dc4ever: the author date and committer date are identical on every commit, so `%cs` is right.
- nullDC4WiiU d5a08c13d has author date 2026-11-17 and committer date 2026-11-19. The committer date is used, the same
  field frames use.
- The flycast mirror contains 1c16baeb0 (it is flycast's root), and the override lookup matches by commit in any repo.
  No tour stop happens to hit that case, though.
- File items: "first:" is now the earliest stop in time. The PowerVR renderer interface reads 2009-10-16 / 2008-2010,
  so verify1's minor issue is fixed.
- Viewer (`attract.js` 45-57): the captions read "first seen in <lane>, file last changed <label>" and
  "now: <lane>, file last changed <label>". `dist/data/attract.json` is identical to `data/attract.json`.

## Frames (requirement A)

### Sparse lanes: `verify2/check_sparse.py`, about 47 s

I used a different method from frames.py, which compares tree sets. Here a commit changes source if its diff against
the first parent (`--raw`, no renames, merges diffed against the first parent) touches a counted, non-vendored path
whose new blob (or old blob, for a deletion) is neither binary nor generated.

- 0 missing commits in all 17 sparse lanes.
- The only extra frames are marked ones:
  - HarissaDC, 1 tag;
  - NotDC-PS3, 1 tag;
  - nullDC4WiiU, 2 tags;
  - nulldc3, the d5d4eae1 fork;
  - minicast, 2 pins;
  - polly2, 6 pins.
- dc4ever has 102 frames for its 102 source-changing commits (out of 138).

### Dense lanes: `verify2/check_dense.py`, about 11 s

I recomputed the numstat churn with every entry of 50 or more lines checked for binary / generated content (frames.py
checks entries of 200 or more). The threshold is max(1500, 3 % of the running counted total).

| lane | big commits | big commits not frames | `big` frames |
|---|---:|---:|---:|
| nullDC4Wii | 17 | 0 | 40 |
| reicast | 24 | 0 | 58 |
| flycast | 26 | 0 | 51 |

The big-commit counts are the same as in the fix-round commit message, and the `big` frame counts are tens per lane,
as asked. The flycast generated-file brackets from verify1 are gone.

Four frame-to-frame steps span several commits with churn of at least 2T. Per commit, each one is the big commit alone
plus commits with 0 counted churn (README / CI, or the generated `libretro_core_options_intl.h`):
- nullDC4Wii 32e5684;
- flycast f23a3d3;
- flycast f7abe3b;
- flycast 8edd8fc.

So no step hides a large change. There is no churn after the last frame in any lane.

### Marked frames, duplicates and the lane graph

These are compared with bed89b0's `agents/frames/frames.json`:
- **Marked frames:** the 169 tag / pin / fork / import / virtual entries are identical.
- **Old frames that are gone:** 11 old `month` frames are not in the new list (dc4ever 7, nulldc-360 1, nullDC4Wii 2,
  flycast 1). I diffed the counted paths against the previous new frame for the four in the non-dc4ever lanes. Three
  have identical counted source. flycast e8e382372 differs only in the generated intl.h. The 7 dc4ever commits change
  no counted source (`check_sparse`).
- **Duplicates:** there are no duplicate (lane, commit) pairs.
- **Lane graph:** every parent edge resolves to a frame of the named lane at the named commit, and the edges are
  identical to bed89b0's. Each lane's frames are in date order. `data/frames.json` matches `agents/frames/frames.json`
  frame for frame (1,473 including the virtual one).

### check_frames.py and provenance

- `tools/verify/check_frames.py`: 1,472 frames, 408,224 file versions, 0 problems.
- Provenance (`verify2/check_origins.py`): I took 14 random tour lines with a real origin. For every one:
  - the text is in the origin file at the origin commit;
  - it is absent from the lane's previous frame;
  - it is absent from the code-parent fork frames.

### Layout

| check | result |
|---|---|
| Walls | 1,472 |
| Order within each lane | strictly increasing x, minimum gap 500 (= MONTH/8) |
| Cross-lane order | 0 inversions (no later-dated wall sits left of an earlier-dated wall) |
| Year span | every wall is inside its year's ruler span |
| Clock | every wall's x maps back to its own month through the knots |
| Ruler | year ruler x matches the knot map to within 0.5 |
| Extent | 2,968..931,081 (395 walls) to 1,032..1,376,584, about 1.48x |

## Tour picks

These are compared with bed89b0's `tools/attract_picks.json` and `data/attract.json`:
- 142 picks before and after: 53 + 47 shared, 17 + 25 unique.
- Every pick resolves, and its text or code is identical, with the same kind, pool and unique flag (0 differences).
- The segment `ids` in the picks equal the built ids.
- In the built tour, all 142 picked items are flagged as picked, and their unique flags agree with the pool.
- The only note with a count is "Held in 568 snapshots", and 568 is the item's `frames`. No note that names a number
  of lineages disagrees with its lane list.
- index.html (title, description, og, twitter), README.md and viewer/README.md all say 1,472 frames in 20 lanes, which
  matches the data.

## Issues

1. **major**: `agents/frames2/REPORT.md` is missing, which verify1 already reported. The required reports (A2 rule and
   counts, A3 extent, A5 performance numbers) exist only in commit messages and raw logs, and `tour-changes.md` links
   to REPORT.md.
2. minor (disclosure): five dc4ever commits change only `DC/SH4.7091/sh4_managed_recomplier.cs`. That file is UTF-16
   (BOM ff fe), and the existing rules treat it as binary. As a result, dc4ever shows 102 of its 138 commits, while the
   task's "107 counted" seems to include those five. This is consistent with the counting rules. The owner should
   still be told, since he named "every dc4ever commit". No report tells him.
3. trivial: in `data/frames.json`, the `files` manifest says attract.json is 406,312 bytes, but the built file is
   406,340. viewer_prep writes the manifest before attract_prep rewrites the file. This affects only the load-progress
   byte count.
4. trivial: `tools/provenance/frames` is a tracked binary, and its rebuilt copy is left modified and uncommitted.

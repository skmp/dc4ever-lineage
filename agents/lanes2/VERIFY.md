# lanes2 verification: nullDC4WiiU, HarissaDC, "dc4ever lineage" rename

Verifier run of 2026-11-25 against commits 3a83d3f, 201bfb3, 28a8a07, be6a626 (base c4b1bf0). Everything below
was re-run, not taken from the implementer's notes. Scratch: `agents/lanes2/verify/` (eval scripts, shots).

Verdict: **accept**. No blocker or major findings; minor items at the end.

## 1. Ancestry (re-measured)

nullDC4WiiU (`repos/nulldc4wiiu_nulldc_wiiu.git`):
- 1224 of main's 1303 commits are nullDC4Wii commits (same shas). Last shared commit on main's first-parent chain:
  **1459ccb** (2026-10-25, "coloring a bit the menu"), an ancestor of nullDC4Wii main. 79 own first-parent commits
  after it, 0 merges. A git fork: `code` edge with `FORK` (via `not_in`) is right, no IMPORTS needed.
- Tip vs nullDC4Wii 1459ccb: 185 identical files (62,045 lines), 88.4 % of significant lines found; vs nullDC4Wii
  main 172 files, 88.0 %. (Numbers differ slightly from the ancestry note because rules.py now counts the
  rec_v2 `.inc` split; same picture.)

HarissaDC (`repos/kernel64_HarissaDC.git`, v0.3.0, own source):

| parent | lines found (linesim) | identical files |
|---|---:|---|
| nullDC4Wii main | 56/18,909 = 0.3 % | 0 |
| nulldc-360 master | 9 = 0.0 % | 0 |
| flycast master | 68 = 0.4 % | 26 / 6,973 lines (vendored lzma/zlib only) |
| NotDC-PS3 main | 83 = 0.4 % | 5 / 1,836 (lzma) |
| nullDCe, nullDC, nullDC4WiiU | 16 / 8 / 66 | 0 |
| control shrike4-rtl | 31 = 0.2 % | 0 |

No nullDC-family identifiers in its own source (`_vmem_`, `sh4rcb`, `PolyParam`, `libPvr_`, `UpdateSystem`,
`rec_v2`: 0 hits). A `code` edge is **not** justified; `copy` is not either. `related` to the three emulators its
CREDITS.md names as studied (nullDC4Wii, nulldc-360, flycast) is the right kind. No FORKS / IMPORTS (the blame.py
note on 37fa91c is only a commit annotation, accurate).

## 2. Data

- `tools/verify/check_frames.py`: 389 frames, 0 problems (13 s).
- `tools/verify/check_data.mjs`: fails at start reading `data/manifest.json`, which has not existed since 90299b8
  (2026-11-22, format 2). Pre-existing breakage, not caused by this change; check_frames.py is the working check.
- Old lanes vs c4b1bf0: 16 of 17 lanes have identical frame lists (commit, date, files, lines). nullDC4Wii gains one
  `fork` frame (1459ccb, the nullDC4WiiU fork point, as flycast's fork point does in reicast); its other 97 frames
  keep files and lines, only the per-lane index `k` shifts by one after it. `releases` unchanged.
- New lanes match git: nullDC4WiiU = tags v0.800-U1/U2/U2.1/U2.2 (the 2026-11 month commit 1d1d599 is README-only
  and drops); HarissaDC = v0.2.0 (462ddbb), v0.2.1, v0.2.2, v0.3.0 (+ month 2026-11); v0.1.0-dev and the 2026-10
  month have no source and drop.
- `make -C tools/provenance run-frames` (18 s, OMP 8) reproduces layout.json.gz and linemeta.bin.gz byte for byte;
  frames.json differs only in the recorded size of attract.json (see minor 2). Working tree restored afterwards.

## 3. Tour

- data/attract.json: 142 picked = **100 shared + 42 unique**; `node tools/attract_prep.mjs` regenerates it
  byte-identical from tools/attract_picks.json.
- Compared with c4b1bf0 by text (line text / segment code): 136 picked items kept, titles unchanged, notes
  unchanged except the 15 lineage / snapshot count bumps listed in tour-changes.md (each now equals the item's
  lane or frame count).
- 6 removed nullDC4Wii unique picks: each text is present in nullDC4Wii 1459ccb and nullDC4WiiU v0.800-U2.2, so
  they really stopped being unique. 6 added unique picks: lanes = one lane each (3 nullDC4WiiU, 2 HarissaDC,
  1 post-fork nullDC4Wii); git grep of their lines across all 20 mirrors hits only their own repo. Notes are
  95-106 chars, factual against the code (e.g. `now = host_time() + 631152000u` is the 1950 epoch; the Wii U
  audio comment's "~76%"), own source, nothing vendored, nothing about people.
- Every picked unique item has exactly one lane.

## 4. Viewer

- `node tools/build_static.mjs`: dist/ 102 files, 22.5 MB, both new lane dirs present.
- GPU shots (port 8743, 1600x900) in `agents/lanes2/verify/shots/`: far, lanes:nullDC4Wii+nullDC4WiiU+NotDC-PS3,
  lanes:HarissaDC+nulldc-360, wall:nullDC4WiiU, wall:HarissaDC all render; legend has both lanes; labels do not
  collide badly (the 2026 end of the overview is dense but readable).
- Tour: 20 s eval with the tour started: attract on throughout, captions shown, flights between items. showItem on
  the new HarissaDC flash and nullDC4WiiU audio picks frames the block with the violet unique mark and the
  "unique: only ever in ..." caption.

## 5. Rename

- `git grep -i "nulldc lineage"` outside agents/: only the first-line comment of tools/provenance/provenance.cpp
  (not a display string). Title, og/twitter title + description, READMEs, DESIGN title, server banner: "dc4ever
  lineage", "389 frames in 19 lanes". URLs (og:url, canonical, og:image) unchanged; README villanelle unchanged.

## 6. Commits

- `git diff c4b1bf0 HEAD` (excluding data/): no home paths, hostnames or emails added; the only IP-like strings are
  source-repo content (nullDCe `"192.168.1.1"` in a candidate segment) and the existing `0.0.0.0` bind banner.
  Author lines are the same as earlier commits.

## Minor findings

1. agents/lanes2/REPORT.md does not exist (the commit messages, *-ancestry.md and tour-changes.md carry the
   content). Write a short REPORT.md pointing at them.
2. Committed data/frames.json records attract.json as 144,424 bytes; the committed file is 142,899
   (`frames_manifest.py --sizes` not re-run after the tour commit). Re-run `python3 tools/frames_manifest.py --sizes`
   and commit frames.json.
3. HarissaDC story text says "at most 0.5 % of its lines appear anywhere else in the family"; per lane the maximum is
   0.5 %, all lanes together 0.86 %. Suggest "at most 0.5 % of its lines appear in any one lane (under 1 % in all of
   them together)".
4. Five pre-existing notes still state lineage counts that differ from their segment's lanes (ARM7 view of AICA 7 vs
   9, FSCA 6 vs 4, GD-ROM command done 5 vs 8, ATA_SPI_PACKET 6 vs 8, shlr 5 vs 2); two of them grew further apart with
   nullDC4WiiU. Left as they were, documented in tour-changes.md.
5. tools/verify/check_data.mjs is stale (reads the removed manifest.json); pre-existing.
6. nullDC4WiiU (hue 25) and nullDC4Wii (hue 10) are close in the origin colours; the Wii U port's own lines are
   hard to tell from its parent's on a wall.
7. The owner's message said "DC Forever lineage"; the display name is "dc4ever lineage" (the repo name). Same name,
   different spelling: owner's call.
8. The candidate relaxation in attract_candidates.mjs (unique = every frame of a lane with < 6 frames) also widens
   the unique pool of the old small lanes (nullDCe, devtools, shrike4, ...); no picks changed because of it.

# lanes3 verification: nullDCe-PSP (PSP-Archive/nulldce-psp)

Verifier run of 2026-11-25 against commits b8c6fa6, 6406e33, 161d0e5 (base 41e3a3b). Everything below was
re-run, not taken from the implementer's notes. Scratch: `agents/lanes3/verify/` (eval scripts, shots).

Verdict: **fix**. One major finding: the tour has 100 shared + **43** unique picks, not 100 + 42. The rest
checks out; minor items at the end.

## 1. Ancestry (re-measured)

- Mirror `repos/PSP-Archive_nulldce-psp.git`: refs main 7d9be43, Experimental-builds d6f1774 (= main + c8f3bf1,
  d6f1774, only `dc/arm7/vbaARM.h` +2/-2), gh-pages, refs/pull/1/head; 39 commits; no tags. First-parent chain
  as in ancestry.md (six 2021-02-04 upload commits ending at 95b5a20, 1208fc5 "Fix VMU", docs in 2021-05, work
  2021-06 .. 08, CI and the header fix 2021-10-17).
- Parent: source blobs of 95b5a20 found anywhere in the history of each repo: nullDCe 95, reicast 28 (vendored
  zlib etc.), flycast 25, nullDC 0, nullDC4Wii 0, nulldc-360 0. Same path and blob: nullDCe 39c0550 97, bad8d6a 92,
  c3e0c9b 91. The parent is nullDCe 39c0550, which was already a fork frame: no new FORKS entry is needed, and the
  `code` edge plus the IMPORTS entry at 95b5a20 are right.
- Copy edges, spot-checked on files (significant lines, >= 20 chars):
  - `dc/arm7/arm-new.h` at 7fe5a44 is blob 6743e6b, the same blob as nullDC `nulldc/plugins/vbaARM/arm-new.h`.
  - `sinTable.cpp`: 4,096 of its 4,104 lines are in both reicast and flycast `fsca-table.h`.
  - `psp/.../ssa_regalloc.h`: 298 / 315 lines are in reicast 0bd6ea371 `libswirl/hw/sh4/dyna/regalloc.h`. It shares
    only 18 with flycast's `ssa_regalloc.h`.
  - `ssa.cpp`: 97 / 115 lines are in flycast 3171cfd38. `chd.cpp`: 72 / 72 in reicast, 45 in flycast.
  - nulldc-360: lines found in nulldc-360 master and in neither nullDC nor nullDCe 39c0550: SoundOut.cpp 23,
    sgc_if.cpp 27, threaded.cpp/.h 20. The copy edge is real but weak, as ancestry.md says.

## 2. Data

- `python3 tools/verify/check_frames.py`: 395 frames, 0 problems (24 s).
- I rebuilt the data with 8 jobs (`JOBS=8 tools/frames.py`, `OMP_NUM_THREADS=8 frames`, `frames_manifest.py`,
  `viewer_prep.py`, `frames_manifest.py --sizes`, 31 s). agents/frames/frames.json and data/frames.json came out
  byte-identical to the commit, so the manifest sizes are current. layout.json.gz and linemeta.bin.gz differ only
  in the gzip header: the decompressed contents are identical. I restored the working tree afterwards.
- Old lanes vs 41e3a3b: all 19 lanes have the same frame lists (commit, date, kinds, tags, files, lines) and
  releases are unchanged. Line **origins** changed in 5 lanes (minor 2): every frame of nullDC4Wii, NotDC-PS3,
  nullDC4WiiU, nulldc3 and minicast has a changed `by_lane`; `d` is unchanged.
- New lane vs git: import 95b5a20 (2021-02-04), month frames 1208fc5 (02), 894243b (06), 88567f2 (07), 7fe5a44
  (08) and d6f1774 (10). The 2021-05 month is docs only and is dropped. The month frames are the last first-parent
  commit of each month. Files / lines: 161 / 46,895, 161 / 46,941, 198 / 66,379, 199 / 68,280, 199 / 67,540,
  199 / 67,540.

## 3. Tour

- `node tools/attract_candidates.mjs` and `node tools/attract_prep.mjs` regenerate the committed files
  byte-identically.
- data/attract.json: 143 picked = 100 shared + **43 unique** (**major**). It should be 100 + 42.
  tour-changes.md shows this was deliberate ("142 / 143", "100 / 43"), but it breaks the 100 + 42 invariant that
  lanes2 kept by rebalancing.
- Compared by text with 41e3a3b: all 142 old picks are present, with titles and unique flags unchanged. One note
  changed: the Maple DMA snapshot count, 272 -> 278, which equals the item's `frames` (278). Every unique pick has
  exactly one lane, and no shared pick has fewer than two.
- New pick "One VFPU instruction for the vertex transform" (segment, 7 lines, nullDCe-PSP, all 6 frames). git grep
  for `vtfm4.q C110, M000, C100` across every mirror's branches hits only nulldce-psp. In nullDCe 39c0550,
  `Transform()` in plugs/drkPvr/nullRend.cpp is the four C lines the note describes. The note is 102 chars,
  factual and has no lineage count.
- Pre-existing notes of 111-115 chars (7 of them, all unchanged) go past the 110-char guideline. They are not new.

## 4. Viewer

- `node tools/build_static.mjs`: dist/ 104 files, 22.8 MB, with data/lanes/nullDCe-PSP.
- GPU shots (port 8743, 1600x900) in `agents/lanes3/verify/shots/`:
  - far renders with nullDCe-PSP in the legend and its wall label (2021-10 d6f1774).
  - wall:nullDCe-PSP renders: the origin colours show nullDCe, pre2008, reicast and the nullDC ARM7 block.
  - vfpu: the new unique pick, shown with the violet "unique: only ever in nullDCe-PSP" caption.
  - lanes:nullDCe+nullDCe-PSP is identical to the implementer's shot and does **not** frame either lane (minor 3).
  - The implementer's lanes:nullDCe-PSP+nullDC4Wii+NotDC-PS3 shot does show the lane.
- Tour, 20 s eval run: attract was on throughout, a caption was shown, and the camera moved (X changes) between
  items; the tour has 165 items, 143 picked.

## 5. Counts and names

- README.md, viewer/README.md and viewer/index.html (title, description, og and twitter tags): "395 frames in
  20 lanes". The viewer diff is count-only; nothing else was renamed. agents/collect/REPORT.md has the new repo row,
  edge line and measured-edge row.
- Stale counts remain only in old logs (agents/frames/prep.log, run.log) and in FORMAT.md's 17-lane order list.
  All three are pre-existing.

## 6. Commits

- `git diff 41e3a3b HEAD`: no home paths, hostnames or added IPs. The only email is `root.3.173210@live.com`, from
  a PSPSDK header copyright inside agents/lanes3/work/novelfiles_*.txt (source-repo content, in nulldce-psp
  `psp/include/pspdmac.h`). The IP-like strings in agents/attract/*.jsonl are source content or version numbers.
  The author is the same as on earlier commits.

## Findings

**Major**

1. The tour has 100 shared + 43 unique picks (143). Fix: keep 42 unique. Either drop one unique pick from a lane
   that has several (flycast and NotDC-PS3 have 6 each, dc4ever and minicast 5), or drop the new VFPU pick.
   Then re-run attract_prep.mjs and `frames_manifest.py --sizes`, and update tour-changes.md.

**Minor**

2. Old-lane origins moved: nullDC4Wii's last frame has 383 distinct lines with a changed origin lane. These are
   virtual -> dc4ever 226 (trivial `else` / `break;` lines), nullDC4Wii -> reicast 107, -> flycast 25,
   -> nullDCe-PSP 14, -> nullDC 8. NotDC-PS3 and nullDC4WiiU move the same way; nulldc3 / minicast move 13
   imgread.h lines from reicast to flycast. This is frames.cpp rule (b): a file identity shared through nullDCe
   now has earlier versions in the sibling lane. It is disclosed in the commit message. The visible side effect:
   nullDC4Wii, NotDC-PS3 and nullDC4WiiU now carry 14-15 non-trivial lines coloured nullDCe-PSP, and 108-136
   coloured reicast. Neither lane is in their ancestry (`anc`), and the new story chapter says "no code went back
   into another lane". Fix: either restrict rule (b) to identity versions in the lane's ancestry, or add one
   sentence to the story / FORMAT.md saying that origins follow the earliest version of a shared file, so a
   sibling can claim lines.
3. The committed shot `agents/lanes3/shots/lanes:nullDCe+nullDCe-PSP-gpu-1600x900.png` shows nullDC / nulldc-360 /
   reicast, not the two lanes it names. Fix: drop it, or take it with a working view.
4. The edge label "nullDC -> nullDCe-PSP: vbaARM ARM7 (arm-new.h verbatim), nullAICA: 25,968 lines" counts the
   17,966 nullDC-pre2008 lines too; viewer_prep.py line 239 adds pre2008 to edges from nullDC and nullDCe. Those
   lines also go into the nullDCe edge's 29,235. The copy itself is about 8,000 lines. This is a pre-existing
   counting rule (the reicast import edges do the same), but for a copy edge it overstates. Fix: optional, count
   pre2008 only on the `code` / import edge.
5. agents/lanes3/REPORT.md does not exist, although the task names it; the commit messages, ancestry.md and
   tour-changes.md carry the content. Fix: write a short REPORT.md, as lanes2 did after its verification.
6. ancestry.md's spec proposes LANE_INFO hue 62; the commit uses 320 (between dc4ever 300 and NotDC-PS3 340,
   20 degrees apart like nullDC4Wii / nullDC4WiiU). This is fine, but the spec line is stale.
7. Story text: "the PSP homebrew scene took nullDCe's recovered archive" goes slightly beyond the README, which says
   only "compiled and restored by xiro and hlide in 2021". It is acceptable, but "xiro and hlide took ..." is
   closer to the source.

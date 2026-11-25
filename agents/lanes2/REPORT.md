# Two new lanes and the rename (2026-11-25)

Workflow lineage-add-lanes: two ancestry agents, an implementer, an independent verifier (accept, minors only).

- **nullDC4WiiU** (nulldc4wiiu/nulldc_wiiu): a git fork of nullDC4Wii at 1459ccb (2026-10-25); 1224 of its 1304
  commits are nullDC4Wii's, the tree at the fork is identical (243/243 files), no code flowed back either way.
  4 frames (v0.800-U1 .. U2.2). Evidence: `nullDC4WiiU-ancestry.md`, `wiiu/`.
- **HarissaDC** (kernel64/HarissaDC, Xbox 360): a clean rewrite. Its CREDITS.md says nullDC4Wii, nulldc-360 and
  flycast were "studied, not copied"; 0 identical own files, at most 0.5 % of its lines in any one lane (0.86 % in
  all together). Related edges only. 4 frames (v0.2.0 .. v0.3.0). Evidence: `HarissaDC-ancestry.md`.
- **Data:** 389 frames in 19 lanes (was 380 in 17). nullDC4Wii gains the fork frame 1459ccb; the other 16 lanes are
  unchanged (commits, files, line texts). Counting rules: three generated data headers excluded; the Wii U JIT's
  `wii/dc/sh4/rec_v2/*.inc` counted for that repo only.
- **Tour:** every pick resolves to the same text; six nullDC4Wii unique picks became shared through the fork and the
  pools were rebalanced to 100 shared + 42 unique (`tour-changes.md`). Notes no longer state lineage counts (the
  caption shows them).
- **Rename:** "dc4ever lineage" in the page, social tags and READMEs; URLs unchanged; the villanelle unchanged.
- **Verify:** `VERIFY.md`. Follow-ups applied after it: frames.json sizes, the HarissaDC story wording, the counts
  in notes, nullDC4WiiU's hue moved away from nullDC4Wii's (25 -> 30, chroma 0.17).
- **Open:** tools/verify/check_data.mjs still reads the old data format (data/manifest.json) and fails before
  checking anything; check_frames.py is the working check.

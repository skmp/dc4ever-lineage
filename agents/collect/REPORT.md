# dc4ever lineage: collection report

Collected 2026-11-22. All repositories are public GitHub repos, mirror-cloned (`git clone --mirror`) into
`/home/skmp/projects/nulldc-lineage/repos/<owner>_<name>.git`. Nothing was cloned from local working trees.
Machine-readable output: `snapshots.json` (this dir), produced by `tools/snapshot.py snapshots.spec snapshots.json`
(rules in `tools/rules.py`, date notes in `datenotes.json`). The run takes about 3 s.

## Repositories

| repo (mirror) | default branch | first | last | commits (default / all branches+tags) | origin |
|---|---|---|---|---|---|
| skmp/dc4ever | master | 2002-01-30 (git) | 2019-04-11 | 138 / 138 | Owner's 2nd DC emulator, C#. **Real dates 2003-2005**: uploaded 2019, history rebuilt from backups as one commit per file at its file mtime (2002-01 .. 2005-09) plus 2 README commits. README: "nullDC was partially derived from this"; the interpreter survives into reicast. Line overlap with nullDC 2010 is 0.6 % (C# to C++). |
| skmp/nullDC (now skmp/nullDC-v1, archived) | master | 2010-05-09 | 2023-07-10 | 148 / 152 (+150 in refs/import/raw, a duplicate svn import) | Google Code svn trunk of nullDC 1.0.x, r1 "Initial directory structure" 2010-05-02. nullDC itself is 2005-; the 2005-2010 closed-source history is not in any repo. Branches: newrec (2010), hack/vs2013-fix (2015), wiki. 124 of 148 commits are 2010; last svn commit 2013-03-10; 2015/2023 are GitHub edits. |
| skmp/nullDCe | main | 2017-11-20 | 2024-09-27 | 4 / 8 | README: "fork from the nullDC mainline somewhere in late 2008, hackports to psp, wii, ps3". Imported snapshot (commit 39c0550, 2017) of a recovered archive; newest in-source date 2009-10-16, so the code is 2008-2010. 49 % of its significant lines appear in nullDC 2010-05. 2024-09 commits add a PS2 port (branch skmp/ps2). |
| gligli/nulldc-360 | master | 2011-10-15 | 2022-02-11 | 123 / 123 | Imported snapshot "Initial import" of nullDC 1.0.x svn trunk + Xbox 360 work: 93/203 source files identical to trunk 2010-12 .. 2013, 88.5 % of significant lines found in trunk c563e07 (2011-09-14). No git ancestry. |
| skmp/reicast-emulator (archived 2025) | alpha | 2013-12-19 | 2025-09-30 | 4015 / 4355 | Root "project import" 1c16baeb0 = the private newdc (nullDC-Android) rewrite of 2012-2013 as one snapshot. Not git-connected to nullDC: 39.6 % of its significant lines appear in nullDC trunk 2011-09, 30.3 % in nullDCe 2009; only 12-38 whole files identical (emitter, zlib, maple headers). Tags r6 (2014-01) .. r20.04 (2020-04). Code effectively ends 2021-12-22. |
| skmp/nulldc3 (= skmp/devcast, redirect) | main | 2013-12-19 | 2026-10-25 (skmp/refsw3: 2026-11-20) | 4995 / 5024 | **True git ancestry** from reicast: shares 4012 commits; last shared commit 95b673698 (2021-12-22 "Update README.md"); first own commits 2023-07-07 "fpgadc: Add F10 to dump vram and pvr_regs" and "fpgadc: Add refsw-offline". Tag v3.0.0-pre (2026-10-25). Pins skmp/dreamcast-devtools (TypeScript UI). |
| flyinghead/flycast | master | 2013-12-19 | 2026-11-22 | 7410 / 7628 | **True git ancestry** from reicast: same root, 3279 shared commits; first flycast-only commit 2018-10-20, keeps merging reicast until 2019-05-17 (a6b773a23). Tags v1.0 (2021-05) .. v2.7 (2026-08). |
| BenoitAdam/nullDC4Wii | main | 2026-01-21 | 2026-11-19 | 1278 / 1298 | Imported snapshot: first source commit e812c58 is nullDCe main bad8d6a (2024-09-26) verbatim modulo CRLF (203/203 source files, 100 % of lines). 90 tags 0.02 .. alpha0.805, Wii U port 2026-11. 35 commits by the owner (branches skmp/fixes, skmp/more-perf). |
| Mayo1970/NotDC-PS3 | main | 2026-09-19 | 2026-11-01 | 108 / 114 | Imported snapshot "Initial repo" 5a32b94 of nullDC4Wii around 2026-09-18 (best match 9659506, alpha0.76 era: 229/272 files identical, 90.4 % of lines). Tags 0.8 .. 0.8.3. Carries `plugs/caiqueAICA`, a port of the caique-rtl AICA sample model (header: "caique-rtl 5aa2376, MIT"; caique-rtl 5aa2376 is 2026-09-24). |
| skmp/minicast (added: DreamSTer submodule) | main | 2025-01-20 | 2026-10-24 | 134 / 137 | README: "A reicast-fork from ~3 years ago, meant to run on the arm cpu of de10-nano and feed polly2-rtl". Imported snapshot: 513/533 source files identical to nulldc3 2023-08-15 .. 2024-07-10 (99.8 % of lines), i.e. it branches off the fpgadc commits of nullDC 3. |
| skmp/DreamSTer | main | 2026-07-16 | 2026-10-24 | 42 / 42 | FPGA Dreamcast core release wrapper (tags r1 r2 r2b r3 r4 r5 r6 r6b). Own code is 454 lines of Python tests + shell; the cores are submodules: polly2-rtl, minicast, polly2-rtl-GLdc (third-party GLdc fork, not counted), mister-utils (r6b). Release pins are used as polly2-rtl / minicast snapshots. |
| skmp/polly2-rtl | main | 2026-07-01 | 2026-10-24 (r8/develop: 2026-11-21) | 321 / 457 | PowerVR2 in SystemVerilog. main = the r1..r6b FPGA core (polly2-rtl-lite). r8/develop (16 commits, branches from main 2806e9f 2026-10-24) replaces the tree with the new bit-exact, cycle-accurate model; its tb/*/ref_copies*.h carry verbatim copies of nullDC 3 refsw3 refcore C++ (about 900 lines; checked against refcore by tools/check_ref_copies.sh). 24 branches incl. archive/r6/*, r7/* experiments. |
| skmp/shrike4-rtl | main | 2026-09-23 | 2026-10-31 | 12 / 12 | SH4 (SH7091) models, rtl/v1, testbenches, console harness. No git link to nullDC 3; 0.8 % line overlap. |
| skmp/caique-rtl | main | 2026-09-23 | 2026-11-01 | 13 / 13 | AICA models + rtl/v1. 1.0 % line overlap with nullDC 3. Feeds NotDC-PS3 plugs/caiqueAICA. |
| skmp/wren7-rtl | main | 2026-09-23 | 2026-11-01 | 4 / 4 | ARM7DI model + rtl/v1. Vendors arm7di-tests-dreamcast. 3.3 % line overlap with caique-rtl. |
| fpgadc/dreamcast-tests (skmp/dreamcast-tests redirects here) | main | 2026-11-17 | 2026-11-20 | 124 / 124 | Console test suite (PowerVR2 hardware tests, refsw2-offline harness). 0.7 % line overlap with nullDC 3. |
| skmp/dreamcast-devtools | main | 2025-09-30 | 2026-10-24 | 534 / 534 | TypeScript devtools / debugger UI used by nullDC 3 (tag v3.0.0-pre). 0.1 % overlap (protocol strings). |
| nulldc4wiiu/nulldc_wiiu (added 2026-11-25) | main | 2026-11-07 (own commits) | 2026-11-25 | 79 own / 1304 (1224 shared with nullDC4Wii) | **Git fork** of nullDC4Wii: last shared commit 1459ccb (2026-10-25); a native Wii U (Aroma) port with a GX2 renderer, fastmem JIT and HOME menu. Tags v0.800-U1 .. U2.2 (2026-11-13 .. 11-22). No code flows back either way. Unrelated to nullDC4Wii's own short-lived Wii U attempt (2026-11-13, removed 11-17). Evidence: `agents/lanes2/nullDC4WiiU-ancestry.md`. |
| kernel64/HarissaDC (added 2026-11-25) | main | 2026-10-20 | 2026-11-20 | 7 / 7 | Xbox 360 Dreamcast emulator, a clean rewrite: CREDITS.md says it studied nullDC4Wii, nulldc-360 and flycast ("studied, not copied"). 0 identical own files, <= 0.5 % shared significant lines with any lane. Source arrives in one dump 37fa91c (2026-11-03); tags v0.2.0 .. v0.3.0. Evidence: `agents/lanes2/HarissaDC-ancestry.md`. |
| skmp/mister-utils (added: DreamSTer r6b submodule) | main | 2026-07-13 | 2026-10-24 | 7 / 7 | Tiny MiSTer helper scripts and a kernel module; cloned for completeness, not snapshotted. |

Notes on dates: first/last are author dates on the default branch. Mirrors also contain `refs/pull/*`, which are
not counted. polly2-rtl r6b's pin is 95fc3ba (2026-10-24 "Fix elaboration").

## Lineage graph (edges)

```
dc4ever (C#, 2003-2005) --partial derivation, no shared code--> nullDC (2005-, public svn 2010-05)
nullDC mainline --late-2008 fork, recovered snapshot--> nullDCe (2008-2010; 2024 PS2)
nullDC svn trunk ~2011-09 --imported snapshot--> nulldc-360 (2011-10)
nullDC / nullDCe --private rewrite (newdc), imported snapshot--> reicast (2013-12-19 root 1c16baeb0)
reicast --git fork (shared history, merged until 2019-05-17)--> flycast (2018-10)
reicast 95b673698 (2021-12-22) --git ancestry--> nullDC 3 (own commits from 2023-07-07 "fpgadc: refsw-offline")
nullDCe main bad8d6a (2024-09-26) --imported snapshot, verbatim--> nullDC4Wii (2026-01-21)
nullDC4Wii ~9659506 (2026-09-18) --imported snapshot--> NotDC-PS3 (2026-09-19)
nullDC4Wii 1459ccb (2026-10-25) --git fork--> nullDC4WiiU (Wii U, own commits from 2026-11-07)
nullDC4Wii, nulldc-360, flycast --studied (CREDITS.md), no shared code--> HarissaDC (Xbox 360, 2026-11-03)
fpgadc lane (branches from nullDC 3 / refsw, 2023-2026):
  nullDC 3 fpgadc commits (2023-08 .. 2024-07) --imported snapshot--> minicast (2025-01-20)
  nullDC 3 dumps + refsw-offline (2023-07) --concept / dump format, no shared code--> polly2-rtl main (2026-07, FPGA core r1..r6b)
  polly2-rtl + minicast --submodule pins--> DreamSTer releases r1..r6b (2026-07-17 .. 2026-10-24)
  nullDC 3 refsw3 refcore --verbatim C++ copies (ref_copies*.h)--> polly2-rtl r8/develop (2026-11)
  shrike4-rtl, caique-rtl, wren7-rtl (2026-09), dreamcast-tests (2026-11), dreamcast-devtools (2025-09): new code, no shared code
  caique-rtl 5aa2376 --ported model--> NotDC-PS3 plugs/caiqueAICA (cross-lane edge)
```

Provenance numbers come from `tools/linesim.py` (share of significant lines, whitespace-collapsed, 20+ chars,
of the child that also occur in the parent), `tools/normsim.py` (CRLF-robust whole-file identity against every
parent commit) and `tools/sharedfiles.py`. Measured edges:

| child | parent | identical files | lines found in parent |
|---|---|---:|---:|
| nullDCe 39c0550 | nullDC 761dc87 (2010-05) | - | 49.1 % |
| nulldc-360 0330292 | nullDC c563e07 (2011-09) | 93/203 | 88.5 % |
| reicast 1c16baeb0 | nullDC c563e07 | 38/413 | 39.6 % |
| reicast 1c16baeb0 | nullDCe 39c0550 | 14/413 | 30.3 % |
| nullDC 761dc87 | dc4ever | 0 | 0.6 % |
| nullDC4Wii e812c58 | nullDCe bad8d6a | 203/203 | 100 % |
| NotDC-PS3 5a32b94 | nullDC4Wii 9659506 | 229/272 | 90.4 % |
| nullDC4WiiU 75bc844 | nullDC4Wii 1459ccb | 213/280 | 91.6 % (tree at 1459ccb identical, 243/243) |
| HarissaDC v0.3.0 | nullDC4Wii / nulldc-360 / flycast | 0 own | 0.3 / 0.0 / 0.3 % (all lanes together 0.86 %) |
| nullDC 3 038f7ef3 | reicast 95b673698 | (git) | 99.8 % |
| minicast 580d7b8 | nullDC 3 d5d4eae1 | 513/533 | 99.8 % |
| polly2-rtl r8 3800f9f | nullDC 3 refsw3 4f3efe15 | 0 | 6.8 % (ref_copies*.h: tb/ref 426, tb/fp 346, isp_depth 74, isp_edge 69 lines) |
| polly2-rtl r1 be391db | nullDC 3 038f7ef3 | 0 | 0.0 % |
| shrike4 / caique / wren7 / dreamcast-tests / devtools | nullDC 3 refsw3 | 0 | 0.8 / 1.0 / 0.8 / 0.7 / 0.1 % |
| NotDC-PS3 0.8.3 | caique-rtl 5aa2376 | 0 | 0.9 % of all NotDC lines (358 of 1253 distinct plugs/caiqueAICA lines) |

## What counts as source

Counted (from `tools/rules.py`): C `.c`; C++ `.cpp .cc .cxx`; headers `.h .hpp .hh .hxx .inl`; C# `.cs`;
assembly `.s .S .asm`; shaders `.glsl .vert .frag .vs .ps .fs .fx .hlsl .metal .vsh .fsh .cg .comp .geom .vp .fp`;
Java `.java`; Kotlin `.kt`; Objective-C `.m .mm`; SystemVerilog `.sv .svh`; Verilog `.v .vh`; TypeScript `.ts .tsx`
(not `.d.ts`); Python `.py`. The same rule applies to every lane. Lines are newline counts of the blob at the
snapshot commit (no checkout, blank and comment lines included).

Not counted: JavaScript, CMake/make/shell, project files, docs, data and binaries; any file with a NUL byte.

Excluded and listed separately, so they can be turned back on:
- **vendored** third-party code (per-snapshot `vendored.dirs` in the JSON): any path under `deps/ 3rdparty/
  third_party/ external(s)/ vendor/ extern/ linux-deps/ node_modules/ khronos/` and named libraries (zlib, libpng,
  libzip, lzma, chdr, xbyak, vixl, glslang, imgui, SDL, lua, xxhash, picotcp, libretro-common, glm, stb, miniupnpc,
  json/nlohmann, glad, zstd, flac, ...). Extra per-repo rules: nulldc-360 `gui/shaders/` (third-party upscaler .cg and
  compiled shader headers), `gui/gui/` (libwiigui), `gui/utils/smb/`, `nullDC/emitter/disasm/` (binutils);
  wren7-rtl `vendor/` (arm7di-tests-dreamcast). Largest: flycast 2026 688k lines (vixl 231k, glm 87k, imgui 73k,
  xxHash 63k ...), nullDC 3 443k (vixl 179k), reicast 2020 419k.
- **generated** files: header line says generated / do not edit, data headers written by a gen program
  (dreamcast-tests `cases.h`, 228k lines), files over 2 MB (flycast `libretro_core_options_intl.h`, 92k), and
  nulldc-360 compiled shader blobs (`shaders.S`), HarissaDC `xb_lang_table.h` (written by gen_lang.py) and
  `xb_flags.h` (PNG byte arrays), nullDC4WiiU `wiiu/vmu_bg.h` (an image array). Generator programs themselves (gen*,
  make_*) stay counted. Extra counted source: nullDC4WiiU `wii/dc/sh4/rec_v2/*.inc` (the JIT driver split into nine
  `.inc` files #included by wii_driver.cpp; `.inc` is otherwise not counted).

## Snapshots (40, time order)

| # | date | id | repo @ commit | lane | files | lines | vendored lines | generated lines |
|---|---|---|---|---|---:|---:|---:|---:|
| 1 | 2005-09-15 (2003-2005) | dc4ever-2005 | skmp_dc4ever @ d9a82c6e7 (26403b8~2) | dc4ever | 29 | 25,494 | 0 | 0 |
| 2 | 2009-10-16 (2008-2010) | nullDCe-2009 | skmp_nullDCe @ 39c055006 (39c0550) | nullDCe | 235 | 60,606 | 0 | 4,848 |
| 3 | 2010-05-09 (2005-2010) | nulldc-2010-05 | skmp_nullDC @ 761dc87db (761dc87) | nullDC | 264 | 89,587 | 0 | 168 |
| 4 | 2010-12-29 | nulldc-2010-12 | skmp_nullDC @ 7708112c8 (7708112) | nullDC | 322 | 104,341 | 14,646 | 168 |
| 5 | 2011-09-14 | nulldc-2011-09 | skmp_nullDC @ c563e075c (c563e07) | nullDC | 325 | 106,127 | 14,646 | 169 |
| 6 | 2011-10-15 | nulldc-360-2011 | gligli_nulldc-360 @ 03302923d (0330292) | nulldc-360 | 195 | 53,378 | 2,970 | 25 |
| 7 | 2013-12-19 (2012-2013) | reicast-2013-import | skmp_reicast-emulator @ 1c16baeb0 (1c16baeb0) | reicast | 200 | 72,911 | 95,472 | 12 |
| 8 | 2014-01-27 | reicast-r6 | skmp_reicast-emulator @ 382f2e5c1 (r6) | reicast | 216 | 78,783 | 96,063 | 12 |
| 9 | 2014-12-11 | reicast-r7-rc1 | skmp_reicast-emulator @ 22e95de2d (r7-rc1) | reicast | 271 | 92,405 | 119,115 | 12 |
| 10 | 2018-09-04 | reicast-r8 | skmp_reicast-emulator @ 00ecf2f1c (r8) | reicast | 312 | 101,239 | 140,724 | 12 |
| 11 | 2019-07-14 | reicast-r19.07 | skmp_reicast-emulator @ 154e22448 (r19.07) | reicast | 379 | 131,409 | 439,786 | 2,256 |
| 12 | 2020-04-02 | reicast-r20.04 | skmp_reicast-emulator @ 046d94d4b (r20.04) | reicast | 437 | 139,129 | 418,608 | 2,279 |
| 13 | 2021-05-27 | flycast-v1.0 | flyinghead_flycast @ d6e15544b (v1.0) | flycast | 424 | 162,080 | 748,377 | 102 |
| 14 | 2022-02-11 (2011-2012) | nulldc-360-last | gligli_nulldc-360 @ 7b0bd50aa (7b0bd50) | nulldc-360 | 292 | 85,988 | 46,576 | 9,758 |
| 15 | 2022-08-25 | flycast-v2.0 | flyinghead_flycast @ aa97a6d64 (v2.0) | flycast | 512 | 196,715 | 790,257 | 59,928 |
| 16 | 2023-07-07 | nulldc3-fpgadc-2023 | skmp_nulldc3 @ 038f7ef37 (038f7ef3) | nulldc3 | 453 | 145,787 | 421,469 | 2,279 |
| 17 | 2023-07-10 | nulldc-last | skmp_nullDC @ 1611c3cf0 (1611c3c) | nullDC | 333 | 107,503 | 14,646 | 169 |
| 18 | 2024-09-27 | nullDCe-ps2-2024 | skmp_nullDCe @ c3e0c9bf0 (c3e0c9b) | nullDCe | 239 | 65,679 | 0 | 4,848 |
| 19 | 2024-10-21 | flycast-v2.4 | flyinghead_flycast @ 8108e6390 (v2.4) | flycast | 570 | 200,020 | 637,740 | 84,002 |
| 20 | 2025-01-20 | minicast-import | skmp_minicast @ 580d7b86a (580d7b8) | fpgadc | 273 | 94,780 | 354,470 | 18 |
| 21 | 2025-09-30 | reicast-last | skmp_reicast-emulator @ 2e32999c4 (2e32999c4) | reicast | 452 | 145,474 | 421,469 | 2,279 |
| 22 | 2026-01-21 | nullDC4Wii-first | BenoitAdam_nullDC4Wii @ e812c5828 (e812c58) | nullDC4Wii | 237 | 62,499 | 0 | 4,848 |
| 23 | 2026-07-13 | nullDC4Wii-a0.50 | BenoitAdam_nullDC4Wii @ ec3c34d39 (alpha0.50) | nullDC4Wii | 222 | 71,506 | 0 | 2,513 |
| 24 | 2026-07-17 | minicast-r1 | skmp_minicast @ 697f56586 (697f565) | fpgadc | 301 | 102,999 | 354,470 | 18 |
| 25 | 2026-07-17 | polly2-r1 | skmp_polly2-rtl @ be391dbb1 (be391db) | fpgadc | 149 | 23,497 | 0 | 771 |
| 26 | 2026-07-30 | polly2-r6 | skmp_polly2-rtl @ a37f92cb9 (a37f92c) | fpgadc | 183 | 30,754 | 0 | 771 |
| 27 | 2026-09-19 | NotDC-PS3-first | Mayo1970_NotDC-PS3 @ 5a32b94be (5a32b94) | NotDC-PS3 | 266 | 100,497 | 0 | 2,660 |
| 28 | 2026-10-24 | devtools-v3.0.0-pre | skmp_dreamcast-devtools @ 42231c6fb (v3.0.0-pre) | fpgadc | 217 | 73,195 | 0 | 0 |
| 29 | 2026-10-24 | minicast-r6b | skmp_minicast @ 9185ab882 (9185ab8) | fpgadc | 301 | 109,370 | 356,194 | 18 |
| 30 | 2026-10-24 | polly2-r6b | skmp_polly2-rtl @ 95fc3ba03 (95fc3ba) | fpgadc | 199 | 35,127 | 0 | 767 |
| 31 | 2026-10-25 | nulldc3-v3.0.0-pre | skmp_nulldc3 @ 4e773df24 (v3.0.0-pre) | nulldc3 | 563 | 233,307 | 442,701 | 5,447 |
| 32 | 2026-10-31 | shrike4-head | skmp_shrike4-rtl @ 5843f0ccb (5843f0c) | fpgadc | 1482 | 184,852 | 0 | 21,576 |
| 33 | 2026-11-01 | NotDC-PS3-0.8.3 | Mayo1970_NotDC-PS3 @ 5d81924ec (0.8.3) | NotDC-PS3 | 363 | 108,526 | 24,052 | 3,564 |
| 34 | 2026-11-01 | caique-head | skmp_caique-rtl @ 2d9898f3e (2d9898f) | fpgadc | 232 | 32,197 | 0 | 0 |
| 35 | 2026-11-01 | wren7-head | skmp_wren7-rtl @ 95988ea4f (95988ea) | fpgadc | 47 | 6,970 | 3,794 | 15,438 |
| 36 | 2026-11-19 | nullDC4Wii-head | BenoitAdam_nullDC4Wii @ ad015e23f (ad015e2) | nullDC4Wii | 244 | 104,405 | 0 | 2,513 |
| 37 | 2026-11-20 | dreamcast-tests-head | fpgadc_dreamcast-tests @ a93298050 (a932980) | fpgadc | 420 | 58,485 | 0 | 228,143 |
| 38 | 2026-11-20 | nulldc3-refsw3 | skmp_nulldc3 @ 4f3efe15f (4f3efe15) | nulldc3 | 584 | 244,109 | 442,701 | 5,447 |
| 39 | 2026-11-21 | polly2-r8-develop | skmp_polly2-rtl @ 3800f9fed (3800f9f) | fpgadc | 159 | 29,241 | 0 | 2,415 |
| 40 | 2026-11-22 | flycast-head | flyinghead_flycast @ 105342d53 (105342d53) | flycast | 664 | 221,230 | 687,748 | 93,145 |

Reasons per snapshot are in `snapshots.json` (`why`, plus `date_range` / `date_note` where the git date is not
the real date: dc4ever 2003-2005, nullDC 2005-2010 pre-history, nullDCe 2008-2010, reicast import 2012-2013,
nulldc-360 last 2011-2012).

## Totals

- 40 snapshots, **13,566 files, 4,092,201 lines** of counted source (vendored and generated excluded).
- With vendored code included: 11,180,895 lines. Generated files add 563,398 more.
- **Largest single snapshot: nulldc3-refsw3** (nullDC 3 skmp/refsw3, 2026-11-20): 584 files, 244,109 lines
  (+442,701 vendored). Largest with vendored: flycast v2.0 (196,715 + 790,257).
- By language over all snapshots: C++ 2.34M, headers 1.20M, SystemVerilog 108k, C 105k, TypeScript 72k,
  Python 63k, C# 57k, Java 53k, Objective-C 35k, assembly 30k, shaders 26k, Verilog 4k.
- fpgadc lane (12 snapshots: minicast x3, polly2-rtl x4, devtools, shrike4, caique, wren7, dreamcast-tests):
  781,467 lines, of which the two biggest are shrike4 (185k) and minicast r6b (109k).

## Caveats

- dc4ever intermediate commits are partial trees (files were added one by one in 2019), so only its final tree
  is a snapshot.
- nullDC 2005-2010 and reicast 2012-2013 (newdc) have no public history; the first public trees stand in.
- nullDCe's 2017 commit date and nullDC4Wii / NotDC-PS3 / minicast first commits are imports, not origins; the
  JSON `date` uses the real or import date as explained in `why`.
- reicast, flycast and nullDC 3 share one git history (root 1c16baeb0; 3279 and 4012 shared commits), so line provenance between them is
  available from git blame; everything else is snapshot-to-snapshot text matching.
- DreamSTer r6b's polly2-rtl pin (95fc3ba) is on main; the r1 pin be391db and r6 pin a37f92c also resolve in
  the mirror. polly2-rtl-GLdc (third-party GLdc) is not counted.

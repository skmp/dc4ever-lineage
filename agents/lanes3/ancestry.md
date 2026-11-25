# nullDCe-PSP (PSP-Archive/nulldce-psp): ancestry evidence

Repo: https://github.com/PSP-Archive/nulldce-psp (mirror `repos/PSP-Archive_nulldce-psp.git`, `git clone --mirror`,
2026-11-25). "Sega Dreamcast emulator for PlayStation Portable". Scripts used for the numbers are in
`agents/lanes3/work/` (`pathcmp.py`, `diffsize.py`, `novel.py`, `novelfiles.py`, `exclusive.py`, `filesrc.py`) with
their outputs next to them; the rest is `tools/blobsim.py`, `tools/linesim.py`, `tools/sharedfiles.py`,
`tools/count.py`. "Significant line" = whitespace-collapsed, >= 20 chars, own source per rules.py (as linesim.py).

## History, refs, credits

- Refs: `main` (HEAD, default), `Experimental-builds` (= main 7d9be43 + 2 commits, 2021-10-17, `dc/arm7/vbaARM.h`
  2 lines), `gh-pages` (website; "straight copy from DaedalusX64/daedalusx64.github.io", no source),
  `refs/pull/1/head` (RDX00, 2021-04-15, icon + README, not merged). No tags. 39 commits in all.
- First-parent chain of Experimental-builds: 6 commits on 2021-02-04 (e13f07c .. 95b5a20: one tree uploaded in
  pieces, "First commit" x4, "Add zlib", "Revert changes"), bee6dbe readme, 1208fc5 "Fix VMU" (2021-02-08),
  docs (2021-05-15), then the work commits 36b350a "General improvement + new scheduler" (2021-06-26, +30,151 / -3,429),
  5f60c9a "Experimental AICA - ARM7 emulation", 894243b, 0780924, 88567f2 (SRA), 7fe5a44 (2021-08-19), docker CI and
  the vbaARM.h fix (2021-10-17). Authors: Lorenzo Grillo (code), pierrelouys (docs / site), RDX00 (unmerged PR).
- No LICENSE file. README: "nullDC-PSP was originally developed by drk||Raziel (currently under the nickname skmp).
  It was compiled and restored by xiro and hlide in 2021." `psp/Makefile`: `PSP_EBOOT_TITLE = nullDC/PSP`.
  `psp/ndclog.txt` (added 36b350a): "nullDCe/psp v1.0.0 pre-1 (built Jan  7 2021@04:55:17)".

## Parent: nullDCe 39c0550 (the 2017-published recovered archive), not a later state, not nullDC

blobsim (identical source blob ids, `--all` of each parent repo):

| child state | best nullDCe commit | 2nd | nullDC (any commit) | nullDC4Wii (any) |
|---|---|---|---|---|
| 95b5a20 (first source, 190 blobs) | 96 = 39c0550 / cbfa1d7 (same tree + FUNDING.yml) | 91 bad8d6a .. c3e0c9b (2024 ps2 work) | 0 | 0 |
| main (255 blobs) | 73 = 39c0550 / cbfa1d7 | 68 skmp/ps2 commits | | |

Per path, 95b5a20 vs 39c0550 (`pathcmp.py`, all files): 106 byte-identical, 2 identical after CRLF / trailing
whitespace, 63 differ, 35 only in the child (zlib/ 27, sinTable.cpp/.h, psp libs and SDK headers), 205 only in nullDCe
(the ps3/, wii/, win-x86/, emitter/, rec-ARM/, cdi_cvt/, pandora/, beagle/ ... trees the PSP build does not use).
The 63 differing files: 24,288 lines, 21,550 kept from 39c0550, +2,738 / -2,666 (`diffsize.py`); largest
nullRend.cpp +241/-730, cdi.cpp +335/-162, gdromv3.cpp +223/-156, maple_devs.cpp +213/-130, shil.cpp +233/-46,
psp_driver.cpp +133/-139.

Significant lines (linesim.py), share of the child's own significant lines found in the parent:

| parent @ ref | 95b5a20 (21,359 lines) | main 7fe5a44 (29,613) |
|---|---:|---:|
| nullDCe 39c0550 | 16,060 = 75.2 % | 16,389 = 55.3 % |
| nullDCe c3e0c9b (skmp/ps2 tip, 2024) | 16,044 = 75.1 % | 16,372 = 55.3 % |
| reicast 0bd6ea371 (alpha, last before 2021-02) | 10,149 = 47.5 % | 15,202 = 51.3 % |
| flycast 30b54694a (2021-02-01) | 10,074 = 47.2 % | 14,756 = 49.8 % |
| flycast 3171cfd38 (2021-10-03) | 9,579 = 44.8 % | 13,863 = 46.8 % |
| nulldc3 skmp/refsw3 | 9,919 = 46.4 % | 14,794 = 50.0 % |
| nullDC 761dc87 (2010-05) / 1611c3c (last) | 9,541 = 44.7 % / 9,099 = 42.6 % | 13,095 = 44.2 % / 13,039 = 44.0 % |
| nullDC4Wii main | 8,529 = 39.9 % | 11,793 = 39.8 % |
| NotDC-PS3 main | 7,988 = 37.4 % | 11,257 = 38.0 % |
| nulldc-360 7b0bd50 | 7,545 = 35.3 % | 11,488 = 38.8 % |
| dc4ever master | 146 = 0.7 % | 133 = 0.4 % |

4,105 of 95b5a20's 21,359 lines are `dc/sh4/rec_v2/sinTable.cpp`, the FSCA table, whose rows are reicast's
`libswirl/hw/sh4/fsca-table.h` / flycast's `core/hw/sh4/fsca-table.h` (4,102 found in each; nullDC and nullDCe have
no such table). Without it 16,060 / 17,254 = 93.1 % of the first commit's lines are nullDCe 39c0550's.

What the later nullDCe states add over 39c0550 (253 lines at c3e0c9b) is absent from nulldce-psp (0 / 253) and every
child line found in bad8d6a / c3e0c9b / nullDC4Wii e812c58 is also in 39c0550 (0 novel lines found there): the parent
state is 39c0550 exactly. It is already a frame (FORKS: "reicast import base").

## The first commit: nullDCe's 2009 PSP tree, restored in 2021 (not an older import)

Child lines not in 39c0550 ("novel"), 95b5a20: 5,299 (`novelfiles_95b5a20.txt`); found in reicast 0bd6ea371 4,306,
flycast 30b54694a 4,475, nullDC 193, nullDC4Wii 18, union 4,611; found nowhere 651. Without the FSCA table: 1,194
novel, of which flycast-only 203 (gdromv3.cpp 84, shil.cpp 70, sh4_cpu.cpp 10, maple_devs.cpp 8), reicast-only 34,
nowhere 651. The "nowhere" lines are PSP restoration code (`#include "pspDmac.h"`, `sceKernelDcacheWritebackInvalidateAll();`,
`ScePspFMatrix4 curr_mtx;`, Media Engine cache helpers) and flycast-style logging (`INFO_LOG(MEMORY, ...)` comments).
So 95b5a20 is nullDCe 39c0550's PSP subset brought up to build in 2021 with pieces of flycast / reicast; the README
says the same ("compiled and restored by xiro and hlide in 2021"), and the build log dates a build to 2021-01-07.
No in-source date newer than nullDCe's own (`[26/4/05]` to-dos) and none older than 2021 for the new code: the
restoration is 2021-01..2021-02, the inherited code is nullDCe's (2008-2009, already dated in the nullDCe lane).

## Later copies (2021-06 .. 2021-08), and their sources

Novel lines vs 39c0550 at main: 13,224; found in reicast 9,152, flycast(2021-10) 8,565, nullDC 4,329, nulldc-360
4,277, nullDC4Wii 3,308 (all of those also in nullDC: the ARM7 core), union 7,935, nowhere 2,561 (`novelfiles_main.txt`).
Lines found in exactly one lane (`exclusive.py`, vs nullDCe c3e0c9b, nullDC, nulldc-360, reicast, flycast, nullDC4Wii):

| only in | lines | where |
|---|---:|---|
| reicast | 1,030 | psp/.../ssa_regalloc.h 344, gdromv3.cpp 69, disc_common.cpp 57, imgread.h 51, shil.cpp 49, decoder.cpp 42, cdi.cpp 35, cue.cpp 32, tmu.cpp 29 |
| flycast | 483 | shil.cpp 216, ssa.cpp 114, gdromv3.cpp 30, maple_if.cpp 16 |
| nulldc-360 | 72 | nullAICA/sgc_if.cpp 24, arm7/SoundOut.cpp 23, drkPvr/threaded.cpp + .h 22 |
| nullDC | 43 | sh4_internal_reg.cpp 14, nullRend.cpp 9, sb.cpp 6 |
| nullDC4Wii | 21 | generic (`void Write_SB_E2ST(u32 data)`, `DMAC_CHCR[2].TE = 1;`) |
| NotDC-PS3 | 9 | a zero-filled byte table |

Identical files (`sharedfiles.py`, main): nullDC 18 files / 7,901 lines, among them `dc/arm7/arm-new.h` (7,006 lines)
== nullDC `plugins/vbaARM/arm-new.h` (added 36b350a, 2021-06-26); reicast 39 / 10,711, all vendored (zlib, xxhash);
flycast 0; nulldc-360 12 / 592 (small headers also in nullDC). Per subsystem (`filesrc_main.txt`): ARM7 + nullAICA
plugin from nullDC / nulldc-360 (sgc_if.cpp 398 lines: nullDC 347, nulldc-360 374), GD-ROM image readers
(cdi/cue/gdi/chd/ioctl/imgread) and sh4_sched from reicast (chd.cpp 73/73, cue.cpp 79/79), SSA pass from flycast
(ssa.cpp 120/141 vs reicast 5), the PSP register allocator `ssa_regalloc.h` from reicast (375/393 vs flycast 272).

## Nothing flowed back

nullDCe skmp/ps2 (2024): 0 / 253 lines new since 39c0550 are in nulldce-psp. nullDC4Wii main: 24 of 57,383 lines are
in nulldce-psp and in none of nullDCe, nullDC, nulldc-360, reicast, flycast (generic one-liners). NotDC-PS3: 9.
No edge from nulldce-psp to any existing lane.

## Counting rules

Own source (count.py, rules.py as is): 95b5a20 163 files / 46,964 lines; 7fe5a44 and d6f1774 205 / 68,128. Vendored
already: zlib/, deps/ (cdipsr, chdr, coreio, crypto), xxhash/, pfctoc.h; generated: plugs/drkPvr/config.h.
Proposed: `EXTRA['PSP-Archive_nulldce-psp'] = [r'^psp/include/']`: 7 third-party PSP headers (Yabause `me.h` (C)
Andrew Church, `Protothread.h` (Ben Hoyt / Adam Dunkels), `kubridge.h`, `pspdmac.h` (PSPSDK, BSD), `melib.h`,
`driver/me.h`), about 300 lines. `sinTable.cpp` stays own (reicast's / flycast's fsca-table.h are own there too).

## Lane name

The project calls itself "nullDC-PSP" (README) / "nullDC/PSP" (EBOOT title) / "nullDCe/psp" (its log); the repo is
nulldce-psp. Lane name **nullDCe-PSP**: the repo's name, says it is the nullDCe line, and does not read as a nullDC
platform port (nullDCe itself has a psp/ tree, so the title says "2021 restoration").

## Spec

```
LANES      += ('nullDCe-PSP', 'PSP-Archive_nulldce-psp', 'Experimental-builds', {})   # after nullDCe (before nullDC4Wii)
              # Experimental-builds = main + 2 commits (vbaARM.h fix, 2021-10-17); 'main' would lose only that Oct frame
FORKS      += (none: nullDCe 39c0550 is already a fork frame)
IMPORTS    += ('nullDCe-PSP', '95b5a20', 'first upload: nullDCe 39c0550 PSP tree restored to build (xiro, hlide, 2021)')
LANE_EDGES['nullDCe-PSP'] = [('nullDCe', 'code', '39c0550'),
                             ('reicast', 'copy', None),      # image readers, sh4_sched, ssa_regalloc.h, FSCA table
                             ('flycast', 'copy', None),      # shil / ssa passes, gdrom
                             ('nullDC', 'copy', None),       # ARM7 (arm-new.h identical), nullAICA
                             ('nulldc-360', 'copy', None)]   # weakest: 72 exclusive lines (SoundOut, sgc_if, threaded); 'related' is defensible
rules.EXTRA['PSP-Archive_nulldce-psp'] = [r'^psp/include/']
LANE_INFO['nullDCe-PSP'] = (320, 0.15, 'nullDCe-PSP (PSP, 2021 restoration)', 'PSP-Archive/nulldce-psp', 'nullDCe')
```

Frames expected (first-parent, counted source): import 95b5a20 (2021-02-04), month 2021-02 1208fc5, 2021-06 894243b,
2021-07 88567f2, 2021-08 7fe5a44, 2021-10 d6f1774 (vbaARM.h); 2021-05 (docs only) dropped. No tags.
Optional date note on 95b5a20: range 2021-01-07..2021-02-04, "nullDCe's 2009 PSP port restored to build; a build log
in the tree dates a build to 2021-01-07". Measured per frame (own files / lines; share in nullDCe 39c0550):
95b5a20 163 / 46,964, 75.2 %; 1208fc5 163 / 47,010, 75.1 %; 894243b 202 / 66,843, 57.4 %; 88567f2 204 / 68,765,
55.7 %; 7fe5a44 205 / 68,128, 55.3 %; d6f1774 205 / 68,128, 55.3 % (before the psp/include/ rule).

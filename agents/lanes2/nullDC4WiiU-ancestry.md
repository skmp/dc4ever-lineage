# nullDC4WiiU ancestry (lane candidate)

Repo: github.com/nulldc4wiiu/nulldc_wiiu, mirrored to `repos/nulldc4wiiu_nulldc_wiiu.git` (`git clone --mirror`).
README: "a native Wii U (Aroma) port of the nullDC4Wii Sega Dreamcast emulator", with an "Independent Port
Disclaimer": it is not supported by the nullDC4Wii project. Measurements and scripts: `agents/lanes2/wiiu/`
(`measure.py`, `tip_vs_lanes.txt`, `parent_postfork.txt`, `fork_vs_parent.txt`, `blobsim_75bc844.txt`).

## History

- Refs: `main` (tip 1d1d599, 2026-11-25) and `refs/pull/2/head` (dabd320, not on main, ignored).
  Tags: v0.800-U1 0dc61a1 (2026-11-13), v0.800-U2 77b35aa (2026-11-21), v0.800-U2.1 8d0c254 (2026-11-21),
  v0.800-U2.2 c934dc3 (2026-11-22). All four are on main, after the fork.
- 1304 commits in the mirror, **1224 of them are nullDC4Wii commits** (same shas, including both roots 339cbba and
  e812c58). The repo is a git fork of BenoitAdam/nullDC4Wii, like flycast is of reicast.
- Last shared commit on main's first-parent chain: **nullDC4Wii 1459ccb** (2026-10-25, "coloring a bit the menu",
  `git describe`: alpha0.800-1-g1459ccb; on nullDC4Wii main's first-parent chain, 50th from the tip).
- After it: 79 first-parent commits, none merges, none in nullDC4Wii. First own commit 75bc844 (2026-11-07,
  "Add the native Wii U port with console-tested performance defaults"): 78 files, +9938 / -60, mostly new `wiiu/`
  plus edits to dc/, plugs/ and `wii/dc/sh4/rec_v2/wii_driver.cpp` (+511).
- Authors after the fork: perfcrash26 (66 commits), ClaudiWolf2056 (13). Committer dates are 2026-11-07 .. 2026-11-25
  (several author dates are 1-3 days earlier: rebased; committer dates are what frames.py uses, no override needed).
- Licence: MIT, `LICENSE` unchanged from nullDC4Wii ("Copyright (c) [2026] [BenoitAdam94]"); `wiiu/licenses/` adds
  wut and Roboto OFL. README credits: core Wii U port perfcrash26; GamePad VMU, UI, releases, wiki ClaudiWolf2056;
  "Original Emulator Base: The nullDC and nullDC4Wii teams (with Xale)".

## Content measurements (counted own source per rules.py; significant line = whitespace-collapsed, >= 20 chars)

Fork commit choice (child = nullDC4WiiU 75bc844, 280 files, 59106 lines):

| parent commit | identical blobs | lines found | of the 4951 lines not in 1459ccb |
|---|---|---|---|
| nullDC4Wii 1459ccb (2026-10-25) | 213/280 (42138 lines) | 54155 = 91.6% | - |
| nullDC4Wii 7a9a0d8 (2026-10-26, next source commit) | 212/280 | 54152 = 91.6% | 0 |
| nullDC4Wii 7b3d591 (alpha0.800) | 212/280 | 53987 = 91.3% | 0 |

nullDC4WiiU at 1459ccb vs nullDC4Wii 1459ccb: 243/243 identical files, 54050/54050 lines (same tree).
`tools/blobsim.py` over all nullDC4Wii commits since 2026-10-15: best 217/287 shared blobs, tied between 1459ccb and
493fa4b (2026-10-29 README-only commit with the same source); every BBA commit of 10-29 scores 216.

Tip (child = nullDC4WiiU main, 285 files, 57927 lines). First row is the fork; the last column counts the
6868 lines that are not in it, i.e. the Wii U port's own lines:

| lane | ref | identical blobs | lines found | of the 6868 post-fork lines |
|---|---|---|---|---|
| nullDC4Wii | 1459ccb | 189/285 (31145 lines) | 51059 = 88.1% | - |
| nullDC4Wii | main (ad015e2) | 176/285 | 50789 = 87.7% | 0 |
| nullDC4Wii | ca3f6b5 (its own Wii U port) | 176/285 | 50922 = 87.9% | 131 |
| NotDC-PS3 | main | 83/285 | 22480 = 38.8% | 57 |
| flycast | master | 0 | 6184 = 10.7% | 48 |
| reicast | alpha | 4 | 8830 = 15.2% | 19 |
| nulldc3 | skmp/refsw3 | 0 | 7274 = 12.6% | 46 |
| nullDCe | skmp/ps2 | 0 | 10734 = 18.5% | 3 |
| nullDC | master | 9 | 11078 = 19.1% | 4 |
| nulldc-360 | master | 1 | 8869 = 15.3% | 29 |
| caique | main | 0 | 25 = 0.0% | 7 |

- No back-flow either way after the fork: of nullDC4Wii main's 3496 lines that are not in 1459ccb, 0 are in
  nullDC4WiiU main or U1; of nullDC4WiiU's 6868 post-fork lines, 0 are in nullDC4Wii main. No merge edge.
- nullDC4Wii's own Wii U attempt (cd4a340 / cbc1ce4 / ca3f6b5 on 2026-11-13, `wiiu/main.cpp`, `wiiu_audio.cpp`, ...,
  deleted again in 447b315 on 2026-11-17) is unrelated code: of its 973 `wiiu/` lines not in 1459ccb, 50 are in
  nullDC4WiiU (75bc844, U1 and tip all give 50), all wut / coreinit / sndcore2 `#include`s and API boilerplate
  (`OSSleepTicks(OSMillisecondsToTicks(10));`, `while (WHBProcIsRunning())`, ...). No edge.
- flycast (48), NotDC-PS3 (57), nulldc3 (46) shares of the post-fork lines are under 1% each; no related edge.

## Spec

- LANES (after NotDC-PS3):
  `('nullDC4WiiU', 'nulldc4wiiu_nulldc_wiiu', 'main', {'tags': r'.', 'not_in': 'BenoitAdam_nullDC4Wii'})`.
  `not_in` drops the 1224 shared commits and adds the FORKS entry `('nullDC4Wii', 1459ccb, 'nullDC4WiiU fork point
  (last shared commit)')` automatically (shared_fork resolves to 1459ccb: last first-parent commit reachable from
  nullDC4Wii main).
- LANE_EDGES: `'nullDC4WiiU': [('nullDC4Wii', 'code', 'FORK')]` (equivalently `'1459ccb'`).
- FORKS / IMPORTS: nothing to add by hand; no import commit (git fork, first own commit 75bc844 is a normal diff).
- Expected frames: month 2026-11 plus the 4 tags (U1, U2, U2.1, U2.2); the 2026-11 month commit 1d1d599 is
  README-only (same source as U2.2 c934dc3), so it drops.
- blame.py: no import note needed (no import commit); if one is wanted, `'nulldc4wiiu_nulldc_wiiu': ('75bc844',
  'nullDC4WiiU: native Wii U port on top of nullDC4Wii 1459ccb (git fork)')`.
- rules.py: no vendored dirs beyond the existing rules; generated per current rules: `wiiu/font_roboto.h`,
  `wiiu/presets_generated.cpp` (already classified generated), binaries `wiiu/shaders/*.gsh`, `wiiu/icon.png`,
  `wiiu/Roboto-Regular.ttf`, `wiiu/vmu_gamepad.png` are not source.
- Counting caveat: 434f8aa (2026-11-17, committed 11-19) splits `wii/dc/sh4/rec_v2/wii_driver.cpp` (5730 -> 146
  lines) into nine `wii_driver_*.inc` files (+5643 lines). `.inc` is not in rules.py EXT, so from that commit on
  the lane shows ~5600 JIT lines as deleted. Adding `.inc` to EXT also changes nullDC4Wii (1 file), NotDC-PS3 (2),
  nulldc3 (7), caique (5), wren7 (1); a narrower option is counting `wii/dc/sh4/rec_v2/*.inc` only.
- viewer_prep LANE_INFO: `'nullDC4WiiU': (25, 0.14, 'nullDC4WiiU (Wii U)', 'nulldc4wiiu/nulldc_wiiu', 'nullDC4Wii')`,
  hue between nullDC4Wii (10) and nullDCe (50), slot next to nullDC4Wii / NotDC-PS3. Edge label:
  `('nullDC4Wii', 'nullDC4WiiU'): 'nullDC4Wii 1459ccb -> nullDC4WiiU: git fork (native Wii U port)'`.

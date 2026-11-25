# HarissaDC: ancestry evidence

Repo: https://github.com/kernel64/HarissaDC (mirror `repos/kernel64_HarissaDC.git`, `git clone --mirror`, 2026-11-25).
Dreamcast emulator for the Xbox 360 (RGH / JTAG), GPL-2.0-only, (C) 2026 Mohamed Aymen. Scripts used for the numbers
below are in `agents/lanes2/harissa_work/` (`union.py`, `loose.py`, `pairs.txt`); the rest is `tools/linesim.py`,
`tools/sharedfiles.py`, `tools/perfile.py`, `tools/count.py`.

## History

- One branch `main`, 7 commits, linear, no merges, one author. No `refs/pull`.
- Tags: `v0.1.0-dev` f255979 (2026-10-20), `v0.2.0` 462ddbb (2026-11-03), `v0.2.1` bf379ef (2026-11-05),
  `v0.2.2` 790280a (2026-11-06), `v0.3.0` e399c5f (2026-11-20, = main).

| commit | date | what |
|---|---|---|
| f255979 | 2026-10-20 | docs only (README, LISEZMOI, THIRD_PARTY_NOTICES): no source |
| 37fa91c | 2026-11-03 | "HarissaDC 0.2.0: source code and documentation": first source, whole tree at once |
| c89ac63, 462ddbb | 2026-11-03 | docs only (no change under `src/` between 37fa91c and 462ddbb) |
| bf379ef | 2026-11-05 | 0.2.1 |
| 790280a | 2026-11-06 | 0.2.2 |
| e399c5f | 2026-11-20 | 0.3.0 |

The source arrives as a dump of private work in 37fa91c; the repo was created 2026-10-19/20, so the 0.2.0 tree is
about two weeks of unpublished development (2026-10-19 .. 2026-11-03).

Counted source (`tools/count.py`, rules.py as is): v0.2.0 123 own files / 33,187 lines; v0.3.0 135 / 40,683 own,
130,681 vendored (`src/third_party/`: bearssl, lzma, rcheevos, soundtouch, zlib), 24,775 generated
(`src/platform/xbox360/xb_ui_atlas.h`, > 2 MB). No rules.py change needed.

## Licence and credits

CREDITS.md: "HarissaDC was written for the Xbox 360 after studying these emulators (studied, not copied)":
nullDC4Wii (BenoitAdam94, fork of nullDCe / nullDC), nulldc-360 (gligli), Flycast. Code it does take: Harissa64
(same author: UI, PNG, flags, languages, display pass, HTTPS, box art; not a lane here) and third-party libraries.
The HLE BIOS, CHD reader, SH4 PowerPC JIT, ARM7 JIT, renderers are its own. Layout `src/{core,hw,sh4,mem,disc,render,
bios,platform/xbox360}` matches none of the lanes.

## Measurements (HarissaDC v0.3.0 unless stated; parents at their state nearest HarissaDC)

`linesim` = share of HarissaDC's own significant lines (>= 20 chars, whitespace-collapsed) found anywhere in the
parent's own source. `files` = `sharedfiles.py` identical normalized files (includes vendored dirs).

| parent @ ref | own lines found (v0.2.0) | own lines found (v0.3.0) | identical files |
|---|---:|---:|---|
| nullDC4Wii 65df2c6 (2026-11-03) | 34/17,120 = 0.2 % | 54/20,982 = 0.3 % | 0 |
| nullDC4Wii ad015e2 (head 2026-11-19) | 36/17,120 = 0.2 % | 56/20,982 = 0.3 % | 0 |
| nulldc-360 7b0bd50 (last) | 9/17,120 = 0.1 % | 9/20,982 = 0.0 % | 0 |
| flycast 7adbf3c (2026-11-03) | 46/17,120 = 0.3 % | 68/20,982 = 0.3 % | 26 files / 6,973 lines, all `src/third_party/lzma` + zlib (vendored) |
| NotDC-PS3 0.8.3 5d81924 | 52/17,120 = 0.3 % | 83/20,982 = 0.4 % | 5 / 1,836, all `src/third_party/lzma` |
| nullDCe c3e0c9b | 16/17,120 = 0.1 % | 16/20,982 = 0.1 % | 0 |
| reicast 2e32999c4 (last) | 35/17,120 = 0.2 % | 51/20,982 = 0.2 % | 25 / 6,244, all lzma |
| nullDC 1611c3c (last) | 8/17,120 = 0.0 % | 8/20,982 = 0.0 % | 0 |
| nulldc3 4f3efe15 (refsw3) | 75/17,120 = 0.4 % | 98/20,982 = 0.5 % | 25 / 6,244, all lzma |
| union of all nine above | | 181/20,982 = 0.86 % | |
| controls: shrike4 5843f0c / caique 2d9898f / dc4ever | | 31 (0.1 %) / 15 (0.1 %) / 0 (0.0 %) | 0 |

Looser check (`loose.py`: lines >= 10 chars, all whitespace removed, lowercased, comment lines dropped), v0.3.0,
26,643 lines: nullDC4Wii 1.8 %, nulldc-360 1.5 %, flycast 1.9 %, NotDC-PS3 2.2 %, nullDCe 1.3 %, reicast 1.8 %,
nullDC 1.4 %, nulldc3 2.4 %; unrelated controls shrike4 1.1 %, caique 0.9 %. Every emulator lane sits within about
one point of the unrelated SystemVerilog/C++ model repos: no hidden copied block.

What the shared lines are (samples): nullDC4Wii / NotDC-PS3 `#define CDI_V2 0x80000004u`, `CDI_V3`, `CDI_V35`
(DiscJuggler format constants), `fseek(f, 0, SEEK_END);`, `memset(p, 0, sizeof(*p));`; nulldc-360
`dev->SetRenderState(D3DRS_SRCBLEND, D3DBLEND_SRCALPHA);`, `QueryPerformanceFrequency(&freq);`; flycast
`case RC_CLIENT_EVENT_ACHIEVEMENT_TRIGGERED:` (rcheevos client API), `clock_gettime(CLOCK_REALTIME, &ts);`.
Per file (`perfile.py`) the most any HarissaDC file shares is 12 lines (`xb_ra.cpp` vs flycast, rcheevos API
`case` labels), 7 vs nullDC4Wii (same file). No HarissaDC own file is identical to any parent file.

## Conclusion

HarissaDC is a clean rewrite, not a fork and not a port with copied parts: 0 identical own files and <= 0.5 %
shared significant lines with any lane (0.86 % with all of them together), at the level of unrelated control
repos. The only identical files are the vendored LZMA SDK / zlib copies, which rules.py already excludes.

- No `code` edge (it does not start from any parent state), no `copy` edge (no verbatim code), no FORKS, no
  IMPORTS (37fa91c is a dump of its own private work, not an imported snapshot of another lane).
- `related` edges to the three emulators CREDITS.md names as studied: nullDC4Wii, nulldc-360, flycast (parent
  commit None = the parent's latest frame at the child's time). With MINSHARE = 5 only a handful of files
  (`xb_ra.cpp` and a few with 5-7 API/format-constant lines) can pick up related provenance; nearly all of its
  lines will be new in HarissaDC, which is the right picture.

## Spec

```
LANES      += ('HarissaDC', 'kernel64_HarissaDC', 'main', {'tags': r'^v\d'})   # after NotDC-PS3
FORKS      += (none)
IMPORTS    += (none)
LANE_EDGES['HarissaDC'] = [('nullDC4Wii', 'related', None), ('nulldc-360', 'related', None), ('flycast', 'related', None)]
LANE_INFO['HarissaDC'] = (100, 0.14, 'HarissaDC (Xbox 360)', 'kernel64/HarissaDC', 'nulldc-360')
```

Frames expected: v0.1.0-dev f255979 has no counted source and is dropped by frames.py ("README-only start");
v0.2.0 462ddbb (= 37fa91c source), v0.2.1 bf379ef, v0.2.2 790280a, v0.3.0 e399c5f (also the 2026-11 month frame).
Optional date note on the first frame: 462ddbb date 2026-11-03, range 2026-10-19..2026-11-03, "first source dump of
private development since the repo's creation".

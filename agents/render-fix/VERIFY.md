# Verify: render-fix (commit 384a690, viewer)

Verdict: **fix**. The blocks are gone and no title leaks over an opaque wall. Three regressions in the new near fade
remain:
1. the frame at the clock, and the wall being read, can be hidden;
2. in Now, the live wall loses its plate on every frame step;
3. the fade starts with a hard step: the plate goes at alpha 0.997, and the next wall's text and title show through.

Setup: GPU (Mesa d3d12, Xvfb), dev server :8743 serving the working tree (viewer/ = HEAD 3b32938, no local changes),
1920x1080 unless noted. Scripts: `agents/render-fix/verify/js/*.body.js` (run with `verify/js/run.sh NAME`, using
lib.js / extract.mjs copied from after/js). Output (shots + log.json + out.txt): `agents/render-fix/verify/out/NAME/`.
`agents/render-fix/REPORT.md` does not exist. I used the commit message and `after/bench-table.md` as the implementer's
report.

## (1) Blocks: fixed

I re-ran the implementer's blocks scenes on the current tree (`out/blocks`, 57 s):

| scene | T3 area (screens) | notes |
|---|---|---|
| boot view (nullDC 2011-09) | 0 | lines + imp-hi/far, 0 T3 |
| NotDC-PS3 fit (s8a: before, 3.5 screens of purple blocks) | 0 | text, see shot |
| glide into NotDC-PS3, 1.7 / 2.2 s / end | 0 / 0.01 / 0 | 3 small T3 walls mid-glide only |
| flycast oblique after a 25 s 5-lane session (M2 / M3) | 0 | 93 imp-far, 78 imp-lo, 18 imp-hi, 17 T4, 0 T3; the same 10 s later (no deadlock) |
| Now, following flycast for 8 s (M4) | 0 | live frame unloaded with no impostor: 0 of 479 ticks (before: 23 of 29 frames) |

My own cameras: a lane flight (`out/fly`, 11 snapshots), a 30 s tour (`out/tour`, 10 snapshots), 14 street views
(`out/leak2`) and 89 frame views (`out/fit`). T3 area was 0 in every snapshot, and the imp-far tier fills the mid range.

## (2) Headings leaking: fixed against opaque walls, but visible over walls in the fade band

The leak metric counts a title as leaking when a ray through its box meets a nearer *solid* wall:

- leak.md scenes (`out/leak`): titles shown 2 / 5 / 1 / 13 / 2, leaking 0 in all 5. Before (Clock): 2 / 10 / 0 / 1.
- front-close: the sticky title is now the wall actually faced (reicast 2018-09, the clock frame).
- My street views (`out/leak2`, 10 views in flycast, nullDC4Wii, NotDC-PS3, nullDC, nulldc3, from beside and from the
  other side): 0 leaking.

What still shows (see finding 3): walls in the 2800-6000 fade band draw no plate but can be 0.5 to 0.99 opaque. The
metric and the viewer's `rectBlocked` both ignore them. Counting every wall at alpha >= 0.5 as an occluder (`out/leak3`),
4 of 14 views have titles over such walls: 8 titles, 33-100 % of their box. Examples:
- leak street-low: "reicast r7 2018-08" over a wall at 0.86;
- s-nullDC4Wii-low: "alpha0.801 2026-10" 100 % over a wall at 0.53, "alpha0.802 2026-11" 89 % over one at 0.99.

The plainest case: a head-on view of a flycast wall at 5900 units (`out/plate/plate-pair.jpg`, right). The title of the
wall behind it, "flycast 2021-11 ef3af9a", is drawn across the face of the 2021-09 wall, which is at alpha 0.997.

## (3) Every wall by default, near fade, the wall being read

- Every wall stands by default (Clock), and the far field is impostors / T4 / T5.
- Lane flight (`out/fly`): straight down flycast at about 1070 units/s toward frame 30, with the clock on frame 50.
  - The target eases out over 6000 to 2800 (alpha 0.998 at 5907, 0.43 at 4100, 0 at 2840).
  - It is gone from 2840 to 909 and comes back at 2.2 px per line (0.25 at 801, 0.99 at 400).
  - Two problems: a flicker at 4700 (finding 1c), and the plate step at 6000 (finding 3).
- Read checks on the non-focus target: solid at 11 and 4 px per line. At 2.2, 1.8, 1.4 and 1.0 px per line it is 0.
  - The ramp `smoothstep(0.7*read, read, ppl)` never acts, because it is guarded by `d < readD`, which only holds above
    2.2 px per line (finding 4).
- **The frame at the clock is hidden:** at 1.0 and 0.5 px per line (1871 and 3741 units) it has alpha 0
  (`read-focus-1.jpg`: an empty plate fills the screen; `read-focus-0.5.jpg`: another frame's code, legible, at the
  camera). In 4 of 89 frame views (`fitWall` of the clock frame, 6 per lane, `out/fit`) it is 0 or 0.08 (finding 1).
- Now (`out/nowdbg`, `out/tour` "now"): reading the live flycast wall at 11 px per line during playback, the live wall
  is below alpha 0.99 in 87 of 105 ticks and has no plate (finding 2).

## (4) Tour, Now morph, bookmarks, search: work

- Tour, 30 s (`out/tour`):
  - the caption was shown in 1819 of 1819 ticks;
  - the highlighted line is visible at the hold (`tour-contact.jpg`);
  - the visited lane's clock frame was never below 0.5 within 6000 units (0 of 983 ticks; the random items did not hit
    a finding-1 case);
  - no exceptions.
- Now morph: a morph was active in 69 of 105 ticks (`now-morph.jpg`).
- Bookmark "nullDC rec_v1 driver": lands on nullDC 2011-09 c563e07, alpha 1.
- Search "Time to emulate": the worker found 1 hit. The UI gave 1 result, and clicking it lands on nullDC 2011-09, alpha 1.

## (5) Benchmark, 2560x1440, 20 s per path (`verify/bench1`, `bench1.log`)

| path | frame p95 now | implementer before (pair 10 / 11) | implementer after (10 / 11) | fps now (before) | >100 ms |
|---|---|---|---|---|---|
| A file street | 22.5 | 26.2 / 23.4 | 22.4 / 22.6 | 101 (86.1 / 94) | 3 |
| B orbit | 21.1 | 21.0 / 20.6 | 21.1 / 21.0 | 132.8 (126.4 / 133.3) | 0 |
| C lane flights | 29.1 | 47.0 / 45.2 | 27.7 / 26.0 | 85.4 (67.2 / 65.0) | 5 |
| D close reading | 20.1 | 20.1 / 20.1 | 20.0 / 20.0 | 139.1 (139.4 / 138.3) | 0 |
| E live playback | 21.3 | 20.5 / 20.3 | 21.4 / 21.3 | 110.6 (125.6 / 127.4) | 0 |

This matches the implementer's "after" numbers. The C gain holds (p95 -36 to -38 %). E costs 4-5 % in p95 and 12 % in
fps (draws 96 -> 269), as reported.

## (6) Build and README

- `node tools/build_static.mjs agents/render-fix/verify/dist` worked: 104 files, 22.8 MB, `node --check` passed on
  main.js. I removed the dist copy afterwards.
- viewer/README.md describes the new presentation, the controls (N: Clock / Now), LOD and titles. The `pm=gallery` alias
  works (ui.js:292).
- One README claim is false today: "Not faded: the frames at the clock". See finding 1.
- DESIGN.md:253 still says "Gallery (default)" (minor).

## Findings

1. **major: the frame at the clock (and any wall behind a passing wall) is hidden.**
   - Cause: `nearFade()` (main.js:803) gives every wall within `readD` (850 units at 1080p) in front of the camera
     alpha 1, whether or not it is being read. A wall the camera is standing next to or passing through becomes solid
     and opaque. The behind-fade (main.js:810-816) then takes it as `ref`, the nearest solid wall ahead, and fades every
     wall up to 6000 behind it. That includes the frame at the clock, which that loop does not exempt.
   - Evidence:
     - `out/fit`: 4 of 89 frame views (dc4ever 2005-09, nullDC 2010-08, nullDCe-PSP 2021-07, polly2 2026-09). The
       clock frame is at alpha 0 / 0 / 0.08 / 0, with an earlier frame 75 / 312 / 720 / 75 units in front of the
       camera at alpha 1, filling the screen (`fit-hidden-*.jpg`). `fitWall` is the tour's establishing shot, the lane
       buttons and the boot view.
     - `out/fly`: the clock frame is hidden at 1.0 and 0.5 px per line.
     - The lane flight: the target flickers to 0 for about 200 ms at 4700 while the camera passes an earlier frame.
2. **major: in Now, the live wall is see-through on every frame step.**
   - Cause: when frame k+1 becomes live, its `nearCur` starts from the faded value it had while standing one month
     ahead of the camera, and eases back (8/s). Below 0.999 the wall is drawn without its plate.
   - Evidence: reading flycast at 11 px per line while playing, the live wall is 0.56-0.6 right after each step and
     below 0.99 in 87 of 105 ticks. The frames ahead show through (`out/nowdbg/now-2.5s.jpg`).
3. **major: the fade starts with a step, and headings show over walls in the fade band.**
   - Cause: any alpha below 0.999 drops the plate (solid = 0) and takes the wall out of title occlusion (`occAdd` only
     for solid walls).
   - Evidence:
     - 6100 vs 5900 units head-on: alpha 1 vs 0.997, but the mean absolute difference over the frame is 15/255. The
       next wall's text and title appear across the wall's face (`out/plate/plate-pair.jpg`).
     - Titles over walls at 0.53-0.99: 8 titles in 4 of 14 views (`out/leak3`).
     - Stacked frames (nullDC4Wii, reicast) become layered, plate-less text from 6000 units (`out/leak2/s-nullDC4Wii-low.jpg`).
4. **minor: the read ramp never acts.**
   - Cause: `if (x > cp[0] && d < readD) a = max(a, smoothstep(0.7*read, read, ppl))`: `d < readD` means ppl > read,
     where the smoothstep is already 1.
   - Effect: a hard switch at 2.2 px per line, eased in time only. Measured: alpha 0 at 2.2 (on the boundary) and at
     1.8 px per line.
5. **minor: docs.**
   - The README says the frames at the clock never fade (finding 1 contradicts it).
   - DESIGN.md:253 still says Gallery is the default.
   - agents/render-fix/REPORT.md, which this verification was asked to check, does not exist.

## Suggested fixes

1. Exempt focus walls (and the morph source) from the behind-fade. Apply the read exemption only to the wall actually
   being read: the first wall hit by the centre ray, facing the camera. Do not apply it to a wall that would stand in
   front of a focus wall the camera is framing.
2. When a wall enters the focus set, set its `nearCur` to 1 (or ease only towards lower values for focus walls).
3. Keep the plate through the fade, drawn at the wall's alpha, instead of dropping it below 0.999. Count walls at alpha
   >= 0.5 as title / label occluders in `occAdd`. Or drop the plate only once alpha is below about 0.5, together with
   the title.
4. Move the ramp out of the `d < readD` guard, or drop it.
5. Fix the README sentence, DESIGN.md:253 and the missing REPORT.md.

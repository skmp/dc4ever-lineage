# Verify, round 1: render-fix (commit 4c6c52f, viewer)

Verdict: **fix**. One major finding remains.

What is fixed:
- The blocks are gone.
- No title leaks over a wall at alpha 0.5 or more.
- The frame at the clock is never hidden.
- The live wall in Now stays whole.
- The read ramp works.
- The tour, the morph, bookmarks, search, the benchmark and the build are fine.

What remains: the near fade still has a hard step. The step moved from alpha 0.997 to alpha 0.5. At 0.5 the wall's
opaque plate and its title vanish in one frame, and the wall behind it shows through at full brightness (finding 1).

(The round 0 report was here before; it is in git at 4c6c52f.)

Setup:
- GPU: Mesa d3d12 on Xvfb. Dev server :8743 serving the working tree (viewer/ = HEAD 4c6c52f, no local changes).
  1920x1080 unless noted.
- The box was loaded by another job the whole time (about 30 `p2-offline` processes, load average 18-19).
- Scripts: `agents/render-fix/verify2/js/*.body.js`, run with `js/run.sh NAME`. These are the round 0 / fix2 scripts plus
  my own: `walk`, `step05`, `clockread`, `unsorted`, `q1`, `q2`.
- Output (shots, log.json, out.txt): `agents/render-fix/verify2/out/NAME/`.
- `agents/render-fix/REPORT.md` still does not exist. I used the commit message of 4c6c52f and `fix2/` as the
  implementer's report.

## (1) Blocks: fixed

blocks.md scenes (`out/blocks`, 60 s):

| scene | T3 area (screens) |
|---|---|
| boot view | 0 |
| NotDC-PS3 fit | 0 |
| glide at 1.7 s / 2.2 s / end | 0 / 0.03 / 0 |
| flycast oblique after a 25 s session, and 10 s later | 0 / 0 |
| Now, 8 s | 0 |

In the Now scene, 0 of 478 ticks showed a live frame as T3. My own cameras: the lane flight (11 snapshots), the 30 s tour
(10 snapshots), 14 street views, 89 frame views and 24 clock / read views. T3 area was 0 in all of them except one
tour snapshot at 0.01.

## (2) Headings leaking: fixed

- leak.md scenes (`out/leak`): 0 titles leaking over solid walls in all 5.
- With every wall at alpha >= 0.5 counted as an occluder (`out/leak3`, 14 views: the leak.md scenes plus street views
  in flycast, nullDC4Wii, NotDC-PS3, nullDC and nulldc3, from beside and from the other side): 0 titles over a wall.
  Round 0 had 8 titles in 4 views.
- Head-on views at 6100 and 5900 units of a flycast wall (`out/plate`): no title of the wall behind is drawn across it.
  Round 0's case was "flycast 2021-11" over 2021-09.

## (3) Every wall by default, near fade, the wall being read

**Every wall by default.** In Clock, every wall stands. The far field is impostors / T4 / T5.

**Frame at the clock: never hidden.**
- 89 frame views (`out/fit`, fitWall of the clock frame, 6 per lane): 0 hidden. Round 0: 4.
- Own views (`out/clockread`): the clock frame of nullDC, reicast, NotDC-PS3, flycast and nulldc3, read head-on at 11,
  2.2, 1.0 and 0.5 px per line. Alpha was 1 in all 20.
- With the camera standing just past the frame before the clock frame: alpha 1 in 5 of 5.
- Round 0's `read-focus-1` and `read-focus-0.5` cases: now alpha 1 (`out/fly/read-focus-1.jpg` shows the frame).
- The nullDC4Wii rows in clockread are a test artifact: see finding 4.

**Now.** The live flycast wall at 11 px per line during playback (`out/nowdbg`): below alpha 0.99 in 0 of 27 samples.
In the tour script, 0 of 105 ticks. Round 0: 87 of 105.

**The wall being read** (a non-focus wall, camera still):
- 11 / 4 / 2.2 px per line: alpha 1.
- 1.8 px per line: alpha 0.34, so the ramp now acts.
- 1.4 and 1.0 px per line: alpha 0, as documented (from 1.5 px per line).
- The same in nullDC, reicast and nulldc3 (`out/clockread`).

**Lane flight** (`out/fly`, about 1070 units/s):
- The target eases out: 0.999 at 5911, 0.507 at 4282, 0.026 at 2957, 0 from 2848.
- Because the camera moves, the target does not come back up close.
- No flicker. The largest one-tick alpha change of any wall was 0.39, at the start (see finding 3).
- The plate flips at alpha 0.5 (3 flips in the flight). This is finding 1.

**Walking up to a wall with W at the default speed of 2000 units/s** (`out/walk`):
- Within 2800 units the target is at most alpha 0.025 while moving.
- Stopping at 567 units: it comes back after about 0.4 s and is whole after 0.78 s.
- Stopping at 967 units: it comes back to 0.645 (ramp).
- Stopping at 1767 units: it does not come back (below 1.5 px per line).
- With Ctrl (500 units/s, under the 600 units/s still gate) it counts as read while moving and comes in from 1150 units.

**The step at alpha 0.5** (`out/step05`): a head-on view of flycast 2021-09 held at 4500 / 4420 / 4380 / 4300 units.
- Alpha 0.547 and 0.509 are solid; 0.491 and 0.453 are ghosts.
- `step-4420.jpg`: an even, dark plate with 2021-09's text and title.
- `step-4380.jpg`: the plate is gone, and the bright, solid 2021-11 wall behind it fills the middle third, with its title.
- Mean absolute luma change between the two shots, 40 units apart: 14.4. Neighbouring pairs 80-200 units apart: 6.3,
  7.2 and 8.1.
- A moving camera crosses it in one frame (`pair`: solid at A 0.500, ghost at 0.497, at 4394 units).

## (4) Tour, Now morph, bookmarks, search: work

- Tour, 30 s (`out/tour`):
  - the caption was shown in 1814 of 1814 ticks;
  - the highlight is visible at the hold (`tour-24s.jpg`, reicast `shil_opc(shad)`);
  - the clock frame of the lane the camera is in was below 0.5 within 6000 units in 0 of 1175 ticks;
  - no exceptions.
- Now morph: active in 69 of 105 ticks (`now-morph.jpg`).
- Bookmark "nullDC rec_v1 driver": lands on nullDC 2011-09 c563e07, alpha 1.
- Search "Time to emulate": the worker found 1 hit. The UI shows 1 result, and clicking it lands on nullDC 2011-09,
  alpha 1.

## (5) Benchmark, 2560x1440, 20 s per path (`verify2/bench`, `bench.log`; box under load, see Setup)

| path | p95 now | implementer before (pair 10 / 11) | round 0 after (10 / 11) | fps now | >100 ms |
|---|---|---|---|---|---|
| A file street | 21.5 | 26.2 / 23.4 | 22.4 / 22.6 | 107.9 | 2 |
| B orbit | 21.0 | 21.0 / 20.6 | 21.1 / 21.0 | 133.8 | 0 |
| C lane flights | 23.8 | 47.0 / 45.2 | 27.7 / 26.0 | 91.7 | 3 |
| D close reading | 20.1 | 20.1 / 20.1 | 20.0 / 20.0 | 138.9 | 0 |
| E live playback | 21.1 | 20.5 / 20.3 | 21.4 / 21.3 | 111.9 | 0 |

The fade logic costs nothing measurable. C keeps its gain (-47 to -49 % p95). E is +3-4 % p95, as in round 0.

## (6) Build and docs

- `node tools/build_static.mjs agents/render-fix/verify2/dist`: 104 files, 22.8 MB. `node --check` passes on main.js,
  which has the new `readWall` code. I removed the copy afterwards.
- viewer/README.md matches what I measured:
  - Clock / Now;
  - the fade band 6000 to 2800;
  - the frames at the clock never faded and whole at once;
  - the read wall: centre ray, 1.5 to 2.2 px per line, camera still;
  - a wall in front of a framed clock frame fades;
  - plate and title kept to half opacity;
  - the walls behind the read wall fade;
  - `pm=gallery`.
- DESIGN.md:253 now says Clock.
- REPORT.md is still missing (minor, finding 5).

## Findings

1. **major: the fade still has a hard step, now at alpha 0.5.**
   - Below 0.5 the wall loses its opaque plate (main.js:824, `if (A < 0.5) wallArr[o + 2] = 0`) and its title. In one
     frame, the walls behind it appear at full brightness.
   - The plate is drawn opaque and depth-writing at any alpha (main.js:1192, `gl.disable(gl.BLEND)`). So between 0.5 and
     1 the wall hides everything behind it completely, and at 0.5 it stops hiding anything.
   - In a lane flight, every wall passing about 4400 units pops like this (`out/step05/step-4420.jpg` vs
     `step-4380.jpg`).
   - Fix: let the plate itself fade. For example:
     - draw the plates of walls with 0.02 < A < 1 in the blended pass, at premultiplied alpha A (depth test on, no
       depth write, after the opaque plates);
     - keep the title / label occluder rule at A >= 0.5, which does not show (titles only fade);
     - fade the title with A rather than dropping it at 0.5.

2. **minor: walking up to a wall at the default speed, the wall is invisible from 2800 units until you stop**
   (`out/walk`).
   - The read exemption needs the camera under 600 units/s, and the default fly speed is 2000.
   - You walk toward empty space and have to guess where to stop. If you stop beyond about 1215 units (1.5 px per line),
     the wall never comes back. After stopping close enough, it eases in after 0.4 to 0.8 s.
   - The README documents "while the camera is still", so this is by design. A gate on deceleration, or on the speed in
     px per line per second, would let the wall show while you slow down near it.

3. **minor: the behind-fade is not eased.**
   - The behind-fade (main.js:828-834) multiplies alpha directly. When the ref appears or goes (the read wall crosses
     solid, or the camera crosses the 600 units/s gate), walls behind it jump in one tick:
     - 0.053 to 0.444 at 4263 units when the flight starts (`out/fly`, jumpAt);
     - 0.928 to 0.155 at 5458 units in the Ctrl walk (`out/walk`).
   - In both cases the jumping wall stood behind the ref wall's opaque plate in the same lane, so I could not see it.
     With finding 1 fixed (plates fading), it would show. Ease the fade factor per wall, as `nearCur` does.

4. **minor, pre-existing: 42 of 395 frames cannot be the frame at the clock** (`out/q2`, `out/unsorted`).
   - Affected lanes: nullDC4Wii 23, reicast 12, polly2 3, nullDC4WiiU 2, minicast 2.
   - `ln.xs` is not sorted in these lanes. For example, nullDC4Wii alpha0.53 is at 914435 and alpha0.54 at 914065.
     `laneFrameAt` does a binary search (main.js:723), so `setX(w.x + 1)` picks another frame. This is the call that
     search, bookmarks, PageUp / PageDown, the file panel and the tour use.
   - Examples: polly2 and minicast "DreamSTer r4 / r5", reicast "r20.02".
   - In 17 of the 42, the frame that does become the clock frame stands 16-129 units in front of the requested one, so
     its 11 px per line read view shows the wrong frame. That was so before the render fix too.
   - This also explains the nullDC4Wii rows in `out/clockread` (the "focus" wall was not the clock frame).
   - Out of scope for this fix. Worth a data or lookup fix: sort xs, or search by frame index.

5. **minor (process): agents/render-fix/REPORT.md does not exist.** The commit message carries the summary.

Design note, not a defect: a non-clock wall up to 6000 units in front of a framed clock frame is not "read", even at
11 px per line. Example: NotDC-PS3, a wall 774 units in front of the clock frame, camera 170 units from it, alpha 0
(`out/clockread/nonfocus-NotDC-PS3-11.jpg`). The README states this rule, and it is what keeps the clock frame visible.

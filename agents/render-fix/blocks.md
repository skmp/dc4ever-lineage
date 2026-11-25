# Issue 1: walls that render as blocks

Owner: "some frames not render - they render in blocks ... all frames should always be rendered except when close to camera".

All measurements: GPU (Mesa d3d12 via Xvfb), 1920x1080, dev server :8743, quality step 0 unless noted.
Scripts: `agents/render-fix/blocks/s1..s8.js` (= `lib.js` + `sN.body.js`, run with `tools/verify/run.mjs eval`),
shots + per-snapshot logs: `agents/render-fix/blocks/sN/*.jpg` and `sN/log.json`. Each log entry lists every
visible wall in front of the camera with its tier: lines / imp-lo / imp-hi / T3 (file quads) / T4 (column strips) / T5
(one quad). It also gives the screen area (bbox, in screens) per class.

There are four separate mechanisms (M1 to M4) plus one design limit (M5). Ranked by how much screen they cover in the paths the owner takes:

## M1. Ghost walls never get text: always T3 file quads (the big one)

`viewer/src/main.js:984` streams only solid walls (`if (solid && pE >= LODP.want) want.push`). `main.js:989` draws a
non-solid wall as its impostor if it happens to have one, else T3, and never pushes it to `bakeCand`. Ghosts are the lane's
frames within 6 months of the clock, at alpha 0.05 to 0.30 (Clock mode, and Now mode). So they are never loaded or baked,
and they show as translucent coloured file rectangles. The near fade (`main.js:733-736`) only fades walls *behind* the live
wall (`(wallArr[o] - x) * dx >= 0` is skipped), and only within 3200 units of it. Ghosts between the camera and the wall
being read keep full ghost alpha, even with the camera right next to them. Dense lanes (flycast, NotDC-PS3, nullDC4Wii,
nullDCe 2024: several frames a month) have 3 to 12 ghosts each.

Measured:
- start view (s1a): 6 ghost T3 walls, 1.27 screens of blocks in front of / around the nullDC 2011-09 wall (`s1/s1a-start-clock.jpg`).
- the tour (s3, snapshots every 2.5 s). Every glide into a wall passes through its lane's ghosts. 20 s: nullDCe 2024-09-26
  ghost in front of the 09-27 target, 0.9 screens. 32.5 s: 4 flycast ghosts, 1.7 screens. 47.5 s: 8 NotDC-PS3 ghosts, 4.1
  screens, two at 18 and 3 px per line (the camera is at them) (`s3/s3-tour-47.5.jpg`, `s3/s3-tour-20.0.jpg`, `s3/s3-tour-32.5.jpg`).
- fit view of a NotDC-PS3 wall (s8a): 7 ghost T3 walls, 3.5 screens; the whole screen is purple blocks (`s8/s8a-notdcps3-fit-5s.jpg`).
- Now mode playback (s4): 6 to 8 ghost T3 walls, about 0.4 screens throughout.

This is the owner's "all frames should always be rendered except when close to camera".

## M2. The want set never expires: once the instance pool is full, walls at mid distance never load

`main.js:1018` `for (const w of WALLS) if (w.wanted === epoch - 1) w.wanted = epoch;` ("keep last frame's set while it
settles") runs every frame. So every wall that was ever wanted stays wanted for good. `upload()` (`main.js:506-507`) evicts
only walls that are not wanted (now none). Failing that, it evicts wanted walls whose `wantD` is more than 1.25x the new wall's.
`wantD` is only updated while a wall is in the fresh want list, so loaded walls keep the small distance from when they were
close. The pool holds 1884 usable rows (about 7.7M lines, about 38 flycast walls; all 395 walls are 43.8M lines). Once it is
full, a new wall loads only if it is nearer than the stale distances, which in practice means reading range. Walls at mid
range stay T3 / T4 for good. Each failed upload also posts `evicted`, and the worker decodes the same walls again on every
`want` message (every 200 ms).

Measured (s7: a 40 s Gallery flight over 5 lanes, then the s1e oblique view of flycast):
- 82 walls loaded (1912 rows), **all 82 carry the current want epoch, 81 of them are below the want threshold** (far away).
- 7 walls in want range (ppl 0.046 to 0.055) are not loaded. After 8 more seconds: **0 loads**, still the same 7, wantQueue 6.
- s8: after the same kind of session, a never-loaded wall at reading range did load (the 1.25x fallback works when the new
  wall is nearer than everything). The deadlock hits mid range only.

## M3. Evicting a sharp (hi) impostor leaves the wall with no impostor at all

The 6 nearest walls are baked `hi` (16 px x 2048 per column; a flycast wall = 41 MB). The new hi bake replaces the wall's lo
impostor (`bake()`, `main.js:815-816`). The hi cap is 288 MB, which is about 7 flycast walls (`main.js:757`, `main.js:791`
LRU). `freeImp()` sets `w.imp = null`, with no fallback to lo. The wall has usually left the pool too, so it is not re-baked
until the camera comes back within want range. It shows T3 / T4 in the meantime. lo is never the limit: 138 MB at peak, cap 192 MB.

Measured (s6: the same 40 s Gallery flight): 271 walls had an impostor at some point, **206 lost it, 195 had none at the
end**; hi peaked at 287 MB (18 walls). The reicast 2023-07 wall, imp-lo before the session (s1e) and T3 after it (s6), at the
same camera and ppl 0.054: `blocks/reicast-before-after-session.png` (left before, right after), `s6/s6-flycast-oblique-after-session.jpg`.

## M4. Now mode: each new live frame is T3 until its decode lands

In Now mode a lane's live wall jumps to the next frame every month of clock (about 0.5 s at 2 months/s). The next frame is
prefetched only through the morph, which needs the live wall at 0.3 px per line or more (`main.js:720-726`). Otherwise it
becomes live unloaded: it is a ghost until that moment, and ghosts are not wanted (M1). It shows T3 until the worker
delivers it, then for one more frame until its impostor bakes.

Measured (s5, flycast followed at 0.12 px per line): 23 of 29 flycast live frames were unloaded when they went live (the 6 loaded ones were solid releases, so already wanted); load latency
8 to 198 ms (about 100 ms typical) of a 50 to 970 ms life. So the wall blinks to blocks once per frame per lane
(`s4/s4b-now-10s.jpg`: the live flycast 2024-02 is T3 colour bars while its neighbours are impostors).

## M5. By design: beyond the want distance only walls that were loaded once have an impostor

Streaming starts at 0.045 px per line (about 41k units at 1080p). An impostor needs the wall's lines on the GPU, so a wall that
was never that close is T3 (to 0.03), T4 column strips (to 0.008), then T5. lo impostors for all 395 walls would take 1057 MB
against the 192 MB cap. Gallery oblique view of flycast (s1e): 7 imp-lo walls, 7 T3, 192 T4. The overview (G, s1b/c/d)
is all T5, which is fine at that size.

## Not the cause (checked)

- Text chunks: every run reached `V.load.text == text_chunks` before the first snapshot. Lines drawn at reading range were
  always real text (s3 hold phases, s8b).
- Adaptive quality: step 0 almost throughout. Step 1 once (s2b at 3 s), with no T3 change. The `maxInst` overflow path
  (`main.js:1011`) would draw nothing (not blocks) for columns without an impostor; I never saw it fire at 1080p.
- The wall texture ring (`wallTexRing`): not involved. Every misclassified wall above is explained by loaded/imp state.

## Proposed fix (one change per mechanism)

1. M1: stream, bake and draw ghosts like solid walls. Push non-solid walls to `want` too (after the solid ones, or with
   distance x 2). Route them through the per-column lines / impostor path with `uAlpha = wallArr alpha`: the line program
   has `uAlpha`, today always 1; `P.imp` already takes `uFade`. Push them to `bakeCand`. Replace the behind-only fade at
   `main.js:733-736` with a camera-distance fade for every non-live wall of the lane, on both sides (0 at 500 units from the
   camera, full at about 3200). Then ghosts are text everywhere except close to the camera.
2. M2: make `wanted` time-limited (`w.wantT = now` when in the fresh list, wanted while `now - w.wantT < 1000`). Drop
   `main.js:1018`. In `upload()` evict by current distance: refresh `wantD` for loaded walls each frame, or evict the LRU
   of walls not wanted in the last second, then the farthest. About 10 lines.
3. M3: keep a wall's lo impostor when it gets a hi one (lo is 1/8 of hi), and draw hi if present, else lo. Or, when hi is
   evicted, rebuild lo from the hi texture's mip level 2 (blit, no reload). About 20 lines. Costs at most 192 MB lo, already budgeted.
4. M4: in `updateDisplay`, want each lane's next frame (k + 1) whenever the live wall is in want range, not only for
   the morph. Until the new frame is loaded, keep drawing the departing frame's impostor at the live X instead of T3.
5. M5 (optional, for "always rendered"): a background bake queue. Load, bake lo, evict every wall once, idle-time, nearest
   first. With a far tier of 2 px x 512 per column, all walls take about 264 MB. Decode cost at the measured
   ~2M lines/s is about 20 s of worker time for the 43.8M lines.

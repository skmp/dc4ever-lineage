# nullDC lineage viewer

A WebGL2 fly-through of the nullDC family through time: 380 frames in 17 lanes, from dc4ever (2004) to nullDC 3, the
ports and the fpgadc hardware re-creation (2026). A frame is the last commit of a month with commits, or a release,
tag, DreamSTer pin, fork or import point (`agents/frames/FORMAT.md`). Each frame is a wall of readable code; X is
time (4000 units per month), lanes are repos, and a file keeps the same place in every frame of its lane.

## Run

```
node tools/serve.mjs [port]        # dev server, from the repo root (Node 22, no dependencies): viewer/ at /, data/ at /data/
node tools/build_static.mjs        # the public build -> dist/ (relative paths, no server needed; dev-only code removed)
```

The dev server binds 0.0.0.0 and prints the URL to open from Windows (WSL2 NAT does not forward `localhost`).
`dist/` is a plain static site: any file server works (`cd dist && python3 -m http.server`), under any path.

## The clock

One shared clock (the slider, the blue gate across every lane) drives all lanes.

| presentation | what shows |
|---|---|
| Clock (paused, default) | each lane's frame at the clock, solid at its own X; the lane's frames within 6 months as ghosts; releases solid |
| Now (playing, or N) | each lane's frame rides on the clock plane and morphs into the next one (kept lines slide, removed fade red, added grow green) |
| Gallery (N) | every frame solid at its X: the streets through time |

Release marks (yellow: DreamSTer pins; blue: tags) sit on the time axis under the slider: click one, or PageUp /
PageDown, to jump. Frames stream in around the camera and the clock: a worker fetches a lane chunk (keyframe + up to
24 deltas), applies the edit scripts and builds the wall; the GPU keeps a pool of walls and evicts the least recently
used ones.

## Controls

| input | action |
|---|---|
| W A S D, Q / E | fly (Shift 4x, Ctrl 1/4x); the scroll wheel sets the speed |
| drag | look around |
| click / double-click / F | pin the tooltip / fly to the file under the cursor |
| click a file header bar | file panel: the file in every lane that holds it |
| P , . | play / pause, one month back / forward |
| PageUp / PageDown | previous / next release |
| N | Clock / Now / Gallery |
| `[` `]`, `{` `}` | same place in the lane's previous / next frame; previous / next lane |
| G | overview |
| 1-5 | colour: origin, age, survival, diff vs previous frame, repo of origin |
| T | the tour (attract mode): starts on page load (`?tour=0` = not), after 2 minutes idle (`?idle=` seconds, 0 = never) or on T; a drag, a key, the wheel or a click takes over |
| ♪ button, volume, M | the generative score, its volume, mute; the first click / tap / key on the page turns it on (browsers allow audio only after a gesture) |
| bench button, `?bench` | the benchmark: five 15 s paths, then a score card; nothing is recorded |
| / B I L H | search (text, regex, path), bookmarks, minimap, lineage story, help |

The URL hash keeps the camera, clock, mode and presentation.

## Wall titles

Every wall has a title: lane, month (or release tag / DreamSTer pin; `approx` for dc4ever, the date range for nullDCe),
commit. Titles are drawn in screen space (one instanced draw, the SDF font) above the wall's top edge, or stuck to the
top of the screen while the wall covers it, at 16 to 25 CSS px for the lane's frame at the clock, smaller and fainter for
other solid walls and ghosts. They are placed greedily every frame (the frame at the clock first, then solid walls, then
ghosts, nearer first), so none overlap; a title behind a solid wall is hidden.

## Text rendering (three tiers per line, chosen per pixel)

- Near (>= 3.8 px per line on a GPU, blending in from 2.4): glyphs from a 1024 x 768 SDF atlas of DejaVu Sans Mono (64 x 128 px cells,
  spread 12 px, `tools/font/mkatlas.cpp`), mipmapped (3 levels), anisotropic, sampled with explicit gradients from the
  continuous cell coordinate, anti-aliased by the screen-space derivative, 4-tap supersampled when small.
- Middle (>= 1 px per line, from 0.55): SDF token shapes: each run of non-space characters is a crisp word bar (x-height band),
  edges anti-aliased against the neighbouring cells.
- Lines are drawn down to 0.28 px per line (fully from 0.45, as bars); over that band they fade in per pixel while the
  wall's impostor fades out under them, so nothing pops.
- Far: impostors baked from the same shader (16 px per column x 2048 rows from 0.1 px per line at the wall, 4 px per
  column below), then per-file quads (to 0.03 px per line), then per-column strips, then one quad per wall.
- File cards: on the 12 nearest solid walls (from 0.12 px per line) every file has its header bar, a screen-space outline
  and, where the path label would be smaller than 12 CSS px, its file name grown in the wall plane to fit the card.
- Look-ahead: streaming (from 0.045 px per line), the sharp impostor bake and the file cards use the nearer of the
  camera's distance and its distance 1.5 s ahead along its velocity, so walls ahead are ready before the camera arrives.

Up close, the lane's other walls behind the wall being read (ghosts, releases) fade out, so their text does not show
through as a second layer. On llvmpipe the canvas renders at half scale and lines in motion during a morph are bars;
`?scale=1` and `?morphglyph=1` turn both off (used for the screenshots in `agents/viewer3/shots/`).

## Attract mode (the tour)

The tour starts as soon as the data is ready, with a small "click anywhere for sound" overlay. The first click, tap or key
only turns the score on (it does not pin, drag or move), and the tour keeps running; after that a drag, a key, the wheel
or a click hands control back, and the tour resumes after 2 minutes idle. With prefers-reduced-motion the camera never
moves by itself: the overlay offers a "start tour" button instead.

`data/attract.json` (`node tools/attract_prep.mjs`, 3 s): the curated lines (the dc4ever 2005 to-do, "and here are the
new ones :D", spg.cpp's "Time to emulate that stuff correctly ;)"), the computed longest-surviving / widest-spread
distinctive lines (comments and strings held by the most frames across the most lanes, licence boilerplate and
register tables excluded, one per file), and famous files (SH4 dynarecs, interpreter, spg.cpp, PowerVR renderer
interface, refsw). Each item visits the frames that hold it, forward and back in time and across lanes at fork points,
with smooth camera moves to reading range and a caption: the line, where it first appeared, how far it spread.

## Score

`viewer/src/score.js`: original, synthesised in Web Audio (additive piano, detuned-saw strings, drawbar organ,
formant choir, convolution reverb from a generated impulse). Stylistic inspiration only (Satie's sparse modal piano,
Richter's late-resolving string suspensions, Glass's additive organ arpeggios over pedal tones); every line is a
seeded random walk over the scale. It stays in one key signature (one flat) and only moves the modal centre (D aeolian,
F ionian, G dorian, B-flat lydian), so section crossfades stay in key. Era (the year at the clock), fork / import
points passed, code density on screen and the attract arc set the voice levels (crossfaded) and the density.

```
node tools/render_score.mjs --dur 180 --seed 2026 --out agents/score   # offline render to WAV + level / clip / click / key report
```

## Benchmark

The bench button (or `?bench`, `?bench=A,E`, `&dur=`) runs five scripted paths: A file street (sh4 interpreter
through its frames), B orbit (Gallery), C lane flights (Gallery), D close reading (nullDC 3), E live playback (Now,
2010 to 2026). The score card shows the GPU, canvas resolution, fps mean and 1 % low (mean of the slowest 1 % of
frames) per path and an overall score (10 x geometric mean of the fps means). Dev only: `?bench&dev=1` on the dev server
also posts the results to `agents/verify/` (removed from `dist/`). `tools/verify/run.mjs bench|shots|eval` drives
headless Chromium (`--soft` = llvmpipe).

## Frame pacing

On a GPU the page draws on every requestAnimationFrame and skips one only if 4 frames are still queued. The old
scheme (skip while 2 fences are pending) dropped every other vsync because WebGL fence status only updates between
tasks: that was the ~20 ms frames at < 1.1 ms of GPU time on the Radeon. llvmpipe keeps 2 frames in flight and ~30 fps.

## Rebuild derived data

```
make -C tools/provenance run-frames      # frames, provenance, layout -> data/ (about 40 s)
node tools/attract_prep.mjs              # data/attract.json (3 s)
g++ -O2 -fopenmp -std=c++17 tools/font/mkatlas.cpp $(pkg-config --cflags --libs freetype2) -o mkatlas
./mkatlas /usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf data/font 64 12 && gzip -9 -f data/font/sdf.r8
```

## Limits

- Author mode (git blame) is gone: the blame data was made for the 48 old snapshots and is not rebuilt for frames.
  The colours say where a line first appeared, never who wrote it.
- Only the nearest lane's morph is drawn line by line in Now mode; the other lanes show their arriving frame.
- `tools/verify/check_data.mjs` still checks the old format 1 data in `data-v1/`.

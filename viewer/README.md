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
| T | attract mode (also after 2 minutes idle, `?idle=` seconds, 0 = never); any input exits |
| ♪ button, volume, M | the generative score (off by default), its volume, mute |
| bench button, `?bench` | the benchmark: five 15 s paths, then a score card; nothing is recorded |
| / B I L H | search (text, regex, path), bookmarks, minimap, lineage story, help |

The URL hash keeps the camera, clock, mode and presentation.

## Text rendering (three tiers per line, chosen per pixel)

- Near (>= 4.5 px per line on a GPU): glyphs from a 1024 x 768 SDF atlas of DejaVu Sans Mono (64 x 128 px cells,
  spread 12 px, `tools/font/mkatlas.cpp`), mipmapped (3 levels), anisotropic, sampled with explicit gradients from the
  continuous cell coordinate, anti-aliased by the screen-space derivative, 4-tap supersampled when small.
- Middle (>= 1.3 px per line): SDF token shapes: each run of non-space characters is a crisp word bar (x-height band),
  edges anti-aliased against the neighbouring cells.
- Far: impostors baked from the same shader (low resolution for every loaded wall in view, 16 px per column x 2048
  rows for the nearest ones, re-baked as the camera approaches), then per-file quads, then per-column strips.

## Attract mode

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

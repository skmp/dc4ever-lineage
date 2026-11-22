# nullDC lineage viewer

A WebGL2 fly-through of 48 snapshots (4,605,942 lines) of the nullDC family, from dc4ever to nullDC 3,
the ports, and the fpgadc hardware re-creation (every DreamSTer release r1..r6b pins a polly2-rtl and a
minicast wall; polly2-rtl r8/develop has its own lane because it shares no history with main). Each snapshot is a wall of readable code. X is time,
lanes are repos, and a file keeps the same place in every wall of its lane. See `../DESIGN.md`.

## Run

```
node tools/serve.mjs            # from the repo root; Node 22, no dependencies
```

The server binds 0.0.0.0:8742 and prints the URL to open from Windows, for example
`http://172.22.167.46:8742/`. WSL2 NAT does not forward `localhost`. It answers malformed or hostile
requests with 4xx and keeps running (`node tools/verify/serve_check.mjs`). The only write endpoint is
`POST /__report?name=bench-<tag>-<A..E>.json` (bench results from `?bench=all`, at most 4 MB of JSON,
200 files); start with `--no-report` to turn it off.

Use a desktop Chrome or Edge on Windows for the GPU path. In WSL Chromium the GPU path needs
`GALLIUM_DRIVER=d3d12`, and it works only in a headed browser (see Limits).

## Controls

| input | action |
|---|---|
| W A S D, Q / E | fly (Shift 4x, Ctrl 1/4x); the scroll wheel sets the speed |
| drag | look around |
| click / double-click / F | pin the tooltip / fly to the file under the cursor |
| click a file header bar | file panel: follow the file through every repo that has it, or "ride the street" |
| `[` `]` | same place in the lane's previous / next wall (the street through time) |
| `{` `}` | previous / next lane |
| G | overview |
| 1-6 | colour mode: origin, age, survival, diff vs previous, author (git blame: last changed by), repo of origin |
| P `,` `.` N | play / step / toggle Gallery and Now (live walls morphing on a moving plane) |
| `/` B M L H | search (path, text or regex), bookmarks, minimap, lineage story with tours, help |

The URL hash keeps the camera, mode and time, so you can share a view as a link.

## Rebuild derived data

```
python3 tools/snapshot.py agents/collect/snapshots.spec agents/collect/snapshots.json   # count the 48 snapshots (1 s)
make -C tools/provenance run                       # origins, identities, diffs -> data/ (about 6 s)
python3 tools/viewer_prep.py                       # data/layout.json.gz, linemeta.bin.gz, story.json (about 4 s)
python3 tools/blame.py                             # data/blame/: last changed by, handles and dates only (about 15 s)
g++ -O2 -std=c++17 tools/font/mkatlas.cpp $(pkg-config --cflags --libs freetype2) -o mkatlas
./mkatlas && gzip -9 -c data/font/sdf.r8 > data/font/sdf.r8.gz && rm data/font/sdf.r8
```

## Verify and measure

```
node tools/verify/check_data.mjs          # placement, streets, decoder parity, morph = diffs.json, lanes, release pins, blame (20 s)
node tools/verify/serve_check.mjs         # hostile requests against a throwaway server; it must answer and stay up (2 s)
tools/verify/all.sh                       # everything below in sequence, about 20 minutes, log in agents/verify/all.log
node tools/verify/run.mjs probe [--soft] --size 2560x1440      # load time, memory, picking, WSL-address access, COOP/COEP
node tools/verify/run.mjs shots [--soft] --size 2560x1440 --views far,rec,morph,fork,fpgadc
node tools/verify/run.mjs bench [--soft] --size 2560x1440 --paths A,B,C,D,E [--trace]
node tools/verify/morphstall.mjs [--gpu] --size 2560x1440      # Now-mode morph playback at close / near range
```

`--soft` runs headless Chromium on llvmpipe (ANGLE Vulkan on lavapipe). Without it the tools run the GPU
path: Chromium headed on a private Xvfb (`agents/tools/xvfb/fetch.sh` downloads and extracts it once, no
install) with Mesa d3d12 on the real GPU (`GALLIUM_DRIVER=d3d12`), so nothing appears on the desktop.
That display presents every frame with a software copy (XPutImage of 2560x1440), so frame intervals there
are bounded by the copy, not by the GPU; the GPU timer queries give the GPU's own time per frame.

For native numbers, open `http://<WSL address>:8742/?bench=all` in Windows Chrome. The page runs the five
20 s camera paths and posts `bench-gpu-<path>.json` to `agents/verify/` through the server. Add `&fixed=1`
to stay at quality step 0, `&clean=1` to hide the panels.

Debug URL parameters: `soft=0|1`, `scale=`, `t0=` (glyph threshold in px per line), `skip=labels,declutter,segs,…`,
`clean=1` (hide panels), `glprof=1` (log blocking GL calls), `ovdir=x,y,z` (overview direction).

## Performance notes

- Frame pacing: at most two frames in flight (fence per frame). Without it a browser without vsync, and
  llvmpipe at any rate, queues seconds of GPU work, and the next synchronous GL call waits for all of it.
  That was the cause of the 1-3 s stalls during Now-mode morphs on llvmpipe.
- Pipeline warm-up at load: every program and state combination is drawn once with no fragments, so
  lavapipe does not build pipelines (up to seconds each) mid-flight.
- Morphs are drawn by column runs (frustum-culled like the walls) and thin out adaptively (every 2nd, 4th,
  8th moving line, then no red ghosts); on llvmpipe lines in flight are bars, not glyphs.
- Map labels (lanes, walls, years, edges, pins) are decluttered on the CPU every frame (priority, then a
  line up or down, else hidden), drawn on top, and hidden when a wall stands between them and the camera.

## Limits

- The page is served over plain http at the WSL address, which is not a secure context. Because of
  that, `crossOriginIsolated` is false even though COOP and COEP are sent. Search does not need
  SharedArrayBuffer: the text worker keeps its own copy of the text.
- Author mode is "last changed by" (git blame at each snapshot), not "originally written by"; the origin
  colours answer the second. Lines blamed to an import commit (reicast 1c16bae, nulldc-360 0330292,
  nullDC4Wii e812c58, NotDC-PS3 5a32b94, minicast 580d7b8, the 2017 nullDCe archive, the 2019 dc4ever
  rebuild) say so in the tooltip: their authorship predates the import.

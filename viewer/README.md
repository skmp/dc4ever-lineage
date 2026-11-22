# nullDC lineage viewer

A WebGL2 fly-through of 40 snapshots (4,092,201 lines) of the nullDC family, from dc4ever to nullDC 3,
the ports, and the fpgadc hardware re-creation. Each snapshot is a wall of readable code. X is time,
lanes are repos, and a file keeps the same place in every wall of its lane. See `../DESIGN.md`.

## Run

```
node tools/serve.mjs            # from the repo root; Node 22, no dependencies
```

The server binds 0.0.0.0:8742 and prints the URL to open from Windows, for example
`http://172.22.167.46:8742/`. WSL2 NAT does not forward `localhost`.

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
| 1-6 | colour mode: origin, age, survival, diff vs previous, author (needs blame), repo of origin |
| P `,` `.` N | play / step / toggle Gallery and Now (live walls morphing on a moving plane) |
| `/` B M L H | search (path, text or regex), bookmarks, minimap, lineage story with tours, help |

The URL hash keeps the camera, mode and time, so you can share a view as a link.

## Rebuild derived data

```
python3 tools/viewer_prep.py                       # data/layout.json.gz, linemeta.bin.gz, story.json (about 4 s)
g++ -O2 -std=c++17 tools/font/mkatlas.cpp $(pkg-config --cflags --libs freetype2) -o mkatlas
./mkatlas && gzip -9 -c data/font/sdf.r8 > data/font/sdf.r8.gz && rm data/font/sdf.r8
```

## Verify and measure

```
node tools/verify/check_data.mjs                                   # placement, streets, decoder parity, morph = diffs.json
node tools/verify/run.mjs probe --soft                             # load time, memory, picking, WSL-address access, COOP/COEP
node tools/verify/run.mjs shots --soft --size 1600x900             # screenshots to agents/verify/shots/
node tools/verify/run.mjs bench --soft --size 1280x720 --paths A,B,C,D,E
```

For GPU numbers, open `http://<WSL address>:8742/?bench=all` in Windows Chrome. The page runs the five
20 s camera paths and posts `bench-gpu-<path>.json` to `agents/verify/` through the server. Add `&fixed=1`
to stay at quality step 0.

Debug URL parameters: `soft=0|1`, `scale=`, `t0=` (glyph threshold in px per line), `skip=labels,deco,…`,
`clean=1` (hide panels).

## Limits

- Headless Chromium in this WSL install has no GPU path. Mesa d3d12 offers no EGL configs on the
  surfaceless platform, there is no d3d12 Vulkan ICD, and there is no Xvfb. So headless runs use ANGLE
  Vulkan on lavapipe (llvmpipe), which takes the software path.
- The page is served over plain http at the WSL address, which is not a secure context. Because of
  that, `crossOriginIsolated` is false even though COOP and COEP are sent. Search does not need
  SharedArrayBuffer: the text worker keeps its own copy of the text.
- Author mode needs the optional `tools/blame.py` step (DESIGN 6.3), which was not built.

# lanes3: nullDCe-PSP (PSP-Archive/nulldce-psp)

The 20th lane: nullDCe's PSP port, restored to build by xiro and hlide in 2021. Six frames (import 95b5a20,
2021-02-04, then month frames to d6f1774, 2021-10), code edge from nullDCe 39c0550, copy edges from reicast,
flycast, nullDC and nulldc-360.

- Evidence and spec: [ancestry.md](ancestry.md)
- Tour: [tour-changes.md](tour-changes.md)
- Verification: [VERIFY.md](VERIFY.md) (scratch and shots in `verify/`)
- Implementer's shots: `shots/` and `shots-gpu.json`

Commits: b8c6fa6 (lane), 6406e33 (tour), 161d0e5 (shots), then the fix commit below.

## Fixes after verification

| finding | fix |
|---|---|
| major: tour had 100 shared + 43 unique | dropped flycast's "ARM dynarec block-linking stubs" pick (flycast 6 -> 5 unique); tour is 142 = 100 + 42 again; tour-changes.md updated |
| minor: rule (b) moves origins in 5 old lanes | documented rather than changed: FORMAT.md line semantics now say rule (b) spans sibling lanes; the story chapter says about 380 later Wii / PS3 / Wii U lines take origins this tree gave them first. frames.cpp is unchanged, so no frame data moved |
| minor: shot lanes:nullDCe+nullDCe-PSP misframed | shot and its shots-gpu.json entry removed |
| minor: copy edge from nullDC counted pre2008 lines | viewer_prep.py adds nullDC-pre2008 lines to nullDC / nullDCe edges only when the edge is not a copy edge. Two labels changed: nullDC -> nullDCe-PSP 25,968 -> 8,002, nullDC 2010 DSP -> devtools 308 -> 226. Code / import edges are unchanged |
| minor: REPORT.md missing | this file |
| minor: spec hue 62, story wording | ancestry.md spec now (320, 0.15); story says "xiro and hlide took ..." |

Checks: `python3 tools/verify/check_frames.py` 395 frames, 0 problems. `node tools/attract_candidates.mjs` and
`node tools/attract_prep.mjs` rerun; `python3 tools/viewer_prep.py` and `python3 tools/frames_manifest.py --sizes`
rerun (the frames.json changes are file sizes only; linemeta unchanged). `node tools/build_static.mjs`: dist 104 files,
22.8 MB. GPU smoke shot (far) loads with the new lane in the legend.

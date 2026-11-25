# Open findings from the stopped workflow's verifiers

## Verifier 1 (after build 1)

1. The GPU target (120 fps at 1440p with d3d12) is unverified. No headless GPU context exists on this machine; I tried 7 flag and environment combinations and every one gave no WebGL2, llvmpipe or SwiftShader. The only route is the ?bench=all page opened in Windows Chrome, which has not been run, so there are no agents/verify/bench-gpu-*.json files.

2. llvmpipe does not degrade gracefully during Now-mode morph playback at close and near range. At 2560x1440 with adaptive quality, I measured frames of 1.2 s to 2.9 s: the close camera had a max of 2924 ms, and the near camera had p99 1180 ms and max 1213 ms. The builder's own note (about 1.3 s p95 when full density is forced) points the same way. The adaptive quality steps do not prevent these second-long stalls.

3. Labels overlap in the far, fork and fpgadc views:
   - "dc4ever (C#)" sits on "nullDC"
   - "nullDCe (PSP / Wii / PS3 / PS2)" sits on "reicast"
   - the year ruler labels (2019 to 2026) pile into each other
   - "fpgadc: hardware re-creation, 2026" collides with "minicast (DreamSTer ARM side)", "dreamcast-devtools (TS)" and "shrike4-rtl (SH4)"
   - "wren7-rtl (ARM7)" sits on "caique-rtl (AICA)"
   - the edge labels "nullDC 2010 DSP -> devtools (322 lines)" and "reicast_cc (2021-12-22) -> nullDC 3" overlap, as do "nullDC 3 refsw -> dreamcast-tests" and "nullDC 3 -> wren7-rtl"
   - the minimap year ticks are garbled ("04 08 10", "14 16 18")

   The overview is cluttered and only partly informative.

4. The server crashes on one malformed request. On a throwaway instance on port 8798, `GET /%E0%A4%A` raised an uncaught URIError from `decodeURIComponent` in tools/serve.mjs `resolve()`, and the process exited. The server listens on 0.0.0.0, so any host on the network can kill it. The same applies to `POST /__report?name=..`: writeFileSync to a directory would throw EISDIR (I reasoned this from the code and did not run it). That endpoint also accepts unbounded, unauthenticated writes into agents/verify/.

5. The legend's "nearest wall" line goes stale. It is refreshed only on a random 10 % of HUD updates (`if (Math.random() < 0.1) legend()`). It read reicast-2013-import in the rec view, where the camera was at nulldc-2011-09, and in the fpgadc view, where the camera was at minicast-import.

6. polly2 is one lane, not two sub-lanes. Its snapshots are [r1, r6, r6b, r8-develop] in a single street, so the drawing implies r6b → r8 is a continuation, even though r8/develop has no common history with main (the merge-base is empty). The builder's note says polly2 has main and r8/develop sub-lanes, which the layout does not do.

7. DreamSTer releases r2, r2b, r3, r4 and r5 have no pin and no snapshot. Their polly2 commits are 7a70d24, 635ec79, 436372f and c22506c, and their minicast commits are 6fcc0e1, 585205b and 0998288. Only r1, r6 and r6b are marked, although the task names releases r1..r6b.

8. Every line tooltip prints "handle of the nullDC / reicast / nullDC 3 author: drk||Raziel (said "D R K Raziel")", including on flycast, nullDC4Wii, NotDC-PS3 and gligli lines, where it reads like an attribution. Author mode is a stub, because the blame step was not built.

9. Minor: the caique → NotDC-PS3 edge is drawn from caique-head (2d9898f), but its label says caique-rtl 5aa2376. The two copy edges into devtools give different line counts (322 from nullDC 2010, 371 from reicast) and draw on top of each other.

## Verifier 2 (after build 2; build 3 was stopped mid-fix, its edits are in `git stash list`)

1. The 120 fps target is missed on the real GPU, and the builder's explanation is wrong.
- Every path at 2560x1440 has frame p95 about 20 ms and p99 21-23 ms. The design targets are p95 <= 8.3 ms and p99 <= 11 ms.
- The frame times split in two: about 1/3 of frames take 0-4 ms and about 2/3 take 18-21 ms, while GPU time is under 1.1 ms (p95) and CPU time under 1 ms.
- The builder blames Xvfb copying every 1440p frame. That does not hold. On the same private Xvfb with GALLIUM_DRIVER=d3d12, ANGLE D3D12 and the same --disable-gpu-vsync --disable-frame-rate-limit flags, a full-size WebGL2 canvas that does a readPixels sync and a DOM HUD update every frame runs at 117 fps: p50 8.1 ms, p95 9.5 ms, p99 10.4 ms (agents/verify/adv2/baseline.mjs).
- Turning off preserveDrawingBuffer makes no difference. The extra 10+ ms comes from the viewer's own frame path. A likely suspect is the fence pacing in viewer/src/main.js: frame() returns early while two fences are pending.

2. Shared refsw C++ is dropped from provenance.
- polly2-rtl r8/develop tb/isp_setup/ref_copies_setup.h (12.6 KB) is a verbatim copy of refsw3 refcore. It is missing from the polly2-r8-develop snapshot.
- rules.is_generated's GEN_DATA regex (`\bgen\w*\.(cpp|c|py)\b`) matches "tools/gen/gen_setup_prog.cpp" in the file's comment header, so the file is classed as generated.
- As a result, the edge "refsw3 refcore -> polly2-rtl r8 tb/ (ref_copies*.h): 1,132 lines first seen in nullDC 3" undercounts the shared C++. Other hand-written headers that merely mention a generator would be dropped the same way.

3. The tooltip's keep count can exceed its denominator.
- minicast-r6b libswirl/hw/pvr/Renderer_if.cpp:100 ("#endif", origin nullDC-pre2008) reads "keep 46 of 41 possible later snapshots". The per-line keep and layout.possible use different rules.
- shrike4-head rtl/v1/v1_alu.sv:50 reads "keep 0 of 4 possible later snapshots", but shrike4 has no later snapshot and no descendant repo.

4. Labels still overlap geometry and other labels.
- fpgadc view (GPU, 1440p):
  - The label "nullDC 3 -> shrike4-rtl (SH4): new code, 0.8 % shared lines" is partly hidden by a wall ("shri e4").
  - Pink edge arcs cut through the "shrike4-rtl (SH4)", "dreamcast-devtools (TS)" and "refsw3 refcore ->" labels.
  - The "DreamSTer r6" and "DreamSTer r3" labels sit on the yellow pin bars.
- Year labels are out of order at the left edge: 2017 above 2019 above 2015 in both the far and fork views, and "2012" is cut off at the screen edge in the fork view.
- In the far view, "dc4ever (C#)" runs into the "2010" year label.
- In the rec bookmark view, the file header bar ("…rec_v1/driver.cpp 328 lines | same") lies under the HUD panel, at both 1440p (GPU) and 720p (llvmpipe).
- On the llvmpipe 720p far view, the dc4ever, nullDCe, shrike4, caique and wren7 lane labels are missing, and the left of the lineage sits under the minimap.

5. Minor: in the fpgadc gallery view, the timeline still reads "2014-01-27 reicast-r6", left over from the previous morph view, while the HUD shows gallery t=9.30.

Note: the owner's performance target is now >= 60 fps per path on the Radeon 8060S (not 120).

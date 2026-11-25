# Owner's follow-up requests (2026-11-22), to run after the current build / verify round is accepted

0. **Time-based frames: one snapshot per month, plus every release** (owner, 2026-11-22). Replaces the hand-picked ~40 snapshots.
   - For every lane, take one snapshot per calendar month in which the lane has commits (the last commit of that month), plus every release / tag.
   - Months with no commits produce no new frame; the lane holds its previous state.
   - dc4ever counts too: its per-file commits are stamped with file mtimes, so its frames are approximate. Mark them as such.
   - Time is the shared clock. The timeline plays month by month across all lanes at once, morphing each lane's wall from frame to frame. Releases are marked on the time axis and are jump targets.
   - Expect hundreds of frames, so the data and the provenance must scale:
     - store each frame as a delta against the previous frame of its lane (added / removed line ids), not as full copies;
     - compute provenance incrementally;
     - the viewer streams frames around the current time.
   - Keep the walls readable: show the frame at the current time, with nearby frames as ghosted walls, and full walls only for releases or when paused.
   - Report frame counts per lane and the data size.

1. **More vertical cards (snapshot walls).**
   - dc4ever: about 8-12 walls from its 138 per-file commits (2002-2005).
   - A denser timeline in every lane: reicast releases, nullDC svn points, DreamSTer r2-r5, nullDC4Wii / flycast milestones.
   - Recompute provenance and layout.
2. **Attract mode.**
   - Starts after idle, or on a key.
   - Automatic fly-through that zooms in to important / recurring lines across projects. Examples:
     - dc4ever 2005 `//ToDo : Check This [26/4/05]`
     - `//and here are the new ones :D` (30 snapshots)
     - `spg.cpp` `//Time to emulate that stuff correctly ;)`
     - famous files: SH4 recompiler, PowerVR renderer
   - Travels back and forth in the timelines and across lanes at fork points.
   - Shows a caption: the line, its origin, how far it spread.
   - Smooth camera; any input exits.
3. **Generative, evolving score** (Web Audio, original, synthesised; nothing copied or licensed).
   - Inspired by:
     - Satie, Gnossienne No. 4 (sparse modal piano);
     - Max Richter, On the Nature of Daylight (slow strings, late-resolving suspensions);
     - Philip Glass, Prophecies (additive organ arpeggios, pedal tones, wordless choir).
   - Driven by what is on screen: era, forks, code density, attract arc.
   - Seeded, crossfaded and in key.
   - Controls: ♪ toggle (off by default), volume, M to mute.
   - Verifier renders a few minutes offline and checks for clipping, clicks and key.
4. **Benchmark as a feature.**
   - A button / `?bench` runs the scripted fly-through and shows a score card on screen: GPU, resolution, fps per path, 1 % low, overall score.
   - Records nothing. The recording path stays a hidden dev-only flag and is not in the public build.
5. **Sharper text.** The near tier already uses an SDF atlas; the blur comes from the low-res atlas and the baked impostor tiers.
   - Use MSDF at a higher resolution, with mipmaps, anisotropic filtering and screen-space derivative AA.
   - Keep the SDF glyph tier out to a larger distance, under the budget.
   - Draw the middle tier as SDF token / word shapes, not blurred textures.
   - Bake far impostors at a higher resolution and refresh them as the camera approaches.
   - Verifier checks sharpness on screenshots at fixed distances.

**Performance target (owner):** 60 fps on the owner's machine, which is fine because it is a low-spec GPU (AMD Radeon 8060S, Chrome D3D12, 2560x1440). Baseline before the follow-up: paths A 99, B 51, C 106, D 48, E 16 fps mean (agents/verify/bench-gpu-2560x1440-*.json). Path E is the one to fix. The target is every path at >= 60 fps mean, with the 1 % low reported.

**Then:** publish the static build to nulldc.emudev.org/lineage/ (repo skmp/nulldc.emudev.org, branch master) and link it from index.html.

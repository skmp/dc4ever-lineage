export const meta = {
  name: 'nulldc-lineage-viz-v2',
  description: 'nullDC lineage viewer v2: monthly frames + releases, sharper SDF text, attract mode, generative score, benchmark score card; build, verify with fix rounds',
  phases: [
    { title: 'Data', detail: 'monthly frames + every release per lane, delta storage, incremental provenance' },
    { title: 'Build', detail: 'time-based frames, sharper SDF/MSDF text, attract mode, generative score, benchmark card, open verifier items' },
    { title: 'Verify', detail: 'data, sharpness, attract, audio render, perf, regressions; fix rounds' },
  ],
}
const W = '/home/skmp/projects/nulldc-lineage'
const COMMON = `
Project: the nullDC lineage 3D code viewer in ${W} (its own local git repo; commit freely there; never push anywhere; never write into
another repo). Read first: ${W}/DESIGN.md, ${W}/viewer/README.md, ${W}/agents/collect/REPORT.md, ${W}/agents/provenance/REPORT.md and,
above all, the owner's new goals in ${W}/agents/FOLLOWUP.md (items 0-5 plus the performance target and the publish note): they are the
spec for this round. The previous workflow was stopped during its third build round; that round's partial edits are in git stash (look, reuse what helps,
but start from HEAD). Both verifiers' findings are in ${W}/agents/verifier-findings.md: treat every item there as open unless you
confirm it fixed at HEAD (notably: the ~20 ms frame pacing on the real GPU from the fence logic in viewer/src/main.js, the GEN_DATA
regex wrongly dropping refsw ref_copies headers as generated, keep counts exceeding their denominator, overlapping labels / year
ruler / minimap, the HUD covering file headers, the stale timeline label, the server robustness, polly2 lanes, DreamSTer r2..r5,
the author tooltip).
Machine: WSL2, 16 cores / 32 threads, 62 GB; the owner views from Windows / LAN browsers (server binds 0.0.0.0; WSL NAT: no localhost
forwarding). Headless Chromium is ~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome (llvmpipe only; no headless GPU here).
GPU numbers come only from the owner's benchmark runs, saved under ${W}/agents/verify/bench-gpu-*.json (AMD Radeon 8060S, Chrome
D3D12, 2560x1440; also an Apple M2 at 60 Hz). Owner's target: >= 60 fps mean on every benchmark path on the Radeon 8060S.
Only public GitHub repos as sources (already mirrored in ${W}/repos/); no personal data beyond author handles in git; the owner's handle
drk||Raziel is said "D R K Raziel". The final viewer must be a static site (relative paths, no server dependency), because it will be
published at nulldc.emudev.org/lineage/ later by the main session, not by you; the recording benchmark path is dev-only and excluded
from that static build.`
const D = { type: 'object', properties: { frames: { type: 'string' }, size: { type: 'string' }, checks: { type: 'string' }, notes: { type: 'string' } }, required: ['frames', 'size', 'checks', 'notes'] }
phase('Data')
const data = await agent(`${COMMON}
ROLE: data. Implement FOLLOWUP item 0 (and item 1, which it subsumes): for every lane, a frame per calendar month with commits (the
month's last commit) plus every release / tag; dc4ever frames from its file-mtime history marked approximate; quiet months hold the
previous state. Store frames as per-lane deltas (added / removed line ids against the lane's previous frame) with periodic keyframes;
compute provenance incrementally (fast C++/OpenMP, extending the existing tool); keep identities / layout stable across frames so a file
stays in place. Regenerate ${W}/data/ (keep the old data under data-v1/ until the viewer is switched). Report frame counts per lane, total
size, build time, and spot checks (10 lines whose origin month you confirm with git log -S). Commit.`, { label: 'data', phase: 'Data', schema: D })
const B = { type: 'object', properties: { status: { type: 'string', enum: ['done', 'partial', 'blocked'] }, run: { type: 'string' }, perf: { type: 'string' }, notes: { type: 'string' } }, required: ['status', 'run', 'perf', 'notes'] }
const V = { type: 'object', properties: { verdict: { type: 'string', enum: ['accept', 'reject'] }, measured: { type: 'string' }, problems: { type: 'string' } }, required: ['verdict', 'measured', 'problems'] }
let b = null, v = null
for (let round = 1; round <= 3; round++) {
  phase('Build')
  b = await agent(`${COMMON}
Data result: ${JSON.stringify(data)}
ROLE: build. Implement FOLLOWUP items 0-5 in ${W}/viewer on the new data:
- time-based frames: one shared clock across lanes, month-by-month play / scrub, releases on the axis as jump targets, the current frame
  solid, neighbours ghosted, full walls for releases or when paused, streaming frames around the current time;
- sharper text: MSDF / high-res SDF atlas with mipmaps, anisotropy and derivative AA, the glyph tier kept to a larger distance, the
  middle tier as SDF token / word shapes instead of blurred impostors, far impostors baked at higher resolution and refreshed on approach;
- attract mode (idle or key): curated + computed list of important / recurring lines (longest survival, widest spread, famous files),
  smooth camera paths that zoom to readable range, travel back and forth through the frames that contain the line and across lanes
  at fork points, captions (line, origin month / repo, spread); any input exits;
- the generative score (Web Audio, original, synthesised; Satie Gnossienne 4 / Richter On the Nature of Daylight / Glass Prophecies as
  stylistic inspiration only, no melodies copied): piano / strings / organ / choir voices and convolution reverb, driven by era, forks,
  density and the attract arc; seeded, evolving, crossfaded, in key; toggle (off by default), volume, M; plus an offline render script
  (OfflineAudioContext or equivalent) that writes a few minutes to WAV for the verifier;
- the benchmark as a user feature: button / ?bench runs the scripted paths and shows a score card (GPU, resolution, fps mean and 1% low
  per path, overall score), recording nothing; the recording variant only behind a dev flag and stripped from the static build;
- every still-open item of the first verifier's list;
- a static build script that produces ${W}/dist/ (relative paths, no server needed, dev bench excluded).
Measure on llvmpipe (headless) at 1280x720 and 2560x1440; GPU numbers come from the owner's runs. Screenshots: far overview, a readable
close-up at 3 distances, a mid-morph frame, an attract caption. Commit.
${round > 1 && v ? 'The verifier rejected the previous round:\n' + v.problems + '\nFix every problem.' : ''}`, { label: `build#${round}`, phase: 'Build', schema: B })
  if (!b) break
  phase('Verify')
  v = await agent(`${COMMON}
Builder report: ${JSON.stringify(b)}
ROLE: adversarial verifier. From a clean checkout of ${W}, check:
(1) frames: per-lane counts match git (one per active month + every tag), deltas reconstruct each frame's files exactly (check 5 frames
    against git ls-tree / blob line counts), play / scrub / release jumps work;
(2) text sharpness: screenshots at fixed distances, readable well beyond the old glyph range, middle tier not blurred (compare against
    the old build at the same camera);
(3) attract mode: runs unattended for 10 minutes, captions correct for 5 lines against git, exits on input, no camera clipping;
(4) audio: render several minutes offline, check peak < 0 dBFS, no clicks at crossfades, stays in key, evolves (not a loop);
(5) benchmark card shows a score and records nothing in the static build (no network writes);
(6) the first verifier's open items are fixed (server robustness, labels, legend, polly2 lanes, DreamSTer r2..r5, tooltip, llvmpipe);
(7) perf: llvmpipe frame times reported; the owner's GPU runs under agents/verify/bench-gpu-* newer than the build, if any, meet >= 60
    fps per path; if there is none newer, mark the GPU check pending (it does not by itself fail the round);
(8) ${W}/dist/ works from a plain static server with no special headers.
Accept only if all hold (except a pending GPU check); otherwise list every problem.`, { label: `verify#${round}`, phase: 'Verify', schema: V })
  if (v && v.verdict === 'accept') break
}
return { data, build: b, verify: v }

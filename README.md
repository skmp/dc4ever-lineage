# nullDC lineage

> The note still asks us: check this. Twenty years.
> Someone was tired one Tuesday, set it aside.
> Nothing gets checked, and nothing disappears.
>
> It shipped to Wii and PlayStation with its peers,
> the one line every compiler casts aside.
> The note still asks us: check this. Twenty years.
>
> The forks grew streets; the streets grew engineers;
> a decade's patches swelled the codebase wide.
> Nothing gets checked, and nothing disappears.
>
> Tonight a camera, gliding past the piers
> of code, found it lit gold, a lamp inside.
> The note still asks us: check this. Twenty years.
>
> Three frames a second; each one fades and nears
> the next, two decades blurring side by side.
> Nothing gets checked, and nothing disappears.
>
> The loop is seamless: twenty twenty-six veers
> back into two thousand four, a turning tide.
> The note still asks us: check this. Twenty years.
> Nothing gets checked, and nothing disappears.
>
> — *Check This [26/4/05]*, a villanelle by Claude (2026-11-25) for `{//ToDo : Check This [26/4/05]`, a dc4ever
> to-do from a Tuesday in April 2005 that is still in nullDC 3 in 2026.

A 3D fly-through of the source code of the nullDC family through time, from dc4ever (2004) through nullDC, the
ports, reicast and flycast to nullDC 3 and the fpgadc hardware re-creation (2026): 380 frames in 17 lanes, every
line traced to where it first appeared.

**Live:** https://nulldc.emudev.org/lineage/

## What is here

| path | what |
|---|---|
| [viewer/](viewer/README.md) | the WebGL2 viewer: run it, controls, the clock, the tour, the score |
| [DESIGN.md](DESIGN.md) | the viewer's design: layout, colour modes, morph, LOD, data |
| [agents/collect/REPORT.md](agents/collect/REPORT.md) | the repos, snapshots and how the lanes are related |
| `tools/` | collection, provenance, frames, viewer data, the tour (`attract_candidates.mjs`, `attract_prep.mjs`, `attract_picks.json`), the offline score |
| `data/` | the viewer's data (frames, lanes, line text, layout, tour) |
| `agents/attract/` | tour curation: mined candidates (shared and single-lineage lines and code segments) |
| `agents/video/` | the lineage stream video: chronological 8K stills, the score on the video's timeline, a seamless H.265 loop |

## Run

```
node tools/serve.mjs [port]        # dev server (Node 22, no dependencies)
node tools/build_static.mjs        # the public build -> dist/
```

# Issue 2: headings leaking through the frames

Scripts and shots: `agents/render-fix/leak/` (lib.js = camera + per-title leak metric, scenes1.js, run1.js = lib+scenes,
split.mjs; shots/*.png, shots/summary-run1.out.json). Run: `node tools/verify/run.mjs eval --gpu --port 8743 --size 1920x1080
--js agents/render-fix/leak/run1.js > run1.out; node agents/render-fix/leak/split.mjs run1.out agents/render-fix/leak/shots` (~16 s).

Scenes: reicast lane (z0 86736, 15616 wide), frame 40 (2018-09); four cameras x gallery / clock:
street-side, street-low (beside the lane, z < z0, looking diagonally down the street of walls), front-close (in front of a
wall, looking up at its top edge), across (above, looking across reicast / flycast / fpgadc).

Leak metric (lib.js): for every wall title shown (TT.cur > 0.5), 9 x 3 sample pixels over its placed screen box; a ray
through each pixel; leak = the first solid wall hit (excluding the title's own) is nearer than the title's wall plane.

## Result

| view | titles shown | titles over a nearer solid wall |
|---|---|---|
| street-side gallery | 10 | 9 (6 at >= 37 % of the box, 2 at 100 %) |
| street-low gallery | 16 | 13 (3 at 100 %, 8 at >= 78 %) |
| front-close gallery | 2 | 1: the clock frame's STICKY title, 100 % over the nearer wall |
| across gallery | 14 | 3 (4-11 %) |
| street-side clock | 8 | 2 (one 89 %) |
| street-low clock | 13 | 10 (2 at 100 %) |
| front-close clock | 2 | 0 |
| across clock | 13 | 1 (11 %) |

Seen in shots/street-low-gallery.png: "reicast r8 2018-09 00ecf2f" and "reicast 2018-08 a8711e2" drawn over the face of
the front wall (2018-07); the stack of 2018-09..2021-12 titles drawn across the faces of the walls in front of them.
shots/front-close-gallery.png: the camera faces reicast 2018-08 a8711e2, and the big tier-2 title at the screen top is
"reicast 2018-09 239e178", the wall behind it, which is fully hidden.

What leaks: the wall titles (screen-space, `P.title`) mainly. The decluttered world labels (`labs`: lane titles, release
tags, edge labels, years, date notes) use the same kind of one-point test and can leak the same way (no case seen in
these shots). File cards (header bars, path / grown name labels) are depth-tested against the plates: no leak seen.
Wall text through ghost walls in Clock is by design (ghosts have no plate).

## Mechanism (viewer/src/main.js)

Titles and labels are drawn with the depth test off (main.js:1105, 1107: `gl.disable(gl.DEPTH_TEST)`), "over
everything"; occlusion is decided on the CPU:

1. Titles test ONE point, the anchor (main.js:449-458 `occluded`): the ray to (wall x, 4100, zw) where zw is the title's
   left end on the wall's top edge. Normally tx = ax, the wall's end corner, i.e. zw = z0 (or z1). All frames of a lane
   share z0 / z1, so for a camera beside the lane (z < z0) the ray to (x, 4100, z0) crosses every nearer frame's plane at
   z < z0, just outside it: the anchor is always on the silhouette edge and never occluded, while the box (200-300 px
   right of and above the anchor) lies over the nearer walls' faces. That is the street case (13 of 16 above).
2. Sticky titles are never tested (main.js:450 `if (c.sticky) return false;`): when the wall's top is above the screen,
   the title sticks to the screen top even if a nearer wall hides the whole wall (front-close-gallery: the clock frame
   is tier 2 and outranks the wall actually in view).
3. zw is interpolated linearly in screen space (main.js:436 `zw = za + (zb - za) * s`), not perspective-correct, so for
   an oblique wall the tested point is not the one under the title; and after the slide-right placement (main.js:467-470)
   c.tx moves but c.zw is not updated: the test is for a point up to hundreds of px from where the title is drawn.
4. Occluders are `occList` = solid walls with cam.x <= wall x (main.js:979-981): walls seen from behind are drawn
   opaque (plates for every solid wall in visList, no face culling) but do not occlude titles / labels.
5. Labels (declutter, main.js:364-372): the same one-point test at the label centre; a long label half behind a wall
   is drawn whole.

## Fix (proposed, not applied)

In layoutTitles and declutter, replace the anchor / centre test by a screen-sample test of the box actually placed:
invert VP once per frame; for each candidate that passed placement (as now, only those), cast rays through ~5 x 2 points
of its final rect; hidden if any sample's first hit among the opaque walls (occList plus solid visList walls behind the
camera, i.e. every wall that has drawn a plate) is nearer than the ray's crossing of the title's own wall plane (for
labels: the label's own plane / anchor distance). Remove the sticky bypass (the same test works: a nearer wall is hit
before the title's own wall). This also makes items 3 and 4 moot. Keeps the "hide, don't clip" look and the fades.
Cost: ~30 lines in main.js; CPU per frame ~ (placed titles + labels, < 100) x 10 rays x occluders (tens) < 0.1 ms.

Alternative (GPU): give each title a depth (clip z of its anchor on its wall, perspective-correct) and draw titles with
DEPTH_TEST on against the plate depth: exact per pixel, no CPU, but titles get cut where a wall edge crosses them
(could be combined: depth test + CPU fade).

Risks: the sample test hides more titles in street views (that is the point; the lane's frame at the clock may now be
hidden when another frame stands in front of it in Gallery: tier 2 should then fall back, or stay sticky only for the wall
the camera is actually facing). Far walls drawn as T5 quads skip their plate (main.js:1041) and do not occlude in the
depth buffer; the CPU test treats them as opaque, which matches what they look like (alpha 230).

# Tour changes (lanes3: nullDCe-PSP)

Picks: `tools/attract_picks.json`; built tour: `data/attract.json` (`node tools/attract_prep.mjs`). Scripts:
`scratch/remap_picks.py` (id remap by text, from lanes2), `scratch/compare_tour.py` (old vs new built tour: text,
unique flag, lanes per picked item).

## Summary

| | count |
|---|---:|
| picks before / after | 142 / 142 |
| texts unchanged (lines by text, segments line by line in order) | 142 / 142 (before the drop below; 141 old picks remain) |
| ids remapped (the new lane's 2021 lines sit before the 2026 lines in the text table, so later ids moved) | 29 |
| unique picks that became shared through the new lane | 0 |
| shared picks whose stops now include nullDCe-PSP | 66 |
| note updated | 1 (frame count) |
| added (new lane, unique) | 1 |
| dropped (to keep 42 unique) | 1 (flycast, ARM dynarec block-linking stubs) |
| after the rebuild: shared / unique picked items | 100 / 42 |

nullDCe-PSP holds none of the 42 old unique picks, so each is still in one lane only. To keep the tour at 100 + 42
after adding the new lane's pick, one flycast unique pick was dropped (flycast had 6; see Dropped). The 66 shared picks that gained the lane are nullDCe / nullDC lines carried by the
2009 PSP tree.

Notes that name lanes ("from nullDCe to flycast", "carried into reicast") are not exhaustive lists and stay as they
are. The only stated number that the new lane changed is the frame count of the maple DMA pick.

## Note updated

| old | new |
|---|---|
| Maple DMA: 'kinda wrong .. but meh'. Held in 272 snapshots, from nullDCe to flycast | Maple DMA: 'kinda wrong .. but meh'. Held in 278 snapshots, from nullDCe to flycast |

## Added

### One VFPU instruction for the vertex transform

- segment, 7 lines, lane nullDCe-PSP, 6 frames (every frame of the lane), unique, origin 95b5a20 (2021-02-04)
- note: "The 2021 restoration swapped nullDCe's four-line C matrix-vector multiply for one PSP VFPU op, vtfm4.q" (102 chars)
- `plugs/drkPvr/nullRend.cpp`, `Transform()`. In nullDCe 39c0550 the body is four C lines
  (`rv.x=mtx->x.x*vec->x + ...`). In the 2021 restoration it is inline VFPU assembly: load the matrix and the
  vector into VFPU registers, then one `vtfm4.q`.

```
            "lv.q    C000, 0  + %1\n"
            "lv.q    C010, 16 + %1\n"
            "lv.q    C020, 32 + %1\n"
            "lv.q    C030, 48 + %1\n"
            "lv.q    C100, %2\n"
            "vtfm4.q C110, M000, C100\n"
            "sv.q    C110, %0\n"
```

Considered and not taken: `//No hay memoria libre!!! = There is no free memory!` in `psp/main.cpp` RAMAMOUNT(), a
malloc probe loop. It is human, but it reads like a pasted PSP homebrew snippet with Spanish names (`shSalir`) of
unknown origin. The rest of the lane's unique candidates are PSP controller mapping, register lists, logging and a
VMU image byte array.

## Dropped

### ARM dynarec block-linking stubs (flycast, unique, segment)

- note: "flycast's ARM32 dynarec: three LinkBlock stubs funnel into one shared stub that calls rdv_LinkBlock"
- Dropped after verification (VERIFY.md major 1) so the tour stays at 100 shared + 42 unique. flycast and NotDC-PS3
  had 6 unique picks each; this was the driest of them (generated stub plumbing, no comment). flycast keeps 5.

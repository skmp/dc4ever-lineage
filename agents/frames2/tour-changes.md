# Tour changes (frames2: denser frames, file last-change dates)

Picks: `tools/attract_picks.json`; built tour: `data/attract.json` (`node tools/attract_prep.mjs`, about 20 s with
the git queries). Scripts: `scratch/remap_picks.py` (id remap by text, from lanes3), `scratch/compare_tour.py` (old
vs new built tour: text, unique flag, lanes per picked item), `scratch/date_examples.py` (old frame dates vs new file
dates).

## Summary

| | count |
|---|---:|
| picks before / after | 142 / 142 |
| texts unchanged (lines by text, segments line by line in order) | 142 / 142 |
| ids remapped (the text table is rebuilt in time order; 1,080 more frames put lines in new places) | 142 |
| unique picks that became shared | 0 |
| shared / unique picked items after the rebuild | 100 / 42 |
| picked items whose lane list changed | 1 (gained flycast and nulldc3, still shared) |
| picked items whose "first seen" lane changed | 1 (see below) |
| notes updated | 1 (snapshot count) |
| median frames per picked item ("held by N frames") | 145 -> 386.5 |

The lane-list change: "Early nullDC wonders if a decoded switch list would be much faster. Asked again in several
lineages" now also holds flycast and nulldc3 (the line shows up in intermediate commits that the monthly frames
skipped). Its note says "several", so it stays.

Notes that name lanes or say "several" / "four lineages" were checked against the new lane lists; none changed except
the one above. "Held in N snapshots" is the only stated frame count.

## Note updated

| old | new |
|---|---|
| Maple DMA: 'kinda wrong .. but meh'. Held in 278 snapshots, from nullDCe to flycast | Maple DMA: 'kinda wrong .. but meh'. Held in 571 snapshots, from nullDCe to flycast (568 after the fix round, see below) |

## "First seen" corrected for one segment

"shil: one header, three jobs" (shil_canonical.h) used to read "first seen in dc4ever 2004-04-24". Its anchor line is
`/*`, a trivial line with no origin of its own; the old origin was a misread keep value (the viewer decoder read the
keep array two bytes off for frames with an odd line count, see REPORT.md), which made `/*` look non-trivial. The
anchor now falls back to the segment's first distinctive line ("This is a header file that can create"): first seen
in nullDCe, file last changed 2008-2010 (dated 2009-10-16), `dc/sh4/rec_v2/shil_canonical.h` at 39c0550.

## Computed (non-picked) items

The 16 computed lines are re-ranked by frames held, which changed with the new frames (and with the corrected keep
decoding, which decides which lines are trivial). Four left, four came in:

- gone: `///this file is here to make up for C++'s limitations`, `//skip the aggregated opcodes`,
  `msgboxf("vramlock_Lock_64: end_offset64>(VRAM_SIZE-1) ...`, `//misses delay , and stop/start implementation`
- new: `//quite a bit padding here :)`, `printf("Size: %-6ld  ",track.length);`, `if (stricmp( &file[len-4],".gdi")==0)`,
  `//convert our nice toc struct to dc's native one :)`

A GPL boilerplate line ("* (at your option) any later version.") would have entered; the boilerplate filter now
includes "any later version".

## Dates

Every caption date is now the last change of the file holding the item as of that frame. 2,218 stop dates in the
built tour (all items), 1,315 of them differ from the frame date; 215 take an override date range (nullDCe 39c0550
2008-2010, reicast 1c16baeb0 2012-2013) and 52 are dc4ever approximate dates. Examples are in REPORT.md.

## Fix round

The big-commit churn now leaves out generated files (frames 1,475 -> 1,472, all changes in flycast / reicast /
nullDC4Wii). Picks remapped again by text (`scratch/remap_picks.py`): 142 items, 27 ids remapped, 0 missing;
`compare_tour.py`: 142 / 142 picks, 100 shared / 42 unique, no text, unique or lane-list changes. Maple DMA note
571 -> 568 snapshots (its item's frame count). File items' "first:" date is now the earliest stop in time ("the
PowerVR renderer interface": nullDCe, file last changed 2008-2010 (dated 2009-10-16), was nullDC 2010-05-09).

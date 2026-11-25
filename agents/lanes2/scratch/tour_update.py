#!/usr/bin/env python3
"""tour_update.py: lanes2 tour changes to tools/attract_picks.json (ids were checked stable by remap_picks.py).
Drops the six nullDC4Wii unique picks that nullDC4WiiU now also holds (the shared pool is full at 100), adds six new
unique picks, and updates lane / frame counts in notes that the new lane made stale. Writes the change list as JSON."""
import json, re, sys
P = json.load(open('tools/attract_picks.json'))
DROP = {"Why 0xDEADC0D3 had to die", "pack(4), not pack(1): Broadway's load-hit-store", "IDLE_KAMUI: skipping the Kamui2 vsync wait",
        "RENDER_DELAY: why MvC2 needs slow interrupts", "Dreamcast RAM written over IOS's buffers", "IDLE_SHINOBI: paying off the idle task's debt"}
ADD = [
 {"pool": "unique", "kind": "segment", "ids": [762151, 762152, 762153, 495555, 762154, 762155, 762156, 762157],
  "title": "Why the VMU saves came out empty",
  "note": "Wii U port: devices are set up twice, so a file held open made the second open fail and saves were 0 bytes"},
 {"pool": "unique", "kind": "segment", "ids": [762206, 762207, 762208, 762209, 27781, 762210, 762211, 2926, 371582, 371583, 1013],
  "title": "64-bit reads: which word goes first",
  "note": "Swapped words in 64-bit fmov copies turned the BIOS soft-reset code into garbage (MvC2 after game over)"},
 {"pool": "unique", "kind": "segment", "ids": [762687, 762688, 762689, 762690, 762691, 762692, 762693, 762694, 762695],
  "title": "Slower and lower instead of stuttering",
  "note": "Wii U sound bends its resampling to the emulator's real speed; stop-and-restart at ~76% was unbearable"},
 {"pool": "unique", "kind": "segment", "ids": [738234, 738235, 738236, 738237, 738238, 738239, 738240, 738241, 738242, 738243, 738244, 738245, 738246, 738247, 738248, 738249, 738250, 738251, 738252],
  "title": "HarissaDC writes its own flash",
  "note": "No Sega BIOS: the HLE BIOS formats the flash, writes '00000Dreamcast' and counts the clock from 1950"},
 {"pool": "unique", "kind": "segment", "ids": [738615, 738616, 738617, 738618, 738619, 738620, 738621, 738622, 738623, 738624, 738625, 738626, 11, 738627, 738628, 738629, 738630, 738631, 738632, 738633, 738634, 738635, 738636, 738637, 738638, 738639, 738640, 738641, 738642, 738643],
  "title": "Booting with no BIOS",
  "note": "HarissaDC's HLE BIOS points the system call vectors at traps and sets the SH4 registers by hand"},
 {"pool": "unique", "kind": "segment", "ids": [624947, 624948, 624949, 624950, 624951, 624952, 624953],
  "title": "Sprite atlases and the 0xDEADBEEF sentinel",
  "note": "Texture caches checked one sentinel word; SF3 and Guilty Gear redraw atlas tiles, so stale tiles stayed"},
]
W = 'one two three four five six seven eight nine ten eleven twelve'.split()
# note number updates: (exact old note substring, new substring), only where the number equalled the old lane / frame count
FIX = json.load(open(sys.argv[1]))   # [[title or text key, old, new]]
log = {'dropped': [], 'added': [], 'notes': []}
items = []
for it in P['items']:
    if it['kind'] == 'segment' and it.get('title') in DROP: log['dropped'].append(it); continue
    for old, new in FIX:
        if it.get('note') and old in it['note']:
            log['notes'].append({'old': it['note'], 'new': it['note'].replace(old, new)}); it['note'] = it['note'].replace(old, new)
    items.append(it)
for a in ADD:
    assert len(a['note']) < 110, (len(a['note']), a['note']); items.append(a); log['added'].append(a)
P['items'] = items
assert len(log['dropped']) == 6
json.dump(P, open('tools/attract_picks.json', 'w'), indent=0)
json.dump(log, open(sys.argv[2], 'w'), indent=1)
print(len(items), 'items;', len(log['notes']), 'notes updated')

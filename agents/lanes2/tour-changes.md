# Tour changes (lanes2: nullDC4WiiU and HarissaDC)

Picks: `tools/attract_picks.json`; built tour: `data/attract.json` (`node tools/attract_prep.mjs`). Scripts: `agents/lanes2/scratch/remap_picks.py` (id remap by text), `tour_update.py` (the edits below), machine-readable log `scratch/tour_changes.json`.

## Summary

| | count |
|---|---:|
| picks before / after | 142 / 142 |
| kept as they were (id, text, title, note) | 121 |
| kept, ids remapped | 0 (every pick's text sits at the same id in the rebuilt text table; checked line by line, segments in order) |
| kept, note count updated (the new lane made the stated number stale) | 15 |
| moved unique -> shared | 0 (the shared pool already had its 100) |
| replaced (unique pick now also in nullDC4WiiU) | 6 |
| after the rebuild: shared / unique picked items | 100 / 42 |

The six nullDC4Wii unique picks that became shared are all comments nullDC4Wii wrote before 1459ccb, so the git fork nullDC4WiiU carries them too (stops now in nullDC4Wii and nullDC4WiiU). The shared pool was full, so each was replaced by a new single-lane pick: three from nullDC4WiiU, two from HarissaDC, one from nullDC4Wii (post-fork code, so nullDC4Wii keeps a unique pick). Candidates came from the re-mined `agents/attract/uniq_*.jsonl`; `tools/attract_candidates.mjs` now accepts a line or segment held in every frame of a lane with fewer than 6 frames (both new lanes have 4), otherwise unchanged. HarissaDC has no comments beyond its licence headers, so its picks are code.

## Replaced

### Why 0xDEADC0D3 had to die -> Why the VMU saves came out empty

- removed (segment, 9 lines, ids 371544..): note "nullDC4Wii: unmapped reads returned 0xDEADC0D3; a game added an offset and wrote to 0xDEADE5F3"
- added (segment, 8 lines, lane nullDC4WiiU, 4 frames, unique): note "Wii U port: devices are set up twice, so a file held open made the second open fail and saves were 0 bytes" (106 chars)

```
        // The devices get set up twice and the first set is never freed, so a file held open here made the
        // second open fail on a console (Cemu allows it), leaving empty 0-byte saves. Read it and close it;
        // a missing or short file becomes a full-size blank one, so each write can seek into it.
        file=0;
        FILE* f=fopen(path,"rb");
        const size_t got=f ? fread(flash_data,1,sizeof(flash_data),f) : 0;
        if (f) fclose(f);
        // an all-zero file is unformatted: format it (Soulcalibur reports no free space otherwise)
```

### pack(4), not pack(1): Broadway's load-hit-store -> 64-bit reads: which word goes first

- removed (segment, 15 lines, ids 445197..): note "Wii PowerPC: pack(1) made every TA float bounce through the stack, a load-hit-store stall per read"
- added (segment, 11 lines, lane nullDC4WiiU, 4 frames, unique): note "Swapped words in 64-bit fmov copies turned the BIOS soft-reset code into garbage (MvC2 after game over)" (103 chars)

```
            // 64-bit: two consecutive 32-bit reads, in the order the direct path below gives. On a big-endian
            // host that puts the word at addr in the high half (the JIT takes it as the first register of the
            // pair); the little-endian order here swapped every pair of words that a 64-bit fmov copied from the
            // boot ROM, and the BIOS's soft-reset code, copied that way, ran as garbage (MvC2 after game over).
#if HOST_ENDIAN == ENDIAN_BIG
            T rv = (T)((u64)_vmem_RF32[id / 4](addr) << 32);
            rv  |= (T)_vmem_RF32[id / 4](addr + 4);
#else
            T rv = (T)_vmem_RF32[id / 4](addr);
            rv  |= (T)((u64)_vmem_RF32[id / 4](addr + 4) << 32);
#endif
```

### IDLE_KAMUI: skipping the Kamui2 vsync wait -> Slower and lower instead of stuttering

- removed (segment, 17 lines, ids 566671..): note "Detects the Kamui2 vsync wait loop at compile time; on PS3, Ikaruga went from 77.2% to 87.3% speed"
- added (segment, 9 lines, lane nullDC4WiiU, 4 frames, unique): note "Wii U sound bends its resampling to the emulator's real speed; stop-and-restart at ~76% was unbearable" (102 chars)

```
// Sound on the Wii U: the AICA's 44.1 kHz stereo output (wii_audio_push_sample, emulator thread) played by two
// AX voices, left and right, each looping over a ring of 16-bit samples that AX resamples to 48 kHz and sends
// to the TV and the GamePad. The emulator writes ahead of the play position in small cache-flushed blocks.
// The AX frame callback (every 3 ms) tracks the play position and steers the resampling ratio by how much is
// queued, so playback follows the rate the emulator really produces: below full speed the sound runs a little
// slower and lower instead of stuttering (stop-and-restart at ~76% speed was unbearable on a console). Only a
// real stall (a disc load) empties the ring; the voices then stop and start again once some sound is back.
// A full ring makes the emulator wait, which is what holds it to real speed (on a console it otherwise ran at
// about 170%); it never waits long, so a stalled voice can't hang it.
```

### RENDER_DELAY: why MvC2 needs slow interrupts -> HarissaDC writes its own flash

- removed (segment, 9 lines, ids 413915..): note "Raising TA/render IRQs instantly breaks MvC2's frame pacing, so the delays copy real hardware timing"
- added (segment, 19 lines, lane HarissaDC, 4 frames, unique): note "No Sega BIOS: the HLE BIOS formats the flash, writes '00000Dreamcast' and counts the clock from 1950" (100 chars)

```
    static const char regionChar[3] = { '0', '1', '2' };
    u8 factory[16], syscfg[FLASH_BLOCK];
    u32 i, now;
    for (i = 0; i < FLASH_SIZE; i++) buf_w8(g_flash, i, 0xFF);
    memcpy(factory, "00000Dreamcast  ", 16);
    factory[2] = (u8)regionChar[s_region];
    factory[3] = '0';
    flash_write_bytes(0x1A000, factory, 16);
    flash_write_bytes(0x1A0A0, factory, 16);
    for (i = 0; i < 8; i++) buf_w8(g_flash, 0x1A056 + i, (u8)(0x10 + i * 0x11));
    format_partition(2);
    format_partition(3);
    format_partition(4);
    memset(syscfg, 0xFF, sizeof(syscfg));
    now = host_time() + 631152000u;
    syscfg[2] = (u8)now;
    syscfg[3] = (u8)(now >> 8);
    syscfg[4] = (u8)(now >> 16);
    syscfg[5] = (u8)(now >> 24);
```

### Dreamcast RAM written over IOS's buffers -> Booting with no BIOS

- removed (segment, 10 lines, ids 441342..): note "MEM2 bump allocs ran past Arena2Hi; whether a USB drive was mounted decided if a game died"
- added (segment, 30 lines, lane HarissaDC, 4 frames, unique): note "HarissaDC's HLE BIOS points the system call vectors at traps and sets the SH4 registers by hand" (95 chars)

```
    for (i = 0; i < 0x10000; i += 4) mem_write32(0x8C000000u + i, 0xFFFFFFFFu);
    set_vector(VEC_SYSINFO, TRAP_SYSINFO);
    set_vector(VEC_FONT, TRAP_FONT);
    set_vector(VEC_FLASH, TRAP_FLASH);
    set_vector(VEC_GDROM, TRAP_GDROM);
    set_vector(VEC_GDROM2, TRAP_GDROM2);
    set_vector(VEC_MISC, TRAP_MISC);
    mem_write16(TRAP_IDLE, SH4_HLE_TRAP_OPCODE);
    write_sysinfo();
    memset(&s_gd, 0, sizeof(s_gd));
    s_gd.curFad = 150;
    reset_mode();

    sh4_set_sr(0x400000F0u);
    g_sh4.t = 1;
    sh4_set_fpscr(0x00040001u);
    R[15] = 0x8D000000u;
    g_sh4.gbr = 0x8C000000u;
    g_sh4.vbr = 0x8C000000u;
    g_sh4.ssr = 0x40000001u;
    g_sh4.spc = 0x8C000776u;
    g_sh4.sgr = 0x8D000000u;
    g_sh4.dbr = 0x8C000010u;
    g_sh4.pr = 0xAC00043Cu;
    g_sh4.fpul = 0;
    g_dmac.dmaor = 0x8201;
    mem_write32(0xA070289Cu, 0x48);
    mem_write32(0xA07028A8u, 0x18);
    mem_write32(0xA07028ACu, 0x50);
    mem_write32(0xA07028B0u, 0x08);
```

### IDLE_SHINOBI: paying off the idle task's debt -> Sprite atlases and the 0xDEADBEEF sentinel

- removed (segment, 16 lines, ids 566689..): note "A JIT rule spots the Shinobi library's idle task walk; PS3 tests took Garou fights to 60 fps"
- added (segment, 7 lines, lane nullDC4Wii, 6 frames, unique): note "Texture caches checked one sentinel word; SF3 and Guilty Gear redraw atlas tiles, so stale tiles stayed" (103 chars)

```
// The renderer's persistent texture caches validate a texture by its FIRST
// word (the 0xDEADBEEF sentinel). A game that updates part of a texture - a
// sprite atlas getting this frame's animation tiles, as Street Fighter III and
// Guilty Gear do - leaves that word alone, so the stale tiles keep being drawn.
// normal_plus stamps every VRAM page a write lands on with the current render
// epoch instead; the renderer re-decodes a texture when any page under it
// carries a stamp at least as new as the render that decoded it.
```

## Notes updated

Only numbers that equalled the old count of lanes (or frames) holding the item and that the new lane changed. Pre-existing mismatches between a note and the data were left as they were (see below).

| old | new |
|---|---|
| Early nullDC plugin header vents at MSVC warnings; the outburst still ships in 9 lineages | Early nullDC plugin header vents at MSVC warnings; the outburst still ships in 10 lineages |
| nullDC's AICA register map pads out to the far registers; the comment reached 9 lineages, even TS devtools | nullDC's AICA register map pads out to the far registers; the comment reached 10 lineages, even TS devtools |
| Keeping x86 and SH4 float rounding modes in sync: a trick early nullDC used, still in 9 lineages | Keeping x86 and SH4 float rounding modes in sync: a trick early nullDC used, still in 10 lineages |
| Above a list of Holly error interrupt bits, nullDC asks whether some are missing; still asked in 9 lineages | Above a list of Holly error interrupt bits, nullDC asks whether some are missing; still asked in 10 lineages |
| GD-ROM ATA soft reset: the DRV bit is preserved, and nobody knows what it does. Same line in 7 lineages | GD-ROM ATA soft reset: the DRV bit is preserved, and nobody knows what it does. Same line in 8 lineages |
| End of the Logitech G-series block inside the maple device code; from nullDCe 2009, now in 7 lineages | End of the Logitech G-series block inside the maple device code; from nullDCe 2009, now in 8 lineages |
| Config docs still use "nullDC v1.0.0 Private Beta 2" as the example version string, in 7 lineages | Config docs still use "nullDC v1.0.0 Private Beta 2" as the example version string, in 8 lineages |
| No internet and bored, so AICA HLE work began. This line lived on in 5 lineages, NotDC-PS3 among them | No internet and bored, so AICA HLE work began. This line lived on in 6 lineages, NotDC-PS3 among them |
| Early nullDC wonders if a decoded switch list would be much faster. Asked again in 6 lineages | Early nullDC wonders if a decoded switch list would be much faster. Asked again in 7 lineages |
| Maple DMA: 'kinda wrong .. but meh'. Held in 267 snapshots, from nullDCe to flycast | Maple DMA: 'kinda wrong .. but meh'. Held in 272 snapshots, from nullDCe to flycast |
| AICA hack found in Roadsters (also Toy cmd): 'too tired to debug'. 2005-2008 code, kept in five lineages | AICA hack found in Roadsters (also Toy cmd): 'too tired to debug'. 2005-2008 code, kept in six lineages |
| Inside the drkPvr TA FIFO splitter: early nullDC venting at C++, kept in 5 lineages | Inside the drkPvr TA FIFO splitter: early nullDC venting at C++, kept in 6 lineages |
| TA polygon strips split across FIFO writes, from pre-2008 drkPvr, shared by four lineages | TA polygon strips split across FIFO writes, from pre-2008 drkPvr, shared by five lineages |
| MDS image reader: don't load the whole file before checking, 'can be deadly for .nrg/.iso'. In 4 lineages | MDS image reader: don't load the whole file before checking, 'can be deadly for .nrg/.iso'. In 5 lineages |
| 'hack Katana wait': EmptyAICA fakes a value games wait on (found in Roadsters, Toy Cmd). 5 lineages | 'hack Katana wait': EmptyAICA fakes a value games wait on (found in Roadsters, Toy Cmd). 6 lineages |

## Left as they were (pre-existing, not caused by the new lanes)

These notes state a lineage count that already differed from the item's lanes in the old tour (segments count the lanes where the whole run matches, which can differ from where a single line is): "The ARM7's view of AICA ... Shared by 7 lineages" (8 lanes before, 9 now), "SH4 opcode list entries for FSCA ... still in six lineages" (4), "GD-ROM command done ... in 5 lineages" (7 -> 8), "GD-ROM ATA_SPI_PACKET ... in 6 lineages" (7 -> 8), "SH4 shlr interpreter op ... five lineages kept" (2).

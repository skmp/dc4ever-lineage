# Frame data format (data/, format 2)

FOLLOWUP item 0: every lane has a frame per calendar month with commits plus every release / tag, stored as
per-lane deltas with periodic keyframes. The 48-snapshot data (format 1) is kept in `data-v1/` until the viewer
is switched; nothing in `data/` refers to it.

Build: `make -C tools/provenance run-frames` (about 40 s: frame selection 5 s, provenance 21 s, layout 6 s).
Check: `python3 tools/verify/check_frames.py` decodes every frame and compares every file with git (15 s).
Spot checks against `git log -S`: `python3 agents/frames/spotcheck.py` -> `agents/frames/spotcheck.txt`.

## Pipeline

| step | tool | output |
|---|---|---|
| frame selection | `tools/frames.py` (lane table, forks, imports, DreamSTer pins, rules.py) | `agents/frames/frames.json`, `agents/frames/work/*.tsv` |
| provenance + deltas | `tools/provenance/frames.cpp` (C++/OpenMP, incremental) | `data/text/`, `data/lanes/`, `data/identities.json.gz`, `frames.core.json` |
| index | `tools/frames_manifest.py` | `data/frames.json` |
| layout | `tools/viewer_prep.py` | `data/layout.json.gz`, `data/linemeta.bin.gz`, `data/story.json` |

## Frames

A lane is one line of development: a repo and a tip ref (`tools/frames.py` LANES). Its frames, in time order:

- `month`: the last commit (first-parent chain of the tip, committer date) of every month with commits. A month
  whose counted source equals the previous frame's is dropped: the lane holds its previous state.
- `tag`: every release tag of the lane (kept even when the source did not change).
- `pin`: DreamSTer release pins (the polly2-rtl / minicast submodule commits of DreamSTer r1 .. r6b).
- `fork`: a commit another lane was forked or imported from, so the child's parent state is an exact frame.
- `import`: the import commit of an imported snapshot (reicast 1c16baeb0, nullDC4Wii e812c58, ...).
- Lanes that share git history with a parent repo start after the last shared commit (flycast after reicast
  239e17822, 2018-09-03; nullDC 3 after reicast 95b673698, 2021-12-22).
- dc4ever's history is one commit per file at its file mtime (rebuilt 2019): its frames have `approx: true`.
- nullDCe's recovered archive (committed 2017-11-20) is dated 2009-10-16 (`date_range` 2008-2010, `commit_date`).
- Frame `virt` (`frames.json` "virt", `virtual: true`, 2008-12-31) is not a tree: it is the origin "nullDC-pre2008".

The global frame index `i` orders all frames by (date, lane order, lane-local index). Origins are frame indices,
so "earlier origin" = smaller index.

## data/frames.json

```jsonc
{
  "format": 2, "chunk_lines": 65536, "raw_lines": 796452, "norm_lines": 718706, "text_chunks": 13,
  "identities": 5079, "virt": 13,
  "lanes": [{
    "name": "flycast", "repo": "flyinghead_flycast", "tip": "master",
    "frames": [86, 92, ...],                         // global frame indices, in order (lane-local k = position)
    "parents": [{"lane": "reicast", "kind": "code", "frame": 82, "commit": "239e1782..."},
                {"lane": "reicast", "kind": "merge", "frame": 94, "commit": "a6b773a2..."}],
    "shared_until": "239e1782...",                   // last commit shared with the parent repo, or null
    "desc": [7],                                     // lane ids counted for survival from this lane (keep)
    "anc": [[7, -1], [6, 94], [1, 28], [3, 14]],     // ancestry for origins: (lane, cutoff frame; -1 = own lane)
    "chunks": [[86, 128, 501022], ...]               // [first frame, last frame, bytes] of data/lanes/<lane>/cNNN.*
  }],
  "frames": [{
    "i": 86, "lane": "flycast", "k": 0, "date": "2018-10-20", "commit": "84ab237b09e3",
    "kinds": ["month"], "tags": ["v1.0"], "labels": ["..."],          // only when present; DreamSTer pins tag as "DreamSTer r6"
    "approx": true, "date_range": "2008-2010", "date_note": "...", "commit_date": "2017-11-20",   // when they apply
    "key": true, "chunk": 0, "files": 314, "lines": 102979,
    "d": [102978, 1, 0],                             // kept, added, removed lines vs the lane's previous frame (first frame: vs fork parent)
    "by_lane": {"reicast": 60123, ...},              // non-trivial lines by origin lane ("nullDC-pre2008" = virt)
    "by_year": {"2014": 1234, ...}                   // non-trivial lines by origin year
  }],
  "releases": [{"tag": "r1", "date": "2026-07-17", "dreamster": "d87e716", "polly2": "be391db", "minicast": "697f565"}],
  "possible": [[...per lane...] per origin frame],  // survival denominator, see below
  "files": {"lanes/flycast/c000.bin.gz": 412345, ...}, "total_bytes": 22010843
}
```

Lane order (lane id = position): dc4ever, nullDC, nulldc-360, nullDCe, nullDC4Wii, NotDC-PS3, reicast, flycast,
nulldc3, minicast, polly2, polly2-r8, devtools, dreamcast-tests, shrike4, caique, wren7.

## Text

`data/text/lines-NNN.txt.gz`: distinct raw lines (`\r` stripped), `\n`-separated, 65536 per chunk, in order of first
appearance in time, so the chunks a time window needs are few. A line id is its global position.
`data/linemeta.bin.gz`: 2 bytes per line id (indent, len | comment << 7), as before.

## Lane chunks: data/lanes/<lane>/cNNN.json.gz + cNNN.bin.gz

A chunk is one keyframe followed by the delta frames up to the next keyframe. A keyframe is written at a lane's
first frame, after 24 delta frames, or when the lines inserted since the last keyframe exceed 0.6 x the lane's
lines. To show frame f, fetch its chunk (`frames[f].chunk`) and apply its frames from the keyframe up to f.

JSON:

```jsonc
{"lane": "flycast", "chunk": 0, "frames": [
  {"f": 86, "key": true, "off": 0, "nw": 0, "nl": 102979, "ops": [op, ...]}, ...]}
```

An op is an array:

- `["D", ident, path, n]`: the file left the lane (delta frames only).
- `[kind, ident, path, n, status, dom, kept, added, removed, from, ns, ni]` with kind
  - `"K"`: keyframe file; carries all its `n` lines (`ni == n`, `ns == 0`). A keyframe lists every file.
  - `"A"`: file added to the lane; carries all its lines.
  - `"E"`: existing file (same identity) changed or moved; `ns` script words edit the previous version and `ni`
    inserted lines are carried.
  - Files not named in a delta frame are unchanged (status `same`).
  - `status`: new / same / edit / move / move+edit / copy / import (import = identity taken over from a related lane,
    e.g. caiqueAICA in NotDC-PS3); `dom`: dominant origin frame of the file; `kept/added/removed`: lines vs the
    file's previous version (raw-line Myers diff); `from`: source identity of a copy / import, else -1.

Binary, per frame at byte `off`: `u32 script[nw]`, `u32 line[nl]`, `u16 origin[nl]`, `u16 keep[nl]` (little
endian; 4-byte aligned). Ops consume, in order, `ns` script words and `ni` lines each.

Script word: `op << 30 | count`, op 0 = keep `count` lines of the old version, 1 = drop `count` old lines,
2 = insert the next `count` carried lines. Applying the script to the old version gives exactly the new version;
morphs can pair kept lines directly.

`keep == 0xFFFF`: trivial line (blank, brackets, punctuation); its colour is the file's `dom`, `origin` is 0.

## Line semantics (tools/provenance/frames.cpp header)

- origin: earliest frame where the whitespace-collapsed line appears (a) in an earlier frame of the lane or of a
  code / merge parent lane up to its fork frame, (b) in an earlier version of the same file identity, or (c) in a
  related / copy lane's file (its state at that time) sharing >= 5 significant lines with this file. Inherited
  transitively. Rule (b) spans lanes: a file identity shared by sibling lanes (for example nullDCe's tree in
  nullDC4Wii and nullDCe-PSP) takes its origins from its earliest version in any lane, so a sibling lane that
  held a line first can claim it even though no code moved between the two. nullDC-pre2008 (frame `virt`): origin in nullDC or nullDCe, and the line is in both nullDCe's 2009
  tree and some nullDC frame.
- keep: frames after the origin frame holding the line, over the lanes D = desc(origin lane) | desc(holder lane);
  desc follows code / merge / copy edges, not concept (`related`) edges.
- possible[o][lane]: frames after o over the same D. keep <= possible by construction (checked for every line by
  check_frames.py). A line that originates in a lane's last frame with no descendant lane reads "0 of 0".

## data/identities.json.gz

`[{"from": -1, "lane": 7, "p": "core/hw/pvr/spg.cpp", "v": [[lane, first frame, last frame], ...]}, ...]`:
per identity its source identity (copies / imports), the lane it was created in, its latest path, and the frame
span in every lane that holds it. Identities are shared across lanes through fork parents (a child's first frame
matches the parent's fork-frame files by path, blob and content) and imports.

## data/layout.json.gz (format 2)

As format 1 with frames for snapshots:

- `lanes[]`: name, title, github, group, parent, z0, width, cols, `frames` (global indices), rgb, approx,
  `slots` [identity, 0, col, row, cap] over every identity the lane ever holds (cap = longest version: a file stays
  in place in every frame), districts.
- `walls[]`: {frame, lane, x}. X is time: `unit.month` = 4000 units per month; stretches of more than 6 months
  without any frame are compressed to 6 months (`time.gaps`, `ruler` gap entries); same-day frames of a lane step
  month / 8. `time.knots` give x(date).
- `ruler`, `brackets` (date ranges: nullDCe 2008-2010, reicast import 2012-2013, dc4ever approx, nullDC closed
  2005-2010), `edges` {from, to (frames), from_lane, to_lane, kind: import / git-fork / git-merge / copy / concept,
  label, lines}, `marks` (tag / pin / fork / import frames; `release` for tags and pins), `releases` (DreamSTer,
  with their pin frames), `origin_rgb` per frame (lane hue, lightness by place in the lane), `fpgadc`.
- `possible` moved to frames.json.

## data/story.json

Chapters list `lanes` and `frames` {lane: [first, last]}; bookmarks have `lane`, `frame`, `date`, `path`, `line`,
`grep` instead of a snapshot id.

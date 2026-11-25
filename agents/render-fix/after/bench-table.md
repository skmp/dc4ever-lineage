Final code, interleaved pairs (before = 537d792 on a copy, after = this work), 2560x1440, 20 s per path:

| path | pair 10 p95 before -> after | pair 11 p95 before -> after | fps mean (10 / 11) | p99 (10 / 11) | frames > 100 ms (10+11) | draws p95 |
|---|---|---|---|---|---|---|
| A file street | 26.2 -> 22.4 (-15 %) | 23.4 -> 22.6 (-3 %) | 86.1 / 94 -> 103.5 / 103.4 | 81.2 / 53.8 -> 45.1 / 42.4 | 15 -> 1 | 429 -> 264 |
| B orbit | 21 -> 21.1 (0 %) | 20.6 -> 21 (2 %) | 126.4 / 133.3 -> 131 / 133.9 | 22.1 / 21.1 -> 21.9 / 21.8 | 0 -> 0 | 211 -> 211 |
| C lane flights | 47 -> 27.7 (-41 %) | 45.2 -> 26 (-42 %) | 67.2 / 65 -> 83.5 / 88.2 | 114.9 / 117.4 -> 62.9 / 58.6 | 31 -> 8 | 475 -> 293 |
| D close reading | 20.1 -> 20 (-0 %) | 20.1 -> 20 (-0 %) | 139.4 / 138.3 -> 136 / 132.7 | 20.7 / 20.6 -> 20.6 / 20.6 | 0 -> 0 | 9 -> 9 |
| E live playback | 20.5 -> 21.4 (4 %) | 20.3 -> 21.3 (5 %) | 125.6 / 127.4 -> 111 / 114.2 | 22.4 / 21.3 -> 30.5 / 26.8 | 0 -> 0 | 96 -> 269 |

Other runs: before 1, 2, 4-9 and after 1-9 are intermediate states (after1: no recycle bin / speed gate; after2: an impostor-bin index bug, exceptions in the log; after3-7: before the far bake cap and T4/T5 batching; after8-9: B, C, E only). Before p95 over all before runs: A 19.8-26.2, B 20.5-21.0, C 24.7-57.5, D 19.8-20.1, E 19.9-20.5.

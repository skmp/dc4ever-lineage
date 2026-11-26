#!/bin/bash
# A/B on the real GPU (Xvfb + Mesa d3d12): parent bed89b0 (worktree served on 8761) vs HEAD (8743), alternating, 2 rounds.
# per run: bench paths A..E 20 s each, load + timeline sweep (loadmem.js), dense-stretch fly (densefly.js). ~20 min total.
cd "$(dirname "$0")/../../.."
O=agents/frames2/verify2/perf; mkdir -p $O
for i in 1 2; do for v in parent:8761 head:8743; do n=${v%%:*}; p=${v##*:}
  node tools/verify/run.mjs bench --gpu --port $p --size 2560x1440 --paths A,B,C,D,E --dur 20 --out $O/bench-$n-$i > $O/bench-$n-$i.log 2>&1
  node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/scratch/loadmem.js --out $O/mem-$n-$i > $O/mem-$n-$i.log 2>&1
  node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/verify2/js/densefly.js --out $O/dense-$n-$i > $O/dense-$n-$i.log 2>&1
  echo "$(date +%T) $n $i done"
done; done

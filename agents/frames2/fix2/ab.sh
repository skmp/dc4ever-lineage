#!/bin/bash
# fix round A/B on the real GPU (Xvfb + Mesa d3d12): bed89b0 (a detached worktree served on 8761) vs the fix round (8743).
# per side: bench paths A..E 20 s each, load + timeline sweep (scratch/loadmem.js), the verifier's dense-stretch fly
# (verify2/js/densefly.js), the low fly at a fixed 5000 units/s (fix2/js/pf-s5000.js), live heap after a forced GC
# (fix2/js/heap2.js). About 6 min per side.
cd "$(dirname "$0")/../../.."
O=agents/frames2/fix2/perf; mkdir -p $O
for v in base:8761 fix:8743; do n=${v%%:*}; p=${v##*:}
  node tools/verify/run.mjs bench --gpu --port $p --size 2560x1440 --paths A,B,C,D,E --dur 20 --out $O/bench-$n > $O/bench-$n.log 2>&1
  node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/scratch/loadmem.js --out $O/mem-$n > $O/mem-$n.log 2>&1
  node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/verify2/js/densefly.js --out $O/dense-$n > $O/dense-$n.log 2>&1
  node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/fix2/js/pf-s5000.js --out $O/fly5000-$n > $O/fly5000-$n.log 2>&1
  CHROME_FLAGS=--js-flags=--expose-gc node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/fix2/js/heap2.js --out $O/heap-$n > $O/heap-$n.log 2>&1
  echo "$(date +%T) $n done"
done

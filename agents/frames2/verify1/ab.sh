#!/bin/bash
# A/B: parent build (port 8751) vs HEAD (port 8743), alternating; bench paths A..E 20 s each + load/memory sweep, 2560x1440 GPU
cd "$(dirname "$0")/../../.."
O=agents/frames2/verify1/perf
mkdir -p $O
for i in 1 2; do
  for v in parent:8751 head:8743; do n=${v%%:*}; p=${v##*:}
    node tools/verify/run.mjs bench --gpu --port $p --size 2560x1440 --paths A,B,C,D,E --dur 20 --out $O/bench-$n-$i > $O/bench-$n-$i.log 2>&1
    node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/scratch/loadmem.js --out $O/mem-$n-$i > $O/mem-$n-$i.log 2>&1
  done
done
for i in 1 2; do for v in parent:8751 head:8743; do n=${v%%:*}; p=${v##*:}
  node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/verify1/js/densefly.js --out $O/dense-$n-$i > $O/dense-$n-$i.log 2>&1
done; done
echo done2

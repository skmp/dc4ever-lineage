#!/bin/bash
# verify3 A/B on the real GPU: bed89b0 worktree (port 8771) vs HEAD (8743), alternating, 2 rounds, 2560x1440.
# per run: bench A..E 20 s each (~2.5 min), fly3.js (~1.5 min)
cd "$(dirname "$0")/../../.."
O=agents/frames2/verify3/perf; mkdir -p $O
for i in 1 2; do for v in base:8771 head:8743; do n=${v%%:*}; p=${v##*:}
  node tools/verify/run.mjs bench --gpu --port $p --size 2560x1440 --paths A,B,C,D,E --dur 20 --out $O/bench-$n-$i > $O/bench-$n-$i.log 2>&1
  CHROME_FLAGS=--js-flags=--expose-gc node tools/verify/run.mjs eval --gpu --port $p --size 2560x1440 --js agents/frames2/verify3/js/fly3.js --out $O/fly-$n-$i > $O/fly-$n-$i.log 2>&1
  echo "$(date +%T) $n $i done"
done; done

#!/bin/bash
# ab.sh: A/B benchmark, HEAD viewer vs the fix (bench/src-fix), paths A..E, alternating, 2560x1440, 20 s per path
set -e
R=$(cd $(dirname $0)/../../../.. && pwd); B=$R/agents/render-fix/fix3/bench; cd $R
run() { node tools/verify/run.mjs bench --gpu --port 8743 --size 2560x1440 --paths C,A --dur 20 --out agents/render-fix/fix3/bench/$1 > $B/$1.log 2>&1; }
for i in 7 8; do
  git show HEAD:viewer/src/main.js > viewer/src/main.js; git show HEAD:viewer/src/shaders.js > viewer/src/shaders.js; run head-$i
  cp $B/src-fix/main.js $B/src-fix/shaders.js viewer/src/; run fix-$i
done
cp $B/src-fix/main.js $B/src-fix/shaders.js viewer/src/

#!/bin/bash
# shots.sh PORT TAG: the fixed-camera LOD / title shots (GPU LOD path on llvmpipe: soft=0, full-res canvas)
cd "$(dirname "$0")/../../.."
for v in far mid near street; do
  EXTRA='&soft=0&scale=1&tour=0&clean=1' node tools/verify/run.mjs eval --soft --size 1280x720 --port $1 --tag $2 --out agents/verify/lod-titles --js agents/verify/lod-titles/views/$v.js --shot lod-$v 2>&1 | grep -v '^ *$' | tail -4
done

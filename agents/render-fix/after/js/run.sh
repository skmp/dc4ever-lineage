#!/bin/bash
# run.sh PORT TAG NAME [EXTRA]: lib.js + NAME.body.js through run.mjs eval on the GPU at 1920x1080 -> ../TAG/NAME/
set -e
D=$(cd $(dirname $0) && pwd); R=$(cd $D/../../../.. && pwd)
cat $D/lib.js $D/$3.body.js > $D/.$3.$2.js
OUTD=$D/../$2/$3; mkdir -p $OUTD
cd $R && EXTRA="$4" node tools/verify/run.mjs eval --gpu --port $1 --size 1920x1080 --js $D/.$3.$2.js --out agents/render-fix/after/.tmp > $OUTD/out.txt 2>&1
node $D/extract.mjs $OUTD/out.txt $OUTD

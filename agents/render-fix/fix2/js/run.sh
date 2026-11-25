#!/bin/bash
# run.sh NAME [EXTRA]: lib.js + NAME.body.js through run.mjs eval on the GPU at 1920x1080 (port 8743) -> ../out/NAME/
set -e
D=$(cd $(dirname $0) && pwd); R=$(cd $D/../../../.. && pwd)
cat $D/lib.js $D/$1.body.js > $D/.$1.js
OUTD=$D/../out/$1; mkdir -p $OUTD
cd $R && EXTRA="$2" node tools/verify/run.mjs eval --gpu --port 8743 --size 1920x1080 --js $D/.$1.js --out agents/render-fix/fix2/.tmp > $OUTD/out.txt 2>&1
node $D/extract.mjs $OUTD/out.txt $OUTD

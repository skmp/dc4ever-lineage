#!/bin/sh
# all.sh: every verify step in sequence (the server must run on 8742). About 20 minutes; logs to agents/verify/all.log.
cd "$(dirname "$0")/../.."
set -x
uptime
node tools/verify/check_data.mjs
node tools/verify/serve_check.mjs
node tools/verify/run.mjs probe --size 2560x1440
node tools/verify/run.mjs probe --soft --size 1280x720
node tools/verify/run.mjs shots --size 2560x1440 --views far,rec,rec-mid,morph,morph-wide,fork,fork2,fpgadc
node tools/verify/run.mjs shots --soft --size 1280x720 --views far,rec,morph,fork,fpgadc
uptime
node tools/verify/run.mjs bench --size 2560x1440 --paths A,B,C,D,E
EXTRA='&clean=1' node tools/verify/run.mjs bench --size 2560x1440 --paths A,B,C,D,E --tag gpu-clean
node tools/verify/run.mjs bench --soft --size 1280x720 --paths A,B,C,D,E
node tools/verify/run.mjs bench --soft --size 2560x1440 --paths A,B,C,D,E
uptime
node tools/verify/morphstall.mjs --soft --size 2560x1440 --secs 10
node tools/verify/morphstall.mjs --gpu --size 2560x1440 --secs 10
uptime

#!/bin/bash
# gitcheck.sh SNAPID PATH LINE ORIGINID PREV_IDS...  : file line at snap; grep line text in origin and earlier snapshots
R=/home/skmp/projects/nulldc-lineage/repos
M=/home/skmp/projects/nulldc-lineage/data/manifest.json
info(){ python3 -c "import json,sys;m=json.load(open('$M'));s=[x for x in m['snapshots'] if x['id']=='$1'][0];print(s['repo'],s['commit'])"; }
read repo commit <<<"$(info $1)"
txt=$(git -C $R/$repo.git show $commit:"$2" | sed -n "${3}p" | sed 's/^[ \t]*//;s/[ \t\r]*$//')
echo "[$1] $2:$3 => $txt"
shift 3
for o in "$@"; do
  read r c <<<"$(info $o)"
  n=$(git -C $R/$r.git grep -F -c -e "$txt" $c 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}')
  echo "   in $o ($r ${c:0:8}): $n hits"
done

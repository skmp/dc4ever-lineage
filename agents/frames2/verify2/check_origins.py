#!/usr/bin/env python3
"""verify2: provenance spot check. For random tour lines (non-virtual origin): the text is in the origin frame's tree
(origin_file path), and not in the lane's previous frame (any file), nor in any frame of a code-parent lane at or
before the origin date (parents' fork frames).   python3 agents/frames2/verify2/check_origins.py   (a few seconds)"""
import json, random, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = json.load(open(os.path.join(ROOT, 'data/attract.json'))); F = json.load(open(os.path.join(ROOT, 'data/frames.json')))
fr = F['frames']; lanes = {l['name']: l for l in F['lanes']}
def grep(lane, commit, needle):
    r = lanes[lane]['repo']
    o = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), 'grep', '-F', '-l', '-e', needle, commit], capture_output=True, text=True, errors='replace').stdout
    return [h.split(':', 1)[1] for h in o.split('\n') if h]
rnd = random.Random(3)
items = [it for it in A['items'] if it['kind'] == 'line' and not fr[it['origin']].get('virtual')]
for it in rnd.sample(items, 14):
    o = fr[it['origin']]; ln = o['lane']; needle = max(it['text'].split('    '), key=len).strip()
    here = grep(ln, o['commit'], needle)
    fl = lanes[ln]['frames']; k = fl.index(it['origin'])
    prev = grep(ln, fr[fl[k - 1]]['commit'], needle) if k > 0 else None
    par = []
    for e in lanes[ln]['parents']:
        if e['kind'] == 'code' and 'frame' in e: par.append((e['lane'], bool(grep(e['lane'], fr[e['frame']]['commit'], needle))))
    ok = it['origin_file']['path'] in here and not prev and not any(p for _, p in par)
    print(f'{"ok " if ok else "BAD"} {ln:12s} {o["commit"][:9]} {o["date"]} {it["origin_file"]["path"]} in-origin {it["origin_file"]["path"] in here} prev-frame {"-" if prev is None else bool(prev)} code-parents {par} | {needle[:60]!r}')

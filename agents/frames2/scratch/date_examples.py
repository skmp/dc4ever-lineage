#!/usr/bin/env python3
"""date_examples.py: tour items, old caption dates (frame dates) vs new ones (file last change), with file and commit."""
import json, sys
D = json.load(open('data/frames.json'))['frames']
A = json.load(open('data/attract.json'))['items']
want = sys.argv[1:] or None
stat = {'stops': 0, 'differs': 0, 'override': 0, 'approx': 0}
for i in A:
    for s, f in zip(i['stops'], i['stop_files']):
        stat['stops'] += 1; fr = D[s[0]]
        stat['differs'] += f['date'] != fr['date']; stat['override'] += 'range' in f; stat['approx'] += bool(f.get('approx'))
print(stat)
for i in A:
    t = (i.get('text') or i.get('title'))
    if want and not any(t.startswith(w) for w in want): continue
    print(f"\n## {i['kind']}: {t[:80]}")
    if i['kind'] != 'file':
        o = i.get('origin_file') or {}
        print(f"  first seen in {i['origin_lane']}: old {i['origin_frame_date']} -> new {o.get('label')} ({o.get('path')} @ {o.get('commit')})")
    for s, f in list(zip(i['stops'], i['stop_files']))[:4]:
        fr = D[s[0]]
        print(f"  now: {fr['lane']} frame {fr['commit'][:9]} {fr['date']} -> file last changed {f['label']} ({f['path']} @ {f.get('commit')})")

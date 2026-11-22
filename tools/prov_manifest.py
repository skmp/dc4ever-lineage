#!/usr/bin/env python3
"""prov_manifest.py: merge data/manifest.core.json (written by tools/provenance) with the collect metadata
(why, date ranges, lanes) and the file sizes into data/manifest.json."""
import json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); D = os.path.join(ROOT, 'data')
core = json.load(open(os.path.join(D, 'manifest.core.json')))
meta = {s['id']: s for s in json.load(open(os.path.join(ROOT, 'agents/collect/snapshots.json')))['snapshots']}
for s in core['snapshots']:
    m = meta[s['id']]
    s['commit'] = m['commit']; s['ref'] = m['ref']; s['why'] = m['why']
    for k in ('date_range', 'date_note'):
        if k in m: s[k] = m[k]
    s['by_lang'] = {k: v['lines'] for k, v in m['by_lang'].items()}
core['origin_info'] = [{'snap': i, 'id': s['id'], 'date': s['date'], 'order_date': s['order_date'], 'lane': s['lane']}
                       for i, s in enumerate(core['snapshots'])]
core['origin_info'].append({'snap': None, 'id': 'nullDC-pre2008', 'date': '2005-2008', 'order_date': '2008-12-31', 'lane': 'nullDC',
    'note': 'virtual origin: line present both in nullDCe-2009 (late-2008 fork) and in nullDC, so it predates the fork'})
files = {}
total = 0
for dp, _, fs in os.walk(D):
    for f in fs:
        p = os.path.join(dp, f); rel = os.path.relpath(p, D)
        if rel in ('manifest.json', 'manifest.core.json'): continue
        files[rel] = os.path.getsize(p); total += files[rel]
core['files'] = dict(sorted(files.items())); core['total_bytes'] = total
core['format_doc'] = 'agents/provenance/REPORT.md'
json.dump(core, open(os.path.join(D, 'manifest.json'), 'w'), indent=1)
os.remove(os.path.join(D, 'manifest.core.json'))
print('data total', total, 'bytes in', len(files), 'files')

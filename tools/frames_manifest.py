#!/usr/bin/env python3
"""frames_manifest.py [DATA] [--sizes]: merge DATA/frames.core.json (tools/provenance/frames) with agents/frames/frames.json
(tools/frames.py: dates, commits, tags, lane graph) into DATA/frames.json, the index of the frame data.
Format: agents/frames/FORMAT.md. --sizes only refreshes the file list and total_bytes (run it last)."""
import json, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
D = os.path.abspath(args[0] if args else os.path.join(ROOT, 'data'))
def sizes():
    files = {}; total = 0
    for dp, _, fs in os.walk(D):
        for fn in fs:
            p = os.path.join(dp, fn); rel = os.path.relpath(p, D)
            if rel in ('frames.json', 'frames.core.json'): continue
            files[rel] = os.path.getsize(p); total += files[rel]
    return dict(sorted(files.items())), total
if '--sizes' in sys.argv:
    out = json.load(open(os.path.join(D, 'frames.json'))); out['files'], out['total_bytes'] = sizes()
    json.dump(out, open(os.path.join(D, 'frames.json'), 'w'), separators=(',', ':'))
    print('data total', out['total_bytes'], 'bytes in', len(out['files']), 'files (+ frames.json', os.path.getsize(os.path.join(D, 'frames.json')), ')'); sys.exit()
core = json.load(open(os.path.join(D, 'frames.core.json')))
sel = json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))
assert len(core['frames']) == len(sel['frames'])
lanes = []
for L, C in zip(sel['lanes'], core['lanes']):
    assert L['lane'] == C['name']
    lanes.append({'name': L['lane'], 'repo': L['repo'], 'tip': L['tip'], 'frames': L['frames'],
                  'parents': L['parents'], 'shared_until': L['shared_until'],
                  'desc': C['desc'], 'anc': C['anc'], 'chunks': C['chunks']})
frames = []
for f, c in zip(sel['frames'], core['frames']):
    assert f['i'] == c['i']
    o = {'i': f['i'], 'lane': f['lane'], 'k': f['k'], 'date': f['date'], 'commit': f['commit'][:12],
         'kinds': f['kinds']}
    for key in ('tags', 'labels'):
        if f.get(key): o[key] = f[key]
    for key in ('approx', 'virtual', 'date_range', 'date_note'):
        if f.get(key): o[key] = f[key]
    if f.get('commit_date') and f['commit_date'] != f['date']: o['commit_date'] = f['commit_date']
    for key in ('key', 'chunk', 'files', 'lines', 'd', 'by_lane', 'by_year'):
        if key in c: o[key] = c[key]
    frames.append(o)
files, total = sizes()
out = {'format': core['format'], 'format_doc': 'agents/frames/FORMAT.md',
       'chunk_lines': core['chunk_lines'], 'raw_lines': core['raw_lines'], 'norm_lines': core['norm_lines'],
       'text_chunks': core['text_chunks'], 'identities': core['identities'], 'virt': core['virt'],
       'lanes': lanes, 'frames': frames, 'releases': sel['releases'], 'possible': core['possible'],
       'files': dict(sorted(files.items())), 'total_bytes': total}
json.dump(out, open(os.path.join(D, 'frames.json'), 'w'), separators=(',', ':'))
os.remove(os.path.join(D, 'frames.core.json'))
print('frames.json:', len(frames), 'frames,', len(lanes), 'lanes; data total', total, 'bytes in', len(files), 'files')

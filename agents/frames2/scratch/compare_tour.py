#!/usr/bin/env python3
"""compare_tour.py OLD_ATTRACT NEW_ATTRACT: picked items matched by (kind, note); text, unique flag and lanes compared."""
import json, sys, collections
A = json.load(open(sys.argv[1]))['items']; B = json.load(open(sys.argv[2]))['items']
def key(i): return (i['kind'], i.get('title') or '', i.get('note') or '')
def txt(i): return i.get('text') if i['kind'] == 'line' else i.get('code')
ia = {key(i): i for i in A if i.get('picked')}; ib = {key(i): i for i in B if i.get('picked')}
print('picked old/new', len(ia), len(ib), 'missing', [k for k in ia if k not in ib], 'new', [k for k in ib if k not in ia])
c = collections.Counter()
for k, a in ia.items():
    b = ib.get(k)
    if not b: continue
    if txt(a) != txt(b): print('TEXT CHANGED', k)
    if a.get('unique') != b.get('unique'): print('UNIQUE', a.get('unique'), '->', b.get('unique'), k, a.get('lanes'), '->', b.get('lanes'))
    elif a.get('lanes') != b.get('lanes'): c['lanes changed'] += 1; print('  lanes', k[1] or k[2][:60], sorted(set(b['lanes']) - set(a['lanes'])), sorted(set(a['lanes']) - set(b['lanes'])))
for D, n in (('old', ia), ('new', ib)): print(D, collections.Counter('unique' if i.get('unique') else 'shared' for i in n.values()))
print(dict(c))

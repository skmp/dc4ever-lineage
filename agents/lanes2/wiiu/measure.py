#!/usr/bin/env python3
"""measure.py CHILD_REPO CHILD_REF [PATH_PREFIX] -- PARENT_REPO:REF ...
For the child's counted own source (count.scan 'own', optionally only paths under PATH_PREFIX):
files whose blob sha is identical in each parent (any path), and significant lines (whitespace-collapsed, >= 20 chars)
found anywhere in each parent's own source. Also: lines found in the FIRST parent excluded, the remainder vs the others."""
import sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from count import scan
def load(repo, ref, prefix=''):
    ents = [e for e in scan(repo, ref) if e['cls'] == 'own' and e['path'].startswith(prefix)]
    ids = [e['sha'] for e in ents]
    out = subprocess.run(['git', '-C', repo, 'cat-file', '--batch'], input=('\n'.join(ids) + '\n').encode(), capture_output=True).stdout
    pos = 0; files = {}
    for e in ents:
        he = out.index(b'\n', pos); sz = int(out[pos:he].split()[2]); data = out[he + 1:he + 1 + sz]; pos = he + 2 + sz
        L = [b' '.join(l.split()) for l in data.replace(b'\r', b'').split(b'\n')]
        files[e['path']] = (e['sha'], [t for t in L if len(t) >= 20])
    return files
a = sys.argv[1:]; k = a.index('--')
child = load(*a[:k]) if len(a[:k]) == 3 else load(a[0], a[1])
parents = [x.rsplit(':', 1) for x in a[k + 1:]]
cl = [t for s, L in child.values() for t in L]
print(f'child {a[0].split("/")[-1]} {a[1]} {a[2] if k == 3 else ""}: {len(child)} files, {len(cl)} significant lines')
rest = None
for i, (r, ref) in enumerate(parents):
    p = load(r, ref); blobs = {s for s, L in p.values()}; ps = {t for s, L in p.values() for t in L}
    same = sum(1 for s, L in child.values() if s in blobs)
    sameL = sum(len(L) for s, L in child.values() if s in blobs)
    hit = sum(1 for t in cl if t in ps)
    line = f'  {r.split("/")[-1]:32s} {ref:12s} identical files {same:4d}/{len(child)} ({sameL} sig lines)  lines {hit:6d}/{len(cl)} = {100*hit/max(1,len(cl)):5.1f}%'
    if rest is None: rest = [t for t in cl if t not in ps]; line += f'   -> {len(rest)} lines not in it'
    else:
        rh = sum(1 for t in rest if t in ps); line += f'   of the rest: {rh}/{len(rest)}'
    print(line, flush=True)

#!/usr/bin/env python3
"""verify2: sparse lanes, every source-changing lane-local first-parent commit is a frame. Independent of frames.py's
tree-set comparison: a commit changes counted source when its diff against the first parent (name-status, no renames,
merges diffed against the first parent) touches a counted path (rules.py lang_of / is_vendored) whose new (or, for a
deletion, old) blob is neither binary nor generated.   python3 agents/frames2/verify2/check_sparse.py   (about 10 s)"""
import json, subprocess, os, sys, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from rules import lang_of, is_vendored, is_generated
F = json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))
DENSE = {'nullDC4Wii', 'reicast', 'flycast'}
def git(r, *a, inp=None):
    return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), *a], capture_output=True, input=inp, check=True).stdout
blobcache = {}
def counted_blob(r, p, spec):
    if spec in blobcache: return blobcache[spec]
    data = git(r, 'cat-file', 'blob', spec); n = len(data)
    lines = data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
    v = not (b'\0' in data[:8000] or is_generated(r, p, n, lines, data[:600])); blobcache[spec] = v; return v
byi = {f['i']: f for f in F['frames']}
tot = collections.Counter()
for L in F['lanes']:
    ln, r = L['lane'], L['repo']
    if ln in DENSE: continue
    out = git(r, 'log', '--first-parent', '--reverse', '--no-renames', '--diff-merges=first-parent', '--raw', '--no-abbrev', '--format=@%H', L['tip']).decode('utf-8', 'replace')
    commits = []; cur = None
    for l in out.split('\n'):
        if l.startswith('@'): cur = [l[1:], False]; commits.append(cur)
        elif l.startswith(':') and cur:
            meta, p = l.split('\t', 1); m = meta.split()
            if not lang_of(p, r) or is_vendored(r, p): continue
            new, old, st = m[3], m[2], m[4]
            blob = old if st == 'D' else new
            if m[1 if st != 'D' else 0][:2] == '16': continue   # submodule
            if counted_blob(r, p, blob): cur[1] = True
    shared = L['shared_until']
    if shared:
        k = [c for c, _ in commits].index(shared); commits = commits[k + 1:]
    want = [c for c, ch in commits if ch]
    frames = [byi[i] for i in L['frames']]
    have = {f['commit'] for f in frames}
    first_counted = next((i for i, (c, ch) in enumerate(commits) if ch), None)
    missing = [c for c in want if c not in have]
    extra = [f for f in frames if f['commit'] not in set(want)]
    print(f'{ln:16s} local {len(commits):4d} source-changing {len(want):4d} frames {len(frames):4d} missing {len(missing)} '
          f'extra {[(f["commit"][:9], "+".join(f["kinds"])) for f in extra]}')
    for c in missing: print('   MISSING', c)
    tot['missing'] += len(missing)
print(dict(tot))

#!/usr/bin/env python3
"""verify1: independently list, per sparse lane, the lane-local first-parent commits whose counted own-file set
(path, blob after rules.py) differs from the previous commit's, and diff that list against agents/frames/frames.json."""
import os, sys, json, subprocess, collections
from multiprocessing import Pool
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import frames as F
from rules import is_generated

def git(repo, *a): return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True, check=True).stdout

def heads_of(repo, blobs):
    p = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), 'cat-file', '--batch'], input=('\n'.join(blobs) + '\n').encode(), capture_output=True).stdout
    res = {}; o = 0
    for b in blobs:
        e = p.index(b'\n', o); n = int(p[o:e].split()[2]); data = p[e + 1:e + 1 + n]; o = e + 2 + n
        lines = data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
        res[b] = (b'\0' in data[:8000], data[:600], lines)
    return res

def lane(args):
    ln, repo, tip, opt, shared = args
    ch = git(repo, 'log', '--first-parent', '--reverse', '--format=%H', tip).decode().split()
    if shared: ch = ch[ch.index(shared) + 1:]
    trees = [F.tree_files(repo, s) for s in ch]
    blobs = sorted({b for t in trees for (p, b, sz) in t}); H = heads_of(repo, blobs) if blobs else {}
    prev = None; out = []
    for s, t in zip(ch, trees):
        own = frozenset((p, b) for p, b, sz in t if not H[b][0] and not is_generated(repo, p, sz, H[b][2], H[b][1]))
        if own != prev and (own or prev is not None):
            if own or prev: out.append(s)
        prev = own if (own or prev is not None) else None
    return ln, out

if __name__ == '__main__':
    fj = json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))
    shared = {L['lane']: L['shared_until'] for L in fj['lanes']}
    jobs = [(ln, r, t, o, shared[ln]) for ln, r, t, o in F.LANES if ln not in F.DENSE]
    with Pool(8) as p: res = p.map(lane, jobs)
    byl = collections.defaultdict(list)
    for f in fj['frames']:
        if not f.get('virtual'): byl[f['lane']].append(f)
    bad = 0
    for ln, exp in res:
        fr = byl[ln]; have = {f['commit'] for f in fr}
        miss = [s for s in exp if s not in have]
        extra = [f for f in fr if f['commit'] not in set(exp)]
        extra_droppable = [f for f in extra if not (set(f['kinds']) - F.DROPPABLE)]
        print(f'{ln:16s} source-changing {len(exp):4d} frames {len(fr):4d} missing {len(miss)} extra {len(extra)} '
              f'(extra kinds: {collections.Counter(tuple(sorted(f["kinds"])) for f in extra)}) extra-droppable {len(extra_droppable)}')
        for s in miss[:5]: print('   MISSING', s)
        for f in extra_droppable[:5]: print('   EXTRA', f['commit'], f['kinds'], f['date'])
        bad += len(miss) + len(extra_droppable)
    print('problems', bad)

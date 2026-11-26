#!/usr/bin/env python3
"""verify3: independent check that every source-changing lane-local first-parent commit of every sparse lane is a frame.
Counted set per commit = (path, blob) of ls-tree entries passing rules.lang_of / is_vendored and not binary / generated.
A commit 'changes source' when its counted set differs from its first parent's (chain predecessor)."""
import os, sys, json, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from rules import lang_of, is_vendored, is_generated
import frames as F
def git(repo, *a, inp=None):
    return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True, input=inp, check=True).stdout
data = json.load(open(os.path.join(ROOT, 'data', 'frames.json')))
fr_by_lane = {}
for f in data['frames']:
    if f.get('virtual') or 'virtual' in f.get('kinds', []): continue
    fr_by_lane.setdefault(f['lane'], []).append(f)
only = sys.argv[1:]
for lane, repo, tip, opt in F.LANES:
    if lane in F.DENSE or (only and lane not in only): continue
    ch = [l.split()[0] for l in git(repo, 'log', '--first-parent', '--reverse', '--format=%H', tip).decode().split('\n') if l]
    start = 0
    if opt.get('not_in'):
        reach = set(git(opt['not_in'], 'rev-list', next(x[2] for x in F.LANES if x[1] == opt['not_in'])).decode().split())
        sh = [i for i, s in enumerate(ch) if s in reach]
        start = sh[-1] + 1 if sh else 0
    blobcache = {}
    def counted(sha):
        out = git(repo, 'ls-tree', '-r', '-z', '--long', sha); ents = []
        for rec in out.split(b'\0'):
            if not rec: continue
            meta, path = rec.split(b'\t', 1); m = meta.split()
            if m[1] != b'blob': continue
            p = path.decode('utf-8', 'replace')
            if not lang_of(p, repo) or is_vendored(repo, p): continue
            ents.append((p, m[2].decode(), int(m[3])))
        need = [b for p, b, s in ents if b not in blobcache]
        if need:
            o = git(repo, 'cat-file', '--batch', inp=('\n'.join(need) + '\n').encode()); k = 0
            for b in need:
                e = o.index(b'\n', k); hdr = o[k:e].split(); k = e + 1; n = int(hdr[2]); d = o[k:k + n]; k += n + 1
                lines = d.count(b'\n') + (1 if d and not d.endswith(b'\n') else 0)
                blobcache[b] = (b'\0' in d[:8000], d[:600], lines)
        r = set()
        for p, b, s in ents:
            bi, h, ln = blobcache[b]
            if bi or is_generated(repo, p, s, ln, h): continue
            r.add((p, b))
        return frozenset(r)
    prev = counted(ch[start - 1]) if start > 0 else frozenset()
    expect = []
    for s in ch[start:]:
        c = counted(s)
        if c != prev and c: expect.append(s[:12])
        prev = c
    have = {f['commit'][:12] for f in fr_by_lane[lane]}
    miss = [s for s in expect if s not in have]
    extra = [f for f in fr_by_lane[lane] if f['commit'][:12] not in set(expect)]
    print(f"{lane:16s} lane-local {len(ch)-start:4d} source-changing {len(expect):4d} frames {len(fr_by_lane[lane]):4d} "
          f"missing {len(miss)} {miss[:5]} extra {len(extra)} {[(f['commit'][:9], f['kinds']) for f in extra][:8]}", flush=True)

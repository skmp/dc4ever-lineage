#!/usr/bin/env python3
"""verify2: dense lanes (nullDC4Wii, reicast, flycast). Recompute counted churn per first-parent commit (numstat vs the
first parent; rules.py lang_of / is_vendored; binary or generated blobs left out, every entry >= 50 lines checked),
threshold max(1500, 3 % of the running counted line total). Report: big commits that are not frames, frame-to-frame
steps (lane chain order) of several commits whose churn sum is >= 2 x threshold, and 'big' frame counts.
   python3 agents/frames2/verify2/check_dense.py   (about 30 s)"""
import json, subprocess, os, sys, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from rules import lang_of, is_vendored, is_generated
F = json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))
byi = {f['i']: f for f in F['frames']}
def git(r, *a, inp=None):
    return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), *a], capture_output=True, input=inp, check=True).stdout
for L in F['lanes']:
    ln, r = L['lane'], L['repo']
    if ln not in ('nullDC4Wii', 'reicast', 'flycast'): continue
    out = git(r, 'log', '--first-parent', '--reverse', '--no-renames', '--diff-merges=first-parent', '--numstat', '--format=@%H', L['tip']).decode('utf-8', 'replace')
    ents = []; order = []
    for l in out.split('\n'):
        if l.startswith('@'): cur = l[1:]; order.append(cur)
        elif l:
            a, d, p = l.split('\t', 2)
            if a == '-' or not lang_of(p, r) or is_vendored(r, p): continue
            ents.append((cur, p, int(a), int(d)))
    chk = [(c, p) for c, p, a, d in ents if a + d >= 50]
    gen = set()
    inp = b''.join(f'{c}:{p}\n{c}^:{p}\n'.encode() for c, p in chk)
    o = git(r, 'cat-file', '--batch', inp=inp); k = 0
    for c, p in chk:
        for _ in range(2):
            e = o.index(b'\n', k); hdr = o[k:e].split(); k = e + 1
            if hdr[-1] == b'missing': continue
            n = int(hdr[2]); data = o[k:k + n]; k += n + 1
            lines = data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
            if b'\0' in data[:8000] or is_generated(r, p, n, lines, data[:600]): gen.add(p)
    ch = collections.defaultdict(int); net = collections.defaultdict(int)
    for c, p, a, d in ents:
        if p in gen: continue
        ch[c] += a + d; net[c] += a - d
    tot = 0; T = {}
    for c in order: T[c] = max(1500, 0.03 * tot); tot += net[c]
    shared = L['shared_until']; start = order.index(shared) + 1 if shared else 0
    local = order[start:]; pos = {c: i for i, c in enumerate(order)}
    frames = [byi[i] for i in L['frames']]; fset = {f['commit'] for f in frames}
    bigs = [c for c in local if ch[c] >= T[c]]
    nf = [c for c in bigs if c not in fset]
    kinds = collections.Counter(x for f in frames for x in f['kinds'])
    print(f'{ln}: frames {len(frames)} kinds {dict(kinds)}; big commits {len(bigs)}, not frames {len(nf)}')
    for c in nf:
        print(f'   big not a frame {c[:9]} churn {ch[c]} T {T[c]:.0f}')
    # steps along the chain between consecutive on-chain frames
    on = sorted([pos[f['commit']] for f in frames if f['commit'] in pos])
    if start and on[0] > start - 1: on = [start - 1] + on
    bad = []; worst = []
    for a, b in zip(on, on[1:]):
        s = sum(ch[order[q]] for q in range(a + 1, b + 1)); n = b - a; t = T[order[b]]
        worst.append((s / t, s, n, order[a][:9], order[b][:9]))
        if n > 1 and s >= 2 * t: bad.append((s, n, order[a][:9], order[b][:9], round(t)))
    worst.sort(reverse=True)
    print('   multi-commit steps with churn >= 2T:', bad[:10], len(bad))
    print('   worst steps (churn/T, churn, commits, from, to):', worst[:5])
    # tail after the last frame
    tail = sum(ch[c] for c in order[on[-1] + 1:]); print(f'   churn after the last frame: {tail}')

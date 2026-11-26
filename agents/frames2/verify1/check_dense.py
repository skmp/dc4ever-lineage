#!/usr/bin/env python3
"""verify1: dense lanes. Recompute per-commit counted churn (numstat vs first parent, rules.py), list commits with
churn >= max(1500, 3% of counted lines before), check each is a frame; then the counted churn of every frame-to-frame
step (git diff --numstat between consecutive frames) and the largest steps."""
import os, sys, json, subprocess, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from rules import lang_of, is_vendored
def git(repo, *a): return subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True, check=True).stdout.decode('utf-8', 'replace')
def counted(repo, numstat):
    c = n = 0
    for l in numstat.split('\n'):
        if not l or l.startswith('@'): continue
        a, r, p = l.split('\t', 2)
        if a == '-' or not lang_of(p, repo) or is_vendored(repo, p): continue
        c += int(a) + int(r); n += int(a) - int(r)
    return c, n
fj = json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))
LN = {'nullDC4Wii': ('BenoitAdam_nullDC4Wii', 'main'), 'reicast': ('skmp_reicast-emulator', 'alpha'), 'flycast': ('flyinghead_flycast', 'master')}
shared = {L['lane']: L['shared_until'] for L in fj['lanes']}
for ln, (repo, tip) in LN.items():
    fr = [f for f in fj['frames'] if f['lane'] == ln]; have = {f['commit']: f for f in fr}
    out = git(repo, 'log', '--first-parent', '--reverse', '--no-renames', '--numstat', '--format=@%H', tip)
    tot = 0; big = []; cur = None; buf = []
    def flush():
        global tot
        if cur is None: return
        c, n = counted(repo, '\n'.join(buf)); T = max(1500, 0.03 * tot)
        if c >= T: big.append((cur, c, int(T)))
        tot += n
    for l in out.split('\n'):
        if l.startswith('@'): flush(); cur = l[1:]; buf = []
        else: buf.append(l)
    flush()
    sh = shared[ln]
    chain = git(repo, 'log', '--first-parent', '--format=%H', tip).split()
    if sh: local = set(chain[:chain.index(sh)])
    else: local = set(chain)
    bigl = [b for b in big if b[0] in local]
    rc0 = list(reversed(chain)); pos0 = {x: i for i, x in enumerate(rc0)}
    miss = [b for b in bigl if b[0] not in have]
    kinds = collections.Counter(k for f in fr for k in f['kinds'])
    print(f'{ln}: frames {len(fr)} kinds {dict(kinds)}; big commits (lane-local) {len(bigl)}, not frames {len(miss)}')
    for b in miss[:8]: print('   big not a frame', b)
    for b in [b for b in bigl if pos0.get(b[0],0) > 0 and rc0[pos0[b[0]] - 1] not in have]: print('   pred missing', b, rc0[pos0[b[0]]-1][:9], rc0[pos0[b[0]]-1] in local)
    # predecessor of each big commit present?
    pos = {s: i for i, s in enumerate(reversed(chain))}; rc = list(reversed(chain))
    nopred = [b for b in bigl if pos[b[0]] > 0 and rc[pos[b[0]] - 1] not in have and rc[pos[b[0]] - 1] in local]
    print(f'   big commits whose predecessor is not a frame: {len(nopred)}')
    # step churn
    offc = [f for f in fr if f['commit'] not in pos]; print('   frames off the first-parent chain:', [(f['commit'][:9], f['kinds'], f['tags']) for f in offc])
    fr_sorted = sorted([f for f in fr if f['commit'] in pos], key=lambda f: pos[f['commit']])
    order_ok = [f['commit'] for f in fr if f['commit'] in pos] == [f['commit'] for f in fr_sorted]
    steps = []
    for a, b in zip(fr_sorted, fr_sorted[1:]):
        c, n = counted(repo, git(repo, 'diff', '--no-renames', '--numstat', a['commit'], b['commit']))
        steps.append((c, a['commit'][:9], b['commit'][:9], b['kinds'], pos[b['commit']] - pos[a['commit']]))
    steps.sort(reverse=True)
    print(f'   frame list in chain order: {order_ok}; largest steps (churn, from, to, kinds, commits in step):')
    for s in steps[:6]: print('     ', s)

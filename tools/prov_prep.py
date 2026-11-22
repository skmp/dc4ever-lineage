#!/usr/bin/env python3
"""prov_prep.py: write the inputs of tools/provenance (C++) into agents/provenance/work/.
 snapshots.tsv  idx id repo lane order_date display_date anc_mask related_mask parents(csv idx) repo_desc_mask
 files.tsv      idx sha path            (counted 'own' files only: vendored / generated excluded, rules.py)
No per-line work here: that is all in the C++ tool."""
import sys, os, json
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)
from count import scan

# Date used to ORDER snapshots for origin ("earliest snapshot"): the code date where the git date is not it.
ORDER_DATE = {
 'nulldc-360-last': '2012-09-22',   # last code commit; 2021-2022 commits are toolchain rebuilds
 'nulldc-last':     '2013-03-10',   # last svn commit; 2015/2023 GitHub edits are README + nullRend.cpp
 'reicast-last':    '2021-12-22',   # code state of 95b673698; later commits are README / notice edits
}
# same-date tie breaks (lower first): caique-head (caique 5aa2376 is 2026-09-24) before NotDC-PS3-0.8.3 that ports it
TIE = {'caique-head': -1}
# snapshots on a branch with its own root commit (no merge-base with the repo's main line): no previous-snapshot chain
OWN_HISTORY = {'polly2-r8-develop'}
# CODE edges: child snapshot inherits the parent and everything before it as "ancestor" (any file counts).
# Only the first snapshot of a repo needs one; later snapshots of the repo inherit through the previous one.
CODE = {
 'nulldc-360-2011':     ['nulldc-2011-09'],
 'reicast-2013-import': ['nulldc-2011-09', 'nullDCe-2009'],
 'flycast-v1.0':        ['reicast-r19.07'],      # flycast merged reicast until 2019-05-17
 'nulldc3-fpgadc-2023': ['reicast-last'],        # 95b673698, 2021-12-22
 'minicast-import':     ['nulldc3-fpgadc-2023'],
 'nullDC4Wii-first':    ['nullDCe-ps2-2024'],    # nullDCe main bad8d6a = ps2 branch base
 'NotDC-PS3-first':     ['nullDC4Wii-a0.50'],    # nearest earlier nullDC4Wii snapshot to 9659506
}
# RELATED edges: concept / partial-copy relations. Only files that share >= MINSHARE significant lines with the
# child file count (plus identity matches), never "any file".
RELATED = {
 'nullDCe-2009':        ['dc4ever-2005'],    # nullDCe forks nullDC, which is partly derived from dc4ever
 'nulldc-2010-05':      ['dc4ever-2005'],
 'reicast-2013-import': ['dc4ever-2005'],
 'polly2-r1':           ['nulldc3-fpgadc-2023'],
 'polly2-r8-develop':   ['nulldc3-refsw3', 'polly2-r6b'],   # same project, unrelated history: shared files count, not 'any file'
 'devtools-v3.0.0-pre': ['nulldc3-fpgadc-2023'],
 'shrike4-head':        ['nulldc3-v3.0.0-pre'],
 'caique-head':         ['nulldc3-v3.0.0-pre', 'shrike4-head'],
 'wren7-head':          ['caique-head', 'nulldc3-v3.0.0-pre'],
 'dreamcast-tests-head':['nulldc3-v3.0.0-pre', 'polly2-r6b', 'shrike4-head', 'caique-head'],
 'NotDC-PS3-0.8.3':     ['caique-head'],
}

def files_of(s):
    r = scan(os.path.join(ROOT, 'repos', s['repo'] + '.git'), s['commit'])
    return [(e['sha'], e['path']) for e in r if e['cls'] == 'own']

def main():
    meta = json.load(open(os.path.join(ROOT, 'agents/collect/snapshots.json')))
    snaps = meta['snapshots']
    for s in snaps: s['order_date'] = ORDER_DATE.get(s['id'], s['date'])
    snaps.sort(key=lambda s: (s['order_date'], TIE.get(s['id'], 0), s['id']))
    idx = {s['id']: i for i, s in enumerate(snaps)}
    n = len(snaps); assert n <= 63
    # parents for identity tracking: previous snapshot of the same repo, code parents, related parents
    prev = {}
    last = {}
    for i, s in enumerate(snaps):
        chain = (s['repo'], s['id'] in OWN_HISTORY)   # a branch with its own root commit starts its own chain
        if chain in last: prev[i] = last[chain]
        last[chain] = i
    anc = [0] * n
    for i, s in enumerate(snaps):
        m = 0
        ps = ([prev[i]] if i in prev else []) + [idx[p] for p in CODE.get(s['id'], [])]
        for p in ps:
            assert p < i, (s['id'], snaps[p]['id'])
            m |= (1 << p) | anc[p]
        anc[i] = m
    rel = [0] * n
    for i, s in enumerate(snaps):
        for p in RELATED.get(s['id'], []):
            assert idx[p] < i, (s['id'], p); rel[i] |= 1 << idx[p]
    # repo-level descendant closure over all edges (for "kept by later snapshots of descendant lines")
    repos = sorted({s['repo'] for s in snaps})
    rparents = {r: set() for r in repos}
    for i, s in enumerate(snaps):
        for p in CODE.get(s['id'], []) + RELATED.get(s['id'], []):
            if snaps[idx[p]]['repo'] != s['repo']: rparents[s['repo']].add(snaps[idx[p]]['repo'])
    def desc(r):
        out = {r}; ch = True
        while ch:
            ch = False
            for c in repos:
                if c not in out and rparents[c] & out: out.add(c); ch = True
        return out
    wd = os.path.join(ROOT, 'agents/provenance/work'); os.makedirs(wd, exist_ok=True)
    with open(os.path.join(wd, 'snapshots.tsv'), 'w') as f:
        for i, s in enumerate(snaps):
            ds = desc(s['repo']); dm = sum(1 << j for j, t in enumerate(snaps) if t['repo'] in ds)
            ps = ([prev[i]] if i in prev else []) + [idx[p] for p in CODE.get(s['id'], []) + RELATED.get(s['id'], [])]
            f.write('\t'.join([str(i), s['id'], s['repo'], s['lane'], s['order_date'], s['date'],
                               str(anc[i]), str(rel[i]), ','.join(map(str, ps)) or '-', str(dm)]) + '\n')
    with Pool(8) as p: res = p.map(files_of, snaps)
    with open(os.path.join(wd, 'files.tsv'), 'w') as f:
        for i, fl in enumerate(res):
            for sha, path in sorted(fl, key=lambda x: x[1]):
                assert '\t' not in path and '\n' not in path
                f.write(f'{i}\t{sha}\t{path}\n')
    for i, s in enumerate(snaps):
        print(i, s['id'], s['order_date'], len(res[i]), 'prev', prev.get(i), 'anc', bin(anc[i]).count('1'), 'rel', bin(rel[i]).count('1'))
main()

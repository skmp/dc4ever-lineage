#!/usr/bin/env python3
"""verify1: independent check of data/attract.json file-last-change dates on a sample of stops.
For every sampled (item, stop): find the frame's commit, locate the file(s) holding the item's text in the lane repo's
tree at that commit (git grep -F, not the viewer data), check the recorded path is one of them, recompute the file's
last change (git log -1 --first-parent <commit> -- <path>, committer date; also without --first-parent and the author
date for comparison), apply the date overrides from tools/frames.py, and compare."""
import os, sys, json, subprocess, random, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import frames as FR
A = json.load(open(os.path.join(ROOT, 'data/attract.json'))); M = json.load(open(os.path.join(ROOT, 'data/frames.json')))
SEL = {f['i']: f for f in json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))['frames']}
REPO = {L[0]: L[1] for L in FR.LANES}
OVR = {'39c0550': ('2009-10-16', '2008-2010'), '1c16baeb0': ('2013-12-19', '2012-2013')}
def git(repo, *a, ok=False):
    r = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), *a], capture_output=True)
    if r.returncode and not ok: raise RuntimeError(r.stderr.decode())
    return r.stdout.decode('utf-8', 'replace')
def needle(it):
    if it['kind'] == 'line': t = it['text']
    elif it['kind'] == 'segment': t = max(it['code'].split('\n'), key=lambda s: len(s.strip())).strip()
    else: return None
    return t[:50] if '    ' not in t else max(t.split('    '), key=len).strip()[:50]
def grep(repo, commit, nd, enc_utf16=False):
    out = git(repo, 'grep', '-l', '-F', '-I', '-e', nd, commit, ok=True)
    return [l.split(':', 1)[1] for l in out.split('\n') if l]
random.seed(20261126)
pool = []
for it in A['items']:
    for k, st in enumerate(it['stops']): pool.append((it, k))
def cat(it, k):
    f = SEL[it['stops'][k][0]]; fc = it['stop_files'][k]; c = []
    c.append(f['lane'])
    if fc.get('range'): c.append('override')
    if f['lane'] in ('flycast', 'nulldc3', 'nullDC4WiiU'):
        lanes = {L['lane']: L for L in json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))['lanes']} if False else None
    c.append(it['kind'])
    return c
# stratified: per lane up to 3, plus all kinds, plus override cases and shared-history cases
by = collections.defaultdict(list)
for it, k in pool:
    f = SEL[it['stops'][k][0]]; fc = it['stop_files'][k]
    by[f['lane']].append((it, k)); by['kind:' + it['kind']].append((it, k))
    if fc.get('range'): by['override:' + f['lane']].append((it, k))
sample = []
for key in sorted(by):
    n = 2 if key.startswith(('kind:', 'override:')) else 3
    sample += random.sample(by[key], min(n, len(by[key])))
# shared-history picks: flycast / nulldc3 / nullDC4WiiU stops whose last-change commit is in the parent's history
shared = {L['lane']: L['shared_until'] for L in json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))['lanes']}
sh = []
for it, k in pool:
    f = SEL[it['stops'][k][0]]
    if f['lane'] in ('flycast', 'nulldc3', 'nullDC4WiiU') and shared[f['lane']]:
        c = it['stop_files'][k]['commit']
        r = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', REPO[f['lane']] + '.git'), 'merge-base', '--is-ancestor', c, shared[f['lane']]], capture_output=True).returncode
        if r == 0: sh.append((it, k))
print('stops whose file last change is in shared history:', len(sh), collections.Counter(SEL[it['stops'][k][0]]['lane'] for it, k in sh))
sample += random.sample(sh, min(8, len(sh)))
seen = set(); res = collections.Counter(); notes = []
def check(it, k, origin=False):
    if origin:
        o = it.get('origin'); fr = SEL.get(o) if o is not None else None
        fc = it.get('origin_file') if it['kind'] != 'file' else it.get('first_file')
        if it['kind'] == 'file': fr = SEL[it['stops'][0][0]]
        if fr is None or fr.get('virtual'): return 'virtual', f"{fc}"
    else:
        fr = SEL[it['stops'][k][0]]; fc = it['stop_files'][k]
    repo = REPO[fr['lane']]; c = fr['commit']; p = fc['path']
    nd = needle(it)
    where = grep(repo, c, nd) if nd else None
    path_ok = (where is None) or (p in where)
    out = git(repo, 'log', '-1', '--first-parent', '--format=%H %cs %as', c, '--', p).split()
    h, cd, ad = out
    exp = cd; rng = None
    for kk, (dd, rr) in OVR.items():
        if h.startswith(kk) and kk in ('39c0550', '1c16baeb0'): exp, rng = dd, rr
    full = git(repo, 'log', '-1', '--format=%H %cs', c, '--', p).split()
    ok = path_ok and h.startswith(fc['commit']) and exp == fc['date'] and (rng == fc.get('range')) and (bool(fr.get('approx')) == bool(fc.get('approx'))) and exp <= fr['date'] if not fr.get('date_range') else path_ok and h.startswith(fc['commit']) and exp == fc['date']
    line = (f"{'OK ' if ok else 'BAD'} {it['kind']:7s} {fr['lane']:15s} frame {c[:9]} {fr['date']} | {p} | rec {fc['commit'][:9]} {fc['label']} | "
            f"recomputed {h[:9]} cs {cd} as {ad}{' -> ' + exp + ' ' + rng if rng else ''} | no-first-parent {full[0][:9]} {full[1]}"
            f"{'' if path_ok else ' | PATH not among grep hits ' + str(where[:4])}{' | grep hits ' + str(len(where)) if where is not None else ''} | {(it.get('text') or it.get('title'))[:50]!r}")
    return ok, line
lines = []
for it, k in sample:
    key = (id(it), k)
    if key in seen: continue
    seen.add(key); ok, l = check(it, k); res[ok] += 1; lines.append(l)
# origins: 12 random items + all override-origin items
oi = random.sample(A['items'], 12) + [it for it in A['items'] if (it.get('origin_file') or {}).get('range')][:6]
for it in oi:
    ok, l = check(it, 0, origin=True); res[ok] += 1; lines.append('origin ' + l)
print('\n'.join(lines)); print(dict(res))

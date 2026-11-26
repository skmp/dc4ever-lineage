#!/usr/bin/env python3
"""verify1: every stop_files / origin_file / first_file entry of data/attract.json: recompute the last change
(git log -1 --first-parent <frame> -- <path>), override dates, approx flags, date <= frame date, count stops."""
import os, sys, json, subprocess, collections
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools')); import frames as FR
A = json.load(open(os.path.join(ROOT, 'data/attract.json')))
SEL = {f['i']: f for f in json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))['frames']}
REPO = {L[0]: L[1] for L in FR.LANES}
OVR = {'39c0550': ('2009-10-16', '2008-2010'), '1c16baeb0': ('2013-12-19', '2012-2013')}
jobs = []
for it in A['items']:
    assert len(it['stop_files']) == len(it['stops']), it.get('title')
    for st, fc in zip(it['stops'], it['stop_files']): jobs.append((it, SEL[st[0]], fc, 'stop'))
    of = it.get('origin_file') if it['kind'] != 'file' else it.get('first_file')
    fr = SEL[it['origin']] if it['kind'] != 'file' else SEL[it['stops'][0][0]]
    jobs.append((it, fr, of, 'origin'))
def run(j):
    it, fr, fc, w = j
    if fr.get('virtual'): return ('virtual', fc == {'label': '2005-2008', 'date': '2005-2008'}, j)
    if fc is None: return ('null', False, j)
    out = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', REPO[fr['lane']] + '.git'), 'log', '-1', '--first-parent', '--format=%H %cs', fr['commit'], '--', fc['path']], capture_output=True, text=True).stdout.split()
    if len(out) != 2: return ("nogit", False, j)
    h, d = out; rng = None
    for k, (dd, rr) in OVR.items():
        if h.startswith(k): d, rng = dd, rr
    ok = h.startswith(fc['commit']) and d == fc['date'] and rng == fc.get('range') and bool(fr.get('approx')) == bool(fc.get('approx')) and (d <= fr['date'])
    lab = (f'{rng} (dated {d})' if rng else d) + (' (approx.)' if fr.get('approx') else '')
    ok = ok and lab == fc['label']
    return ('ok' if ok else 'bad', ok, j)
with ThreadPoolExecutor(16) as ex: R = list(ex.map(run, jobs))
c = collections.Counter((r[0], r[1]) for r in R); print(c)
for k, ok, (it, fr, fc, w) in R:
    if not ok: print('BAD', w, fr['lane'], fr['commit'][:9], fc, (it.get('text') or it.get('title'))[:50])
# how many stops now show a date different from the frame date
diff = sum(1 for k, ok, (it, fr, fc, w) in R if w == 'stop' and fc and fc['date'] != fr['date'])
print('stops', sum(1 for r in R if r[2][3] == 'stop'), 'whose file date differs from the frame date', diff)

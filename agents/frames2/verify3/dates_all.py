#!/usr/bin/env python3
"""verify3: recompute EVERY stored tour date (stop_files, origin_file, first_file) independently (see dates_check.py)."""
import os, sys
sys.argv = [sys.argv[0], '1']
here = os.path.dirname(os.path.abspath(__file__)); src = open(os.path.join(here, 'dates_check.py')).read().split('random.seed')[0]
exec(src)
bad = 0; n = 0; nov = 0; nappr = 0; ndiff = 0; shared = 0
for i, it in enumerate(A):
    ents = [(s[0], sf) for s, sf in zip(it['stops'], it['stop_files'])]
    if it.get('origin_file'): ents.append((it['origin'], it['origin_file']))
    for f, got in ents:
        fr = FRM[f]
        if fr.get('virtual') or 'virtual' in fr['kinds']:
            ok = got.get('date') == '2005-2008'
        else:
            e = expect(f, got['path'])
            ok = got['date'] == e['date'] and got['commit'] == e['commit'] and got.get('range') == e.get('range') and bool(got.get('approx')) == bool(e.get('approx'))
            nov += 'range' in e; nappr += bool(e.get('approx')); ndiff += got['date'] != fr['date']
            if fr['lane'] in ('flycast', 'nulldc3', 'nullDC4WiiU'):
                sh = D['lanes'][[l['name'] for l in D['lanes']].index(fr['lane'])]['shared_until']
                r = git(REPO[fr['lane']], 'merge-base', '--is-ancestor', got['commit'], sh) if sh else None
                if sh and subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', REPO[fr['lane']] + '.git'), 'merge-base', '--is-ancestor', e['commit'], sh]).returncode == 0: shared += 1
        n += 1
        if not ok: bad += 1; print('MISMATCH', i, f, got, e)
print(f'all dates: {n} checked, {bad} mismatches; override ranges {nov}; dc4ever approx {nappr}; differ from frame date {ndiff}; last change in shared history (flycast/nulldc3/nullDC4WiiU) {shared}')

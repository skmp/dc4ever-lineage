# sample tour stops: stop_files[k].date == git log -1 --first-parent --format=%cs <frame commit> -- <path>, and the
# stop's frame commit/lane match; the "first seen" date likewise at the origin frame. Random 60 stops, fixed seed.
import json, random, subprocess, os, sys
sys.path.insert(0, 'tools'); 
LANES = {}
src = open('tools/frames.py').read(); exec(src[src.index('LANES = ['):src.index('# dense lanes')], {}, LANES)
REPO = {l[0]: l[1] for l in LANES['LANES']}
A = json.load(open('data/attract.json')); F = json.load(open('data/frames.json'))['frames']
OV = {'39c055006291': '2008-2010', '1c16baeb0eae': '2012-2013'}
def last(repo, c, p):
    return subprocess.run(['git', '-C', f'repos/{repo}.git', 'log', '-1', '--first-parent', '--format=%H %cs', c, '--', p], capture_output=True, text=True).stdout.split()
rnd = random.Random(7); pool = []
for it in A['items']:
    for k, st in enumerate(it['stops']): pool.append((it, k, st))
bad = ok = diff = 0
for it, k, st in rnd.sample(pool, 60):
    fr = F[st[0]]; fc = it['stop_files'][k]; repo = REPO[fr['lane']]
    if not fr['commit'].startswith(fc['commit'][:12]) and not fc['commit'].startswith(fr['commit'][:12]):
        pass
    h, d = last(repo, fr['commit'], fc['path'])
    want = OV.get(h[:12])
    good = (fc.get('range') == want and fc['date']) if want else (fc['date'] == d and h.startswith(fc['commit']))
    if good: ok += 1
    else: bad += 1; print('BAD', fr['lane'], fr['date'], fc, h[:12], d)
    if fc['date'] != fr['date']: diff += 1
print(f'stops ok {ok} bad {bad}; differ from frame date {diff}/60')

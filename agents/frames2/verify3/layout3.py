# verify3: independent layout check from data/layout.json.gz + data/frames.json (mirrors core.timeMaps, not viewer_prep)
import json, gzip, bisect, collections, sys
L = json.load(gzip.open('data/layout.json.gz')); F = json.load(open('data/frames.json'))
fr = F['frames']; U = L['unit']['month']; K = L['time']['knots']; y0, m0 = map(int, L['time']['month0'].split('-'))
MS = [k[0] for k in K]; XS = [k[1] for k in K]
def mon(d):
    p = list(map(int, d[:10].split('-'))); return (p[0]-y0)*12 + (p[1]-m0) + ((p[2] if len(p) > 2 else 1)-1)/31
def xom(m):
    if m <= K[0][0]: return K[0][1] + (m-K[0][0])*U
    if m >= K[-1][0]: return K[-1][1] + (m-K[-1][0])*U
    i = bisect.bisect_right(MS, m)-1; (a, xa), (b, xb) = K[i], K[i+1]; return xa + (xb-xa)*(m-a)/(b-a)
def mox(x):
    if x <= K[0][1]: return K[0][0] + (x-K[0][1])/U
    if x >= K[-1][1]: return K[-1][0] + (x-K[-1][1])/U
    i = bisect.bisect_right(XS, x)-1; (a, xa), (b, xb) = K[i], K[i+1]; return a + (b-a)*(x-xa)/max(1e-9, xb-xa)
def dom(mm):
    t = int(mm + 1e-3 // 1) if False else int((mm + 1e-3) // 1); y = y0 + (m0-1+t)//12; m = (m0-1+t) % 12 + 1; return f'{y}-{m:02d}'
err = collections.Counter()
print('knots', len(K), 'strict months', all(K[i][0] < K[i+1][0] for i in range(len(K)-1)), 'strict x', all(K[i][1] < K[i+1][1] for i in range(len(K)-1)))
W = {w['frame']: w for w in L['walls']}
nonvirt = [f for f in fr if not f.get('virtual') and f['lane'] in [l['name'] for l in L['lanes']]]
print('walls', len(W), 'frames in frames.json', len(fr), 'lanes', len(L['lanes']))
mins = {}
for li, ln in enumerate(L['lanes']):
    fs = ln['frames']; miss = [f for f in fs if f not in W]
    if miss: err['lane frame without wall'] += len(miss)
    xs = [W[f]['x'] for f in fs]; ds = [fr[f]['date'] for f in fs]; ks = [fr[f]['k'] for f in fs]
    if any(W[f]['lane'] != li or fr[f]['lane'] != ln['name'] for f in fs): err['lane mismatch'] += 1
    if ks != sorted(ks): err['k order'] += 1
    for i in range(len(fs)-1):
        if ds[i] > ds[i+1]: err['date order'] += 1; print(' date order', ln['name'], ds[i], ds[i+1])
        if xs[i+1] - xs[i] < 500: err['gap<500'] += 1; print(' gap', ln['name'], fs[i], xs[i], xs[i+1])
    g = [xs[i+1]-xs[i] for i in range(len(xs)-1)]
    mins[ln['name']] = (len(fs), min(g) if g else None, max(g) if g else None)
    for f in fs:
        d = fr[f]['date']; x = W[f]['x']; a, b = xom(mon(d)), xom(mon(d)+1/31)
        if not (a-1 <= x <= b+1): err['wall outside its day'] += 1
        if dom(mox(x)) != d[:7]: err['clock month != frame month'] += 1; print(' clock', ln['name'], d, dom(mox(x)))
for k, v in mins.items(): print(f'  {k:16s} walls {v[0]:4d} gap min {v[1]} max {v[2]}')
print('total walls in lanes', sum(v[0] for v in mins.values()))
# ruler
for r in L['ruler']:
    if 'year' in r:
        if r['year'] != 2004 and abs(r['x'] - xom(mon(f"{r['year']}-01-01"))) > 2: err['year x'] += 1; print(' year', r)
    elif 'month' in r:
        if abs(r['x'] - xom(mon(r['month']+'-01'))) > 2: err['month tick x'] += 1; print(' month', r)
    else:
        lo, hi = mon(r['from']+'-01'), mon(r['to']+'-01')
        inside = [f for f, w in W.items() if lo + 1 <= mon(fr[f]['date']) < hi - 0]
        print(' gap', r, 'x month', dom(mox(r['x'])), 'walls dated strictly inside', len(inside))
# year lines: no wall dated year Y on the left of its line
yl = {r['year']: r['x'] for r in L['ruler'] if 'year' in r}
for f, w in W.items():
    y = int(fr[f]['date'][:4])
    if y in yl and y != 2004 and w['x'] < yl[y]: err['wall left of own year line'] += 1
    if y+1 in yl and w['x'] > yl[y+1]: err['wall right of next year line'] += 1
# releases: pin frames dated <= release date and of the pinned commit
for r in L['releases']:
    for f in r['frames']:
        if fr[f]['date'] > r['date']: err['release frame after date'] += 1
        if not any(fr[f]['commit'].startswith(r[k]) or r[k].startswith(fr[f]['commit'][:7]) for k in ('dreamster', 'polly2', 'minicast') if r.get(k)):
            err['release frame commit'] += 1; print(' rel', r['tag'], f, fr[f]['lane'], fr[f]['commit'])
xs_all = [w['x'] for w in W.values()]; print('extent', min(xs_all), max(xs_all), 'months', round((max(xs_all)-min(xs_all))/U, 1))
print('ERRORS', dict(err) or 0)

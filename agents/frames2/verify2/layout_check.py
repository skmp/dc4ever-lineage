# independent layout check from data/layout.json.gz + data/frames.json (no viewer code)
import json, gzip, bisect, datetime as dt, collections
L = json.load(gzip.open('data/layout.json.gz')); F = json.load(open('data/frames.json'))
fr = F['frames']; U = L['unit']['month']; kn = L['time']['knots']; m0 = L['time']['month0']
y0, mo0 = map(int, m0.split('-'))
print('knots', len(kn), 'month strictly increasing', all(kn[i][0] < kn[i+1][0] for i in range(len(kn)-1)), 'x non-decreasing', all(kn[i][1] <= kn[i+1][1] for i in range(len(kn)-1)), 'flat (zero-width) segments', sum(kn[i][1] == kn[i+1][1] for i in range(len(kn)-1)))
def mon(d):  # month index (fractional) of a date
    y, m, dd = map(int, d[:10].split('-')); import calendar
    return (y - y0) * 12 + (m - mo0) + (dd - 1) / 31   # same day fraction as viewer_prep / core.js
def xof(mi):
    ms = [k[0] for k in kn]; i = bisect.bisect_right(ms, mi) - 1; i = max(0, min(i, len(kn) - 2))
    (a, xa), (b, xb) = kn[i], kn[i+1]; return xa + (mi - a) * (xb - xa) / (b - a)
def mofx(x):
    xs = [k[1] for k in kn]; i = bisect.bisect_right(xs, x) - 1; i = max(0, min(i, len(kn) - 2))
    (a, xa), (b, xb) = kn[i], kn[i+1]; return a + (x - xa) * (b - a) / (xb - xa)
W = {w['frame']: w for w in L['walls']}
bad = 0; mg = 1e9; perlane = {}; stretch = []
for ln in L['lanes']:
    fs = [f for f in ln['frames'] if f in W]; xs = [W[f]['x'] for f in fs]; ds = [fr[f]['date'] for f in fs]
    g = [xs[i+1] - xs[i] for i in range(len(xs)-1)]
    if any(v < 500 for v in g) or any(ds[i] > ds[i+1] for i in range(len(ds)-1)): bad += 1; print('BAD', ln['name'])
    mg = min(mg, min(g) if g else 1e9); perlane[ln['name']] = (len(fs), min(g) if g else None)
# wall x vs its date: the wall must sit inside its own day [x(d), x(d+1)) (same-day frames split the day)
off = 0; worst = 0
for f, w in W.items():
    d = fr[f]['date'][:10]; dd = dt.date.fromisoformat(d); n = (dd + dt.timedelta(days=1)).isoformat()
    a, b = xof(mon(d)), xof(mon(d) + 1/31)
    if not (a - 1 <= w['x'] <= b + 1): off += 1; worst = max(worst, min(abs(w['x'] - a), abs(w['x'] - b)))
print('walls', len(W), 'lanes bad', bad, 'min gap', mg, 'walls outside own day', off, 'worst', round(worst))
for k, v in perlane.items(): print(f'  {k:16s} walls {v[0]:4d} min gap {v[1]}')
# cross-lane coincidence: walls of different lanes at identical x (allowed, different z) – count only
c = collections.Counter(w['x'] for w in W.values()); print('x shared by >1 wall (any lane):', sum(1 for v in c.values() if v > 1))
print('extent', min(w['x'] for w in W.values()), max(w['x'] for w in W.values()))
# stretch factors per month
for i in range(len(kn)-1):
    s = (kn[i+1][1] - kn[i][1]) / ((kn[i+1][0] - kn[i][0]) * U)
    if s > 1.01: stretch.append(s)
print('stretched knot segments', len(stretch), 'max factor', round(max(stretch), 1))

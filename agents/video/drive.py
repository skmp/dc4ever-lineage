#!/usr/bin/env python3
# drive.py: the score's drive along the video timeline (3 stills a second) -> agents/video/drive.json, every 0.5 s,
# for LOOP extra seconds past the end that repeat the start (so the rendered tail can be crossfaded into the head).
import json, datetime as dt
O = json.load(open('agents/video/order.json')); N = len(O); PER = 1 / 3; DUR = N * PER; LOOP = 8
def year(e): d = dt.datetime.fromtimestamp(e, dt.timezone.utc); return d.year + (d.timetuple().tm_yday - 1) / 366
forks = [0] * N; c = 0
for k, r in enumerate(O):
    if any(x in ('fork', 'import') for x in (r.get('kinds') or [])): c += 1
    forks[k] = c
out = []; t = 0.0
while t < DUR + LOOP:
    k = int(t / PER) % N; r = O[k]
    out.append({'t': round(t, 3), 'year': round(year(r['epoch']), 3), 'fork': forks[k] if t < DUR else 0, 'density': round(min(1, r['lines'] / 150000), 3), 'arc': 0})
    t += 0.5
json.dump(out, open('agents/video/drive.json', 'w'))
print(f'{N} stills, {DUR:.3f} s + {LOOP} s tail, {len(out)} drive points, {c} forks/imports')

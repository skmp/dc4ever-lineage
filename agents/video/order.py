#!/usr/bin/env python3
# order.py: every wall frame in true chronological order (commit timestamp, UTC), with its timestamp as committed
# -> agents/video/order.json. Frames whose date was overridden (imports with a known real date) or approximate (dc4ever
# file mtimes) keep the frame's date at 12:00 and say so.
import json, subprocess, datetime as dt
F = json.load(open('data/frames.json')); repo = {l['name']: l['repo'] for l in F['lanes']}
out = []
for fr in F['frames']:
    if fr.get('virtual') or not fr.get('commit'): continue
    g = f"repos/{repo[fr['lane']]}.git"
    iso = subprocess.run(['git', '-C', g, 'show', '-s', '--format=%cI', fr['commit']], capture_output=True, text=True).stdout.strip()
    t = dt.datetime.fromisoformat(iso) if iso else None
    over = t is None or t.date().isoformat() != fr['date']
    if over: t = dt.datetime.fromisoformat(fr['date'] + 'T12:00:00+00:00')
    out.append({'f': fr['i'], 'lane': fr['lane'], 'epoch': t.timestamp(), 'stamp': t.strftime('%Y-%m-%d %H:%M:%S %z') if not over else fr['date'],
                'approx': bool(fr.get('approx')) or over, 'commit': fr['commit'][:8], 'tags': fr.get('tags'), 'kinds': fr.get('kinds'), 'lines': fr.get('lines', 0)})
out.sort(key=lambda r: (r['epoch'], r['f']))
json.dump(out, open('agents/video/order.json', 'w'), indent=0)
print(len(out), 'frames;', sum(r['approx'] for r in out), 'approx;', out[0]['stamp'], '->', out[-1]['stamp'])

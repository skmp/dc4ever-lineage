#!/usr/bin/env python3
"""prov_query.py SNAPID PATH [LINE..|grep:TEXT]  print raw line, origin, keep from data/ (format check / spot checks)."""
import sys, os, json, gzip, struct, functools
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
man = json.load(open(os.path.join(D, 'manifest.json')))
CH = man['chunk_lines']
@functools.lru_cache(None)
def chunk(c): return gzip.open(os.path.join(D, f'text/lines-{c:03d}.txt.gz')).read().split(b'\n')
@functools.lru_cache(None)
def pres(c): return gzip.open(os.path.join(D, f'text/presence-{c:03d}.bin.gz')).read()
def text(i): return chunk(i // CH)[i % CH].decode('utf-8', 'replace')
def presence(i): return struct.unpack_from('<Q', pres(i // CH), (i % CH) * 8)[0]
def snap(sid):
    i = next(s['i'] for s in man['snapshots'] if s['id'] == sid)
    j = json.load(gzip.open(os.path.join(D, f'snap/{i:02d}.json.gz')))
    b = gzip.open(os.path.join(D, f'snap/{i:02d}.bin.gz')).read(); n = sum(f['n'] for f in j['files'])
    ids = struct.unpack_from(f'<{n}I', b, 0); og = b[4*n:5*n]; kp = b[5*n:6*n]
    off = 0
    for f in j['files']: f['off'] = off; off += f['n']
    return i, j, ids, og, kp
if __name__ == '__main__':
    sid, path = sys.argv[1], sys.argv[2]
    i, j, ids, og, kp = snap(sid)
    f = next(f for f in j['files'] if f['p'] == path)
    sel = sys.argv[3:]
    for l in range(f['n']):
        t = text(ids[f['off'] + l])
        if sel and not any((s.startswith('grep:') and s[5:] in t) or s == str(l + 1) for s in sel): continue
        o = og[f['off'] + l]; k = kp[f['off'] + l]
        pm = presence(ids[f['off'] + l]); ps = [man['snapshots'][x]['id'] for x in range(len(man['snapshots'])) if pm >> x & 1]
        print(f"{l+1:5d} origin={man['origins'][o]:20s} keep={k:3d} | {t.strip()[:100]}")
        print('       present in:', ' '.join(ps))

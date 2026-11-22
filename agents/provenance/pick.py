# pick.py SNAP ORIGIN [N]: random unique-ish non-trivial lines of SNAP whose origin is ORIGIN
import sys, random; sys.path.insert(0, 'tools')
from prov_query import man, snap, text, presence
sid, org = sys.argv[1], sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 3
i, j, ids, og, kp = snap(sid); oi = man['origins'].index(org)
c = []
for f in j['files']:
    for l in range(f['n']):
        k = f['off'] + l
        if og[k] == oi and kp[k] != 255:
            t = text(ids[k]).strip()
            if len(t) >= 30 and '"' not in t[:1]: c.append((f['p'], l + 1, kp[k], t))
random.seed(7); random.shuffle(c)
for p, l, k, t in c[:N]: print(f'{p}:{l} keep={k} | {t[:120]}')

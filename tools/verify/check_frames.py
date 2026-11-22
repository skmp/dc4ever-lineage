#!/usr/bin/env python3
"""check_frames.py [DATA]: decode every lane's chunks the way a viewer would (keyframe + deltas) and check, for
every frame, that each file's text equals the blob in git, that keep <= possible, and that origins are not later
than the frame holding the line. Prints a summary; exits 1 on any mismatch. About 1 minute."""
import json, gzip, os, sys, struct, subprocess, collections
from array import array
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
D = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data'))
man = json.load(open(os.path.join(D, 'frames.json')))
CH = man['chunk_lines']
text = []
for c in range(man['text_chunks']):
    t = gzip.open(os.path.join(D, f'text/lines-{c:03d}.txt.gz')).read().split(b'\n')
    text.extend(t[:min(CH, man['raw_lines'] - c * CH)])
assert len(text) == man['raw_lines']
FR = man['frames']; poss = man['possible']
sel = {f['i']: f for f in json.load(open(os.path.join(ROOT, 'agents/frames/frames.json')))['frames']}
files_tsv = collections.defaultdict(dict)
for l in open(os.path.join(ROOT, 'agents/frames/work/files.tsv')):
    g, sha, p = l.rstrip('\n').split('\t'); files_tsv[int(g)][p] = sha

def blob_lines(repo, shas):
    p = subprocess.Popen(['git', '-C', os.path.join(ROOT, 'repos', repo + '.git'), 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    import threading
    threading.Thread(target=lambda: (p.stdin.write(('\n'.join(shas) + '\n').encode()), p.stdin.close())).start()
    out = {}
    for s in shas:
        hdr = p.stdout.readline(); n = int(hdr.split()[2]); d = p.stdout.read(n); p.stdout.read(1)
        ls = d.split(b'\n')
        if d.endswith(b'\n'): ls = ls[:-1]
        out[s] = [x[:-1] if x.endswith(b'\r') else x for x in ls] if d else []
    p.wait(); return out

bad = 0; checked_files = 0; checked_lines = 0; keepmax = 0; frames_ok = 0
lane_idx = {L['name']: i for i, L in enumerate(man['lanes'])}
for L in man['lanes']:
    repo = L['repo']; li = lane_idx[L['name']]
    shas = sorted({s for g in L['frames'] for s in files_tsv[g].values()})
    blines = blob_lines(repo, shas)
    state = {}   # ident -> [path, [(raw, org, keep)], dom]
    for ci, (g0, g1, _) in enumerate(L['chunks']):
        j = json.load(gzip.open(os.path.join(D, f"lanes/{L['name']}/c{ci:03d}.json.gz")))
        b = gzip.open(os.path.join(D, f"lanes/{L['name']}/c{ci:03d}.bin.gz")).read()
        for fr in j['frames']:
            g = fr['f']; off = fr['off']; nw, nl = fr['nw'], fr['nl']
            words = array('I', b[off:off + 4 * nw]); off += 4 * nw
            raws = array('I', b[off:off + 4 * nl]); off += 4 * nl
            orgs = array('H', b[off:off + 2 * nl]); off += 2 * nl
            keeps = array('H', b[off:off + 2 * nl])
            if fr['key']: state = {}
            wp = lp = 0
            for op in fr['ops']:
                kind, ident, path, n = op[0], op[1], op[2], op[3]
                if kind == 'D': state.pop(ident); continue
                status, dom, kept, added, removed, frm, ns, ni = op[4:12]
                ins = [(raws[lp + q], orgs[lp + q], keeps[lp + q]) for q in range(ni)]; lp += ni
                if kind in ('K', 'A'):
                    state[ident] = [path, ins, dom]
                else:
                    old = state[ident][1]; new = []; x = y = 0
                    for w in words[wp:wp + ns]:
                        o, c = w >> 30, w & 0x3FFFFFFF
                        if o == 0: new.extend(old[x:x + c]); x += c
                        elif o == 1: x += c
                        else: new.extend(ins[y:y + c]); y += c
                    assert x == len(old) and y == len(ins), (L['name'], g, path)
                    state[ident] = [path, new, dom]
                wp += ns
                assert len(state[ident][1]) == n, (L['name'], g, path, len(state[ident][1]), n)
            assert wp == nw and lp == nl
            # compare with git
            want = files_tsv[g]
            have = {v[0]: v for v in state.values()}
            if set(have) != set(want):
                print('FILESET', L['name'], g, sorted(set(have) ^ set(want))[:5]); bad += 1; continue
            ok = True
            for p, v in have.items():
                t = [text[r] for r, o, k in v[1]]
                if t != blines[want[p]]:
                    print('TEXT', L['name'], g, p); bad += 1; ok = False; continue
                for r, o, k in v[1]:
                    if k == 0xFFFF: continue
                    if o > g and not FR[o].get('virtual'): print('ORIGIN-LATER', L['name'], g, p, o); bad += 1; ok = False; break
                    if k > poss[o][li]: print('KEEP>POSSIBLE', L['name'], g, p, o, k, poss[o][li]); bad += 1; ok = False; break
                    keepmax = max(keepmax, k)
                checked_files += 1; checked_lines += len(v[1])
            frames_ok += ok
    print(f"{L['name']:16s} {len(L['frames']):4d} frames ok", flush=True)
print(f'checked {frames_ok} frames, {checked_files} file versions, {checked_lines} line instances; max keep {keepmax}; {bad} problems')
sys.exit(1 if bad else 0)

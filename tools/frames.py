#!/usr/bin/env python3
"""frames.py: choose the time frames of every lane and list their counted source files (FOLLOWUP item 0).

A lane is one line of development (a repo branch). Its frames are:
  - month : the last commit of every calendar month in which the lane's first-parent chain has commits
            (committer date); a month whose counted source equals the previous frame's is dropped;
  - commit: sparse lanes (every lane not in DENSE): every lane-local first-parent commit; a commit whose counted
            source equals the previous frame's is dropped, so these are the commits that change counted source;
  - big   : dense lanes (DENSE: nullDC4Wii, reicast, flycast), on top of the month frames: every commit whose counted
            churn (lines added + removed in counted, non-vendored files, git numstat against the first parent) is
            >= big_threshold(lines) (BIG_MIN lines or BIG_PCT of the lane's counted lines at that point, whichever is
            larger) together with the commit before it, so that step is the big commit alone; and a commit where the
            churn accumulated since the previous frame candidate reaches that threshold. Dropped like month frames when
            the counted source equals the previous frame's;
  - tag   : every release / tag of the lane (kept even when the source did not change);
  - pin   : DreamSTer release pins (polly2-rtl and minicast submodule commits of each DreamSTer tag);
  - fork  : commits another lane was forked / imported from, so a child's parent state is an exact frame;
  - import: the import commit of an imported snapshot (reicast project import, nullDC4Wii first source commit, ...).
dc4ever's history was rebuilt in 2019 as one commit per file at its file mtime, so its frames are marked approx.

Outputs (agents/frames/):
  frames.json          every frame: lane, commit, date, kinds, tags, approx, lane-local index
  work/frames.tsv      gi lane repo commit date lane_k            (input of tools/provenance/frames)
  work/files.tsv       gi sha path                                (counted 'own' files, rules.py)
  work/lanes.tsv       lane repo  code_parents  related  copy_parents   (lane graph, see LANE_EDGES)
"""
import os, sys, json, re, subprocess, collections, time
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
from rules import lang_of, is_vendored, is_generated
REPOS = os.path.join(ROOT, 'repos')
OUT = os.path.join(ROOT, 'agents', 'frames')

# lane, repo, tip ref, options
LANES = [
    ('dc4ever', 'skmp_dc4ever', 'master', {'approx': True}),
    ('nullDC', 'skmp_nullDC', 'master', {}),
    ('nulldc-360', 'gligli_nulldc-360', 'master', {}),
    ('HarissaDC', 'kernel64_HarissaDC', 'main', {'tags': r'^v\d'}),
    ('nullDCe', 'skmp_nullDCe', 'skmp/ps2', {'date': {'39c0550': ('2009-10-16', '2008-2010', 'recovered archive committed 2017-11-20; latest in-source date 2009-10-16')}}),
    ('nullDCe-PSP', 'PSP-Archive_nulldce-psp', 'Experimental-builds', {}),   # = main + the 2021-10-17 vbaARM.h fix
    ('nullDC4Wii', 'BenoitAdam_nullDC4Wii', 'main', {'tags': r'.'}),
    ('NotDC-PS3', 'Mayo1970_NotDC-PS3', 'main', {'tags': r'.'}),
    ('nullDC4WiiU', 'nulldc4wiiu_nulldc_wiiu', 'main', {'tags': r'.', 'not_in': 'BenoitAdam_nullDC4Wii'}),
    ('reicast', 'skmp_reicast-emulator', 'alpha', {'tags': r'^r\d',
        'date': {'1c16baeb0': ('2013-12-19', '2012-2013', 'project import of the private newdc / nullDC-Android rewrite of 2012-2013')}}),
    ('flycast', 'flyinghead_flycast', 'master', {'tags': r'^[vV]\d', 'not_in': 'skmp_reicast-emulator'}),
    ('nulldc3', 'skmp_nulldc3', 'skmp/refsw3', {'tags': r'.', 'not_in': 'skmp_reicast-emulator'}),
    ('minicast', 'skmp_minicast', 'main', {}),
    ('polly2', 'skmp_polly2-rtl', 'main', {}),
    ('polly2-r8', 'skmp_polly2-rtl', 'r8/develop', {}),
    ('devtools', 'skmp_dreamcast-devtools', 'main', {'tags': r'.'}),
    ('dreamcast-tests', 'fpgadc_dreamcast-tests', 'main', {}),
    ('shrike4', 'skmp_shrike4-rtl', 'main', {}),
    ('caique', 'skmp_caique-rtl', 'main', {}),
    ('wren7', 'skmp_wren7-rtl', 'main', {}),
]
# dense lanes (> 250 source-changing lane-local commits): months + marked + big-churn frames; every other lane: every commit
DENSE = {'nullDC4Wii', 'reicast', 'flycast'}
BIG_MIN, BIG_PCT = 1500, 0.03
def big_threshold(lines): return max(BIG_MIN, BIG_PCT * lines)
DROPPABLE = {'month', 'commit', 'big'}   # kinds whose frame is dropped when its counted source equals the previous frame's
# fork / import points: (lane, commit, label). The child lane's first frame inherits this frame (LANE_EDGES).
FORKS = [
    ('nullDC', 'c563e07', 'nulldc-360 / reicast import base'),
    ('nullDCe', '39c0550', 'reicast import base'),
    ('nullDCe', 'bad8d6a', 'nullDC4Wii import base'),
    ('reicast', '95b673698', 'nullDC 3 branch point'),
    ('nullDC4Wii', '9659506', 'NotDC-PS3 import base'),
    ('nulldc3', 'd5d4eae1', 'minicast import base'),
    ('caique', '5aa2376', 'NotDC-PS3 plugs/caiqueAICA port base'),
    ('reicast', 'a6b773a23', "flycast's last merge from reicast (2019-05-17)"),
]
# imported snapshots: the import commit itself is a frame (kind 'import'), so the imported state is exact
IMPORTS = [
    ('nulldc-360', '0330292', 'initial import: nullDC 1.0.x svn trunk + Xbox 360 work'),
    ('reicast', '1c16baeb0', 'project import: the private newdc / nullDC-Android rewrite (2012-2013)'),
    ('nullDC4Wii', 'e812c58', 'first source commit: nullDCe main bad8d6a verbatim'),
    ('NotDC-PS3', '5a32b94', 'initial repo: nullDC4Wii ~9659506'),
    ('minicast', '580d7b8', 'initial import: nullDC 3 fpgadc commits (2023-08 .. 2024-07)'),
    ('nullDC', '761dc87', 'first complete public tree (Google Code svn, 2010-05)'),
    ('nullDCe-PSP', '95b5a20', 'first upload: nullDCe 39c0550 PSP tree restored to build (xiro, hlide, 2021)'),
]
# DreamSTer releases: tag, date, DreamSTer commit, polly2-rtl pin, minicast pin (skmp/DreamSTer submodules)
RELEASES = [('r1', '2026-07-17', 'd87e716', 'be391db', '697f565'), ('r2', '2026-07-17', 'fa11f4b', '7a70d24', '6fcc0e1'),
            ('r2b', '2026-07-17', '8a6e2c3', '635ec79', '6fcc0e1'), ('r3', '2026-07-17', '8f0a7ff', '436372f', '585205b'),
            ('r4', '2026-07-18', '034573c', 'c22506c', '0998288'), ('r5', '2026-07-18', '034573c', 'c22506c', '0998288'),
            ('r6', '2026-07-30', 'f31c158', 'a37f92c', '450eb49'), ('r6b', '2026-10-24', '2a3c169', '95fc3ba', '9185ab8')]
# Lane graph. code: the child starts from the parent's state at the fork commit and everything before it counts as
# ancestry ("any file"). related: concept / partial-copy relations; only files sharing >= MINSHARE significant lines
# count. merge: ancestry up to that commit, no state inherited. copy: a related edge along which code was copied verbatim, so it also counts for survival (keep).
LANE_EDGES = {  # child: [(parent lane, kind, parent commit or None = parent's latest frame at the child's time)]
    'nulldc-360': [('nullDC', 'code', 'c563e07')],
    'reicast': [('nullDC', 'code', 'c563e07'), ('nullDCe', 'code', '39c0550'), ('dc4ever', 'related', None)],
    'flycast': [('reicast', 'code', 'FORK'),           # FORK: the last flycast first-parent commit also on reicast alpha
                ('reicast', 'merge', 'a6b773a23')],    # merge: ancestry only (flycast merged reicast until 2019-05-17)
    'nulldc3': [('reicast', 'code', '95b673698')],
    'minicast': [('nulldc3', 'code', 'd5d4eae1')],
    'nullDC4Wii': [('nullDCe', 'code', 'bad8d6a')],
    'NotDC-PS3': [('nullDC4Wii', 'code', '9659506'), ('caique', 'copy', None)],
    'nullDC4WiiU': [('nullDC4Wii', 'code', 'FORK')],   # git fork of nullDC4Wii (last shared commit 1459ccb, 2026-10-25)
    'HarissaDC': [('nullDC4Wii', 'related', None), ('nulldc-360', 'related', None), ('flycast', 'related', None)],   # studied, not copied (CREDITS.md)
    'nullDCe-PSP': [('nullDCe', 'code', '39c0550'),   # the 2009 PSP subset of the recovered archive, restored in 2021
                    ('reicast', 'copy', None),        # FSCA table, image readers, sh4_sched, ssa_regalloc.h
                    ('flycast', 'copy', None),        # shil / ssa passes, gdromv3 fixes
                    ('nullDC', 'copy', None),         # vbaARM ARM7 (arm-new.h identical), nullAICA
                    ('nulldc-360', 'copy', None)],    # weakest: nullAICA / SoundOut / threaded lines only it has
    'nullDCe': [('dc4ever', 'related', None)],
    'nullDC': [('dc4ever', 'related', None)],
    'polly2': [('nulldc3', 'related', None)],
    'polly2-r8': [('nulldc3', 'copy', None), ('polly2', 'related', None)],
    'devtools': [('nulldc3', 'related', None), ('nullDC', 'copy', None), ('reicast', 'copy', None)],
    'shrike4': [('nulldc3', 'related', None)],
    'caique': [('nulldc3', 'related', None), ('shrike4', 'related', None)],
    'wren7': [('caique', 'related', None), ('nulldc3', 'related', None)],
    'dreamcast-tests': [('nulldc3', 'related', None), ('polly2', 'related', None), ('shrike4', 'related', None), ('caique', 'related', None)],
}

def git(repo, *a, inp=None):
    return subprocess.run(['git', '-C', os.path.join(REPOS, repo + '.git'), *a], capture_output=True, input=inp, check=True).stdout

def chain(repo, tip):
    """first-parent chain of tip, oldest first: (sha, committer date, subject)"""
    out = git(repo, 'log', '--first-parent', '--reverse', '--format=%H %cs', tip).decode().split('\n')
    return [tuple(l.split(' ', 1)) for l in out if l]

def resolve(repo, ref):
    return git(repo, 'rev-parse', ref + '^{commit}').decode().strip()

def cdate(repo, sha):
    return git(repo, 'log', '-1', '--format=%cs', sha).decode().strip()

def tree_files(repo, sha):
    """counted source candidates of a commit: [(path, blob, size)] minus vendored (path rules)"""
    out = git(repo, 'ls-tree', '-r', '-z', '--long', sha)
    r = []
    for rec in out.split(b'\0'):
        if not rec: continue
        meta, path = rec.split(b'\t', 1); m = meta.split()
        if m[1] != b'blob': continue
        p = path.decode('utf-8', 'replace')
        if not lang_of(p, repo) or is_vendored(repo, p): continue
        r.append((p, m[2].decode(), int(m[3])))
    return r

GEN_CHECK = 200   # a file entry with at least this churn is checked against is_generated / binary (the frame rule)
def churn(repo, tip):
    """{sha: (counted churn, counted lines before the commit)} along the first-parent chain (numstat vs first parent).
    Counted like the frames: no vendored files, no binaries, and no generated files (is_generated on the blob at the
    commit, or before it for a deletion); a path found generated in any checked version is left out everywhere."""
    out = git(repo, 'log', '--first-parent', '--reverse', '--no-renames', '--numstat', '--format=@%H', tip).decode('utf-8', 'replace')
    ents = []; cur = None
    for l in out.split('\n'):
        if l.startswith('@'): cur = l[1:]; ents.append((cur, None, 0, 0))
        elif l and cur:
            a, r, p = l.split('\t', 2)
            if a == '-' or not lang_of(p, repo) or is_vendored(repo, p): continue
            ents.append((cur, p, int(a), int(r)))
    big = [(c, p) for c, p, a, r in ents if p and a + r >= GEN_CHECK]
    gen = set()
    if big:
        inp = b''.join(f'{c}:{p}\n{c}^:{p}\n'.encode() for c, p in big)
        o = git(repo, 'cat-file', '--batch', inp=inp); k = 0
        for c, p in big:
            for _ in range(2):
                e = o.index(b'\n', k); hdr = o[k:e].split(); k = e + 1
                if hdr[-1] == b'missing': continue
                n = int(hdr[2]); data = o[k:k + n]; k += n + 1
                lines = data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
                if b'\0' in data[:8000] or is_generated(repo, p, n, lines, data[:600]): gen.add(p)
    res = {}; tot = 0; cur = None; c = 0; before = 0
    for sha, p, a, r in ents:
        if p is None:
            if cur: res[cur] = (c, before)
            cur = sha; c = 0; before = tot
        elif p not in gen:
            c += a + r; tot += a - r
    if cur: res[cur] = (c, before)
    return res

def lane_frames(cfg):
    lane, repo, tip, opt = cfg
    t0 = time.time()
    ch = chain(repo, tip)
    pos = {s: i for i, (s, d) in enumerate(ch)}
    if opt.get('not_in'):   # drop the shared history (commits on the parent lane's tip too)
        fork = FORK_OF[lane]
        k = pos[fork] + 1 if fork else 0
        ch = ch[k:]
    else:
        fork = None
    cand = collections.OrderedDict()   # sha -> {kinds, tags, labels}
    def add(sha, kind, tag=None, label=None):
        e = cand.setdefault(sha, {'kinds': [], 'tags': [], 'labels': []})
        if kind not in e['kinds']: e['kinds'].append(kind)
        if tag and tag not in e['tags']: e['tags'].append(tag)
        if label and label not in e['labels']: e['labels'].append(label)
    bymonth = collections.OrderedDict()
    for s, d in ch: bymonth[d[:7]] = s
    for m, s in bymonth.items(): add(s, 'month')
    if lane not in DENSE:
        for s, d in ch: add(s, 'commit')
    if opt.get('tags'):
        for l in git(repo, 'for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/tags').decode().split('\n'):
            if not l: continue
            t, o = l.split(' ')
            if not re.search(opt['tags'], t): continue
            s = resolve(repo, o)
            if opt.get('not_in') and fork and s in pos and pos[s] <= pos[fork]: continue   # shared history: parent's tag
            add(s, 'tag', t)
    for ln, c, label in FORKS:
        if ln == lane: add(resolve(repo, c), 'fork', None, label)
    for ln, c, label in IMPORTS:
        if ln == lane: add(resolve(repo, c), 'import', None, label)
    for r in RELEASES:
        for ln, c in (('polly2', r[3]), ('minicast', r[4])):
            if ln == lane: add(resolve(repo, c), 'pin', 'DreamSTer ' + r[0])
    if lane in DENSE:   # big commits (and the state before each), and accumulated churn
        cs = churn(repo, tip); acc = 0; nbig = nacc = 0
        for q, (s, d) in enumerate(ch):
            c, before = cs[s]; T = big_threshold(before)
            if c >= T:
                if q > 0 and ch[q - 1][0] not in cand: add(ch[q - 1][0], 'big')
                add(s, 'big', None, f'big commit: {c:,} counted lines changed'); nbig += 1; acc = 0; continue
            acc += c
            if acc >= T and s not in cand: add(s, 'big'); nacc += 1
            if s in cand: acc = 0
        print(f'{lane}: {nbig} big commits, {nacc} accumulated-churn frames (threshold max({BIG_MIN}, {BIG_PCT:.0%} of lines))', file=sys.stderr)
    # dates: committer date unless overridden (imports with a known real date)
    frames = []
    for s, e in cand.items():
        d = cdate(repo, s); f = {'lane': lane, 'repo': repo, 'commit': s, 'date': d, 'commit_date': d, **e}
        for k, (dd, rng, note) in opt.get('date', {}).items():
            if s.startswith(k): f['date'] = dd; f['date_range'] = rng; f['date_note'] = note
        if opt.get('approx'): f['approx'] = True
        frames.append(f)
    frames.sort(key=lambda f: (f['date'], pos.get(f['commit'], 1e9)))
    # file lists; classify blobs (generated rules need the head) once per (path, blob)
    trees = [tree_files(repo, f['commit']) for f in frames]
    need = sorted({(b, sz) for t in trees for (p, b, sz) in t})
    heads = {}
    if need:
        inp = ('\n'.join(b for b, sz in need) + '\n').encode()
        p = subprocess.Popen(['git', '-C', os.path.join(REPOS, repo + '.git'), 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        import threading
        def feed(): p.stdin.write(inp); p.stdin.close()
        threading.Thread(target=feed).start()
        for b, sz in need:
            hdr = p.stdout.readline(); n = int(hdr.split()[2]); data = p.stdout.read(n); p.stdout.read(1)
            lines = data.count(b'\n') + (1 if data and not data.endswith(b'\n') else 0)
            heads[b] = (b'\0' in data[:8000], data[:600], lines)
        p.wait()
    out = []; prevset = None; nonempty = False
    for f, t in zip(frames, trees):
        own = []
        for path, b, sz in t:
            binary, head, lines = heads[b]
            if binary or is_generated(repo, path, sz, lines, head): continue
            own.append((path, b))
        own.sort()
        fs = frozenset(own)
        keep = (set(f['kinds']) - DROPPABLE) or prevset is None or fs != prevset
        if not own and not nonempty: keep = False          # nothing counted yet (README-only start)
        if keep:
            f['files'] = len(own); f['_own'] = own; out.append(f); prevset = fs; nonempty = nonempty or bool(own)
    print(f'{lane:16s} chain {len(ch):5d} months {len(bymonth):4d} candidates {len(frames):4d} frames {len(out):4d} '
          f'fork {fork[:9] if fork else "-"} {time.time() - t0:.1f}s', file=sys.stderr, flush=True)
    return lane, fork, out

def shared_fork(repo, tip, other, other_tip):
    """last commit of repo's first-parent chain that is reachable from other_tip in the other mirror"""
    ch = chain(repo, tip)
    reach = set(git(other, 'rev-list', other_tip).decode().split())
    sh = [s for s, d in ch if s in reach]
    return sh[-1] if sh else None

FORK_OF = {}

def main():
    os.makedirs(os.path.join(OUT, 'work'), exist_ok=True)
    # fork points of lanes that share git history with a parent repo become frames of the parent lane
    for ln, repo, tip, opt in LANES:
        if opt.get('not_in'):
            pl, ptip = next((x[0], x[2]) for x in LANES if x[1] == opt['not_in'])
            fk = shared_fork(repo, tip, opt['not_in'], ptip); FORK_OF[ln] = fk
            print(f'{ln}: shared history with {pl} ends at {fk[:9]} {cdate(repo, fk)}', file=sys.stderr)
            FORKS.append((pl, fk, f'{ln} fork point (last shared commit)'))
    with Pool(int(os.environ.get('JOBS', 9))) as p: res = p.map(lane_frames, sorted(LANES, key=lambda c: -len(c[1]) if c[0] in ('flycast', 'reicast', 'nulldc3') else 0))
    forks = {ln: fk for ln, fk, fr in res}
    byl = {ln: fr for ln, fk, fr in res}
    order = [c[0] for c in LANES]
    # global time order: (date, lane order, lane-local index)
    allf = []
    for ln in order:
        for k, f in enumerate(byl[ln]): f['k'] = k; allf.append(f)
    # the virtual origin "nullDC up to the late-2008 fork": lines in both nullDCe's recovered 2009 tree and nullDC
    allf.append({'lane': 'nullDC', 'repo': 'skmp_nullDC', 'commit': '', 'date': '2008-12-31', 'kinds': ['virtual'], 'tags': [],
                 'labels': ['nullDC-pre2008: line present both in nullDCe 2009 (late-2008 fork) and in nullDC, so it predates the fork'],
                 'k': -1, 'virtual': True, 'files': 0, '_own': [], 'date_range': '2005-2008'})
    allf.sort(key=lambda f: (f['date'], order.index(f['lane']), f['k']))
    for i, f in enumerate(allf): f['i'] = i
    gi = {(f['lane'], f['commit']): f['i'] for f in allf if not f.get('virtual')}
    # lane graph with resolved parent frames
    lanes = []
    for ln, repo, tip, opt in LANES:
        es = []
        for pl, kind, c in LANE_EDGES.get(ln, []):
            e = {'lane': pl, 'kind': kind}
            if c == 'FORK':
                c = forks[ln]; prepo = next(x[1] for x in LANES if x[0] == pl)
                # the fork commit may be a month's middle commit: make sure the parent has it as a frame
                if (pl, c) not in gi: raise SystemExit(f'{ln}: fork {c} of {pl} is not a frame; add it to FORKS')
            if c:
                prepo = next(x[1] for x in LANES if x[0] == pl); full = resolve(prepo, c)
                e['frame'] = gi[(pl, full)]; e['commit'] = full
            es.append(e)
        lanes.append({'lane': ln, 'repo': repo, 'tip': tip, 'frames': [f['i'] for f in byl[ln]], 'parents': es,
                      'shared_until': forks[ln]})
    # outputs
    with open(os.path.join(OUT, 'work', 'frames.tsv'), 'w') as w:
        for f in allf:
            w.write('\t'.join([str(f['i']), f['lane'], f['repo'], f['commit'] or '-', f['date'], str(f['k']), '1' if f.get('virtual') else '0']) + '\n')
    with open(os.path.join(OUT, 'work', 'files.tsv'), 'w') as w:
        for f in allf:
            for path, b in f['_own']:
                assert '\t' not in path and '\n' not in path
                w.write(f"{f['i']}\t{b}\t{path}\n")
    with open(os.path.join(OUT, 'work', 'lanes.tsv'), 'w') as w:
        for L in lanes:
            ps = ','.join(f"{e['lane']}:{e['kind']}:{e.get('frame', -1)}" for e in L['parents']) or '-'
            w.write(f"{L['lane']}\t{L['repo']}\t{ps}\n")
    for f in allf: f.pop('_own', None); f.pop('repo', None) if False else None
    json.dump({'lanes': lanes, 'frames': allf, 'releases': [dict(zip(('tag', 'date', 'dreamster', 'polly2', 'minicast'), r)) for r in RELEASES]},
              open(os.path.join(OUT, 'frames.json'), 'w'), indent=1)
    c = collections.Counter(f['lane'] for f in allf if not f.get('virtual'))
    print('frames per lane:', dict((ln, c[ln]) for ln in order), 'total', sum(c.values()), file=sys.stderr)

if __name__ == '__main__':
    main()

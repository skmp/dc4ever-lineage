#!/usr/bin/env python3
"""blame.py: optional per-line "last changed by" for the viewer (DESIGN 6.3). Handles and dates only: no emails, no subjects.

For every counted file of every snapshot: git blame --line-porcelain at the snapshot commit (cached by repo, path, blob).
Writes
  data/blame/commits.json.gz  {"authors": [handle], "commits": [[hash7, author, yyyymmdd, repo]], "imports": {hash7: note}}
  data/blame/NN.bin.gz        u32 per line, snapshot source order (files as in snap/NN.json, then lines): commit index,
                              0xFFFFFFFF where blame and the provenance line split disagree
Handle: the GitHub handle of a users.noreply.github.com address when there is one, else the git author name as written.
The address itself is never stored. Lines blamed to an import commit (a repo created from an older tree) get the import's
note: their authorship predates the import.
  python3 tools/blame.py [--jobs 24]
"""
import os, sys, re, json, gzip, struct, subprocess, time, collections
from multiprocessing import Pool

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
D = os.path.join(ROOT, 'data'); OUT = os.path.join(D, 'blame')
REPOS = os.path.join(ROOT, 'repos')
JOBS = int(sys.argv[sys.argv.index('--jobs') + 1]) if '--jobs' in sys.argv else 24

# import roots: commits that brought an older tree in as one commit (agents/collect/REPORT.md)
IMPORTS = {
    'skmp_reicast-emulator': ('1c16baeb', 'reicast "project import" of the private newdc / nullDC-Android tree (2012-2013), itself built from nullDC and nullDCe'),
    'skmp_nullDCe': (None, 'nullDCe recovered archive committed in 2017; the code is from 2008-2010'),
    'skmp_dc4ever': (None, 'dc4ever history rebuilt in 2019 from backups (one commit per file at its mtime); the code is from 2003-2005'),
    'gligli_nulldc-360': ('0330292', 'nulldc-360 initial import of nullDC svn trunk (2010-2011) plus the Xbox 360 parts'),
    'BenoitAdam_nullDC4Wii': ('e812c58', 'nullDC4Wii first commit imports nullDCe main bad8d6a verbatim'),
    'Mayo1970_NotDC-PS3': ('5a32b94', 'NotDC-PS3 first commit imports nullDC4Wii (~9659506)'),
    'skmp_minicast': ('580d7b8', 'minicast initial import of nullDC 3 / reicast code'),
    'kernel64_HarissaDC': ('37fa91c', 'HarissaDC 0.2.0: the whole source tree in one commit (private development since 2026-10-19)'),
}
NOREPLY = re.compile(r'^<(?:\d+\+)?([^@>]+)@users\.noreply\.github\.com>$')

def blame(args):
    repo, commit, path = args
    g = os.path.join(REPOS, repo + '.git')
    r = subprocess.run(['git', '-C', g, 'blame', '--line-porcelain', commit, '--', path], capture_output=True)
    if r.returncode != 0: return None
    out = []; cur = {}
    for ln in r.stdout.split(b'\n'):
        if not ln: continue
        if ln[0:1] == b'\t': out.append((cur['h'], cur['a'], cur['m'], cur['t'])); continue
        k, _, v = ln.partition(b' ')
        if len(k) == 40 and all(c in b'0123456789abcdef' for c in k): cur['h'] = k[:7].decode()
        elif k == b'author': cur['a'] = v.decode('utf-8', 'replace')
        elif k == b'author-mail': cur['m'] = v.decode('utf-8', 'replace')
        elif k == b'author-time': cur['t'] = int(v)
    return out

def handle(name, mail):
    m = NOREPLY.match(mail)
    h = (m.group(1) if m else name).strip()
    # the lineage author's identities (svn era and git) under one handle
    if 'skmp' in mail.lower() or 'skmp' == h.lower() or 'raziel' in h.lower(): return 'skmp'
    if '@' in h:   # svn-era names that are addresses: keep a handle-like part, never the address
        local, _, dom = h.partition('@')
        h = dom.split('.')[0] if local.lower() in ('git', 'svn', 'root', 'admin', 'info', 'mail', 'me') else local
    return h or '(unknown)'

def main():
    t0 = time.time()
    man = json.load(open(os.path.join(D, 'manifest.json'))); S = man['snapshots']
    sha = {}
    for ln in open(os.path.join(ROOT, 'agents/provenance/work/files.tsv')):
        i, h, p = ln.rstrip('\n').split('\t', 2); sha[(int(i), p)] = h
    snaps = [json.load(gzip.open(os.path.join(D, f'snap/{s["i"]:02d}.json.gz'))) for s in S]
    jobs = {}
    for s, j in zip(S, snaps):
        for f in j['files']:
            key = (s['repo'], f['p'], sha[(s['i'], f['p'])])
            jobs.setdefault(key, (s['repo'], s['commit'], f['p']))
    keys = list(jobs)
    print(f'{len(keys)} distinct (repo, path, blob) of {sum(len(j["files"]) for j in snaps)} files; {JOBS} jobs', flush=True)
    res = {}
    with Pool(JOBS) as pool:
        for n, (k, r) in enumerate(zip(keys, pool.imap(blame, [jobs[k] for k in keys], chunksize=4))):
            res[k] = r
            if n % 1000 == 0: print(f'  {n}/{len(keys)}  {time.time() - t0:.0f}s', flush=True)
    authors = {}; alist = []; commits = {}; clist = []
    # one handle per case-insensitive spelling (Flyinghead / flyinghead), the most used spelling wins
    spell = collections.Counter(handle(x[1], x[2]) for r in res.values() if r for x in r)
    canon = {}
    for h, _ in spell.most_common(): canon.setdefault(h.lower(), h)
    def aid(h):
        h = canon.get(h.lower(), h)
        if h not in authors: authors[h] = len(alist); alist.append(h)
        return authors[h]
    def cid(repo, h, a, m, t):
        k = (repo, h)
        if k not in commits:
            commits[k] = len(clist); clist.append([h, aid(handle(a, m)), int(time.strftime('%Y%m%d', time.gmtime(t))), repo])
        return commits[k]
    os.makedirs(OUT, exist_ok=True)
    bad = 0; total = 0
    for s, j in zip(S, snaps):
        n = sum(f['n'] for f in j['files']); arr = bytearray(4 * n); off = 0
        for f in j['files']:
            r = res[(s['repo'], f['p'], sha[(s['i'], f['p'])])]
            if r is None or len(r) != f['n']:
                struct.pack_into(f'<{f["n"]}I', arr, 4 * off, *([0xFFFFFFFF] * f['n'])); bad += f['n']
            else:
                struct.pack_into(f'<{f["n"]}I', arr, 4 * off, *[cid(s['repo'], *x) for x in r])
            off += f['n']; total += f['n']
        with gzip.open(os.path.join(OUT, f'{s["i"]:02d}.bin.gz'), 'wb', compresslevel=9) as fo: fo.write(bytes(arr))
    imports = {}
    for repo, (h, note) in IMPORTS.items():
        for c in clist:
            if c[3] != repo: continue
            if h is not None and c[0] == h[:7]: imports[c[0]] = note
            if h is None: imports.setdefault('repo:' + repo, note)
    cnt = collections.Counter()
    for c in clist: cnt[c[1]] += 1
    out = {'authors': alist, 'commits': clist, 'imports': imports,
           'note': 'git blame at each snapshot commit: last changed by, not originally written by. Handles only, no emails.'}
    with gzip.open(os.path.join(OUT, 'commits.json.gz'), 'wt', compresslevel=9) as fo: json.dump(out, fo, separators=(',', ':'))
    print(f'{len(alist)} handles, {len(clist)} commits, {total} lines, {bad} unmatched ({100 * bad / max(1, total):.2f} %), {time.time() - t0:.0f}s')
    print('top handles by commits:', [(alist[a], c) for a, c in cnt.most_common(12)])

if __name__ == '__main__':
    main()

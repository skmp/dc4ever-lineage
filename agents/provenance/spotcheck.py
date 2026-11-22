# spotcheck.py: 20 hand-picked lines; prints the tool's origin and the git evidence (git grep at snapshot commits,
# git log -S --reverse for the first commit that adds the text).  Output: agents/provenance/spotcheck.txt
import sys, subprocess, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, 'tools')
from prov_query import man, snap, text, presence
SN = {s['id']: s for s in man['snapshots']}
R = lambda r: f'repos/{r}.git'
C = [  # snapshot, path, line, [repos to pickaxe (repo, ref)]
 ('nulldc3-refsw3', 'libswirl/hw/sh4/interpr/sh4_opcodes.cpp', 189, [('skmp_dc4ever', 'master'), ('skmp_nullDC', 'master'), ('skmp_nulldc3', 'skmp/refsw3')]),
 ('nulldc3-refsw3', 'libswirl/hw/sh4/sh4_opcode_list.cpp', 353, [('skmp_nullDC', 'master'), ('skmp_nulldc3', 'skmp/refsw3')]),
 ('nulldc3-refsw3', 'libswirl/hw/pvr/spg.cpp', 18, [('skmp_nullDC', 'master'), ('skmp_nulldc3', 'skmp/refsw3')]),
 ('nulldc3-refsw3', 'libswirl/imgread/ioctl.cpp', 299, [('skmp_nullDC', 'master')]),
 ('nulldc3-refsw3', 'libswirl/hw/sh4/fsca-table.h', 3832, [('skmp_nulldc3', 'skmp/refsw3')]),
 ('nulldc3-refsw3', 'libswirl/stdclass.cpp', 80, [('skmp_reicast-emulator', 'alpha')]),
 ('nulldc3-refsw3', 'libswirl/reios/reios.cpp', 406, [('skmp_reicast-emulator', 'alpha')]),
 ('nulldc3-refsw3', 'libswirl/windows/win_common.cpp', 281, [('skmp_reicast-emulator', 'alpha')]),
 ('nulldc3-refsw3', 'libswirl/debugger/dbg_emu.cpp', 1178, [('skmp_nulldc3', 'skmp/refsw3')]),
 ('nulldc3-refsw3', 'libswirl/rend/refsw2/refsw2.cpp', 215, [('skmp_nulldc3', 'skmp/refsw3')]),
 ('flycast-head', 'core/cheats.cpp', 238, [('flyinghead_flycast', 'master')]),
 ('flycast-head', 'core/hw/sh4/dyna/blockmanager.cpp', 223, [('flyinghead_flycast', 'master')]),
 ('polly2-r8-develop', 'tb/ref/ref_copies.h', 621, [('skmp_nulldc3', 'skmp/refsw3'), ('skmp_polly2-rtl', 'r8/develop')]),
 ('NotDC-PS3-0.8.3', 'plugs/caiqueAICA/aica_model.cpp', 1816, [('skmp_caique-rtl', 'main'), ('Mayo1970_NotDC-PS3', 'main')]),
 ('nullDC4Wii-head', 'plugs/drkPvr/gxRend.cpp', 633, [('BenoitAdam_nullDC4Wii', 'main'), ('Mayo1970_NotDC-PS3', 'main')]),
 ('nulldc-360-last', 'plugins/XMaple/StandardController.cpp', 4, [('skmp_nullDC', 'master')]),
 ('nullDCe-2009', 'dc/maple/maple_devs.cpp', 247, [('skmp_nullDC', '--all')]),
 ('shrike4-head', 'tb/v1_fetchx_mutants.py', 155, [('skmp_nulldc3', 'main')]),
 ('wren7-head', 'model/tools/vendor_tests.cpp', 25, [('skmp_caique-rtl', 'main'), ('skmp_wren7-rtl', 'main')]),
 ('minicast-r6b', 'libswirl/linux-dist/x11.cpp', 293, [('skmp_nulldc3', 'main'), ('skmp_minicast', 'main')]),
]
cache = {}
def one(c):
    sid, path, ln, picks = c
    if sid not in cache: cache[sid] = snap(sid)
    i, j, ids, og, kp = cache[sid]
    f = next(f for f in j['files'] if f['p'] == path); k = f['off'] + ln - 1
    t = text(ids[k]); o = man['origins'][og[k]]; pm = presence(ids[k])
    out = [f'### {sid} {path}:{ln}', f'text   : {t.strip()}', f'tool   : origin={o} keep={kp[k]}',
           '         present in: ' + ' '.join(s['id'] for s in man['snapshots'] if pm >> s['i'] & 1)]
    needle = t.strip()
    for repo, ref in picks:
        refs = ['--all'] if ref == '--all' else [ref]
        r = subprocess.run(['git', '-C', R(repo), 'log', '--reverse', '--format=%h %ad %s', '--date=short', '-S', needle] + refs,
                           capture_output=True, text=True).stdout.strip().split('\n')
        r = [x for x in r if x]
        out.append(f'  git log -S {repo} {ref}: ' + (f'first {r[0]}' if r else 'NO COMMIT ADDS IT') + (f'  ({len(r)} commits touch it)' if r else ''))
    return '\n'.join(out)
for c in C:
    s = c[0]
    if s not in cache: cache[s] = snap(s)
with ThreadPoolExecutor(8) as ex: res = list(ex.map(one, C))
open('agents/provenance/spotcheck.txt', 'w').write('\n\n'.join(res) + '\n')
print('\n\n'.join(res))

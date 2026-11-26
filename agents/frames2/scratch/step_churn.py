#!/usr/bin/env python3
"""step_churn.py FRAMES_JSON: counted churn of every frame-to-frame step of the dense lanes (git diff --numstat between
consecutive frames, counted non-vendored files); prints max and how many steps exceed 1500 / 5000 lines."""
import sys, os, json, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tools'))
from rules import lang_of, is_vendored
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
FR = json.load(open(sys.argv[1]))['frames']; repo = {'nullDC4Wii': 'BenoitAdam_nullDC4Wii', 'reicast': 'skmp_reicast-emulator', 'flycast': 'flyinghead_flycast'}
for ln, r in repo.items():
    fs = [f for f in FR if f['lane'] == ln]; cs = []; ms = []
    for a, b in zip(fs, fs[1:]):
        out = subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), 'diff', '--no-renames', '--numstat', a['commit'], b['commit']], capture_output=True, text=True, errors='replace').stdout
        c = 0
        for l in out.splitlines():
            x, y, p = l.split('\t', 2)
            if x != '-' and lang_of(p, r) and not is_vendored(r, p): c += int(x) + int(y)
        n = int(subprocess.run(['git', '-C', os.path.join(ROOT, 'repos', r + '.git'), 'rev-list', '--count', '--first-parent', a['commit'] + '..' + b['commit']], capture_output=True, text=True).stdout or 0)
        cs.append(c); ms.append(c if n > 1 else 0)
    print(f'{ln}: {len(fs)} frames, steps max {max(cs):,}, > 1500: {sum(c > 1500 for c in cs)}, > 5000: {sum(c > 5000 for c in cs)}, > 20000: {sum(c > 20000 for c in cs)}; multi-commit steps: max {max(ms):,}, > 5000: {sum(c > 5000 for c in ms)}, > 20000: {sum(c > 20000 for c in ms)}')

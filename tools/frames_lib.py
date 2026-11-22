"""frames_lib.py: decode the frame data (agents/frames/FORMAT.md) in Python: text, and lane states frame by frame."""
import json, gzip, os
from array import array
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

class Data:
    def __init__(self, d=None):
        self.D = os.path.abspath(d or os.path.join(ROOT, 'data'))
        self.man = json.load(open(os.path.join(self.D, 'frames.json')))
        self.frames = self.man['frames']; self.lanes = self.man['lanes']
        self.lane_idx = {L['name']: i for i, L in enumerate(self.lanes)}
        self._text = None
    @property
    def text(self):
        if self._text is None:
            CH = self.man['chunk_lines']; t = []
            for c in range(self.man['text_chunks']):
                x = gzip.open(os.path.join(self.D, f'text/lines-{c:03d}.txt.gz')).read().split(b'\n')
                t.extend(x[:min(CH, self.man['raw_lines'] - c * CH)])
            self._text = t
        return self._text
    def lane_states(self, lane):
        """yield (gi, {ident: (path, [(raw, origin, keep)], dom, status)}) for every frame of the lane, in order"""
        L = self.lanes[self.lane_idx[lane]]; state = {}
        for ci in range(len(L['chunks'])):
            j = json.load(gzip.open(os.path.join(self.D, f"lanes/{lane}/c{ci:03d}.json.gz")))
            b = gzip.open(os.path.join(self.D, f"lanes/{lane}/c{ci:03d}.bin.gz")).read()
            for fr in j['frames']:
                off, nw, nl = fr['off'], fr['nw'], fr['nl']
                words = array('I', b[off:off + 4 * nw]); off += 4 * nw
                raws = array('I', b[off:off + 4 * nl]); off += 4 * nl
                orgs = array('H', b[off:off + 2 * nl]); off += 2 * nl
                keeps = array('H', b[off:off + 2 * nl])
                if fr['key']: state = {}
                else: state = {k: (v[0], v[1], v[2], 'same') for k, v in state.items()}
                wp = lp = 0
                for op in fr['ops']:
                    kind, ident, path = op[0], op[1], op[2]
                    if kind == 'D': state.pop(ident); continue
                    status, dom, ns, ni = op[4], op[5], op[10], op[11]
                    ins = [(raws[lp + q], orgs[lp + q], keeps[lp + q]) for q in range(ni)]; lp += ni
                    if kind in ('K', 'A'): lines = ins
                    else:
                        old = state[ident][1]; lines = []; x = y = 0
                        for w in words[wp:wp + ns]:
                            o, c = w >> 30, w & 0x3FFFFFFF
                            if o == 0: lines.extend(old[x:x + c]); x += c
                            elif o == 1: x += c
                            else: lines.extend(ins[y:y + c]); y += c
                    wp += ns
                    state[ident] = (path, lines, dom, status)
                yield fr['f'], state
    def origin_label(self, o):
        f = self.frames[o]
        if f.get('virtual'): return 'nullDC-pre2008'
        return f"{f['lane']} {f['date']} {f['commit'][:9]}" + (f" [{','.join(f['tags'])}]" if f.get('tags') else '') + (' (approx)' if f.get('approx') else '')

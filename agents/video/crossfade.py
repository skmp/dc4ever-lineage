#!/usr/bin/env python3
# crossfade.py: the lineage stream video from the 4K stills (tools/verify/run.mjs seq --size 3840x2160 --dir agents/video/stills)
# Every frame by date, 3 per second at 60 fps: each still holds HOLD output frames, then crossfades into the next over FADE.
# A caption (lane, tags, date, commit) is burned into each still, so it crossfades with it. Fade in from / out to black.
#   python3 agents/video/crossfade.py agents/video/stills agents/video/lineage-stream-4k60.mp4
import glob, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
FPS, HOLD, FADE = 60, 10, 10            # 20 output frames per still = 3 stills a second
W, H = 3840, 2160
files = sorted(glob.glob(os.path.join(src, '[0-9]' * 5 + '.png')))
meta = {}
for m in glob.glob(os.path.join(src, 'frames-*.json')):
    for r in json.load(open(m)): meta[r['k']] = r
BOLD = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 84)
MONO = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 52)

def still(i):
    im = Image.open(files[i]).convert('RGB')
    if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
    r = meta.get(int(os.path.basename(files[i])[:5]))
    if r:
        d = ImageDraw.Draw(im, 'RGBA')
        title = r['lane'] + ('  ' + ' '.join(r['tags']) if r.get('tags') else '')
        sub = f"{r['date']}   {r.get('commit') or ''}"
        x, y = 120, H - 300
        tw = max(d.textlength(title, font=BOLD), d.textlength(sub, font=MONO))
        d.rounded_rectangle([x - 40, y - 36, x + tw + 40, y + 190], 22, fill=(11, 13, 18, 200))
        d.text((x, y), title, font=BOLD, fill=(240, 244, 250, 255))
        d.text((x, y + 112), sub, font=MONO, fill=(150, 160, 180, 255))
    return np.asarray(im, dtype=np.uint8)

enc = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                        '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
                        '-profile:v', 'high', '-level', '5.2', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
buf = np.empty((H, W, 3), np.uint16)
def mix(a, b, s):                       # (a * (256 - w) + b * w) >> 8, integer, no big temporaries
    w = int(round(s * 256)); np.multiply(a, 256 - w, out=buf, dtype=np.uint16); buf2 = b.astype(np.uint16); buf2 *= w; buf2 += buf; buf2 >>= 8
    return buf2.astype(np.uint8)
put = lambda a: enc.stdin.write(memoryview(a).cast('B'))
n = len(files); cur = still(0); black = np.zeros_like(cur)
for t in range(FADE * 2): put(mix(black, cur, (t + 1) / (FADE * 2)))   # fade in
for i in range(n):
    for _ in range(HOLD if i < n - 1 else FPS): put(cur)               # the last still holds a second
    if i == n - 1: break
    nxt = still(i + 1)
    for t in range(FADE): put(mix(cur, nxt, (t + 1) / (FADE + 1)))
    cur = nxt
    if i % 20 == 0: print(f'{i}/{n}', flush=True)
for t in range(FPS): put(mix(cur, black, (t + 1) / FPS))               # fade out
enc.stdin.close(); enc.wait()
print('done', out, f'{n} stills')

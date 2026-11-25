#!/usr/bin/env python3
# crossfade.py: the lineage stream video, a seamless loop.
#   stills: tools/verify/run.mjs seq --size 7680x4320 --order agents/video/order.json --dir agents/video/stills8k
#   audio:  tools/render_score.mjs --drive agents/video/drive.json (agents/video/drive.py: the video's own timeline + 8 s)
# Every frame in commit-time order, 3 a second at 60 fps: each still holds HOLD output frames, then crossfades into the
# next over FADE; the last crossfades into the first, so N * (HOLD + FADE) frames loop exactly. 8K stills are averaged
# 2x2 down to 4K (4x supersampling). The caption (lane, tags, commit timestamp, commit) is burned in per still.
# The score's tail (rendered LOOP s past the end, on the start's drive) is equal-power crossfaded into its head.
#   python3 agents/video/crossfade.py agents/video/stills8k agents/video/lineage-stream-score.wav agents/video/lineage-stream-4k60.mp4
import glob, json, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

src, wav_in, out = sys.argv[1], sys.argv[2], sys.argv[3]
FPS, HOLD, FADE, LOOP, GAIN_DB = 60, 10, 10, 8.0, 8.0
W, H = 3840, 2160
order = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'order.json')))
files = sorted(glob.glob(os.path.join(src, '[0-9]' * 5 + '.png')))
if os.environ.get('LIMIT'): files = files[:int(os.environ['LIMIT'])]   # quick tests on the first stills
else: assert len(files) == len(order), (len(files), len(order))
BOLD = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 84)
STAMP = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 76)
MONO = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 46)

def still(i):
    im = Image.open(files[i]).convert('RGB')
    if im.size == (2 * W, 2 * H): im = im.reduce(2)             # 2x2 box average: supersampled anti-aliasing
    elif im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
    r = order[i]; d = ImageDraw.Draw(im, 'RGBA')
    title = r['lane'] + ('   ' + ' '.join(r['tags']) if r.get('tags') else '')
    stamp = ('≈ ' if r['approx'] else '') + r['stamp']
    sub = f"commit {r['commit']}" + ('   (date approximate)' if r['approx'] else '')
    x, y = 120, H - 380
    tw = max(d.textlength(title, font=BOLD), d.textlength(stamp, font=STAMP), d.textlength(sub, font=MONO))
    d.rounded_rectangle([x - 44, y - 40, x + tw + 44, y + 272], 24, fill=(11, 13, 18, 205))
    d.text((x, y), title, font=BOLD, fill=(240, 244, 250, 255))
    d.text((x, y + 108), stamp, font=STAMP, fill=(124, 196, 255, 255))
    d.text((x, y + 206), sub, font=MONO, fill=(150, 160, 180, 255))
    return np.asarray(im, dtype=np.uint8)

# ---- audio: loop the score
with wave.open(wav_in) as wf:
    sr, nch = wf.getframerate(), wf.getnchannels(); a = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).reshape(-1, nch).astype(np.float32) / 32768
n = len(files); L = round(n * (HOLD + FADE) / FPS * sr); X = min(int(LOOP * sr), L // 2)
assert len(a) >= L + X, ('score too short', len(a) / sr, (L + X) / sr)
loop = a[:L].copy(); th = np.linspace(0, np.pi / 2, X, dtype=np.float32)[:, None]
loop[:X] = a[:X] * np.sin(th) + a[L:L + X] * np.cos(th)          # the tail (what follows the end) fades into the head
loop *= 10 ** (GAIN_DB / 20); peak = float(np.abs(loop).max()); loop /= max(1.0, peak / 0.95)
wav_loop = out.rsplit('.', 1)[0] + '-audio.wav'
with wave.open(wav_loop, 'wb') as wf:
    wf.setnchannels(nch); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes((np.clip(loop, -1, 1) * 32767).astype(np.int16).tobytes())
print(f'audio: {L / sr:.3f} s loop, peak {20 * np.log10(np.abs(loop).max()):.1f} dBFS', flush=True)

# ---- video
enc = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                        '-r', str(FPS), '-i', '-', '-i', wav_loop, '-map', '0:v', '-map', '1:a',
                        '-c:v', 'libx265', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p10le', '-tag:v', 'hvc1',
                        '-x265-params', 'log-level=error', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out],
                       stdin=subprocess.PIPE)
buf = np.empty((H, W, 3), np.uint16)
def mix(a, b, s):                       # (a * (256 - w) + b * w) >> 8, integer
    w = int(round(s * 256)); np.multiply(a, 256 - w, out=buf, dtype=np.uint16); b2 = b.astype(np.uint16); b2 *= w; b2 += buf; b2 >>= 8
    return b2.astype(np.uint8)
put = lambda a: enc.stdin.write(memoryview(a).cast('B'))
first = cur = still(0)
for i in range(n):
    for _ in range(HOLD): put(cur)
    nxt = still(i + 1) if i + 1 < n else first                     # the last crossfades into the first: a seamless loop
    for t in range(FADE): put(mix(cur, nxt, (t + 1) / (FADE + 1)))
    cur = nxt
    if i % 20 == 0: print(f'{i}/{n}', flush=True)
enc.stdin.close(); enc.wait()
print('done', out, f'{n} stills, {n * (HOLD + FADE)} frames')

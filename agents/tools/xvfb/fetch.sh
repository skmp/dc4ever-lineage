#!/bin/sh
# fetch.sh: a private Xvfb for GPU runs of the verify tools, without installing anything system-wide.
# Downloads the Ubuntu packages (apt-get download, no root), extracts them here and patches Xvfb's xkbcomp
# directory string ("/usr/bin" -> "./bin", same length) so run-xvfb.sh can run it from this directory.
set -e
cd "$(dirname "$0")"
mkdir -p deb && cd deb && apt-get download xvfb libxfont2 xserver-common x11-xkb-utils libfontenc1 && cd ..
for d in deb/*.deb; do dpkg -x "$d" root; done
python3 - <<'P'
d = bytearray(open('root/usr/bin/Xvfb', 'rb').read())
i = d.find(b'/usr/bin\0'); assert i > 0 and d.count(b'/usr/bin\0') == 1
d[i:i + 9] = b'./bin\0\0\0\0'
open('Xvfb', 'wb').write(d)
P
chmod +x Xvfb; mkdir -p bin; ln -sf ../root/usr/bin/xkbcomp bin/xkbcomp
echo "ok: agents/tools/xvfb/run-xvfb.sh 77 2560x1440"

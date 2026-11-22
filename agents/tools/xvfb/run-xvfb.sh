#!/bin/sh
# run-xvfb.sh DISPLAYNUM [WxH]: private Xvfb (extracted from the Ubuntu deb, never installed) for headless GPU runs.
# /tmp/.X11-unix is read-only under WSLg, so only the abstract socket is used.
# Xvfb's xkbcomp directory string was patched to ./bin, so it runs from this directory.
cd "$(dirname "$0")"
R=$PWD/root
export LD_LIBRARY_PATH=$R/usr/lib/x86_64-linux-gnu
D=${1:-77}; S=${2:-2560x1440}; shift 2 2>/dev/null
exec ./Xvfb :$D -screen 0 ${S}x24 -xkbdir /usr/share/X11/xkb -nolisten tcp -nolisten unix -noreset +extension GLX "$@"

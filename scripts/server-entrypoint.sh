#!/bin/bash
set -eu

export DISPLAY=:99
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
Xvfb "$DISPLAY" -screen 0 1280x1024x24 -nolisten tcp -ac 2> >(grep -vE "(Could not resolve keysym|XKEYBOARD keymap compiler|xkbcomp are not fatal)" >&2) &
xvfb_pid=$!
xvfb_attempt=0
until [[ -S /tmp/.X11-unix/X99 ]]; do
  if ! kill -0 "$xvfb_pid" 2>/dev/null; then
    wait "$xvfb_pid"
    exit 1
  fi
  xvfb_attempt=$((xvfb_attempt + 1))
  if (( xvfb_attempt >= 50 )); then
    echo "Xvfb did not become ready on $DISPLAY" >&2
    kill "$xvfb_pid"
    exit 1
  fi
  sleep 0.1
done
if [[ "${MAP_ROOM_DEV_WATCH:-0}" == "1" ]]; then
  exec node --watch \
    --watch-path=/opt/map-room/maintainer \
    --watch-path=/opt/map-room/web \
    /opt/map-room/maintainer/src/server.js
fi
exec node /opt/map-room/maintainer/src/server.js

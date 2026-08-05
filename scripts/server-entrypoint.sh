#!/bin/bash
set -eu

export DISPLAY=:99
Xvfb "$DISPLAY" -nolisten unix 2> >(grep -vE "(Could not resolve keysym|XKEYBOARD keymap compiler|xkbcomp are not fatal)" >&2) &
if [[ "${MAP_ROOM_DEV_WATCH:-0}" == "1" ]]; then
  exec node --watch \
    --watch-path=/opt/map-room/maintainer \
    --watch-path=/opt/map-room/web \
    /opt/map-room/maintainer/src/server.js
fi
exec node /opt/map-room/maintainer/src/server.js

#!/bin/sh
set -eu

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
fixture=${MAP_ROOM_BUILD_SMOKE_PBF:-$root_dir/data/sources/rhode_island.osm.pbf}
test -s "$fixture" || { printf 'Missing bounded PBF fixture: %s\n' "$fixture" >&2; exit 1; }

test_root=$(mktemp -d /tmp/map-room-empty-library.XXXXXX)
project=map-room-empty-library-test
cleanup() {
  MAP_ROOM_EMPTY_DATA="$test_root/data" MAP_ROOM_EMPTY_STYLES="$test_root/styles" \
    docker compose -p "$project" -f "$root_dir/compose.yaml" -f "$root_dir/compose.empty-test.yaml" down >/dev/null 2>&1 || true
  rm -rf "$test_root"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$test_root/data"
cp -R "$root_dir/styles" "$test_root/styles"
MAP_ROOM_EMPTY_DATA="$test_root/data" MAP_ROOM_EMPTY_STYLES="$test_root/styles" \
  docker compose -p "$project" -f "$root_dir/compose.yaml" -f "$root_dir/compose.empty-test.yaml" up -d --build --wait

if ! BASE_URL=http://localhost:18088 MAP_ROOM_BUILD_SMOKE_PBF="$fixture" node "$root_dir/scripts/test-empty-library.mjs"; then
  MAP_ROOM_EMPTY_DATA="$test_root/data" MAP_ROOM_EMPTY_STYLES="$test_root/styles" \
    docker compose -p "$project" -f "$root_dir/compose.yaml" -f "$root_dir/compose.empty-test.yaml" logs --tail=200
  exit 1
fi

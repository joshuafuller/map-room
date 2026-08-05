#!/bin/sh
set -eu

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
data_dir=${MAP_ROOM_DATA_DIR:-"$root_dir/data"}
font_dir="$data_dir/fonts"
vendor_dir="$root_dir/web/vendor"

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'Missing required command: %s\n' "$1" >&2
		exit 1
	fi
}

require_command npm
require_command curl
require_command unzip

mkdir -p "$font_dir" "$vendor_dir"

if ! find "$font_dir" -type f -name '*.pbf' -print -quit | grep -q .; then
	fixture_dir=$(mktemp -d)
	trap 'rm -rf "$fixture_dir"' EXIT HUP INT TERM
	curl -fsSL \
		https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip \
		-o "$fixture_dir/test_data.zip"
	unzip -q "$fixture_dir/test_data.zip" 'fonts/*' -d "$fixture_dir"
	cp -R "$fixture_dir/fonts/." "$font_dir/"
fi

cd "$root_dir"
npm ci
npm run build:styles
cp node_modules/maplibre-gl/dist/*.mjs "$vendor_dir/"
cp node_modules/maplibre-gl/dist/maplibre-gl.css "$vendor_dir/"
cp node_modules/maplibre-gl/LICENSE.txt "$vendor_dir/MapLibre-LICENSE.txt"

printf 'Map Room browser assets and local fonts are ready.\n'

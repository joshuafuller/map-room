#!/bin/sh
set -eu

base_url=${BASE_URL:-http://localhost:8088}
tile=$(python3 -c "import json; print(json.load(open('data/manifest.json'))['testTile'])")
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

check_status() {
  path=$1
  expected_type=$2
  headers="$tmp_dir/headers"
  body="$tmp_dir/body"
  status=$(curl -sS -D "$headers" -o "$body" -w '%{http_code}' "$base_url$path")
  test "$status" = "200"
  tr -d '\r' < "$headers" | grep -qi "^content-type: $expected_type"
  test -s "$body"
  printf 'PASS %-44s %s bytes\n' "$path" "$(wc -c < "$body")"
}

check_status / text/html
check_status /manifest.json application/json
check_status /vendor/maplibre-gl.mjs application/javascript
check_status /styles/daylight/style.json application/json
check_status /styles/midnight/style.json application/json
check_status /styles/cyberpunk/style.json application/json
check_status /styles/cyberpunk-tactical/style.json application/json
check_status /data/osm.json application/json
check_status "/data/osm/$tile.pbf" application/x-protobuf
check_status "/styles/daylight/$tile.png" image/png
check_status "/styles/midnight/$tile.png" image/png
check_status "/styles/cyberpunk/$tile.png" image/png
check_status "/styles/cyberpunk-tactical/$tile.png" image/png

daylight_sha=$(curl -fsS "$base_url/styles/daylight/$tile.png" | sha256sum | cut -d' ' -f1)
midnight_sha=$(curl -fsS "$base_url/styles/midnight/$tile.png" | sha256sum | cut -d' ' -f1)
cyberpunk_sha=$(curl -fsS "$base_url/styles/cyberpunk/$tile.png" | sha256sum | cut -d' ' -f1)
tactical_sha=$(curl -fsS "$base_url/styles/cyberpunk-tactical/$tile.png" | sha256sum | cut -d' ' -f1)
test "$daylight_sha" != "$midnight_sha"
test "$daylight_sha" != "$cyberpunk_sha"
test "$midnight_sha" != "$cyberpunk_sha"
test "$tactical_sha" != "$daylight_sha"
test "$tactical_sha" != "$midnight_sha"
test "$tactical_sha" != "$cyberpunk_sha"
printf 'PASS all themes produce distinct raster output\n'

curl -fsS "$base_url/app.js" | grep -q '/vendor/maplibre-gl.mjs'
curl -fsS "$base_url/" | grep -q '© OpenMapTiles · © OpenStreetMap contributors'
printf 'PASS frontend uses local MapLibre and includes attribution\n'

node -e "import('./web/atak.js').then(({buildAtakXml}) => { for (const theme of ['midnight', 'cyberpunk', 'cyberpunk-tactical']) { const xml = buildAtakXml(theme, '$base_url/'); if (!xml.includes('<tileType>png</tileType>') || !xml.includes('$base_url/styles/' + theme + '/{\$z}/{\$x}/{\$y}.png')) process.exit(1); } })"
printf 'PASS generated ATAK XML has raster URL and zoom contract\n'

if rg -n 'https?://' web styles \
  --glob '!web/vendor/**' \
  --glob '!**/*.test.js'; then
  printf 'FAIL runtime web/style source contains an external URL\n' >&2
  exit 1
fi
printf 'PASS runtime web and style assets have no external URL dependencies\n'

printf 'All HTTP integration checks passed.\n'

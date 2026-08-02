#!/bin/sh
set -eu

base_url=${BASE_URL:-http://localhost:8088}
tile=$(python3 -c "import json; print(json.load(open('data/manifest.json'))['testTile'])")
tile_zoom=${tile%%/*}
tile_remainder=${tile#*/}
tile_x=${tile_remainder%%/*}
tile_y=${tile_remainder#*/}
high_zoom=20
high_scale=$((1 << (high_zoom - tile_zoom)))
high_x=$((tile_x * high_scale + high_scale / 2))
high_y=$((tile_y * high_scale + high_scale / 2))
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

check_png_dimensions() {
  path=$1
  expected=$2
  dimensions=$(curl -fsS "$base_url$path" | python3 -c 'import struct,sys; data=sys.stdin.buffer.read(); print("%dx%d" % struct.unpack(">II", data[16:24]))')
  test "$dimensions" = "$expected"
  printf 'PASS %-44s %s\n' "$path dimensions" "$dimensions"
}

check_status / text/html
check_status /manifest.json application/json
check_status /regions.json application/json
check_status /vendor/maplibre-gl.mjs application/javascript
check_status /styles/daylight/style.json application/json
check_status /styles/midnight/style.json application/json
check_status /styles/cyberpunk/style.json application/json
check_status /styles/cyberpunk-tactical/style.json application/json
for theme in daylight midnight cyberpunk cyberpunk-tactical; do
  check_status "/styles/$theme/sprite.json" application/json
  check_status "/styles/$theme/sprite.png" image/png
  check_status "/styles/$theme/sprite@2x.json" application/json
  check_status "/styles/$theme/sprite@2x.png" image/png
done
check_status /data/osm.json application/json
check_status "/data/osm/$tile.pbf" application/x-protobuf
check_status "/styles/daylight/$tile.png" image/png
check_status "/styles/midnight/$tile.png" image/png
check_status "/styles/cyberpunk/$tile.png" image/png
check_status "/styles/cyberpunk-tactical/$tile.png" image/png
for theme in daylight midnight cyberpunk cyberpunk-tactical; do
  check_status "/styles/$theme/$tile@2x.png" image/png
  check_png_dimensions "/styles/$theme/$tile@2x.png" 512x512
  check_status "/styles/$theme/$high_zoom/$high_x/$high_y@2x.png" image/png
  check_png_dimensions "/styles/$theme/$high_zoom/$high_x/$high_y@2x.png" 512x512
done

for region in california florida; do
  region_tile=$(python3 -c "import json; print(next(region['testTile'] for region in json.load(open('data/regions.json'))['regions'] if region['id'] == '$region'))")
  check_status "/regions/$region.json" application/json
  check_status "/data/$region.json" application/json
  check_status "/data/$region/$region_tile.pbf" application/x-protobuf
  for theme in daylight midnight cyberpunk cyberpunk-tactical; do
    check_status "/styles/$region-$theme/style.json" application/json
    check_status "/styles/$region-$theme/$region_tile@2x.png" image/png
    check_png_dimensions "/styles/$region-$theme/$region_tile@2x.png" 512x512
  done
done

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

node -e "import('./web/atak.js').then(({buildAtakXml}) => { for (const theme of ['midnight', 'cyberpunk', 'cyberpunk-tactical']) { const xml = buildAtakXml({ theme, region: 'florida', regionName: 'Florida', baseUrl: '$base_url/' }); if (!xml.includes('<tileType>png</tileType>') || !xml.includes('$base_url/styles/florida-' + theme + '/{\$z}/{\$x}/{\$y}@2x.png')) process.exit(1); } })"
printf 'PASS generated ATAK XML has raster URL and zoom contract\n'

external_urls=$(rg -n 'https?://' web styles \
  --glob '!web/vendor/**' \
  --glob '!**/*.test.js' | rg -v 'http://www.w3.org/2000/svg' || true)
if test -n "$external_urls"; then
  printf '%s\n' "$external_urls"
  printf 'FAIL runtime web/style source contains an external URL\n' >&2
  exit 1
fi
printf 'PASS runtime web and style assets have no external URL dependencies\n'

printf 'All HTTP integration checks passed.\n'

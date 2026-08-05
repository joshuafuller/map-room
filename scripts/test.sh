#!/bin/sh
set -eu

base_url=${BASE_URL:-http://localhost:8088}
themes="daylight midnight dark-blue dark-red dark-green cyberpunk cyberpunk-tactical"
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
	tr -d '\r' <"$headers" | grep -qi "^content-type: $expected_type"
	test -s "$body"
	printf 'PASS %-44s %s bytes\n' "$path" "$(wc -c <"$body")"
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
check_status /vendor/qrcode-generator.mjs application/javascript
for theme in $themes; do
	check_status "/styles/$theme/style.json" application/json
done

first_region=$(python3 -c "import json; print(json.load(open('data/regions.json'))['regions'][0]['id'])")
check_status /api/atak/raster/daylight.xml application/xml
check_status "/api/atak/vector/$first_region.json" application/json
atak_vector_headers="$tmp_dir/atak-vector-headers"
atak_vector_byte="$tmp_dir/atak-vector-byte"
atak_vector_status=$(curl -sS -r 0-0 -D "$atak_vector_headers" -o "$atak_vector_byte" -w '%{http_code}' "$base_url/atak/vector/$first_region.mbtiles")
test "$atak_vector_status" = "206"
test "$(wc -c <"$atak_vector_byte")" = "1"
tr -d '\r' <"$atak_vector_headers" | grep -qi '^content-type: application/vnd.mapbox-vector-tile'
tr -d '\r' <"$atak_vector_headers" | grep -qi "^content-disposition: attachment; filename=\"map-room-$first_region-vector.mbtiles\""
tr -d '\r' <"$atak_vector_headers" | grep -qi '^content-range: bytes 0-0/'
printf 'PASS ATAK vector archive supports a resumable download\n'

mobile_host=mobile.example.test:8088
mobile_style="$tmp_dir/mobile-style.json"
curl -fsS -H "Host: $mobile_host" "$base_url/styles/all-daylight/style.json" >"$mobile_style"
if rg -q 'localhost' "$mobile_style"; then
	printf 'FAIL remote-browser style redirected vector sources to localhost\n' >&2
	exit 1
fi
python3 -c 'import json,sys; style=json.load(open(sys.argv[1])); assert all(source.get("url", "").startswith(("/data/", "http://mobile.example.test:8088/data/")) for source in style["sources"].values() if source.get("type") == "vector")' "$mobile_style"
printf 'PASS remote-browser vector sources preserve the requesting origin\n'
curl -fsS -H "Host: $mobile_host" "$base_url/api/atak/raster/daylight.xml" | grep -q "http://$mobile_host/styles/all-daylight/"
curl -fsS -H "Host: $mobile_host" "$base_url/api/atak/vector/$first_region.json" | grep -q "http://$mobile_host/data/$first_region/"
printf 'PASS hosted ATAK definitions preserve the requesting origin\n'
for theme in $themes; do
	check_status "/styles/$theme/sprite.json" application/json
	check_status "/styles/$theme/sprite.png" image/png
	check_status "/styles/$theme/sprite@2x.json" application/json
	check_status "/styles/$theme/sprite@2x.png" image/png
done
for theme in $themes; do
	check_status "/styles/$theme/$tile.png" image/png
done
for theme in $themes; do
	check_status "/styles/$theme/$tile@2x.png" image/png
	check_png_dimensions "/styles/$theme/$tile@2x.png" 512x512
	check_status "/styles/$theme/$high_zoom/$high_x/$high_y@2x.png" image/png
	check_png_dimensions "/styles/$theme/$high_zoom/$high_x/$high_y@2x.png" 512x512
done

for region in $(python3 -c "import json; print(' '.join(region['id'] for region in json.load(open('data/regions.json'))['regions']))"); do
	region_tile=$(python3 -c "import json; print(next(region['testTile'] for region in json.load(open('data/regions.json'))['regions'] if region['id'] == '$region'))")
	check_status "/regions/$region.json" application/json
	check_status "/data/$region.json" application/json
	check_status "/data/$region/$region_tile.pbf" application/x-protobuf
	for theme in $themes; do
		check_status "/styles/all-$theme/style.json" application/json
		check_status "/styles/all-$theme/$region_tile@2x.png" image/png
		check_png_dimensions "/styles/all-$theme/$region_tile@2x.png" 512x512
	done
done

daylight_sha=$(curl -fsS "$base_url/styles/daylight/$tile.png" | sha256sum | cut -d' ' -f1)
midnight_sha=$(curl -fsS "$base_url/styles/midnight/$tile.png" | sha256sum | cut -d' ' -f1)
cyberpunk_sha=$(curl -fsS "$base_url/styles/cyberpunk/$tile.png" | sha256sum | cut -d' ' -f1)
tactical_sha=$(curl -fsS "$base_url/styles/cyberpunk-tactical/$tile.png" | sha256sum | cut -d' ' -f1)
dark_blue_sha=$(curl -fsS "$base_url/styles/dark-blue/$tile.png" | sha256sum | cut -d' ' -f1)
dark_red_sha=$(curl -fsS "$base_url/styles/dark-red/$tile.png" | sha256sum | cut -d' ' -f1)
dark_green_sha=$(curl -fsS "$base_url/styles/dark-green/$tile.png" | sha256sum | cut -d' ' -f1)
test "$daylight_sha" != "$midnight_sha"
test "$daylight_sha" != "$cyberpunk_sha"
test "$midnight_sha" != "$cyberpunk_sha"
test "$tactical_sha" != "$daylight_sha"
test "$tactical_sha" != "$midnight_sha"
test "$tactical_sha" != "$cyberpunk_sha"
test "$dark_blue_sha" != "$midnight_sha"
test "$dark_red_sha" != "$dark_blue_sha"
test "$dark_green_sha" != "$dark_blue_sha"
test "$dark_green_sha" != "$dark_red_sha"
printf 'PASS all themes produce distinct raster output\n'

curl -fsS "$base_url/app.js" | grep -q '/vendor/maplibre-gl.mjs'
curl -fsS "$base_url/styles/daylight/style.json" | grep -q 'OpenStreetMap contributors'
printf 'PASS frontend uses local MapLibre and includes attribution\n'

node -e "import('./web/atak.js').then(({buildAtakXml}) => { for (const theme of '$themes'.split(' ')) { const xml = buildAtakXml({ theme, baseUrl: '$base_url/' }); if (!xml.includes('<tileType>png</tileType>') || !xml.includes('$base_url/styles/all-' + theme + '/{\$z}/{\$x}/{\$y}@2x.png') || (xml.match(/<customMapSource>/g) || []).length !== 1) process.exit(1); } })"
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

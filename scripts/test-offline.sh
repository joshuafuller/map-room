#!/bin/sh
set -eu

project=atlas-offline-proof
compose="docker compose -p $project -f compose.yaml -f compose.offline.yaml"

cleanup() {
	$compose down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

$compose up -d --wait

$compose exec -T web wget -q -O /dev/null http://127.0.0.1/
printf 'PASS isolated web container serves the frontend\n'

for region in $(python3 -c "import json; print(' '.join(region['id'] for region in json.load(open('data/regions.json'))['regions']))"); do
	tile=$(python3 -c "import json; print(next(region['testTile'] for region in json.load(open('data/regions.json'))['regions'] if region['id'] == '$region'))")
	$compose exec -T web wget -q -O /dev/null "http://tiles:8080/data/$region/$tile.pbf"
	$compose exec -T web wget -q -O /dev/null "http://tiles:8080/styles/all-daylight/$tile.png"
	printf 'PASS one isolated composed layer serves %s vector and raster coverage\n' "$region"
done

if $compose exec -T web wget -q -T 2 -O /dev/null https://example.com; then
	printf 'FAIL isolated runtime unexpectedly reached the internet\n' >&2
	exit 1
fi
printf 'PASS isolated runtime has no outbound internet route\n'

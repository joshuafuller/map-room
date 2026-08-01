#!/bin/sh
set -eu

project=atlas-offline-proof
compose="docker compose -p $project -f compose.yaml -f compose.offline.yaml"
tile=$(python3 -c "import json; print(json.load(open('data/manifest.json'))['testTile'])")

cleanup() {
  $compose down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

$compose up -d --wait

$compose exec -T web wget -q -O /dev/null http://127.0.0.1/
printf 'PASS isolated web container serves the frontend\n'

$compose exec -T web wget -q -O /dev/null http://tiles:8080/styles/daylight/style.json
$compose exec -T web wget -q -O /dev/null "http://tiles:8080/styles/daylight/$tile.png"
printf 'PASS isolated runtime network serves style and raster tile\n'

if $compose exec -T web wget -q -T 2 -O /dev/null https://example.com; then
  printf 'FAIL isolated runtime unexpectedly reached the internet\n' >&2
  exit 1
fi
printf 'PASS isolated runtime has no outbound internet route\n'

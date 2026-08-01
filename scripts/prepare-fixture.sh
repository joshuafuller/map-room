#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
data_dir="$root_dir/data"
region=${1:-monaco}
region_label=$(printf '%s' "$region" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
mkdir -p "$data_dir" "$data_dir/fonts" "$root_dir/web/vendor"

docker run --rm \
  -e JAVA_TOOL_OPTIONS=-Xmx2g \
  -v "$data_dir:/data" \
  ghcr.io/onthegomap/planetiler:0.10.1 \
  --download \
  --area="$region" \
  --output="/data/$region.mbtiles" \
  --force \
  --water-polygons-url=https://github.com/onthegomap/planetiler/raw/main/planetiler-core/src/test/resources/water-polygons-split-3857.zip \
  --natural-earth-url=https://github.com/onthegomap/planetiler/raw/main/planetiler-core/src/test/resources/natural_earth_vector.sqlite.zip

fixture_dir=$(mktemp -d)
trap 'rm -rf "$fixture_dir"' EXIT
curl -fsSL \
  https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip \
  -o "$fixture_dir/test_data.zip"
unzip -q "$fixture_dir/test_data.zip" 'fonts/*' -d "$fixture_dir"
cp -R "$fixture_dir/fonts/." "$data_dir/fonts/"

cd "$root_dir"
npm ci
npm run build:styles
cp node_modules/maplibre-gl/dist/*.mjs web/vendor/
cp node_modules/maplibre-gl/dist/maplibre-gl.css web/vendor/

ln -sfn "$region.mbtiles" "$data_dir/current.mbtiles"
python3 "$root_dir/scripts/write-manifest.py" "$data_dir/$region.mbtiles" "$data_dir/manifest.json" "$region_label"

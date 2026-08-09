#!/bin/sh
# Verify the documented quick start against a clean checkout: `docker compose up`
# alone must produce a fully loadable app shell with no host toolchain.
#
# This guards the failure where web/vendor was untracked and never provisioned, so
# /vendor/maplibre-gl.mjs 404ed, web/app.js:1 aborted, and every feature died.
#
# scripts/test.sh overlaps on a few of these paths. Keep both: that one needs a
# fully built map library, this one runs against an empty one, which is the state a
# new user is actually in.
set -eu

base_url=${BASE_URL:-http://localhost:8088}
root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

expect_status() {
	path=$1
	expected=$2
	status=$(curl -sS -o "$tmp_dir/body" -w '%{http_code}' "$base_url$path")
	if [ "$status" != "$expected" ]; then
		printf 'FAIL %-46s expected %s, got %s\n' "$path" "$expected" "$status" >&2
		exit 1
	fi
	printf 'PASS %-46s %s\n' "$path" "$status"
}

expect_asset() {
	path=$1
	expected_type=$2
	status=$(curl -sS -D "$tmp_dir/headers" -o "$tmp_dir/body" -w '%{http_code}' "$base_url$path")
	if [ "$status" != "200" ]; then
		printf 'FAIL %-46s expected 200, got %s\n' "$path" "$status" >&2
		exit 1
	fi
	if ! tr -d '\r' <"$tmp_dir/headers" | grep -qi "^content-type: $expected_type"; then
		printf 'FAIL %-46s expected content-type %s\n' "$path" "$expected_type" >&2
		exit 1
	fi
	if [ ! -s "$tmp_dir/body" ]; then
		printf 'FAIL %-46s empty body\n' "$path" >&2
		exit 1
	fi
	printf 'PASS %-46s %s bytes\n' "$path" "$(wc -c <"$tmp_dir/body")"
}

expect_asset / text/html

# Every module web/app.js imports on its first line, plus the stylesheet and the
# import-map entry index.html declares.
expect_asset /app.js application/javascript
expect_asset /vendor/maplibre-gl.mjs application/javascript
expect_asset /vendor/maplibre-gl-shared.mjs application/javascript
expect_asset /vendor/maplibre-gl-worker.mjs application/javascript
expect_asset /vendor/qrcode-generator.mjs application/javascript
expect_asset /vendor/maplibre-gl.css text/css

# Glyphs come from the provisioner, not the repository. They cannot be checked over
# HTTP here: tileserver-gl only runs once a map exists, so /fonts/... answers 503 on
# an empty library. Check the provisioned tree directly. Without this, a user only
# discovers the gap after a long map build, when labels fail to render.
if find "$root_dir/data/fonts" -type f -name '*.pbf' -print -quit 2>/dev/null | grep -q .; then
	printf 'PASS %-46s %s stacks\n' 'data/fonts glyph pack' \
		"$(find "$root_dir/data/fonts" -mindepth 1 -maxdepth 1 -type d | wc -l)"
else
	printf 'FAIL %-46s no .pbf glyphs provisioned\n' 'data/fonts glyph pack' >&2
	exit 1
fi

# A missing asset must 404 rather than silently serving the index.html shell.
expect_status /vendor/does-not-exist.css 404
expect_status /vendor/does-not-exist.mjs 404

# ...but the static-asset rule must not steal API routes that end in .json.
# maintainer/src/api.js serves /api/atak/vector/<id>.json, and nginx prefers a
# matching regex location over a plain prefix location, so `location /api/` needs
# ^~ to stay ahead of it. An empty library answers 404 as JSON from the
# maintainer; a disk lookup would answer 404 as text/html instead.
api_json=/api/atak/vector/no-such-region.json
status=$(curl -sS -D "$tmp_dir/headers" -o /dev/null -w '%{http_code}' "$base_url$api_json")
if ! tr -d '\r' <"$tmp_dir/headers" | grep -qi '^content-type: application/json'; then
	printf 'FAIL %-46s not reaching the maintainer (status %s)\n' "$api_json" "$status" >&2
	exit 1
fi
printf 'PASS %-46s proxied to maintainer (%s)\n' "$api_json" "$status"

printf '\nQuick start smoke test passed.\n'

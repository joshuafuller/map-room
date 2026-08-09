#!/bin/sh
# Provision the host-side assets that are deliberately absent from the repository:
# the vendored browser bundles under web/vendor and the glyph pack under data/fonts.
#
# Both the documented Docker quick start and the contributor setup script depend on
# this. It is idempotent, so it is safe to run on every `docker compose up`.
set -eu

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
data_dir=${MAP_ROOM_DATA_DIR:-"$root_dir/data"}
font_dir="$data_dir/fonts"
vendor_dir="$root_dir/web/vendor"
stamp_file="$vendor_dir/.provisioned"
fixture_url=https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'Missing required command: %s\n' "$1" >&2
		exit 1
	fi
}

# node:24-alpine ships wget but not curl; developer machines usually have curl.
download() {
	url=$1
	target=$2
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$url" -o "$target"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$target" "$url"
	else
		printf 'Missing required command: curl or wget\n' >&2
		exit 1
	fi
}

fonts_present() {
	find "$font_dir" -type f -name '*.pbf' -print -quit 2>/dev/null | grep -q .
}

vendor_files_present() {
	for name in maplibre-gl.mjs maplibre-gl-shared.mjs maplibre-gl-worker.mjs \
		maplibre-gl.css qrcode-generator.mjs MapLibre-LICENSE.txt; do
		test -f "$vendor_dir/$name" || return 1
	done
	return 0
}

vendored_packages="maplibre-gl qrcode-generator"

pinned_version() {
	node -p 'require(process.argv[1]).packages["node_modules/" + process.argv[2]].version' \
		"$root_dir/package-lock.json" "$1"
}

installed_version() {
	node -p 'require(process.argv[1]).version' "$root_dir/node_modules/$1/package.json" 2>/dev/null \
		|| printf 'absent'
}

pinned_versions() {
	for name in $vendored_packages; do
		printf '%s@%s ' "$name" "$(pinned_version "$name")"
	done
	printf '\n'
}

node_modules_match_lockfile() {
	for name in $vendored_packages; do
		test "$(installed_version "$name")" = "$(pinned_version "$name")" || return 1
	done
	return 0
}

# Filenames alone are not enough. maplibre-gl 6.1.0 and a later release ship the
# same names, so a version bump would otherwise leave stale bundles in place and
# the browser running old code indefinitely. Stamp what was copied and compare.
vendor_current() {
	vendor_files_present || return 1
	test -f "$stamp_file" || return 1
	test "$(cat "$stamp_file")" = "$(pinned_versions)"
}

copy_vendor_from() {
	modules=$1
	cp "$modules"/maplibre-gl/dist/*.mjs "$vendor_dir/"
	cp "$modules"/maplibre-gl/dist/maplibre-gl.css "$vendor_dir/"
	cp "$modules"/maplibre-gl/LICENSE.txt "$vendor_dir/MapLibre-LICENSE.txt"
	cp "$modules"/qrcode-generator/dist/qrcode.mjs "$vendor_dir/qrcode-generator.mjs"
}

# The stack runs as MAP_ROOM_UID/GID, which need not match whoever owns the
# checkout. A CI runner checks out as 1001; a developer may be any uid. When this
# runs as root inside the setup container, hand the provisioned trees to the uid the
# stack actually uses, so neither this script nor tileserver hits a permission wall.
normalize_ownership() {
	[ "$(id -u)" = 0 ] || return 0
	chown -R "${MAP_ROOM_UID:-1000}:${MAP_ROOM_GID:-1000}" "$font_dir" "$vendor_dir"
	chown "${MAP_ROOM_UID:-1000}:${MAP_ROOM_GID:-1000}" "$data_dir"
}

mkdir -p "$font_dir" "$vendor_dir"
normalize_ownership

# Outside the container there is no root to fall back on, so a directory Docker
# already created as root has to be reported rather than silently failing in cp.
for dir in "$font_dir" "$vendor_dir"; do
	if [ ! -w "$dir" ]; then
		printf '%s is not writable by uid %s.\n' "$dir" "$(id -u)" >&2
		printf 'Fix ownership on the host, then retry:\n  sudo chown -R %s:%s %s\n' \
			"$(id -u)" "$(id -g)" "$dir" >&2
		exit 1
	fi
done

if fonts_present; then
	printf 'Glyphs already present in %s\n' "$font_dir"
else
	require_command unzip
	fixture_dir=$(mktemp -d)
	trap 'rm -rf "$fixture_dir"' EXIT HUP INT TERM
	printf 'Downloading glyph pack...\n'
	download "$fixture_url" "$fixture_dir/test_data.zip"
	unzip -q "$fixture_dir/test_data.zip" 'fonts/*' -d "$fixture_dir"
	cp -R "$fixture_dir/fonts/." "$font_dir/"
	printf 'Installed glyphs into %s\n' "$font_dir"
fi

require_command node

if vendor_current; then
	printf 'Browser bundles already match the lockfile (%s)\n' "$(pinned_versions)"
	normalize_ownership
	exit 0
fi

if vendor_files_present; then
	printf 'Browser bundles are stale, refreshing to %s\n' "$(pinned_versions)"
fi

require_command npm

if node_modules_match_lockfile; then
	# A contributor already has the pinned versions installed. Reuse them rather
	# than running npm ci, which would delete and reinstall their node_modules.
	copy_vendor_from "$root_dir/node_modules"
else
	# Install into a scratch tree so the caller's checkout is never mutated. The
	# lockfile is copied in, so the bundles match the pinned versions exactly.
	install_dir=$(mktemp -d)
	trap 'rm -rf "${fixture_dir:-}" "$install_dir"' EXIT HUP INT TERM
	cp "$root_dir/package.json" "$root_dir/package-lock.json" "$install_dir/"
	printf 'Installing pinned browser dependencies...\n'
	(cd "$install_dir" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)
	copy_vendor_from "$install_dir/node_modules"
fi

pinned_versions >"$stamp_file"
normalize_ownership

printf 'Installed browser bundles into %s (%s)\n' "$vendor_dir" "$(pinned_versions)"

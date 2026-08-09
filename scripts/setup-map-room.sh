#!/bin/sh
set -eu

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'Missing required command: %s\n' "$1" >&2
		exit 1
	fi
}

require_command npm

# Contributors get the full toolchain and regenerated styles. The browser bundles
# and glyph pack come from the same provisioner the Docker quick start uses.
cd "$root_dir"
npm ci
npm run build:styles

"$root_dir/scripts/provision-assets.sh"

printf 'Map Room browser assets and local fonts are ready.\n'

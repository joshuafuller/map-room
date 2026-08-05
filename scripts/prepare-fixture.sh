#!/bin/sh
set -eu

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
region=${1:-rhode island}
region_id=$(printf '%s' "$region" | tr '[:upper:] _/' '[:lower:]---' | sed 's/[^a-z0-9-]//g; s/--*/-/g; s/^-//; s/-$//')
region_label=$(printf '%s' "$region" | sed 's/[-_/]/ /g; s/\b\(.\)/\u\1/g')

if test -z "$region_id"; then
	printf 'Unable to derive a safe map ID from: %s\n' "$region" >&2
	exit 2
fi

exec "$root_dir/scripts/create-map.sh" \
	--area "$region" \
	--id "$region_id" \
	--name "$region_label" \
	--force

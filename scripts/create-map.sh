#!/bin/sh
set -eu

usage() {
	cat <<'EOF'
Create an ATAK-ready Map Room publication from OpenStreetMap data.

Usage:
  ./scripts/create-map.sh --area AREA --id ID --name NAME [options]
  ./scripts/create-map.sh --pbf FILE --id ID --name NAME [options]
  ./scripts/create-map.sh --url URL --id ID --name NAME [options]

Source (choose exactly one):
  --area AREA   Planetiler/Geofabrik area, for example "rhode island" or
                texas (quote names containing spaces)
  --pbf FILE    Existing .osm.pbf file
  --url URL     HTTPS URL to an .osm.pbf file

Required:
  --id ID       Stable lowercase ID using letters, numbers, and hyphens
  --name NAME   Human-readable map name shown in Map Room and ATAK

Options:
  --memory SIZE JVM memory limit (default: 2g)
  --force       Replace an existing publication with the same ID
  --no-setup    Skip npm, browser asset, style, and font setup
  -h, --help    Show this help

The command creates data/ID.mbtiles and data/regions/ID.json. It does not
start the server or make the repository public.
EOF
}

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
data_dir=${MAP_ROOM_DATA_DIR:-"$root_dir/data"}
planetiler_image=${MAP_ROOM_PLANETILER_IMAGE:-ghcr.io/onthegomap/planetiler:0.10.1}
memory=${MAP_ROOM_BUILD_MEMORY:-2g}
source_type=
source_value=
map_id=
map_name=
force=false
run_setup=true

fail() {
	printf 'Error: %s\n' "$1" >&2
	printf 'Run ./scripts/create-map.sh --help for usage.\n' >&2
	exit 2
}

require_value() {
	test "$#" -ge 2 || fail "$1 requires a value"
	test -n "$2" || fail "$1 requires a value"
}

select_source() {
	test -z "$source_type" || fail 'choose exactly one of --area, --pbf, or --url'
	source_type=$1
	source_value=$2
}

while test "$#" -gt 0; do
	case "$1" in
	--area | --pbf | --url)
		require_value "$@"
		select_source "${1#--}" "$2"
		shift 2
		;;
	--id)
		require_value "$@"
		map_id=$2
		shift 2
		;;
	--name)
		require_value "$@"
		map_name=$2
		shift 2
		;;
	--memory)
		require_value "$@"
		memory=$2
		shift 2
		;;
	--force)
		force=true
		shift
		;;
	--no-setup)
		run_setup=false
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*) fail "unknown argument: $1" ;;
	esac
done

test -n "$source_type" || fail 'one source is required: --area, --pbf, or --url'
test -n "$map_id" || fail '--id is required'
test -n "$map_name" || fail '--name is required'
printf '%s' "$map_id" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' || fail '--id must be a lowercase slug'
printf '%s' "$memory" | grep -Eq '^[1-9][0-9]*[mMgG]$' || fail '--memory must look like 2g or 4096m'

case "$source_type" in
area)
	printf '%s' "$source_value" | grep -Eq '^[a-z0-9]+([ /-][a-z0-9]+)*$' || fail '--area contains unsupported characters'
	;;
pbf)
	test -f "$source_value" || fail "PBF file not found: $source_value"
	case "$source_value" in *.osm.pbf) ;; *) fail '--pbf must name an .osm.pbf file' ;; esac
	;;
url)
	case "$source_value" in https://*.osm.pbf) ;; *) fail '--url must be an HTTPS .osm.pbf URL' ;; esac
	;;
esac

for command in docker node python3; do
	command -v "$command" >/dev/null 2>&1 || fail "missing required command: $command"
done
if test "$source_type" = url; then
	command -v curl >/dev/null 2>&1 || fail 'missing required command: curl'
fi

archive="$data_dir/$map_id.mbtiles"
manifest_dir="$data_dir/regions"
manifest="$manifest_dir/$map_id.json"
if { test -e "$archive" || test -e "$manifest"; } && test "$force" != true; then
	fail "publication '$map_id' already exists; choose another ID or pass --force"
fi

mkdir -p "$data_dir" "$data_dir/sources" "$manifest_dir"
build_name=".$map_id-building-$$.mbtiles"
build_archive="$data_dir/$build_name"
source_cache="$data_dir/sources/$map_id.osm.pbf"
cleanup() {
	rm -f "$build_archive"
}
trap cleanup EXIT HUP INT TERM

if test "$source_type" = url; then
	download="$source_cache.download-$$"
	trap 'rm -f "$build_archive" "$download"' EXIT HUP INT TERM
	printf 'Downloading %s...\n' "$map_name"
	curl -fL --retry 3 --continue-at - "$source_value" -o "$download"
	mv "$download" "$source_cache"
elif test "$source_type" = pbf; then
	source_absolute=$(CDPATH='' cd -- "$(dirname -- "$source_value")" && pwd)/$(basename -- "$source_value")
	if test "$source_absolute" != "$source_cache"; then
		cp "$source_absolute" "$source_cache"
	fi
fi

printf 'Building %s with %s...\n' "$map_name" "$planetiler_image"
if test "$source_type" = area; then
	docker run --rm \
		-e "JAVA_TOOL_OPTIONS=-Xmx$memory" \
		-v "$data_dir:/data" \
		"$planetiler_image" \
		--download \
		--area="$source_value" \
		--output="/data/$build_name" \
		--force
else
	docker run --rm \
		-e "JAVA_TOOL_OPTIONS=-Xmx$memory" \
		-v "$data_dir:/data" \
		"$planetiler_image" \
		--download \
		--osm-path="/data/sources/$map_id.osm.pbf" \
		--output="/data/$build_name" \
		--force
fi

test -s "$build_archive" || fail 'Planetiler did not create a non-empty MBTiles archive'
mv "$build_archive" "$archive"
python3 "$root_dir/scripts/write-manifest.py" "$archive" "$manifest" "$map_name"

if test "$run_setup" = true; then
	"$root_dir/scripts/setup-map-room.sh"
fi

MAP_ROOM_DATA_DIR="$data_dir" node "$root_dir/scripts/configure-regions.mjs"
trap - EXIT HUP INT TERM

printf '\nCreated %s\n' "$archive"
printf 'Manifest: %s\n' "$manifest"
printf 'Next: MAP_ROOM_DEFAULT_REGION=%s docker compose up -d --wait --force-recreate\n' "$map_id"
printf 'Then open http://SERVER-LAN-IP:8088 from the ATAK device.\n'

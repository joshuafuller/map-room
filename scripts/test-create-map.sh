#!/bin/sh
set -eu

root_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM
fake_bin="$tmp_dir/bin"
data_dir="$tmp_dir/data"
mkdir -p "$fake_bin" "$data_dir"

assert_fails() {
	if "$@" >"$tmp_dir/stdout" 2>"$tmp_dir/stderr"; then
		printf 'Expected command to fail: %s\n' "$*" >&2
		exit 1
	fi
}

"$root_dir/scripts/create-map.sh" --help | grep -q 'choose exactly one'
assert_fails "$root_dir/scripts/create-map.sh" --id demo --name Demo
grep -q 'one source is required' "$tmp_dir/stderr"
assert_fails "$root_dir/scripts/create-map.sh" --area "rhode island" --id '../demo' --name Demo
grep -q 'lowercase slug' "$tmp_dir/stderr"
assert_fails "$root_dir/scripts/create-map.sh" --area "rhode island" --url https://example.test/demo.osm.pbf --id demo --name Demo
grep -q 'choose exactly one' "$tmp_dir/stderr"

cat >"$fake_bin/docker" <<'EOF'
#!/bin/sh
set -eu
data_dir=
output=
for argument in "$@"; do
  case "$argument" in
    *:/data) data_dir=${argument%:/data} ;;
    --output=/data/*) output=${argument#--output=/data/} ;;
  esac
done
test -n "$data_dir"
test -n "$output"
printf 'fake mbtiles\n' >"$data_dir/$output"
printf '%s\n' "$@" >"$data_dir/docker-arguments.txt"
EOF

cat >"$fake_bin/python3" <<'EOF'
#!/bin/sh
set -eu
output=$3
name=$4
printf '{"region":"%s","archive":"demo.mbtiles","bounds":[0,0,1,1],"testTile":"0/0/0"}\n' "$name" >"$output"
EOF

cat >"$fake_bin/node" <<'EOF'
#!/bin/sh
set -eu
test -f "$MAP_ROOM_DATA_DIR/regions/demo.json"
printf 'configured\n'
EOF
chmod +x "$fake_bin/docker" "$fake_bin/python3" "$fake_bin/node"

PATH="$fake_bin:$PATH" MAP_ROOM_DATA_DIR="$data_dir" \
	"$root_dir/scripts/create-map.sh" --area "rhode island" --id demo --name 'Demo Map' --memory 3g --no-setup \
	>"$tmp_dir/success-output"

test -s "$data_dir/demo.mbtiles"
grep -q '"region":"Demo Map"' "$data_dir/regions/demo.json"
grep -q -- '--area=rhode island' "$data_dir/docker-arguments.txt"
grep -q -- 'JAVA_TOOL_OPTIONS=-Xmx3g' "$data_dir/docker-arguments.txt"
grep -q -- 'docker compose up -d --wait --force-recreate' "$tmp_dir/success-output"

assert_fails env PATH="$fake_bin:$PATH" MAP_ROOM_DATA_DIR="$data_dir" \
	"$root_dir/scripts/create-map.sh" --area "rhode island" --id demo --name 'Demo Map' --no-setup
grep -q 'already exists' "$tmp_dir/stderr"

printf 'All create-map command checks passed.\n'

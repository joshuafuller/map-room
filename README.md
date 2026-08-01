# Map Room

Map Room is a self-hosted map service for web, offline, and ATAK users. This
repository currently contains the Slice 0 compatibility proof described in
[`ARCHITECTURE.md`](ARCHITECTURE.md). It builds a regional OpenMapTiles archive,
serves two vector/raster themes, displays them in a self-contained MapLibre
website, and creates ATAK map-source XML in the browser.

## Prepare and run

```sh
./scripts/prepare-fixture.sh monaco
docker compose up -d
```

Open <http://localhost:8088>.

## Verify

```sh
./scripts/test.sh
./scripts/test-offline.sh
npx playwright install chromium # first browser-test run only
npm run test:browser
```

Stop the service with `docker compose down`. Everything needed at runtime is
local after preparation; the test script verifies that the runtime web and
style sources contain no external URL dependencies. Egress blocking remains a
deployment/network control; `test-offline.sh` creates a disposable internal-only
Docker network and proves the stack still works with egress unavailable.

The fixture is for integration testing, not production use. Replace `monaco`
with another Planetiler/Geofabrik region such as `florida`. Planetiler downloads
shared Natural Earth, lake, and water-polygon inputs during the first run.

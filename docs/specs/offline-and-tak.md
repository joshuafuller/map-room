# Offline and TAK specification

Status: Draft for issue #1

## Offline modes

Map Room uses distinct terms for distinct guarantees.

### Isolated server

A prepared Map Room installation serves installed maps on a network with no
public egress.

- **MR-OFF-001.** All runtime HTML, CSS, JavaScript, fonts, sprites, styles,
  manifests, and map data MUST be local.
- **MR-OFF-002.** Egress-blocked system tests MUST exercise the public viewer,
  every released style, one vector tile, one raster tile per scheme, public
  metadata, and health.
- **MR-OFF-003.** Provider checks and updates MUST enter deferred/offline state
  without impairing installed maps.
- **MR-OFF-004.** Isolated bundles MUST include pinned runtime images or OCI
  archives, configuration, checksums, installed artifact manifests, and offline
  installation/upgrade instructions.

### Browser offline shell

An installable web shell MAY retain navigation/help/status UI. It is not an
offline map guarantee.

- **MR-OFF-010.** The product MUST NOT claim browser map coverage unless a
  bounded artifact is deliberately selected and verified on that device.
- **MR-OFF-011.** Service-worker caches MUST be versioned, bounded, observable,
  and clearable.

### Portable map package

Bounded PMTiles/MBTiles or client-specific packages are a later release scope.
Every package MUST declare geographic bounds, zooms, bytes, checksum, source
lineage, license, attribution, and compatible client versions.

## TAK terminology and boundary

Map Room version 1 integrates with ATAK as a map source. It is not a TAK Server
and does not provide Cursor on Target, chat, tracking, mission packages beyond
map configuration, or TAK federation.

- **MR-TAK-001.** ATAK-facing raster sources MUST resolve through Map Room's
  stable public gateway and MUST not expose internal container hostnames.
- **MR-TAK-002.** Generated XML MUST include a unique stable name, tile format,
  min/max zoom, URL template, background color where supported, and generator
  version.
- **MR-TAK-003.** The URL scheme MUST be labeled and tested as XYZ or strict
  TMS. ATAK configuration names MUST not erase that distinction.
- **MR-TAK-004.** XML generation MUST escape all data and reject unsupported URL
  or credential combinations.
- **MR-TAK-005.** The browser's ATAK raster preview MUST request the same route,
  style, format, and scheme emitted in the XML.
- **MR-TAK-006.** Public documentation MUST state the supported ATAK edition,
  version, Android version, device profile, authentication profile, and known
  limitations.
- **MR-TAK-007.** Mock/XML tests prove generation only; they MUST NOT be reported
  as ATAK compatibility.

## ATAK validation matrix

Each supported profile MUST pass all of these on a real target or approved
emulator when the behavior is equivalent:

1. Import generated configuration by the documented novice workflow.
2. Confirm source name, bounds, zoom range, and theme appear correctly.
3. Display known tiles at low, medium, and maximum supported zoom.
4. Pan across tile boundaries and verify Y orientation and adjacency.
5. Select a bounded area and record estimated/actual tile count and bytes.
6. Complete the ATAK bulk/area download without authentication failures.
7. Disable all network connectivity and restart ATAK.
8. Display the cached area and verify uncached areas fail honestly.
9. Reconnect, update the server artifact, and verify cache/update behavior.
10. Repeat for every released theme and authentication profile.

- **MR-TAK-010.** Release evidence MUST include device/build identifiers,
  configuration checksum, server version, timestamps, screenshots, and pass/fail
  results.
- **MR-TAK-011.** At least one deliberately flipped-Y negative test MUST fail so
  the matrix proves coordinate orientation rather than mere tile reachability.
- **MR-TAK-012.** A supported ATAK profile MUST be revalidated after changes to
  ATAK version, XML generator, gateway/authentication, raster renderer, tile
  scheme, or caching headers.

The public ATAK-CIV source repository does not currently provide a complete,
current executable compatibility oracle for Map Room. Current ATAK releases and
device behavior therefore remain external validation requirements, not inferred
facts.

## Authentication

- **MR-TAK-020.** Version 1 MUST support an unauthenticated trusted-network map
  profile for initial compatibility testing.
- **MR-TAK-021.** Any authenticated profile MUST be proven compatible with the
  supported ATAK map-source request mechanism before release.
- **MR-TAK-022.** Credentials MUST NOT be embedded in downloadable XML unless a
  dedicated ADR accepts the exposure and defines scope, rotation, and
  revocation.
- **MR-TAK-023.** Browser session cookies MUST NOT be assumed to work for ATAK.

## Evidence currently available

The prototype has tested XML shape, browser rendering of the same XYZ PNG route,
and isolated server operation. Real ATAK import, area download, restart, and
airplane-mode behavior are **not validated**.

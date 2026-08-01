# Delivery plan and traceability

Status: Draft for issue #1

## Governing sequence

No slice begins until its predecessor's exit criteria are met. Work inside a
slice may run in parallel only when dependency links and shared contracts permit
it.

## Slice 0 — Governance and evidence baseline

Outcome: the repository cannot accept untracked, unspecified, untested, or
uncovered product behavior.

Exit criteria:

- specifications and ADRs are reviewed;
- issue and pull-request templates enforce traceability, Acceptance Criteria,
  Definition of Done, ADR impact, and red evidence;
- all retained authored executable code is inventoried;
- a 100% lines/statements/functions/branches gate exists and passes;
- generated, declarative, and third-party exclusions are explicit;
- current prototype behavior is labeled tested, validated, or unvalidated.

## Slice 1 — Durable core and provider SDK

Outcome: Map Room can represent desired state, discover sources, persist work,
and recover deterministically without yet publishing production maps.

Dependencies: Slice 0.

Deliverables:

- domain types and state machines;
- transactional metadata store and migrations;
- filesystem artifact-store contract;
- provider capability and conformance contracts;
- Geofabrik catalog/version adapter;
- local MBTiles/PMTiles import adapter;
- durable idempotent job queue and event journal;
- download staging, integrity, cancellation, resume, and resource guardrails.

Exit criteria: adapter conformance, crash recovery, hostile input, and 100%
coverage gates pass.

## Slice 2 — Artifact pipeline and lifecycle

Outcome: selected sources become validated immutable artifacts and survive
updates, failure, restart, rollback, and retention.

Dependencies: Slice 1.

Deliverables:

- transformer contract and Planetiler adapter;
- artifact/manifest validators;
- checksum and lineage recording;
- candidate release generation;
- atomic multi-map publication;
- last-known-good rollback and safe retention;
- startup and scheduled reconciliation;
- storage/build estimation evidence.

Exit criteria: fault injection at every pipeline phase proves the active map is
unchanged on failure and recoverable after restart.

## Slice 3 — Public delivery and cartography

Outcome: multiple maps are served through explicit interoperable contracts and
beautiful compatible styles.

Dependencies: Slice 2.

Deliverables:

- source-neutral public catalog and manifests;
- stable per-map vector, XYZ, strict TMS, TileJSON, and WMTS routes;
- generated multi-map tile-service configuration;
- shared style system;
- Daylight, Midnight, Tactical Canvas, and High Contrast;
- visual/accessibility gallery and review workflow;
- public viewer with map/style/scheme selection and endpoint discovery.

Exit criteria: protocol, cache, visual, accessibility, multi-map isolation, and
egress-blocked tests pass.

## Slice 4 — Maintainer experience and automation

Outcome: a first-time maintainer can select multiple maps, understand cost,
watch work, recover failure, and manage updates without technical knowledge.

Dependencies: Slices 1–3 contracts; UI may use fakes after API contracts freeze.

Deliverables:

- control API and SSE event stream;
- provider/catalog selection flow;
- map library and settings;
- durable progress, rate, ETA confidence, cancellation, and failure guidance;
- sync, pause, rollback, disable, remove, and retention workflows;
- first-run and responsive/accessibility acceptance suite.

Exit criteria: the novice usability script and all API/UI acceptance tests pass.

## Slice 5 — ATAK and offline release

Outcome: Map Room has evidence-backed disconnected and ATAK compatibility, not
configuration-only claims.

Dependencies: Slices 2–4.

Deliverables:

- versioned ATAK XML/catalog generator;
- exact ATAK raster browser preview;
- device/build compatibility matrix;
- import, online display, bounded download, restart, and airplane-mode evidence;
- isolated runtime bundle with images/assets/checksums;
- disconnected installation and upgrade procedure.

Exit criteria: every advertised ATAK profile and isolated deployment path passes
its real acceptance oracle.

## Slice 6 — Production readiness and release

Outcome: operators can install, secure, observe, back up, restore, upgrade, and
roll back a supported release.

Dependencies: Slices 0–5.

Deliverables:

- security profiles and authorization;
- health, metrics, logging, alerts, and diagnostics;
- backup/restore and migration exercises;
- resource/load benchmarks and supported hardware profile;
- dependency automation, SBOM, provenance, license inventory, and scanning;
- versioned packaging, release notes, support matrix, and runbooks.

Exit criteria: the production-release checklist passes on a clean host and an
upgrade from the prior supported version.

## Deferred source expansion

These are separate post-version-1 epics and cannot be pulled into version 1
without updated specifications and ADRs:

- licensed remote raster/WMTS acquisition and bounded caching;
- COG/GeoTIFF imagery ingestion;
- elevation, hillshade, terrain, and contours;
- private authenticated catalogs;
- bounded browser/ATAK portable packages;
- dataset composition/merging;
- live replication and planet-scale profiles.

## Requirement-to-evidence rule

The GitHub backlog is the authoritative assignment of requirements to work.
Every implementation issue MUST list its requirement IDs. Every pull request
MUST list its issue and produced test evidence. Release evidence MUST be
queryable by requirement ID.

The initial issue mapping is recorded in
[`../traceability.md`](../traceability.md) after backlog creation. `Planned`
means an issue exists; it does not mean the requirement is tested or validated.

## Global release gates

- all issue Acceptance Criteria and Definitions of Done are complete;
- all normative version 1 requirements have passing evidence;
- all four authored-code coverage metrics are exactly 100%;
- no unresolved critical/high security finding without an approved exception;
- no unknown license-policy state for published release fixtures/assets;
- all migrations, backup/restore, update failure, rollback, and clean install
  exercises pass;
- supported browser, platform, and ATAK matrices pass;
- no public runtime dependency exists in isolated mode;
- ADRs and operator/user documentation match shipped behavior.

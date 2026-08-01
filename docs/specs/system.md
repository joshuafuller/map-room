# System specification

Status: Draft for issue #1

## Architectural shape

Map Room version 1 is a modular monolith deployed as cooperating runtime and
worker processes. Modules share versioned domain contracts but do not reach
through one another's storage or provider internals.

```text
                             connected control plane

Provider catalogs ---> Provider adapters ---> durable job queue
        |                       |                      |
        |                       v                      v
        |                 staged inputs ---> transformer/validator
        |                                              |
        +--> maintainer UI/API <--- events/status       v
                                               immutable artifact store
                                                         |
                                      atomic publication + generated config
                                                         |
                              isolated serving plane     v

Browser / ATAK / GIS ---> gateway ---> viewer/static UI + tile service
                                      manifests/styles     |
                                                           v
                                                   published artifacts
```

The serving plane MUST continue operating if the control plane, provider,
internet connection, or current job fails.

## Components

- **MR-SYS-001 — Gateway.** A single HTTP entry point MUST route public assets,
  map endpoints, public metadata, and protected administration endpoints.
- **MR-SYS-002 — Control API.** A versioned API MUST own selections, settings,
  jobs, imports, updates, publication, rollback, and removal requests.
- **MR-SYS-003 — Maintainer UI.** A static/web client MUST consume only the
  public and control APIs; it MUST NOT manipulate files or subprocesses.
- **MR-SYS-004 — Orchestrator.** A domain service MUST reconcile desired map
  selections with installed and published state and enqueue idempotent work.
- **MR-SYS-005 — Provider adapters.** Provider-specific code MUST implement the
  source-provider contract and remain outside core orchestration.
- **MR-SYS-006 — Worker.** Long-running download, transform, validate, and
  publication jobs MUST execute outside the request lifecycle and survive UI
  disconnection.
- **MR-SYS-007 — Metadata store.** Durable structured state MUST use an embedded
  transactional database with migrations, constraints, and backup support.
- **MR-SYS-008 — Artifact store.** Large inputs and outputs MUST live on a
  filesystem using immutable, content-addressed or release-addressed paths.
- **MR-SYS-009 — Publisher.** Publication MUST create a complete candidate
  release, validate it, and atomically change the active release pointer.
- **MR-SYS-010 — Tile service.** The tile service MUST serve only published
  artifacts and generated, validated configuration.
- **MR-SYS-011 — Style catalog.** Style definitions MUST be generated from
  shared layers and versioned theme tokens and MUST declare compatible schemas.
- **MR-SYS-012 — Event stream.** Job and health events MUST be replayable from
  durable state after client reconnect; live delivery MAY use SSE.

## Domain model

### Provider

Identifies an adapter implementation and configuration. It declares
capabilities, authentication needs, network needs, terms, and health.

### Source item

A provider-owned selectable item such as a Geofabrik region or a local archive.
Its stable identity is `(provider_id, provider_item_id)`; display names are not
identifiers.

### Selection

Desired state for a source item: enabled, automatic-update policy, optional
schedule override, priority, and publication preferences.

### Source snapshot

An immutable acquired input with provider metadata, timestamps, size,
checksums, license/attribution policy, and acquisition evidence.

### Artifact

An immutable validated map output. It declares format, content kind, tile
scheme, bounds, zooms, schema, renderer compatibility, checksum, size, and
lineage to source snapshots and tool versions.

### Published map

A stable public map identity pointing to one active artifact and optionally one
previous known-good artifact. It declares styles and delivery capabilities.

### Job

A durable idempotent request with type, target, state, attempts, progress,
timestamps, diagnostics, and cancellation intent.

## State machines

### Selection reconciliation

```text
disabled
   |
enabled --> missing --> queued --> acquiring --> transforming --> validating
                         ^                                        |
                         |                                        v
                     retryable <--- failed <--- publishing <--- candidate
                                                  |
                                                  v
                                                ready
                                                  |
                                   source newer -> updating -> ready
```

- **MR-SYS-020.** Reconciliation MUST be idempotent for the same desired state
  and provider version.
- **MR-SYS-021.** At most one mutating job MAY operate on a published map at a
  time.
- **MR-SYS-022.** Duplicate requests MUST return the existing active job rather
  than create duplicate work.
- **MR-SYS-023.** Restart MUST recover queued/running jobs into a deterministic
  resumable, retryable, or failed state.
- **MR-SYS-024.** Cancellation MUST preserve staged evidence and the active
  artifact unless an explicit cleanup policy removes safe staging files.

### Artifact publication

```text
staged -> structurally valid -> semantically valid -> candidate release
                                                      |
                                         atomic pointer/config switch
                                                      |
                              previous <--- active ---+---> retained history
```

- **MR-SYS-030.** Artifacts MUST NOT be modified after validation.
- **MR-SYS-031.** Candidate configuration and all referenced files MUST validate
  before the active pointer changes.
- **MR-SYS-032.** Publication failure MUST leave the prior release addressable
  and active.
- **MR-SYS-033.** Rollback MUST switch to a retained validated release without
  rebuilding it.
- **MR-SYS-034.** Retention MUST never remove active or rollback-required
  artifacts.

## Multi-map behavior

- **MR-SYS-040.** Multiple selections MUST acquire and build independently.
- **MR-SYS-041.** Version 1 MUST publish each source item as a distinct map; it
  MUST NOT imply that overlapping regions are merged or deduplicated.
- **MR-SYS-042.** Public map IDs MUST remain stable across artifact updates.
- **MR-SYS-043.** Compatible maps MAY share generated theme definitions, but
  each published style MUST resolve to the correct artifact source.
- **MR-SYS-044.** One map's failed update MUST NOT block serving or updating
  unrelated maps.

## Concurrency and resource control

- **MR-SYS-050.** Resource-intensive transform concurrency MUST default to one
  and be configurable within validated limits.
- **MR-SYS-051.** Downloads MAY run concurrently with transforms when storage
  and bandwidth limits permit.
- **MR-SYS-052.** Before acquisition, the system MUST enforce configured free
  space reserves and reject work that is known not to fit.
- **MR-SYS-053.** Unknown sizes MUST be explicit and require configured
  guardrails rather than being treated as zero.
- **MR-SYS-054.** Job priority MUST be deterministic and starvation-resistant.

## Failure classification

Failures MUST be structured as user-actionable, retryable-system,
provider/transient, incompatible-input, policy/license, resource-exhausted, or
internal-defect. Raw tool output MAY be retained for diagnostics but MUST NOT be
the only user-facing explanation.

- **MR-SYS-060.** Every failed job MUST expose phase, stable error code,
  human-readable message, safe next actions, attempt, and correlation ID.
- **MR-SYS-061.** Automatic retries MUST use bounded backoff and MUST NOT retry
  incompatible-input or policy failures without changed input/configuration.
- **MR-SYS-062.** Secrets MUST be redacted from events, logs, manifests, and
  subprocess output.

## Deployment profiles

Version 1 defines:

1. **Connected workstation:** control and serving planes on one host with
   provider access.
2. **Connected LAN server:** public map service available to a trusted LAN;
   administration protected separately.
3. **Isolated runtime:** prebuilt release with no provider access; public map
   serving only.

The version 1 architecture MUST NOT require mounting a Docker daemon socket
into Map Room.

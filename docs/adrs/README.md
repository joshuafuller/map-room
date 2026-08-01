# Architecture Decision Records

ADRs capture consequential Map Room decisions. They are immutable after
acceptance except for status and links; a changed decision is recorded by a new
ADR that supersedes the old one.

Statuses are Proposed, Accepted, Rejected, Superseded, and Deprecated.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record consequential decisions | Accepted |
| [0002](0002-spec-driven-iron-law.md) | Specification-driven Iron Law delivery | Accepted |
| [0003](0003-source-neutral-provider-adapters.md) | Source-neutral provider adapters | Accepted |
| [0004](0004-modular-monolith-and-worker.md) | Modular monolith with separate worker | Proposed |
| [0005](0005-transactional-metadata-and-immutable-artifacts.md) | SQLite metadata and immutable filesystem artifacts | Proposed |
| [0006](0006-full-snapshot-update-model.md) | Full immutable snapshot updates for version 1 | Proposed |
| [0007](0007-explicit-tile-protocols.md) | Explicit XYZ, strict TMS, and WMTS contracts | Proposed |
| [0008](0008-one-renderer-versioned-style-system.md) | One renderer with a versioned multi-theme style system | Proposed |
| [0009](0009-rest-control-api-and-sse.md) | REST control API and SSE progress | Proposed |
| [0010](0010-typescript-authored-code.md) | Consolidate authored executable code in TypeScript | Proposed |
| [0011](0011-no-docker-socket.md) | Dedicated worker without a Docker socket | Proposed |
| [0012](0012-license-and-attribution-policy.md) | Propagate license and attribution policy | Accepted |
| [0013](0013-evidence-backed-atak-support.md) | Require real-client evidence for ATAK claims | Accepted |

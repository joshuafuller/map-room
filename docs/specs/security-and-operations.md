# Security and operations specification

Status: Draft for issue #1

## Trust boundaries

Provider responses, uploaded archives, catalog metadata, tile requests,
administrative requests, generated configuration, subprocess output, and
restored backups are untrusted inputs.

- **MR-SEC-001.** Public map delivery and administrative mutation MUST have
  distinct authorization policies.
- **MR-SEC-002.** The default workstation profile MUST bind administration to a
  local interface unless the maintainer explicitly configures remote access.
- **MR-SEC-003.** Connected LAN administration MUST require authenticated,
  encrypted transport or an explicitly documented trusted reverse proxy.
- **MR-SEC-004.** Provider credentials MUST use a secret store or mounted secret
  file, never persisted into manifests, job events, logs, URLs, or downloadable
  client configuration.
- **MR-SEC-005.** Source URLs and redirects MUST be checked against SSRF policy;
  local, link-local, metadata-service, and unexpected private targets MUST be
  denied unless an administrator explicitly configures a private provider.
- **MR-SEC-006.** Filesystem paths MUST derive from internal opaque IDs, not
  provider or user strings.
- **MR-SEC-007.** Subprocesses MUST receive structured argument arrays and
  constrained environments; shell interpolation of source values is forbidden.
- **MR-SEC-008.** Archive/import inspection MUST enforce format, size, path,
  count, and decompression limits before extraction or transformation.
- **MR-SEC-009.** Map Room MUST NOT require access to a host Docker socket.

## Deployment security profiles

### Local workstation

Administration is loopback-only by default. Public map delivery MAY be exposed
to a configured LAN interface with an explicit warning.

### Trusted LAN

Public tiles MAY be unauthenticated. Administration requires authentication.
The UI MUST identify that tile URLs can be used by anyone able to reach the
network.

### Authenticated service

Public and admin endpoints use separate scoped credentials. This profile cannot
claim ATAK support until its tile authentication is device-validated.

### Isolated runtime

No provider credentials or build tooling are present. Administrative mutation
is disabled or limited to local release switching.

## Data durability

- **MR-OPS-001.** Transactional metadata and immutable artifacts MUST have
  documented backup and restore procedures.
- **MR-OPS-002.** A backup MUST include schema version, configuration,
  selections, provider settings without secret leakage, active/previous release
  metadata, manifests, and chosen artifacts.
- **MR-OPS-003.** Restore MUST validate checksums and schema before publication.
- **MR-OPS-004.** Backup existence is not proof; production readiness requires
  a timed restore exercise to a clean installation.
- **MR-OPS-005.** Database migration MUST be transactional or recoverable and
  MUST have forward, backward/rollback, and interrupted-migration tests.

## Health and observability

- **MR-OPS-010.** Liveness MUST report process responsiveness only.
- **MR-OPS-011.** Readiness MUST verify active configuration, metadata store,
  artifact readability, public manifest, style, and representative tile paths.
- **MR-OPS-012.** Provider unavailability MUST degrade update health without
  making installed-map serving unready.
- **MR-OPS-013.** Metrics MUST include job counts/durations/failures, source and
  artifact age, bytes, storage/free space, published-map readiness, tile request
  rates/errors/latency, and component versions.
- **MR-OPS-014.** Logs MUST be structured, correlated, bounded, and redacted.
- **MR-OPS-015.** Alerts MUST be actionable and distinguish stale data, failed
  automation, serving failure, low disk, credential failure, and provider
  outage.

## Update and retention operations

- **MR-OPS-020.** Checks MUST default to daily but be configurable per provider
  constraints and installation policy.
- **MR-OPS-021.** Unchanged sources MUST not trigger transformation.
- **MR-OPS-022.** Failed checks/builds MUST use bounded backoff while preserving
  next manual action.
- **MR-OPS-023.** Current and previous successful artifacts MUST always be
  retained; additional retention is policy-controlled.
- **MR-OPS-024.** Cleanup MUST be deterministic, previewable, and unable to
  remove files referenced by active jobs/releases/backups.

## Supply chain

- **MR-SUP-001.** Runtime images, build images, dependencies, and Actions MUST
  be version pinned; release inputs SHOULD use immutable digests.
- **MR-SUP-002.** Automated dependency updates MUST run the full relevant gate
  and MUST NOT auto-merge renderer, schema, or major-version changes.
- **MR-SUP-003.** Releases MUST include an SBOM, checksums, provenance, license
  inventory, and vulnerability scan result.
- **MR-SUP-004.** Critical/high vulnerability handling MUST have documented
  severity, exploitability, exception, and release-blocking policy.
- **MR-SUP-005.** Build and release workflows MUST use least-privilege tokens
  and pin third-party actions by immutable revision.

## Performance and capacity budgets

Budgets are measured on named reference hardware and fixtures rather than
universal promises.

- **MR-PERF-001.** Catalog search and ordinary UI actions SHOULD respond within
  200 ms locally at the 95th percentile for the reference catalog size.
- **MR-PERF-002.** Job progress MUST update at least every two seconds while
  material work is advancing, without writing unbounded event volume.
- **MR-PERF-003.** Public tile latency, concurrency, memory, and raster-render
  throughput budgets MUST be established by benchmark issue before release.
- **MR-PERF-004.** Build time and space estimates MUST be based on recorded local
  evidence and include confidence; absence of evidence is reported as unknown.

## Licensing and attribution

- **MR-LIC-001.** Every source snapshot and artifact MUST have an explicit
  license-policy state: verified, maintainer-supplied, unknown, or rejected.
- **MR-LIC-002.** Publication MUST be blocked when policy requires attribution
  or redistribution permission that is absent.
- **MR-LIC-003.** Attribution MUST appear in browser display and machine-readable
  metadata and be included in client configuration where the format permits.
- **MR-LIC-004.** Transforming or caching a source MUST NOT be assumed permitted
  merely because the source is reachable by URL.

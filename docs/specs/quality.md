# Quality and verification specification

Status: Draft for issue #1

## Iron Law

No production behavior may be written or changed until a test for that behavior
has been run and has failed for the expected reason.

The required loop is:

1. **Issue ready:** the issue has requirement IDs, Acceptance Criteria,
   Definition of Done, risks, and test plan.
2. **Red:** add the smallest test that expresses one missing behavior; run it;
   confirm the failure is caused by the missing behavior rather than syntax,
   environment, or an unrelated defect.
3. **Green:** write the minimum production change that makes the test pass.
4. **Refactor:** improve structure while all tests remain green.
5. **Gate:** run unit, contract, integration, end-to-end, static, security, and
   coverage checks required by the issue.

- **MR-QUAL-001.** Every behavior-changing pull request MUST preserve red
  evidence: test name, command, expected failure, observed failure excerpt, and
  red commit SHA or CI artifact.
- **MR-QUAL-002.** A test that passes before production change is not red
  evidence and MUST be strengthened or corrected.
- **MR-QUAL-003.** Snapshot updates, golden-image replacements, and weakened
  assertions MUST be reviewed as behavior changes, not mechanical fixes.
- **MR-QUAL-004.** Refactoring may begin green, but MUST have characterization
  tests proving existing behavior and MUST not add new behavior silently.
- **MR-QUAL-005.** Emergency fixes still follow the Iron Law. Urgency changes
  review priority, not evidence requirements.

## 100% coverage policy

Every merge and release MUST report 100% line, statement, function, and branch
coverage for all repository-authored executable production code.

Included code:

- control plane, worker, providers, domain, storage, API, and CLI modules;
- browser application JavaScript/TypeScript;
- style and manifest generators;
- executable migration and release logic;
- repository-authored scripts with behavior.

Not measured as executable coverage:

- third-party vendored assets;
- generated artifacts whose generator and validator are fully covered;
- declarative HTML, CSS, JSON, YAML, Markdown, and container manifests.

Those exclusions still require schema, lint, accessibility, integration, or
artifact tests. Thin untested wrappers MUST NOT be used to hide executable
logic. Existing shell and Python prototype logic MUST be migrated into covered
modules or measured by an appropriate coverage tool before production release.

- **MR-QUAL-010.** Global and changed-code thresholds are exactly 100%; rounding
  below 100% MUST fail.
- **MR-QUAL-011.** Coverage ignore directives require a dedicated issue, a
  narrow justification, and an ADR when they change policy. Defensive branches
  SHOULD be tested, not ignored.
- **MR-QUAL-012.** Generated files and third-party files MUST be identified by
  path and provenance in coverage configuration.
- **MR-QUAL-013.** A test process crash, missing report, or empty instrumented
  set MUST fail the coverage gate.
- **MR-QUAL-014.** Coverage proves execution, not correctness; issue acceptance
  tests and negative cases remain mandatory.

## Test layers

### Unit tests

Pure domain behavior, state transitions, validation, estimators, coordinate
conversion, parsing, policy, and error classification. Tests MUST control time,
randomness, filesystem, and network dependencies.

### Contract tests

Shared suites for provider adapters, transformers, artifact stores, metadata
stores, tile services, public manifests, API schemas, event streams, and style
compatibility.

### Integration tests

Real SQLite/filesystem transactions, subprocess boundaries, HTTP routing,
download interruption/resume, atomic publication, restart recovery, and
container wiring against small deterministic fixtures.

### End-to-end tests

Maintainer and viewer workflows in supported browsers, isolated-network
operation, installation/upgrade/rollback, and real ATAK compatibility.

### Visual tests

Each style is rendered at a fixed matrix including dense urban, rural, coast,
water, parks, boundaries, bridges/tunnels, high latitude, and multilingual
labels. Automated pixel differences require human approval for intentional
cartographic change.

### Security and resilience tests

Hostile IDs and archives, path traversal, SSRF, redirects, decompression/resource
limits, authorization boundaries, secret redaction, crash/restart, disk full,
network loss, corrupt state, corrupt artifact, and dependency/container scans.

## Test design requirements

- **MR-QUAL-020.** Tests MUST assert observable behavior and stable contracts,
  not private implementation sequence unless sequence is itself the contract.
- **MR-QUAL-021.** Every parser/validator MUST include valid boundaries,
  malformed inputs, missing fields, extra fields, hostile values, and resource
  limits.
- **MR-QUAL-022.** Every state transition MUST test allowed, rejected,
  idempotent, recovery, and concurrent cases.
- **MR-QUAL-023.** External integrations MUST have both deterministic contract
  fixtures and a separately labeled live/device validation gate.
- **MR-QUAL-024.** Time and rate calculations MUST use injected monotonic time
  and deterministic samples.
- **MR-QUAL-025.** Tests MUST prove the last-known-good artifact survives every
  injected pipeline failure phase.

## Mutation and test-quality audits

Mutation testing SHOULD run on domain, validation, policy, coordinate, and state
machine modules in scheduled CI and before production release. Surviving
non-equivalent mutants require tests; equivalent mutants require documented
review. A mutation score target is set only after the initial harness establishes
a measured baseline and is tracked in a dedicated issue.

## Pull request evidence

Every implementation pull request MUST include:

- issue and requirement links;
- ADR links or `No ADR impact` with rationale;
- red evidence;
- green command output;
- coverage report showing four 100% metrics;
- integration/E2E evidence required by the issue;
- manual/device evidence where automation has no valid oracle;
- security, migration, documentation, and rollback notes.

## Prototype disposition

The existing prototype predates this repository-wide gate. Its observed browser
and isolated-runtime tests remain useful characterization evidence, but no
prototype module is production-ready merely because those tests pass. The first
implementation milestone MUST inventory, modularize, and bring every retained
authored executable line under the 100% gate before feature work continues.

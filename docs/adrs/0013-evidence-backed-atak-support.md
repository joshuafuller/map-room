# ADR-0013: Require real-client evidence for ATAK support

Status: Accepted

## Context

XML shape and successful raster HTTP requests do not prove ATAK import,
coordinate handling, bulk download, authentication, cache persistence, or
offline behavior. Available public source and documentation are not a substitute
for the target release/device oracle.

## Decision

Advertise ATAK compatibility only for named edition/version/device/authentication
profiles that pass the complete real-client matrix. Automated XML and endpoint
tests remain necessary but are labeled contract tests, not validation.

## Consequences

Initial releases may state that ATAK support is experimental or unvalidated.
Device access and manual evidence become release dependencies. Changes to the
integration boundary trigger revalidation.

## Alternatives

- Infer support from community XML examples: rejected.
- Claim support when browser raster preview passes: rejected.
- Remove ATAK until automation exists: rejected because hardware/client
  validation can be auditable manual evidence.

## Links

- Issue #1
- MR-TAK-001 through MR-TAK-023

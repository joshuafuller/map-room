# ADR-0002: Use Spec-Driven Development and the Iron Law

Status: Accepted

## Context

Passing tests do not prove that the right contract was implemented, while code
written before tests makes tests vulnerable to mirroring the implementation.
The project requires explicit scope, falsifiable behavior, and complete test
execution of authored code.

## Decision

Specifications precede implementation. Every work issue contains requirement
IDs, Acceptance Criteria, and Definition of Done. Every behavior change follows
observable red-green-refactor, preserves red evidence, and passes exactly 100%
line, statement, function, and branch coverage for authored executable code.

## Consequences

Prototype code is not grandfathered into production. It must be characterized,
modularized, and brought under the gate. Delivery may feel slower at the first
slice but failures become attributable and releases auditable.

## Alternatives

- Tests after implementation: rejected because it violates the Iron Law.
- Coverage below 100%: rejected by explicit project policy.
- Coverage alone: rejected because execution is not semantic correctness.

## Links

- Issue #1
- MR-QUAL-001 through MR-QUAL-025

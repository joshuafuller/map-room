# Contributing to Map Room

Map Room uses Spec-Driven Development and the Iron Law of TDD.

## Before writing code

1. Select a GitHub issue containing requirement IDs, Acceptance Criteria, and
   Definition of Done.
2. Confirm its dependencies are complete and its ADR decisions are resolved.
3. Create an issue-linked branch.
4. Update the specification first if observable behavior will change.

Issues without Acceptance Criteria and Definition of Done are not ready.

## Iron Law workflow

1. Add one test for missing behavior.
2. Run it and confirm it fails for the expected behavioral reason.
3. Preserve the command, failure excerpt, and red commit SHA in the pull
   request.
4. Add the minimum production change to pass.
5. Refactor only while green.
6. Run all issue-required gates and the global suite.

Production code written before the failing test must be reverted and the loop
restarted. A passing-before-change test is not red evidence.

## Coverage

All repository-authored executable production code must maintain exactly 100%
line, statement, function, and branch coverage globally and for changed code.
Generated, declarative, and third-party artifacts follow the explicit policy in
[`docs/specs/quality.md`](docs/specs/quality.md); exclusions are not a shortcut
for untested logic.

## ADRs

Create or supersede an ADR for consequential module, protocol, persistence,
security, deployment, provider, testing, or migration decisions. Accepted ADRs
are not rewritten to hide prior decisions.

## Pull requests

Every pull request must:

- close or reference its issue;
- cite requirement IDs and ADRs;
- include red and green evidence;
- report all four 100% coverage metrics;
- include integration, visual, security, migration, or device evidence required
  by the issue;
- describe documentation and rollback impact.

Direct feature commits to `main` are not permitted.

# Contributing to Map Room

Thank you for helping make self-hosted maps easier for ATAK and offline users.

## Start with observable behavior

Open an issue before changing code, documentation, configuration, dependencies,
or repository process. Every issue must state observable **Acceptance Criteria**
and a **Definition of Done** covering implementation, tests, documentation, and
evidence. Automated dependency pull requests are also work: create or assign a
tracking issue and complete their PR contract before merge.

Describe the user problem, source/license implications, and how another person
can verify the result. ATAK compatibility reports should include the ATAK
version, Android version, device model, import path, map region, and
connected/offline result.

Do not include private map data, credentials, deployment addresses, or licensed
data that cannot be redistributed.

## Development workflow

1. Open or confirm the GitHub issue containing Acceptance Criteria and Definition
   of Done.
2. Fork the repository and create a focused branch named for that issue.
3. Add a test that fails for the expected reason before changing behavior.
4. Make the smallest implementation that satisfies the acceptance criteria.
5. Run the relevant checks:

   ```sh
   npm ci
   npm run test:unit
   npm run test:coverage:atak
   npm run test:create-map
   shellcheck scripts/*.sh
   ```

6. For server or UI changes, also run the integration checks documented in the
   README. State clearly which tests used real ATAK hardware and which did not.

Pull requests must keep the repository template headings, link their tracking
issue, map the delivered work to its Acceptance Criteria and Definition of Done,
list exact verification evidence, and identify remaining validation boundaries.
The traceability check applies to human and automated pull requests.

Pull requests should separate verified evidence from planned or inferred
behavior. A green server test is not evidence that a map imported, displayed,
cached, or worked offline in ATAK.

## Licensing and attribution

By contributing, you agree that your contribution may be distributed under
the repository's license. Preserve third-party notices and map-source
attribution. New data providers or bundled assets must document their license,
redistribution rules, provenance, and update policy.

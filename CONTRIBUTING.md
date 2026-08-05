# Contributing to Map Room

Thank you for helping make self-hosted maps easier for ATAK and offline users.

## Start with observable behavior

Open an issue before a consequential change. Describe the user problem,
acceptance criteria, source/license implications, and how another person can
verify the result. ATAK compatibility reports should include the ATAK version,
Android version, device model, import path, map region, and connected/offline
result.

Do not include private map data, credentials, deployment addresses, or licensed
data that cannot be redistributed.

## Development workflow

1. Fork the repository and create a focused branch.
2. Add a test that fails for the expected reason before changing behavior.
3. Make the smallest implementation that satisfies the acceptance criteria.
4. Run the relevant checks:

   ```sh
   npm ci
   npm run test:unit
   npm run test:coverage:atak
   npm run test:create-map
   shellcheck scripts/*.sh
   ```

5. For server or UI changes, also run the integration checks documented in the
   README. State clearly which tests used real ATAK hardware and which did not.

Pull requests should separate verified evidence from planned or inferred
behavior. A green server test is not evidence that a map imported, displayed,
cached, or worked offline in ATAK.

## Licensing and attribution

By contributing, you agree that your contribution may be distributed under
the repository's license. Preserve third-party notices and map-source
attribution. New data providers or bundled assets must document their license,
redistribution rules, provenance, and update policy.

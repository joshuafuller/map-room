# Public release checklist

This checklist separates repository publication from product-readiness claims.
Making the GitHub repository public does not make the current prototype a
production or internet-facing service.

## Required before changing repository visibility

- [x] Add the project license. Map Room uses the MIT License.
- [x] Review the full Git history for credentials, private map data, private
  hostnames/IP addresses, customer names, and files that should never have been
  committed. The 2026-08-05 release audit scanned all 72 commits with Gitleaks
  and targeted history searches and found no leaks.
- [x] Confirm every bundled image, font, icon, and copied asset is covered by
  `THIRD_PARTY_NOTICES.md` or removed. The 2026-08-05 audit covers Lucide,
  Sharp, MapLibre GL JS, and the generated Open Sans glyphs.
- [ ] Enable GitHub private vulnerability reporting so `SECURITY.md` points to a
  working channel.
- [ ] Configure branch protection or repository rules for the CI workflow.
- [ ] Confirm issue templates, repository description, topics, and support
  expectations are appropriate for a public community.
- [ ] Run `npm ci`, unit tests, ATAK generation coverage, the create-map command
  tests, ShellCheck, and `git diff --check` from a clean checkout.

## Required before claiming ATAK compatibility

- [ ] Record the exact ATAK release, Android release, and device model.
- [ ] Import each advertised raster XML through ATAK's Import Manager.
- [ ] Import the vector source and style through the documented stock ATAK path.
- [ ] Verify representative roads, labels, POIs, buildings, and attribution.
- [ ] Cache a small bounded area, disconnect all networking, restart ATAK, and
  verify that cached coverage remains usable.
- [ ] Verify uncached coverage fails honestly and reconnecting recovers.
- [ ] Attach sanitized evidence to `TEST_RESULTS.md`; do not record private
  deployment addresses or map data.

## Required before a production release

- [ ] Add authentication and authorization for non-trusted networks.
- [ ] Implement and test atomic promotion, rollback, retention, backup, and
  restore for real map updates.
- [ ] Publish supported versions, upgrade policy, resource sizing, and a release
  artifact or installation method that does not depend on a development clone.
- [ ] Add observability and actionable failure reporting for acquisition,
  building, serving, and update jobs.
- [ ] Complete a redistribution review for every enabled data provider.

Until these production items are complete, describe Map Room as a public
early preview for trusted networks. It is reasonable to say that the basic
build-and-serve workflow is useful when the current repeatable checks pass;
do not call it production-ready or claim physical ATAK compatibility until the
separate device checklist is complete.

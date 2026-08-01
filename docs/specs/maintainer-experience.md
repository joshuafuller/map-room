# Maintainer-experience specification

Status: Draft for issue #1

## Experience goal

A first-time maintainer should be able to answer four questions at a glance:

1. Which maps do we have?
2. Are they usable and current?
3. What is Map Room doing now, and how long might it take?
4. What safe action should I take next?

The UI MUST use plain map language first and expose protocol/build details only
in progressive disclosure.

## First-run journey

- **MR-UX-001.** First run MUST explain that map acquisition can consume large
  download, storage, CPU, and time resources.
- **MR-UX-002.** The maintainer MUST choose a provider or local import before
  choosing source items.
- **MR-UX-003.** Catalog search MUST support display name, provider identifier,
  hierarchy, and ISO code when supplied.
- **MR-UX-004.** Hierarchical catalogs MUST be browsable without requiring the
  user to know provider paths.
- **MR-UX-005.** Multiple source items MUST be selectable in one review step.
- **MR-UX-006.** Parent/child overlap MUST produce a clear storage/duplication
  warning without assuming the datasets can be merged.
- **MR-UX-007.** Before confirmation, the UI MUST show known source bytes,
  estimated working/free-space requirement, update policy, output capabilities,
  and any license/attribution conditions.
- **MR-UX-008.** One primary confirmation MUST save desired selections and
  enqueue reconciliation; routine setup MUST NOT require separate hidden steps.

## Map library

Each map card MUST show name, provider, state, active source date, last
successful update, next check, artifact size, styles/capabilities, and a concise
health explanation.

- **MR-UX-010.** Ready, working, attention, failed, disabled, and unknown states
  MUST differ by text/icon as well as color.
- **MR-UX-011.** Actions MUST be contextual: view, sync now, pause automatic
  updates, rollback, diagnostics, disable, or remove.
- **MR-UX-012.** Destructive actions MUST distinguish reversible disable from
  publication removal and artifact purge.
- **MR-UX-013.** A map MUST remain visibly available while its replacement is
  being built.
- **MR-UX-014.** Provenance and license details MUST be reachable from every map
  without navigating to global settings.

## Progress and ETA

The visible phase vocabulary is: queued, checking source, downloading,
verifying input, building, validating map, publishing, cleaning up, complete,
canceling, canceled, and failed.

- **MR-UX-020.** Known-length transfers MUST show completed/total bytes,
  percent, smoothed rate, elapsed time, and ETA.
- **MR-UX-021.** Unknown-length work MUST use indeterminate progress and MUST NOT
  fabricate percent or ETA.
- **MR-UX-022.** Build ETA MUST be labeled estimating until enough comparable
  local evidence exists and MUST expose low/medium/high confidence.
- **MR-UX-023.** Phase transitions MUST reset phase-specific percent while
  preserving whole-job elapsed time.
- **MR-UX-024.** Refresh or browser closure MUST not lose the job; reconnect
  MUST restore current state and recent events.
- **MR-UX-025.** Failure views MUST show what remains working, whether retry is
  safe, and the next recommended action.
- **MR-UX-026.** Cancellation controls MUST explain whether partial data is
  retained and when cancellation becomes effective.

## Automatic operation

- **MR-UX-030.** Automatic updates MUST be configurable globally and per
  selection.
- **MR-UX-031.** Startup reconciliation MUST be on by default for enabled
  selections, but MUST honor offline mode and configured maintenance windows.
- **MR-UX-032.** The UI MUST show last check, last changed source, last success,
  last failure, next eligible check, and consecutive failures.
- **MR-UX-033.** A schedule controls when Map Room checks; it MUST NOT promise
  that a provider publishes at that interval.
- **MR-UX-034.** Pausing updates MUST not unpublish installed maps.
- **MR-UX-035.** When offline, Map Room MUST show that updates are deferred
  rather than reporting installed maps as broken.

## Viewer relationship

The maintainer UI and public viewer are distinct surfaces with a consistent
design system. A non-admin user MUST NOT see mutation controls. The maintainer
can open the public view for a selected map and style, including an explicit
ATAK raster preview mode.

## Accessibility and responsive behavior

- **MR-UX-040.** All workflows MUST be keyboard operable with visible focus.
- **MR-UX-041.** Status and progress MUST be announced accessibly without
  flooding assistive technology.
- **MR-UX-042.** Text and essential controls MUST meet WCAG 2.2 AA contrast and
  sizing expectations.
- **MR-UX-043.** The core workflow MUST function at 360 CSS pixels wide and at
  200% zoom.
- **MR-UX-044.** Reduced-motion preference MUST disable nonessential motion.

## Usability acceptance script

A participant unfamiliar with tile servers is given only the running URL and
asked to install Florida and one second region, enable daily checks, explain the
current progress, open the finished map, switch to Midnight, preview ATAK
raster, and locate rollback. Version 1 cannot release unless the workflow is
completed without command-line use or facilitator correction.

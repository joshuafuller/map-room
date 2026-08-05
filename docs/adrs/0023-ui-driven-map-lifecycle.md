# ADR-0023: Supervise tile serving behind the UI-driven map lifecycle

Status: accepted

Date: 2026-08-05

## Context

Map Room originally compiled regional configuration in a one-shot Compose
service. Creating a map required a shell script, and applying additions, edits,
or deletions required recreating services. Giving a web container access to the
Docker socket would make UI-driven restarts possible, but it would also give the
application root-equivalent control of the host.

Map builds are long-running and failure-prone. A failed download, Planetiler
build, manifest inspection, configuration compile, or tile-process start must
not replace a working publication. The library must also support zero installed
maps so a new user can create the first map from the website.

## Decision

Run an unprivileged Map Room manager and TileServer GL in one purpose-built
container. The manager owns port 8080, serves the local administration API, and
proxies tile requests to a supervised TileServer GL child on loopback port
8081. It recompiles runtime configuration and restarts only that child after a
successful library mutation. No Docker socket is mounted.

Map creation and rebuilds run as asynchronous, de-duplicated jobs. New archives
and manifests are built in staging. Activation uses same-filesystem atomic
renames, retains rollback files until the new runtime is healthy, and restores
the prior files and runtime if activation fails. Delete parks exactly one
confirmed archive and manifest until the reduced runtime is healthy.

The UI supports the curated regional catalog, bounded local PBF uploads, and
HTTPS PBF URLs from an explicit host allow-list. Stable IDs are path-safe and
immutable; display names are mutable. The existing CLI remains an automation
and recovery interface over the same data layout.

The manager runs as the configurable UID/GID that owns the bind-mounted data
and style directories. Generated JSON is written to a temporary sibling and
atomically renamed so stale file ownership cannot require in-place truncation.

## Consequences

- CRUD changes become visible without a page reload or manual Compose restart.
- A new installation can start with an empty map library.
- The container image is larger because it includes the pinned Planetiler Java
  runtime as well as TileServer GL.
- One container now supervises two processes, but their ownership boundary is
  explicit and the manager has no host-container control.
- Long builds survive browser navigation but not yet a manager-container
  restart; durable job recovery remains tracked by issue #13.
- Administration is unauthenticated in this early preview and must remain on a
  trusted local network. Internet-facing authentication and authorization are
  separate operations work.

## Alternatives

- Mount the Docker socket: rejected because UI compromise would expose host
  container control.
- Require a manual Compose restart: rejected because it keeps the primary map
  lifecycle outside the product UI.
- Run a separate manager container and signal TileServer GL: rejected because
  ordinary container isolation provides no safe portable cross-container
  process-control mechanism.
- Mutate live archives or configuration in place: rejected because partial
  failure could destroy the working publication.

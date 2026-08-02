# ADR-0019: Preserve the requesting browser origin in generated tile URLs

Status: Proposed

## Context

The prototype started TileServer GL with a fixed public URL of
`http://localhost:8088`. Style JSON and TileJSON therefore embedded localhost
even when the Map Room page was opened from another computer or phone. In a
mobile browser, localhost identifies the phone, so vector TileJSON and PBF
requests never reached Map Room. Raster preview URLs did not have this defect
because the browser constructed them from `window.location.origin`.

Simply trusting arbitrary forwarded hosts would correct reachability but would
also permit Host-header poisoning in generated URLs.

## Decision

Map Room will not set a deployment-specific TileServer GL `--public_url` by
default. Nginx preserves the complete incoming host, including a non-default
port, in `Host` and `X-Forwarded-Host`. TileServer GL may then construct URLs
for explicitly allowed hosts.

`TILESERVER_GL_ALLOWED_HOSTS` defaults to `localhost,127.0.0.1`. Requests using
another hostname or LAN address receive path-only generated URLs, which remain
on the browser's current origin without trusting the supplied host. Operators
with a stable canonical hostname can set `MAP_ROOM_ALLOWED_HOSTS` to a
comma-separated allowlist at startup.

No private deployment address is committed.

## Consequences

Desktop localhost, LAN clients, and mobile Chrome resolve vector sources
through the origin that served the website. Path-only URLs remain compatible
with same-origin browser access. A reverse proxy with a stable public domain
must forward the original host and should explicitly allow that hostname.

ATAK raster XML continues to derive its origin in the browser and is unchanged.

## Alternatives

- Commit the current LAN address: rejected because it is private, unstable,
  and deployment-specific.
- Trust every Host header: rejected because generated metadata could direct
  clients to an attacker-controlled host.
- Rewrite TileJSON in browser code: rejected because direct vector clients
  would remain broken and origin policy belongs at the serving boundary.

## Links

- Issue #24
- ADR-0015

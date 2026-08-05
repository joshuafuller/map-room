# Security policy

## Supported versions

Map Room is currently a pre-release prototype. Security fixes are applied to
the latest code on the default branch; there is not yet a supported release
series.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository rather
than opening a public issue. Include reproduction steps, affected versions or
commits, impact, and any suggested mitigation. Do not include live credentials
or private map data.

If private reporting is unavailable, contact the repository owner privately
and provide only enough information to establish a secure follow-up channel.

## Deployment boundary

The current prototype has no authentication or authorization. Run it only on a
trusted network and do not expose port 8088 directly to the public internet.
Treat generated map archives, source extracts, server addresses, and access
logs as potentially sensitive deployment data.

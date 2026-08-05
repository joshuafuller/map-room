# ADR-0015: Generate the first ATAK map source in the browser

Status: Proposed

## Context

ATAK needs an XML `customMapSource` containing an absolute tile URL that the
device can reach. A source generated while Map Room is opened through
`localhost` embeds loopback, which refers to the ATAK device itself after the
file is transferred. Committing a particular LAN address would be equally
incorrect because deployments move between networks.

The earlier `mapproxy-atak` project solves this with a deployment configuration
step, a served XML endpoint, and an optional TAK deep link and QR code. Map Room
does not yet have a runtime configuration service or a maintained deployment
state model.

## Decision

For the first physical-device validation, Map Room will generate the XML in the
browser from `window.location.origin`. The ATAK device opens Map Room using the
server's reachable LAN address and downloads the selected theme from that page.
The resulting file therefore contains the same origin that the device already
proved it can reach.

The source uses the hardened contract carried forward from `mapproxy-atak`:
standalone XML, `customMapSource`, `IfNoneMatch`, explicit error handling, an
empty `serverParts`, and an absolute PNG URL. Map Room retains its own theme
names, zoom range, and HiDPI `@2x` XYZ endpoint.

No LAN address or generated deployment XML is committed. A future modular
onboarding component may add an operator-configured public base URL, served XML
catalog, TAK import URI, and QR code without changing the XML builder.

QR onboarding is scoped to hosted map sets and small configuration artifacts.
It must not imply that scanning a code transfers a large offline map. Map Room
will treat roughly 10–20 MB as a conservative Data Package caution threshold,
not a universal ATAK limit, until larger-package behavior is validated on the
specific ATAK and Android versions being supported. Regional MBTiles archives
need an explicit, size-visible, resumable transfer path instead.

## Consequences

The first test needs no deployment-specific build step and cannot accidentally
publish a private address. The user must open the site from ATAK through a LAN
address; downloading through desktop `localhost` and transferring that file is
not a valid remote-device workflow. Automated tests establish XML structure and
HTTP behavior, while only a physical ATAK import can establish client
compatibility.

## Alternatives

- Commit XML containing the current LAN address: rejected because it leaks
  deployment state and breaks when the network changes.
- Serve one static XML file: deferred until Map Room has a runtime public-base-
  URL setting.
- Add deep-link and QR onboarding immediately: deferred until the direct XML
  import has been validated on a real ATAK version.
- Treat browser or XML-parser success as ATAK validation: rejected because it
  does not exercise ATAK's importer or imagery client.

## Links

- Issue #20
- `joshuafuller/mapproxy-atak`

# Map Room specifications

Status: Draft for issue #1

Map Room uses Spec-Driven Development. Specifications define observable
behavior and constraints before implementation begins. GitHub issues select a
bounded set of requirements from these documents; tests prove those
requirements; ADRs explain consequential design choices.

## Normative language

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
normative. A requirement is not implementable until it has:

- a stable requirement ID;
- observable acceptance criteria;
- an assigned GitHub issue;
- a stated verification method;
- resolved or explicitly blocking decisions.

## Specification set

| Document | Contract |
| --- | --- |
| [Product](product.md) | Users, outcomes, scope, and release boundaries |
| [System](system.md) | Components, domain model, state, and failure behavior |
| [Source providers](source-providers.md) | Provider-neutral ingestion and capability contracts |
| [Delivery interfaces](delivery-interfaces.md) | HTTP APIs, tile protocols, manifests, and events |
| [Maintainer experience](maintainer-experience.md) | No-expertise administration workflow |
| [Offline and TAK](offline-and-tak.md) | Disconnected operation and ATAK evidence gates |
| [Quality](quality.md) | Iron Law TDD, 100% coverage, and verification layers |
| [Security and operations](security-and-operations.md) | Trust profiles, recovery, observability, and supply chain |
| [Delivery plan](delivery-plan.md) | Slices, dependencies, release gates, and traceability |

## Evidence states

Every capability is labeled with one of these evidence states:

- **specified**: normative contract exists;
- **tested**: automated tests validate the contract against controlled inputs;
- **validated**: the contract has passed its real external/client oracle;
- **released**: all release gates are satisfied in a versioned artifact.

Tests against mocks do not make an external integration validated. In
particular, generated ATAK configuration remains specified or tested until it
is exercised on a supported ATAK build and device profile.

## Change control

1. Open or select a GitHub issue containing Acceptance Criteria and Definition
   of Done.
2. Change specifications before behavior when a contract changes.
3. Create or supersede an ADR when a consequential decision changes.
4. Map the issue to requirement IDs.
5. Follow red-green-refactor and preserve red evidence in the pull request.
6. Merge only when every required test and the global coverage gate passes.

Pull requests that change behavior without changing or citing a specification
are incomplete.

# Star-Trading Documentation Map

This file points to repository documentation and what each document is for.

## Core project docs

- [README.md](./README.md) — Player-facing project overview, gameplay quick start, controls, and current prototype status.
- [docs/README.md](./docs/README.md) — Documentation index and recommended reading order for contributors.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Runtime architecture, module ownership, and system invariants.
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) — Setup, validation commands, coding conventions, and PR expectations.
- [docs/SYSTEMS.md](./docs/SYSTEMS.md) — Canonical mapping of gameplay systems to code, state, config, and tests.
- [docs/SAVE_FORMAT.md](./docs/SAVE_FORMAT.md) — Save schema policy, migration rules, and compatibility guidance.

## Boundaries and implementation reference

- [docs/feature-boundary.md](./docs/feature-boundary.md) — Locked design boundaries for sparse worldgen, routing, logistics, contraband, intel, and bounties.
- [docs/magic-numbers.md](./docs/magic-numbers.md) — Audit of balance-relevant numeric literals and where they should live.
- [docs/systems/dialogue.md](./docs/systems/dialogue.md) — Dialogue system update flow, authority boundaries, and realization model.
- [docs/security/dependency-and-compat-debt.md](./docs/security/dependency-and-compat-debt.md) — Dependency debt and compatibility-cleanup tracking.

## Design docs (planning/proposals)

- [docs/design/character-mediated-challenges.md](./docs/design/character-mediated-challenges.md) — Design principle for character-executed challenge resolution.
- [docs/design/rpg-careers-and-property.md](./docs/design/rpg-careers-and-property.md) — Stationary/property-first career design and current implementation direction.
- [docs/design/blackline-command.md](./docs/design/blackline-command.md) — UI/visual design language bible for Blackline Command.
- [docs/design/blackline-command-implementation.md](./docs/design/blackline-command-implementation.md) — Phased implementation guide for applying Blackline Command safely.
- [docs/design/dynamic-dialogue-memory-simulation.md](./docs/design/dynamic-dialogue-memory-simulation.md) — Dialogue-memory architecture and staged integration plan.
- [docs/design/bounty-system.md](./docs/design/bounty-system.md) — Bounty contract system boundary, data model, and API scope.

## Economy planning and audit artifacts

- [Star-Trading_Economy_Design_Document_Codebase_Integrated.md](./Star-Trading_Economy_Design_Document_Codebase_Integrated.md) — Integrated economy design specification aligned to current codebase and rollout phases.
- [docs/economy_feature_gap_audit_2026-05-21.md](./docs/economy_feature_gap_audit_2026-05-21.md) — Phase 9 issue tracker with ordered resolution tasks and reassessed remaining gaps.
- [docs/unimplemented_or_underimplemented_features_2026-05-21.md](./docs/unimplemented_or_underimplemented_features_2026-05-21.md) — Snapshot list of remaining economy gaps and backlog ordering.
- [docs/economy_phase9_completion_matrix_2026-05-21.md](./docs/economy_phase9_completion_matrix_2026-05-21.md) — Item-by-item implementation verification matrix for economy Phase 9.

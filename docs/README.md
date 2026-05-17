# Documentation Index

This directory collects the design, contributor, and maintenance notes for
Star-Trading. Start here when changing systems, balance, saves, or UI behavior.

## Reading order

1. [README](../README.md) — player-facing overview, quick start, controls, and
   current prototype status.
2. [Architecture](./ARCHITECTURE.md) — module ownership, data flow, extension
   points, and invariants that should not be broken by refactors.
3. [Contributor Guide](./CONTRIBUTING.md) — setup, validation commands, coding
   conventions, save compatibility, and PR checklist.
4. [Systems Guide](./SYSTEMS.md) — gameplay systems map and the state/config
   files each system owns.
5. [Save Format](./SAVE_FORMAT.md) — save-version policy, normalization rules,
   persistence adapters, and migration expectations.
6. [Feature Boundary](./feature-boundary.md) — locked design boundaries for
   sparse worldgen, routing, gate logistics, intel, contraband, and bounties.
7. [Magic Number Audit](./magic-numbers.md) — where balance literals belong and
   which numeric literals are intentionally structural.

## Design proposals

The `docs/design/` directory contains feature proposals and implementation
notes. Treat these documents as planning references until the corresponding code
is merged and covered by tests.

- [Character-mediated Challenges](./design/character-mediated-challenges.md)
- [RPG Careers and Property](./design/rpg-careers-and-property.md)
- [Blackline Command](./design/blackline-command.md)
- [Blackline Command Implementation](./design/blackline-command-implementation.md)
- [Dynamic Dialogue, Memory, Task, and World Simulation](./design/dynamic-dialogue-memory-simulation.md)

## Documentation maintenance rules

- Update documentation in the same change that alters player-facing behavior,
  save shape, balance homes, public exports, or contributor workflow.
- Prefer links to canonical files over duplicated explanations when the code is
  the source of truth.
- Keep design proposals clearly separated from shipped behavior.
- When adding new docs, link them from this index and from the README if they are
  useful to first-time contributors.

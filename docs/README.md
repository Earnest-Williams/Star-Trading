# Documentation Index
_Last updated: 2026-05-24_

This directory contains contributor and implementation documentation for
Star-Trading.

## Core references

1. [Project README](../README.md) — player-facing overview, controls, and current
   prototype status.
2. [Architecture](./ARCHITECTURE.md) — runtime ownership, module boundaries, and
   invariants.
3. [Contributor Guide](./CONTRIBUTING.md) — setup, validation commands, coding
   conventions, and PR workflow.
4. [Systems Guide](./SYSTEMS.md) — gameplay system ownership across code, state,
   and config.
5. [Save Format](./SAVE_FORMAT.md) — save schema policy, migration constraints,
   and compatibility rules.
6. [Feature Boundary](./feature-boundary.md) — locked gameplay/technical
   boundaries.
7. [Magic Numbers](./magic-numbers.md) — audit for balance-sensitive literals.

## Active design docs

Design documents are planning artifacts until the corresponding implementation
is merged and tested.

- [Cluster Blueprint Worldgen MVP](../cluster_blueprint_worldgen_mvp_design.md)
- [Character-mediated Challenges](./design/character-mediated-challenges.md)
- [RPG Careers and Property](./design/rpg-careers-and-property.md)
- [Blackline Command](./design/blackline-command.md)
- [Blackline Command Implementation](./design/blackline-command-implementation.md)
- [Dynamic Dialogue, Memory, Task, and World Simulation](./design/dynamic-dialogue-memory-simulation.md)
- [Bounty System](./design/bounty-system.md)

## Historical snapshots

Time-boxed audits and completion snapshots are archived in `docs/archive/` to
keep the top-level docs set focused:

- [Economy Feature Gap Audit (2026-05-21)](./archive/economy_feature_gap_audit_2026-05-21.md)
- [Unimplemented or Underimplemented Features (2026-05-21)](./archive/unimplemented_or_underimplemented_features_2026-05-21.md)
- [Economy Phase 9 Completion Matrix (2026-05-21)](./archive/economy_phase9_completion_matrix_2026-05-21.md)

## Maintenance rules

- Update docs in the same change as behavior, save, or workflow changes.
- Link to canonical sources instead of duplicating implementation details.
- Keep proposals separate from shipped behavior.
- Add new docs to this index when they should be discoverable by contributors.

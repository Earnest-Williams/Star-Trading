# Save Format and Migration Guide

Star-Trading saves are versioned, normalized at load time, and expected to remain
compatible with older prototype payloads. The current save version is defined by
`SAVE_VERSION` in `js/constants.js`.

## Canonical files

- `js/core/persistence.js` — save/load orchestration, migrations,
  normalization, storage adapters, and legacy key handling.
- `js/constants.js` — `SAVE_VERSION`, save keys, global balance, factions, and
  commodity constants.
- `js/state.js` — fresh app-state shape used when starting a new game or
  hydrating missing save fields.
- `js/systems/captains/persistence.js` — captain-specific normalization.
- `js/systems/tradeRoutes/**` — route validation and normalization.
- `js/core/dataCargo/**` — data-cargo state normalization.
- `js/core/simulationTrace.js` — cross-system event trace normalization and
  causal-reference read models.

## Save lifecycle

1. A new game creates fresh state from `js/state.js` and world-generation helpers.
2. Saving serializes the current state with the latest `SAVE_VERSION`.
3. Loading reads known storage keys, parses the payload, and applies migration
   branches for older versions.
4. Normalizers fill missing optional fields, clamp unsafe values, and rebuild
   compatibility views.
5. UI and simulation systems operate on normalized state only.

## Migration policy

- Migrations must be idempotent. Running the same migration twice should not
  duplicate routes, gates, intel, or cargo.
- Preserve player data whenever a safe interpretation exists.
- Do not hide invalid sparse-world connectivity by fabricating paths or edges.
- Keep version gates near the migration code they describe.
- Normalize partial objects with explicit guards instead of relying on exceptions
  for normal control flow.
- Add tests for legacy payloads and missing-field cases.

## Sparse-world compatibility

Older code may still read `state.universe` as a sector-like view. New systems
should prefer `state.world.sites`, role anchors such as
`state.world.roles.homeSiteId`, and real jump-gate corridor endpoints. Empty
lattice cells must not be materialized during migration or normalization.

## Route compatibility

Legacy route payloads are interpreted as player-owned explicit trade routes when
possible. Route execution must continue to validate real corridor connectivity;
disconnected endpoints are invalid data, not a reason to create a fallback path.

## Simulation trace compatibility

`state.simulationTrace` and `state.nextSimulationTraceId` are persisted so debug
and causality context survives save/load. Missing trace fields are safe to fill
through normalization because old saves simply start with an empty trace ledger.
Persistent `worldEvents` may also carry a compact `payload` object when a
simulation event needs durable cause data, such as structured contraband bust
results; old events without payloads remain valid and are treated as having no
structured payload.

## Persistence adapters

`js/core/persistence.js` exposes adapter hooks for storage, logging,
notifications, and after-load behavior. Tests can replace these adapters to avoid
browser globals while still exercising load/save behavior.

## When to bump `SAVE_VERSION`

Bump the version when a persisted field is renamed, removed, split, merged, or
requires a non-trivial default that cannot be represented by simple
normalization. A version bump should include:

- migration logic;
- load tests for old payloads;
- docs update in this file when the shape or policy changes;
- a note in the pull request summary.

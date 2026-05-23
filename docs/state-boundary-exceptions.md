# State boundary exceptions (`js/state.js`)

`js/state.js` is intended to remain bootstrap-only (creation/reset mechanics).
Runtime logic should read via `js/core/state/selectors.js` and write via
`js/core/state/mutations.js`.

The following direct import exceptions are currently allowed during migration and
are intentionally pinned by `tests/stateImportGuard.test.js`.

## Core infrastructure exceptions
- `js/core/state/selectors.js`: root selector access to live state.
- `js/core/state/mutations.js`: root mutator access to live state.
- `js/core/persistence.js`: save/load normalization and state hydration/reset.
- `js/main.js`: app bootstrap lifecycle and reset wiring.

## Transitional legacy runtime exceptions
These modules predate the state boundary and still perform mixed reads/writes.
They remain allowlisted only to avoid broad risky churn in one patch, and should
be migrated incrementally into selectors/mutators by subsystem:
- `js/core/*.js` runtime modules (time, events, navigation, influence, etc.).
- `js/systems/**/*.js` gameplay subsystems (missions, economy, people, etc.).
- `js/ui/**/*.js` rendering and controller modules.
- `js/app/gameSessionController.js` session orchestration.

## Guardrails
- `tests/stateImportGuard.test.js` pins the exact importer set.
- `tests/stateModuleBoundary.test.js` enforces `js/state.js` remains bootstrap-only.
- ESLint `no-restricted-imports` blocks new direct imports in `js/ui/**` and
  `js/app/**` except explicit temporary overrides.

## Migration rule of thumb
When touching a legacy importer:
1. Replace repeated reads with selectors in `js/core/state/selectors.js`.
2. Replace writes with mutators in `js/core/state/mutations.js`.
3. Remove the direct `js/state.js` import.
4. Remove that file from the import-guard allowlist.

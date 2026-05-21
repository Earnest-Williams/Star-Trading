# Economy Phase 9 completion matrix (2026-05-21)

This matrix verifies each item listed in `docs/unimplemented_or_underimplemented_features_2026-05-21.md` against current implementation.

## Item-by-item verification

1. **Cross-panel breadcrumb continuity** — **Implemented**
   - `economyFocus` state added and used for breadcrumb rendering and linked navigation actions.
   - Evidence: `js/state.js`, `js/ui/ui.js`, `js/ui/renderMarket.js`.

2. **Short-horizon consequence hints (3–5 day)** — **Implemented**
   - `buildConsequenceHint` emits 3- or 5-day directional outlook with confidence label.
   - Evidence: `js/ui/renderMarket.js`.

3. **Deterministic explanation snapshots** — **Implemented (via deterministic UI assertions)**
   - Added stable assertions for context trail, outlook text, telemetry label, and deep-link action tokens.
   - Evidence: `tests/portTypeNormalisation.test.js`.

4. **UI-performance verification** — **Implemented (existing benchmark harness + full regression run)**
   - Existing benchmark harness available and runnable: `benchmarks/mapProjectionBenchmark.js`.
   - Full suite run confirms no runtime regression from these UI additions.

5. **Success-criteria matrix mapping design questions to UI/data** — **Implemented**
   - This document provides direct mapping + evidence references.

6. **Cross-panel breadcrumbs and state-preserving navigation** — **Implemented**
   - `setEconomyFocus` and `showEconomyLinkedScreen` wired in action registry and manifest.

7. **3–5 day consequence direction hints with confidence** — **Implemented**
   - Rendered in pressure rows from pressure telemetry.

8. **Deterministic explanation snapshot tests** — **Implemented**
   - Added regression test for explainability blocks and action links.

9. **Targeted UI tests for explanation blocks** — **Implemented**
   - Added focused market render test validating breadcrumb, outlook, supplier telemetry label, and contract deep-link action.

10. **Performance budget checks for tick + render cost** — **Partially implemented**
    - Existing test and benchmark coverage present; explicit numeric budget thresholds for this feature slice are not yet codified in CI.

11. **Integrated design-doc status update to “Phase 9 complete”** — **Not updated**
    - Deferred because item 10 is only partially implemented and lacks explicit budget gate thresholds.

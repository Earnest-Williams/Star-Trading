# Unimplemented or under-implemented economy features (as of 2026-05-21)

Source basis:
- `Star-Trading_Economy_Design_Document_Codebase_Integrated.md`
- `docs/archive/economy_feature_gap_audit_2026-05-21.md`

## Remaining gaps

1. **Cross-panel breadcrumb continuity** between market, logistics, and contracts for the same sector/commodity context.
2. **Short-horizon consequence hints** (3–5 day directional forecast with confidence tier) so players can see likely outcomes of intervention.
3. **Deterministic explanation snapshots** to prevent regressions in causal text and confidence labeling.
4. **UI-performance verification** for added explainability surfaces (tick and render budgets).

## Ordered backlog still not fully complete

### P1 (must ship before Phase 9 completion)
5. Success-criteria matrix mapping each design question to UI location and data source.
6. Cross-panel breadcrumbs and state-preserving navigation.
7. 3–5 day consequence direction hints with confidence tier.

### P2 (release hardening)
8. Deterministic explanation snapshot tests.
9. Targeted UI tests for new explanation blocks.
10. Performance budget checks for tick + render cost.
11. Integrated design-doc status update to “Phase 9 complete” with a completion date after all gates pass.

## Why these are considered unimplemented/under-implemented

The design doc states that Phases 1–8 are materially present and that remaining work is concentrated in Phase 9 explainability depth and completion governance. The gap-audit document then enumerates unresolved items and acceptance gates tied to those features.


## Verification update (2026-05-21)

See `docs/archive/economy_phase9_completion_matrix_2026-05-21.md` for per-item implementation status and evidence.

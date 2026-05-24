# Economy Phase 9 issue tracker and reassessed gap list

Source reviewed: `Star-Trading_Economy_Design_Document_Codebase_Integrated.md` (last updated
2026-05-21).

## Scope

This document resolves prior review feedback by:

1. Addressing each previously listed Phase 9 issue in order.
2. Recording concrete implementation tasks per issue.
3. Reassessing remaining gaps after issue-by-issue triage.

## Issue-by-issue resolution plan (in turn)

### Issue 1 — Market panel full-cause explainability is incomplete

**Problem statement:** the market surface still does not consistently present a complete causal
bundle (stock vs target, flow rates, severity, primary cause, and confidence).

**Resolution tasks:**

1. Add a single per-commodity “cause card” renderer that always includes:
   - current stock,
   - target stock,
   - daily consumption,
   - daily production,
   - shortage or surplus severity,
   - primary cause text,
   - signal confidence tier.
2. Add deterministic price-cause text derived from pressure and pricing multipliers.
3. Add tests that assert field presence and stable ordering of displayed cause fields.

**Done criteria:** every commodity row exposes the full causal bundle with deterministic labels.

### Issue 2 — Supplier discovery is under-implemented

**Problem statement:** likely suppliers are not consistently surfaced with quality cues needed for
route decisions.

**Resolution tasks:**

1. Add a “likely suppliers” section per selected commodity.
2. Include supplier distance, route risk, available exportable stock, and telemetry freshness.
3. Add stale-data warnings and confidence downgrade labels when freshness is old or unknown.

**Done criteria:** users can compare at least top supplier candidates with reliability context.

### Issue 3 — Contract causality is not explicit enough

**Problem statement:** contracts are visible, but their generation causes are not fully inspectable
in the UI.

**Resolution tasks:**

1. Show contract origin signal fields:
   - target-stock gap,
   - unmet-demand trend,
   - shortage severity,
   - generated reason text.
2. Add clickable links from contract entries to commodity and sector detail context.
3. Add tests that validate contract-cause payload rendering and deep-link behavior.

**Done criteria:** users can answer “why did this contract appear?” from contract UI alone.

### Issue 4 — Route profitability explanation trail is incomplete

**Problem statement:** route estimates still under-explain how profit was computed.

**Resolution tasks:**

1. Decompose displayed estimate into:
   - expected buy price,
   - expected sell price,
   - volume cap,
   - corridor risk modifier,
   - confidence factor.
2. Add explicit telemetry quality impact text (live/stale/unknown).
3. Add deterministic tests for route estimate explanation strings.

**Done criteria:** users can audit profit estimate components and confidence degradation.

### Issue 5 — Ambient-trade insufficiency is not legible enough

**Problem statement:** players still cannot always see why ambient flow did not close shortages.

**Resolution tasks:**

1. Display ambient cap, exported share, imported amount, and residual shortage.
2. Add text that explains remaining opportunity for explicit logistics.
3. Add scenario tests where ambient helps but does not fully clear shortage.

**Done criteria:** players can directly see why ambient flow only partially relieved pressure.

### Issue 6 — Phase 9 completion gates were missing

**Problem statement:** prior artifact listed work but did not enforce a completion gate tied to
design success criteria.

**Resolution tasks:**

1. Add a success-criteria matrix mapping each design question to UI location and data source.
2. Add gate checks:
   - feature-complete gate,
   - quality gate (tests + determinism),
   - performance gate,
   - documentation status gate.
3. Update integrated design doc status only after all gates pass.

**Done criteria:** Phase 9 can be declared complete by objective pass/fail gates.

## Reassessed remaining gaps (after ordered issue triage)

After addressing the six issues in turn, the remaining gaps to close the design goals are:

1. **Cross-panel breadcrumb continuity** between market, logistics, and contracts for the same
   sector/commodity context.
2. **Short-horizon consequence hints** (3–5 day directional forecast with confidence tier) to make
   intervention outcomes legible.
3. **Deterministic explanation snapshots** to prevent regressions in causal text and confidence
   labeling.
4. **UI-performance verification** to ensure explainability additions do not violate daily-tick or
   render budgets.

## Final execution backlog (ordered)

### P0 (must ship first)

1. Market full-cause cards.
2. Supplier discovery with freshness and risk.
3. Contract causality payload + links.
4. Route profitability decomposition + confidence effect.
5. Ambient insufficiency explanation block.

### P1 (must ship before Phase 9 completion)

6. Success-criteria matrix (question-to-UI mapping).
7. Cross-panel breadcrumbs and state-preserving navigation.
8. 3–5 day consequence direction hints with confidence tier.

### P2 (release hardening)

9. Deterministic explanation snapshot tests.
10. Targeted UI tests for new explanation blocks.
11. Performance budget checks for tick + render cost.
12. Integrated design doc status update to “Phase 9 complete” with completion date.

## Acceptance gates

- **Gate A — Feature complete:** P0 and P1 tasks all shipped.
- **Gate B — Quality complete:** P2 tests pass with deterministic outputs.
- **Gate C — Release complete:** performance budget passes and doc status is updated.

## Current status note

Phases 1–8 are already documented as materially present. This tracker focuses on closing the
remaining Phase 9 explainability, causality, and completion-governance work.

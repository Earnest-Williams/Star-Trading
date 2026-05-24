# Cluster Blueprint Worldgen MVP

_Last updated: 2026-05-24_

## Purpose

This document defines a small, testable path for adding cluster-blueprint world generation to Star-Trading.

The goal is to prove that authored, pre-generated cluster fragments can replace part of raw sparse-site placement while preserving the existing Star-Trading simulation pipeline. The MVP should improve load-time predictability and increase the chance of a satisfying starting galaxy without requiring a full Rust, Tauri, or Rhai migration yet.

The guiding idea is:

> Authored clusters create reliable local situations. Existing Star-Trading systems turn those local situations into a coherent galaxy.

## Problem Statement

The current generator creates sparse occupied sites procedurally, then relies on downstream passes to assign anchors, build corridors, seed ports and resources, repair economic connectivity, build economy profiles, calibrate prices, compute pressure, assign polities, and seed companies and people.

This works, but it can produce technically valid galaxies whose early play is uneven. A generated galaxy can have weak local trade shape, awkward starter neighborhoods, poor early discovery, thin local faction identity, or economic opportunities that only become meaningful after repair.

The proposed system introduces pre-authored cluster blueprints that define local groups of sites, faction bias, economic hints, resource hints, and connector roles. These clusters are assembled into a sparse 3D galaxy and then normalized through the existing simulation pipeline.

## MVP Hypothesis

If we replace the initial sparse-site placement with a small cluster-blueprint assembly layer, then Star-Trading can produce better starting galaxies while still preserving existing route physics, sparse-world constraints, economy normalization, faction influence, save behavior, and UI assumptions.

The MVP is successful if a cluster-generated galaxy can pass the same downstream generation phases as a normal galaxy and produce a playable starter region with useful economic choices.

## Design Goals

1. Prove that authored clusters can become normal sparse occupied sites.
2. Keep existing corridor generation and gate physics authoritative.
3. Keep existing economy profile, price calibration, and pressure systems authoritative.
4. Use faction and economy hints to shape local drama without creating a parallel faction or economy model.
5. Avoid save-format churn for the first version.
6. Keep the feature easy to disable and compare against the current generator.
7. Prepare the data boundary for a later Rust/Rhai implementation.

## Non-Goals

The MVP will not implement a full Rust engine migration.

The MVP will not introduce Tauri.

The MVP will not execute Rhai scripts yet.

The MVP will not replace the economy simulation.

The MVP will not replace corridor physics or pathfinding.

The MVP will not author complete galaxies.

The MVP will not create a second faction ownership model.

The MVP will not create a separate save model for cluster-generated worlds.

The MVP will not author companies, people, missions, contracts, bounties, or dialogue directly inside clusters.

## Existing Pipeline to Preserve

The MVP should preserve the current high-level generation order:

```text
generateUniverse()
  reset world state
  create sparse sites
  assign anchors and starting visibility
  rebase starting assets to the home site
  build jump-gate corridors
  seed ports, planets, asteroids, and station reserves
  ensure economic-activity connectivity
  rebuild economic profiles
  calibrate initial universe prices
  recompute economy pressure
  assign sector polities
  seed companies and people
  generate local locations
```

The MVP only changes the sparse-site creation step. Everything after that should continue to operate on normal `state.universe` data.

Implementation integration must stay narrow: one sparse-site branch (`createSparseSites` vs `createSparseSitesFromClusterBlueprints`) plus exactly one post-seeding hook (`applyClusterWorldgenHints`) before economic connectivity/profile rebuild.

## Hard Constraints

The feature must preserve these Star-Trading design constraints:

1. Sites remain sparse occupied coordinates, not dense grid cells.
2. Route systems use real jump-gate corridor connectivity.
3. No route may exist unless produced by existing corridor/repair logic with effective span cost computed from coordinates and metric shear.
4. Corridors remain evaluated from coordinates through distance and metric shear.
5. High-shear regions should still suppress ordinary settlement and easy routing.
6. Role anchors should remain the preferred way to identify home, starting port, shipyard, and capital sites.
7. Ambient trade must remain capped and must not replace explicit route gameplay.
8. Gate logistics must remain packetized pulse inventory, not continuous utility transmission.
9. Save normalization must not hide invalid map topology.
10. New code should be testable without DOM-only rules.

## Core Concept

A cluster blueprint is an authored local scenario fragment. It describes a small group of sites and the intended local situation, but it does not directly become final authoritative simulation state.

A blueprint can describe:

- relative site coordinates;
- site type and richness hints;
- region hints;
- faction influence bias;
- public authority and hidden-control hints;
- port, planet, asteroid, and way-station hints;
- local economy needs and offers;
- stock imbalance hints;
- connector sites for galaxy stitching;
- validation expectations.

A blueprint should not directly author final prices, final route profitability, final companies, final people, or final global economy state.

## MVP Cluster Types

The first version must always include at least the three required authored cluster families, then continue filling the site budget to `config.occupiedSites` using seam/procedural support placement.

### 1. Starter Hub Cluster

Purpose: Guarantee an acceptable opening neighborhood.

Expected traits:

- one strong hub candidate;
- two or three nearby economic sites;
- at least one mining or extraction opportunity;
- at least one consumer, agricultural, industrial, or refinery complement;
- low to moderate risk;
- readable faction identity;
- strong compatibility with the existing anchor-selection pass.

Suggested political identity:

- public SDA or FU presence;
- optional HC industrial nearby;
- no hard VC dominance near the default start.

### 2. Frontier Extraction Cluster

Purpose: Provide durable resource logistics and early route planning value.

Expected traits:

- asteroid or mining emphasis;
- ore, heavy metals, rare earths, water ice, or related extraction hints;
- demand for repair parts, machinery, equipment, or pulse canisters;
- HC/FU faction pressure;
- moderate route value;
- one connector suitable for a relay or trade route seam.

### 3. Badlands Risk Cluster

Purpose: Provide high-value, higher-risk asymmetry.

Expected traits:

- VC/HC faction pressure;
- elevated pirate threat;
- possible hidden-control setup;
- stronger reward opportunity;
- weaker route access or higher travel risk;
- one or more connector sites that may create long or scheduled-relay routes.

## MVP Data Format

The MVP should use plain JavaScript objects while preserving a shape that can later be emitted by Rhai and consumed by Rust.

Example:

```js
export const CLUSTER_BLUEPRINTS = Object.freeze([
    {
        id: "starter-hub-a",
        tags: ["starter", "core", "safe"],
        weight: 1,
        placement: {
            preferredRegion: "Core",
            preferredRadius: 14
        },
        sites: [
            {
                localId: "hub",
                offset: { x: 0, y: 0, z: 0 },
                siteType: "stellar_system",
                richness: "hub",
                region: "Core",
                nameHint: "StarDock Candidate",
                roleHint: "home_candidate",
                factionBias: { sda: 14, fu: 6 },
                portHint: "stardock"
            },
            {
                localId: "mine",
                offset: { x: 4, y: -1, z: 0 },
                siteType: "brown_dwarf_system",
                richness: "developing",
                region: "Frontier",
                factionBias: { hc: 12, fu: 4 },
                asteroidHint: true,
                portHint: "mining",
                stockBias: {
                    ore: "surplus",
                    repair_parts: "shortage"
                }
            },
            {
                localId: "farm",
                offset: { x: -3, y: 3, z: 1 },
                siteType: "stellar_system",
                richness: "settled",
                region: "Frontier",
                factionBias: { fu: 12 },
                portHint: "agricultural",
                stockBias: {
                    org: "surplus",
                    machinery: "shortage"
                }
            }
        ],
        connectors: [
            { localId: "mine", kind: "trade_seam" },
            { localId: "farm", kind: "starter_expansion" }
        ],
        validation: {
            minEconomicSites: 3,
            starterCompatible: true
        }
    }
]);
```

## Rhai-Portable JavaScript Style

The MVP JavaScript implementation is a temporary compatibility layer for a future Rust/Rhai worldgen path. `js/config/worldgenClusters.js` and nearby assembly code should be authored as Rhai-shaped data and deterministic transforms so the boundary can move to Rhai + Rust with minimal semantic drift.

For this feature, idiomatic JavaScript is subordinate to Rhai/Rust portability: prefer explicit, boring, deterministic data transformation over compact JavaScript abstraction.

The examples are not meant to freeze final commodity names, faction ids, or site types. They define the coding style and data boundary: authored cluster data should be boring, explicit, deterministic, and directly translatable to Rhai-authored maps plus Rust validation structs.

### Required Style Rules

- `worldgenClusters.js` should look like a Rhai-shaped authoring layer.
- Blueprint data must be declarative, deterministic, and easy to map to Rhai maps/arrays.
- Each blueprint field should have an obvious future Rust type.
- Keep blueprint records as plain data, with no executable behavior.
- Keep assembly and validation logic outside blueprint records.
- Keep helper functions small, explicit, and deterministic so they can later become Rust validation code or Rhai helper functions.
- Existing Star-Trading systems remain authoritative; cluster code only translates authored hints into normal sparse-site inputs.
- Do not use JS-specific object magic: classes, prototypes, getters, dynamic property names, closures, fluent builders, symbol keys, async behavior, DOM dependencies, or hidden module-level mutation.

### Good Rhai-Portable Blueprint Style

```js
export const CLUSTER_BLUEPRINTS = Object.freeze([
    {
        id: "starter-hub-a",
        family: "starter_hub",
        tags: ["starter", "core", "safe"],
        weight: 1,
        placement: {
            preferredRegion: "Core",
            preferredRadius: 14
        },
        sites: [
            {
                localId: "hub",
                offset: { x: 0, y: 0, z: 0 },
                siteType: "stellar_system",
                richness: "hub",
                region: "Core",
                roleHint: "home_candidate",
                factionBias: { sda: 14, fu: 6 },
                portHint: "stardock",
                stockBias: {}
            },
            {
                localId: "mine",
                offset: { x: 4, y: -1, z: 0 },
                siteType: "brown_dwarf_system",
                richness: "developing",
                region: "Frontier",
                factionBias: { hc: 12, fu: 4 },
                asteroidHint: true,
                portHint: "mining",
                stockBias: {
                    ore: "surplus",
                    repair_parts: "shortage"
                }
            },
            {
                localId: "farm",
                offset: { x: -3, y: 3, z: 1 },
                siteType: "stellar_system",
                richness: "settled",
                region: "Frontier",
                factionBias: { fu: 12 },
                planetHint: "agricultural",
                portHint: "agricultural",
                stockBias: {
                    org: "surplus",
                    machinery: "shortage"
                }
            }
        ],
        connectors: [
            { localId: "mine", kind: "trade_seam" },
            { localId: "farm", kind: "starter_expansion" }
        ],
        validation: {
            minEconomicSites: 3,
            requiresExtractionSite: true,
            starterCompatible: true
        }
    }
]);
```

Why this is preferred:

- It is plain declarative data.
- It maps naturally to Rhai maps and arrays.
- The blueprint has no executable behavior.
- Field names are explicit.
- Validation expectations are data, not hidden code.
- Assembly code can consume the same shape later from Rhai or Rust.

### Bad JS-Specific Blueprint Style to Avoid

```js
class StarterHubBlueprint {
    constructor(seed) {
        this.seed = seed;
    }

    get id() {
        return `starter-${this.seed}`;
    }

    sites() {
        return makeSitesWithClosures(this.seed).map((site) => ({
            ...site,
            [`bias_${site.primaryFaction}`]: site.bias
        }));
    }
}

export const CLUSTER_BLUEPRINTS = [
    new StarterHubBlueprint(Date.now())
];
```

Why this is not acceptable:

- It uses classes and prototype behavior.
- It hides data behind methods and getters.
- It depends on runtime behavior instead of explicit authored data.
- It uses dynamic property names.
- It is not naturally portable to Rhai-authored cluster scripts.
- It weakens determinism.

### Good Schema-Comment Style for `worldgenClusters.js`

```js
// Rhai-portable shape:
//
// ClusterBlueprint = {
//     id: string,
//     family: string,
//     tags: string[],
//     weight: number,
//     placement: ClusterPlacement,
//     sites: ClusterSiteBlueprint[],
//     connectors: ClusterConnector[],
//     validation: ClusterValidation
// }
//
// ClusterSiteBlueprint = {
//     localId: string,
//     offset: { x: number, y: number, z: number },
//     siteType: string,
//     richness: string,
//     region: string,
//     roleHint?: string,
//     factionBias?: { [factionId: string]: number },
//     portHint?: string,
//     planetHint?: string,
//     asteroidHint?: boolean,
//     stationHint?: string,
//     stockBias?: { [commodityId: string]: "surplus" | "normal" | "shortage" | "empty" }
// }
```

### Good Validation Helper Style

```js
export function validateClusterBlueprint(blueprint) {
    const errors = [];

    if (!blueprint || typeof blueprint !== "object") {
        errors.push("blueprint must be an object");
        return errors;
    }

    if (typeof blueprint.id !== "string" || blueprint.id.length === 0) {
        errors.push("blueprint.id must be a non-empty string");
    }

    if (!Array.isArray(blueprint.sites) || blueprint.sites.length === 0) {
        errors.push(`${blueprint.id}: sites must be a non-empty array`);
    }

    for (const site of blueprint.sites || []) {
        if (typeof site.localId !== "string" || site.localId.length === 0) {
            errors.push(`${blueprint.id}: site.localId must be a non-empty string`);
        }

        if (!site.offset || !Number.isFinite(site.offset.x) || !Number.isFinite(site.offset.y) || !Number.isFinite(site.offset.z)) {
            errors.push(`${blueprint.id}/${site.localId}: offset must have finite x, y, z numbers`);
        }
    }

    return errors;
}
```

Validation helpers should be boring, explicit, and easy to port to Rust. Avoid generic reflection-heavy validators unless there is an existing project convention for them.

### Good Deterministic Selection Style

```js
export function selectClusterByFamily(blueprints, family, rng) {
    const candidates = blueprints.filter((blueprint) => blueprint.family === family);
    const totalWeight = candidates.reduce((sum, blueprint) => sum + blueprint.weight, 0);
    let roll = rng() * totalWeight;

    for (const blueprint of candidates) {
        roll -= blueprint.weight;

        if (roll <= 0) {
            return blueprint;
        }
    }

    return candidates[candidates.length - 1] || null;
}
```

Why this is preferred:

- It is deterministic for a fixed `rng`.
- It does not use global randomness.
- It can be translated to Rust directly.
- It keeps selection logic outside blueprint data.

### Bad Selection Style to Avoid

```js
const selected = CLUSTER_BLUEPRINTS
    .filter((blueprint) => blueprint.family === getDynamicFamilyName())
    .sort(() => Math.random() - 0.5)
    .at(0);
```

Why this is not acceptable:

- It uses global randomness.
- It is not deterministic.
- Sort-random selection is unstable.
- The dynamic family lookup hides generation behavior.
- It is a poor match for future Rust/Rhai generation.

### What Not To Do: JavaScript That Is Bad Rhai

Do not write `worldgenClusters.js` as clever JavaScript. Write it as explicit data and simple deterministic transforms that could plausibly have been written in Rhai first.

Explicitly avoid builder chains, computed object shapes, executable blueprint records, callback-heavy assembly pipelines, implicit fallback topology repair, global mutable module state, schema-by-spread behavior, and environment-dependent randomness (`Math.random`, `Date.now`, DOM APIs).

Final rule: if a JavaScript pattern makes the blueprint shorter but the data shape less obvious, do not use it. For this MVP, boring explicit data is better than clever JavaScript.

## Proposed File Layout

Add:

```text
js/config/worldgenClusters.js
js/core/universe/clusterAssembly.js
tests/worldgenClusters.test.js
```

Modify:

```text
js/core/universe/implementation.js
```

Optional later additions:

```text
js/core/universe/worldgenQuality.js
docs/design/cluster-blueprint-worldgen.md
```

## Generator Integration

The MVP should add a feature flag in worldgen settings:

```js
const useClusterAssembly = state.worldgenSettings?.clusterAssembly === true;
```

Generation should branch only at sparse-site creation:

```js
const sparse = useClusterAssembly
    ? createSparseSitesFromClusterBlueprints(config, rng)
    : createSparseSites(config);
```

The returned object must preserve the existing sparse-site creation contract while adding transient cluster metadata:

```js
{
    sites,
    siteIdByCoord,
    archetypeName,
    clusterHintsBySiteId
}
```

The first three fields remain contract-compatible with `createSparseSites(config)`. `clusterHintsBySiteId` is transient generation metadata only and must not be persisted as authoritative save state unless a future save migration explicitly adopts it.

## Cluster Assembly Algorithm

The MVP assembler should be intentionally simple.

1. Select one starter cluster.
2. Select one frontier extraction cluster.
3. Select one badlands risk cluster.
4. Continue selecting additional authored clusters when available and budget allows.
5. Fill any remaining budget with seam/procedural support sites until `Object.keys(sites).length === config.occupiedSites`.
6. Place clusters at broad archetype-compatible offsets.
7. Apply optional rotation, mirroring, and low-amplitude coordinate jitter.
8. Rebase local cluster site ids into numeric global site ids.
9. Reject or deterministically adjust duplicate coordinates.
10. Create normal site records with `id`, `siteId`, `coord`, `coordKey`, `name`, `region`, `siteType`, `richness`, `charted`, `reachable`, `surveyed`, `jumpGates`, `pirateThreat`, `asteroids`, `influence`, `front`, and `metricShear`.
11. Apply faction influence bias after base influence is created.
12. Store cluster hints in a transient map for later post-seeding hint application.
13. Return normal sparse site data plus transient hints.

## Faction Handling

Clusters should have faction profiles, not hard universal ownership.

A cluster may specify:

- dominant faction hint;
- secondary faction hints;
- public authority hint;
- hidden control hint;
- influence bias per site;
- guild presence hints.

The MVP should only implement influence bias and optional hidden-front hints.

Example:

```js
factionBias: { hc: 12, fu: 4 }
```

The assembler should apply this through the existing influence model rather than adding a new ownership system.

## Economy Handling

Clusters should author local economic tension without replacing the existing economy.

For the MVP, allowed economy hints are:

```text
portHint
planetHint
asteroidHint
stationHint
stockBias
needHints
offerHints
```

The MVP should use `portHint`, `asteroidHint`, and `stockBias` first. `needHints` and `offerHints` can remain data-only until a later quality scorer uses them.

A single cluster-specific hint pass should run after `seedPortsPlanetsAndResources()` and before `ensureEconomicActivityConnectivity()` / `rebuildEconomicProfiles()`: `applyClusterWorldgenHints(sparse.clusterHintsBySiteId)`.

Suggested stock-bias semantics:

```text
"surplus"  -> raise stock toward 75 percent of max stock
"normal"   -> leave seeded value unchanged
"shortage" -> lower stock toward 15 percent of max stock
"empty"    -> lower stock toward 3 percent of max stock
```

The economy profile builder, price calibration, pressure recomputation, and spatial price systems remain authoritative.

## Role Anchors and Starting Position

The first version should avoid forcing role anchors directly unless the existing anchor selection fails to pick the intended starter cluster.

Preferred approach:

1. Make the starter hub site naturally score well as an anchor candidate.
2. Use `richness: "hub"`, `siteType: "stellar_system"`, and moderate metric shear.
3. Keep it near the ideal starting plane distance.
4. Let the existing anchor assignment pick it.

If this is unreliable, add a minimal `roleHint: "home_candidate"` and adjust anchor scoring to prefer that hint without hard-coding site ids.

## Connectivity and Corridors

Clusters may provide local edge hints, but corridor generation remains authoritative.

The MVP should not directly pre-create jump gates inside the blueprint. It should let `buildCorridors(config)` evaluate coordinates and effective span cost.

A later version may use local edge hints to bias placement or candidate ordering, but all final corridors should still pass effective-span evaluation.

## Quality Gate

The MVP should include a small quality check, but not a full scoring framework.

Initial required checks:

1. All site coordinate keys are unique.
2. Site records have valid coordinates.
3. At least one starter-compatible hub candidate exists.
4. At least three economic sites exist after resource seeding.
5. At least one extraction site exists.
6. At least one non-extraction trade complement exists.
7. At least one connector candidate exists outside the starter cluster.
8. Economic profiles build for generated economic sites.
9. Economy pressure exists after recomputation.
10. The generated galaxy has no empty lattice materialization.

A later quality scorer can add richer metrics:

```text
starter reachable economic site count
local commodity diversity
producer and consumer coverage
pulse logistics relevance
isolated demand share
average network friction
faction diversity
high-risk route availability
charted subnetwork usefulness
```

## Test Plan

Add focused tests in `tests/worldgenClusters.test.js`.

Suggested tests:

1. `createSparseSitesFromClusterBlueprints` returns normal sparse-site data.
2. Cluster assembly produces unique coordinate keys.
3. Cluster assembly preserves sparse occupancy.
4. Cluster assembly applies site type and richness hints.
5. Cluster assembly applies faction bias through influence values.
6. Cluster assembly records enough sites for a starter cluster.
7. Cluster-generated `generateUniverse()` runs without throwing.
8. Cluster-generated universe builds corridors.
9. Cluster-generated universe builds economy profiles.
10. Cluster-generated universe computes economy pressure.
11. Starter area contains multiple nearby economic sites.
12. Legacy procedural generation still works when `clusterAssembly` is disabled.

Primary validation command:

```bash
npm run test:worldgen
```

Secondary validation commands:

```bash
npm test
npm run lint
npm run build
```

If the full test suite has unrelated hang behavior, use targeted tests first and document the limitation in the PR notes.

## Step-by-Step Path to Completion

### Phase 0: Design and Boundaries

Deliverables:

- This design document.
- Agreement on MVP scope.
- Agreement that Rhai/Rust/Tauri are future migration targets, not MVP dependencies.

Exit criteria:

- The feature has a small enough first implementation.
- The branch point is limited to sparse-site creation.
- Existing downstream generation passes remain authoritative.

### Phase 1: Static Cluster Blueprint Data

Deliverables:

- `js/config/worldgenClusters.js`.
- Three cluster blueprints: starter hub, frontier extraction, badlands risk.
- Basic schema comments documenting allowed fields.

Exit criteria:

- Blueprint data is readable and intentionally small.
- Each cluster has at least three sites.
- Each cluster has faction and economy hints.
- No blueprint directly authors final companies, people, missions, or global prices.

### Phase 2: Cluster Assembly Function

Deliverables:

- `js/core/universe/clusterAssembly.js`.
- `createSparseSitesFromClusterBlueprints(config, rng)`.
- Helper functions for coordinate transforms, id rebasing, coordinate-key uniqueness, and site construction.

Exit criteria:

- The function returns `{ sites, siteIdByCoord, archetypeName }`.
- The output resembles current `createSparseSites(config)` output.
- Site ids are numeric and stable for a fixed seed.
- Coordinates are unique.
- Base influence is initialized per region.
- Faction bias is applied without adding a new faction model.

### Phase 3: Feature Flag Integration

Deliverables:

- A feature flag under `state.worldgenSettings.clusterAssembly`.
- A branch in `generateUniverse()` that calls cluster assembly when enabled.

Exit criteria:

- Procedural generation remains the default unless explicitly enabled.
- Cluster generation can be selected from test setup.
- Existing generation behavior remains available for comparison.

### Phase 4: Hint Post-Processing

Deliverables:

- A minimal transient hint map from global site id to blueprint hints.
- Post-resource-seeding application of stock bias.
- Optional forced port/asteroid hints if normal seeding is too weak.

Exit criteria:

- The starter cluster reliably contains multiple economic sites.
- The frontier extraction cluster reliably contains an extraction opportunity.
- The badlands cluster reliably contains higher-risk pressure.
- Economy profiles and pressure are still generated by existing systems.

### Phase 5: Tests

Deliverables:

- `tests/worldgenClusters.test.js`.
- Targeted tests for assembly output and full generation integration.
- A test confirming legacy procedural generation still works.

Exit criteria:

- Targeted tests pass.
- Worldgen-specific tests pass or any failure is understood and documented.
- The feature does not require DOM-only behavior.

### Phase 6: Manual Playtest Pass

Deliverables:

- At least five generated cluster-assembly starts with different seeds.
- Notes on starter quality, route shape, faction clarity, economy pressure, and map readability.

Exit criteria:

- The starting region consistently has useful decisions.
- The map does not feel obviously repeated across seeds.
- The economy has readable shortage/surplus pressure.
- There is no obvious breakage in travel, market, missions, logistics, or map inspection.

### Phase 7: Documentation Update

Deliverables:

- Add a short note to the docs explaining cluster-blueprint generation.
- Update the systems or architecture docs only if module ownership changes.
- Add contributor notes for writing cluster blueprints.

Exit criteria:

- Future contributors know that blueprints are scenario fragments, not final state.
- The documentation explains which systems remain authoritative.

## Future Rhai/Rust Path

The MVP should shape the future Rust/Rhai boundary.

Expected future architecture:

```text
Rhai cluster scripts
  -> typed Rust ClusterBlueprint structs
  -> Rust validation
  -> Rust galaxy assembly
  -> Rust corridor/economy normalization
  -> final world state emitted to the frontend
```

Rhai should be used for cluster authoring, not core simulation authority.

Good Rhai responsibilities:

- define cluster families;
- produce local variation;
- declare sites, offsets, and connector roles;
- declare faction and economy hints;
- define local scenario fragments.

Poor Rhai responsibilities:

- final pathfinding;
- save migration;
- authoritative price calibration;
- global route metrics;
- final economy pressure;
- direct world-state mutation after generation;
- unrestricted access to the full galaxy.

The Rust side should enforce types, invariants, validation, determinism, and performance-sensitive generation.

## Open Questions

1. How aggressively should future versions replace seam/procedural support fill with weighted authored-cluster selection from a larger pool?
2. Should local edge hints affect corridor candidate ordering in the MVP, or wait for a later version?
3. Should `roleHint: "home_candidate"` influence anchor scoring immediately, or should the starter cluster be shaped to win naturally?
4. Should `portHint` force a port during MVP post-processing, or should it only bias existing random seeding?
5. How much coordinate jitter is enough to reduce repetition without invalidating authored local shape?
6. Should hidden-front hints exist in MVP data but remain inactive until faction/contraband follow-up work?
7. Should cluster ids be stored anywhere for debugging, or kept entirely transient to avoid save coupling?

## Recommended MVP Decisions

1. Always place required starter/frontier/badlands authored clusters first, then fill to `config.occupiedSites` immediately with seam/procedural support sites.
2. Do not use local edge hints in corridor generation yet.
3. Add `roleHint` data, but first try to make starter anchor selection work naturally.
4. Let `portHint` force ports only in MVP cluster-generated worlds.
5. Use small coordinate jitter only after the fixed version works.
6. Include hidden-front hint fields but do not activate them in the first pass.
7. Keep cluster ids transient unless debugging becomes painful.

## Definition of Done for MVP

The MVP is done when:

1. Cluster assembly can be enabled through worldgen settings.
2. Required authored starter/frontier/badlands blueprints plus seam/procedural support fill generate exactly `config.occupiedSites` sparse sites.
3. The existing generation pipeline completes after cluster assembly.
4. Corridors are built by existing physics logic.
5. Ports, planets, asteroids, economy profiles, prices, pressure, polities, companies, people, and local locations still use existing systems.
6. The starter area has at least three meaningful nearby economic sites.
7. The generated galaxy has no duplicate coordinates.
8. The generated galaxy has no fabricated route fallback.
9. Targeted tests pass.
10. The old procedural generator remains available when cluster assembly is disabled or absent.

## Implementation Checklist

- [ ] Create `js/config/worldgenClusters.js`.
- [ ] Add starter hub blueprint.
- [ ] Add frontier extraction blueprint.
- [ ] Add badlands risk blueprint.
- [ ] Create `js/core/universe/clusterAssembly.js`.
- [ ] Implement coordinate transform helpers.
- [ ] Implement local-to-global id rebasing.
- [ ] Implement duplicate coordinate handling.
- [ ] Implement site record construction.
- [ ] Implement faction bias application.
- [ ] Return normal sparse-site data.
- [ ] Add worldgen setting flag.
- [ ] Branch sparse-site creation in `generateUniverse()`.
- [ ] Add optional post-resource stock-bias pass.
- [ ] Add targeted tests.
- [ ] Run worldgen-specific validation.
- [ ] Run manual playtest starts.
- [ ] Document results and next-step recommendations.
- [ ] Verify `worldgenClusters.js` uses Rhai-portable declarative data only.
- [ ] Verify blueprint records contain no executable behavior.
- [ ] Verify cluster selection and validation are deterministic for a fixed RNG seed.
- [ ] Verify each blueprint field has an obvious future Rust type.
- [ ] Verify no JS-specific object magic is required to interpret cluster data.
- [ ] Verify `worldgenClusters.js` does not use builder chains, classes, getters, prototypes, dynamic field names, or executable blueprint records.
- [ ] Verify cluster assembly does not depend on global mutable module state.
- [ ] Verify worldgen behavior depends only on explicit config, blueprint data, and the provided seeded RNG.
- [ ] Verify generated sparse-site records are constructed explicitly rather than by spreading blueprint records into runtime state.
- [ ] Verify invalid blueprint topology fails validation instead of being silently repaired by synthetic fallback routes or connectors.

## Likely Follow-Up Work

After MVP, likely next steps are:

1. Add procedural seam sites between clusters.
2. Add a real quality scorer.
3. Add more cluster families.
4. Add cluster transforms and weighted selection.
5. Add richer faction ecology.
6. Add hidden-front cluster activation.
7. Add cluster-level need/offer matching.
8. Add Rhai script loading as an authoring experiment.
9. Move the blueprint schema into a typed Rust representation.
10. Port assembly and quality scoring to Rust when the Tauri migration is ready.

## Working Principle

Cluster blueprints should make good situations more likely. They should not make outcomes predetermined.

The player should still enter a living simulation with incomplete information, uneven logistics, faction pressure, resource scarcity, and meaningful route choices. The new system should produce stronger starting material for the existing Star-Trading simulation, not replace that simulation.


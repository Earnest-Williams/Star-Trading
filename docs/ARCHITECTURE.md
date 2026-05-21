# Star-Trading Architecture
_Last updated: 2026-05-21_

Star-Trading is a browser-based sparse-3D galaxy space-trading and logistics
simulation. Players and AI captains operate persistent trade routes across real
jump-gate corridors whose feasibility depends on Euclidean distance plus local
metric shear. Pulse-energy logistics, captain economies, faction politics,
character traits, and capped ambient trade create an interconnected simulation.


## Key invariants

- Player-facing challenges are character-mediated: the player chooses the
  approach, while character stats, traits, assets, ship systems, property,
  staff, crew, intel, contacts, tools, and preparation determine execution
  difficulty, information quality, risk, cost, time, and success.

## Runtime architecture

```text
index.html
  -> js/main.js
       -> state creation / new game / save-load hooks
       -> command and UI event wiring
       -> EventBus notifications
       -> renderer invalidation

world tick
  -> hourly systems
  -> daily systems
  -> world events and UI updates
```

The browser shell is intentionally thin. Most gameplay logic lives in `js/core/`
and `js/systems/` so it can be tested with Node's built-in test runner.

## Module map

### Root modules

- `js/main.js` — browser entry point and top-level game action wiring.
- `js/state.js` — initial app-state shape and runtime UI state.
- `js/constants.js` — global balance groups, save version, factions,
  commodities, and shared constants.
- `js/events.js` — framework-free EventBus.
- `js/utils.js` — shared deterministic RNG, logging, formatting, and escaping
  helpers.

### Core modules

- `js/core/universe/generator.js` — seeded sparse site, role, port, planet,
  gate, influence, and threat generation.
- `js/core/universe/physics.js` — metric shear, effective span, and corridor
  legality.
- `js/core/universe/projection.js` — 2D/3D map projection and cache helpers.
- `js/core/universe/index.js` and `js/core/universe.js` — public universe API
  and compatibility barrel export.
- `js/core/navigation.js` — corridor topology, shortest paths, reserve labels,
  reachability, and relay surcharge helpers.
- `js/core/persistence.js` — save/load orchestration, adapters, migration, and
  sparse-world normalization.
- `js/core/characterBuild.js` — chargen validation, stat spend, platform
  package, and build helpers.
- `js/core/characters.js` — player character normalization and derived sheet
  values.
- `js/core/traitHooks.js` — passive trait bonus queries.
- `js/core/commands.js` — domain command registry and executor.
- `js/core/dataCargo/**` — private payloads, public market snapshots,
  contraband payload helpers, mission hooks, and public data-cargo API.
- `js/core/factions.js`, `js/core/influence.js`, and `js/core/intel.js` —
  faction state, influence/front queries, and canonical intel storage.
- `js/core/time.js`, `js/core/worldEvents.js`, and `js/core/worldTick.js` — game
  time, persistent event log, and hourly/daily simulation orchestration.

### Systems modules

- `js/systems/market.js` — port trading, price pressure, and routine trade side
  effects.
- `js/systems/tradeRoutes/**` — route validation, economics, assignment,
  execution, escort behavior, and route normalization.
- `js/systems/captains/**` — captain core data, AI, economy summaries, and
  persistence normalization.
- `js/systems/ambientTrade.js` — capped background trade flows.
- `js/systems/missions.js`, `secureCourier.js`, `colonies.js`, `mining.js`,
  `combat.js`, `travel.js`, `guilds.js`, `politics.js`, `polities.js`,
  `companies.js`, `people.js`, and `contraband.js` — domain-specific simulation systems.
- `js/systems/entanglements/**` — captain relationship state, faction social
  events, daily decay, and event generation.

### UI modules

- `js/ui/renderer.js` — dirty-tracking RAF scheduler and `updateUI()`.
- `js/ui/renderMap.js` — sparse-site canvas projection, hover tooltip, pinned
  inspector, zoom, pan, parallax, and recentering.
- `js/ui/renderHUD.js` — header, faction panel, accepted missions, priority
  feed, and action menu.
- `js/ui/render*.js` modules — screen-specific panels for sector, market,
  colony, missions, logistics, reputation, communications, spreadsheet,
  shipyard, chargen, and character sheet views.
- `style.css` — canonical responsive layout and visual language.

### Config modules

- `js/config/worldgen.js` — galaxy geometry, site spawning, port defaults,
  planet defaults, anchors, gate defaults, and starfield constants.
- `js/config/ui.js` — map projection, layout, node radius, label offsets, link
  width, and selection styling constants.
- `js/config/chargen.js`, `traits.js`, and `characters.js` — character budgets,
  platform packages, trait definitions, and authored character data.
- `js/config/missions.js`, `entanglements.js`, `politics.js`, `companies.js`,
  `people.js`, and `polities.js` — domain data and authored balance tables.

## Data flow

1. New game setup selects a build and calls world-generation helpers.
2. World generation creates sparse occupied sites, role anchors, corridor gates,
   market state, influence, threats, and initial charted data.
3. Player actions and captain AI mutate normalized state through core/system
   helpers.
4. `js/core/worldTick.js` advances hourly and daily systems.
5. Systems emit events through the EventBus and append durable narrative entries
   to the world-event log where appropriate.
6. UI renderers mark dirty views and redraw from state.
7. Persistence serializes state with `SAVE_VERSION`; load paths migrate and
   normalize before systems or renderers consume the payload.

## Key invariants

- Sparse occupied coordinates are the source of truth; do not materialize empty
  lattice cells.
- Route systems must operate on real jump-gate corridor connectivity.
- Role anchors such as `homeSiteId`, `startingPortSiteId`, and `shipyardSiteId`
  are preferred over hard-coded sector numbers.
- Ambient trade is capped and cannot replace explicit player/captain logistics.
- Gate logistics are packetized pulse inventory, not a continuous power grid.
- Save migration and normalization must be idempotent.
- Compatibility barrels should remain stable while new code targets canonical
  implementation modules.

## How to add a character trait

1. Add the trait definition to `js/config/traits.js` with a stable `id`, category,
   description, stat shifts, bonuses, drawbacks, prerequisites, and tags.
2. If the trait changes chargen legality or point spend, update
   `js/core/characterBuild.js`.
3. If the trait grants passive system effects, read it through
   `js/core/traitHooks.js` from the affected system.
4. If the trait needs UI explanation, update the chargen or character-sheet
   renderer.
5. Add or update tests covering validation and any passive effect.
6. Update documentation when the trait changes player-facing rules or feature
   boundaries.

## How to extend gate physics

1. Add any player-facing tuning value to `js/config/worldgen.js`,
   `js/constants.js`, or the closest existing config home.
2. Extend pure helpers in `js/core/universe/physics.js`.
3. Update corridor generation, route planning, navigation, trade-route economics,
   and captain AI call sites as needed.
4. Add tests for legal, illegal, high-shear, and sparse-space cases.
5. Update the gate-physics language in `README.md` and
   `docs/feature-boundary.md` if the qualitative rule changes.

## How to add a persisted field

1. Add the field to fresh state or generation output.
2. Normalize missing values during load.
3. Bump `SAVE_VERSION` when an old payload needs transformation beyond a simple
   safe default.
4. Keep migration code idempotent and close to `js/core/persistence.js` or the
   domain normalizer.
5. Add legacy-payload tests.
6. Update `docs/SAVE_FORMAT.md` if the persisted shape or migration policy
   changes.

## How to add a UI screen or renderer

1. Keep domain state changes in core/system modules rather than the renderer.
2. Add renderer code under `js/ui/` and route it through the existing UI state
   and dirty-render flow.
3. Use EventBus subscriptions that can be removed or are scoped to app lifetime.
4. Keep display constants in `js/config/ui.js` when they are reused or
   player-facing.
5. Add focused tests for data helpers; manually verify browser interaction.

## Contributor workflow

- Install dependencies with `npm install`.
- Run `npm test` and `npm run lint` before opening a pull request.
- Run `npm run benchmark:map` when changing map projection or world-density
  behavior.
- Update docs in the same change as player-facing behavior, save shape, balance
  homes, public exports, or contributor workflow.

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SYSTEMS.md](./SYSTEMS.md), and
[SAVE_FORMAT.md](./SAVE_FORMAT.md) for deeper maintenance guidance.

## How to add a challenge or puzzle-like interaction

1. Define what player choice the interaction creates: approach, resource
   commitment, risk tolerance, timing, fallback, escalation, or delegation.
2. Define which character capabilities execute the attempt.
3. Route resolution through canonical character, trait, skill, asset, ship,
   intel, faction, market, route, property, or domain helpers rather than
   renderer-only logic.
4. Ensure high relevant competency can trivialize, strongly guide, or nearly
   trivialize routine challenges.
5. Ensure low relevant competency creates uncertainty, partial information,
   cost, delay, risk, failure, or dependence on outside help.
6. Add tests for low, average, and high competency outcomes.
7. Update player-facing documentation when challenge resolution changes.

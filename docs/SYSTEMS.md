# Systems Guide

This guide maps major gameplay systems to their canonical modules, state, config,
and testing surfaces. Use it to find the correct home for new behavior before
adding another subsystem or compatibility wrapper.

## Core state and runtime flow

- `js/state.js` owns the initial app state shape and shared runtime UI state.
- `js/main.js` wires the browser entry point, event handlers, and top-level game
  actions.
- `js/events.js` provides the framework-free EventBus used by renderers and game
  actions.
- `js/ui/renderer.js` coordinates dirty tracking and redraw scheduling.
- `js/core/worldTick.js` runs daily/hourly simulation phases and registered
  hooks.

## World, gates, and navigation

- `js/core/universe/generator.js` creates sparse occupied sites, roles, gates,
  ports, planets, way stations, influence, threats, and starting chart data.
- `js/core/universe/physics.js` evaluates metric shear, effective span, and
  corridor legality.
- `js/core/universe/projection.js` handles 3D-to-2D map projection and caching.
- `js/core/navigation.js` owns corridor traversal, shortest paths, reserve
  labels, reachability, and relay surcharge helpers.
- `js/config/worldgen.js` and `js/config/ui.js` hold most world-shape and map UI
  tuning.

## Economy and logistics

- `js/systems/market.js` handles port trades, price pressure, and routine trade
  side effects.
- `js/systems/tradeRoutes/**` owns explicit route validation, economics,
  assignment, execution, outage, escort, and persistence normalization.
- `js/systems/ambientTrade.js` models capped background flows. It should soften
  market pressure without replacing explicit player or captain routes.
- `js/core/routePlanner.js` estimates route edges and costs from gate topology.
- Route and market balance values live primarily in `BALANCE.TRADE_ROUTE`,
  `BALANCE.ROUTE_PLANNER`, and `BALANCE.MARKET`.

## Captains, characters, and traits

- `js/systems/captains/**` owns captain creation, AI choices, economy summaries,
  and save normalization.
- `js/core/characters.js` owns player character normalization and derived sheet
  values.
- `js/core/characterBuild.js` owns chargen build validation and spend helpers.
- `js/core/traitHooks.js` reads trait bonuses for passive system effects.
- `js/config/characters.js`, `js/config/chargen.js`, and `js/config/traits.js`
  hold authored character data, chargen packages, stat budgets, and trait
  definitions.

## Missions, people, companies, and polities

- `js/systems/missions.js` owns mission generation, acceptance, completion, and
  expiry.
- `js/config/missions.js` stores mission templates and authored reward/risk
  values.
- `js/systems/people.js` and `js/config/people.js` seed named people and mission
  issuers.
- `js/systems/companies.js` and `js/config/companies.js` seed companies and
  economic actors.
- `js/systems/polities.js`, `js/systems/politics.js`, `js/systems/guilds.js`, `js/config/politics.js`, and `js/config/polities.js` 
  layer regional governance, faction drift, and guild charters over site influence.

## Factions, reputation, intel, and entanglements

- `js/core/factions.js` owns faction state, reputation, trust, and contact-state
  helpers.
- `js/core/influence.js` owns dominant-influence and front-tracking queries.
- `js/core/intel.js` is the canonical intel API for add, expire, and sell flows.
- `js/systems/entanglements/**` owns captain relationship state, faction social
  events, daily decay, and event generation.
- `js/config/entanglements.js` stores relationship strength, pressure, cooldown,
  and event-weight tuning.

## Data cargo, contraband, and secure courier work

- `js/core/dataCargo/**` owns private payloads, public market snapshots,
  contraband payload helpers, mission hooks, and public data-cargo exports.
- `js/systems/secureCourier.js` owns secure courier contract generation,
  delivery, expiry, compromise, and interception behavior.
- `js/systems/contraband.js` owns legality/heat interactions for contraband
  cargo. `js/new/contraband.js` remains only a compatibility entry point.
- Data-cargo and secure-courier balance values live in `BALANCE.DATA_CARGO`.

## Colonies, mining, combat, and travel

- `js/systems/colonies.js` owns colony founding, development, and logistics-node
  setup.
- `js/systems/mining.js` owns asteroid mining, hazards, survey work, and related
  intel discovery.
- `js/systems/combat.js` owns pirate combat actions, emergency repairs, and
  fight rewards.
- `js/systems/travel.js` owns corridor travel incidents, leverage events, and
  travel-side risk effects.

## UI surfaces

- `js/ui/renderMap.js` owns the interactive map, hover tooltip, pinned inspector,
  zoom, pan, and recenter behavior.
- `js/ui/renderSector.js`, `renderMarket.js`, `renderMissions.js`,
  `renderLogistics.js`, `renderReputation.js`, `renderComms.js`,
  `renderSpreadsheet.js`, `renderShipyard.js`, and `renderCharacterSheet.js`
  own the main screen panels.
- `js/ui/renderHUD.js` owns header state, faction panels, active missions,
  priority feed, and action menus.
- `style.css` is the canonical stylesheet for responsive layout and visual
  language.

## Compatibility wrappers

A few top-level modules are retained as stable import paths while implementation
is split into submodules. Prefer canonical modules for new code, but keep wrappers
working for existing imports and tests.

- `js/core/universe.js` re-exports `js/core/universe/index.js`.
- `js/core/dataCargo.js` re-exports `js/core/dataCargo/index.js`.
- `js/systems/captains.js` re-exports the captains package.
- `js/systems/tradeRoutes.js` re-exports the trade-routes package.
- `js/systems/entanglements.js` re-exports the entanglements package.
- `js/new/intel.js` and `js/new/contraband.js` are compatibility entry points,
  not canonical stores.

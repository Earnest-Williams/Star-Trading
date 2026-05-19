# Star-Trading

**Star-Trading** is a browser-based space trading and logistics simulation set in
a sparse frontier galaxy.

You manage route planning, jump-gate access, market arbitrage, political risk,
long-distance supply pressure, and a captain trying to stay solvent at the edge
of known space. Pick a starting build, inspect nearby sites, move through jump
corridors, trade through ports, take contracts, found colonies, and build routes
that can survive pirates, faction pressure, and pulse-reserve strain.

Unlike a simple buy-low/sell-high trader, Star-Trading connects sparse 3D sites,
corridor constraints, gate-energy logistics, ambient trade, captain activity,
character traits, and factional pressure into one simulation.

**Current status:** active solo prototype with chargen, persistence, save
migration, tests, CI-ready scripts, and ongoing systems/UI work.


## Design principle: player choice, character execution

Star-Trading challenges are character-mediated. The player chooses goals,
methods, risk tolerance, timing, and resource commitment; the character performs
the actual tests. Trade analysis, route planning, negotiation, repair,
inspection evasion, property management, finance, decoding, and crisis response
should resolve from stats, traits, tools, property, staff, contacts, intel, and
preparation.

High relevant competency should make routine challenges simple, obvious,
automatic, or low-risk. Low relevant competency should create uncertainty,
partial information, higher costs, delay, risk, or the need for outside help.

## Quick links

- [Documentation index](./docs/README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Contributor guide](./docs/CONTRIBUTING.md)
- [Systems guide](./docs/SYSTEMS.md)
- [Save format and migration guide](./docs/SAVE_FORMAT.md)
- [Feature boundaries](./docs/feature-boundary.md)
- [Magic number audit](./docs/magic-numbers.md)

## How to play in 60 seconds

1. Open `index.html` directly or run the local dev server with `npm run dev`.
2. Expand **New Game Settings**.
3. Choose an archetype preset, press **Random Preset**, press **Random Valid
   Build**, or customize stats/traits/packages manually.
4. Press **Start New Galaxy** once the build is valid.
5. Inspect nearby sites on the map. Hover for quick tactical details; click for
   sticky inspection.
6. Use the inspector or navigation panel to transit direct jump corridors.
7. Trade at ports, take missions, found colonies, create logistics routes, and
   watch the attention feed.
8. Keep an eye on pirates, faction contests, pulse reserve strain, market
   shortages, data-cargo opportunities, and captain activity.

## Controls and UI overview

- **Map hover:** shows quick tactical site information: coordinates, site type,
  region, status, dominant faction, port/planet tags, pirate pressure, and
  active route count.
- **Map click:** pins a site in the map inspector for sticky review.
- **Mouse wheel:** zooms the map without changing the cached world projection.
- **Drag:** pans the map; background stars parallax subtly while the node graph
  moves.
- **Double-click map / Center on Current Sector:** recenters the viewport on the
  captain's current site.
- **Transit Corridor:** appears only in the sticky inspector when the selected
  site is directly adjacent.
- **Topbar screens:** Sector, Market, Colony, Missions, Logistics, Reputation,
  Communications, Spreadsheet, Shipyard, and Character expose the main prototype
  systems.
- **Charted / reachable / surveyed:** a site can be known without full survey
  detail or routine access; jump corridors determine practical movement.
- **Color language:** green usually means current/safe/valid, amber means caution
  or contested pressure, red means threat/invalid/danger, and faction icons show
  local influence.

## Running it

Install dependencies once:

```bash
npm install
```

Run the pinned Vite dev server on port 3000:

```bash
npm run dev
```

Build for production/CI:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Opening `index.html` directly is allowed only for quick local inspection, not validation.

## Validation commands

Tests run with Node.js 18+ and do not require browser DOM stubs. The suite covers
simulation, persistence, navigation, routes, chargen, ambient trade, captains,
contraband, data cargo, entanglements, secure courier, world tick, worldgen gate
economy, global registries, time, and map projection.

```bash
npm test
npm run lint
npm run build
npm run benchmark:map
```

Run `npm test`, `npm run lint`, and `npm run build` before merging gameplay, UI, persistence, or module changes.

Run `npm run benchmark:map` when touching:
- `js/ui/renderMap.js`;
- `js/core/universe/projection.js`;
- map projection constants;
- map cache behavior;
- worldgen density;
- corridor generation;
- rendering math.

Local pre-merge command:

```bash
npm run validate
```

CI validation order matches `.github/workflows/ci.yml`:

```bash
npm ci
npm test
npm run lint
npm run build
```

## Project structure

```text
index.html          # Browser shell and module entry point
style.css           # Canonical stylesheet and responsive UI rules
package.json        # type:module scripts: test, dev, lint, benchmark:map
docs/               # Contributor docs, system guides, boundaries, design notes
tests/              # Node test suite for simulation and persistence behavior
benchmarks/         # Focused performance checks
js/
  constants.js      # BALANCE, save version, factions, commodities, global knobs
  state.js          # Initial app state and shared runtime UI state
  events.js         # Framework-free EventBus
  utils.js          # Shared helpers: RNG, logging, formatting, escaping
  config/           # Authored data and domain tuning tables
  core/             # Save, world, navigation, commands, time, factions, intel
  systems/          # Economy, captains, routes, missions, politics, travel, etc.
  ui/               # Renderers, screen panels, notifications, chargen UI
  new/              # Compatibility entry points for planned/legacy imports
```

See [docs/SYSTEMS.md](./docs/SYSTEMS.md) for the canonical module owner of each
major gameplay system.

## Setting terminology

- **Site:** any occupied coordinate in the sparse 3D galaxy, such as a port,
  planet, asteroid, way station, anomaly, or relay.
- **Sector:** legacy/UI-facing term that often refers to a site-like view. New
  systems should prefer explicit site ids and world role anchors.
- **Jump Gate:** infrastructure endpoint at a site. Two endpoints form a jump
  corridor.
- **Jump Corridor:** a traversable gate pair. Route systems must use real
  corridor connectivity rather than fabricated fallback paths.
- **Metric Shear:** local spacetime complexity that increases effective span
  cost for gate feasibility.
- **Way Station:** support infrastructure, usually in deep or sparse space. Way
  stations are not resource-rich normal economies.
- **Metric Pulse Accumulator:** specialist jump-opening storage hardware. It
  stores preconditioned pulse inventory, not generic ship power.
- **Pulse Canister / Heavy Pulse Module:** packaged jump-energy cargo used to
  physically resupply gates, way stations, and tenders.
- **Jump Tender / Pulse Tender:** specialist ship role for carrying large
  accumulators and recharging gate banks or relay stations.
- **Trade Route:** an explicit commercial plan operated by the player or a
  modeled captain. A route uses the corridor network but is not the network.
- **Ambient Trade:** capped aggregate background flows representing unmodeled
  traders. Ambient trade can soften shortages but cannot replace explicit
  logistics.

## Generation and simulation summary

Generation proceeds conceptually as:

1. choose a galaxy archetype (`Barred Spiral`, `Four-Arm Spiral`, or
   `Dwarf Irregular`);
2. generate clustered sparse occupied coordinates;
3. assign astrophysical site families and independent richness classes;
4. suppress ordinary settlement in high-shear central regions;
5. choose role anchors such as `homeSiteId`, `startingPortSiteId`, and
   `shipyardSiteId`;
6. expose only a starting charted subnetwork;
7. build corridors using effective span cost;
8. seed ports, planets, asteroids, way-station reserves, influence, and threats.

The economy is layered rather than one blended route graph:

1. **Infrastructure layer** — occupied sites contain jump-gate endpoints, and
   paired gates form corridors.
2. **Explicit actor layer** — the player and eligible modeled captains can
   operate standing trade routes over the corridor network.
3. **Relay energy layer** — way stations and long corridors track pulse-reserve
   pressure and route-class data.
4. **Ambient market layer** — unmodeled traders move small aggregate volumes
   where surplus, shortage, margin, distance, and risk make sense.
5. **Political/security layer** — faction influence, fronts, pirate pressure,
   and captain actions alter route risk and market conditions over time.

Explicit routes still matter because ambient trade is intentionally capped. It
can make markets feel alive, but it cannot fill every deficit, create guaranteed
supply, provide player income, or replace dedicated player/captain logistics.

## Gate physics and energy economy

Ordinary gate feasibility uses an effective-span model:

- raw Euclidean distance between site coordinates;
- average and peak metric shear sampled along the path;
- comparison against the vacuum-span budget.

Dense, complex, or hostile central regions increase effective cost. Sparse space
permits links closer to the best-case span. Gates are designed for short,
packetized transit events, not permanent high-throughput utility transmission.

A gate opening uses a source-side bulk pulse, a smaller destination-side
anchor/capture pulse, and local stored jump-opening inventory at the source side.
This preserves logistics gameplay: deep relay chains must be stocked materially
with Pulse Canisters, Heavy Pulse Modules, accumulators, or tender support.

## Save migration

Saves are versioned. Current migration normalizes missing sparse-world fields,
converts legacy adjacency into first-class jump-gate corridor endpoints, converts
old route objects into player-owned explicit trade routes, renames old ship
transit timing to corridor transit timing, and normalizes missing captain economy
and ambient trade fields. Migration is designed to be idempotent.

See [docs/SAVE_FORMAT.md](./docs/SAVE_FORMAT.md) for migration policy and
compatibility expectations.

## Status and roadmap

### Recently added

- Guilds, faction asks, intel selling, and reputation tabs.
- Entanglements: persistent captain relationships, romance arcs, and daily
  decay/event generation.
- Data cargo: private payloads, public market snapshots, ambient snapshot
  propagation, and secure courier contracts.
- Communications screen exposing intel, data-cargo snapshots, and freshness
  telemetry.
- Spreadsheet/ledger screen with formula evaluation.
- Companies and people: named mission issuers seeded into the world at
  generation.
- Polities: regional governance structures layered over faction influence.
- World-tick orchestration split into daily and hourly phases with registered
  hooks.
- World events log for persistent narrative tracking.
- Simulation trace layer that mirrors world, dialogue, and route outcomes into
  a shared causal debug ledger.
- Character sheet, chargen presets, trait hooks, and starting platform choices.
- Property simulation updates: tenant economic profiles, supply-chain-aware
  recommendations, company leasing matches, and stationary contract generation.
- Sparse-world save migration and persistence normalization.
- Interactive map polish: hover tooltips, zoom/pan viewport transforms, parallax
  starfield, and recentering.
- Test suite covering all major systems.

### In progress

- Extending simulation-trace adoption across travel, captains, factions,
  missions, colonies, economy, combat, and threat systems.
- Deepening entanglement consequences and captain-relationship gameplay.
- Improving first-run onboarding and system discoverability.
- Continuing responsive UI passes for tablet and phone-sized screens.

### Next priorities

- Screenshot or short GIF for the README.
- More authored map, chargen, and notification feedback.
- More authored causal explanations in notifications, route reports, and maps.
- Bounty board once the contraband/legality heat surface is proven.

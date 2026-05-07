# Star-Trading

Star-Trading is a browser-based space trading, logistics, and frontier-economy simulation structured as ES modules loaded from `index.html`.

## Current world model

The universe is now modeled as a **sparse 3D integer lattice**. Any coordinate `(x, y, z)` can exist in the notional galaxy, but most coordinates are empty and are never allocated. Gameplay happens at occupied **sites** stored sparsely by id and coordinate key.

- **Grid cell**: any integer `(x, y, z)` coordinate in the notional lattice.
- **Site**: an occupied coordinate with meaningful content.
- **Navigable site**: a site with charted or reachable jump-gate infrastructure.
- **Charted / reachable / surveyed**: separate visibility states. A site can exist without being known, known without routine service, or reachable without detailed survey data.

The default galaxy currently generates about 60 occupied navigable sites, with presets and constants prepared for 90, 120, and 150. The map is not a fixed dense cube and does not render empty coordinates.

## Terminology glossary

- **Jump Gate**: a site-local infrastructure endpoint. Ships use local gates; ships are not independently FTL-capable.
- **Vacuum Span**: the universe-wide best-case ordinary-gate span in low-shear space. The first-pass value is 6.0 grid units.
- **Metric Shear / Curvature Noise**: local spacetime complexity that increases the effective cost of a corridor and shortens practical direct links in dense or hostile regions.
- **Corridor**: the FTL link created when two jump gates in different sites are paired. Corridor legality is based on effective span cost, not raw distance alone.
- **Way Station**: rare artificial relay/maintenance infrastructure, usually in deep or sparse space. Way stations are not resource-rich normal economies.
- **Metric Pulse Accumulator**: specialist jump-opening storage hardware. It stores preconditioned pulse inventory, not generic ship power.
- **Pulse Canister / Heavy Pulse Module**: packaged jump-energy cargo used to physically resupply gates, way stations, and tenders. These are now distinct market cargo types rather than raw joule UI values.
- **Jump Tender / Pulse Tender**: reserved specialist ship role for carrying large accumulators and recharging gate banks or relay stations.
- **Trade Route**: an explicit commercial plan operated by the player or a modeled captain. A route uses the corridor network but is not the network itself.
- **Ambient Trade**: capped aggregate background flows representing unmodeled traders. Ambient trade responds to shortages, surplus, distance, risk, and margin, but it does not create route objects or fully solve the economy.

## Project structure

```
index.html          # Shell: HTML and <script type="module" src="js/main.js">
style.css           # Canonical stylesheet
package.json        # type:module + npm scripts (test, dev, lint)
js/
  constants.js      # BALANCE, worldgen, gate physics, pulse cargo, factions, commodities
  state.js          # Sparse site/world state plus shared runtime state
  core/
    universe.js     # Sparse 3D site generation, route physics helpers, site/port/planet factories
    navigation.js   # Jump-gate topology, shortest paths, reserve labels, relay surcharges
    persistence.js  # save/load, current SAVE_VERSION, sparse-world normalization and legacy migration
  systems/          # Economy, captains, colonies, combat, contraband, mining, missions, routes, politics
  ui/
    renderMap.js    # Projects charted 3D sites onto the 2D canvas; does not render empty cells
    renderSector.js # Shows site type, coordinates, survey state, local gates, station reserve state
    ui.js           # Action registry, screen routing, Renderer registrations
tests/              # Node test suite for simulation, persistence, navigation, routes, and systems
```

## World generation

Generation proceeds conceptually as:

1. choose a galaxy archetype (`Barred Spiral`, `Four-Arm Spiral`, or `Dwarf Irregular`);
2. generate clustered sparse occupied coordinates;
3. assign astrophysical site families and independent richness classes;
4. suppress ordinary settlement in high-shear central regions;
5. choose role anchors such as `homeSiteId`, `startingPortSiteId`, and `shipyardSiteId`;
6. expose only a starting charted subnetwork;
7. build corridors using effective span cost;
8. seed ports, planets, asteroids, way-station reserves, influence, and threats.

Most navigable sites are `stellar_system`, with secondary `brown_dwarf_system`, `circumbinary_system`, `multiple_star_system`, `rogue_system`, `white_dwarf_remnant`, `exotic_remnant`, and `way_station` sites. Richness is a separate axis (`barren`, `sparse`, `developing`, `settled`, `hub`, `strategic`) so astrophysical family does not hard-code economic value.

## Gate physics and energy economy

Ordinary gate feasibility uses an effective-span model:

- raw Euclidean distance between site coordinates;
- average and peak metric shear sampled along the path;
- comparison against the 6.0-grid-unit vacuum-span budget.

Dense, complex, or hostile central regions increase effective cost. Sparse space permits links closer to the best-case span. Gates are designed for short packetized transit events, not permanent high-throughput utility transmission.

A gate opening uses:

1. a source-side bulk pulse;
2. a smaller destination-side anchor/capture pulse;
3. local stored jump-opening inventory at the source side.

This preserves logistics gameplay: deep relay chains must be stocked materially with Pulse Canisters, Heavy Pulse Modules, accumulators, or tender support. StarDock, industrial ports, and refineries can trade packaged pulse inventory; mining, agricultural, and consumer sites consume it as reserve logistics stock. Gates move ships and cargo; they do not make one hostile or high-energy region an unlimited power plant for the whole network.

## Way stations and relay chains

Way stations provide maintenance, docking, inspections, tolls, limited trade, scheduling, and emergency relay capacity. They have baseline station power for survival systems, but source-side gate launches consume locally stored pulse reserve.

- One-way-station routes can be routine.
- Two-way-station routes are notable and expensive.
- Three-plus-way-station chains are strategic, military, frontier-lifeline, smuggler, or scenario-scale infrastructure.

The first implementation exposes station state labels such as `Full`, `Stable`, `Strained`, `Low Reserve`, and `Depleted` while keeping raw joule math mostly internal.

## Current simulation model

The economy is layered rather than one blended route graph:

1. **Infrastructure layer** — occupied sites contain jump gate endpoints, and paired gates form corridors.
2. **Explicit actor layer** — the player and eligible modeled captains can operate standing trade routes over the corridor network.
3. **Relay energy layer** — way stations and long corridors track pulse-reserve pressure and route class data.
4. **Ambient market layer** — unmodeled traders move small aggregate volumes where surplus, shortage, margin, distance, and risk make sense.
5. **Political/security layer** — faction influence, fronts, pirate pressure, and captain actions alter route risk and market conditions over time.

Explicit routes still matter because ambient trade is intentionally capped. It can soften shortages and make markets feel alive, but it cannot fill every deficit, create guaranteed supply, provide player income, or replace dedicated player/captain logistics.

## Save migration

Saves are versioned. Current migration normalizes missing sparse-world fields, converts legacy adjacency into first-class jump-gate corridor endpoints, converts old route objects into player-owned explicit trade routes, renames old ship transit timing to corridor transit timing, and normalizes missing captain economy and ambient trade fields. Migration is designed to be idempotent.

## Running it

There is no build step. Open `index.html` in a browser to play the prototype.

To run the pinned Vite dev server on port 3000:

```
npm run dev
```

## Running the tests

Smoke tests and cross-system simulation tests run with Node.js 18+ and do not require browser DOM stubs:

```
npm test
```

## Linting

```
npm run lint
```

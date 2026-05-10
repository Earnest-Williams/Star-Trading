# Star-Trading

**Star-Trading** is a browser-based space trading and logistics sim set in a sparse frontier galaxy.

You manage routes, jump-gate access, market arbitrage, political risk, long-distance supply pressure, and a captain trying to stay solvent at the edge of known space. Pick a starting build, inspect nearby sites, move through jump corridors, trade through ports, take contracts, and build routes that can survive pirates, faction pressure, and reserve strain.

Unlike a simple buy-low/sell-high trader, Star-Trading models sparse 3D sites, corridor constraints, gate-energy logistics, ambient trade, captain activity, and factional pressure as connected systems.

**Current status:** active solo prototype with chargen, persistence, save migration, tests, CI-ready scripts, and ongoing systems/UI work.

## How to play in 60 seconds

1. Open `index.html` directly or run the local dev server with `npm run dev`.
2. Expand **New Game Settings**.
3. Choose an archetype preset, press **Random Preset**, press **Random Valid Build**, or customize stats/traits/packages manually.
4. Press **Start New Galaxy** once the build is valid.
5. Inspect nearby sites on the map. Hover for quick tactical details; click for sticky inspection.
6. Use the inspector or navigation panel to transit direct jump corridors.
7. Trade at ports, take missions, found colonies, create logistics routes, and watch the attention feed.
8. Keep an eye on pirates, faction contests, pulse reserve strain, market shortages, and captain activity.

## Controls and UI overview

- **Map hover:** shows quick tactical site information: coordinates, site type, region, status, dominant faction, port/planet tags, pirate pressure, and active route count.
- **Map click:** pins a site in the map inspector for sticky review.
- **Mouse wheel:** zooms the map without changing the cached world projection.
- **Drag:** pans the map; background stars parallax subtly while the node graph moves.
- **Double-click map / Center on Current Sector:** recenters the viewport on the captain's current site.
- **Transit Corridor:** appears only in the sticky inspector when the selected site is directly adjacent.
- **Topbar screens:** Sector, Market, Colony, Missions, Logistics, Reputation, Communications, Spreadsheet, Shipyard, and Character expose the main prototype systems.
- **Charted / reachable / surveyed:** a site can be known without full survey detail or routine access; jump corridors determine practical movement.
- **Color language:** green usually means current/safe/valid, amber means caution or contested pressure, red means threat/invalid/danger, and faction icons show local influence.

## Project structure

```
index.html          # Shell: HTML and <script type="module" src="js/main.js">
style.css           # Canonical stylesheet and responsive UI rules
package.json        # type:module + npm scripts (test, dev, lint, benchmark:map)
js/
  constants.js      # BALANCE, worldgen, gate physics, pulse cargo, factions, commodities
  state.js          # Sparse site/world state plus shared runtime UI state
  events.js         # Pure EventBus (no browser APIs)
  utils.js          # Shared helpers: log, random, escapeHtml, formatCredits, etc.
  config/           # Static data tables: chargen, traits, missions, characters, worldgen, polities, etc.
  core/
    universe.js     # Sparse 3D site generation, createPlayer(), route physics helpers
    navigation.js   # Jump-gate topology, shortest paths, reserve labels, relay surcharges
    persistence.js  # save/load, SAVE_VERSION, sparse-world normalization and legacy migration
    characters.js   # Character sheet queries and stat resolution
    characterBuild.js  # Chargen validation, stat spend, build helpers
    commands.js     # Action registry and executor (domain command layer)
    dataCargo.js    # Private payloads, public snapshots, secure cargo intel
    factions.js     # Faction rep, trust, and relationship helpers
    influence.js    # Dominant influence queries and front tracking
    intel.js        # Intel store: add, expire, sell
    routePlanner.js # Route planning helpers
    time.js         # Game time: advance, spendTime, restUntilMorning
    traitHooks.js   # Passive trait effect application
    worldEvents.js  # World event log
    worldTick.js    # Daily/hourly simulation tick orchestration
  systems/          # Economy, captains, colonies, combat, contraband, entanglements, guilds,
                    # market, mining, missions, people, polities, routes, secure courier, travel
  ui/
    renderer.js     # Dirty-tracking RAF scheduler and updateUI()
    renderMap.js    # Projects charted 3D sites onto the 2D canvas; viewport interaction
    renderSector.js # Site type, coordinates, survey state, local gates, station reserve
    renderHUD.js    # Header, faction panel, accepted missions, priority feed, action menu
    renderMarket.js # Port commodity trading panel
    renderMissions.js     # Mission board and active mission display
    renderLogistics.js    # Trade route and logistics overview
    renderReputation.js   # Reputation screen with guild, faction, and captain tabs
    renderCaptains.js     # Captain interaction actions and relationship UI
    renderComms.js        # Communications screen: intel, data cargo snapshots
    renderSpreadsheet.js  # Ledger spreadsheet screen with formula evaluation
    renderChargen.js      # Character generation controls
    renderCharacterSheet.js # In-game character sheet
    renderColony.js       # Colony management panel
    renderShipyard.js     # Ship upgrades, repair, and fighter purchases
    renderEntanglements.js # Relationship and entanglement display
    ui.js           # Action registry, screen routing, Renderer registrations
  new/              # Compatibility entry points for planned/legacy imports (bounties, contraband, intel)
tests/              # 21-file Node test suite: simulation, persistence, navigation, routes, chargen,
                    # ambient trade, captains, contraband, data cargo, entanglements, secure courier,
                    # world tick, worldgen gate economy, global registries, time, map projection, and more
benchmarks/         # Map projection performance benchmark (npm run benchmark:map)
docs/               # Design and boundary documents
```

## Design language

Star-Trading uses the Blackline Command interface language: an OLED-black, hard-angle command-surface style built from heavy typography, 2-4px technical borders, dense telemetry, and restrained neon signal colors.

- Design bible: `docs/design/blackline-command.md`
- Implementation guide: `docs/design/blackline-command-implementation.md`
- Feature boundary: `docs/feature-boundary.md`

## Current world model

The universe is modeled as a **sparse 3D integer lattice**. Any coordinate `(x, y, z)` can exist in the notional galaxy, but most coordinates are empty and are never allocated. Gameplay happens at occupied **sites** stored sparsely by id and coordinate key.

- **Grid cell:** any integer `(x, y, z)` coordinate in the notional lattice.
- **Site:** an occupied coordinate with meaningful content.
- **Navigable site:** a site with charted or reachable jump-gate infrastructure.
- **Charted / reachable / surveyed:** separate visibility states. A site can exist without being known, known without routine service, or reachable without detailed survey data.

The default galaxy currently generates about 60 occupied navigable sites, with presets and constants prepared for 90, 120, and 150. The map is not a fixed dense cube and does not render empty coordinates.

## Terminology glossary

- **Jump Gate:** a site-local infrastructure endpoint. Ships use local gates; ships are not independently FTL-capable.
- **Vacuum Span:** the universe-wide best-case ordinary-gate span in low-shear space. The first-pass value is 6.0 grid units.
- **Metric Shear / Curvature Noise:** local spacetime complexity that increases the effective cost of a corridor and shortens practical direct links in dense or hostile regions.
- **Corridor:** the FTL link created when two jump gates in different sites are paired. Corridor legality is based on effective span cost, not raw distance alone.
- **Way Station:** rare artificial relay/maintenance infrastructure, usually in deep or sparse space. Way stations are not resource-rich normal economies.
- **Metric Pulse Accumulator:** specialist jump-opening storage hardware. It stores preconditioned pulse inventory, not generic ship power.
- **Pulse Canister / Heavy Pulse Module:** packaged jump-energy cargo used to physically resupply gates, way stations, and tenders. These are distinct market cargo types rather than raw joule UI values.
- **Jump Tender / Pulse Tender:** reserved specialist ship role for carrying large accumulators and recharging gate banks or relay stations.
- **Trade Route:** an explicit commercial plan operated by the player or a modeled captain. A route uses the corridor network but is not the network itself.
- **Ambient Trade:** capped aggregate background flows representing unmodeled traders. Ambient trade responds to shortages, surplus, distance, risk, and margin, but it does not create route objects or fully solve the economy.

## Generation and simulation summary

Generation proceeds conceptually as:

1. choose a galaxy archetype (`Barred Spiral`, `Four-Arm Spiral`, or `Dwarf Irregular`);
2. generate clustered sparse occupied coordinates;
3. assign astrophysical site families and independent richness classes;
4. suppress ordinary settlement in high-shear central regions;
5. choose role anchors such as `homeSiteId`, `startingPortSiteId`, and `shipyardSiteId`;
6. expose only a starting charted subnetwork;
7. build corridors using effective span cost;
8. seed ports, planets, asteroids, way-station reserves, influence, and threats.

The economy is layered rather than one blended route graph:

1. **Infrastructure layer** — occupied sites contain jump gate endpoints, and paired gates form corridors.
2. **Explicit actor layer** — the player and eligible modeled captains can operate standing trade routes over the corridor network.
3. **Relay energy layer** — way stations and long corridors track pulse-reserve pressure and route class data.
4. **Ambient market layer** — unmodeled traders move small aggregate volumes where surplus, shortage, margin, distance, and risk make sense.
5. **Political/security layer** — faction influence, fronts, pirate pressure, and captain actions alter route risk and market conditions over time.

Explicit routes still matter because ambient trade is intentionally capped. It can soften shortages and make markets feel alive, but it cannot fill every deficit, create guaranteed supply, provide player income, or replace dedicated player/captain logistics.

## Gate physics and energy economy

Ordinary gate feasibility uses an effective-span model:

- raw Euclidean distance between site coordinates;
- average and peak metric shear sampled along the path;
- comparison against the 6.0-grid-unit vacuum-span budget.

Dense, complex, or hostile central regions increase effective cost. Sparse space permits links closer to the best-case span. Gates are designed for short packetized transit events, not permanent high-throughput utility transmission.

A gate opening uses a source-side bulk pulse, a smaller destination-side anchor/capture pulse, and local stored jump-opening inventory at the source side. This preserves logistics gameplay: deep relay chains must be stocked materially with Pulse Canisters, Heavy Pulse Modules, accumulators, or tender support.

## Save migration

Saves are versioned. Current migration normalizes missing sparse-world fields, converts legacy adjacency into first-class jump-gate corridor endpoints, converts old route objects into player-owned explicit trade routes, renames old ship transit timing to corridor transit timing, and normalizes missing captain economy and ambient trade fields. Migration is designed to be idempotent.

## Status and roadmap

### Recently added

- Guilds, faction asks, intel selling, and reputation tabs.
- Entanglements: persistent captain relationships, romance arcs, and daily decay/event generation.
- Data cargo: private payloads, public market snapshots, ambient snapshot propagation, and secure courier contracts.
- Communications screen exposing intel, data-cargo snapshots, and freshness telemetry.
- Spreadsheet/ledger screen with formula evaluation.
- Companies and people: named mission issuers seeded into the world at generation.
- Polities: regional governance structures layered over faction influence.
- World-tick orchestration split into daily and hourly phases with registered hooks.
- World events log for persistent narrative tracking.
- Character sheet, chargen presets, trait hooks, and starting platform choices.
- Sparse-world save migration and persistence normalization.
- Interactive map polish: hover tooltips, zoom/pan viewport transforms, parallax starfield, and recentering.
- 21-file test suite covering all major systems.

### In progress

- Making the event layer more consistent across travel, captains, factions, missions, colonies, economy, combat, and threat systems.
- Deepening entanglement consequences and captain-relationship gameplay.
- Improving first-run onboarding and system discoverability.
- Continuing responsive UI passes for tablet and phone-sized screens.

### Next priorities

- Screenshot or short GIF for the README.
- Deeper contributor docs in `docs/` for world model, gate physics, economy, and save format.
- More authored map, chargen, and notification feedback.
- Bounty board once the contraband/legality heat surface is proven.

## Running it

There is no build step. Open `index.html` in a browser to play the prototype.

To run the pinned Vite dev server on port 3000:

```bash
npm run dev
```

## Running the tests

Tests run with Node.js 18+ and do not require browser DOM stubs. The suite covers simulation, persistence, navigation, routes, chargen, ambient trade, captains, contraband, data cargo, entanglements, secure courier, world tick, worldgen gate economy, global registries, time, and map projection:

```bash
npm test
```

## Linting

```bash
npm run lint
```

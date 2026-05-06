# Star-Trading

Star-Trading is a browser-based space trading and frontier-economy simulation structured as ES modules loaded from `index.html`.

## Terminology glossary

- **Jump Gate**: a sector-local infrastructure endpoint. Ships use local gates; ships are not independently FTL-capable.
- **Corridor**: the FTL link created when two jump gates in different sectors are paired.
- **Trade Route**: an explicit commercial plan operated by the player or a modeled captain. A route uses the corridor network but is not the network itself.
- **Ambient Trade**: capped aggregate background flows representing unmodeled traders. Ambient trade responds to shortages, surplus, distance, risk, and margin, but it does not create route objects or fully solve the economy.

## Project structure

```
index.html          # Shell: HTML and <script type="module" src="js/main.js">
style.css           # Canonical stylesheet (linked from index.html via <link rel="stylesheet">)
package.json        # type:module + npm scripts (test, dev, lint) and pinned dev tooling
.eslintrc.json      # ESLint config (ES2022, browser + node envs)
js/
  main.js           # Entry point: App.init()/dispose(), daily/hourly tick hooks, EventBus wiring
  state.js          # createInitialState()/resetState() plus shared runtime state, route ids, ambient trade summary
  events.js         # Pure EventBus (no browser APIs; on() returns an unsubscribe fn)
  constants.js      # Game constants: BALANCE, ambient trade caps, captain route behavior, factions, commodities
  utils.js          # Pure helpers: formatCredits, escapeHtml, log, seededRng, etc.
  core/
    factions.js     # Faction reputation, heat, trust, leverage, guild tiers
    influence.js    # Sector influence spread, dominance, status labels
    navigation.js   # Jump-gate corridor topology, shortest paths, connectivity, corridor risk helpers
    persistence.js  # save / load, migrateSave (current SAVE_VERSION), storage/UI adapters, legacy save migration
    time.js         # advanceTime, spendTime, daily/hourly hook registry, clearDailyHooks/clearHourlyHooks
    universe.js     # Map generation, jump-gate/corridor generation, sector/port/planet factories, createPlayer
    worldEvents.js  # World event log (addWorldEvent)
  systems/
    ambientTrade.js # Aggregate background market movement; no explicit route objects
    captains.js     # NPC captain AI, differentiated economy capability, route evaluation, daily/hourly actions, history
    colonies.js     # Colony production, buildings, policy, shortages
    combat.js       # Pirate encounters, fighter mechanics
    guilds.js       # Faction asks, intel selling, guild join/promote
    market.js       # Trade commodity logic, price calculation
    mining.js       # Asteroid mining, sector survey
    missions.js     # Mission generation, accept, complete, expiry
    politics.js     # Sector politics, faction expansion through corridor neighbors, front operations
    tradeRoutes.js  # Explicit modeled trade routes, route ownership, run scheduling, captain escort support
    travel.js       # moveTo via direct jump corridors, travel incidents, restUntilMorning
  ui/
    renderer.js     # Renderer (dirty-tracking RAF scheduler) + updateUI() — only file using requestAnimationFrame
    ui.js           # Action registry, screen routing, Renderer registrations
    notifications.js
    renderCaptains.js
    renderColony.js
    renderHUD.js
    renderLogistics.js # Distinguishes corridor infrastructure, explicit routes, captain routes, and ambient trade
    renderMap.js       # Renders the jump-gate corridor network
    renderMarket.js
    renderMissions.js
    renderReputation.js
    renderSector.js    # Shows local jump corridors separately from active trade routes
    renderShipyard.js
  new/              # Stub modules for planned features
    bounties.js
    contraband.js
    intel.js
tests/
  navigation.test.js     # Jump gates, corridors, shortest paths, distance, disconnected sectors
  ambientTrade.test.js   # Capped background flows under supply/demand, distance, risk, connectivity
  captainEconomy.test.js # Eligible/ineligible captain route behavior and risk response
  time.test.js           # advanceTime, hook firing, canSpendTime, spendTime
  tradeRoutes.test.js    # explicit route pathing, normaliseTradeRoutes, cost, profit
  persistence.test.js    # migrateSave versioned steps, legacy adjacency/timing/route ownership migration
  simulation.test.js     # seededRng determinism, generateUniverse, 10-day sim invariants
  missions.test.js       # expireMissions logic
```

## Current simulation model

The game now treats the economy as layered systems rather than one blended route graph:

1. **Infrastructure layer** — sectors contain first-class jump gate endpoints, and paired gates form corridors.
2. **Explicit actor layer** — the player and eligible modeled captains can operate standing trade routes over the corridor network.
3. **Ambient market layer** — unmodeled traders move small aggregate volumes where surplus, shortage, margin, distance, and risk make sense.
4. **Political/security layer** — faction influence, fronts, pirate pressure, and captain actions alter route risk and market conditions over time.

Explicit routes still matter because ambient trade is intentionally capped. It can soften shortages and make markets feel alive, but it cannot fill every deficit, create guaranteed supply, provide player income, or replace dedicated player/captain logistics.

## Captain economy behavior

Captains retain differentiated archetypes. Trader-like captains may open and operate explicit routes when a route has acceptable margin, supply, distance, and risk. Default eligible route operators include traders, industrialists, miners for ore-focused flows, colonists for support flows, and smugglers for quiet/illicit-leaning flows. Mercenaries, pirates, and pure fixers do not become generic merchants by default.

Captain-owned routes use the same explicit route object family as player routes and can affect stock, risk, reliability, and owner profit. Captains periodically evaluate route openings and pause bad routes that become disconnected, too risky, starved, or persistently unreliable.

## Daily simulation loop

The daily world tick is intentionally named by economic layer:

1. colony production / generation
2. explicit trade route runs
3. ambient trade response
4. colony needs and shortages
5. port market updates
6. sector threat updates
7. faction politics
8. mission expiry
9. captain daily strategy updates
10. daily world-event summary

This ordering keeps modeled logistics distinct from background market pressure and from market repricing/security effects.

## Save migration

Saves are versioned. Current migration keeps old saves loading by converting legacy sector adjacency into first-class jump-gate corridor endpoints, converting old route objects into player-owned explicit trade routes, renaming old ship transit timing to corridor transit timing, and normalizing missing captain economy and ambient trade fields. Migration is designed to be idempotent.

## What the app contains right now

The current document plays like a substantial solo space-trader sandbox. It includes:

- a generated 30-sector map with jump gates, corridors, ports, planets, asteroid belts, pirate pressure, and regional influence
- manual player actions for gate travel, surveying, trading, mining, piracy response, ship repair, upgrades, and guild progression
- colony founding and colony management with buildings, stockpiles, policies, growth, shortages, and faction alignment
- missions for delivery, mining, survey, colony, and faction-driven political asks
- explicit trade routes that can move goods, support colonies, earn profit, and hire named captains as escorts
- capped ambient trade that moves aggregate background goods without creating route objects
- a reputation and intelligence layer covering major factions, guilds, individual contacts, heat, trust, leverage, favors, and sellable intel
- autonomous NPC captains with archetypes, goals, relationships, histories, differentiated economy capabilities, and their own effect on the world simulation
- world news, notifications, priority alerts, save/load through localStorage, and a debug view for advancing the simulation

## What it seems meant to become

This is evolving into a deeper single-player frontier simulation where:

- trading is only one part of play, alongside logistics, colonization, politics, intelligence, and relationship management
- factions and guilds compete for control of sectors, ports, colonies, and corridor-adjacent influence
- named captains create a living world that changes even when the player is not directly involved
- the core fantasy is building influence across a contested frontier, not just buying low and selling high

In short, the project looks aimed at becoming a systemic "political economy in space" game: part trader, part colony manager, part convoy planner, and part faction operator.

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

Lint coverage includes both `js/**/*.js` and `tests/**/*.js`.

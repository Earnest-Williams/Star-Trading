# Star-Trading

Star-Trading is a browser-based space trading game structured as a set of ES modules loaded from `index.html`.

## Project structure

```
index.html          # Shell: HTML and <script type="module" src="js/main.js">
style.css           # Canonical stylesheet (linked from index.html via <link rel="stylesheet">)
package.json        # type:module + npm scripts (test, dev, lint) and pinned dev tooling
.eslintrc.json      # ESLint config (ES2022, browser + node envs)
js/
  main.js           # Entry point: App.init()/dispose(), daily/hourly tick hooks, EventBus wiring
  state.js          # createInitialState()/resetState() plus the shared runtime state object
  events.js         # Pure EventBus (no browser APIs; on() returns an unsubscribe fn)
  constants.js      # All game constants: BALANCE, FACTIONS, COMMODITIES, DEFAULT_FACTION_RELATIONS, etc.
  utils.js          # Pure helpers: formatCredits, escapeHtml, log, seededRng, etc.
  core/
    factions.js     # Faction reputation, heat, trust, leverage, guild tiers
    influence.js    # Sector influence spread, dominance, status labels
    persistence.js  # save / load, migrateSave (current SAVE_VERSION = 10), storage/UI adapters
    time.js         # advanceTime, spendTime, daily/hourly hook registry, clearDailyHooks/clearHourlyHooks
    universe.js     # Map generation, sector/port/planet factories, createPlayer (canonical), initRng
    worldEvents.js  # World event log (addWorldEvent)
  systems/
    captains.js     # NPC captain AI, daily/hourly actions, history
    colonies.js     # Colony production, buildings, policy, shortages
    combat.js       # Pirate encounters, fighter mechanics
    guilds.js       # Faction asks, intel selling, guild join/promote
    market.js       # Trade commodity logic, price calculation
    mining.js       # Asteroid mining, sector survey
    missions.js     # Mission generation, accept, complete, expiry
    politics.js     # Sector politics, faction expansion, front operations
    tradeRoutes.js  # Logistics routes, captain assignment, daily processing
    travel.js       # moveTo, travel incidents, restUntilMorning
  ui/
    renderer.js     # Renderer (dirty-tracking RAF scheduler) + updateUI() — only file using requestAnimationFrame
    ui.js           # Action registry, screen routing, Renderer registrations
    notifications.js
    renderCaptains.js
    renderColony.js
    renderHUD.js
    renderLogistics.js
    renderMap.js
    renderMarket.js
    renderMissions.js
    renderReputation.js
    renderSector.js
    renderShipyard.js
  new/              # Stub modules for planned features
    bounties.js
    contraband.js
    intel.js
tests/
  time.test.js        # advanceTime, hook firing, canSpendTime, spendTime
  tradeRoutes.test.js # findShortestPath, normaliseTradeRoutes, cost, profit
  persistence.test.js # migrateSave versioned steps (through v10)
  simulation.test.js  # seededRng determinism, generateUniverse, 10-day sim invariants
  missions.test.js    # expireMissions logic
```

## What the app contains right now

The current document already plays like a substantial solo space-trader sandbox. It includes:

- a generated 30-sector map with warp links, ports, planets, asteroid belts, pirate pressure, and regional influence
- manual player actions for travel, surveying, trading, mining, piracy response, ship repair, upgrades, and guild progression
- colony founding and colony management with buildings, stockpiles, policies, growth, shortages, and faction alignment
- missions for delivery, mining, survey, colony, and faction-driven political asks
- persistent logistics routes that can move goods, support colonies, earn profit, and hire named captains as escorts
- a reputation and intelligence layer covering major factions, guilds, individual contacts, heat, trust, leverage, favors, and sellable intel
- autonomous NPC captains with archetypes, goals, relationships, histories, and their own effect on the world simulation
- world news, notifications, priority alerts, save/load through localStorage, and a debug view for advancing the simulation

## What it seems meant to become

This no longer reads like a minimal trade toy. It appears to be evolving into a deeper single-player frontier simulation where:

- trading is only one part of play, alongside logistics, colonization, politics, intelligence, and relationship management
- factions and guilds compete for control of sectors, ports, colonies, and supply lanes
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

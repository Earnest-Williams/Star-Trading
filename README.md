# Star-Trading

Star-Trading is a browser-based space trading game structured as a set of ES modules loaded from `index.html`.

## Project structure

```
index.html          # Shell: HTML, CSS, and <script type="module" src="js/main.js">
style.css           # Extracted stylesheet (referenced from index.html)
js/
  main.js           # Entry point: startGame, daily/hourly tick hooks, EventBus wiring
  state.js          # Single shared mutable state object
  events.js         # EventBus, Renderer (dirty-tracking RAF scheduler), updateUI()
  constants.js      # All game constants: BALANCE, FACTIONS, COMMODITIES, etc.
  utils.js          # Pure helpers: formatCredits, escapeHtml, log, etc.
  core/
    factions.js     # Faction reputation, heat, trust, leverage, guild tiers
    influence.js    # Sector influence spread, dominance, status labels
    persistence.js  # localStorage save / load
    time.js         # advanceTime, spendTime, daily/hourly hook registry
    universe.js     # Map generation, sector/port/planet factories, createPlayer
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

In short, the project looks aimed at becoming a systemic “political economy in space” game: part trader, part colony manager, part convoy planner, and part faction operator.

## Running it

There is no build step at the moment. Open `index.html` in a browser to play the prototype.

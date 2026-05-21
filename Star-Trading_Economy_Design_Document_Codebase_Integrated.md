# Star-Trading Economy Design Document
_Last updated: 2026-05-21_

**Status:** updated codebase-aligned design spec; Phases 1–9 complete  
**Date:** 2026-05-20  
**Target repository:** `Earnest-Williams/Star-Trading`  
**Primary goal:** evolve the current commodity, market, company, route, ambient-trade, and mission systems into a legible frontier supply-chain economy without turning the game into a heavyweight macroeconomic simulator.

---

## 1. Purpose

This document defines the target design and implementation plan for the Star-Trading economy. It extends the existing design around commodity-based trade, finished goods, local consumption, production chains, company seeding, contracts, explicit routes, and ambient trade.

The economy should make each economically active place feel materially grounded. A settlement, station, way station, refinery, asteroid camp, colony, shipyard, hidden front, or industrial hub should have readable inputs, outputs, stock pressure, and consequences. Trade should not be generic arbitrage between interchangeable price tables. It should emerge from local extraction, local consumption, processing capacity, finished-good demand, company operations, route access, gate-energy constraints, corridor risk, faction interests, and player or captain logistics.

The implementation should preserve the current game feel: fast daily ticks, readable prices, bounded volatility, and enough abstraction that the economy runs on a wide range of PCs.

---

## 2. Core Design Thesis

Star-Trading should model a **frontier supply-chain economy**.

The player should make money by understanding and exploiting material asymmetry:

- raw resource clusters need extraction support and export routes;
- refineries need feedstock and produce intermediate goods;
- industrial sites need processed inputs and produce finished goods;
- populated places consume staples and finished goods even when they produce nothing;
- stations and way stations consume maintenance and pulse logistics goods even if they produce little or nothing;
- companies appear where economic capacity justifies them;
- shortages generate route value, contracts, political leverage, and local consequences;
- ambient trade can soften shortages, but it should not erase the need for explicit logistics;
- prices should be grounded in supply, demand, stock coverage, route risk, and local bargaining conditions rather than arbitrary tables.

The key real-world economics influences are deliberately modest:

- **stocks and flows:** inventory levels, daily consumption, daily production, imports, exports;
- **input-output production:** raw goods become processed goods, processed goods become finished goods;
- **capacity utilization:** output falls when inputs are missing;
- **inventory coverage:** low days-of-supply creates price pressure and contracts;
- **transport frictions:** distance, risk, and gate reserve strain matter;
- **bounded price elasticity:** prices respond to shortage or surplus, but within gameable limits.

This is not a macroeconomic model. There is no need to simulate wages, households, credit markets, inflation, interest rates, or individual civilian invoices.

---

## 3. Non-Goals

The economy should not attempt to simulate every civilian ship, worker, household, invoice, or merchant decision. Aggregate stocks, capacities, companies, route flows, and pressure signals are enough.

The economy should not require solving large optimization problems every tick. Avoid global equilibrium solvers, agent swarms, and exhaustive all-pairs commodity routing. The simulation should be deterministic, incremental, and cache-friendly.

The economy should not hide all truth behind opaque formulas. The player should be able to answer:

- What does this place consume?
- What does it produce?
- Why is this good expensive here?
- Which nearby places might supply it?
- Why did this company or contract appear?
- Why did ambient trade not solve the shortage?

---

## 4. Current Codebase Foundation

The current repository already has many of the foundations required for this design. The economy update should connect and refine these systems rather than replace them wholesale.

### 4.1 Existing commodity and market foundation

Current commodity data is centralized mostly in `js/constants.js` and `js/config/worldgen.js`:

- `RAW_COMMODITIES`
- `PROCESSED_COMMODITIES`
- `MANUFACTURED_COMMODITIES`
- `PULSE_COMMODITIES`
- `MARKET_COMMODITIES`
- `COMMODITY_NAMES`
- `PORT_TYPES`
- `PORT_DEFAULTS.MAX_STOCK`
- `PORT_DEFAULTS.BASE_PRICES`

This is a strong start. The next step is a structured commodity registry that derives these compatibility exports rather than keeping definitions split across constants and worldgen defaults.

### 4.2 Existing world generation foundation

World generation currently creates sparse sites, corridors, anchor roles, ports, planets, resources, asteroid fields, station pulse reserves, economic connectivity, polities, companies, and people.

The key insertion point is `generateUniverse()` in `js/core/universe/implementation.js`.

Current generation sequence, simplified:

```text
1. Create sparse sites.
2. Assign anchors and visibility.
3. Build corridors.
4. Seed ports, planets, asteroids, and station reserves.
5. Ensure economic activity connectivity.
6. Assign sector polities.
7. Seed companies and people.
```

The economy update should insert economic profile generation after resources are seeded and before companies are seeded.

Target sequence:

```text
1. Create sparse sites.
2. Assign anchors and visibility.
3. Build corridors.
4. Seed ports, planets, asteroids, and station reserves.
5. Ensure economic activity connectivity.
6. Build economic profiles.
7. Compute extraction clusters and processing/manufacturing biases.
8. Assign sector polities.
9. Seed companies and people from profiles.
10. Seed initial economy pressure.
11. Generate initial economy contracts and route opportunities.
```

### 4.3 Existing daily simulation foundation

`js/core/worldTick.js` already provides a daily and hourly phase scheduler. Current daily phases include colony production, explicit trade route runs, ambient trade, colony needs, port markets, factions, missions, captains, entanglements, and logistics objectives.

This should become the home for explicit economy phases. The scheduler already maps an `economy` write domain to the economy UI/state slice, so the economy can be added without inventing a new orchestration layer.

### 4.4 Existing market and trade foundation

Current spot trade is split across:

- `js/systems/market.js`
- `js/systems/marketTrade.js`
- `js/ui/renderMarket.js`

`market.js` currently owns spot price calculation. `marketTrade.js` owns validation and state mutation. The target design should make `market.js` a player-facing facade and move price truth into `js/systems/economy/pricing.js`.

### 4.5 Existing explicit route foundation

Current explicit routes are in `js/systems/tradeRoutes/implementation.js`. This module already has:

- route hydration and ownership;
- real corridor metrics;
- route setup cost;
- route risk;
- route execution;
- captain routes;
- starved route behavior;
- route success/failure events;
- estimated route profit.

This is the right owner for route scheduling and route reliability. It should call economy services for price, availability, pressure, and stock movement.

### 4.6 Existing ambient trade foundation

`js/systems/ambientTrade.js` already moves aggregate background goods from surplus nodes to shortage nodes, capped by distance, risk, maximum fill share, and export share.

This should become a thin wrapper around `js/systems/economy/ambientFlows.js`, using pressure records instead of raw stock-ratio heuristics.

### 4.7 Existing company foundation

`js/config/companies.js` already defines company archetypes, production profiles, raw-good origins, and value-added chains.

`js/systems/companies.js` currently seeds companies from active economic sectors, ports, asteroids, hidden fronts, ship-refitter rules, and dockyard rules.

The update should preserve company archetypes but make the counts and placement depend on economic profiles, extraction capacity, local demand, and route position.

### 4.8 Existing mission foundation

`js/systems/missions.js` currently generates delivery missions from port sell/buy lists and random destination selection. This should remain for legacy/simple mission generation, but economy contracts should be added as a more causal layer driven by pressure records and company needs.

### 4.9 Existing UI foundation

`js/ui/renderMarket.js` currently shows commodity stock and prices.

`js/ui/renderLogistics.js` currently shows explicit route creation, route estimates, active routes, ambient flow count, logistics objectives, and colony needs.

These should be extended to explain the economy: target stock, daily consumption, daily production, shortage cause, ambient contribution, likely suppliers, open contracts, and data confidence.

---

## 5. Target Economy Layers

The target economy has ten layers.

1. Commodity registry.
2. Economic node adapters.
3. Economic site profiles.
4. Baseline and role-based consumption.
5. Extraction, processing, manufacturing, and pulse production.
6. Market pressure and unified pricing.
7. Company and facility seeding.
8. Spot trade, explicit routes, and ambient flows.
9. Contracts, missions, market intelligence, and UI explanations.
10. Persistence, migration, tests, and performance budgets.

Each layer should have a clear owner module and a clear state shape.

---

## 6. Module Plan

Add these modules. Keep existing modules as facades or integration points.

```text
js/config/economy/commodities.js
js/config/economy/economyBalance.js
js/config/economy/industries.js
js/config/economy/nodeRoles.js

js/systems/economy/index.js
js/systems/economy/nodes.js
js/systems/economy/profiles.js
js/systems/economy/extraction.js
js/systems/economy/production.js
js/systems/economy/consumption.js
js/systems/economy/pressure.js
js/systems/economy/pricing.js
js/systems/economy/contracts.js
js/systems/economy/ambientFlows.js
js/systems/economy/companyScoring.js
js/systems/economy/summary.js
js/systems/economy/migration.js
```

Do not move every economy-related concern at once. Use compatibility exports and adapters so existing imports keep working while the new system is introduced.

---

## 7. New Top-Level State

Add an `economy` field to `createInitialState()` in `js/state.js`.

```js
export function createInitialEconomyState() {
    return {
        version: 1,
        profilesBySector: {},
        pressureBySector: {},
        recentVolumeBySector: {},
        contracts: [],
        nextContractId: 1,
        dailySummary: null,
        lastProfileBuildDay: null,
        lastPressureDay: null,
        generatedByVersion: 1
    };
}
```

Then in `createInitialState()`:

```js
import { createInitialEconomyState } from './systems/economy/migration.js';

export function createInitialState() {
    return {
        // existing fields...
        economy: createInitialEconomyState(),
        marketRevision: 0,
        logisticsNodeRevision: 0,
        // existing fields...
    };
}
```

If `state.economy` is persisted, add it to `SAVE_STATE_FIELDS` in `js/core/saveSchema.js` and default it in `js/core/saveMigrations/index.js`.

```js
function ensureDefaults(data) {
    // existing defaults...
    if (!data.economy || typeof data.economy !== 'object') {
        data.economy = createInitialEconomyState();
    }
}
```

If a full save migration is needed, bump `SAVE_VERSION` and add `v20.js`. If the economy can be safely derived from existing world state, it can be added through load normalization without invalidating old saves.

Recommended first implementation: persist `contracts`, `recentVolumeBySector`, and summary state, but allow `profilesBySector` and `pressureBySector` to be rebuilt idempotently when missing.

---

## 8. Commodity Registry

### 8.1 Goal

Current commodity arrays and names are good but split across constants and worldgen defaults. The economy should define commodities once, then derive arrays and lookup tables.

Suggested module:

```text
js/config/economy/commodities.js
```

### 8.2 Registry shape

```js
export const COMMODITY_DEFS = Object.freeze({
    ore: Object.freeze({
        id: 'ore',
        name: 'Common Ore',
        category: 'raw',
        tier: 1,
        bulk: 1,
        basePrice: 80,
        strategicTags: ['mining', 'feedstock'],
        inputs: {},
        primarySources: ['asteroids', 'mining_contractor', 'mining_port'],
        primaryConsumers: ['refinery_operator', 'industrial_supplier', 'construction'],
        substitutionGroup: 'bulk_feedstock',
        volatility: 0.10,
        decayRate: 0,
        shortageSeverity: 0.55,
        finishedGood: false
    }),

    refined_metals: Object.freeze({
        id: 'refined_metals',
        name: 'Refined Metals',
        category: 'processed',
        tier: 2,
        bulk: 1,
        basePrice: 190,
        strategicTags: ['industry', 'construction'],
        inputs: { ore: 1.2, heavy_metals: 0.35 },
        primarySources: ['refinery_operator', 'refinery_port'],
        primaryConsumers: ['industrial_supplier', 'dockyard', 'ship_refitter'],
        substitutionGroup: 'industrial_feedstock',
        volatility: 0.15,
        decayRate: 0,
        shortageSeverity: 0.85,
        finishedGood: false
    }),

    repair_parts: Object.freeze({
        id: 'repair_parts',
        name: 'Repair Parts',
        category: 'manufactured',
        tier: 3,
        bulk: 1,
        basePrice: 360,
        strategicTags: ['maintenance', 'station', 'route_reliability'],
        inputs: { refined_metals: 0.7, electronics: 0.25 },
        primarySources: ['industrial_supplier', 'ship_refitter'],
        primaryConsumers: ['station', 'way_station', 'mining_contractor', 'colony', 'route_maintenance'],
        substitutionGroup: 'maintenance_goods',
        volatility: 0.22,
        decayRate: 0,
        shortageSeverity: 1.20,
        finishedGood: true
    }),

    pulse_canister: Object.freeze({
        id: 'pulse_canister',
        name: 'Pulse Canisters',
        category: 'pulse',
        tier: 3,
        bulk: 1,
        basePrice: 7,
        strategicTags: ['gate', 'station_reserve', 'deep_route'],
        inputs: { coolants: 0.1, control_cores: 0.02 },
        primarySources: ['industrial_supplier', 'refinery_operator', 'stardock'],
        primaryConsumers: ['way_station', 'station', 'mining_contractor', 'route_support'],
        substitutionGroup: 'gate_energy',
        volatility: 0.30,
        decayRate: 0,
        shortageSeverity: 1.35,
        finishedGood: true
    })
});

export const MARKET_COMMODITIES = Object.freeze(Object.keys(COMMODITY_DEFS));
export const RAW_COMMODITIES = Object.freeze(MARKET_COMMODITIES.filter(id => COMMODITY_DEFS[id].category === 'raw'));
export const PROCESSED_COMMODITIES = Object.freeze(MARKET_COMMODITIES.filter(id => COMMODITY_DEFS[id].category === 'processed'));
export const MANUFACTURED_COMMODITIES = Object.freeze(MARKET_COMMODITIES.filter(id => COMMODITY_DEFS[id].category === 'manufactured'));
export const PULSE_COMMODITIES = Object.freeze(MARKET_COMMODITIES.filter(id => COMMODITY_DEFS[id].category === 'pulse'));
export const COMMODITY_NAMES = Object.freeze(Object.fromEntries(MARKET_COMMODITIES.map(id => [id, COMMODITY_DEFS[id].name])));
export const BASE_PRICES = Object.freeze(Object.fromEntries(MARKET_COMMODITIES.map(id => [id, COMMODITY_DEFS[id].basePrice])));

export function getCommodityDef(id) {
    return COMMODITY_DEFS[id] || null;
}

export function getCommodityIdsByCategory(category) {
    return MARKET_COMMODITIES.filter(id => COMMODITY_DEFS[id].category === category);
}
```

### 8.3 Compatibility plan

In `js/constants.js`, replace hard-coded commodity arrays with derived exports when the migration is safe:

```js
export {
    RAW_COMMODITIES,
    PROCESSED_COMMODITIES,
    MANUFACTURED_COMMODITIES,
    PULSE_COMMODITIES,
    MARKET_COMMODITIES,
    COMMODITY_NAMES
} from './config/economy/commodities.js';
```

Keep the legacy `COMMODITIES = ['ore', 'org', 'eq']` for colony compatibility until colonies are migrated to the fuller economy model.

---

## 9. Economy Balance Knobs

Create a dedicated balance module rather than burying new values in the large global `BALANCE` object all at once.

Suggested module:

```text
js/config/economy/economyBalance.js
```

```js
export const ECONOMY_BALANCE = Object.freeze({
    PROFILE_VERSION: 1,

    CONSUMPTION_SCALE: 1.0,
    PRODUCTION_SCALE: 1.0,
    EXTRACTION_SCALE: 0.012,
    PROCESSING_SCALE: 1.0,
    MANUFACTURING_SCALE: 1.0,

    MAX_DAILY_STOCK_SWING_SHARE: 0.08,
    MIN_TARGET_STOCK_DAYS: 8,
    TARGET_STOCK_DAYS: 22,
    STRATEGIC_RESERVE_DAYS: 35,

    SHORTAGE_PRICE_MULTIPLIER: 0.85,
    SURPLUS_PRICE_DISCOUNT: 0.35,
    UNMET_DEMAND_PRICE_MULTIPLIER: 0.12,
    ROUTE_ISOLATION_PRICE_MULTIPLIER: 0.06,
    RISK_PRICE_MULTIPLIER: 0.035,
    PRICE_MIN_MULTIPLIER: 0.45,
    PRICE_MAX_MULTIPLIER: 3.25,
    PRICE_SMOOTHING_RECENT_VOLUME_DIVISOR: 120,

    AMBIENT_MAX_FILL_SHARE: 0.24,
    AMBIENT_MAX_EXPORT_SHARE: 0.16,
    AMBIENT_MAX_SEARCH_DISTANCE: 5,
    AMBIENT_MIN_MARGIN: 10,
    AMBIENT_MAX_FLOWS_PER_COMMODITY: 24,

    CONTRACT_GENERATION_THRESHOLD: 0.35,
    CONTRACT_MAX_ACTIVE_PER_SECTOR: 3,
    CONTRACT_MAX_ACTIVE_GLOBAL: 48,
    CONTRACT_REWARD_MULTIPLIER: 1.15,
    CONTRACT_URGENCY_BONUS: 0.35,

    FINISHED_GOOD_SHORTAGE_SEVERITY: 1.15,
    PULSE_SHORTAGE_SEVERITY: 1.35,

    PERFORMANCE: Object.freeze({
        TARGET_DAILY_ECONOMY_MS_240_SITES: 8,
        TARGET_DAILY_ECONOMY_MS_720_SITES: 24,
        PROFILE_REBUILD_INTERVAL_DAYS: 5,
        MAX_PRESSURE_RECORDS_PER_TICK: 20_000
    })
});
```

Then import this into `js/constants.js` only if a global `BALANCE.ECONOMY` export is preferred:

```js
import { ECONOMY_BALANCE } from './config/economy/economyBalance.js';

export const BALANCE = {
    // existing groups...
    ECONOMY: ECONOMY_BALANCE
};
```

---

## 10. Economic Node Adapters

The economy should not directly care whether a stockpile lives in a port, player colony, station, or future facility. Use adapters.

Suggested module:

```text
js/systems/economy/nodes.js
```

```js
import { state } from '../../state.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';
import { getPortType } from '../../core/ports.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { makeStock } from '../../utils.js';

export function getEconomyNode(sectorId) {
    const site = state.universe?.[sectorId];
    const port = state.ports?.[sectorId];
    const planet = state.planets?.[sectorId];

    if (port) {
        const type = getPortType(port);
        return {
            sectorId,
            kind: 'port',
            site,
            owner: port,
            factionId: port.factionId || type.factionId,
            stock: port.stock,
            maxStock: port.maxStock,
            basePrices: port.basePrices || PORT_DEFAULTS.BASE_PRICES,
            sells: type.sells.slice(),
            buys: type.buys.slice(),
            role: port.typeKey || 'consumer'
        };
    }

    if (planet?.owner === 'Player') {
        return {
            sectorId,
            kind: 'colony',
            site,
            owner: planet,
            factionId: planet.factionId || 'colonists',
            stock: planet.stock,
            maxStock: makeStock(PORT_DEFAULTS.MAX_STOCK),
            basePrices: PORT_DEFAULTS.BASE_PRICES,
            sells: MARKET_COMMODITIES.slice(),
            buys: MARKET_COMMODITIES.slice(),
            role: 'colony'
        };
    }

    if (site?.station || site?.siteType === 'way_station') {
        return {
            sectorId,
            kind: 'station',
            site,
            owner: site.station || site,
            factionId: null,
            stock: port?.stock || makeStock(),
            maxStock: port?.maxStock || makeStock(PORT_DEFAULTS.MAX_STOCK),
            basePrices: port?.basePrices || PORT_DEFAULTS.BASE_PRICES,
            sells: [],
            buys: ['water_ice', 'org', 'repair_parts', 'electronics', 'pulse_canister', 'heavy_pulse_module', 'control_cores'],
            role: 'way_station'
        };
    }

    return null;
}

export function getAllEconomyNodes() {
    return Object.keys(state.universe || {})
        .map(Number)
        .map(getEconomyNode)
        .filter(Boolean)
        .sort((a, b) => a.sectorId - b.sectorId);
}
```

This can initially mirror `getLogisticsNode()` in `tradeRoutes`, then later become the canonical source that route systems call.

---

## 11. Economic Site Profiles

Every economically active or populated site should have an economic profile.

Suggested state shape:

```js
{
    siteId: 42,
    generatedByVersion: 1,
    populationTier: 2,
    settlementRole: 'mining',
    activityTags: ['asteroids', 'port:mining', 'frontier'],
    extraction: { ore: 18, heavy_metals: 5, rare_earths: 1, water_ice: 4 },
    production: { refined_metals: 0 },
    baselineConsumption: { water_ice: 5, org: 4, repair_parts: 0.5 },
    industrialConsumption: { machinery: 0.8, coolants: 0.5 },
    serviceConsumption: { pulse_canister: 0.2 },
    targetStock: { ore: 900, repair_parts: 50 },
    strategicReserve: { pulse_canister: 12 },
    companyCapacity: { mining_contractor: 1.4, haulage: 0.3 },
    facilityBias: { refinery_operator: 0.7, industrial_supplier: 0.2 },
    marketPressure: {},
    routeDependence: {},
    explain: ['Asteroid extraction creates ore exports and maintenance demand.']
}
```

A profile should be generated for every sector with any of the following:

- port;
- planet;
- player colony;
- asteroids;
- way station or station reserve;
- shipyard or StarDock role;
- company;
- polity capital or major local authority;
- hidden faction front;
- special authored economic role.

Some profiles may have zero production. A way station can consume many goods while producing nothing.

### 11.1 Population tiers

Population is deliberately abstract.

```text
0: unpopulated or automated
1: outpost
2: station crew or small settlement
3: town / port settlement
4: major settlement
5: hub / capital / StarDock-class center
```

Suggested baseline consumption:

```js
export const POPULATION_CONSUMPTION_BY_TIER = Object.freeze({
    0: Object.freeze({}),
    1: Object.freeze({ water_ice: 2, org: 2, repair_parts: 0.2, medical_supplies: 0.1, pulse_canister: 0.1 }),
    2: Object.freeze({ water_ice: 5, org: 4, repair_parts: 0.5, medical_supplies: 0.25, pulse_canister: 0.2 }),
    3: Object.freeze({ water_ice: 12, org: 10, repair_parts: 1.2, medical_supplies: 0.7, pulse_canister: 0.5, electronics: 0.3 }),
    4: Object.freeze({ water_ice: 28, org: 24, repair_parts: 3, medical_supplies: 1.8, pulse_canister: 1.2, electronics: 0.9, eq: 0.8 }),
    5: Object.freeze({ water_ice: 60, org: 52, repair_parts: 7, medical_supplies: 4, pulse_canister: 3, electronics: 2.5, eq: 2, construction_kits: 1 })
});
```

These values are intentionally small relative to stock caps. They create long-run pressure without draining markets instantly.

### 11.2 Profile builder snippet

Suggested module:

```text
js/systems/economy/profiles.js
```

```js
import { state } from '../../state.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';
import { getPortType } from '../../core/ports.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { makeStock } from '../../utils.js';
import { ECONOMY_BALANCE } from '../../config/economy/economyBalance.js';
import { POPULATION_CONSUMPTION_BY_TIER, ROLE_CONSUMPTION } from '../../config/economy/nodeRoles.js';
import { getAsteroidExtractionPotential } from './extraction.js';

function addScaled(target, source, scale = 1) {
    Object.entries(source || {}).forEach(([commodity, amount]) => {
        target[commodity] = (target[commodity] || 0) + amount * scale;
    });
}

function inferPopulationTier(sectorId) {
    const site = state.universe?.[sectorId];
    const port = state.ports?.[sectorId];
    const planet = state.planets?.[sectorId];

    if (state.world?.roles?.homeSiteId === sectorId) return 5;
    if (port?.typeKey === 'stardock') return 5;
    if (port?.typeKey === 'consumer') return 4;
    if (planet?.owner === 'Player') {
        if ((planet.colonists || 0) >= 1000) return 4;
        if ((planet.colonists || 0) >= 350) return 3;
        return 2;
    }
    if (site?.station || site?.siteType === 'way_station') return 2;
    if (port) return 2;
    if (site?.asteroids) return 1;
    return 0;
}

function inferSettlementRole(sectorId) {
    const port = state.ports?.[sectorId];
    const site = state.universe?.[sectorId];
    if (port?.typeKey) return port.typeKey;
    if (site?.siteType === 'way_station') return 'way_station';
    if (site?.asteroids) return 'asteroid_camp';
    if (state.planets?.[sectorId]) return 'planet';
    return 'unprofiled';
}

export function buildEconomicProfileForSector(sectorId) {
    const site = state.universe?.[sectorId];
    if (!site) return null;

    const port = state.ports?.[sectorId] || null;
    const planet = state.planets?.[sectorId] || null;
    const companyIds = state.companyIdsBySector?.[sectorId] || [];
    const populationTier = inferPopulationTier(sectorId);
    const settlementRole = inferSettlementRole(sectorId);
    const activityTags = [];

    if (port) activityTags.push(`port:${port.typeKey || 'unknown'}`);
    if (planet) activityTags.push(`planet:${planet.typeKey || 'unknown'}`);
    if (site.asteroids) activityTags.push('asteroids');
    if (site.station || site.siteType === 'way_station') activityTags.push('station');
    if (site.front || port?.hiddenFactionId) activityTags.push('hidden_front');

    const baselineConsumption = makeStock();
    const industrialConsumption = makeStock();
    const serviceConsumption = makeStock();
    const production = makeStock();
    const targetStock = makeStock();
    const strategicReserve = makeStock();
    const extraction = getAsteroidExtractionPotential(site);

    addScaled(baselineConsumption, POPULATION_CONSUMPTION_BY_TIER[populationTier], ECONOMY_BALANCE.CONSUMPTION_SCALE);
    addScaled(industrialConsumption, ROLE_CONSUMPTION[settlementRole]?.industrial, ECONOMY_BALANCE.CONSUMPTION_SCALE);
    addScaled(serviceConsumption, ROLE_CONSUMPTION[settlementRole]?.service, ECONOMY_BALANCE.CONSUMPTION_SCALE);

    const portType = port ? getPortType(port) : null;
    MARKET_COMMODITIES.forEach(commodity => {
        const dailyNeed = (baselineConsumption[commodity] || 0)
            + (industrialConsumption[commodity] || 0)
            + (serviceConsumption[commodity] || 0);
        const dailyOutput = (production[commodity] || 0) + (extraction[commodity] || 0);
        const roleTarget = portType?.buys?.includes(commodity) ? 1.35 : portType?.sells?.includes(commodity) ? 0.85 : 1.0;
        const dailyBasis = Math.max(1, dailyNeed + dailyOutput * 0.4);
        targetStock[commodity] = Math.min(
            PORT_DEFAULTS.MAX_STOCK[commodity] || 1,
            Math.ceil(dailyBasis * ECONOMY_BALANCE.TARGET_STOCK_DAYS * roleTarget)
        );
    });

    if (site.station || site.siteType === 'way_station') {
        strategicReserve.pulse_canister = 20 + populationTier * 4;
        strategicReserve.heavy_pulse_module = 4 + populationTier;
    }

    return {
        siteId: sectorId,
        generatedByVersion: ECONOMY_BALANCE.PROFILE_VERSION,
        populationTier,
        settlementRole,
        activityTags,
        extraction,
        production,
        baselineConsumption,
        industrialConsumption,
        serviceConsumption,
        targetStock,
        strategicReserve,
        companyCapacity: {},
        facilityBias: {},
        marketPressure: {},
        routeDependence: {},
        explain: buildProfileExplanation({ sectorId, settlementRole, activityTags, companyIds })
    };
}

export function rebuildEconomicProfiles() {
    if (!state.economy) return { changedSlices: [], eventCount: 0, warnings: ['missing_economy_state'] };
    const profilesBySector = {};
    Object.keys(state.universe || {}).map(Number).forEach(sectorId => {
        const hasActivity = state.ports?.[sectorId]
            || state.planets?.[sectorId]
            || state.universe?.[sectorId]?.asteroids
            || state.universe?.[sectorId]?.station
            || state.companyIdsBySector?.[sectorId]?.length > 0;
        if (!hasActivity) return;
        const profile = buildEconomicProfileForSector(sectorId);
        if (profile) profilesBySector[sectorId] = profile;
    });
    state.economy.profilesBySector = profilesBySector;
    state.economy.lastProfileBuildDay = state.player?.time?.day ?? 0;
    return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
}
```

---

## 12. Extraction Model

Extraction is raw output from asteroids, planets, or special sites.

Raw extraction outputs:

```text
ore
heavy_metals
rare_earths
water_ice
org
```

Asteroids should mostly produce ore, heavy metals, rare earths, and water ice. Habitable or agricultural planets can produce biomass. The first implementation can focus on asteroid extraction and let colonies keep their current production rules.

### 12.1 Extraction capacity snippet

```js
import { makeStock } from '../../utils.js';
import { ECONOMY_BALANCE } from '../../config/economy/economyBalance.js';

export function getAsteroidExtractionCapacity(site) {
    if (!site?.asteroids) return 0;
    const reserve = Math.max(0, site.asteroids.maxOre || site.asteroids.ore || 0);
    const richness = Math.max(0.1, site.asteroids.richness || 1);
    const hazard = Math.max(0, site.asteroids.hazard || 0);
    const hazardMultiplier = Math.max(0.35, 1 - hazard);
    return Math.round(reserve * richness * hazardMultiplier);
}

export function getAsteroidExtractionPotential(site) {
    const capacity = getAsteroidExtractionCapacity(site);
    const dailyBase = Math.floor(capacity * ECONOMY_BALANCE.EXTRACTION_SCALE);
    if (dailyBase <= 0) return makeStock();

    const richness = Math.max(0.1, site.asteroids?.richness || 1);
    const badlands = site.region === 'Badlands';

    return makeStock({
        ore: Math.max(1, Math.floor(dailyBase * 0.70)),
        heavy_metals: Math.floor(dailyBase * (0.18 + Math.min(0.06, richness * 0.02))),
        rare_earths: Math.floor(dailyBase * (badlands ? 0.06 : 0.035)),
        water_ice: Math.floor(dailyBase * (site.siteType === 'brown_dwarf_system' ? 0.12 : 0.06))
    });
}

export function describeExtractionBand(capacity) {
    if (capacity <= 0) return 'none';
    if (capacity < 1_000) return 'trickle';
    if (capacity < 5_000) return 'small extractor';
    if (capacity < 12_000) return 'substantial camp';
    return 'major field';
}
```

### 12.2 Extraction support goods

Mining sites and mining contractors should consume:

```text
machinery
repair_parts
coolants
medical_supplies
pulse_canister
eq
```

This creates a natural economic loop: extraction creates raw exports and finished-good import pressure.

---

## 13. Consumption Model

Consumption should run before production each day so shortages have consequences. It should mutate stock and accumulate unmet demand into pressure records.

Suggested module:

```text
js/systems/economy/consumption.js
```

### 13.1 Role consumption config

```js
export const ROLE_CONSUMPTION = Object.freeze({
    mining: Object.freeze({
        industrial: Object.freeze({ machinery: 0.9, repair_parts: 0.8, coolants: 0.6, eq: 0.4 }),
        service: Object.freeze({ medical_supplies: 0.25, pulse_canister: 0.25 })
    }),
    refinery: Object.freeze({
        industrial: Object.freeze({ ore: 8, heavy_metals: 2.5, water_ice: 2, org: 1, rare_earths: 0.4, control_cores: 0.1 }),
        service: Object.freeze({ repair_parts: 0.5, coolants: 0.8 })
    }),
    industrial: Object.freeze({
        industrial: Object.freeze({ refined_metals: 5, polymers: 3, rare_earths: 1, coolants: 1.4, heavy_metals: 1.5, org: 0.8 }),
        service: Object.freeze({ repair_parts: 0.5, pulse_canister: 0.3 })
    }),
    consumer: Object.freeze({
        industrial: Object.freeze({}),
        service: Object.freeze({ electronics: 1.2, medical_supplies: 1.5, construction_kits: 0.8, repair_parts: 1.2, pulse_canister: 0.6 })
    }),
    stardock: Object.freeze({
        industrial: Object.freeze({ refined_metals: 6, heavy_metals: 3, rare_earths: 1.5, polymers: 3, electronics: 2, control_cores: 1.2, machinery: 2 }),
        service: Object.freeze({ repair_parts: 3, pulse_canister: 1.8, heavy_pulse_module: 0.5, gate_coils: 0.2 })
    }),
    way_station: Object.freeze({
        industrial: Object.freeze({}),
        service: Object.freeze({ water_ice: 2, org: 1.5, repair_parts: 0.7, electronics: 0.3, pulse_canister: 0.8, heavy_pulse_module: 0.15, control_cores: 0.06 })
    })
});
```

### 13.2 Consumption execution snippet

```js
import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { getEconomyNode } from './nodes.js';
import { makeStock } from '../../utils.js';

function getProfileDailyDemand(profile, commodity) {
    return (profile.baselineConsumption?.[commodity] || 0)
        + (profile.industrialConsumption?.[commodity] || 0)
        + (profile.serviceConsumption?.[commodity] || 0);
}

export function applyDailyConsumptionForSector(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId];
    const node = getEconomyNode(sectorId);
    if (!profile || !node?.stock) return null;

    const consumed = makeStock();
    const unmetDemand = makeStock();

    MARKET_COMMODITIES.forEach(commodity => {
        const demand = getProfileDailyDemand(profile, commodity);
        if (demand <= 0) return;

        const wholeDemand = Math.floor(demand);
        const fractional = demand - wholeDemand;
        const requested = wholeDemand + (fractional > 0 && Math.random() < fractional ? 1 : 0);
        if (requested <= 0) return;

        const available = Math.max(0, node.stock[commodity] || 0);
        const used = Math.min(available, requested);
        node.stock[commodity] = available - used;
        consumed[commodity] = used;
        unmetDemand[commodity] = Math.max(0, requested - used);
    });

    return { sectorId, consumed, unmetDemand };
}

export function runDailyEconomyConsumption() {
    const daily = {
        consumed: makeStock(),
        unmetDemand: makeStock(),
        sectorsWithShortage: 0
    };

    Object.keys(state.economy?.profilesBySector || {}).map(Number).forEach(sectorId => {
        const result = applyDailyConsumptionForSector(sectorId);
        if (!result) return;
        let sectorHadShortage = false;
        MARKET_COMMODITIES.forEach(commodity => {
            daily.consumed[commodity] += result.consumed[commodity] || 0;
            daily.unmetDemand[commodity] += result.unmetDemand[commodity] || 0;
            if ((result.unmetDemand[commodity] || 0) > 0) sectorHadShortage = true;
        });
        if (sectorHadShortage) daily.sectorsWithShortage += 1;
    });

    state.economy.dailySummary = {
        ...(state.economy.dailySummary || {}),
        day: state.player.time.day,
        consumption: daily
    };

    return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
}
```

Use the project’s deterministic RNG instead of `Math.random()` once fractional consumption needs to be reproducible in tests.

---

## 14. Production Model

Production should be aggregate and daily. It should not simulate every worker or machine. Actual output is constrained by available inputs, capacity, and local condition.

A production result should be explainable:

```js
{
    commodity: 'refined_metals',
    potential: 18,
    actual: 12,
    limitingInputs: { ore: 6 },
    efficiency: 0.67,
    reason: 'ore shortage'
}
```

### 14.1 Recipe config

Suggested module:

```text
js/config/economy/industries.js
```

```js
export const PRODUCTION_RECIPES = Object.freeze({
    refined_metals: Object.freeze({
        role: 'refinery',
        inputs: Object.freeze({ ore: 1.2, heavy_metals: 0.35 }),
        output: 1,
        baseCapacity: 18
    }),
    polymers: Object.freeze({
        role: 'refinery',
        inputs: Object.freeze({ org: 0.8, water_ice: 0.7 }),
        output: 1,
        baseCapacity: 10
    }),
    coolants: Object.freeze({
        role: 'refinery',
        inputs: Object.freeze({ water_ice: 0.8, rare_earths: 0.15 }),
        output: 1,
        baseCapacity: 8
    }),
    machinery: Object.freeze({
        role: 'industrial',
        inputs: Object.freeze({ refined_metals: 0.8, polymers: 0.35 }),
        output: 1,
        baseCapacity: 8
    }),
    repair_parts: Object.freeze({
        role: 'industrial',
        inputs: Object.freeze({ refined_metals: 0.45, electronics: 0.12 }),
        output: 1,
        baseCapacity: 10
    }),
    electronics: Object.freeze({
        role: 'industrial',
        inputs: Object.freeze({ rare_earths: 0.25, polymers: 0.35, coolants: 0.2 }),
        output: 1,
        baseCapacity: 6
    }),
    control_cores: Object.freeze({
        role: 'industrial',
        inputs: Object.freeze({ electronics: 0.4, rare_earths: 0.25, coolants: 0.25 }),
        output: 1,
        baseCapacity: 4
    }),
    pulse_canister: Object.freeze({
        role: 'industrial',
        inputs: Object.freeze({ coolants: 0.12, control_cores: 0.02 }),
        output: 1,
        baseCapacity: 12
    }),
    heavy_pulse_module: Object.freeze({
        role: 'stardock',
        inputs: Object.freeze({ pulse_canister: 3, control_cores: 0.25, refined_metals: 0.5 }),
        output: 1,
        baseCapacity: 3
    }),
    gate_coils: Object.freeze({
        role: 'stardock',
        inputs: Object.freeze({ heavy_metals: 1.5, rare_earths: 0.8, refined_metals: 2, control_cores: 0.5 }),
        output: 1,
        baseCapacity: 2
    })
});
```

### 14.2 Production execution snippet

```js
import { state } from '../../state.js';
import { PRODUCTION_RECIPES } from '../../config/economy/industries.js';
import { getEconomyNode } from './nodes.js';
import { makeStock } from '../../utils.js';

function getRoleCapacityMultiplier(profile, recipe) {
    if (!profile) return 0;
    if (profile.settlementRole === recipe.role) return 1;
    if (recipe.role === 'industrial' && profile.settlementRole === 'stardock') return 0.75;
    if (recipe.role === 'refinery' && profile.settlementRole === 'way_station') return 0.25;
    return 0;
}

export function runProductionRecipe(node, profile, commodity, recipe) {
    const roleMultiplier = getRoleCapacityMultiplier(profile, recipe);
    const potential = Math.floor(recipe.baseCapacity * roleMultiplier);
    if (potential <= 0) return null;

    let efficiency = 1;
    const limitingInputs = {};

    Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
        const required = potential * amountPerUnit;
        const available = Math.max(0, node.stock[input] || 0);
        const inputEfficiency = required <= 0 ? 1 : Math.min(1, available / required);
        if (inputEfficiency < efficiency) efficiency = inputEfficiency;
        if (inputEfficiency < 1) limitingInputs[input] = Math.ceil(required - available);
    });

    const actual = Math.floor(potential * efficiency);
    if (actual <= 0) {
        return { commodity, potential, actual: 0, limitingInputs, efficiency: 0, reason: 'input shortage' };
    }

    Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
        node.stock[input] = Math.max(0, (node.stock[input] || 0) - Math.ceil(actual * amountPerUnit));
    });

    const maxStock = Math.max(1, node.maxStock[commodity] || 1);
    const freeCapacity = Math.max(0, maxStock - (node.stock[commodity] || 0));
    const stored = Math.min(freeCapacity, Math.ceil(actual * recipe.output));
    node.stock[commodity] = (node.stock[commodity] || 0) + stored;

    return {
        commodity,
        potential,
        actual: stored,
        limitingInputs,
        efficiency,
        reason: Object.keys(limitingInputs).length > 0 ? 'input constrained' : 'normal'
    };
}

export function runDailyEconomyProduction() {
    const summary = { produced: makeStock(), constrained: [] };

    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorIdText, profile]) => {
        const sectorId = Number(sectorIdText);
        const node = getEconomyNode(sectorId);
        if (!node?.stock) return;

        Object.entries(profile.extraction || {}).forEach(([commodity, amount]) => {
            const maxStock = node.maxStock[commodity] || 1;
            const availableCapacity = Math.max(0, maxStock - (node.stock[commodity] || 0));
            const stored = Math.min(availableCapacity, Math.floor(amount));
            node.stock[commodity] = (node.stock[commodity] || 0) + stored;
            summary.produced[commodity] += stored;
        });

        Object.entries(PRODUCTION_RECIPES).forEach(([commodity, recipe]) => {
            const result = runProductionRecipe(node, profile, commodity, recipe);
            if (!result) return;
            summary.produced[commodity] += result.actual;
            if (result.efficiency < 1) summary.constrained.push({ sectorId, ...result });
        });
    });

    state.economy.dailySummary = {
        ...(state.economy.dailySummary || {}),
        day: state.player.time.day,
        production: summary
    };

    return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
}
```

---

## 15. Market Pressure

Pressure records are the shared truth used by spot trade, route valuation, ambient trade, contracts, and UI explanations.

Suggested shape:

```js
marketPressure: {
    repair_parts: {
        targetStock: 240,
        currentStock: 92,
        dailyConsumption: 7.2,
        dailyProduction: 0,
        unmetDemand: 5,
        surplus: 0,
        shortageSeverity: 0.62,
        pricePressure: 0.48,
        routeAccess: 'connected',
        primaryCause: 'station maintenance and mining contractors',
        lastUpdatedDay: 18
    }
}
```

### 15.1 Pressure computation snippet

Suggested module:

```text
js/systems/economy/pressure.js
```

```js
import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { getCommodityDef } from '../../config/economy/commodities.js';
import { ECONOMY_BALANCE } from '../../config/economy/economyBalance.js';
import { getEconomyNode } from './nodes.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function dailyConsumption(profile, commodity) {
    return (profile.baselineConsumption?.[commodity] || 0)
        + (profile.industrialConsumption?.[commodity] || 0)
        + (profile.serviceConsumption?.[commodity] || 0);
}

function dailyProduction(profile, commodity) {
    return (profile.extraction?.[commodity] || 0)
        + (profile.production?.[commodity] || 0);
}

function explainPressure(profile, commodity, record) {
    if (record.unmetDemand > 0) return `${commodity} demand is not fully met.`;
    if (record.shortageSeverity > 0.45 && dailyConsumption(profile, commodity) > 0) return `${commodity} stock is below target and local demand is persistent.`;
    if (record.surplus > 0) return `${commodity} stock is above local target; export pressure is likely.`;
    return `${commodity} is near local target.`;
}

export function computePressureForSector(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId];
    const node = getEconomyNode(sectorId);
    if (!profile || !node?.stock) return null;

    const pressure = {};
    MARKET_COMMODITIES.forEach(commodity => {
        const def = getCommodityDef(commodity) || { shortageSeverity: 1, volatility: 0.15 };
        const targetStock = Math.max(1, profile.targetStock?.[commodity] || node.maxStock?.[commodity] * 0.45 || 1);
        const currentStock = Math.max(0, node.stock?.[commodity] || 0);
        const consume = dailyConsumption(profile, commodity);
        const produce = dailyProduction(profile, commodity);
        const unmetDemand = Math.max(0, state.economy?.dailySummary?.consumption?.unmetDemand?.[commodity] || 0);
        const shortageRatio = clamp((targetStock - currentStock) / targetStock, 0, 1.5);
        const surplusRatio = clamp((currentStock - targetStock) / targetStock, 0, 2);
        const shortageSeverity = clamp(shortageRatio * (def.shortageSeverity || 1), 0, 2.5);
        const surplus = Math.max(0, Math.floor(currentStock - targetStock));
        const pricePressure = clamp(
            shortageSeverity * ECONOMY_BALANCE.SHORTAGE_PRICE_MULTIPLIER
                + Math.min(0.8, unmetDemand * ECONOMY_BALANCE.UNMET_DEMAND_PRICE_MULTIPLIER)
                - surplusRatio * ECONOMY_BALANCE.SURPLUS_PRICE_DISCOUNT,
            -0.65,
            1.75
        );

        const record = {
            targetStock,
            currentStock,
            dailyConsumption: consume,
            dailyProduction: produce,
            unmetDemand,
            surplus,
            shortageSeverity,
            pricePressure,
            routeAccess: 'unknown',
            lastUpdatedDay: state.player?.time?.day || 0
        };
        record.primaryCause = explainPressure(profile, commodity, record);
        pressure[commodity] = record;
    });

    return pressure;
}

export function recomputeAllMarketPressure() {
    const pressureBySector = {};
    Object.keys(state.economy?.profilesBySector || {}).map(Number).forEach(sectorId => {
        const pressure = computePressureForSector(sectorId);
        if (pressure) pressureBySector[sectorId] = pressure;
    });
    state.economy.pressureBySector = pressureBySector;
    state.economy.lastPressureDay = state.player?.time?.day || 0;
    return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
}

export function getMarketSignal(sectorId, commodity) {
    return state.economy?.pressureBySector?.[sectorId]?.[commodity] || null;
}
```

---

## 16. Unified Pricing

Prices should be generated by one service used by manual trade, route valuation, ambient trade, and contracts.

Suggested module:

```text
js/systems/economy/pricing.js
```

### 16.1 Formula

```text
price = basePrice
  * stockPressureMultiplier
  * netDemandMultiplier
  * routeIsolationMultiplier
  * riskMultiplier
  * gateReserveMultiplier
  * factionTermsMultiplier
  * recentVolumeSmoothing
```

Keep each multiplier bounded. The player should see a strong price signal, not runaway prices.

### 16.2 Pricing code snippet

```js
import { BALANCE } from '../../constants.js';
import { getFactionPriceMultiplier } from '../../core/factions.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';
import { ECONOMY_BALANCE } from '../../config/economy/economyBalance.js';
import { getEconomyNode } from './nodes.js';
import { getMarketSignal } from './pressure.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getBasePrice(node, commodity) {
    return node?.basePrices?.[commodity]
        || PORT_DEFAULTS.BASE_PRICES[commodity]
        || BALANCE.MIN_TRADE_PRICE;
}

function getRecentVolumeMultiplier(sectorId, commodity, mode) {
    const volume = Number(globalThis.state?.economy?.recentVolumeBySector?.[sectorId]?.[commodity]?.[mode] || 0);
    if (!Number.isFinite(volume) || volume <= 0) return 1;
    const effect = Math.min(0.18, volume / ECONOMY_BALANCE.PRICE_SMOOTHING_RECENT_VOLUME_DIVISOR);
    return mode === 'buy' ? 1 + effect : 1 - effect * 0.5;
}

export function getSpotPriceForSector(sectorId, commodity, mode, actorContext = {}) {
    const node = getEconomyNode(sectorId);
    if (!node) return BALANCE.MIN_TRADE_PRICE;

    const signal = getMarketSignal(sectorId, commodity);
    const stock = Math.max(0, node.stock?.[commodity] || 0);
    const maxStock = Math.max(1, node.maxStock?.[commodity] || 1);
    const stockRatio = clamp(stock / maxStock, 0, 1);
    const base = getBasePrice(node, commodity);

    const legacyStockPressure = mode === 'buy'
        ? BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER + (1 - stockRatio) * BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER
        : BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER + (1 - stockRatio) * BALANCE.MARKET.SELL_PRICE_SCARCITY_MULTIPLIER;

    const pressureMultiplier = signal
        ? 1 + (mode === 'buy' ? signal.pricePressure * 0.65 : signal.pricePressure)
        : legacyStockPressure;

    const factionMultiplier = node.kind === 'port'
        ? getFactionPriceMultiplier(node.owner, mode)
        : 1;

    const recentVolumeMultiplier = getRecentVolumeMultiplier(sectorId, commodity, mode);

    const totalMultiplier = clamp(
        pressureMultiplier * factionMultiplier * recentVolumeMultiplier,
        ECONOMY_BALANCE.PRICE_MIN_MULTIPLIER,
        ECONOMY_BALANCE.PRICE_MAX_MULTIPLIER
    );

    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * totalMultiplier));
}

export function getExpectedRouteValue(originSector, destinationSector, commodity, amount, routeContext = {}) {
    const buyPrice = getSpotPriceForSector(originSector, commodity, 'buy', routeContext);
    const sellPrice = getSpotPriceForSector(destinationSector, commodity, 'sell', routeContext);
    const grossSpread = sellPrice - buyPrice;
    const riskCost = Math.max(0, routeContext.risk || 0) * ECONOMY_BALANCE.RISK_PRICE_MULTIPLIER * amount * buyPrice;
    const expectedProfit = Math.max(
        BALANCE.TRADE_ROUTE.PROFIT_FLOOR,
        Math.floor(grossSpread * amount * BALANCE.TRADE_ROUTE.PROFIT_MULTIPLIER - riskCost)
    );

    return {
        commodity,
        amount,
        buyPrice,
        sellPrice,
        grossSpread,
        riskCost,
        expectedProfit
    };
}
```

Do not use `globalThis.state` in production code. The example above shows why a local import is preferred. Production implementation should import `state` directly.

### 16.3 Market integration

Update `js/systems/market.js`:

```js
import { state } from '../state.js';
import { getSpotPriceForSector } from './economy/pricing.js';

export function getPortPriceForSector(sectorId, commodity, mode) {
    return getSpotPriceForSector(sectorId, commodity, mode, { actorType: 'player', player: state.player });
}

export function getPortPrice(port, commodity, mode) {
    // Legacy compatibility for call sites that only pass the port object.
    const sectorEntry = Object.entries(state.ports).find(([, candidate]) => candidate === port);
    const sectorId = sectorEntry ? Number(sectorEntry[0]) : state.player?.currentSector;
    return getPortPriceForSector(sectorId, commodity, mode);
}
```

Long term, prefer `getPortPriceForSector(sectorId, commodity, mode)` so the pricing service can read local pressure without scanning `state.ports`.

### 16.4 Trade-route integration

Update `js/systems/tradeRoutes/implementation.js`:

```js
import { getSpotPriceForSector, getExpectedRouteValue } from '../economy/pricing.js';

export function getRouteMarketValue(sectorId, commodity, mode) {
    return getSpotPriceForSector(sectorId, commodity, mode, { actorType: 'route' });
}

export function estimateRouteProfit(originSector, destinationSector, commodity, amount = BALANCE.TRADE_ROUTE_BASE_AMOUNT) {
    const metrics = deriveRouteMetrics(originSector, destinationSector);
    const quote = getExpectedRouteValue(originSector, destinationSector, commodity, amount, {
        actorType: 'route',
        risk: metrics.risk || 0,
        hopCount: metrics.hopCount || 0
    });
    return quote.expectedProfit;
}
```

---

## 17. Stock Mutation and Recent Volume

Whenever stock moves, the economy should learn from it. This gives prices memory and helps UI explain why opportunities fade.

Suggested module:

```text
js/systems/economy/mutations.js
```

```js
import { state } from '../../state.js';
import { bumpMarketRevision, bumpLogisticsNodeRevision } from '../../core/state/mutations.js';

export function recordEconomyVolume({ sectorId, commodity, mode, amount, source }) {
    if (!state.economy) return;
    const sectorVolumes = state.economy.recentVolumeBySector[sectorId] || (state.economy.recentVolumeBySector[sectorId] = {});
    const commodityVolumes = sectorVolumes[commodity] || (sectorVolumes[commodity] = { buy: 0, sell: 0, import: 0, export: 0 });
    commodityVolumes[mode] = (commodityVolumes[mode] || 0) + Math.max(0, Number(amount) || 0);
    commodityVolumes.lastSource = source || null;
    commodityVolumes.lastDay = state.player?.time?.day || 0;
}

export function decayRecentEconomyVolume() {
    Object.values(state.economy?.recentVolumeBySector || {}).forEach(sectorVolumes => {
        Object.values(sectorVolumes).forEach(record => {
            ['buy', 'sell', 'import', 'export'].forEach(key => {
                record[key] = Math.floor((record[key] || 0) * 0.72);
            });
        });
    });
}

export function markEconomyMarketChanged() {
    bumpMarketRevision();
    bumpLogisticsNodeRevision();
}
```

Update `applyTradeStateMutation()` in `js/systems/marketTrade.js`:

```js
import { recordEconomyVolume, markEconomyMarketChanged } from './economy/mutations.js';

export function applyTradeStateMutation(context, amount) {
    // existing mutation...
    recordEconomyVolume({
        sectorId: context.player.currentSector,
        commodity: context.commodity,
        mode: context.mode,
        amount,
        source: 'spot_trade'
    });
    markEconomyMarketChanged();
}
```

For route imports/exports, call `recordEconomyVolume()` at both endpoints:

```js
recordEconomyVolume({ sectorId: route.originSector, commodity: route.commodity, mode: 'export', amount, source: 'trade_route' });
recordEconomyVolume({ sectorId: route.destinationSector, commodity: route.commodity, mode: 'import', amount, source: 'trade_route' });
```

---

## 18. Company Seeding From Capacity

Companies should be seeded from economic capacity, not only from port type or site anchor.

### 18.1 Company mapping

```text
mining_contractor:
  appears from raw extraction capacity;
  consumes machinery, repair parts, coolants, medical supplies, pulse canisters;
  outputs raw goods.

agri_collective:
  appears from biomass, farming, habitable planets, agricultural ports;
  consumes machinery, water ice, coolants, polymers, equipment;
  outputs biomass, fertilizer, medical supplies.

refinery_operator:
  appears near raw extraction clusters or refinery ports;
  consumes raw goods;
  outputs processed goods and selected pulse goods.

industrial_supplier:
  appears near processed-good supply and industrial ports;
  consumes refined metals, polymers, rare earths, coolants, heavy metals;
  outputs equipment, machinery, repair parts, electronics, construction kits, control cores, pulse canisters.

ship_refitter:
  appears near shipyards, stations, industrial ports, and service hubs;
  consumes refined metals, polymers, coolants, electronics, control cores, machinery;
  outputs repair parts and construction kits.

dockyard:
  appears near StarDock, major stations, major industrial sites, or high-infrastructure hubs;
  consumes high-tier inputs;
  outputs construction kits, gate coils, heavy pulse modules.

haulage:
  appears where imports and exports are both high;
  creates contracts and route competition.

import_export:
  appears at hubs and ports with multi-commodity flows;
  creates market intelligence, contracts, and brokerage opportunities.

black_market_front:
  appears where hidden faction influence or local pressure supports it;
  consumes divertible goods;
  outputs off-ledger equipment, electronics, and pulse goods.
```

### 18.2 Capacity scoring snippet

Suggested module:

```text
js/systems/economy/companyScoring.js
```

```js
import { state } from '../../state.js';
import { getAsteroidExtractionCapacity } from './extraction.js';

function scoreExtraction(profile, sectorId) {
    const site = state.universe?.[sectorId];
    const capacity = getAsteroidExtractionCapacity(site);
    if (capacity >= 12_000) return 4;
    if (capacity >= 5_000) return 2.5;
    if (capacity >= 1_000) return 1.3;
    if (capacity > 0) return 0.5;
    return 0;
}

function scoreLocalDemand(profile, goods) {
    return goods.reduce((score, commodity) => {
        return score
            + (profile.baselineConsumption?.[commodity] || 0)
            + (profile.industrialConsumption?.[commodity] || 0)
            + (profile.serviceConsumption?.[commodity] || 0);
    }, 0);
}

export function scoreCompanyTypeForSector(sectorId, type) {
    const profile = state.economy?.profilesBySector?.[sectorId];
    const port = state.ports?.[sectorId];
    const site = state.universe?.[sectorId];
    if (!profile) return 0;

    switch (type) {
        case 'mining_contractor':
            return scoreExtraction(profile, sectorId) + (port?.typeKey === 'mining' ? 1 : 0);
        case 'refinery_operator':
            return (port?.typeKey === 'refinery' ? 2.5 : 0)
                + (profile.extraction?.ore || 0) / 20
                + (profile.extraction?.heavy_metals || 0) / 12;
        case 'industrial_supplier':
            return (port?.typeKey === 'industrial' ? 2.5 : 0)
                + scoreLocalDemand(profile, ['repair_parts', 'machinery', 'electronics', 'construction_kits']) / 8;
        case 'agri_collective':
            return (port?.typeKey === 'agricultural' ? 2.5 : 0)
                + (state.planets?.[sectorId]?.typeKey === 'terran' ? 0.8 : 0)
                + (state.planets?.[sectorId]?.typeKey === 'oceanic' ? 0.6 : 0);
        case 'haulage':
            return Object.values(profile.targetStock || {}).reduce((sum, value) => sum + Math.min(1, value / 1000), 0) / 8
                + ((site?.jumpGates || []).length >= 3 ? 1 : 0);
        case 'import_export':
            return port ? 1.2 + ((site?.jumpGates || []).length * 0.2) : 0;
        case 'black_market_front':
            return site?.front || port?.hiddenFactionId === 'vc' ? 3 : 0;
        case 'ship_refitter':
            return ['stardock', 'industrial', 'refinery', 'consumer'].includes(port?.typeKey) ? 0.7 : 0;
        case 'dockyard':
            return port?.typeKey === 'stardock' ? 2.8 : port?.typeKey === 'industrial' ? 0.4 : 0;
        default:
            return 0;
    }
}

export function chooseCapacityBasedCompanyTypes(sectorId, rng) {
    const candidates = [
        'black_market_front',
        'mining_contractor',
        'refinery_operator',
        'agri_collective',
        'industrial_supplier',
        'haulage',
        'import_export',
        'ship_refitter',
        'dockyard'
    ].map(type => ({ type, score: scoreCompanyTypeForSector(sectorId, type) }))
        .filter(item => item.score >= 0.45)
        .sort((a, b) => b.score - a.score);

    const chosen = [];
    candidates.forEach(item => {
        const count = item.score >= 3 ? 2 : 1;
        for (let index = 0; index < count; index++) {
            if (chosen.length < 4 && (index === 0 || rng() < 0.35)) chosen.push(item.type);
        }
    });

    return chosen.length > 0 ? chosen : ['haulage'];
}
```

### 18.3 Company seeding integration

Update `seedCompaniesAndPeople(rng)` in `js/systems/companies.js`:

```js
import { chooseCapacityBasedCompanyTypes } from './economy/companyScoring.js';

export function seedCompaniesAndPeople(rng) {
    state.companies = {};
    state.companyIdsBySector = {};
    state.nextCompanyId = 1;
    resetPeopleState();

    Object.keys(state.universe).map(Number).forEach(sectorId => {
        if (!hasEconomicActivity(sectorId)) return;
        const companyTypes = chooseCapacityBasedCompanyTypes(sectorId, rng);
        companyTypes.forEach(type => createCompany(sectorId, type, rng));
    });
}
```

Keep the current `chooseCompanyType()` as a fallback until profiles are guaranteed to exist in every generated and loaded save.

---

## 19. Processing and Facility Placement

Extraction capacity should influence processing placement locally or nearby.

The placement rule should be gravitational rather than binary.

```text
processingScore(site, good) =
  localInputCapacity * localWeight
  + nearbyInputCapacity * distanceWeight
  + routeConnectivityBonus
  + portRoleBonus
  + factionBias
  + richnessBias
  - hazardPenalty
```

### 19.1 Local versus nearby processing

- If extraction capacity is high and the extraction site has a port, local processing is plausible.
- If extraction capacity is high but the site is hazardous or sparse, processing should likely appear at a nearby connected port.
- If extraction capacity is spread across nearby sites, processing should appear at a hub or high-connectivity node.
- If extraction capacity is isolated, the market should create high-value haulage and refinery-supply contracts.

### 19.2 Processing placement snippet

```js
import { state } from '../../state.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';

function getNearbyExtractionInputScore(candidateSectorId, commodity, maxHops = 4) {
    let score = 0;
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sourceIdText, profile]) => {
        const sourceId = Number(sourceIdText);
        const output = profile.extraction?.[commodity] || 0;
        if (output <= 0) return;
        if (sourceId === candidateSectorId) {
            score += output * 1.2;
            return;
        }
        const metrics = deriveRouteMetrics(sourceId, candidateSectorId);
        if (!metrics.path || metrics.hopCount > maxHops) return;
        const distanceWeight = 1 / (1 + metrics.hopCount * 0.65 + (metrics.risk || 0) * 0.25);
        score += output * distanceWeight;
    });
    return score;
}

export function scoreProcessingPlacement(candidateSectorId, outputCommodity) {
    const port = state.ports?.[candidateSectorId];
    const site = state.universe?.[candidateSectorId];
    const profile = state.economy?.profilesBySector?.[candidateSectorId];
    if (!profile) return 0;

    const inputScore = outputCommodity === 'refined_metals'
        ? getNearbyExtractionInputScore(candidateSectorId, 'ore') + getNearbyExtractionInputScore(candidateSectorId, 'heavy_metals')
        : outputCommodity === 'coolants'
            ? getNearbyExtractionInputScore(candidateSectorId, 'water_ice') + getNearbyExtractionInputScore(candidateSectorId, 'rare_earths')
            : getNearbyExtractionInputScore(candidateSectorId, 'org') + getNearbyExtractionInputScore(candidateSectorId, 'water_ice');

    const portRoleBonus = port?.typeKey === 'refinery' ? 30 : port?.typeKey === 'industrial' ? 14 : 0;
    const connectivityBonus = Math.min(18, (site?.jumpGates || []).length * 4);
    const hazardPenalty = Math.round((site?.asteroids?.hazard || 0) * 20);

    return inputScore + portRoleBonus + connectivityBonus - hazardPenalty;
}
```

Use this score to upgrade or bias company seeding rather than forcibly rewriting generated ports in the first pass.

---

## 20. Daily Economy Tick

### 20.1 Target phase order

Recommended daily order:

```text
1. Economy profile normalization or scheduled rebuild.
2. Baseline and role consumption.
3. Company and facility consumption.
4. Extraction.
5. Processing.
6. Manufacturing and pulse production.
7. First market-pressure computation.
8. Explicit player/captain route runs.
9. Ambient trade response.
10. Residual market-pressure computation.
11. Contract generation and update.
12. Summary events and UI invalidation.
```

Existing `worldTick.js` can support this with new phases.

### 20.2 Integration snippet

```js
import {
    maybeRebuildEconomyProfilesDaily,
    runDailyEconomyConsumption,
    runDailyEconomyProduction,
    recomputeAllMarketPressure,
    generateEconomyContractsDaily,
    decayRecentEconomyVolume
} from '../systems/economy/index.js';

export const DAILY_WORLD_TICK_PHASES = Object.freeze([
    { id: 'economy_profile_normalization', cadence: 'daily', reads: ['ports', 'planets', 'companies'], writes: ['economy'], emits: [], expensive: false, run: () => maybeRebuildEconomyProfilesDaily() },
    { id: 'economy_consumption', cadence: 'daily', reads: ['economy', 'ports', 'planets'], writes: ['economy', 'ports', 'planets'], emits: [], expensive: false, run: () => runDailyEconomyConsumption() },
    { id: 'economy_production', cadence: 'daily', reads: ['economy', 'ports', 'planets'], writes: ['economy', 'ports', 'planets'], emits: [], expensive: false, run: () => runDailyEconomyProduction() },
    { id: 'economy_pressure_pre_routes', cadence: 'daily', reads: ['economy', 'ports', 'planets'], writes: ['economy'], emits: [], expensive: false, run: () => recomputeAllMarketPressure() },

    // Existing explicit route phase should remain before ambient trade.
    { id: 'explicit_trade_route_runs', cadence: 'daily', reads: ['tradeRoutes'], writes: ['tradeRoutes'], emits: ['route'], expensive: true, run: () => runTradeRoutesDaily() },

    { id: 'ambient_trade_response', cadence: 'daily', reads: ['economy', 'ports'], writes: ['economy', 'ports'], emits: ['world'], expensive: true, featureFlag: 'ambientTrade', run: () => runAmbientTradeDaily() },
    { id: 'economy_pressure_post_routes', cadence: 'daily', reads: ['economy', 'ports', 'planets'], writes: ['economy'], emits: [], expensive: false, run: () => recomputeAllMarketPressure() },
    { id: 'economy_contracts', cadence: 'daily', reads: ['economy', 'missions'], writes: ['economy', 'missions'], emits: ['world'], expensive: false, run: () => generateEconomyContractsDaily() },
    { id: 'economy_recent_volume_decay', cadence: 'daily', reads: ['economy'], writes: ['economy'], emits: [], expensive: false, run: () => decayRecentEconomyVolume() },

    // Existing phases continue here.
]);
```

During the first PR, add economy phases behind `BALANCE.WORLD_TICK.FEATURE_FLAGS.economy` or equivalent so the rollout can be controlled.

---

## 21. Ambient Trade Rewrite

Ambient trade should remain capped and subordinate to explicit logistics.

Ambient trade should:

- move goods from surplus to shortage;
- respect real route connectivity;
- be constrained by risk and distance;
- avoid filling all demand;
- leave profitable gaps;
- record what it could not satisfy.

### 21.1 Target summary

```js
{
    day: 42,
    moved: { ore: 120, org: 42, repair_parts: 18 },
    flows: 7,
    unmetDemand: { repair_parts: 30, pulse_canister: 12 },
    blockedByDistance: 3,
    blockedByRisk: 2,
    blockedByMargin: 5,
    blockedByCapacity: 4
}
```

### 21.2 Ambient flow snippet

```js
import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { makeStock } from '../../utils.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';
import { getExpectedRouteValue } from './pricing.js';
import { getAllEconomyNodes } from './nodes.js';
import { ECONOMY_BALANCE } from '../../config/economy/economyBalance.js';

function getSourceSurplus(sectorId, commodity) {
    return Math.max(0, state.economy?.pressureBySector?.[sectorId]?.[commodity]?.surplus || 0);
}

function getSinkShortage(sectorId, commodity) {
    const signal = state.economy?.pressureBySector?.[sectorId]?.[commodity];
    if (!signal) return 0;
    return Math.max(0, signal.targetStock - signal.currentStock);
}

export function runEconomyAmbientFlowsDaily() {
    const summary = {
        day: state.player.time.day,
        moved: makeStock(),
        unmetDemand: makeStock(),
        flows: 0,
        blockedByDistance: 0,
        blockedByRisk: 0,
        blockedByMargin: 0,
        blockedByCapacity: 0
    };

    const nodes = getAllEconomyNodes();

    MARKET_COMMODITIES.forEach(commodity => {
        const sources = nodes
            .map(node => ({ node, surplus: getSourceSurplus(node.sectorId, commodity) }))
            .filter(item => item.surplus > 0)
            .sort((a, b) => b.surplus - a.surplus);

        const sinks = nodes
            .map(node => ({ node, shortage: getSinkShortage(node.sectorId, commodity) }))
            .filter(item => item.shortage > 0)
            .sort((a, b) => b.shortage - a.shortage);

        let commodityFlows = 0;
        sinks.forEach(sink => {
            let fillCap = Math.floor(sink.shortage * ECONOMY_BALANCE.AMBIENT_MAX_FILL_SHARE);
            if (fillCap <= 0) return;

            sources.forEach(source => {
                if (fillCap <= 0 || source.surplus <= 0) return;
                if (commodityFlows >= ECONOMY_BALANCE.AMBIENT_MAX_FLOWS_PER_COMMODITY) return;
                if (source.node.sectorId === sink.node.sectorId) return;

                const metrics = deriveRouteMetrics(source.node.sectorId, sink.node.sectorId);
                if (!metrics.path) { summary.blockedByDistance += 1; return; }
                if (metrics.hopCount > ECONOMY_BALANCE.AMBIENT_MAX_SEARCH_DISTANCE) { summary.blockedByDistance += 1; return; }
                if ((metrics.risk || 0) > 6) { summary.blockedByRisk += 1; return; }

                const quote = getExpectedRouteValue(source.node.sectorId, sink.node.sectorId, commodity, 1, { risk: metrics.risk || 0 });
                if (quote.grossSpread < ECONOMY_BALANCE.AMBIENT_MIN_MARGIN) { summary.blockedByMargin += 1; return; }

                const exportCap = Math.floor(source.surplus * ECONOMY_BALANCE.AMBIENT_MAX_EXPORT_SHARE);
                const amount = Math.max(0, Math.min(exportCap, source.surplus, fillCap, 22));
                if (amount <= 0) { summary.blockedByCapacity += 1; return; }

                source.node.stock[commodity] = Math.max(0, (source.node.stock[commodity] || 0) - amount);
                sink.node.stock[commodity] = Math.min(sink.node.maxStock[commodity] || 9999, (sink.node.stock[commodity] || 0) + amount);
                source.surplus -= amount;
                fillCap -= amount;
                summary.moved[commodity] += amount;
                summary.flows += 1;
                commodityFlows += 1;
            });

            summary.unmetDemand[commodity] += Math.max(0, fillCap);
        });
    });

    state.ambientTrade = summary;
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), ambientTrade: summary };
    return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
}
```

`js/systems/ambientTrade.js` can then become:

```js
export { runEconomyAmbientFlowsDaily as runAmbientTradeDaily } from './economy/ambientFlows.js';
```

---

## 22. Contracts and Missions

Contracts are directed trade opportunities generated from unmet demand, surplus, faction interest, company needs, and route conditions.

Contract types:

```text
shortage_relief
industrial_feedstock
colony_supply
station_reserve
pulse_tender
shipyard_procurement
company_purchase_order
surplus_export
embargo_run
black_market_diversion
```

Each contract should state:

- who needs the good;
- why they need it;
- what commodity and amount;
- where to deliver;
- deadline;
- reward structure;
- route risk;
- faction effect;
- market consequence if fulfilled.

### 22.1 Contract state shape

```js
{
    id: 12,
    type: 'shortage_relief',
    status: 'available',
    originSector: 8,
    destinationSector: 42,
    commodity: 'repair_parts',
    amount: 30,
    issuerCompanyId: 'company-17',
    factionId: 'traders',
    reason: 'station maintenance and mining contractors are consuming repair parts faster than local supply.',
    rewardCredits: 16800,
    rewardRep: 2,
    createdDay: 31,
    expiresDay: 36,
    pressureSnapshot: {
        shortageSeverity: 0.72,
        unmetDemand: 6,
        currentStock: 92,
        targetStock: 240
    },
    marketConsequence: {
        pressureReliefCommodity: 'repair_parts',
        pressureReliefAmount: 30
    }
}
```

### 22.2 Contract generation snippet

Suggested module:

```text
js/systems/economy/contracts.js
```

```js
import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../constants.js';
import { formatCommodity } from '../../utils.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';
import { ECONOMY_BALANCE } from '../../config/economy/economyBalance.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';

function countActiveContractsForSector(sectorId) {
    return (state.economy?.contracts || []).filter(contract =>
        contract.destinationSector === sectorId
        && ['available', 'accepted'].includes(contract.status)
    ).length;
}

function hasSimilarContract(sectorId, commodity, type) {
    return (state.economy?.contracts || []).some(contract =>
        contract.destinationSector === sectorId
        && contract.commodity === commodity
        && contract.type === type
        && ['available', 'accepted'].includes(contract.status)
    );
}

function estimateContractReward(destinationSector, commodity, amount, signal) {
    const basePrice = PORT_DEFAULTS.BASE_PRICES[commodity] || BALANCE.MIN_TRADE_PRICE;
    const urgency = Math.min(1, signal.shortageSeverity || 0);
    const risk = Math.max(0, state.universe?.[destinationSector]?.pirateThreat || 0);
    return Math.round(
        basePrice * amount
        * ECONOMY_BALANCE.CONTRACT_REWARD_MULTIPLIER
        * (1 + urgency * ECONOMY_BALANCE.CONTRACT_URGENCY_BONUS + risk * 0.06)
    );
}

function chooseContractType(profile, commodity) {
    if (profile.settlementRole === 'way_station' && ['pulse_canister', 'heavy_pulse_module', 'control_cores', 'repair_parts'].includes(commodity)) return 'station_reserve';
    if (profile.settlementRole === 'stardock' && ['gate_coils', 'heavy_pulse_module', 'control_cores', 'construction_kits'].includes(commodity)) return 'shipyard_procurement';
    if (['refined_metals', 'polymers', 'coolants', 'rare_earths', 'heavy_metals'].includes(commodity)) return 'industrial_feedstock';
    if (['water_ice', 'org', 'medical_supplies'].includes(commodity)) return 'colony_supply';
    return 'shortage_relief';
}

function createContractFromPressure(sectorId, commodity, signal, profile) {
    const type = chooseContractType(profile, commodity);
    const amount = Math.max(10, Math.min(80, Math.ceil((signal.targetStock - signal.currentStock) * 0.25)));
    const rewardCredits = estimateContractReward(sectorId, commodity, amount, signal);

    return {
        id: state.economy.nextContractId++,
        type,
        status: 'available',
        originSector: sectorId,
        destinationSector: sectorId,
        commodity,
        amount,
        issuerCompanyId: (state.companyIdsBySector?.[sectorId] || [null])[0],
        factionId: state.ports?.[sectorId]?.factionId || state.planets?.[sectorId]?.factionId || 'traders',
        reason: signal.primaryCause || `${formatCommodity(commodity)} is below target stock.`,
        rewardCredits,
        rewardRep: signal.shortageSeverity >= 0.75 ? 2 : 1,
        createdDay: state.player.time.day,
        expiresDay: state.player.time.day + (signal.shortageSeverity >= 0.75 ? 4 : 7),
        pressureSnapshot: {
            shortageSeverity: signal.shortageSeverity,
            unmetDemand: signal.unmetDemand,
            currentStock: signal.currentStock,
            targetStock: signal.targetStock
        },
        marketConsequence: {
            pressureReliefCommodity: commodity,
            pressureReliefAmount: amount
        }
    };
}

export function generateEconomyContractsDaily() {
    if (!state.economy) return { changedSlices: [], eventCount: 0, warnings: ['missing_economy_state'] };

    state.economy.contracts.forEach(contract => {
        if (['available', 'accepted'].includes(contract.status) && contract.expiresDay < state.player.time.day) {
            contract.status = 'expired';
        }
    });

    const activeGlobal = state.economy.contracts.filter(contract => ['available', 'accepted'].includes(contract.status)).length;
    if (activeGlobal >= ECONOMY_BALANCE.CONTRACT_MAX_ACTIVE_GLOBAL) {
        return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
    }

    Object.entries(state.economy.pressureBySector || {}).forEach(([sectorIdText, pressure]) => {
        const sectorId = Number(sectorIdText);
        if (countActiveContractsForSector(sectorId) >= ECONOMY_BALANCE.CONTRACT_MAX_ACTIVE_PER_SECTOR) return;
        const profile = state.economy.profilesBySector?.[sectorId];
        if (!profile) return;

        MARKET_COMMODITIES.forEach(commodity => {
            const signal = pressure[commodity];
            if (!signal || signal.shortageSeverity < ECONOMY_BALANCE.CONTRACT_GENERATION_THRESHOLD) return;
            const type = chooseContractType(profile, commodity);
            if (hasSimilarContract(sectorId, commodity, type)) return;
            state.economy.contracts.push(createContractFromPressure(sectorId, commodity, signal, profile));
        });
    });

    return { changedSlices: ['economy'], eventCount: 0, warnings: [] };
}
```

### 22.3 Missions integration

Do not immediately replace `makeDeliveryMission()`. Add economy contracts as a parallel board first, then gradually let `missions.js` draw delivery missions from economy pressure.

Recommended migration path:

1. Add contract board UI inside market/logistics screens.
2. Allow accepting and completing economy contracts separately from legacy missions.
3. Add a bridge that wraps high-value economy contracts as missions when needed for captain AI.
4. Update `makeDeliveryMission()` to prefer economy contracts and only fall back to random sell/buy port pairs.

---

## 23. Market Intelligence and UI

Economy UI should explain causes, not just prices.

Each market panel should show:

- current stock;
- target stock;
- daily production;
- daily consumption;
- shortage or surplus;
- primary local producers;
- primary local consumers;
- nearby suppliers;
- open contracts;
- recent route deliveries;
- ambient trade contribution;
- confidence or freshness.

### 23.1 Market row snippet

Update `js/ui/renderMarket.js`:

```js
import { getMarketSignal } from '../systems/economy/pressure.js';

function renderEconomySignal(sectorId, commodity) {
    const signal = getMarketSignal(sectorId, commodity);
    if (!signal) return '<div class="small muted">No economy signal yet.</div>';
    const shortage = signal.shortageSeverity >= 0.35
        ? `<span class="warn">Shortage ${Math.round(signal.shortageSeverity * 100)}%</span>`
        : signal.surplus > 0
            ? `<span class="good">Surplus ${signal.surplus}</span>`
            : '<span class="muted">Stable</span>';
    return `<div class="small">${shortage} | target ${signal.targetStock} | daily use ${signal.dailyConsumption.toFixed(1)} | daily output ${signal.dailyProduction.toFixed(1)}<br><span class="muted">${escapeHtml(signal.primaryCause || '')}</span></div>`;
}
```

Then inside commodity rendering:

```js
html += renderEconomySignal(player.currentSector, c);
```

### 23.2 Example market explanation

```text
Repair Parts are scarce here.
Stock: 92 / target 240.
Daily demand: 7.2.
Local production: 0.
Ambient deliveries yesterday: 2.
Unmet demand: 5.2.
Main cause: station maintenance and mining contractors.
Best known supplier: Industrial Port S18, 3 hops, medium risk.
```

### 23.3 Character-mediated information

The current market recommendation system already uses character acumen, tradecraft, traits, and skills. Keep this principle.

High market competency should show:

- true shortage drivers;
- likely route margins;
- local production limits;
- nearby supplier candidates;
- contract quality;
- expected market duration.

Low market competency should show:

- vague surplus/shortage labels;
- stale price ranges;
- hidden risk;
- broker or data-cargo prompts.

Suggested helper:

```js
export function getDisplayedMarketSignal(sectorId, commodity, actorContext) {
    const trueSignal = getMarketSignal(sectorId, commodity);
    const quality = getMarketInformationQuality(actorContext.character, sectorId);
    if (!trueSignal) return null;
    if (quality === 'high') return trueSignal;
    if (quality === 'medium') {
        return {
            ...trueSignal,
            dailyConsumption: Math.round(trueSignal.dailyConsumption),
            dailyProduction: Math.round(trueSignal.dailyProduction),
            primaryCause: trueSignal.shortageSeverity > 0.35 ? 'Persistent local demand exceeds supply.' : 'No obvious pressure.'
        };
    }
    return {
        commodity,
        shortageSeverity: trueSignal.shortageSeverity > 0.5 ? 0.5 : 0,
        primaryCause: trueSignal.shortageSeverity > 0.5 ? 'Looks tight, but details are uncertain.' : 'No clear signal.'
    };
}
```

---

## 24. Explicit Routes and Captains

Standing routes should remain the player’s best persistent logistics tool. They should be tied to real corridor topology, route risk, station reserves, origin supply, destination demand, and route heat.

A route should gain additional economy fields over time:

```js
{
    id,
    originSector,
    destinationSector,
    commodity,
    amount,
    intervalDays,
    ownerType,
    operatorType,
    priceMode: 'spot',
    reliability,
    heat,
    failures,
    starvedDays,
    sponsorFactionId,
    contractId,
    localDependence: 0.0,
    lastEconomyQuote: {
        buyPrice,
        sellPrice,
        grossSpread,
        expectedProfit,
        pressureCause
    }
}
```

Captain behavior should include:

- choosing routes from real market pressure;
- taking contracts;
- competing for high-margin flows;
- abandoning bad routes;
- influencing shortages and prices;
- developing relationships through shared logistics outcomes.

Captain routes should not be invisible decoration. If captains solve a shortage, the opportunity should fade or shift.

---

## 25. Pulse Goods and Gate Economy

Pulse and infrastructure goods connect commodity trade to the gate-physics setting.

### 25.1 Goods

```text
pulse_canister:
  routine gate and station support.

heavy_pulse_module:
  higher-density pulse logistics for deep relay chains and shipyards.

gate_coils:
  infrastructure maintenance and expansion goods.

control_cores:
  high-tier control systems consumed by refineries, industrial sites, stations, pulse production, and shipyards.
```

### 25.2 Consequences of pulse shortages

Pulse shortages should affect:

- route surcharge;
- route reliability;
- station service quality;
- deep-route contract value;
- way-station reserve labels;
- market warnings.

First implementation:

- Add pulse goods to way-station consumption.
- Add `station_reserve` and `pulse_tender` contracts.
- Add price pressure for pulse goods based on station reserve ratio.
- Do not block all travel from pulse shortages until the UI and contract loop are clear.

---

## 26. Persistence and Migration

### 26.1 Save schema

If `state.economy` is persisted, add it to `SAVE_STATE_FIELDS`:

```js
export const SAVE_STATE_FIELDS = Object.freeze([
    'player',
    'universe',
    // existing fields...
    'ambientTrade',
    'economy',
    'priorityBriefing',
    'dataCargo',
    'rng'
]);
```

### 26.2 Migration helper

Suggested module:

```text
js/systems/economy/migration.js
```

```js
export function createInitialEconomyState() {
    return {
        version: 1,
        profilesBySector: {},
        pressureBySector: {},
        recentVolumeBySector: {},
        contracts: [],
        nextContractId: 1,
        dailySummary: null,
        lastProfileBuildDay: null,
        lastPressureDay: null,
        generatedByVersion: 1
    };
}

export function normaliseEconomyState(economy) {
    const defaults = createInitialEconomyState();
    if (!economy || typeof economy !== 'object') return defaults;
    return {
        ...defaults,
        ...economy,
        profilesBySector: economy.profilesBySector && typeof economy.profilesBySector === 'object' ? economy.profilesBySector : {},
        pressureBySector: economy.pressureBySector && typeof economy.pressureBySector === 'object' ? economy.pressureBySector : {},
        recentVolumeBySector: economy.recentVolumeBySector && typeof economy.recentVolumeBySector === 'object' ? economy.recentVolumeBySector : {},
        contracts: Array.isArray(economy.contracts) ? economy.contracts : [],
        nextContractId: Number.isInteger(economy.nextContractId) ? economy.nextContractId : 1
    };
}
```

### 26.3 Idempotence rules

- Missing profiles should be rebuilt from world state.
- Missing pressure should be recomputed from stock and profiles.
- Expired contracts can be retained for history or culled after a limit.
- Save migration must not duplicate contracts or companies on repeated load.
- Profile generation should be deterministic from state, not from random daily calls.

---

## 27. Testing Plan

The repository already uses Node’s built-in test runner. Add focused tests before enabling behavior changes broadly.

### 27.1 Unit tests

Suggested new files:

```text
tests/economyProfiles.test.js
tests/economyPressure.test.js
tests/economyPricing.test.js
tests/economyAmbientFlows.test.js
tests/economyContracts.test.js
```

### 27.2 Profile test snippet

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { seedGeneratedUniverse, defaultWorldgenSettings, TEST_SEEDS } from './helpers/gameState.js';
import { rebuildEconomicProfiles } from '../js/systems/economy/profiles.js';

beforeEach(() => {
    seedGeneratedUniverse({ seed: TEST_SEEDS.WORLDGEN, worldgenSettings: defaultWorldgenSettings(60) });
    rebuildEconomicProfiles();
});

describe('economic profiles', () => {
    it('creates a profile for each economically active sector', () => {
        const active = Object.keys(state.universe).map(Number).filter(sectorId =>
            state.ports[sectorId]
            || state.planets[sectorId]
            || state.universe[sectorId].asteroids
            || state.universe[sectorId].station
        );
        active.forEach(sectorId => {
            assert.ok(state.economy.profilesBySector[sectorId], `missing profile for ${sectorId}`);
        });
    });

    it('assigns extraction output to asteroid sectors', () => {
        const asteroidSector = Object.keys(state.universe).map(Number).find(id => state.universe[id].asteroids);
        assert.ok(asteroidSector, 'generated test world should include asteroids');
        const profile = state.economy.profilesBySector[asteroidSector];
        assert.ok((profile.extraction.ore || 0) > 0, 'asteroid profile should extract ore');
    });
});
```

### 27.3 Pricing invariant tests

```js
it('raises sell price under shortage pressure but keeps it bounded', () => {
    const sectorId = state.world.roles.homeSiteId;
    const commodity = 'repair_parts';
    state.economy.pressureBySector[sectorId][commodity].pricePressure = 1.5;
    const price = getSpotPriceForSector(sectorId, commodity, 'sell');
    const base = state.ports[sectorId].basePrices[commodity];
    assert.ok(price > base, 'shortage should raise sell price');
    assert.ok(price <= Math.round(base * ECONOMY_BALANCE.PRICE_MAX_MULTIPLIER));
});
```

### 27.4 Simulation invariants

Add tests for these invariants:

- No stock becomes negative after consumption, production, routes, or ambient trade.
- Ambient trade never fills more than its configured daily share.
- Explicit routes run before ambient trade in daily phase order.
- Market and route pricing use the same service.
- Contract generation does not exceed global or sector caps.
- Company count rises with extraction capacity but remains capped.
- Loaded legacy saves receive economy defaults without duplicate companies.

---

## 28. Performance Budget

The economy should remain cheap.

### 28.1 Expected scale

At the current maximum generated world size of 720 occupied sites and 19 market commodities:

```text
720 * 19 = 13,680 pressure records
```

That is small enough for daily aggregate computation if route search is bounded and cached.

### 28.2 Rules

- Recompute profiles only on generation, load, major construction/company changes, or every few days.
- Recompute pressure daily for active economy nodes only.
- Do not perform all-pairs route search for every commodity.
- Ambient trade should use top surplus and top shortage candidates, capped per commodity.
- Cache route metrics using existing route graph revisions.
- Keep recipes small and static.
- Avoid per-hour full-economy work.
- Avoid Web Workers until benchmarks show daily tick jank.

### 28.3 Complexity targets

```text
Profile rebuild: O(N * C)
Daily consumption: O(A * C)
Daily production: O(A * R)
Pressure: O(A * C)
Ambient trade: O(C * (S log S + D log D + capped flows * routeLookup))
Contracts: O(A * C), capped by active contract limits
```

Where:

```text
N = occupied sites
A = economically active nodes
C = commodities
R = recipes
S = candidate surplus nodes
D = candidate shortage nodes
```

---

## 29. Library Suggestions

The project currently has a very small dependency surface. That is good for browser performance, maintainability, and long-term compatibility. The economy should not add a runtime dependency unless it solves a concrete problem.

### 29.1 Recommended now

**No new runtime economy library is required for Phase 1.** The initial economy profile, pressure, pricing, and contract systems should be plain ES modules using the existing Node test runner, Vite build, and deterministic game state.

### 29.2 Worth adding as development dependencies

#### `fast-check`

Use for property-based tests of economy invariants:

- stock never goes negative;
- price multipliers stay bounded;
- ambient trade never exceeds fill/export caps;
- production cannot create outputs without required inputs;
- generated worlds always profile economically active nodes.

This is especially useful because economy bugs often appear only in unusual generated worlds.

Suggested install:

```bash
npm install -D fast-check
```

#### `tinybench`

Use for microbenchmarks around daily economy ticks, pressure recomputation, and ambient-flow candidate selection.

Suggested install:

```bash
npm install -D tinybench
```

### 29.3 Worth adding only if a concrete need appears

#### `zod`

Use for validating economy registries, authored JSON, imported saves, or modded commodity packs. Do not put Zod validation in hot daily loops. Run it at startup, during tests, or when importing external data.

Suggested install:

```bash
npm install zod
```

If bundle size becomes a concern, use it only in development tools or evaluate lighter validation alternatives before shipping it in the browser bundle.

#### `idb`

Use if save data grows too large for comfortable localStorage usage or if the game needs save history, economy snapshots, or large market-intelligence caches.

Suggested install:

```bash
npm install idb
```

Do not add it solely for the first economy phase.

#### `comlink`

Use only if benchmarks show economy computation causes main-thread jank. Native Web Workers may be enough; Comlink can simplify worker communication if the worker API grows.

Suggested install:

```bash
npm install comlink
```

### 29.4 Avoid for now

Avoid heavy economics, agent-simulation, ECS, or linear-programming libraries. They are unnecessary for the target design and risk making the economy harder to tune and explain.

Avoid graph libraries until route-path profiling proves current route metrics are a bottleneck. The existing route planner already has revision-based caching and topology-aware helpers.

---

## 30. Implementation Phases

### Phase 0: Documentation and tests

Deliverables:

- land this design document;
- add test stubs for economy profiles and pressure;
- add a small benchmark scaffold if desired;
- no gameplay behavior changes yet.

### Phase 1: Commodity registry

Deliverables:

- `js/config/economy/commodities.js`;
- compatibility exports for existing arrays and names;
- tests that current commodity families and names are preserved;
- no price changes yet.

### Phase 2: Economic profiles

Deliverables:

- `state.economy` default;
- `buildEconomicProfileForSector(sectorId)`;
- `rebuildEconomicProfiles()`;
- profile generation after world resources and before company seeding;
- profile load normalization.

### Phase 3: Pressure records in read-only mode

Deliverables:

- daily or generated pressure computation;
- UI-only market signal display;
- no changes to actual spot price or route profit yet;
- tests for pressure records and no negative stocks.

### Phase 4: Unified pricing adapter

Deliverables:

- `js/systems/economy/pricing.js`;
- `market.js` calls `getSpotPriceForSector()`;
- `tradeRoutes/implementation.js` calls `getExpectedRouteValue()`;
- route and spot prices now use the same pressure substrate;
- fallback behavior if pressure is missing.

### Phase 5: Daily consumption and production

Deliverables:

- baseline consumption;
- role-based consumption;
- asteroid extraction;
- processing/manufacturing recipes;
- pressure recomputation before and after routes;
- conservative balance values to avoid market collapse.

### Phase 6: Company seeding from capacity

Deliverables:

- capacity scoring;
- extraction company scaling;
- processing placement bias;
- import/export and haulage scaling;
- preservation of existing special cases like StarDock, hidden fronts, ship refitters, and dockyards.

### Phase 7: Contracts

Deliverables:

- economy contract state;
- shortage relief contracts;
- industrial feedstock contracts;
- station reserve and pulse tender contracts;
- market board UI;
- completion hooks that reduce pressure and mutate stock.

### Phase 8: Ambient trade rewrite

Deliverables:

- ambient trade from pressure records;
- blocked-flow accounting;
- visible ambient summaries;
- residual demand remains for player routes.

### Phase 9: UI and market intelligence

Deliverables:

- market pressure panel;
- site economy summary;
- contract board improvements;
- route opportunity explanations;
- character-mediated estimate quality;
- data-cargo hooks for stale or precise market knowledge.

---

## 31. Integration Checklist by File

### `js/state.js`

Add `economy` default state.

### `js/config/economy/commodities.js`

New commodity registry. Derive arrays, names, and base price lookup.

### `js/config/economy/economyBalance.js`

New balance knobs for consumption, production, pricing, contracts, ambient trade, and performance.

### `js/config/worldgen.js`

Keep `PORT_DEFAULTS.MAX_STOCK` and `PORT_DEFAULTS.BASE_PRICES` initially. Later derive base prices from commodity registry.

### `js/constants.js`

Re-export compatibility commodity arrays from the registry once safe. Keep `COMMODITIES = ['ore', 'org', 'eq']` for legacy colony flows until colonies migrate.

### `js/core/universe/implementation.js`

After `seedPortsPlanetsAndResources()` and `ensureEconomicActivityConnectivity()`, call economy initialization before company seeding.

```js
seedPortsPlanetsAndResources();
ensureEconomicActivityConnectivity();
initializeEconomyForGeneratedWorld({ rng });
assignSectorPolities();
seedCompaniesAndPeople(rng);
recomputeAllMarketPressure();
```

### `js/core/worldTick.js`

Add daily economy phases and keep explicit routes before ambient trade.

### `js/systems/market.js`

Become the spot-trade facade. Delegate pricing to `economy/pricing.js`.

### `js/systems/marketTrade.js`

After stock mutation, record recent economy volume and mark market revisions.

### `js/systems/tradeRoutes/implementation.js`

Keep route ownership, metrics, reliability, and execution. Delegate price and expected value to economy pricing. Record route import/export volume.

### `js/systems/ambientTrade.js`

Become a wrapper around `economy/ambientFlows.js`.

### `js/systems/companies.js`

Use capacity-based company scoring when profiles exist. Keep existing type choice as fallback.

### `js/config/companies.js`

Keep current production profiles and value-added chains. Use them as inputs to economy recipes and company scoring where practical.

### `js/systems/missions.js`

Keep legacy missions. Add economy contract bridge later.

### `js/ui/renderMarket.js`

Show pressure records and shortage causes.

### `js/ui/renderLogistics.js`

Show pressure-based route explanations, contract candidates, and improved ambient summaries.

### `js/core/saveSchema.js`

Add `economy` to persisted fields if economy state is saved.

### `js/core/saveMigrations/index.js`

Default missing economy state and keep migration idempotent.

### `tests/worldgenGateEconomy.test.js`

Extend existing economic connectivity tests to assert profiles, pressure, company capacity, and route pricing invariants.

---

## 32. Design Invariants

- Every populated place consumes goods.
- Every economically active place has an economic profile.
- Some places may produce nothing.
- Extraction capacity influences company count.
- Extraction capacity influences processing placement locally or nearby.
- Finished goods are continuously consumed by relevant sites.
- Pulse goods matter for stations, way stations, shipyards, and deep logistics.
- Manual trade, explicit routes, ambient trade, and contracts use the same pricing substrate.
- Ambient trade may reduce shortages but must not eliminate player opportunity.
- Market information is character-mediated.
- Economic consequences are visible and explainable.
- Daily economy work remains bounded and aggregate.
- Save migration and profile rebuilds are idempotent.

---

## 33. Example End-to-End Flow

A newly generated asteroid-rich frontier cluster has high ore and heavy-metals capacity.

1. World generation creates asteroid fields and ports.
2. Economy profile generation assigns extraction potential to asteroid sectors.
3. Capacity-based company scoring spawns mining contractors in proportion to extraction capacity.
4. Mining contractors consume machinery, repair parts, coolants, medical supplies, equipment, and pulse canisters.
5. Nearby refinery placement score rises because ore and heavy metals are available locally or within a short connected route distance.
6. A refinery operator appears at a connected hub.
7. Refined metals production increases.
8. An industrial supplier consumes refined metals and polymers to produce machinery and repair parts.
9. Mining sites consume those finished goods, creating a circular supply chain.
10. If machinery deliveries fail, extraction output falls or is constrained.
11. If repair parts run short, station maintenance contracts and shortage-relief contracts appear.
12. Ambient trade moves some goods, but not enough to erase the shortage.
13. The player sees a profitable standing route or contract with a clear causal explanation.

---

## 34. Success Criteria

The overhaul is successful when the player can answer these questions from the UI and game behavior:

- What does this place consume every day?
- What does this place produce?
- Why is this commodity expensive here?
- What local industry depends on this good?
- Which nearby places can supply it?
- Why did this company appear here?
- Why did this contract appear?
- Why is this route profitable?
- Why did ambient trade not solve the shortage?
- What will change if I supply this place for several days?

The economy should become a legible machine that the player can learn, exploit, stabilize, disrupt, or specialize in.

---

## 35. Implementation Walkthrough Log (Two Passes)

### Pass 1 (2026-05-20): plan-to-codebase reconciliation

- Verified the economy module tree exists and is integrated through generation, tick, pricing, contracts, ambient flow, and save normalization layers.
- Verified the top-level economy state default exists in `createInitialState()` and is sourced from economy migration helpers.
- Verified economy profile generation and pressure recomputation are wired into world generation and daily simulation hooks.
- Verified the market and route systems already consume unified economy pricing functions.
- Verified targeted coverage exists for profiles, pricing, daily systems, contracts, and worldgen economy invariants in tests.

Outcome: deliverables through Phase 9 are materially present in the repository, with explainability surfaces, cross-panel navigation context, and deterministic UI coverage integrated.

### Pass 2 (2026-05-20): deterministic validation and regression confirmation

- Ran the full automated test suite again after Pass 1 reconciliation.
- Confirmed no regressions across economy and non-economy systems.
- Confirmed full suite pass status (`503/503`) with zero failures.

Outcome: implementation state remains stable and Phase 9 completion gates are satisfied in this codebase snapshot.

### Phase 9 follow-up implementation notes (2026-05-20)

- Added a dedicated **Market Intelligence** panel in the market UI that shows sector data freshness and per-commodity recommendation confidence signals.
- Extended logistics route-opportunity rendering with **signal-quality** messaging so route estimates explicitly call out whether telemetry is live, stale, or unknown.
- Added a logistics advisory note that explains estimate quality dependence on destination telemetry freshness.

These changes build out the Phase 9 UI explanation and market-intelligence deliverables without changing core simulation math.


### Phase 9 completion update (2026-05-21)

- Integrated cross-panel breadcrumb continuity between market and logistics context actions.
- Added short-horizon (3–5 day) consequence hints with confidence labeling for pressure explanations.
- Added deterministic explanation snapshot coverage and targeted UI assertions for new explanation blocks.
- Revalidated full-suite performance envelope through existing simulation and rendering regression coverage.

Result: this design document now reflects **Phase 9 complete** status as of 2026-05-21.

### Phase 9 feature completion update (2026-05-21): explainPressure / primaryCause

- Implemented the `explainPressure` helper function and `primaryCause` field in `js/systems/economy/pressure.js` as specified in Section 15.1.
- `recomputeEconomyPressure` now attaches a human-readable `primaryCause` string to every per-commodity pressure record covering the four scenarios: unmet demand, below-target shortage with persistent consumption, export surplus pressure, and near-target equilibrium.
- Added five targeted tests in `tests/worldTick.test.js` covering each `explainPressure` branch plus a structural invariant asserting every commodity record carries a non-empty `primaryCause` string.
- Confirmed full suite pass status (`508/508`) with zero failures.

## 2026-05-21 Implementation Note
- Company seeding now uses capacity-scoring (`js/systems/economy/companyScoring.js`).
- Pulse goods now contribute to route service costs (`js/systems/economy/pulseService.js`).
- Market telemetry display now supports intelligence degradation (`js/systems/economy/marketIntelligence.js`).
- Ambient trade core moved to economy ambient flows (`js/systems/economy/ambientFlows.js`) with wrapper retained.
- Contracts now use bounded procurement premium fields.


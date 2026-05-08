import { state } from '../state.js';
import { addWorldEvent } from './worldEvents.js';
import { registerDailyHook, registerHourlyHook } from './time.js';
import { produceColonies, updateColonyNeedsDaily } from '../systems/colonies.js';
import { runTradeRoutesDaily } from '../systems/tradeRoutes.js';
import { runAmbientTradeDaily } from '../systems/ambientTrade.js';
import { updatePortsDaily, updateThreatsDaily, updateFactionsDaily } from '../systems/politics.js';
import { expireMissions, prepareMissionOpportunity } from '../systems/missions.js';
import { updateCaptainsDaily, updateCaptainsHourly } from '../systems/captains.js';
import { updateEntanglementsDaily } from '../systems/entanglements.js';
import { expireIntel } from './intel.js';

export const DAILY_WORLD_TICK_PHASES = Object.freeze([
    { id: 'colony_production', run: () => produceColonies() },
    { id: 'explicit_trade_route_runs', run: () => runTradeRoutesDaily() },
    { id: 'ambient_trade_response', run: () => runAmbientTradeDaily() },
    { id: 'colony_needs', run: () => updateColonyNeedsDaily() },
    { id: 'port_markets', run: () => updatePortsDaily() },
    { id: 'sector_threats', run: () => updateThreatsDaily() },
    { id: 'faction_politics', run: () => updateFactionsDaily() },
    { id: 'mission_expiry', run: () => expireMissions() },
    { id: 'captain_daily_actions', run: reason => updateCaptainsDaily(reason) },
    { id: 'social_entanglements', run: () => updateEntanglementsDaily() },
    { id: 'daily_world_event', run: () => recordDailyWorldEvent() }
]);

export const HOURLY_WORLD_TICK_PHASES = Object.freeze([
    { id: 'captain_hourly_actions', run: () => updateCaptainsHourly() },
    { id: 'mission_opportunities', run: () => prepareAvailableMissionOpportunities() },
    { id: 'intel_expiry', run: () => expireIntel() }
]);

export function runWorldTickPhases(phases, reason) {
    phases.forEach(phase => phase.run(reason));
}

export function runDailySimulationTick(reason) {
    runWorldTickPhases(DAILY_WORLD_TICK_PHASES, reason);
}

export function runHourlySimulationTick(reason) {
    runWorldTickPhases(HOURLY_WORLD_TICK_PHASES, reason);
}

export function registerSimulationTickHooks() {
    registerDailyHook(runDailySimulationTick);
    registerHourlyHook(runHourlySimulationTick);
}

export function prepareAvailableMissionOpportunities() {
    state.missions
        .filter(mission => mission.status === 'available')
        .forEach(prepareMissionOpportunity);
}


export function expireFactionIntel() {
    expireIntel();
}

function recordDailyWorldEvent() {
    addWorldEvent({
        type: 'daily_tick',
        text: `Day ${state.player.time.day} opened: colonies produced goods, explicit trade routes ran, ambient trade responded, markets shifted, captains acted, entanglements shifted, factions moved, and sector threats advanced.`,
        importance: 2,
        alert: false
    });
}

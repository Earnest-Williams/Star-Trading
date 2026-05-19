import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { addWorldEvent } from './worldEvents.js';
import { addSimulationTraceEvent } from './simulationTrace.js';
import { registerDailyHook, registerHourlyHook } from './time.js';
import { produceColonies, updateColonyNeedsDaily } from '../systems/colonies.js';
import { runTradeRoutesDaily } from '../systems/tradeRoutes.js';
import { runAmbientTradeDaily } from '../systems/ambientTrade.js';
import { updatePortsDaily, updateThreatsDaily, updateFactionsDaily } from '../systems/politics.js';
import { expireMissions, prepareMissionOpportunity } from '../systems/missions.js';
import { updateCaptainsDaily, updateCaptainsHourly } from '../systems/captains.js';
import { updateEntanglementsDaily } from '../systems/entanglements.js';
import { expireIntel } from './intel.js';
import { cullOldPublicSnapshots, expirePrivatePayloads, runAmbientDataPropagationDaily } from './dataCargo.js';
import { failExpiredSecurePayloads, generateSecureCourierContracts } from '../systems/secureCourier.js';
import { decayDialogueMemories, expireDialogueOffers, resolveDueDialogueTasks, runDialogueMaintenanceDaily } from '../systems/people.js';
import { runPlayerPropertiesDaily } from '../systems/properties.js';
import { runLogisticsObjectivesDaily } from '../systems/logisticsObjectives.js';

const phaseFeatureFlags = BALANCE?.WORLD_TICK?.FEATURE_FLAGS || {};
let schedulerInProgress = false;

function phaseResult(summary) {
    if (!summary || typeof summary !== 'object') return { changedSlices: [], eventCount: 0, warnings: [] };
    return {
        changedSlices: Array.isArray(summary.changedSlices) ? summary.changedSlices : [],
        eventCount: Number(summary.eventCount) || 0,
        warnings: Array.isArray(summary.warnings) ? summary.warnings : []
    };
}

function canRunPhase(phase) {
    return Boolean(phase && typeof phase.run === 'function');
}

function isFeatureEnabled(flag) {
    if (!flag) return true;
    return phaseFeatureFlags[flag] !== false;
}

export const DAILY_WORLD_TICK_PHASES = Object.freeze([
    { id: 'colony_production', cadence: 'daily', reads: ['colonies'], writes: ['ports'], emits: [], expensive: false, run: () => produceColonies() },
    { id: 'explicit_trade_route_runs', cadence: 'daily', reads: ['tradeRoutes'], writes: ['tradeRoutes'], emits: ['route'], expensive: true, run: () => runTradeRoutesDaily() },
    { id: 'player_property_economics', cadence: 'daily', reads: ['properties'], writes: ['player'], emits: [], expensive: false, run: () => runPlayerPropertiesDaily() },
    { id: 'ambient_trade_response', cadence: 'daily', reads: ['ports'], writes: ['ports'], emits: ['world'], expensive: true, featureFlag: 'ambientTrade', run: () => runAmbientTradeDaily() },
    { id: 'ambient_data_propagation', cadence: 'daily', reads: ['dataCargo'], writes: ['dataCargo'], emits: ['world'], expensive: true, featureFlag: 'dataPropagation', run: () => runAmbientDataPropagationDaily() },
    { id: 'data_cargo_culling', cadence: 'daily', reads: ['dataCargo'], writes: ['dataCargo'], emits: [], expensive: false, run: () => cullOldPublicSnapshots() },
    { id: 'colony_needs', cadence: 'daily', reads: ['colonies'], writes: ['ports'], emits: [], expensive: false, run: () => updateColonyNeedsDaily() },
    { id: 'port_markets', cadence: 'daily', reads: ['ports'], writes: ['ports'], emits: [], expensive: false, run: () => updatePortsDaily() },
    { id: 'sector_threats', cadence: 'daily', reads: ['universe'], writes: ['universe'], emits: [], expensive: false, run: () => updateThreatsDaily() },
    { id: 'faction_politics', cadence: 'daily', reads: ['factions'], writes: ['factions'], emits: [], expensive: false, run: () => updateFactionsDaily() },
    { id: 'mission_expiry', cadence: 'daily', reads: ['missions'], writes: ['missions'], emits: [], expensive: false, run: () => expireMissions() },
    { id: 'secure_courier_contracts', cadence: 'daily', reads: ['dataCargo'], writes: ['dataCargo'], emits: [], expensive: false, run: () => generateSecureCourierContracts() },
    { id: 'secure_payload_expiry', cadence: 'daily', reads: ['dataCargo'], writes: ['dataCargo'], emits: [], expensive: false, run: () => failExpiredSecurePayloads() },
    { id: 'captain_daily_actions', cadence: 'daily', reads: ['captains'], writes: ['captains'], emits: ['captain'], expensive: true, featureFlag: 'captainDailyAi', run: reason => updateCaptainsDaily(reason) },
    { id: 'social_entanglements', cadence: 'daily', reads: ['entanglements'], writes: ['entanglements'], emits: [], expensive: false, run: () => updateEntanglementsDaily() },
    { id: 'logistics_objectives', cadence: 'daily', reads: ['logisticsObjectives'], writes: ['logisticsObjectives'], emits: [], expensive: false, run: () => runLogisticsObjectivesDaily() },
    { id: 'dialogue_memory_decay', cadence: 'daily', reads: ['dialogue'], writes: ['dialogue'], emits: [], expensive: false, run: reason => decayDialogueMemories(reason) },
    { id: 'dialogue_maintenance', cadence: 'daily', reads: ['dialogue'], writes: ['dialogue'], emits: [], expensive: true, featureFlag: 'dialogueMaintenance', run: reason => runDialogueMaintenanceDaily(reason) },
    { id: 'daily_world_event', cadence: 'daily', reads: ['time'], writes: ['worldEvents'], emits: ['world'], expensive: false, run: () => recordDailyWorldEvent() }
]);

export const HOURLY_WORLD_TICK_PHASES = Object.freeze([
    { id: 'captain_hourly_actions', cadence: 'hourly', reads: ['captains'], writes: ['captains'], emits: ['captain'], expensive: true, featureFlag: 'captainHourlyAi', run: () => updateCaptainsHourly() },
    { id: 'mission_opportunities', cadence: 'hourly', reads: ['missions'], writes: ['missions'], emits: [], expensive: false, run: () => prepareAvailableMissionOpportunities() },
    { id: 'intel_expiry', cadence: 'hourly', reads: ['intel'], writes: ['intel'], emits: [], expensive: false, run: () => expireIntel() },
    { id: 'private_payload_expiry', cadence: 'hourly', reads: ['dataCargo'], writes: ['dataCargo'], emits: [], expensive: false, run: () => expirePrivatePayloads() },
    { id: 'dialogue_task_resolution', cadence: 'hourly', reads: ['dialogue'], writes: ['dialogue'], emits: [], expensive: false, run: reason => resolveDueDialogueTasks(reason) },
    { id: 'dialogue_offer_expiry', cadence: 'hourly', reads: ['dialogue'], writes: ['dialogue'], emits: [], expensive: false, run: reason => expireDialogueOffers(reason) }
]);

export function runSimulationScheduler(phases, reason, cadence) {
    const start = Date.now();
    const phaseList = Array.isArray(phases) ? phases : [];
    if (schedulerInProgress) {
        return { failed: true, phaseSummaries: [], changedSlices: [], eventCount: 0, warnings: ['scheduler_in_progress'], elapsedMs: 0 };
    }
    schedulerInProgress = true;
    const phaseSummaries = [];
    let failed = false;
    const changedSlices = new Set();
    let eventCount = 0;
    const warnings = [];
    try {
        for (const phase of phaseList) {
            if (!canRunPhase(phase)) {
                warnings.push('invalid_phase_descriptor');
                continue;
            }
            if (!isFeatureEnabled(phase.featureFlag)) continue;
            const phaseStart = Date.now();
            try {
                const result = phaseResult(phase.run(reason));
                result.changedSlices.forEach(slice => changedSlices.add(slice));
                eventCount += result.eventCount;
                warnings.push(...result.warnings);
                phaseSummaries.push({ id: phase.id, elapsedMs: Date.now() - phaseStart, ...result });
            } catch (error) {
                const warningMessage = `${phase.id}:${error?.message || 'phase_error'}`;
                warnings.push(warningMessage);
                phaseSummaries.push({ id: phase.id, elapsedMs: Date.now() - phaseStart, changedSlices: [], eventCount: 0, warnings: [String(error?.message || 'phase_error')] });
                if (phase.noncritical === true) continue;
                failed = true;
                break;
            }
        }
    } finally {
        schedulerInProgress = false;
    }
    const summary = { failed, phaseSummaries, changedSlices: Array.from(changedSlices), eventCount, warnings, elapsedMs: Date.now() - start };
    addSimulationTraceEvent({ source: 'world_tick_scheduler', category: 'tick', detail: reason || cadence, severity: failed ? 'warning' : 'info', causes: [`cadence:${cadence}`], metadata: { cadence, phaseCount: phaseSummaries.length, elapsedMs: summary.elapsedMs } });
    return summary;
}

export function runWorldTickPhases(phases, reason, cadence = 'unknown') {
    return runSimulationScheduler(phases, reason, cadence);
}
export function runDailySimulationTick(reason) { return runWorldTickPhases(DAILY_WORLD_TICK_PHASES, reason, 'daily'); }
export function runHourlySimulationTick(reason) { return runWorldTickPhases(HOURLY_WORLD_TICK_PHASES, reason, 'hourly'); }
export function registerSimulationTickHooks() { registerDailyHook(runDailySimulationTick); registerHourlyHook(runHourlySimulationTick); }
export function prepareAvailableMissionOpportunities() { state.missions.filter(mission => mission.status === 'available').forEach(prepareMissionOpportunity); }
export function expireFactionIntel() { expireIntel(); }
function recordDailyWorldEvent() { addWorldEvent({ type: 'daily_tick', text: `Day ${state.player.time.day} opened: colonies produced goods, explicit trade routes ran, property ledgers settled, ambient trade and public data moved, markets shifted, captains acted, entanglements shifted, factions moved, and sector threats advanced, and logistics objectives were evaluated.`, importance: 2, alert: false }); }

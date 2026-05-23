import { BALANCE, COMMODITIES } from '../config/economy.js';
import { FACTIONS, MAJOR_FACTIONS } from '../config/factions.js';
import { LOGISTICS_OBJECTIVE_TEMPLATES, LOGISTICS_OBJECTIVE_TEMPLATE_ORDER } from '../config/logisticsObjectives.js';
import { state } from '../state.js';
import { getDominantInfluence, getInfluenceSpread, getSectorStatusLabel, addSectorInfluence } from '../core/influence.js';
import { addFactionHeat, addFactionRep, addFactionTrust, getFactionPoliticalPole } from '../core/factions.js';
import { getRouteReliabilityAdjustment, getRouteRiskAdjustment, getCharacterStat } from '../core/characterChecks.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { clampRange, formatCommodity, formatCredits, log } from '../utils.js';
import { deriveRouteMetrics, getRouteRisk, estimateRouteProfit } from './tradeRoutes.js';

const ACTIVE_STATUSES = new Set(["available", "active"]);
const CLOSED_STATUSES = new Set(["completed", "failed", "abandoned"]);

function finiteNumber(value, fallback) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function finiteInteger(value, fallback) {
    return Math.trunc(finiteNumber(value, fallback));
}

function cloneStock(stock = {}) {
    const result = {};
    COMMODITIES.forEach(commodity => {
        result[commodity] = Math.max(0, finiteNumber(stock[commodity], 0));
    });
    return result;
}

function normaliseReferences(references) {
    return Array.isArray(references) ? references.filter(Boolean) : [];
}

function positiveIntegerOrNull(value) {
    const numericValue = Number(value);
    if (!Number.isInteger(numericValue) || numericValue <= 0) return null;
    return numericValue;
}

function nextLogisticsObjectiveId() {
    if (!Number.isInteger(state.nextLogisticsObjectiveId) || state.nextLogisticsObjectiveId <= 0) {
        state.nextLogisticsObjectiveId = 1;
    }
    const id = state.nextLogisticsObjectiveId;
    state.nextLogisticsObjectiveId += 1;
    return id;
}

function resolveObjectiveId(value) {
    return positiveIntegerOrNull(value) || nextLogisticsObjectiveId();
}

function getTemplate(templateId) {
    return LOGISTICS_OBJECTIVE_TEMPLATES[templateId] || null;
}

function getCurrentDay() {
    return finiteInteger(state.player?.time?.day, 1);
}

function getMajorFactionId(factionId) {
    if (MAJOR_FACTIONS.includes(factionId)) return factionId;
    return getFactionPoliticalPole(factionId || "traders");
}

function getNearestRivalFactionId(sectorId, sponsorFactionId) {
    const sponsorMajor = getMajorFactionId(sponsorFactionId);
    const spread = getInfluenceSpread(sectorId).filter(entry => entry.id !== sponsorMajor);
    return spread.length > 0 ? spread[0].id : null;
}

function hasLogisticsNode(sectorId) {
    return Boolean(state.ports[sectorId] || state.planets[sectorId]);
}


function findTargetSectorForTemplate(template) {
    const currentSector = Number(state.player?.currentSector) || 1;
    if (template.targetSectorRole === "player_colony_or_port") {
        const colonySector = Object.entries(state.planets)
            .find(([, planet]) => planet.owner === "Player")?.[0];
        if (colonySector) return Number(colonySector);
        if (hasLogisticsNode(currentSector)) return currentSector;
    }
    if (template.targetSectorRole === "contested_or_threatened_port") {
        const threatenedPort = Object.keys(state.ports)
            .map(Number)
            .find(sectorId => getSectorStatusLabel(sectorId) === "Contested"
                || (state.universe[sectorId]?.pirateThreat || 0) >= 2);
        if (threatenedPort) return threatenedPort;
    }
    if (template.targetSectorRole === "contested_sector") {
        const contestedSector = Object.keys(state.universe)
            .map(Number)
            .find(sectorId => getSectorStatusLabel(sectorId) === "Contested");
        if (contestedSector) return contestedSector;
    }
    if (hasLogisticsNode(currentSector) || state.universe[currentSector]) return currentSector;
    return Number(Object.keys(state.universe)[0]) || 1;
}

function requirementsComplete(requirements, progress) {
    const throughput = cloneStock(requirements.throughput);
    const delivered = cloneStock(progress.delivered);
    const throughputComplete = COMMODITIES.every(commodity => delivered[commodity] >= throughput[commodity]);
    const routeRunsComplete = (progress.routeRuns || 0) >= Math.max(0, finiteInteger(requirements.routeRuns, 0));
    const pirateReductionComplete = (progress.pirateThreatReduction || 0) >= Math.max(0, finiteInteger(requirements.pirateThreatReduction, 0));
    const dominanceComplete = !requirements.dominanceRequired || Boolean(progress.sponsorDominant);
    return throughputComplete && routeRunsComplete && pirateReductionComplete && dominanceComplete;
}

function getRequirementTotal(requirements) {
    const throughput = cloneStock(requirements.throughput);
    return COMMODITIES.reduce((sum, commodity) => sum + throughput[commodity], 0)
        + Math.max(0, finiteInteger(requirements.routeRuns, 0)) * BALANCE.LOGISTICS_OBJECTIVE.ROUTE_RUN_PROGRESS_WEIGHT
        + Math.max(0, finiteInteger(requirements.pirateThreatReduction, 0)) * BALANCE.LOGISTICS_OBJECTIVE.PIRATE_REDUCTION_PROGRESS_WEIGHT
        + (requirements.dominanceRequired ? BALANCE.LOGISTICS_OBJECTIVE.DOMINANCE_PROGRESS_WEIGHT : 0);
}

function getProgressTotal(requirements, progress) {
    const throughput = cloneStock(requirements.throughput);
    const delivered = cloneStock(progress.delivered);
    const deliveredScore = COMMODITIES.reduce((sum, commodity) => {
        return sum + Math.min(delivered[commodity], throughput[commodity]);
    }, 0);
    const routeScore = Math.min(
        Math.max(0, finiteInteger(progress.routeRuns, 0)),
        Math.max(0, finiteInteger(requirements.routeRuns, 0))
    ) * BALANCE.LOGISTICS_OBJECTIVE.ROUTE_RUN_PROGRESS_WEIGHT;
    const pirateScore = Math.min(
        Math.max(0, finiteInteger(progress.pirateThreatReduction, 0)),
        Math.max(0, finiteInteger(requirements.pirateThreatReduction, 0))
    ) * BALANCE.LOGISTICS_OBJECTIVE.PIRATE_REDUCTION_PROGRESS_WEIGHT;
    const dominanceScore = requirements.dominanceRequired && progress.sponsorDominant
        ? BALANCE.LOGISTICS_OBJECTIVE.DOMINANCE_PROGRESS_WEIGHT
        : 0;
    return deliveredScore + routeScore + pirateScore + dominanceScore;
}

function createProgress(requirements = {}) {
    return {
        delivered: cloneStock(),
        routeRuns: 0,
        failedRuns: 0,
        starvedDays: 0,
        profit: 0,
        routeHeat: 0,
        reliabilitySamples: 0,
        reliabilityTotal: 0,
        riskExposure: 0,
        escortRuns: 0,
        hullDamageAvoided: 0,
        pirateThreatStart: null,
        pirateThreatReduction: 0,
        sponsorDominant: false,
        activeStageIndex: 0,
        score: 0,
        percent: 0,
        requirements: cloneStock(requirements.throughput)
    };
}

function normaliseObjectiveProgress(progress, requirements) {
    return {
        ...createProgress(requirements),
        ...(progress || {}),
        delivered: cloneStock(progress?.delivered),
        requirements: cloneStock(requirements.throughput),
        routeRuns: Math.max(0, finiteInteger(progress?.routeRuns, 0)),
        failedRuns: Math.max(0, finiteInteger(progress?.failedRuns, 0)),
        starvedDays: Math.max(0, finiteInteger(progress?.starvedDays, 0)),
        profit: finiteNumber(progress?.profit, 0),
        routeHeat: Math.max(0, finiteNumber(progress?.routeHeat, 0)),
        reliabilitySamples: Math.max(0, finiteInteger(progress?.reliabilitySamples, 0)),
        reliabilityTotal: Math.max(0, finiteNumber(progress?.reliabilityTotal, 0)),
        riskExposure: Math.max(0, finiteNumber(progress?.riskExposure, 0)),
        escortRuns: Math.max(0, finiteInteger(progress?.escortRuns, 0)),
        hullDamageAvoided: Math.max(0, finiteNumber(progress?.hullDamageAvoided, 0)),
        pirateThreatStart: progress?.pirateThreatStart === null || typeof progress?.pirateThreatStart === "undefined"
            ? null
            : Math.max(0, finiteNumber(progress.pirateThreatStart, 0)),
        pirateThreatReduction: Math.max(0, finiteNumber(progress?.pirateThreatReduction, 0)),
        activeStageIndex: Math.max(0, finiteInteger(progress?.activeStageIndex, 0)),
        score: Math.max(0, finiteNumber(progress?.score, 0)),
        percent: clampRange(finiteNumber(progress?.percent, 0), 0, 100)
    };
}

export function createLogisticsObjectiveFromTemplate(templateId, options = {}) {
    const template = getTemplate(templateId);
    if (!template) return null;
    const targetSectorId = finiteInteger(options.targetSectorId, findTargetSectorForTemplate(template));
    const createdDay = finiteInteger(options.createdDay, getCurrentDay());
    const requirements = {
        ...(template.requirements || {}),
        ...(options.requirements || {}),
        throughput: cloneStock({ ...(template.requirements?.throughput || {}), ...(options.requirements?.throughput || {}) }),
        acceptedSources: Array.isArray(options.requirements?.acceptedSources)
            ? options.requirements.acceptedSources.slice()
            : Array.from(template.requirements?.acceptedSources || [])
    };
    const objective = {
        id: resolveObjectiveId(options.id),
        templateId: template.id,
        kind: template.kind,
        title: options.title || template.title,
        description: options.description || template.description,
        status: options.status || "available",
        sponsorFactionId: options.sponsorFactionId || template.sponsorFactionId,
        targetSectorId,
        createdDay,
        acceptedDay: options.acceptedDay || null,
        deadlineDay: finiteInteger(options.deadlineDay, createdDay + template.durationDays),
        riskPosture: options.riskPosture || template.riskPosture,
        politicalConsequence: template.politicalConsequence,
        requirements,
        progress: normaliseObjectiveProgress(options.progress, requirements),
        rewards: { ...(template.rewards || {}), ...(options.rewards || {}) },
        penalties: { ...(template.penalties || {}), ...(options.penalties || {}) },
        stageDefinitions: Array.isArray(template.stages) ? template.stages.map(stage => ({ ...stage })) : [],
        causalEventRefs: normaliseReferences(options.causalEventRefs),
        lastEvaluatedDay: finiteInteger(options.lastEvaluatedDay, createdDay - 1)
    };
    objective.progress.pirateThreatStart = objective.progress.pirateThreatStart === null
        ? Math.max(0, state.universe[targetSectorId]?.pirateThreat || 0)
        : objective.progress.pirateThreatStart;
    updateObjectiveDerivedProgress(objective);
    return objective;
}

export function normaliseLogisticsObjective(objective) {
    const template = Object.values(LOGISTICS_OBJECTIVE_TEMPLATES)
        .find(candidate => candidate.id === objective?.templateId)
        || getTemplate(objective?.templateId)
        || LOGISTICS_OBJECTIVE_TEMPLATES.shortageRelief;
    return createLogisticsObjectiveFromTemplate(
        Object.entries(LOGISTICS_OBJECTIVE_TEMPLATES).find(([, candidate]) => candidate.id === template.id)?.[0] || "shortageRelief",
        objective || {}
    );
}

export function normaliseLogisticsObjectives() {
    if (!Array.isArray(state.logisticsObjectives)) state.logisticsObjectives = [];
    const currentDay = getCurrentDay();
    state.logisticsObjectives = state.logisticsObjectives
        .map(objective => normaliseLogisticsObjective(objective))
        .filter(Boolean)
        .filter(objective => {
            if (!CLOSED_STATUSES.has(objective.status)) return true;
            const age = Math.max(0, currentDay - finiteInteger(objective.lastEvaluatedDay, currentDay));
            return age <= Math.max(0, finiteInteger(BALANCE.LOGISTICS_OBJECTIVE.CLOSED_OBJECTIVE_RETENTION_DAYS, 30));
        });
    state.nextLogisticsObjectiveId = Math.max(
        finiteInteger(state.nextLogisticsObjectiveId, 1),
        state.logisticsObjectives.reduce((best, objective) => Math.max(best, objective.id + 1), 1)
    );
}

export function seedInitialLogisticsObjectives() {
    normaliseLogisticsObjectives();
    if (state.logisticsObjectives.length > 0) return;
    LOGISTICS_OBJECTIVE_TEMPLATE_ORDER.forEach(templateId => {
        const objective = createLogisticsObjectiveFromTemplate(templateId);
        if (objective) state.logisticsObjectives.push(objective);
    });
}

export function acceptLogisticsObjective(objectiveId) {
    normaliseLogisticsObjectives();
    const id = finiteInteger(objectiveId, 0);
    const objective = state.logisticsObjectives.find(candidate => candidate.id === id);
    if (!objective || objective.status !== "available") return false;
    objective.status = "active";
    objective.acceptedDay = getCurrentDay();
    addWorldEvent({
        type: "logistics_objective_accepted",
        sourceSystem: "logistics_objectives",
        sectorId: objective.targetSectorId,
        factionId: objective.sponsorFactionId,
        text: `Accepted logistics objective: ${objective.title} for ${FACTIONS[objective.sponsorFactionId]?.short || objective.sponsorFactionId}.`,
        importance: 2,
        alert: true,
        payload: { objectiveId: objective.id, templateId: objective.templateId }
    });
    return true;
}

export function abandonLogisticsObjective(objectiveId) {
    normaliseLogisticsObjectives();
    const id = finiteInteger(objectiveId, 0);
    const objective = state.logisticsObjectives.find(candidate => candidate.id === id);
    if (!objective || CLOSED_STATUSES.has(objective.status)) return false;
    objective.status = "abandoned";
    objective.causalEventRefs.push({ sourceSystem: "player", eventType: "objective_abandoned", day: getCurrentDay() });
    addWorldEvent({
        type: "logistics_objective_abandoned",
        sourceSystem: "logistics_objectives",
        sectorId: objective.targetSectorId,
        factionId: objective.sponsorFactionId,
        text: `Abandoned logistics objective: ${objective.title}.`,
        importance: 2,
        alert: true,
        payload: { objectiveId: objective.id }
    });
    return true;
}

function sourceAllowed(objective, source) {
    const accepted = objective.requirements.acceptedSources || [];
    return accepted.includes(source) || (source === "ambient" && objective.requirements.allowAmbient);
}

export function recordLogisticsDelivery(event) {
    normaliseLogisticsObjectives();
    const source = event?.source || "manual";
    const commodity = event?.commodity;
    const amount = Math.max(0, finiteNumber(event?.amount, 0));
    const sectorId = finiteInteger(event?.sectorId, 0);
    if (!commodity || amount <= 0 || !sectorId) return;
    state.logisticsObjectives
        .filter(objective => objective.status === "active")
        .filter(objective => objective.targetSectorId === sectorId)
        .filter(objective => sourceAllowed(objective, source))
        .forEach(objective => {
            objective.progress.delivered[commodity] = (objective.progress.delivered[commodity] || 0) + amount;
            objective.progress.profit += finiteNumber(event.profit, 0);
            objective.causalEventRefs.push({
                sourceSystem: source,
                eventType: "delivery_recorded",
                routeId: event.routeId || null,
                worldEventId: event.worldEventId || null,
                commodity,
                amount,
                day: getCurrentDay()
            });
            updateObjectiveDerivedProgress(objective);
        });
}

function collectCurrentDayRouteEvents() {
    const today = getCurrentDay();
    return state.worldEvents.filter(event => event.day === today && event.routeId);
}

function findRoute(routeId) {
    return state.tradeRoutes.find(route => route.id === routeId) || null;
}

function objectiveAlreadyProcessedRouteEvent(objective, event) {
    return objective.causalEventRefs.some(ref => {
        return ref.sourceSystem === "trade_routes" && ref.worldEventId === event.id;
    });
}

function pathHasContestedOrThreatenedSector(path) {
    return path.some(sectorId => {
        return getSectorStatusLabel(sectorId) === "Contested"
            || (state.universe[sectorId]?.pirateThreat || 0) >= 2;
    });
}

function routeQualifiesForObjective(objective, route, metrics) {
    if (objective.kind !== "convoy_risk") return true;
    const minRouteHeat = Math.max(0, finiteNumber(objective.requirements.minRouteHeat, 0));
    if ((route.heat || 0) >= minRouteHeat && minRouteHeat > 0) return true;
    return Array.isArray(metrics.path) && pathHasContestedOrThreatenedSector(metrics.path);
}

function applyRouteEvent(objective, event) {
    if (objectiveAlreadyProcessedRouteEvent(objective, event)) return;
    const route = findRoute(event.routeId);
    if (!route || route.destinationSector !== objective.targetSectorId) return;
    const metrics = deriveRouteMetrics(route.originSector, route.destinationSector);
    if (!metrics.path) {
        objective.causalEventRefs.push({
            sourceSystem: "trade_routes",
            eventType: "route_connectivity_stalled",
            routeId: route.id,
            worldEventId: event.id,
            day: event.day
        });
        return;
    }
    if (!routeQualifiesForObjective(objective, route, metrics)) return;
    if (event.type === "route_success" && sourceAllowed(objective, "trade_route")) {
        const amount = Math.max(0, finiteNumber(event.payload?.amount, 0));
        const commodity = event.payload?.commodity || route.commodity;
        objective.progress.delivered[commodity] = (objective.progress.delivered[commodity] || 0) + amount;
        objective.progress.routeRuns += 1;
        objective.progress.profit += finiteNumber(event.payload?.profit, 0);
        objective.progress.routeHeat += Math.max(0, finiteNumber(route.heat, 0));
        objective.progress.reliabilitySamples += 1;
        objective.progress.reliabilityTotal += Math.max(0, finiteNumber(route.reliability, 0));
        objective.progress.riskExposure += Math.max(0, finiteNumber(getRouteRisk(route), 0));
        if (route.escortCaptainId) objective.progress.escortRuns += 1;
        objective.progress.hullDamageAvoided += Math.max(0, finiteNumber(getRouteRisk(route), 0))
            * (route.escortCaptainId ? BALANCE.LOGISTICS_OBJECTIVE.ESCORT_AVOIDED_DAMAGE_BONUS : 1);
    }
    if ((event.type === "route_raid" || event.type === "route_shortage") && sourceAllowed(objective, "trade_route")) {
        objective.progress.failedRuns += 1;
        if (event.type === "route_shortage") objective.progress.starvedDays += 1;
    }
    objective.causalEventRefs.push({
        sourceSystem: "trade_routes",
        eventType: event.type,
        routeId: route.id,
        worldEventId: event.id,
        day: event.day
    });
}

function updatePirateAndDominanceProgress(objective) {
    const sector = state.universe[objective.targetSectorId];
    if (!sector) return;
    if (objective.progress.pirateThreatStart === null) {
        objective.progress.pirateThreatStart = Math.max(0, sector.pirateThreat || 0);
    }
    objective.progress.pirateThreatReduction = Math.max(
        0,
        objective.progress.pirateThreatStart - Math.max(0, sector.pirateThreat || 0)
    );
    objective.progress.sponsorDominant = getDominantInfluence(objective.targetSectorId) === getMajorFactionId(objective.sponsorFactionId);
}

function updateCampaignStage(objective) {
    if (!Array.isArray(objective.stageDefinitions) || objective.stageDefinitions.length === 0) return;
    let activeStageIndex = 0;
    for (let index = 0; index < objective.stageDefinitions.length; index += 1) {
        const stage = objective.stageDefinitions[index];
        if (!requirementsComplete({
            throughput: stage.throughput || {},
            routeRuns: stage.routeRuns || 0,
            maxFailedRuns: stage.maxFailedRuns,
            pirateThreatReduction: stage.pirateThreatReduction || 0,
            dominanceRequired: stage.dominanceRequired || false
        }, objective.progress)) {
            activeStageIndex = index;
            break;
        }
        activeStageIndex = index + 1;
    }
    objective.progress.activeStageIndex = Math.min(activeStageIndex, objective.stageDefinitions.length);
}

export function scoreLogisticsObjective(objective) {
    const progress = getProgressTotal(objective.requirements, objective.progress);
    const averageReliability = objective.progress.reliabilitySamples > 0
        ? objective.progress.reliabilityTotal / objective.progress.reliabilitySamples
        : 0;
    const reliabilityScore = averageReliability * BALANCE.LOGISTICS_OBJECTIVE.SCORE_RELIABILITY_WEIGHT;
    const marginScore = Math.max(0, objective.progress.profit) / BALANCE.LOGISTICS_OBJECTIVE.SCORE_MARGIN_DIVISOR;
    const riskScore = objective.progress.riskExposure * BALANCE.LOGISTICS_OBJECTIVE.SCORE_RISK_WEIGHT;
    const strainPenalty = objective.progress.starvedDays * BALANCE.LOGISTICS_OBJECTIVE.SCORE_STARVED_DAY_PENALTY;
    const failurePenalty = objective.progress.failedRuns * BALANCE.LOGISTICS_OBJECTIVE.SCORE_FAILURE_PENALTY;
    return Math.max(0, Math.round(progress + reliabilityScore + marginScore + riskScore - strainPenalty - failurePenalty));
}

function updateObjectiveDerivedProgress(objective) {
    updatePirateAndDominanceProgress(objective);
    updateCampaignStage(objective);
    const total = Math.max(1, getRequirementTotal(objective.requirements));
    objective.progress.score = scoreLogisticsObjective(objective);
    objective.progress.percent = clampRange((getProgressTotal(objective.requirements, objective.progress) / total) * 100, 0, 100);
}

function getObjectiveCreditReward(objective) {
    const baseCredits = Math.max(0, finiteInteger(objective.rewards?.credits, 0));
    if (objective.kind !== "convoy_risk" || baseCredits <= 0) return baseCredits;
    const averageRisk = objective.progress.routeRuns > 0
        ? objective.progress.riskExposure / objective.progress.routeRuns
        : 0;
    const escortShare = objective.progress.routeRuns > 0
        ? objective.progress.escortRuns / objective.progress.routeRuns
        : 0;
    const multiplier = clampRange(
        1
            + averageRisk * BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_RISK_WEIGHT
            + objective.progress.routeHeat * BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_HEAT_WEIGHT
            + escortShare * BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_ESCORT_WEIGHT
            + objective.progress.hullDamageAvoided / BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_DAMAGE_AVOIDED_DIVISOR
            - objective.progress.failedRuns * BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_FAILURE_PENALTY,
        BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_MIN_MULTIPLIER,
        BALANCE.LOGISTICS_OBJECTIVE.CONVOY_PAYOUT_MAX_MULTIPLIER
    );
    return Math.round(baseCredits * multiplier);
}

function applyObjectiveRewards(objective) {
    const rewards = objective.rewards || {};
    const credits = getObjectiveCreditReward(objective);
    if (credits > 0) state.player.credits = (state.player.credits || 0) + credits;
    const sponsor = objective.sponsorFactionId;
    if (finiteInteger(rewards.reputation, 0) !== 0) addFactionRep(sponsor, finiteInteger(rewards.reputation, 0), "logistics objective complete");
    if (finiteInteger(rewards.trust, 0) !== 0) addFactionTrust(sponsor, finiteInteger(rewards.trust, 0), "logistics objective complete");
    const influence = finiteInteger(rewards.influence, 0);
    if (influence !== 0) addSectorInfluence(objective.targetSectorId, getMajorFactionId(sponsor), influence, "logistics campaign delivered");
    const rivalInfluence = finiteInteger(rewards.rivalInfluence, 0);
    const rival = getNearestRivalFactionId(objective.targetSectorId, sponsor);
    if (rival && rivalInfluence !== 0) addSectorInfluence(objective.targetSectorId, rival, rivalInfluence, "rival supply campaign setback");
}

function applyObjectivePenalties(objective) {
    const penalties = objective.penalties || {};
    const sponsor = objective.sponsorFactionId;
    if (finiteInteger(penalties.reputation, 0) !== 0) addFactionRep(sponsor, finiteInteger(penalties.reputation, 0), "logistics objective failed");
    if (finiteInteger(penalties.trust, 0) !== 0) addFactionTrust(sponsor, finiteInteger(penalties.trust, 0), "logistics objective failed");
    if (finiteInteger(penalties.heat, 0) !== 0) addFactionHeat(sponsor, finiteInteger(penalties.heat, 0), "missed logistics promise");
}

function completeObjective(objective) {
    objective.status = "completed";
    applyObjectiveRewards(objective);
    const credits = formatCredits(getObjectiveCreditReward(objective));
    addWorldEvent({
        type: "logistics_objective_completed",
        sourceSystem: "logistics_objectives",
        sectorId: objective.targetSectorId,
        factionId: objective.sponsorFactionId,
        text: `${objective.title} completed in sector ${objective.targetSectorId}. Sponsor paid ${credits} and political pressure shifted.`,
        importance: 3,
        alert: true,
        payload: { objectiveId: objective.id, score: objective.progress.score }
    });
}

function failObjective(objective, reason) {
    objective.status = "failed";
    applyObjectivePenalties(objective);
    addWorldEvent({
        type: "logistics_objective_failed",
        sourceSystem: "logistics_objectives",
        sectorId: objective.targetSectorId,
        factionId: objective.sponsorFactionId,
        text: `${objective.title} failed in sector ${objective.targetSectorId}: ${reason}.`,
        importance: 3,
        alert: true,
        payload: { objectiveId: objective.id, reason }
    });
}

function evaluateObjectiveState(objective) {
    updateObjectiveDerivedProgress(objective);
    const averageReliability = objective.progress.reliabilitySamples > 0
        ? objective.progress.reliabilityTotal / objective.progress.reliabilitySamples
        : 100;
    if (objective.requirements.minReliability && averageReliability < objective.requirements.minReliability) {
        if (getCurrentDay() >= objective.deadlineDay) failObjective(objective, "route reliability was too low");
        return;
    }
    if (typeof objective.requirements.maxFailedRuns === "number"
        && objective.progress.failedRuns > objective.requirements.maxFailedRuns) {
        failObjective(objective, "too many failed route runs");
        return;
    }
    if (requirementsComplete(objective.requirements, objective.progress)) {
        completeObjective(objective);
        return;
    }
    if (getCurrentDay() > objective.deadlineDay) failObjective(objective, "deadline passed before required throughput arrived");
}

export function runLogisticsObjectivesDaily() {
    seedInitialLogisticsObjectives();
    const routeEvents = collectCurrentDayRouteEvents();
    state.logisticsObjectives
        .filter(objective => objective.status === "active")
        .forEach(objective => {
            routeEvents.forEach(event => applyRouteEvent(objective, event));
            evaluateObjectiveState(objective);
            objective.lastEvaluatedDay = getCurrentDay();
        });
}

function getObjectiveRouteRecommendations(objective) {
    const targetSectorId = objective.targetSectorId;
    const sectorIds = new Set([
        ...Object.keys(state.ports).map(Number),
        ...Object.keys(state.planets).map(Number)
    ]);
    sectorIds.delete(targetSectorId);
    return Array.from(sectorIds)
        .map(originSectorId => {
            const metrics = deriveRouteMetrics(originSectorId, targetSectorId);
            if (!metrics.path) return null;
            const commodity = COMMODITIES.find(candidate => {
                return (objective.requirements.throughput?.[candidate] || 0) > (objective.progress.delivered?.[candidate] || 0)
                    && metrics.viableCommodities.includes(candidate);
            }) || metrics.viableCommodities[0];
            if (!commodity) return null;
            const route = state.tradeRoutes.find(candidate => candidate.originSector === originSectorId
                && candidate.destinationSector === targetSectorId
                && candidate.commodity === commodity
                && candidate.status !== "closed");
            const projectedRisk = route ? getRouteRisk(route) : metrics.risk;
            const setupCost = route ? 0 : metrics.setupCost;
            const profit = estimateRouteProfit(originSectorId, targetSectorId, commodity);
            const reliability = route ? route.reliability : BALANCE.TRADE_ROUTE.PLAYER_START_RELIABILITY;
            const score = scoreRoutePlan({
                throughput: route ? route.amount : BALANCE.TRADE_ROUTE_BASE_AMOUNT,
                reliability,
                margin: profit,
                risk: projectedRisk || 0,
                reserveStrain: metrics.surcharge || 0,
                heat: route?.heat || 0
            });
            return { originSectorId, targetSectorId, commodity, metrics, projectedRisk, setupCost, profit, reliability, routeId: route?.id || null, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, BALANCE.LOGISTICS_OBJECTIVE.MAX_RECOMMENDATIONS);
}

export function scoreRoutePlan({ throughput, reliability, margin, risk, reserveStrain, heat }) {
    return Math.round(
        Math.max(0, throughput) * BALANCE.LOGISTICS_OBJECTIVE.PLAN_THROUGHPUT_WEIGHT
        + Math.max(0, reliability) * BALANCE.LOGISTICS_OBJECTIVE.PLAN_RELIABILITY_WEIGHT
        + Math.max(0, margin) / BALANCE.LOGISTICS_OBJECTIVE.PLAN_MARGIN_DIVISOR
        + Math.max(0, risk) * BALANCE.LOGISTICS_OBJECTIVE.PLAN_RISK_WEIGHT
        - Math.max(0, reserveStrain) * BALANCE.LOGISTICS_OBJECTIVE.PLAN_RESERVE_STRAIN_PENALTY
        - Math.max(0, heat) * BALANCE.LOGISTICS_OBJECTIVE.PLAN_HEAT_PENALTY
    );
}

function getForecastQuality(character) {
    const competency = getCharacterStat(character, "command") * 0.45
        + getCharacterStat(character, "tradecraft") * 0.35
        + getCharacterStat(character, "fieldcraft") * 0.20;
    if (competency >= 80) return "high";
    if (competency >= 55) return "average";
    return "low";
}

function fuzzEstimate(value, quality) {
    if (value === null || typeof value === "undefined") return value;
    if (quality === "high") return Math.round(value * 10) / 10;
    if (quality === "average") return Math.round(value);
    return Math.round(value / 5) * 5;
}

export function buildLogisticsObjectivesSnapshot() {
    seedInitialLogisticsObjectives();
    const quality = getForecastQuality(state.player?.character);
    return state.logisticsObjectives
        .filter(objective => !CLOSED_STATUSES.has(objective.status) || objective.lastEvaluatedDay >= getCurrentDay() - 1)
        .map(objective => {
            updateObjectiveDerivedProgress(objective);
            const recommendations = getObjectiveRouteRecommendations(objective).map(recommendation => ({
                ...recommendation,
                projectedRisk: fuzzEstimate(recommendation.projectedRisk, quality),
                reliability: fuzzEstimate(recommendation.reliability + getRouteReliabilityAdjustment(state.player?.character), quality),
                fieldcraftRiskAdjustment: fuzzEstimate(getRouteRiskAdjustment(state.player?.character), quality)
            }));
            return { objective, recommendations, forecastQuality: quality };
        });
}

export function describeObjectiveCommodityProgress(objective) {
    return COMMODITIES
        .filter(commodity => (objective.requirements.throughput?.[commodity] || 0) > 0)
        .map(commodity => {
            const delivered = Math.floor(objective.progress.delivered?.[commodity] || 0);
            const needed = Math.floor(objective.requirements.throughput?.[commodity] || 0);
            return `${formatCommodity(commodity)} ${delivered}/${needed}`;
        })
        .join(" / ");
}

export function logObjectiveSummary(objectiveId) {
    const objective = state.logisticsObjectives.find(candidate => candidate.id === finiteInteger(objectiveId, 0));
    if (!objective) return;
    log(`${objective.title}: ${Math.round(objective.progress.percent)}% complete.`);
}

export { ACTIVE_STATUSES };

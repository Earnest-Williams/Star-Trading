import { state } from '../state.js';
import { BALANCE, FACTIONS, MAJOR_FACTIONS, GUILD_FACTIONS, MARKET_COMMODITIES } from '../constants.js';
import { getPortType } from '../core/ports.js';
import { clampRange, formatCredits, log, random } from '../utils.js';
import { getDominantInfluence, normaliseSectorInfluence, addSectorInfluence, getInfluenceSpread, getSectorStatusLabel } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { ensureFactionState, getFactionRep, getFactionHeat, getFactionLeverage, getFactionTrust, addFactionHeat, addFactionLeverage, recordFactionMemory, getPirateIncidentMultiplier } from '../core/factions.js';
import { Notifications } from '../ui/notifications.js';
import { prepareMissionOpportunity, activePortSectors, makeBaseMission } from '../systems/missions.js';
import { generateFactionAsks } from '../systems/guilds.js';
import { getSectorNeighbors } from '../core/navigation.js';
import { POLITICS } from '../config/politics.js';
import {
    bumpInfluenceRevision,
    bumpLogisticsNodeRevision,
    bumpMarketRevision
} from '../core/state/mutations.js';

export function getSectorPoliticalMemory(sector) {
    if (!sector.politicalMemory) {
        sector.politicalMemory = {
            dominantFactionId: getDominantInfluence(sector.id),
            status: getSectorStatusLabel(sector.id),
            contestedDays: 0
        };
    }
    return sector.politicalMemory;
}

export function adjustFactionRelation(a, b, delta, reason) {
    const fr = state.player && state.player.factionRelations;
    if (!fr || !fr[a] || typeof fr[a][b] !== "number") return;
    fr[a][b] = clampRange(fr[a][b] + delta, -100, 100);
    if (fr[b] && typeof fr[b][a] === "number") {
        fr[b][a] = clampRange(fr[b][a] + delta, -100, 100);
    }
    if (reason && Math.abs(delta) >= 2) {
        addWorldEvent({
            type: "faction_relations", factionId: a,
            text: `${FACTIONS[a].short} relations with ${FACTIONS[b].short} shifted ${delta > 0 ? "+" : ""}${delta}: ${reason}.`,
            importance: 2, alert: false
        });
    }
}

export function recordDominanceChange(sector, before, after, reason) {
    if (!sector || !before || !after || before === after) return;
    addWorldEvent({
        type: "dominance_change", factionId: after, sectorId: sector.id,
        text: `Sector ${sector.id} shifted from ${FACTIONS[before].short} to ${FACTIONS[after].short} dominance after ${reason}.`,
        importance: 4, alert: true
    });
    adjustFactionRelation(after, before, -2, `sector ${sector.id} changed hands`);
    const memory = getSectorPoliticalMemory(sector);
    memory.dominantFactionId = after;
    memory.status = getSectorStatusLabel(sector.id);
}

export function runSectorPoliticsDaily() {
    Object.values(state.universe).forEach(sector => {
        normaliseSectorInfluence(sector);
        const memory = getSectorPoliticalMemory(sector);
        const beforeDominant = getDominantInfluence(sector.id);
        const beforeStatus = getSectorStatusLabel(sector.id);
        updateFrontDaily(sector);
        processContestedSector(sector);
        applyFactionSectorEffects(sector);
        const afterDominant = getDominantInfluence(sector.id);
        const afterStatus = getSectorStatusLabel(sector.id);
        if (beforeStatus === "Contested" || afterStatus === "Contested") memory.contestedDays = (memory.contestedDays || 0) + 1;
        else memory.contestedDays = 0;
        memory.status = afterStatus;
        recordDominanceChange(sector, beforeDominant, afterDominant, "daily political pressure");
    });
}

export function processContestedSector(sector) {
    const spread = getInfluenceSpread(sector.id);
    if (spread.length < POLITICS.CONTESTED.MIN_FACTION_SPREAD) return false;
    const first = spread[0], second = spread[1];
    const gap = first.value - second.value;
    if (gap > BALANCE.CONTESTED_GAP) return false;
    const memory = getSectorPoliticalMemory(sector);
    const contestedDays = memory.contestedDays || 0;
    const topPair = [first.id, second.id];
    if (topPair.includes("vc") && sector.pirateThreat < POLITICS.CONTESTED.PIRATE_SURGE_CAP
        && random() < POLITICS.CONTESTED.PIRATE_SURGE_BASE_CHANCE
            + contestedDays * POLITICS.CONTESTED.PIRATE_SURGE_DAILY_CHANCE) {
        sector.pirateThreat = Math.min(POLITICS.CONTESTED.PIRATE_SURGE_CAP, sector.pirateThreat + 1);
        addWorldEvent({ type: "pirate_surge", factionId: "vc", sectorId: sector.id, text: `Contested control in sector ${sector.id} gave raiders room to surge. Pirate threat is now ${sector.pirateThreat}.`, importance: 3, alert: sector.id === state.player.currentSector });
    }
    if (topPair.includes("sda") && sector.pirateThreat > 0 && random() < POLITICS.CONTESTED.SDA_REDUCTION_BASE_CHANCE + Math.max(0, getFactionRep("sda")) / POLITICS.CONTESTED.SDA_REDUCTION_REP_DIVISOR) {
        sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
        addSectorInfluence(sector.id, "sda", 1, "patrol response in contested space");
    }
    const politicalOpen = state.missions.filter(m => m.status === "available" && m.kind === "political_contest").length;
    if (politicalOpen < BALANCE.POLITICAL_MISSION_LIMIT && random() < POLITICS.CONTESTED.MISSION_BASE_CHANCE + contestedDays * POLITICS.CONTESTED.MISSION_DAILY_CHANCE) {
        const sponsor = random() < POLITICS.CONTESTED.MISSION_SPONSOR_TOP_CHANCE ? first.id : second.id;
        const rival = sponsor === first.id ? second.id : first.id;
        const mission = makeContestMission(sector, sponsor, rival);
        if (mission) {
            state.missions.push(prepareMissionOpportunity(mission));
            addWorldEvent({ type: "political_mission", factionId: sponsor, sectorId: sector.id, text: `${FACTIONS[sponsor].short} posted a conflict contract over sector ${sector.id}: ${mission.title}.`, importance: 3, alert: sector.id === state.player.currentSector });
        }
    }
    return true;
}

export function applyFactionSectorEffects(sector) {
    normaliseSectorInfluence(sector);
    const sda = sector.influence.sda || 0;
    const fu = sector.influence.fu || 0;
    const hc = sector.influence.hc || 0;
    const vc = sector.influence.vc || 0;
    if (sda >= POLITICS.SECTOR_EFFECTS.SDA_THRESHOLD && sector.pirateThreat > 0 && random() < Math.min(POLITICS.SECTOR_EFFECTS.SDA_MAX_REDUCTION_CHANCE,
        (sda - POLITICS.SECTOR_EFFECTS.SDA_CHANCE_OFFSET) / POLITICS.SECTOR_EFFECTS.SDA_CHANCE_DIVISOR)) {
        sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
    }
    if (hc >= POLITICS.SECTOR_EFFECTS.HC_THRESHOLD && sector.asteroids) {
        if (typeof sector.asteroids.maxOre !== "number") sector.asteroids.maxOre = Math.max(sector.asteroids.ore, POLITICS.SECTOR_EFFECTS.HC_MIN_MAX_ORE);
        const regen = Math.floor((POLITICS.SECTOR_EFFECTS.HC_REGEN_BASE + hc * POLITICS.SECTOR_EFFECTS.HC_REGEN_PER_INFLUENCE) * (sector.asteroids.richness || 1));
        sector.asteroids.ore = Math.min(sector.asteroids.maxOre, sector.asteroids.ore + regen);
    }
    const planet = state.planets[sector.id];
    if (fu >= POLITICS.SECTOR_EFFECTS.FU_THRESHOLD && planet && planet.owner && planet.colonists > 0 && random() < POLITICS.SECTOR_EFFECTS.FU_GROWTH_CHANCE) {
        const growth = 1 + Math.floor(fu * POLITICS.SECTOR_EFFECTS.FU_COLONIST_GROWTH_RATE);
        planet.colonists += growth;
        if (typeof planet.satisfaction === "number") planet.satisfaction = Math.min(100, planet.satisfaction + 1);
    }
    if (vc >= POLITICS.SECTOR_EFFECTS.VC_PIRATE_THRESHOLD && random() < Math.min(POLITICS.SECTOR_EFFECTS.VC_PIRATE_MAX_CHANCE,
        (vc - POLITICS.SECTOR_EFFECTS.VC_PIRATE_CHANCE_OFFSET) / POLITICS.SECTOR_EFFECTS.VC_PIRATE_CHANCE_DIVISOR) && sector.pirateThreat < POLITICS.SECTOR_EFFECTS.VC_PIRATE_CAP) {
        sector.pirateThreat = Math.min(POLITICS.SECTOR_EFFECTS.VC_PIRATE_CAP, sector.pirateThreat + 1);
    }
    const port = state.ports[sector.id];
    if (vc >= POLITICS.SECTOR_EFFECTS.VC_FRONT_THRESHOLD && port && !port.hiddenFactionId && random() < POLITICS.SECTOR_EFFECTS.VC_FRONT_CHANCE) {
        port.hiddenFactionId = "vc";
        sector.front = { publicFactionId: port.publicFactionId || port.factionId, hiddenFactionId: "vc", suspicion: POLITICS.SECTOR_EFFECTS.VC_FRONT_SUSPICION_BASE + Math.floor(random() * POLITICS.SECTOR_EFFECTS.VC_FRONT_SUSPICION_SPAN) };
    }
}

export function updateFrontDaily(sector) {
    const port = state.ports[sector.id];
    if (!sector.front && port && port.hiddenFactionId) sector.front = { publicFactionId: port.publicFactionId || port.factionId, hiddenFactionId: port.hiddenFactionId, suspicion: POLITICS.FRONTS.INITIAL_SUSPICION_BASE + Math.floor(random() * POLITICS.FRONTS.INITIAL_SUSPICION_SPAN) };
    if (!sector.front) return;
    const front = sector.front;
    if (!FACTIONS[front.hiddenFactionId]) { sector.front = null; return; }
    const hiddenInfluence = sector.influence[front.hiddenFactionId] || 0;
    const publicInfluence = sector.influence[front.publicFactionId] || 0;
    let suspicionGain = POLITICS.FRONTS.SUSPICION_BASE_GAIN
        + Math.floor(hiddenInfluence / POLITICS.FRONTS.SUSPICION_INFLUENCE_DIVISOR);
    if (sector.surveyed) suspicionGain += POLITICS.FRONTS.SURVEYED_SUSPICION_GAIN;
    if (sector.pirateThreat >= POLITICS.FRONTS.PIRATE_THREAT_SUSPICION_THRESHOLD && front.hiddenFactionId === "vc") suspicionGain += POLITICS.FRONTS.PIRATE_THREAT_SUSPICION_GAIN;
    if (publicInfluence > hiddenInfluence + POLITICS.FRONTS.HIDDEN_ADVANTAGE_THRESHOLD
        && random() < POLITICS.FRONTS.PUBLIC_ADVANTAGE_CHANCE) {
        suspicionGain -= POLITICS.FRONTS.PUBLIC_ADVANTAGE_REDUCTION;
    }
    front.suspicion = clampRange((front.suspicion || 0) + suspicionGain, 0, 100);
    if (front.suspicion >= BALANCE.FRONT_EXPOSURE_THRESHOLD && random() < (sector.surveyed
        ? POLITICS.FRONTS.SURVEYED_EXPOSURE_CHANCE : POLITICS.FRONTS.UNSURVEYED_EXPOSURE_CHANCE)) exposeFrontOperation(sector);
}

export function exposeFrontOperation(sector) {
    if (!sector.front) return;
    const front = sector.front;
    const hiddenId = front.hiddenFactionId;
    const publicId = front.publicFactionId;
    const port = state.ports[sector.id];
    if (port && port.hiddenFactionId === hiddenId) port.hiddenFactionId = null;
    sector.front = null;
    normaliseSectorInfluence(sector);
    sector.influence[hiddenId] = clampRange((sector.influence[hiddenId] || 0) + POLITICS.FRONTS.HIDDEN_INFLUENCE_ON_EXPOSED, 0, 100);
    if (MAJOR_FACTIONS.includes(publicId)) addSectorInfluence(sector.id, publicId, POLITICS.FRONTS.PUBLIC_INFLUENCE_ON_EXPOSED, "front operation exposed");
    if (hiddenId === "vc") addSectorInfluence(sector.id, "sda", POLITICS.FRONTS.SDA_INFLUENCE_ON_VC_EXPOSED, "anti-front enforcement action");
    adjustFactionRelation(publicId, hiddenId, POLITICS.FRONTS.RELATION_ON_EXPOSED, `front exposed in sector ${sector.id}`);
    addWorldEvent({ type: "front_exposed", factionId: hiddenId, sectorId: sector.id, text: `${FACTIONS[hiddenId].short} front activity in sector ${sector.id} was exposed and publicly dismantled.`, importance: POLITICS.FRONTS.EVENT_IMPORTANCE, alert: true });
}

export function runFactionExpansion() {
    Object.values(state.universe).forEach(source => {
        const spread = getInfluenceSpread(source.id);
        if (spread.length === 0) return;
        const strongest = spread[0];
        if (strongest.value < BALANCE.FACTION_EXPANSION_MIN_INFLUENCE) return;
        getSectorNeighbors(source.id).forEach(targetId => {
            const target = state.universe[targetId];
            if (!target) return;
            const before = getDominantInfluence(targetId);
            if (before === strongest.id && (target.influence[strongest.id] || 0) >= POLITICS.EXPANSION.OWNED_TARGET_INFLUENCE_FLOOR) return;
            let chance = (strongest.value - POLITICS.EXPANSION.SOURCE_THRESHOLD) / POLITICS.EXPANSION.CHANCE_DIVISOR;
            if (strongest.id === "sda" && source.region === "Core") chance += POLITICS.EXPANSION.SDA_CORE_BONUS;
            if (strongest.id === "fu" && target.region === "Frontier") chance += POLITICS.EXPANSION.FU_FRONTIER_BONUS;
            if (strongest.id === "hc" && (target.asteroids || state.ports[targetId])) chance += POLITICS.EXPANSION.HC_ASTEROID_BONUS;
            if (strongest.id === "vc" && target.region === "Badlands") chance += POLITICS.EXPANSION.VC_BADLANDS_BONUS;
            if (getSectorStatusLabel(targetId) === "Contested") chance += POLITICS.EXPANSION.CONTESTED_TARGET_BONUS;
            if (random() > Math.min(POLITICS.EXPANSION.MAX_CHANCE, chance)) return;
            addSectorInfluence(targetId, strongest.id, strongest.value >= POLITICS.EXPANSION.STRONG_INFLUENCE_THRESHOLD
                ? POLITICS.EXPANSION.STRONG_GAIN : POLITICS.EXPANSION.NORMAL_GAIN, "");
            const after = getDominantInfluence(targetId);
            if (after !== before) recordDominanceChange(target, before, after, `expansion pressure from sector ${source.id}`);
        });
    });
}

export function makeContestMission(sector, sponsorId, rivalId) {
    if (!sector || !FACTIONS[sponsorId]) return null;
    const originCandidates = activePortSectors().sort((a, b) => Math.abs(a - sector.id) - Math.abs(b - sector.id));
    const origin = state.ports[sector.id] ? sector.id : originCandidates[0];
    if (!origin) return null;
    const templates = POLITICS.CONTEST_MISSIONS.TEMPLATES;
    const template = templates[sponsorId] || templates.fu;
    const reward = template.reward
        + (sector.pirateThreat || 0) * POLITICS.CONTEST_MISSIONS.PIRATE_THREAT_REWARD
        + sector.id * POLITICS.CONTEST_MISSIONS.SECTOR_REWARD;
    const m = makeBaseMission(`${template.verb} in sector ${sector.id}`, origin, reward, POLITICS.CONTEST_MISSIONS.EXPIRES_DAYS);
    m.type = "contest";
    m.kind = "political_contest";
    m.factionId = sponsorId;
    m.rivalFactionId = rivalId;
    m.targetSector = sector.id;
    m.operation = template.operation;
    m.operationMinutes = template.minutes;
    m.rewardRep = POLITICS.CONTEST_MISSIONS.REWARD_REP;
    m.visibility = sponsorId === "vc" ? "quiet" : "public";
    m.risk = getSectorStatusLabel(sector.id).toLowerCase();
    m.title = `${FACTIONS[sponsorId].short}: ${template.verb} in sector ${sector.id}`;
    m.context = FACTIONS[rivalId] ? `${FACTIONS[sponsorId].name} wants leverage against ${FACTIONS[rivalId].name}.` : `${FACTIONS[sponsorId].name} wants local leverage.`;
    return m;
}

export function maybeGrantPoliticalIntel() {
    ensureFactionState();
    const current = state.universe[state.player.currentSector];
    if (!current) return;
    const nearby = [state.player.currentSector].concat(getSectorNeighbors(state.player.currentSector));
    nearby.forEach(sectorId => {
        const sector = state.universe[sectorId];
        if (!sector) return;
        const spread = getInfluenceSpread(sectorId);
        const dominant = spread[0] ? spread[0].id : "fu";
        const interesting = getSectorStatusLabel(sectorId) === "Contested" || Boolean(sector.front) || (sector.pirateThreat || 0) >= POLITICS.INTEL.INTERESTING_PIRATE_THREAT;
        if (!interesting) return;
        if (state.player.factions.intel.some(item => item.type === "political_daily" && item.sectorId === sectorId && item.expiresDay >= state.player.time.day)) return;
        const chance = Math.min(POLITICS.INTEL.MAX_CHANCE, BALANCE.POLITICAL_INTEL_BASE_CHANCE + Math.max(0, getFactionRep(dominant)) / POLITICS.INTEL.REP_DIVISOR + Math.max(0, getFactionTrust(dominant)) / POLITICS.INTEL.TRUST_DIVISOR + (sectorId === state.player.currentSector ? POLITICS.INTEL.CURRENT_SECTOR_BONUS : POLITICS.INTEL.NEARBY_SECTOR_BONUS));
        if (random() > chance) return;
        let msg = `${FACTIONS[dominant].short} contacts report political movement in sector ${sectorId}.`;
        if (sector.front) msg = `Whispers point to a front operation in sector ${sectorId}; suspicion is around ${sector.front.suspicion}.`;
        else if (getSectorStatusLabel(sectorId) === "Contested") msg = `Local contacts say sector ${sectorId} is contested between ${spread.slice(0, 2).map(item => FACTIONS[item.id].short).join(" and ")}.`;
        else if ((sector.pirateThreat || 0) >= POLITICS.INTEL.INTERESTING_PIRATE_THREAT) msg = `Route chatter flags pirate pressure in sector ${sectorId} at threat ${sector.pirateThreat}.`;
        state.player.factions.intel.push({ type: "political_daily", factionId: dominant, sectorId, value: POLITICS.INTEL.VALUE_BASE + Math.floor(random() * POLITICS.INTEL.VALUE_SPAN), expiresDay: state.player.time.day + POLITICS.INTEL.EXPIRES_DAYS, text: msg, id: state.player.factions.nextIntelId++ });
    });
}

export function updateFactionsDaily() {
    ensureFactionState();
    MAJOR_FACTIONS.forEach(id => {
        if (getFactionHeat(id) > 0 && random() < POLITICS.FACTION_DRIFT.HEAT_DECAY_CHANCE) state.player.factions.heat[id] = Math.max(0, state.player.factions.heat[id] - 1);
        if (getFactionLeverage(id) > 0 && random() < POLITICS.FACTION_DRIFT.LEVERAGE_DECAY_CHANCE) state.player.factions.leverage[id] = Math.max(0, state.player.factions.leverage[id] - 1);
    });
    GUILD_FACTIONS.forEach(id => {
        if (getFactionTrust(id) > 0 && random() < POLITICS.FACTION_DRIFT.GUILD_TRUST_DECAY_CHANCE) state.player.factions.trust[id] -= 1;
    });
    if (getFactionHeat("sda") >= POLITICS.FACTION_DRIFT.SDA_FINE_HEAT_THRESHOLD && random() < POLITICS.FACTION_DRIFT.SDA_FINE_CHANCE) {
        const fine = Math.min(state.player.credits, POLITICS.FACTION_DRIFT.SDA_FINE_BASE + Math.floor(random() * POLITICS.FACTION_DRIFT.SDA_FINE_SPAN));
        state.player.credits -= fine;
        addFactionHeat("sda", POLITICS.FACTION_DRIFT.SDA_FINE_HEAT_REDUCTION, "inspection fine paid");
        addFactionLeverage("sda", POLITICS.FACTION_DRIFT.SDA_FINE_LEVERAGE_GAIN, "cargo audit file");
        recordFactionMemory("sda", "unpaidFines", fine > 0 ? 0 : 1);
        log(`SDA inspection sweep hit your records. Paid ${formatCredits(fine)} credits; heat dropped.`);
        Notifications.show(`SDA inspection: paid ${formatCredits(fine)}c fine`, 3);
    }
    if (random() < POLITICS.FACTION_DRIFT.RELATION_NEWS_CHANCE) {
        const pair = random() < POLITICS.FACTION_DRIFT.RELATION_PAIR_SPLIT_CHANCE ? ["sda", "vc"] : ["fu", "hc"];
        const delta = pair[0] === "sda" ? -1 : (random() < POLITICS.FACTION_DRIFT.RELATION_DELTA_SPLIT_CHANCE ? -1 : 1);
        const fr = state.player.factionRelations;
        if (fr && fr[pair[0]] && fr[pair[1]]) {
            fr[pair[0]][pair[1]] = Math.max(-100, Math.min(100, fr[pair[0]][pair[1]] + delta));
            fr[pair[1]][pair[0]] = Math.max(-100, Math.min(100, fr[pair[1]][pair[0]] + delta));
        }
        if (delta < 0 && pair.includes("vc")) {
            Object.values(state.universe).forEach(sector => {
                if (sector.region !== "Core" || random() > POLITICS.FACTION_DRIFT.CORE_PIRATE_PROBE_CHANCE) return;
                sector.pirateThreat = Math.min(POLITICS.FACTION_DRIFT.CORE_PIRATE_PROBE_CAP, sector.pirateThreat + 1);
                addSectorInfluence(sector.id, "vc", 1, "");
            });
            log("Faction news: SDA–VC tensions flare. Core pirate probes increased slightly.");
        }
    }
    runSectorPoliticsDaily();
    runFactionExpansion();
    maybeGrantPoliticalIntel();
    state.player.factions.intel = state.player.factions.intel.filter(item => item.expiresDay >= state.player.time.day);
    generateFactionAsks();
}

export function updatePortsDaily() {
    let stockChanged = false;
    Object.values(state.ports).forEach(port => {
        const type = getPortType(port);
        MARKET_COMMODITIES.forEach(c => {
            const before = port.stock[c];
            if (type.sells.includes(c)) {
                const refill = Math.ceil(port.maxStock[c] * (POLITICS.PORT_ECONOMY.SELLER_REFILL_BASE + random() * POLITICS.PORT_ECONOMY.SELLER_REFILL_SPAN));
                port.stock[c] = Math.min(port.maxStock[c], port.stock[c] + refill);
            }
            if (type.buys.includes(c)) {
                const consumption = Math.ceil(port.maxStock[c] * (POLITICS.PORT_ECONOMY.BUYER_CONSUMPTION_BASE + random() * POLITICS.PORT_ECONOMY.BUYER_CONSUMPTION_SPAN));
                port.stock[c] = Math.max(0, port.stock[c] - consumption);
            }
            if (port.stock[c] !== before) stockChanged = true;
        });
    });
    if (stockChanged) {
        bumpMarketRevision();
        bumpLogisticsNodeRevision();
    }
}

export function updateThreatsDaily() {
    let threatChanged = false;
    Object.values(state.universe).forEach(sector => {
        if (sector.region === "Core") return;
        let chance = sector.region === "Badlands" ? POLITICS.THREATS.BADLANDS_BASE_CHANCE : POLITICS.THREATS.FRONTIER_BASE_CHANCE;
        const spread = getInfluenceSpread(sector.id);
        const top = spread[0] ? spread[0].id : "fu";
        if (top === "sda") chance += POLITICS.THREATS.SDA_CHANCE_MODIFIER;
        if (top === "fu") chance += POLITICS.THREATS.FU_CHANCE_MODIFIER;
        if (top === "vc") chance += POLITICS.THREATS.VC_CHANCE_MODIFIER;
        const planet = state.planets[sector.id];
        if (planet && planet.owner === "Player") {
            chance += planet.buildings.defense * POLITICS.THREATS.DEFENSE_CHANCE_MODIFIER;
            if (planet.policy && planet.policy.security === "cartel_protection") chance += POLITICS.THREATS.CARTEL_PROTECTION_MODIFIER;
            if (planet.policy && planet.policy.security === "sda_patrol") chance += POLITICS.THREATS.SDA_PATROL_MODIFIER;
        }
        chance *= getPirateIncidentMultiplier();
        if (random() < Math.max(POLITICS.THREATS.MIN_CHANCE, chance)) {
            const beforeThreat = sector.pirateThreat;
            sector.pirateThreat = Math.min(POLITICS.THREATS.PIRATE_THREAT_CAP, sector.pirateThreat + 1);
            if (sector.pirateThreat !== beforeThreat) threatChanged = true;
            if (top === "vc") addSectorInfluence(sector.id, "vc", 1, "");
        }
    });
    if (threatChanged) bumpInfluenceRevision();
}

import { state } from '../state.js';
import { BALANCE, FACTIONS, MAJOR_FACTIONS, GUILD_FACTIONS, COMMODITIES } from '../constants.js';
import { clampRange, formatCredits, log, random } from '../utils.js';
import { getDominantInfluence, normaliseSectorInfluence, addSectorInfluence, getInfluenceSpread, getSectorStatusLabel } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { ensureFactionState, getFactionRep, getFactionHeat, getFactionLeverage, getFactionTrust, addFactionRep, addFactionHeat, addFactionLeverage, addFactionTrust, getGuildTier, recordFactionMemory, applyPoliticalEffect, getFactionPoliticalPole, getPirateIncidentMultiplier } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { prepareMissionOpportunity, activePortSectors, makeBaseMission } from '../systems/missions.js';
import { generateFactionAsks } from '../systems/guilds.js';
import { PORT_TYPES } from '../constants.js';
import { getSectorNeighbors } from '../core/navigation.js';

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
    if (spread.length < 2) return false;
    const first = spread[0], second = spread[1];
    const gap = first.value - second.value;
    if (gap > BALANCE.CONTESTED_GAP) return false;
    const memory = getSectorPoliticalMemory(sector);
    const contestedDays = memory.contestedDays || 0;
    const topPair = [first.id, second.id];
    if (topPair.includes("vc") && sector.pirateThreat < 6 && random() < 0.14 + contestedDays * 0.015) {
        sector.pirateThreat = Math.min(6, sector.pirateThreat + 1);
        addWorldEvent({ type: "pirate_surge", factionId: "vc", sectorId: sector.id, text: `Contested control in sector ${sector.id} gave raiders room to surge. Pirate threat is now ${sector.pirateThreat}.`, importance: 3, alert: sector.id === state.player.currentSector });
    }
    if (topPair.includes("sda") && sector.pirateThreat > 0 && random() < 0.18 + Math.max(0, getFactionRep("sda")) / 4000) {
        sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
        addSectorInfluence(sector.id, "sda", 1, "patrol response in contested space");
    }
    const politicalOpen = state.missions.filter(m => m.status === "available" && m.kind === "political_contest").length;
    if (politicalOpen < BALANCE.POLITICAL_MISSION_LIMIT && random() < 0.18 + contestedDays * 0.01) {
        const sponsor = random() < 0.58 ? first.id : second.id;
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
    if (sda >= 55 && sector.pirateThreat > 0 && random() < Math.min(0.45, (sda - 45) / 130)) {
        sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
    }
    if (hc >= 55 && sector.asteroids) {
        if (typeof sector.asteroids.maxOre !== "number") sector.asteroids.maxOre = Math.max(sector.asteroids.ore, 2500);
        const regen = Math.floor((12 + hc * 0.65) * (sector.asteroids.richness || 1));
        sector.asteroids.ore = Math.min(sector.asteroids.maxOre, sector.asteroids.ore + regen);
    }
    const planet = state.planets[sector.id];
    if (fu >= 55 && planet && planet.owner && planet.colonists > 0 && random() < 0.28) {
        const growth = 1 + Math.floor(fu / 35);
        planet.colonists += growth;
        if (typeof planet.satisfaction === "number") planet.satisfaction = Math.min(100, planet.satisfaction + 1);
    }
    if (vc >= 50 && random() < Math.min(0.32, (vc - 40) / 150) && sector.pirateThreat < 6) {
        sector.pirateThreat = Math.min(6, sector.pirateThreat + 1);
    }
    const port = state.ports[sector.id];
    if (vc >= 58 && port && !port.hiddenFactionId && random() < 0.055) {
        port.hiddenFactionId = "vc";
        sector.front = { publicFactionId: port.publicFactionId || port.factionId, hiddenFactionId: "vc", suspicion: 12 + Math.floor(random() * 18) };
    }
}

export function updateFrontDaily(sector) {
    const port = state.ports[sector.id];
    if (!sector.front && port && port.hiddenFactionId) sector.front = { publicFactionId: port.publicFactionId || port.factionId, hiddenFactionId: port.hiddenFactionId, suspicion: 10 + Math.floor(random() * 15) };
    if (!sector.front) return;
    const front = sector.front;
    if (!FACTIONS[front.hiddenFactionId]) { sector.front = null; return; }
    const hiddenInfluence = sector.influence[front.hiddenFactionId] || 0;
    const publicInfluence = sector.influence[front.publicFactionId] || 0;
    let suspicionGain = 1 + Math.floor(hiddenInfluence / 30);
    if (sector.surveyed) suspicionGain += 1;
    if (sector.pirateThreat >= 3 && front.hiddenFactionId === "vc") suspicionGain += 1;
    if (publicInfluence > hiddenInfluence + 20 && random() < 0.45) suspicionGain -= 1;
    front.suspicion = clampRange((front.suspicion || 0) + suspicionGain, 0, 100);
    if (front.suspicion >= BALANCE.FRONT_EXPOSURE_THRESHOLD && random() < (sector.surveyed ? 0.68 : 0.38)) exposeFrontOperation(sector);
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
    sector.influence[hiddenId] = clampRange((sector.influence[hiddenId] || 0) - 9, 0, 100);
    if (MAJOR_FACTIONS.includes(publicId)) addSectorInfluence(sector.id, publicId, 4, "front operation exposed");
    if (hiddenId === "vc") addSectorInfluence(sector.id, "sda", 2, "anti-front enforcement action");
    adjustFactionRelation(publicId, hiddenId, -3, `front exposed in sector ${sector.id}`);
    addWorldEvent({ type: "front_exposed", factionId: hiddenId, sectorId: sector.id, text: `${FACTIONS[hiddenId].short} front activity in sector ${sector.id} was exposed and publicly dismantled.`, importance: 4, alert: true });
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
            if (before === strongest.id && (target.influence[strongest.id] || 0) >= 72) return;
            let chance = (strongest.value - 58) / 260;
            if (strongest.id === "sda" && source.region === "Core") chance += 0.025;
            if (strongest.id === "fu" && target.region === "Frontier") chance += 0.035;
            if (strongest.id === "hc" && (target.asteroids || state.ports[targetId])) chance += 0.035;
            if (strongest.id === "vc" && target.region === "Badlands") chance += 0.055;
            if (getSectorStatusLabel(targetId) === "Contested") chance += 0.035;
            if (random() > Math.min(0.32, chance)) return;
            addSectorInfluence(targetId, strongest.id, strongest.value >= 82 ? 2 : 1, "");
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
    const templates = {
        sda: { verb: "Run patrol pressure", operation: "patrol", minutes: 90, reward: 1900 },
        fu: { verb: "Rally frontier support", operation: "rally", minutes: 75, reward: 1750 },
        hc: { verb: "Secure industrial claims", operation: "claims", minutes: 90, reward: 2050 },
        vc: { verb: "Disrupt official control", operation: "disrupt", minutes: 75, reward: 2200 }
    };
    const template = templates[sponsorId] || templates.fu;
    const m = makeBaseMission(`${template.verb} in sector ${sector.id}`, origin, template.reward + (sector.pirateThreat || 0) * 220 + sector.id * 12, 4);
    m.type = "contest";
    m.kind = "political_contest";
    m.factionId = sponsorId;
    m.rivalFactionId = rivalId;
    m.targetSector = sector.id;
    m.operation = template.operation;
    m.operationMinutes = template.minutes;
    m.rewardRep = 3;
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
        const interesting = getSectorStatusLabel(sectorId) === "Contested" || Boolean(sector.front) || (sector.pirateThreat || 0) >= 3;
        if (!interesting) return;
        if (state.player.factions.intel.some(item => item.type === "political_daily" && item.sectorId === sectorId && item.expiresDay >= state.player.time.day)) return;
        const chance = Math.min(0.34, BALANCE.POLITICAL_INTEL_BASE_CHANCE + Math.max(0, getFactionRep(dominant)) / 3500 + Math.max(0, getFactionTrust(dominant)) / 700 + (sectorId === state.player.currentSector ? 0.08 : 0.03));
        if (random() > chance) return;
        let msg = `${FACTIONS[dominant].short} contacts report political movement in sector ${sectorId}.`;
        if (sector.front) msg = `Whispers point to a front operation in sector ${sectorId}; suspicion is around ${sector.front.suspicion}.`;
        else if (getSectorStatusLabel(sectorId) === "Contested") msg = `Local contacts say sector ${sectorId} is contested between ${spread.slice(0, 2).map(item => FACTIONS[item.id].short).join(" and ")}.`;
        else if ((sector.pirateThreat || 0) >= 3) msg = `Route chatter flags pirate pressure in sector ${sectorId} at threat ${sector.pirateThreat}.`;
        state.player.factions.intel.push({ type: "political_daily", factionId: dominant, sectorId, value: 25 + Math.floor(random() * 20), expiresDay: state.player.time.day + 5, text: msg, id: state.player.factions.nextIntelId++ });
    });
}

export function updateFactionsDaily() {
    ensureFactionState();
    MAJOR_FACTIONS.forEach(id => {
        if (getFactionHeat(id) > 0 && random() < 0.45) state.player.factions.heat[id] = Math.max(0, state.player.factions.heat[id] - 1);
        if (getFactionLeverage(id) > 0 && random() < 0.12) state.player.factions.leverage[id] = Math.max(0, state.player.factions.leverage[id] - 1);
    });
    GUILD_FACTIONS.forEach(id => {
        if (getFactionTrust(id) > 0 && random() < 0.08) state.player.factions.trust[id] -= 1;
    });
    if (getFactionHeat("sda") >= 70 && random() < 0.35) {
        const fine = Math.min(state.player.credits, 400 + Math.floor(random() * 900));
        state.player.credits -= fine;
        addFactionHeat("sda", -12, "inspection fine paid");
        addFactionLeverage("sda", 2, "cargo audit file");
        recordFactionMemory("sda", "unpaidFines", fine > 0 ? 0 : 1);
        log(`SDA inspection sweep hit your records. Paid ${formatCredits(fine)} credits; heat dropped.`);
        Notifications.show(`SDA inspection: paid ${formatCredits(fine)}c fine`, 3);
    }
    if (random() < 0.30) {
        const pair = random() < 0.5 ? ["sda", "vc"] : ["fu", "hc"];
        const delta = pair[0] === "sda" ? -1 : (random() < 0.5 ? -1 : 1);
        const fr = state.player.factionRelations;
        if (fr && fr[pair[0]] && fr[pair[1]]) {
            fr[pair[0]][pair[1]] = Math.max(-100, Math.min(100, fr[pair[0]][pair[1]] + delta));
            fr[pair[1]][pair[0]] = Math.max(-100, Math.min(100, fr[pair[1]][pair[0]] + delta));
        }
        if (delta < 0 && pair.includes("vc")) {
            Object.values(state.universe).forEach(sector => {
                if (sector.region !== "Core" || random() > 0.10) return;
                sector.pirateThreat = Math.min(4, sector.pirateThreat + 1);
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
    Object.values(state.ports).forEach(port => {
        const type = PORT_TYPES[port.typeKey];
        COMMODITIES.forEach(c => {
            if (type.sells.includes(c)) {
                const refill = Math.ceil(port.maxStock[c] * (0.06 + random() * 0.05));
                port.stock[c] = Math.min(port.maxStock[c], port.stock[c] + refill);
            }
            if (type.buys.includes(c)) {
                const consumption = Math.ceil(port.maxStock[c] * (0.03 + random() * 0.04));
                port.stock[c] = Math.max(0, port.stock[c] - consumption);
            }
        });
    });
}

export function updateThreatsDaily() {
    Object.values(state.universe).forEach(sector => {
        if (sector.region === "Core") return;
        let chance = sector.region === "Badlands" ? 0.22 : 0.12;
        const spread = getInfluenceSpread(sector.id);
        const top = spread[0] ? spread[0].id : "fu";
        if (top === "sda") chance -= 0.06;
        if (top === "fu") chance -= 0.02;
        if (top === "vc") chance += 0.07;
        const planet = state.planets[sector.id];
        if (planet && planet.owner === "Player") {
            chance -= planet.buildings.defense * 0.04;
            if (planet.policy && planet.policy.security === "cartel_protection") chance -= 0.05;
            if (planet.policy && planet.policy.security === "sda_patrol") chance -= 0.06;
        }
        chance *= getPirateIncidentMultiplier();
        if (random() < Math.max(0.02, chance)) {
            sector.pirateThreat = Math.min(6, sector.pirateThreat + 1);
            if (top === "vc") addSectorInfluence(sector.id, "vc", 1, "");
        }
    });
}

import { state } from '../state.js';
import { MAJOR_FACTIONS } from '../constants.js';
import { clampRange } from '../utils.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { getFactionRep, getFactionHeat } from '../core/factions.js';
import { getSectorStatusLabel } from '../core/influence.js';
import { makeBaseMission, prepareMissionOpportunity } from './missions.js';
import { ENTANGLEMENTS } from '../config/entanglements.js';

const PLAYER_PARTY = Object.freeze({ type: "player", id: "player" });

function sameParty(a, b) {
    return a && b && a.type === b.type && String(a.id) === String(b.id);
}

function hasParty(entanglement, party) {
    return (entanglement.parties || []).some(p => sameParty(p, party));
}

function makeCaptainParty(captainId) {
    return { type: "captain", id: captainId };
}

export function makeContactParty(contactId) {
    return { type: "contact", id: contactId };
}

function getHighestEntanglementId() {
    return state.entanglements.reduce((highest, entanglement) => {
        return typeof entanglement.id === "number"
            ? Math.max(highest, entanglement.id)
            : highest;
    }, 0);
}

function getCurrentDay() {
    return state.player?.time?.day || 1;
}

export function normaliseEntanglements() {
    if (!Array.isArray(state.entanglements)) state.entanglements = [];
    if (typeof state.nextEntanglementId !== "number") {
        state.nextEntanglementId = getHighestEntanglementId() + 1;
    }

    state.entanglements.forEach(entanglement => {
        if (!entanglement.id) entanglement.id = state.nextEntanglementId++;
        if (!Array.isArray(entanglement.parties)) entanglement.parties = [PLAYER_PARTY];
        if (typeof entanglement.strength !== "number") entanglement.strength = 0;
        if (typeof entanglement.pressure !== "number") entanglement.pressure = 0;
        if (typeof entanglement.publicKnown !== "boolean") entanglement.publicKnown = false;
        if (typeof entanglement.createdDay !== "number") entanglement.createdDay = getCurrentDay();
        if (typeof entanglement.lastTouchedDay !== "number") entanglement.lastTouchedDay = entanglement.createdDay;
        if (typeof entanglement.cooldownUntilDay !== "number") entanglement.cooldownUntilDay = 0;
        if (!Array.isArray(entanglement.tags)) entanglement.tags = [];
        if (!entanglement.data || typeof entanglement.data !== "object" || Array.isArray(entanglement.data)) entanglement.data = {};
    });

    state.nextEntanglementId = Math.max(state.nextEntanglementId, getHighestEntanglementId() + 1);
}

export function getEntanglementsForParty(party, kind = null) {
    return state.entanglements.filter(entanglement => {
        if (kind && entanglement.kind !== kind) return false;
        return hasParty(entanglement, party);
    });
}

export function getCaptainEntanglements(captainId, kind = null) {
    return getEntanglementsForParty(makeCaptainParty(captainId), kind);
}

export function findEntanglement(kind, partyA, partyB) {
    return state.entanglements.find(entanglement => {
        if (entanglement.kind !== kind) return false;
        return hasParty(entanglement, partyA) && hasParty(entanglement, partyB);
    }) || null;
}

export function addOrNudgeEntanglement({
    kind,
    parties,
    strength = 0,
    pressure = 0,
    publicKnown = false,
    source = "unknown",
    data = {}
}) {
    normaliseEntanglements();

    const existing = state.entanglements.find(entanglement => {
        if (entanglement.kind !== kind) return false;
        return parties.every(party => hasParty(entanglement, party));
    });

    if (existing) {
        existing.strength = clampRange((existing.strength || 0) + strength, -100, 100);
        existing.pressure = clampRange((existing.pressure || 0) + pressure, 0, 100);
        existing.publicKnown = existing.publicKnown || publicKnown;
        existing.lastTouchedDay = getCurrentDay();
        existing.source = source;
        existing.data = { ...(existing.data || {}), ...data };
        return existing;
    }

    const entanglement = {
        id: state.nextEntanglementId++,
        kind,
        parties: parties.map(party => ({ ...party })),
        strength: clampRange(strength, -100, 100),
        pressure: clampRange(pressure, 0, 100),
        publicKnown,
        source,
        data: { ...data },
        tags: [],
        createdDay: getCurrentDay(),
        lastTouchedDay: getCurrentDay(),
        cooldownUntilDay: 0
    };

    state.entanglements.push(entanglement);
    return entanglement;
}

export function canStartRomanceWithCaptain(captainId) {
    const captain = state.captains[captainId];
    if (!captain || captain.status !== "active") {
        return { ok: false, reason: "Captain unavailable." };
    }
    if (captain.currentSector !== state.player.currentSector) {
        return { ok: false, reason: "They are not in this sector." };
    }

    if (findEntanglement(
        ENTANGLEMENTS.KINDS.ROMANCE,
        PLAYER_PARTY,
        makeCaptainParty(captainId)
    )) {
        return { ok: false, reason: "A personal bond is already in motion." };
    }

    const rel = captain.relationshipToPlayer || {};
    if ((rel.rivalry || 0) >= 40) {
        return { ok: false, reason: "Too much bad blood right now." };
    }
    if ((rel.opinion || 0) < ENTANGLEMENTS.ROMANCE.MIN_OPINION) {
        return { ok: false, reason: "They do not know you well enough." };
    }
    if ((rel.trust || 0) < ENTANGLEMENTS.ROMANCE.MIN_TRUST) {
        return { ok: false, reason: "There is not enough trust yet." };
    }

    return { ok: true, reason: "" };
}

export function startRomanceWithCaptain(captainId) {
    const check = canStartRomanceWithCaptain(captainId);
    if (!check.ok) {
        console.log(check.reason);
        return false;
    }

    const captain = state.captains[captainId];
    const entanglement = addOrNudgeEntanglement({
        kind: ENTANGLEMENTS.KINDS.ROMANCE,
        parties: [PLAYER_PARTY, makeCaptainParty(captainId)],
        strength: ENTANGLEMENTS.ROMANCE.INTEREST_STRENGTH,
        pressure: 4,
        publicKnown: false,
        source: "personal_overture",
        data: {
            stage: ENTANGLEMENTS.ROMANCE_STAGES.INTEREST,
            discretion: ENTANGLEMENTS.ROMANCE.DEFAULT_DISCRETION,
            commitment: 0,
            loyaltyConflict: 0,
            legacyWeight: 0
        }
    });

    addWorldEvent({
        type: "entanglement",
        captainId,
        sectorId: captain.currentSector,
        text: `${captain.name} let the conversation become personal.`,
        importance: 2,
        alert: true
    });

    return entanglement;
}

export function canDeepenRomanceWithCaptain(captainId) {
    const captain = state.captains[captainId];
    if (!captain || captain.status !== "active") {
        return { ok: false, reason: "Captain unavailable." };
    }
    if (captain.currentSector !== state.player.currentSector) {
        return { ok: false, reason: "They are not in this sector." };
    }

    const entanglement = findEntanglement(
        ENTANGLEMENTS.KINDS.ROMANCE,
        PLAYER_PARTY,
        makeCaptainParty(captainId)
    );

    if (!entanglement) return canStartRomanceWithCaptain(captainId);

    if (entanglement.cooldownUntilDay > getCurrentDay()) {
        return { ok: false, reason: `${captain.name} needs time before this goes further.` };
    }

    return { ok: true, reason: "" };
}

export function deepenRomanceWithCaptain(captainId) {
    const check = canDeepenRomanceWithCaptain(captainId);
    if (!check.ok) {
        console.log(check.reason);
        return false;
    }

    const captain = state.captains[captainId];
    const entanglement = findEntanglement(
        ENTANGLEMENTS.KINDS.ROMANCE,
        PLAYER_PARTY,
        makeCaptainParty(captainId)
    );

    if (!entanglement) return startRomanceWithCaptain(captainId);

    entanglement.strength = clampRange(entanglement.strength + 12, 0, 100);
    entanglement.pressure = clampRange(entanglement.pressure + 3, 0, 100);
    entanglement.lastTouchedDay = getCurrentDay();
    entanglement.cooldownUntilDay = getCurrentDay() + ENTANGLEMENTS.ROMANCE.MIN_DAYS_BETWEEN_DEEPEN;

    const data = entanglement.data || {};
    if (entanglement.strength >= ENTANGLEMENTS.ROMANCE.COMMITTED_STRENGTH) {
        data.stage = ENTANGLEMENTS.ROMANCE_STAGES.COMMITTED;
        data.commitment = Math.max(data.commitment || 0, 70);
        data.legacyWeight = Math.max(data.legacyWeight || 0, 35);
    } else if (entanglement.strength >= ENTANGLEMENTS.ROMANCE.BOND_STRENGTH) {
        data.stage = ENTANGLEMENTS.ROMANCE_STAGES.BOND;
        data.commitment = Math.max(data.commitment || 0, 35);
        data.legacyWeight = Math.max(data.legacyWeight || 0, 12);
    }

    entanglement.data = data;

    addWorldEvent({
        type: "entanglement",
        captainId,
        sectorId: captain.currentSector,
        text: `${captain.name} became more personally tied to you.`,
        importance: data.stage === ENTANGLEMENTS.ROMANCE_STAGES.COMMITTED ? 3 : 2,
        alert: true
    });

    return true;
}

function getPlayerPrimaryMajorFaction() {
    let bestId = null;
    let bestScore = -Infinity;

    MAJOR_FACTIONS.forEach(id => {
        const score = getFactionRep(id);
        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }
    });

    return bestScore > 10 ? bestId : null;
}

function getMissionForCaptain(captain) {
    if (!captain.currentPlan || captain.currentPlan.type !== "mission") return null;
    return state.missions.find(mission => mission.id === captain.currentPlan.missionId) || null;
}

function updateRomancePressure(entanglement) {
    const captainParty = entanglement.parties.find(p => p.type === "captain");
    if (!captainParty) return;

    const captain = state.captains[captainParty.id];
    if (!captain || captain.status !== "active") return;

    const mission = getMissionForCaptain(captain);
    const data = entanglement.data || {};
    let pressureDelta = -ENTANGLEMENTS.PRESSURE.PRESSURE_DECAY;
    let reason = "";

    if (mission && mission.factionId) {
        const playerFaction = getPlayerPrimaryMajorFaction();
        if (playerFaction && mission.factionId !== playerFaction) {
            pressureDelta += 8;
            data.loyaltyConflict = clampRange((data.loyaltyConflict || 0) + 10, 0, 100);
            reason = `${captain.name}'s current work pulls against your political ties.`;
        }
    }

    if ((data.discretion || 0) < 30 && getFactionHeat("sda") >= 15) {
        pressureDelta += 6;
        reason = reason || `${captain.name}'s private connection to you is becoming risky gossip.`;
    }

    const sector = state.universe[captain.currentSector];
    if (sector && getSectorStatusLabel(sector.id) === "Contested") {
        pressureDelta += 3;
        reason = reason || `${captain.name} is operating in contested space.`;
    }

    entanglement.pressure = clampRange((entanglement.pressure || 0) + pressureDelta, 0, 100);
    entanglement.data = data;
    if (reason) entanglement.lastPressureReason = reason;
}

function updateFavorPressure(entanglement) {
    const captainParty = entanglement.parties.find(p => p.type === "captain");
    if (!captainParty) return;

    const captain = state.captains[captainParty.id];
    if (!captain) return;

    let pressureDelta = -ENTANGLEMENTS.PRESSURE.PRESSURE_DECAY;
    if (captain.currentPlan) pressureDelta += 3;
    if ((captain.credits || 0) < 1000) pressureDelta += 2;

    entanglement.pressure = clampRange((entanglement.pressure || 0) + pressureDelta, 0, 100);
}

function updateRivalryPressure(entanglement) {
    const captainParty = entanglement.parties.find(p => p.type === "captain");
    if (!captainParty) return;

    const captain = state.captains[captainParty.id];
    if (!captain) return;

    const rel = captain.relationshipToPlayer || {};
    let pressureDelta = -ENTANGLEMENTS.PRESSURE.PRESSURE_DECAY;
    if ((rel.rivalry || 0) >= 60) pressureDelta += 5;
    if (captain.currentSector === state.player.currentSector) pressureDelta += 2;

    entanglement.pressure = clampRange((entanglement.pressure || 0) + pressureDelta, 0, 100);
}

function syncCaptainEntanglementFromRelationship({
    kind,
    captainId,
    desiredStrength,
    pressure,
    publicKnown = false,
    source
}) {
    const party = makeCaptainParty(captainId);
    const existing = findEntanglement(kind, PLAYER_PARTY, party);
    if (!existing) {
        addOrNudgeEntanglement({
            kind,
            parties: [PLAYER_PARTY, party],
            strength: desiredStrength,
            pressure,
            publicKnown,
            source
        });
        return;
    }

    existing.strength = clampRange(
        Math.max(existing.strength || 0, desiredStrength),
        -100,
        100
    );
    existing.pressure = clampRange((existing.pressure || 0) + pressure, 0, 100);
    existing.publicKnown = existing.publicKnown || publicKnown;
    existing.lastTouchedDay = getCurrentDay();
    existing.source = source;
}

export function syncRelationshipEntanglements() {
    Object.values(state.captains || {}).forEach(captain => {
        const rel = captain.relationshipToPlayer || {};

        if ((rel.debt || 0) >= ENTANGLEMENTS.PRESSURE.FAVOR_DEBT_MIN) {
            syncCaptainEntanglementFromRelationship({
                kind: ENTANGLEMENTS.KINDS.FAVOR,
                captainId: captain.id,
                desiredStrength: Math.min(30, (rel.debt || 0) * 8),
                pressure: 1,
                source: "relationship_debt"
            });
        }

        if ((rel.rivalry || 0) >= ENTANGLEMENTS.PRESSURE.RIVALRY_MIN) {
            syncCaptainEntanglementFromRelationship({
                kind: ENTANGLEMENTS.KINDS.RIVALRY,
                captainId: captain.id,
                desiredStrength: Math.min(100, rel.rivalry || 0),
                pressure: 2,
                publicKnown: true,
                source: "relationship_rivalry"
            });
        }
    });
}

export function updateEntanglementsDaily() {
    normaliseEntanglements();
    syncRelationshipEntanglements();

    state.entanglements.forEach(entanglement => {
        if (entanglement.kind === ENTANGLEMENTS.KINDS.ROMANCE) {
            updateRomancePressure(entanglement);
        } else if (entanglement.kind === ENTANGLEMENTS.KINDS.FAVOR) {
            updateFavorPressure(entanglement);
        } else if (entanglement.kind === ENTANGLEMENTS.KINDS.RIVALRY) {
            updateRivalryPressure(entanglement);
        } else {
            entanglement.pressure = clampRange(
                (entanglement.pressure || 0) - ENTANGLEMENTS.PRESSURE.PRESSURE_DECAY,
                0,
                100
            );
        }
    });

    maybeSpawnEntanglementEvents();
}

function activeEntanglementEventExists(entanglementId, eventType) {
    return state.missions.some(mission =>
        mission.kind === "entanglement_event"
        && mission.entanglementId === entanglementId
        && mission.eventType === eventType
        && (mission.status === "available" || mission.status === "accepted")
    );
}

function makeEntanglementMission(entanglement, eventType, title, context, sectorId, factionId = null) {
    const origin = sectorId || state.player.currentSector;
    const mission = makeBaseMission(
        title,
        origin,
        ENTANGLEMENTS.MISSION.BASE_REWARD + Math.floor((entanglement.pressure || 0) * 8),
        ENTANGLEMENTS.MISSION.EXPIRES_DAYS
    );

    mission.type = "social";
    mission.kind = "entanglement_event";
    mission.eventType = eventType;
    mission.entanglementId = entanglement.id;
    mission.factionId = factionId;
    mission.targetSector = origin;
    mission.visibility = entanglement.publicKnown ? "public" : "quiet";
    mission.risk = entanglement.publicKnown ? "political" : "personal";
    mission.rewardRep = 1;
    mission.context = context;

    return prepareMissionOpportunity(mission);
}

function maybeSpawnRomanceEvent(entanglement) {
    if (entanglement.pressure < ENTANGLEMENTS.PRESSURE.EVENT_PRESSURE_MIN) return false;

    const captainParty = entanglement.parties.find(p => p.type === "captain");
    if (!captainParty) return false;

    const captain = state.captains[captainParty.id];
    if (!captain) return false;

    const data = entanglement.data || {};
    const mission = getMissionForCaptain(captain);

    if (mission && !activeEntanglementEventExists(entanglement.id, "conflicted_loyalties")) {
        state.missions.push(makeEntanglementMission(
            entanglement,
            "conflicted_loyalties",
            `Private Crossfire: ${captain.name}`,
            `${captain.name}'s current contract is pulling against your personal bond. You can warn them, use the bond for leverage, or let the job play out.`,
            captain.currentSector,
            mission.factionId || null
        ));
        return true;
    }

    if ((data.discretion || 0) < 30 && !activeEntanglementEventExists(entanglement.id, "public_association")) {
        state.missions.push(makeEntanglementMission(
            entanglement,
            "public_association",
            `Dangerous Gossip: ${captain.name}`,
            `People are starting to connect you and ${captain.name}. That can be used, buried, or allowed to become a public signal.`,
            captain.currentSector,
            captain.preferredFaction || null
        ));
        return true;
    }

    return false;
}

function maybeSpawnFavorEvent(entanglement) {
    if (entanglement.pressure < ENTANGLEMENTS.PRESSURE.EVENT_PRESSURE_MIN) return false;
    if (activeEntanglementEventExists(entanglement.id, "favor_comes_due")) return false;

    const captainParty = entanglement.parties.find(p => p.type === "captain");
    if (!captainParty) return false;

    const captain = state.captains[captainParty.id];
    if (!captain) return false;

    state.missions.push(makeEntanglementMission(
        entanglement,
        "favor_comes_due",
        `A Favor Comes Due: ${captain.name}`,
        `${captain.name} is calling on the debt between you. Helping will deepen trust; refusing will sour the bond.`,
        captain.currentSector,
        captain.preferredFaction || null
    ));
    return true;
}

function maybeSpawnRivalryEvent(entanglement) {
    if (entanglement.pressure < ENTANGLEMENTS.PRESSURE.EVENT_PRESSURE_MIN) return false;
    if (activeEntanglementEventExists(entanglement.id, "rival_sabotage")) return false;

    const captainParty = entanglement.parties.find(p => p.type === "captain");
    if (!captainParty) return false;

    const captain = state.captains[captainParty.id];
    if (!captain) return false;

    state.missions.push(makeEntanglementMission(
        entanglement,
        "rival_sabotage",
        `The Knife Behind the Smile: ${captain.name}`,
        `${captain.name} is looking for a way to cost you money, standing, or time. You can confront, expose, pay off, or outmaneuver them.`,
        captain.currentSector,
        captain.preferredFaction || null
    ));
    return true;
}

export function maybeSpawnEntanglementEvents() {
    let spawned = 0;

    const candidates = state.entanglements
        .filter(e => (e.pressure || 0) >= ENTANGLEMENTS.PRESSURE.EVENT_PRESSURE_MIN)
        .sort((a, b) => (b.pressure || 0) - (a.pressure || 0));

    for (const entanglement of candidates) {
        if (spawned >= ENTANGLEMENTS.DAILY_EVENT_LIMIT) break;
        if (entanglement.cooldownUntilDay > getCurrentDay()) continue;

        let didSpawn = false;
        if (entanglement.kind === ENTANGLEMENTS.KINDS.ROMANCE) {
            didSpawn = maybeSpawnRomanceEvent(entanglement);
        } else if (entanglement.kind === ENTANGLEMENTS.KINDS.FAVOR) {
            didSpawn = maybeSpawnFavorEvent(entanglement);
        } else if (entanglement.kind === ENTANGLEMENTS.KINDS.RIVALRY) {
            didSpawn = maybeSpawnRivalryEvent(entanglement);
        }

        if (didSpawn) {
            spawned += 1;
            entanglement.pressure = Math.max(15, Math.floor(entanglement.pressure * 0.45));
            entanglement.cooldownUntilDay = getCurrentDay() + 4;
            addWorldEvent({
                type: "entanglement_event",
                sectorId: state.player.currentSector,
                text: `A social entanglement created a new opportunity: ${entanglement.lastPressureReason || entanglement.kind}.`,
                importance: ENTANGLEMENTS.MISSION.IMPORTANCE,
                alert: true
            });
        }
    }
}

export function getCaptainMissionEntanglementModifier(captain, mission) {
    if (!captain || !mission) return 0;

    const entanglements = getCaptainEntanglements(captain.id);
    const playerFaction = getPlayerPrimaryMajorFaction();
    let score = 0;

    entanglements.forEach(entanglement => {
        if (entanglement.kind === ENTANGLEMENTS.KINDS.ROMANCE) {
            const stage = entanglement.data?.stage;
            const strength = entanglement.strength || 0;

            if (mission.candidates && mission.candidates.includes("player")) {
                score -= Math.floor(strength / 8);
            }

            if (playerFaction && mission.factionId && mission.factionId !== playerFaction) {
                score -= stage === ENTANGLEMENTS.ROMANCE_STAGES.COMMITTED ? 18 : 8;
            }
        }

        if (entanglement.kind === ENTANGLEMENTS.KINDS.RIVALRY) {
            if (mission.candidates && mission.candidates.includes("player")) {
                score += Math.floor((entanglement.strength || 0) / 6);
            }
        }

        if (entanglement.kind === ENTANGLEMENTS.KINDS.FAVOR) {
            if (mission.candidates && mission.candidates.includes("player")) {
                score -= Math.floor((entanglement.strength || 0) / 10);
            }
        }
    });

    return score;
}

import { state } from "../state.js";
import { FACTIONS, ARCHETYPE_LABELS, GUILD_TIER_NAMES } from "../constants.js";
import { escapeHtml, formatCredits, random } from "../utils.js";
import { getCaptainsInSector, getCaptain, getCaptainDominantFaction, getCaptainRelationshipLabel, captainDisplayName, nudgeCaptainRelation, getKnownCaptains } from "../systems/captains.js";
import { addIntel } from '../core/intel.js';
import { updateUI } from "./renderer.js";
import { missionDescription } from "./renderMissions.js";

export function renderCaptainChipsForSector(sectorId) {
    const { player, captains: allCaptains } = state;
    const localCaptains = getCaptainsInSector(sectorId, true);
    if (localCaptains.length === 0) return "";
    let html = `<div><strong>Known Captains:</strong> `;
    html += localCaptains.map(captain => {
        const faction = FACTIONS[getCaptainDominantFaction(captain)] || FACTIONS.fu;
        return `<span class="captain-chip" style="color:${faction.color}">${faction.icon} ${escapeHtml(captain.callsign)}</span>`;
    }).join(" ");
    html += `</div>`;
    if (sectorId === player.currentSector) {
        html += `<div class="compact-actions">`;
        localCaptains.forEach(captain => {
            html += `<button data-action="hailCaptain" data-arg0="${captain.id}">Hail ${escapeHtml(captain.name)}</button>`;
        });
        html += `</div>`;
    }
    return html;
}

export function renderCaptainsTab() {
    const { captains, captainEventLog, missions } = state;
    const known = getKnownCaptains().sort((a, b) => a.name.localeCompare(b.name));
    let html = `<h4>Known Captains</h4>`;
    html += `<div class="small muted">These captains behave like other players: they move, trade, mine, accept opportunities, join guilds, and develop loyalties.</div>`;
    if (known.length === 0) return html + `<div class="muted">No captains known yet.</div>`;
    html += `<div class="card-grid">`;
    known.forEach(captain => {
        const faction = FACTIONS[getCaptainDominantFaction(captain)] || FACTIONS.fu;
        const rel = captain.relationshipToPlayer;
        const plan = captain.currentPlan && captain.currentPlan.type === "mission" ? missions.find(m => m.id === captain.currentPlan.missionId) : null;
        html += `<div class="captain-card"><strong style="color:${faction.color}">${faction.icon} ${escapeHtml(captainDisplayName(captain))}</strong><br>`;
        html += `<span class="muted">${escapeHtml(ARCHETYPE_LABELS[captain.archetype] || captain.archetype)} / ${escapeHtml(captain.ship.name)}</span><br>`;
        html += `Last known sector: ${captain.currentSector} | Relationship: ${getCaptainRelationshipLabel(captain)}<br>`;
        html += `Opinion ${rel.opinion || 0} / Trust ${rel.trust || 0} / Rivalry ${rel.rivalry || 0} / Debt ${rel.debt || 0}<br>`;
        html += `<span class="small muted">${escapeHtml(captain.blurb)}</span><br>`;
        html += `Loyalties: ${Object.entries(captain.factionStanding).filter(([, v]) => v > 50).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => `${FACTIONS[id].short} ${v}`).join(" | ") || "unclear"}<br>`;
        html += `Guilds: ${Object.keys(captain.memberships || {}).map(id => `${FACTIONS[id].short} ${GUILD_TIER_NAMES[captain.memberships[id]]}`).join(" | ") || "none"}<br>`;
        if (plan) html += `<span class="amber">Current plan: ${escapeHtml(plan.title)}, due Day ${captain.currentPlan.completionDay}</span><br>`;
        html += `<button data-action="selectSector" data-arg0="${captain.currentSector}">Locate</button>`;
        if (captain.currentSector === state.player.currentSector) html += `<button data-action="hailCaptain" data-arg0="${captain.id}">Hail</button>`;
        html += `<div class="small muted">Recent: ${(captain.history || []).slice(0, 2).map(h => `Day ${h.day}: ${escapeHtml(h.text)}`).join(" / ") || "No notable history yet."}</div>`;
        html += `</div>`;
    });
    html += `</div>`;
    html += `<div class="commodity-row"><strong>Recent Captain News</strong>`;
    if (captainEventLog.length === 0) html += `<div class="muted">No captain news yet.</div>`;
    captainEventLog.slice(0, 10).forEach(entry => {
        const captain = state.captains[entry.captainId];
        html += `<div class="timeline-entry">Day ${entry.day}: ${captain ? escapeHtml(captain.name) : "Unknown captain"} — ${escapeHtml(entry.text)}</div>`;
    });
    html += `</div>`;
    return html;
}

export function hailCaptain(id) {
    const { player, missions } = state;
    const captain = getCaptain(id);
    if (!captain || captain.currentSector !== player.currentSector) {
        console.log("That captain is not in this sector.");
        return;
    }
    captain.known = true;
    state.selectedCaptainId = id;
    const faction = FACTIONS[getCaptainDominantFaction(captain)] || FACTIONS.fu;
    const rel = captain.relationshipToPlayer;
    let html = `<h4 style="color:${faction.color}">${faction.icon} ${escapeHtml(captainDisplayName(captain))}</h4>`;
    html += `<div>${escapeHtml(ARCHETYPE_LABELS[captain.archetype] || captain.archetype)} aboard <strong>${escapeHtml(captain.ship.name)}</strong>.</div>`;
    html += `<div class="small muted">${escapeHtml(captain.blurb)}</div>`;
    html += `<div class="stat-grid">`;
    html += `<div class="stat-pill">Relationship: ${getCaptainRelationshipLabel(captain)}</div>`;
    html += `<div class="stat-pill">Opinion: ${rel.opinion || 0}</div>`;
    html += `<div class="stat-pill">Trust: ${rel.trust || 0}</div>`;
    html += `<div class="stat-pill">Rivalry: ${rel.rivalry || 0}</div>`;
    html += `<div class="stat-pill">Debt: ${rel.debt || 0}</div>`;
    html += `</div>`;
    if (captain.currentPlan) {
        const mission = missions.find(m => m.id === captain.currentPlan.missionId);
        if (mission) html += `<div class="amber">Current job: ${escapeHtml(mission.title)}. Estimated completion: Day ${captain.currentPlan.completionDay}.</div>`;
    }
    html += `<div class="compact-actions">`;
    html += `<button data-action="offerHelpToCaptain" data-arg0="${captain.id}">Offer Help (45m)</button>`;
    html += `<button data-action="tradeRumorsWithCaptain" data-arg0="${captain.id}">Trade Rumors (30m)</button>`;
    if (captain.currentPlan) html += `<button data-action="supportCaptainJob" data-arg0="${captain.id}">Support Current Job (60m)</button>`;
    if (captain.currentPlan) html += `<button data-action="buyOffCaptain" data-arg0="${captain.id}">Buy Them Off</button>`;
    html += `<button data-action="provokeCaptain" data-arg0="${captain.id}">Provoke Rivalry</button>`;
    html += `</div>`;
    html += `<div class="commodity-row"><strong>Recent history</strong>`;
    (captain.history || []).slice(0, 6).forEach(entry => {
        html += `<div class="timeline-entry">Day ${entry.day}: ${escapeHtml(entry.text)}</div>`;
    });
    if ((captain.history || []).length === 0) html += `<div class="muted">No history yet.</div>`;
    html += `</div>`;
    document.getElementById("screenTitle").innerHTML = `Hailing ${escapeHtml(captain.name)}`;
    document.getElementById("actions").innerHTML = html;
}

export function offerHelpToCaptain(id) {
    const captain = getCaptain(id);
    if (!captain || captain.currentSector !== state.player.currentSector) return;
    const { spendTime, addFactionRep } = _deps;
    if (!spendTime(45)) return;
    nudgeCaptainRelation(id, { opinion: 8, trust: 3, debt: 1 }, "you offered practical help without demanding a contract");
    if (captain.archetype === "trader") addFactionRep("traders", 1, "helped a guild hauler");
    if (captain.archetype === "miner") addFactionRep("miners", 1, "helped a prospector");
    updateUI();
    hailCaptain(id);
}

export function tradeRumorsWithCaptain(id) {
    const captain = getCaptain(id);
    if (!captain || captain.currentSector !== state.player.currentSector) return;
    const { spendTime } = _deps;
    if (!spendTime(30)) return;
    const rel = captain.relationshipToPlayer;
    if ((rel.trust || 0) + (rel.opinion || 0) < 5 && random() < 0.55) {
        nudgeCaptainRelation(id, { opinion: -2, rivalry: 1 }, "brushed off your attempt to trade rumors");
        console.log(`${captain.name} gives you nothing useful.`);
    } else {
        const factionId = getCaptainDominantFaction(captain);
        addIntel({
            type: "captain_rumor", factionId,
            sectorId: captain.currentSector,
            value: 20 + Math.floor(random() * 25),
            expiresDay: state.player.time.day + 6,
            text: `${captain.name} shared a rumor about ${FACTIONS[factionId].name} activity near sector ${captain.currentSector}.`
        });
        nudgeCaptainRelation(id, { opinion: 3, trust: 1 }, "shared route rumors with you");
    }
    updateUI();
    hailCaptain(id);
}

export function supportCaptainJob(id) {
    const captain = getCaptain(id);
    if (!captain || captain.currentSector !== state.player.currentSector || !captain.currentPlan) return;
    const { spendTime, addFactionRep } = _deps;
    if (!spendTime(60)) return;
    const mission = state.missions.find(m => m.id === captain.currentPlan.missionId);
    captain.currentPlan.completionDay = Math.max(state.player.time.day, captain.currentPlan.completionDay - 1);
    if (mission) mission.completionDay = captain.currentPlan.completionDay;
    nudgeCaptainRelation(id, { opinion: 12, trust: 5, debt: 1 }, "you helped advance their active job");
    if (mission && mission.factionId) addFactionRep(mission.factionId, 1, `assisted ${captain.name}'s contract`);
    updateUI();
    hailCaptain(id);
}

export function buyOffCaptain(id) {
    const captain = getCaptain(id);
    if (!captain || captain.currentSector !== state.player.currentSector || !captain.currentPlan) return;
    const cost = 900 + Math.max(0, captain.relationshipToPlayer.rivalry || 0) * 12;
    const { spendTime } = _deps;
    if (state.player.credits < cost) { console.log(`Buying off ${captain.name} would take ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(30)) return;
    state.player.credits -= cost;
    const mission = state.missions.find(m => m.id === captain.currentPlan.missionId);
    if (mission && random() < 0.65 + Math.max(0, captain.relationshipToPlayer.opinion || 0) / 200) {
        mission.status = "available";
        mission.takenBy = null;
        mission.completionDay = null;
        captain.currentPlan = null;
        nudgeCaptainRelation(id, { opinion: -4, rivalry: 3 }, "accepted your payoff but remembers the interference");
        console.log(`${captain.name} stepped away from the opportunity. It is back on the board.`);
    } else {
        nudgeCaptainRelation(id, { opinion: -10, rivalry: 8 }, "rejected your payoff attempt");
        console.log(`${captain.name} takes offense at the offer.`);
    }
    updateUI();
    hailCaptain(id);
}

export function provokeCaptain(id) {
    const captain = getCaptain(id);
    if (!captain || captain.currentSector !== state.player.currentSector) return;
    const { spendTime } = _deps;
    if (!spendTime(30)) return;
    nudgeCaptainRelation(id, { opinion: -12, rivalry: 14 }, "you deliberately needled them in open comms");
    updateUI();
    hailCaptain(id);
}

const _deps = { spendTime: null, addFactionRep: null };
export function injectCaptainUIDeps(deps) { Object.assign(_deps, deps); }

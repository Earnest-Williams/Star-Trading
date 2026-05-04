import { state } from "../state.js";
import { FACTIONS } from "../constants.js";
import { escapeHtml, formatCredits, formatCommodity } from "../utils.js";
import { getFactionRep, getPrivateFactionRep, getFactionTrust, getGuildTier } from "../core/factions.js";

export function missionDescription(m) {
    if (m.type === "delivery") return `Pickup/source: sector ${m.originSector}. Deliver ${m.amount} ${formatCommodity(m.commodity)} to sector ${m.destinationSector}.`;
    if (m.type === "mining") return `Mine ${m.amount} Ore, then report back to sector ${m.originSector}.`;
    if (m.type === "survey") return `Survey sector ${m.targetSector}, then report back to sector ${m.originSector}.`;
    if (m.type === "colony") return `Found a colony in sector ${m.targetSector}, then report back to sector ${m.originSector}.`;
    if (m.type === "contest") return `${m.context || "Political conflict contract."} Travel to sector ${m.targetSector}, spend ${m.operationMinutes || 90} minutes on the operation, then report the result.`;
    return "Mission details unavailable.";
}

function isMissionVisible(m) {
    if (!m.factionId || !FACTIONS[m.factionId]) return true;
    const faction = FACTIONS[m.factionId];
    if (faction.type === "guild") return getGuildTier(m.factionId) > 0 || getFactionRep(m.factionId) >= 50 || getFactionTrust(m.factionId) >= 25;
    if (m.factionId === "vc") return getFactionRep("vc") > -250 || getPrivateFactionRep("vc") >= 25 || getGuildTier("smugglers") > 0;
    return getFactionRep(m.factionId) > -250;
}

export function renderMissionBoard() {
    const { missions, player, captains } = state;
    const available = missions.filter(m => m.status === "available" && m.originSector === player.currentSector && isMissionVisible(m));
    let html = `<h4>Mission Board</h4>`;
    if (available.length === 0) { html += `<span class="muted">No available missions here.</span>`; return html; }
    available.forEach(m => {
        const faction = FACTIONS[m.factionId] || null;
        const prefix = faction ? `<span class="faction-icon" style="color:${faction.color}">${faction.icon}</span> ` : "";
        html += `<div class="mission"><strong>${prefix}${escapeHtml(m.title)}</strong><br>${escapeHtml(missionDescription(m))}<br>`;
        html += `Expires: Day ${m.expiresDay} | Reward: ${formatCredits(m.rewardCredits)} credits`;
        if (faction) html += ` | ${faction.short} +${m.rewardRep}`;
        if (m.candidates && m.candidates.length > 0) {
            html += `<br><span class="small muted">Other interested captains: ${m.candidates.map(id => captains[id] ? escapeHtml(captains[id].name) : escapeHtml(id)).join(", ")}</span>`;
        }
        html += `<br><button data-action="acceptMission" data-arg0="${m.id}">Accept</button></div>`;
    });
    return html;
}

export function renderAllMissionScreen() {
    const { missions, player, captains } = state;
    let html = `<h4>Mission Board</h4>`;
    if (state.ports[player.currentSector]) html += renderMissionBoard();
    else html += `<div class="muted">No local mission board in this sector. Visit a port or StarDock.</div>`;
    html += `<div class="commodity-row"><strong>Accepted Missions</strong>`;
    const accepted = missions.filter(m => m.status === "accepted");
    if (accepted.length === 0) html += `<div class="muted">No accepted missions.</div>`;
    accepted.forEach(m => {
        const faction = FACTIONS[m.factionId] || null;
        html += `<div class="mission"><strong>${faction ? `<span style="color:${faction.color}">${faction.icon}</span> ` : ""}${escapeHtml(m.title)}</strong><br>${escapeHtml(missionDescription(m))}<br>`;
        html += `Expires Day ${m.expiresDay} | Reward ${formatCredits(m.rewardCredits)}<br>`;
        if (m.type === "mining") html += `Progress: ${m.progress}/${m.amount} ore<br>`;
        html += `<button data-action="completeMission" data-arg0="${m.id}">Try Complete</button></div>`;
    });
    html += `</div>`;
    const claimed = missions.filter(m => m.status === "captain_taken" || m.status === "completed_by_captain").slice(-8);
    html += `<div class="commodity-row"><strong>Captain Activity</strong>`;
    if (claimed.length === 0) html += `<div class="muted">No captain has claimed a board opportunity yet.</div>`;
    claimed.forEach(m => {
        const captain = captains[m.takenBy];
        html += `<div class="mission"><strong>${escapeHtml(m.title)}</strong><br>`;
        html += `${escapeHtml(missionDescription(m))}<br>Status: ${m.status === "captain_taken" ? `Taken by ${captain ? escapeHtml(captain.name) : "unknown"}, ETA Day ${m.completionDay}` : `Completed by ${captain ? escapeHtml(captain.name) : "a captain"}`}</div>`;
    });
    html += `</div>`;
    return html;
}

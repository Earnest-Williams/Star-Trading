import { state } from "../state.js";
import { FACTIONS } from '../config/factions.js';
import { escapeHtml, formatCredits } from "../utils.js";
import { getFactionRep, getPrivateFactionRep, getFactionTrust, getGuildTier } from "../core/factions.js";
import { missionDescription } from "../systems/missions.js";
import {
    canAcceptSecureContract,
    getAvailableSecureContracts,
    hasSecureCourierLicense,
    SECURE_LICENSE_REP_THRESHOLD,
    SECURE_LICENSE_TRUST_THRESHOLD
} from "../systems/secureCourier.js";

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
    if (available.length === 0) {
        html += `<div class="empty-state"><strong>No available missions here.</strong><div class="small muted">Mission postings are local. Jump to another port, improve faction standing, or check Communications for data-cargo and dialogue leads.</div></div>`;
        return html;
    }
    available.forEach(m => {
        const faction = FACTIONS[m.factionId] || null;
        const prefix = faction ? `<span class="faction-icon" style="color:${faction.color}">${faction.icon}</span> ` : "";
        const specialTag = m.kind === "entanglement_event"
            ? `<span class="small amber">Entanglement</span><br>`
            : "";
        html += `<div class="mission"><strong>${prefix}${escapeHtml(m.title)}</strong><br>${specialTag}${escapeHtml(missionDescription(m))}<br>`;
        html += `Expires: Day ${m.expiresDay} | Reward: ${formatCredits(m.rewardCredits)} credits`;
        if (faction) html += ` | ${faction.short} +${m.rewardRep}`;
        if (m.candidates && m.candidates.length > 0) {
            html += `<br><span class="small muted">Other interested captains: ${m.candidates.map(id => captains[id] ? escapeHtml(captains[id].name) : escapeHtml(id)).join(", ")}</span>`;
        }
        html += `<br><button data-action="acceptMission" data-arg0="${m.id}">Accept</button></div>`;
    });
    return html;
}

function renderSecureCourierBoard() {
    const contracts = getAvailableSecureContracts(state.player.currentSector);
    let html = `<div class="commodity-row"><strong>Secure Courier Contracts</strong>`;
    if (!hasSecureCourierLicense()) {
        const canRequestSdaLicense = getFactionRep("sda") >= SECURE_LICENSE_REP_THRESHOLD || getFactionTrust("sda") >= SECURE_LICENSE_TRUST_THRESHOLD;
        html += `<div class="muted">Secure packets require a courier license or trusted faction standing.</div>`;
        html += `<div class="small muted">SDA license requires SDA rep ${SECURE_LICENSE_REP_THRESHOLD} or trust ${SECURE_LICENSE_TRUST_THRESHOLD}.</div>`;
        html += `<button data-action="grantSecureCourierLicense" data-arg0="sda"${canRequestSdaLicense ? "" : " disabled"}>Request SDA Courier License</button>`;
    }
    if (contracts.length === 0) {
        html += `<div class="muted">No secure courier contracts posted here.</div></div>`;
        return html;
    }
    contracts.forEach(contract => {
        const faction = FACTIONS[contract.factionId] || null;
        const target = FACTIONS[contract.targetFactionId] || null;
        const disabled = canAcceptSecureContract(contract) ? "" : " disabled";
        html += `<div class="mission"><strong>${faction ? `<span style="color:${faction.color}">${faction.icon}</span> ` : ""}Secure ${escapeHtml(contract.type)}</strong><br>`;
        html += `${escapeHtml(contract.text || "Sealed courier packet.")}<br>`;
        html += `S${contract.originSectorId} → S${contract.destinationSectorId} | `;
        html += `Expires Day ${contract.expiresDay} | Payout ${formatCredits(contract.value)} | Risk ${contract.risk}`;
        if (target) html += ` | Recipient ${target.short}`;
        if (!canAcceptSecureContract(contract)) html += `<br><span class="small amber">License or trusted issuer standing required.</span>`;
        html += `<br><button data-action="acceptSecureContract" data-arg0="${escapeHtml(contract.id)}"${disabled}>Accept Secure Contract</button></div>`;
    });
    html += `</div>`;
    return html;
}

export function renderAllMissionScreen() {
    const { missions, player, captains } = state;
    let html = `<h4>Mission Board</h4>`;
    if (state.ports[player.currentSector]) html += renderMissionBoard();
    else html += `<div class="muted">No local mission board in this sector. Visit a port or StarDock.</div>`;
    html += renderSecureCourierBoard();
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

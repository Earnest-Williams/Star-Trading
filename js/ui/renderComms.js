import { state } from "../state.js";
import { FACTIONS, MARKET_COMMODITIES } from "../constants.js";
import {
    getCurrentSectorKnowledge,
    getFreshnessLabel,
    getFreshnessSummaryForSector,
    getPlayerDataHoldSummary,
    getPublicSnapshotAge
} from "../core/dataCargo.js";
import { escapeHtml, formatCommodity, formatCredits } from "../utils.js";

function freshnessClass(label) {
    return `data-freshness-${escapeHtml(label || "unknown")}`;
}

function formatSector(sectorId) {
    return `S${Number(sectorId)}`;
}

function formatDay(day) {
    return Number.isFinite(Number(day)) ? `Day ${Number(day)}` : "—";
}

function formatStockSummary(snapshot) {
    const stock = snapshot?.portStock || {};
    const entries = MARKET_COMMODITIES
        .filter(commodity => Number.isFinite(Number(stock[commodity])))
        .slice(0, 4)
        .map(commodity => `${formatCommodity(commodity)} ${Math.round(Number(stock[commodity]))}`);
    return entries.length > 0 ? entries.join(" / ") : "No port stock";
}

function formatFactionSummary(snapshot) {
    const status = snapshot?.factionStatus || {};
    const faction = FACTIONS[status.dominantFactionId];
    const factionLabel = faction ? `${faction.icon} ${escapeHtml(faction.short)}` : "Unaligned";
    return `${factionLabel}${status.status ? ` / ${escapeHtml(status.status)}` : ""}`;
}

function payloadFactionLabel(factionId) {
    const faction = FACTIONS[factionId];
    return faction ? `${faction.icon} ${escapeHtml(faction.short)}` : escapeHtml(factionId || "Unaligned");
}

export function renderDataFreshnessSummary() {
    const currentSectorId = Number(state.player?.currentSector || 0);
    const snapshots = getCurrentSectorKnowledge();
    const external = snapshots.filter(snapshot => Number(snapshot.sourceSectorId) !== currentSectorId);
    const hold = getPlayerDataHoldSummary();
    const byAge = external
        .map(snapshot => ({ snapshot, age: getPublicSnapshotAge(snapshot) }))
        .filter(item => item.age !== null)
        .sort((a, b) => a.age - b.age || a.snapshot.sourceSectorId - b.snapshot.sourceSectorId);
    const freshest = byAge[0];
    const stalest = byAge[byAge.length - 1];

    return `<div class="comms-panel">`
        + `<h4>Local Signal Summary</h4>`
        + `<div class="stat-grid">`
        + `<div class="stat-pill"><strong>Current sector</strong><br>${formatSector(currentSectorId)}</div>`
        + `<div class="stat-pill"><strong>Known public snapshots</strong><br>${snapshots.length}</div>`
        + `<div class="stat-pill"><strong>Freshest external</strong><br>${freshest ? `${formatSector(freshest.snapshot.sourceSectorId)} (${freshest.age}d)` : "None"}</div>`
        + `<div class="stat-pill"><strong>Stalest external</strong><br>${stalest ? `${formatSector(stalest.snapshot.sourceSectorId)} (${stalest.age}d)` : "None"}</div>`
        + `<div class="stat-pill"><strong>Carried public</strong><br>${hold.publicSnapshotCount}</div>`
        + `<div class="stat-pill"><strong>Private payloads</strong><br>${hold.privatePayloadCount}</div>`
        + `<div class="stat-pill"><strong>Secure payloads</strong><br>${hold.securePayloadCount}</div>`
        + `</div>`
        + `</div>`;
}

export function renderPublicSnapshotTable() {
    const snapshots = getCurrentSectorKnowledge();
    if (snapshots.length === 0) {
        return `<div class="comms-panel"><h4>Public Sector Snapshots</h4><div class="muted">No public snapshots known here.</div></div>`;
    }
    const rows = snapshots.map(snapshot => {
        const age = getPublicSnapshotAge(snapshot);
        const label = getFreshnessLabel(age);
        return `<tr>`
            + `<td>${formatSector(snapshot.sourceSectorId)}</td>`
            + `<td>${formatDay(snapshot.observedDay)}</td>`
            + `<td>${formatDay(snapshot.deliveredDay)}</td>`
            + `<td>${age === null ? "—" : age}</td>`
            + `<td><span class="${freshnessClass(label)}">${escapeHtml(label)}</span></td>`
            + `<td>${escapeHtml(formatStockSummary(snapshot))}</td>`
            + `<td>${Number(snapshot.pirateThreat) || 0}</td>`
            + `<td>${formatFactionSummary(snapshot)}</td>`
            + `</tr>`;
    }).join("");
    return `<div class="comms-panel"><h4>Public Sector Snapshots</h4>`
        + `<div class="table-scroll"><table class="comms-table">`
        + `<thead><tr><th>Source</th><th>Observed</th><th>Delivered</th><th>Age</th><th>Freshness</th><th>Port stock</th><th>Pirates</th><th>Faction/status</th></tr></thead>`
        + `<tbody>${rows}</tbody></table></div></div>`;
}

export function renderPrivatePayloadPanel() {
    const payloads = getPlayerDataHoldSummary().privatePayloads;
    if (payloads.length === 0) {
        return `<div class="comms-panel"><h4>Private Payloads</h4><div class="muted">No private intel in the data hold.</div></div>`;
    }
    const cards = payloads.map(payload => `<div class="command-card">`
        + `<strong>${escapeHtml(payload.text)}</strong><br>`
        + `<span class="sector-chip">Origin ${formatSector(payload.sourceSectorId)}</span>`
        + `<span class="sector-chip">Acquired ${formatDay(payload.acquiredDay)}</span>`
        + `<span class="sector-chip">Expires ${formatDay(payload.expiresDay)}</span>`
        + `<span class="sector-chip green">Value ${formatCredits(payload.value)} cr</span>`
        + `<div class="compact-actions">`
        + `<button data-action="sellPrivatePayload" data-arg0="${escapeHtml(payload.id)}">Sell</button>`
        + `<button data-action="releasePrivatePayload" data-arg0="${escapeHtml(payload.id)}">Release Here</button>`
        + `<button data-action="discardPrivatePayload" data-arg0="${escapeHtml(payload.id)}">Discard</button>`
        + `</div></div>`).join("");
    return `<div class="comms-panel"><h4>Private Payloads</h4>${cards}</div>`;
}

export function renderSecurePayloadPanel() {
    const payloads = getPlayerDataHoldSummary().securePayloads;
    if (payloads.length === 0) {
        return `<div class="comms-panel"><h4>Secure Payloads</h4><div class="muted">No secure courier packets aboard.</div></div>`;
    }
    const currentSectorId = Number(state.player?.currentSector || 0);
    const cards = payloads.map(payload => {
        const atDestination = Number(payload.destinationSectorId) === currentSectorId;
        const deliverButton = atDestination
            ? `<button data-action="completeSecurePayload" data-arg0="${escapeHtml(payload.id)}">Deliver</button>`
            : `<span class="muted">Deliver at ${formatSector(payload.destinationSectorId)}</span>`;
        return `<div class="command-card">`
            + `<strong>${escapeHtml(payload.text)}</strong><br>`
            + `<span class="sector-chip">Issuer ${payloadFactionLabel(payload.factionId)}</span>`
            + `<span class="sector-chip">Destination ${formatSector(payload.destinationSectorId)}</span>`
            + `<span class="sector-chip">Expires ${formatDay(payload.expiresDay)}</span>`
            + `<span class="sector-chip green">Payout ${formatCredits(payload.value)} cr</span>`
            + `<span class="sector-chip amber">Risk ${Number(payload.risk) || 1}</span>`
            + `<span class="sector-chip">Status ${escapeHtml(payload.status || "accepted")}</span>`
            + `<div class="compact-actions">${deliverButton}</div>`
            + `</div>`;
    }).join("");
    return `<div class="comms-panel"><h4>Secure Payloads</h4>${cards}</div>`;
}

export function renderCommunicationsScreen() {
    const currentSummary = getFreshnessSummaryForSector(state.player?.currentSector || 0);
    return `<div class="comms-grid">`
        + `<div class="comms-panel"><h4>Communications Console</h4>`
        + `<div class="small muted">Current-sector data freshness: ${currentSummary.liveLocal ? "live local observation" : escapeHtml(currentSummary.label)}</div>`
        + `</div>`
        + renderDataFreshnessSummary()
        + renderPublicSnapshotTable()
        + renderPrivatePayloadPanel()
        + renderSecurePayloadPanel()
        + `</div>`;
}

import { state } from "../state.js";
import { FACTIONS, MARKET_COMMODITIES } from "../constants.js";
import {
    buildDataCargoDebugSummary,
    getCurrentSectorKnowledge,
    getFreshnessLabel,
    getFreshnessSummaryForSector,
    getPlayerDataHoldSummary,
    getPublicSnapshotAge
} from "../core/dataCargo.js";
import { getSectorPathDistance } from "../core/navigation.js";
import { escapeHtml, formatCommodity, formatCredits } from "../utils.js";
import {
    DIALOGUE_MESSAGE_STATUSES,
    getActiveDialogueOffersForPlayer,
    getConversationSummary,
    getConversationTimeline,
    getDialogueDebugTrace,
    getUnreadDialogueMessageCountByConversation
} from "../systems/people.js";

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
    const factionLabel = faction ? `${escapeHtml(faction.icon)} ${escapeHtml(faction.short)}` : "Unaligned";
    return `${factionLabel}${status.status ? ` / ${escapeHtml(status.status)}` : ""}`;
}

function payloadFactionLabel(factionId) {
    const faction = FACTIONS[factionId];
    return faction ? `${escapeHtml(faction.icon)} ${escapeHtml(faction.short)}` : escapeHtml(factionId || "Unaligned");
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

export function renderStaleSectorsPanel() {
    const currentSectorId = Number(state.player?.currentSector || 0);
    const staleSectors = Object.values(state.universe || {})
        .map(sector => Number(sector?.id))
        .filter(sectorId => Number.isFinite(sectorId) && sectorId !== currentSectorId)
        .filter(sectorId => state.universe[sectorId]?.charted || state.universe[sectorId]?.reachable)
        .map(sectorId => {
            const freshness = getFreshnessSummaryForSector(sectorId);
            return { sectorId, freshness, distance: getSectorPathDistance(currentSectorId, sectorId) };
        })
        .filter(item => item.freshness.label === "stale" || item.freshness.label === "cold")
        .sort((a, b) => Number(b.freshness.age) - Number(a.freshness.age) || a.sectorId - b.sectorId)
        .slice(0, 8);
    const opportunity = staleSectors.some(item => item.distance !== null)
        ? `<div class="small amber">Mission opportunity: stale signal recovery likely.</div>`
        : "";
    if (staleSectors.length === 0) {
        return `<div class="comms-panel"><h4>Stale Sectors</h4><div class="muted">No stale or cold reachable sector data from this console.</div></div>`;
    }
    const rows = staleSectors.map(item => `<tr>`
        + `<td>${formatSector(item.sectorId)}</td>`
        + `<td>${item.freshness.age ?? "—"}</td>`
        + `<td><span class="${freshnessClass(item.freshness.label)}">${escapeHtml(item.freshness.label)}</span></td>`
        + `<td>${item.distance === null ? "—" : item.distance}</td>`
        + `</tr>`).join("");
    return `<div class="comms-panel"><h4>Stale Sectors</h4>${opportunity}`
        + `<div class="table-scroll"><table class="comms-table">`
        + `<thead><tr><th>Sector</th><th>Age</th><th>Freshness</th><th>Route hops</th></tr></thead>`
        + `<tbody>${rows}</tbody></table></div></div>`;
}

function renderDataCargoDiagnostics() {
    const summary = buildDataCargoDebugSummary();
    return `<div class="small muted">Data cargo diagnostic: `
        + `${summary.knownSectors} known sectors / ${summary.totalPublicSnapshots} public snapshots / `
        + `${summary.carriedPublicSnapshots} carried / ${summary.privatePayloads} private / `
        + `${summary.securePayloads} secure / ${summary.secureContracts} contracts / `
        + `${summary.staleSectors} stale / ${summary.coldSectors} cold</div>`;
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


export function renderDialogueMessagesPanel() {
    const messages = Array.isArray(state.dialogueMessages) ? state.dialogueMessages : [];
    if (messages.length === 0) {
        return `<div class="comms-panel"><h4>NPC Follow-Ups</h4><div class="muted">No NPC follow-up messages.</div></div>`;
    }
    const cards = messages.map(message => {
        const sender = state.people?.[message.senderId];
        const senderLabel = sender ? sender.name : message.senderId || "Unknown sender";
        const unread = message.status === DIALOGUE_MESSAGE_STATUSES.UNREAD ? `<span class="sector-chip amber">Unread</span>` : "";
        const readButton = message.status === DIALOGUE_MESSAGE_STATUSES.UNREAD
            ? `<button data-action="markDialogueMessageRead" data-arg0="${message.id}">Mark Read</button>`
            : "";
        return `<div class="command-card">`
            + `<strong>${escapeHtml(message.subject)}</strong> ${unread}<br>`
            + `<span class="small muted">From ${escapeHtml(senderLabel)} / Day ${Number(message.createdAt?.day) || 1}</span>`
            + `<div>${escapeHtml(message.text)}</div>`
            + `<div class="compact-actions">${readButton}</div>`
            + `</div>`;
    }).join("");
    return `<div class="comms-panel"><h4>NPC Follow-Ups (${messages.length})</h4><div style="max-height:320px;overflow-y:auto;">${cards}</div></div>`;
}


export function renderDialogueConversationsPanel() {
    const conversations = Array.isArray(state.dialogueConversations) ? state.dialogueConversations : [];
    if (conversations.length === 0) return `<div class="comms-panel"><h4>Dialogue Conversations</h4><div class="muted">No conversations yet.</div></div>`;
    const unread = getUnreadDialogueMessageCountByConversation();
    const cards = conversations.slice().sort((a, b) => Number(b.updatedAt?.absoluteMinute || 0) - Number(a.updatedAt?.absoluteMinute || 0)).map(conversation => {
        const person = state.people?.[conversation.ownerPersonId];
        const personLabel = person ? person.name : conversation.ownerPersonId || "Unknown contact";
        const count = unread[conversation.conversationId] || 0;
        const selected = state.selectedDialogueConversationId === conversation.conversationId ? `<span class="sector-chip green">Selected</span>` : "";
        return `<div class="command-card"><strong>${escapeHtml(personLabel)}</strong> ${selected}<br>`
            + `<span class="small muted">${escapeHtml(conversation.conversationType)} / ${escapeHtml(conversation.status)} / ${escapeHtml(conversation.topic?.itemId || "general")}</span>`
            + (count > 0 ? `<span class="sector-chip amber">Unread ${count}</span>` : "")
            + `<div class="compact-actions"><button data-action="selectDialogueConversation" data-arg0="${escapeHtml(conversation.conversationId)}">View Conversation</button>`
            + `<button data-action="archiveDialogueConversation" data-arg0="${escapeHtml(conversation.conversationId)}">Archive Conversation</button></div></div>`;
    }).join("");
    return `<div class="comms-panel"><h4>Dialogue Conversations (${conversations.length})</h4>${cards}</div>`;
}

export function renderDialogueConversationDetail() {
    const conversationId = state.selectedDialogueConversationId || state.dialogueConversations?.[0]?.conversationId;
    if (!conversationId) return `<div class="comms-panel"><h4>Conversation Detail</h4><div class="muted">Select a conversation.</div></div>`;
    const summary = getConversationSummary(conversationId);
    if (!summary) return `<div class="comms-panel"><h4>Conversation Detail</h4><div class="muted">Conversation not found.</div></div>`;
    const timeline = getConversationTimeline(conversationId).slice(-12).map(entry => {
        const label = entry.kind === "part" ? `${entry.partType}: ${entry.text || entry.intent || "part"}`
            : entry.kind === "message" ? `Message: ${entry.subject}`
                : entry.kind === "offer" ? `Offer: ${entry.itemId} (${formatCredits(entry.price)} cr, ${entry.status})`
                    : `Event: ${entry.eventType}`;
        return `<li><span class="small muted">${escapeHtml(entry.kind)}</span> ${escapeHtml(label)}</li>`;
    }).join("");
    return `<div class="comms-panel"><h4>Conversation Detail</h4>`
        + `<div class="small muted">${escapeHtml(conversationId)} / parts ${summary.partCount} / active offers ${summary.activeOfferCount}</div>`
        + `<ul>${timeline}</ul></div>`;
}

export function renderDialogueOffersPanel() {
    const offers = getActiveDialogueOffersForPlayer();
    if (offers.length === 0) return `<div class="comms-panel"><h4>Dialogue Offers</h4><div class="muted">No active offers.</div></div>`;
    const cards = offers.map(offer => {
        const person = state.people?.[offer.ownerPersonId];
        const personLabel = person ? person.name : offer.ownerPersonId;
        return `<div class="command-card"><strong>${escapeHtml(offer.itemId.replaceAll("_", " "))}</strong> <span class="sector-chip green">${formatCredits(offer.price)} cr</span><br>`
            + `<span class="small muted">From ${escapeHtml(personLabel)} / expires minute ${Number(offer.expiresAtAbsoluteMinute) || 0}</span>`
            + `<div class="compact-actions"><button data-action="acceptDialogueOffer" data-arg0="${offer.id}">Accept Offer</button>`
            + `<button data-action="rejectDialogueOffer" data-arg0="${offer.id}">Reject Offer</button>`
            + `<button data-action="selectDialogueConversation" data-arg0="${escapeHtml(offer.conversationId)}">View Conversation</button></div></div>`;
    }).join("");
    return `<div class="comms-panel"><h4>Dialogue Offers (${offers.length})</h4>${cards}</div>`;
}

export function renderDialogueDebugTracePanel() {
    const conversationId = state.selectedDialogueConversationId || state.dialogueConversations?.[0]?.conversationId;
    if (!conversationId) return `<div class="comms-panel"><h4>Dialogue Debug Trace</h4><div class="muted">No trace.</div></div>`;
    const trace = getDialogueDebugTrace(conversationId);
    return `<div class="comms-panel"><h4>Dialogue Debug Trace</h4>`
        + `<div class="small muted">Proposals ${trace.proposals.length} / tasks ${trace.tasks.length} / memories ${trace.memories.length} / offers ${trace.offers.length} / events ${trace.events.length}</div>`
        + `</div>`;
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
        + renderDataCargoDiagnostics()
        + `</div>`
        + renderDataFreshnessSummary()
        + renderPublicSnapshotTable()
        + renderStaleSectorsPanel()
        + renderDialogueConversationsPanel()
        + renderDialogueConversationDetail()
        + renderDialogueOffersPanel()
        + renderDialogueDebugTracePanel()
        + renderDialogueMessagesPanel()
        + renderPrivatePayloadPanel()
        + renderSecurePayloadPanel()
        + `</div>`;
}

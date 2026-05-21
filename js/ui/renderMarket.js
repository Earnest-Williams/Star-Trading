import { state } from "../state.js";
import { FACTIONS, BALANCE, MARKET_COMMODITIES } from "../constants.js";
import { escapeHtml, formatCommodity } from "../utils.js";
import { getFactionRep, getFactionLabel } from "../core/factions.js";
import { getPortPrice } from "../systems/market.js";
import { getMarketRecommendation } from "../systems/market.js";
import { renderMissionBoard } from "./renderMissions.js";
import { getPortType } from "../core/ports.js";
import { getMarketContractsForSector } from "../systems/economy/contracts.js";
import { describeAmbientTradeSummary } from "../systems/ambientTrade.js";
import { getFreshnessSummaryForSector } from "../core/dataCargo/implementation.js";
import { getDisplayedSupplierSignals, getDisplayedMarketSignal, formatMarketIntelligenceQuality, getMarketInformationQuality } from "../systems/economy/marketIntelligence.js";

function renderEconomyBreadcrumbs(screen) {
    const focus = state.economyFocus || {};
    if (!focus.sectorId && !focus.commodity) return '';
    const bits = [];
    if (focus.sectorId) bits.push(`S${focus.sectorId}`);
    if (focus.commodity) bits.push(formatCommodity(focus.commodity));
    bits.push(screen);
    return `<div class="small muted">Context trail: ${escapeHtml(bits.join(' → '))}</div>`;
}

function buildConsequenceHint(signal) {
    const dailyNet = Number(signal.dailyProduction || 0) - Number(signal.dailyConsumption || signal.dailyDemand || 0);
    const shortage = Math.max(0, Number(signal.shortageSeverity || 0));
    const confidence = Math.max(0, Math.min(1, Number(signal.confidence || 0)));
    const horizon = shortage > 0.2 ? 3 : 5;
    if (dailyNet >= 0) return `${horizon}-day outlook: stabilizing (${formatConfidenceLabel(confidence)} confidence).`;
    return `${horizon}-day outlook: tightening shortage unless resupplied (${formatConfidenceLabel(confidence)} confidence).`;
}

function formatConfidenceLabel(value) {
    const confidence = Math.max(0, Math.min(1, Number(value || 0)));
    if (confidence >= 0.85) return "high";
    if (confidence >= 0.6) return "medium";
    return "low";
}

function getSectorFactionStanding(sectorId) {
    const port = state.ports?.[sectorId];
    return port?.factionId ? getFactionRep(port.factionId) : 0;
}

function renderPressurePanel(sectorId) {
    let html = `<h4>Market Pressure</h4>` + renderEconomyBreadcrumbs("market");
    const actorContext = {
        character: state.player?.character || {},
        currentSector: state.player?.currentSector,
        factionStanding: getSectorFactionStanding(sectorId)
    };
    const pressure = state.economy?.pressureBySector?.[String(sectorId)] || {};
    MARKET_COMMODITIES.forEach((commodity) => {
        if (!pressure[commodity]) return;
        const signal = getDisplayedMarketSignal(sectorId, commodity, actorContext, { purpose: "market_panel" });
        if (!signal) return;
        if (signal.quality?.tier === 'high') {
            html += `<div class="small"><strong>${escapeHtml(formatCommodity(commodity))}</strong>: Stock ${signal.stock}/${signal.target} | daily use ${Number(signal.dailyDemand || 0).toFixed(1)} | daily output ${Number(signal.dailyProduction || 0).toFixed(1)}<br>`
            + `<span class="muted">Cause: ${escapeHtml((signal.causes || [])[0] || "No dominant cause telemetry.")} · ${escapeHtml(formatMarketIntelligenceQuality(signal.quality))}</span><br>`
            + `<span class="muted">${escapeHtml(buildConsequenceHint(signal))}</span><br>`
            + `<button data-action="setEconomyFocus" data-arg0="${sectorId}" data-arg1="${commodity}" data-arg2="market-pressure">Track context</button></div>`; return;
        }
        if (signal.quality?.tier === 'medium') {
            html += `<div class="small"><strong>${escapeHtml(formatCommodity(commodity))}</strong>: stock band ${signal.stockBand} | target band ${signal.targetBand} | daily-use band ${signal.dailyUseBand}<br><span class="muted">Cause: trend pressure · ${escapeHtml(formatMarketIntelligenceQuality(signal.quality))}</span></div>`;
            return;
        }
        html += `<div class="small"><strong>${escapeHtml(formatCommodity(commodity))}</strong>: ${escapeHtml(signal.label || 'volatile')}<br><span class="muted">${escapeHtml(signal.intelPrompt || 'Gather intel for better visibility.')}</span></div>`;
    });
    return html;
}

function renderMarketIntelligencePanel(sectorId, port) {
    const freshness = getFreshnessSummaryForSector(sectorId);
    const nowDay = Number(state.player?.time?.day || 0);
    const observedText = freshness.lastObservedDay === null ? "unknown" : `day ${freshness.lastObservedDay}`;
    let html = `<h4>Market Intelligence</h4>`;
    html += `<div class="small">Data freshness: <strong>${escapeHtml(freshness.label)}</strong>`;
    if (freshness.label !== "current") {
        const ageText = freshness.age === null ? "unknown age" : `${freshness.age} day(s) old`;
        html += ` (${ageText}, observed ${observedText}, now day ${nowDay})`;
    }
    const character = state.player?.character || {};
    html += `.</div>`;
    const infoQuality = getMarketInformationQuality({ character, factionStanding: getSectorFactionStanding(sectorId) }, sectorId);
    html += `<div class="small">Information quality tier: <strong>${escapeHtml(formatMarketIntelligenceQuality(infoQuality))}</strong>; freshness is <strong>${escapeHtml(freshness.label)}</strong>.</div>`;
    const recRows = MARKET_COMMODITIES.map((commodity) => {
        const recommendation = getMarketRecommendation(port, commodity, character);
        const confidence = Math.round(Math.max(0, Number(recommendation.confidence || 0)) * 100);
        return {
            commodity,
            recommendation,
            confidence
        };
    })
        .sort((a, b) => b.confidence - a.confidence || String(a.commodity).localeCompare(String(b.commodity)))
        .slice(0, 5)
        .map(({ commodity, recommendation, confidence }) => (
            `<div class="small"><strong>${escapeHtml(formatCommodity(commodity))}</strong>: `
            + `${escapeHtml(recommendation.actionId)} (${confidence}% confidence, ${formatConfidenceLabel(recommendation.confidence)} quality) — `
            + `${escapeHtml(recommendation.message)}</div>`
        ));
    html += recRows.join("");
    return html;
}


function renderLikelySuppliersPanel(sectorId) {
    let html = `<h4>Likely Suppliers</h4>`;
    const rows = [];
    const clampProbability = (value) => Math.max(0, Math.min(1, Number(value || 0)));
    const formatSupplierEntry = (entry) => {
        if (entry.label) {
            const numericConfidence = Number(entry.confidenceLabel);
            const confidence = Number.isFinite(numericConfidence)
                ? `${Math.round(clampProbability(numericConfidence) * 100)}%`
                : (entry.confidenceLabel || "unknown");
            return `S${entry.sectorId} (${escapeHtml(entry.label)}, telemetry limited, confidence ${escapeHtml(confidence)})`;
        }
        const freshness = getFreshnessSummaryForSector(entry.sectorId);
        const freshnessNote = freshness.label === "current" ? "live" : freshness.label;
        const accessPct = Math.round(clampProbability(entry.routeAccess) * 100);
        const riskPct = 100 - accessPct;
        const confidencePct = Math.round(clampProbability(entry.confidence) * 100);
        const surplus = Math.max(0, Number(entry.surplus || 0));
        const exportable = Math.round(surplus * clampProbability(entry.routeAccess));
        const confidenceSuffix = entry.confidenceLabel ? `, confidence ${escapeHtml(entry.confidenceLabel)}` : `, confidence ${confidencePct}%`;
        return `S${entry.sectorId} (surplus ${Math.round(surplus)}, exportable ${exportable}, access ${accessPct}%, est risk ${riskPct}%, telemetry ${freshnessNote}${confidenceSuffix})`;
    };
    MARKET_COMMODITIES.forEach((commodity) => {
        const top = getDisplayedSupplierSignals(sectorId, commodity, state.player?.character || {}, {}).slice(0, 2);
        if (top.length <= 0) return;
        rows.push(`<div class="small"><strong>${escapeHtml(formatCommodity(commodity))}</strong>: ${top.map(formatSupplierEntry).join("; ")}</div>`);
    });
    if (rows.length <= 0) return `${html}<div class="muted">No strong supplier telemetry right now.</div>`;
    html += rows.join("");
    return html;
}

function renderSiteEconomySummary(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId];
    const volume = state.economy?.recentVolumeBySector?.[String(sectorId)] || {};
    const deliveredSummary = Object.entries(volume)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([commodity, amount]) => `${formatCommodity(commodity)} ${Math.round(Number(amount))}`)
        .join(", ");
    if (!profile && !deliveredSummary) {
        return `<h4>Site Economy Summary</h4><div class="muted">Economic profile data is still being compiled.</div>`;
    }
    let html = `<h4>Site Economy Summary</h4>`;
    if (profile) {
        html += `<div class="small">Demand index ${Math.round(Number(profile.populationDemand || 0))} |`
            + ` Extraction index ${Math.round(Number(profile.extractionCapacity || 0))}</div>`;
    }
    html += `<div class="small muted">Recent delivered contract volume: ${escapeHtml(deliveredSummary || "none")}.</div>`;
    return html;
}

function renderEconomyContractBoard(sectorId) {
    const contracts = getMarketContractsForSector(sectorId);
    let html = '<h4>Economy Contracts</h4>' + renderEconomyBreadcrumbs("contracts");
    if (contracts.length <= 0) return `${html}<div class="muted">No pressure-driven contracts posted here.</div>`;
    contracts.forEach((contract) => {
        const today = Number(state.player?.time?.day || 0);
        const daysLeft = Math.max(0, Number(contract.expiresDay || today) - today);
        const statusText = contract.status === 'accepted' ? `Accepted · remaining ${contract.remaining}` : 'Available';
        const action = contract.status === 'available'
            ? `<button data-action="acceptEconomyContract" data-arg0="${contract.id}">Accept</button>`
            : '<span class="small muted">Deliver by selling commodity in this market.</span>';
        html += `<div class="mission-row"><strong>${escapeHtml(contract.reason)}</strong><br>`
            + `${escapeHtml(formatCommodity(contract.commodity))}: ${contract.amount} units, premium ${contract.reward} credits (${contract.unitPremium || 0}/unit), market value ${contract.expectedMarketValue || 0}c, expected total payout ${contract.expectedTotalPayout || 0}c, expires in ${daysLeft} day(s)<br>`
            + `<span class="small muted">${statusText}</span><br>`
            + `<span class="small muted">Gap ${Math.max(0, Number(contract.targetStockGap || 0))}, unmet trend ${Math.max(0, Number(contract.unmetDemand || 0)).toFixed(1)}, shortage severity ${Math.max(0, Number(contract.shortageSeverity || 0)).toFixed(2)}</span><br>`
            + `<span class="small muted">Supplier hints: ${(Array.isArray(contract.sourceCandidates) && contract.sourceCandidates.length > 0) ? contract.sourceCandidates.map((sid) => `S${sid}`).join(", ") : "none"}</span><br>`
            + `<button data-action="showEconomyLinkedScreen" data-arg0="market" data-arg1="${sectorId}" data-arg2="${contract.commodity}">Open commodity context</button><br>${action}</div>`;
    });
    return html;
}

export function renderMarketPanel() {
    const { player, ports } = state;
    const port = ports[player.currentSector];
    if (!port) { console.log("No port here."); return; }
    const type = getPortType(port);
    const faction = FACTIONS[port.factionId];
    let html = `<h4>${escapeHtml(type.name)}</h4>`;
    if (faction) html += `<div>Authority: <span style="color:${faction.color}">${faction.icon} ${escapeHtml(faction.name)}</span> (${getFactionLabel(getFactionRep(faction.id))}, rep ${getFactionRep(faction.id)})</div>`;
    if (port.typeKey === "stardock") {
        html += `<div>StarDock handles upgrades, repairs, fighters, and mission brokerage.</div>`;
        html += `<button data-action="showScreen" data-arg0="shipyard">Open Shipyard</button>`;
    }
    MARKET_COMMODITIES.forEach(c => {
        const canBuy = type.sells.includes(c);
        const canSell = type.buys.includes(c);
        html += `<div class="commodity-row"><strong>${formatCommodity(c)}</strong>: stock ${port.stock[c] || 0}/${port.maxStock[c] || 0}<br>`;
        if (canBuy) {
            const price = getPortPrice(port, c, "buy");
            html += `Buy price: ${price} each <button data-action="tradeCommodity" data-arg0="${c}" data-arg1="buy">Buy ${BALANCE.TRADE_BATCH}</button> `;
        }
        if (canSell) {
            const price = getPortPrice(port, c, "sell");
            html += `Sell price: ${price} each <button data-action="tradeCommodity" data-arg0="${c}" data-arg1="sell">Sell ${BALANCE.TRADE_BATCH}</button>`;
        }
        if (!canBuy && !canSell) html += `<span class="muted">No trade in this commodity.</span>`;
        html += `</div>`;
    });
    html += renderPressurePanel(player.currentSector);
    html += renderMarketIntelligencePanel(player.currentSector, port);
    html += renderSiteEconomySummary(player.currentSector);
    html += renderLikelySuppliersPanel(player.currentSector);
    html += renderEconomyContractBoard(player.currentSector);
    html += `<div class="small muted">${escapeHtml(describeAmbientTradeSummary())}</div>`;
    const ambient = state.ambientTrade || {};
    const cap = Number(BALANCE.AMBIENT_TRADE.MAX_DAILY_FILL_SHARE || 0);
    const exportCap = Number(BALANCE.AMBIENT_TRADE.MAX_DAILY_EXPORT_SHARE || 0);
    const moved = Object.values(ambient.moved || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    html += `<div class="small muted">Ambient constraint detail: fill cap ${(cap * 100).toFixed(0)}%, export cap ${(exportCap * 100).toFixed(0)}%, moved ${moved} units. Residual shortages require explicit routes.</div>`;
    html += renderMissionBoard();
    document.getElementById("actions").innerHTML = html;
}

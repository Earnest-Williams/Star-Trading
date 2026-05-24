import { state } from "../state.js";
import { COMMODITIES, getCommodityDef } from '../config/economy.js';
import { FACTIONS, GUILD_FACTIONS } from '../config/factions.js';
import { PLANET_TYPES, BUILDING_DEFS } from '../config/entities.js';
import { escapeHtml, formatCommodity } from "../utils.js";
import { getGuildTier } from "../core/factions.js";
import { renderPlanetSummary } from "./renderSector.js";
import { PRODUCTION_RECIPES } from '../systems/economy/production.js';

export function renderColonyPanel() {
    const { player, planets } = state;
    const planet = planets[player.currentSector];
    if (!planet) { console.log("No planet here."); return; }
    const type = PLANET_TYPES[planet.typeKey];
    let html = `<h4>${escapeHtml(type.name)} Planet</h4>`;
    html += renderPlanetSummary(planet);

    if (!planet.owner) {
        html += `<div class="commodity-row">Founding cost: 50 Organics, 20 Equipment, 2,500 credits, 8 hours.</div>`;
        html += `<button data-action="foundColony">Found Colony</button>`;
        document.getElementById("actions").innerHTML = html;
        return;
    }

    // Modern Colony HUD Layout
    // 1. Colony Header & Satisfaction Breakdown
    const housingCap = 100 + (planet.buildings?.habitat || 0) * 250 + (planet.buildings?.housing || 0) * 150;
    const serviceCap = 50 + (planet.buildings?.civic_services || 0) * 150;
    const bd = planet.satisfactionBreakdown || { housing: 100, services: 100, supply: 100 };
    const condColor = planet.facilityCondition >= 75 ? "var(--accent-green)" : (planet.facilityCondition >= 40 ? "var(--accent-amber)" : "var(--accent-red)");

    html += `
    <div class="card" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line-dim); padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="font-size: 1.1em; color: var(--accent-cyan);">Colony Status</strong>
            <span style="font-size: 0.9em; color: var(--accent-amber);">Housing: Tier ${planet.housingTier || 1} | Services: Tier ${planet.serviceTier || 1}</span>
        </div>
        <div class="stat-grid" style="margin-top: 0;">
            <div class="stat-pill">
                <div class="small muted">Colonists</div>
                <strong>${planet.colonists}</strong> <span class="small muted">/ ${housingCap} max</span>
            </div>
            <div class="stat-pill">
                <div class="small muted">Satisfaction</div>
                <strong style="color: ${planet.satisfaction >= 75 ? 'var(--accent-green)' : (planet.satisfaction >= 45 ? 'var(--accent-amber)' : 'var(--accent-red)')};">${planet.satisfaction}%</strong>
            </div>
            <div class="stat-pill">
                <div class="small muted">Facility Integrity</div>
                <strong style="color: ${condColor};">${Math.round(planet.facilityCondition)}%</strong>
            </div>
        </div>
        
        <div style="margin-top: 8px; font-size: 0.9em;">
            <strong>Satisfaction Breakdown:</strong><br>
            <div style="display: flex; gap: 10px; margin-top: 4px;">
                <span class="service-chip" style="color: var(--accent-cyan);">Housing: ${bd.housing}%</span>
                <span class="service-chip" style="color: var(--accent-amber);">Services: ${bd.services}% (Cap: ${serviceCap})</span>
                <span class="service-chip" style="color: var(--accent-green);">Supply: ${bd.supply}%</span>
            </div>
        </div>
    </div>
    `;

    // 2. Colony Politics & Alignment
    html += `
    <div class="card" style="margin-bottom: 12px;">
        <strong style="color: var(--accent-cyan);">Administration & Alignment</strong>
        <div style="margin-top: 8px;">
            <div class="small muted">Registration Status: <strong>${planet.policy?.registration === "registered" ? "SDA Registered" : "Informal/Autonomy"}</strong></div>
            <div class="small muted">Security Protocol: <strong>${planet.policy?.security ? planet.policy.security.replace('_', ' ').toUpperCase() : 'None'}</strong></div>
            <div class="small muted">Political Faction: <strong>${planet.factionId ? FACTIONS[planet.factionId]?.name : 'Independent/Unaligned'}</strong></div>
        </div>
        <div class="compact-actions" style="margin-top: 8px;">
            <button data-action="setColonyPolicy" data-arg0="registration" data-arg1="registered">Register with SDA</button>
            <button data-action="setColonyPolicy" data-arg0="registration" data-arg1="informal">Keep Informal</button>
            <button data-action="setColonyPolicy" data-arg0="security" data-arg1="sda_patrol">SDA Patrol</button>
            <button data-action="setColonyPolicy" data-arg0="security" data-arg1="local_militia">Local Militia</button>
            ${getGuildTier("smugglers") > 0 ? `<button data-action="setColonyPolicy" data-arg0="security" data-arg1="cartel_protection">Cartel Protection</button>` : ""}
        </div>
        <div class="compact-actions" style="margin-top: 6px; border-top: 1px solid var(--line-dim); padding-top: 6px;">
            ${GUILD_FACTIONS.filter(guildId => getGuildTier(guildId) > 0).map(guildId => 
                `<button data-action="alignColony" data-arg0="${guildId}">Align ${escapeHtml(FACTIONS[guildId].short)}</button>`
            ).join(" ")}
        </div>
    </div>
    `;

    // 3. Storage & Spoilage Breakdown
    const storageGroups = { bulk: [], cold: [], secure: [], pulse: [] };
    COMMODITIES.forEach(c => {
        const def = getCommodityDef(c);
        const storageClass = def ? def.storageClass : "bulk";
        if (storageGroups[storageClass]) {
            storageGroups[storageClass].push(c);
        }
    });

    html += `
    <div class="card" style="margin-bottom: 12px;">
        <strong style="color: var(--accent-cyan);">Storage Vaults & Stock</strong>
        <div class="card-grid" style="margin-top: 8px;">
    `;

    Object.entries(storageGroups).forEach(([sClass, commoditiesList]) => {
        let totalStock = 0;
        let totalCap = 0;
        let listHtml = "";

        commoditiesList.forEach(c => {
            const stock = planet.stock[c] || 0;
            const max = planet.maxStock ? planet.maxStock[c] : 50;
            totalStock += stock;
            totalCap += max;

            const def = getCommodityDef(c);
            let spoilHint = "";
            if (def && def.decayRate > 0) {
                let mitigation = 1.0;
                if (sClass === "cold") {
                    mitigation = Math.max(0, 1 - (planet.buildings?.cold_storage || 0) * 0.4);
                } else if (sClass === "pulse") {
                    mitigation = Math.max(0, 1 - (planet.buildings?.pulse_works || 0) * 0.4);
                }
                const actualDecay = def.decayRate * mitigation;
                if (actualDecay > 0) {
                    spoilHint = ` <span style="color: var(--accent-red); font-size: 0.82em;">-${(actualDecay * 100).toFixed(0)}%/d</span>`;
                } else {
                    spoilHint = ` <span style="color: var(--accent-green); font-size: 0.82em;">stabilized</span>`;
                }
            }

            const isShortage = planet.shortages?.[c] > 0;
            const textStyle = isShortage ? "color: var(--accent-red); font-weight: bold;" : "";
            listHtml += `<div style="display: flex; justify-content: space-between; font-size: 0.88em; padding: 2px 0;">
                <span style="${textStyle}">${formatCommodity(c)}</span>
                <span>${stock}/${max}${spoilHint}</span>
            </div>`;
        });

        html += `
        <div style="border: 1px solid var(--line-dim); padding: 6px; background: rgba(0,0,0,0.15);">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line-dim); padding-bottom: 3px; margin-bottom: 4px;">
                <strong style="text-transform: capitalize;">${sClass}</strong>
                <span style="font-size: 0.85em; color: var(--accent-cyan);">${totalStock}/${totalCap}</span>
            </div>
            ${listHtml}
        </div>
        `;
    });

    html += `
        </div>
        <div style="margin-top: 10px; border-top: 1px solid var(--line-dim); padding-top: 8px;">
            <strong style="font-size: 0.9em;">Deposit / Load Logistics Cargo:</strong><br>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px;">
                ${COMMODITIES.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--line-dim); padding: 3px 0; font-size: 0.88em;">
                        <span>${formatCommodity(c)}</span>
                        <div class="compact-actions" style="margin: 0;">
                            <button style="padding: 2px 5px; min-height:0;" data-action="depositToColony" data-arg0="${c}">Dep</button>
                            <button style="padding: 2px 5px; min-height:0;" data-action="loadFromColony" data-arg0="${c}">Load</button>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    </div>
    `;

    // 4. Facilities, Production & Bottlenecks
    const FACILITY_RECIPES = {
        refinery: ['refined_metals', 'polymers', 'coolants', 'fertilizer'],
        factory: ['machinery', 'eq', 'repair_parts', 'construction_kits'],
        electronics_fab: ['electronics', 'control_cores'],
        medical_lab: ['medical_supplies'],
        pulse_works: ['pulse_canister', 'heavy_pulse_module', 'gate_coils'],
        mine: ['ore', 'heavy_metals', 'rare_earths'],
        farm: ['org', 'water_ice']
    };

    let facilitiesHtml = `
    <div class="card" style="margin-bottom: 12px;">
        <strong style="color: var(--accent-cyan);">Facilities & Industrial Production</strong>
        <div style="margin-top: 8px;">
    `;

    Object.keys(BUILDING_DEFS).forEach(key => {
        const def = BUILDING_DEFS[key];
        const lvl = planet.buildings?.[key] || 0;
        
        let industrialStatus = "";
        let isIndustrial = false;
        
        if (lvl > 0) {
            if (FACILITY_RECIPES[key]) {
                isIndustrial = true;
                const produces = FACILITY_RECIPES[key];
                
                if (key === "mine") {
                    const oreCap = planet.stock.ore >= (planet.maxStock?.ore || 50);
                    industrialStatus = oreCap 
                        ? `<span style="color: var(--accent-amber);">Storage Full</span>` 
                        : `<span style="color: var(--accent-green);">Mining (${produces.map(formatCommodity).join(", ")})</span>`;
                } else if (key === "farm") {
                    const orgCap = planet.stock.org >= (planet.maxStock?.org || 50);
                    industrialStatus = orgCap 
                        ? `<span style="color: var(--accent-amber);">Storage Full</span>` 
                        : `<span style="color: var(--accent-green);">Hydroponics (${produces.map(formatCommodity).join(", ")})</span>`;
                } else {
                    // Recipe-driven facility
                    const statuses = [];
                    produces.forEach(c => {
                        const recipe = PRODUCTION_RECIPES[c];
                        if (!recipe) return;
                        
                        let missingInputs = [];
                        Object.entries(recipe.inputs).forEach(([input, amount]) => {
                            if ((planet.stock[input] || 0) < amount) {
                                missingInputs.push(formatCommodity(input));
                            }
                        });
                        
                        const isFull = (planet.stock[c] || 0) >= (planet.maxStock?.[c] || 50);
                        if (missingInputs.length > 0) {
                            statuses.push(`<span style="color: var(--accent-red); font-size: 0.85em;">${formatCommodity(c)} blocked (needs ${missingInputs.join(", ")})</span>`);
                        } else if (isFull) {
                            statuses.push(`<span style="color: var(--accent-amber); font-size: 0.85em;">${formatCommodity(c)} full</span>`);
                        } else {
                            statuses.push(`<span style="color: var(--accent-green); font-size: 0.85em;">${formatCommodity(c)} active</span>`);
                        }
                    });
                    industrialStatus = `<div style="display: flex; flex-direction: column; padding-left: 10px;">${statuses.join("")}</div>`;
                }
            }
        }

        const buildCost = BUILDING_DEFS[key];
        const hasRoute = state.tradeRoutes && state.tradeRoutes.some(r => r.status === 'active' && (r.originSector === player.currentSector || r.destinationSector === player.currentSector));
        const laborFactor = (planet.satisfaction || 60) / 100;
        const conditionFactor = planet.facilityCondition / 100;
        const routeAccessFactor = hasRoute ? 1.0 : 0.5;
        const efficiency = Math.round(laborFactor * conditionFactor * routeAccessFactor * 100);

        facilitiesHtml += `
        <div style="border-bottom: 1px solid var(--line-dim); padding: 6px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span><strong>${escapeHtml(def.name)}</strong> (Lvl ${lvl})</span>
                <div>
                    ${lvl > 0 && isIndustrial ? `<span class="small muted" style="margin-right: 8px;">Eff: ${efficiency}%</span>` : ""}
                    <button style="padding: 2px 6px; min-height: 0;" data-action="buildColonyStructure" data-arg0="${key}">${lvl > 0 ? 'Upgrade' : 'Build'} (${buildCost.credits}c)</button>
                </div>
            </div>
            ${lvl > 0 && isIndustrial ? `<div style="margin-top: 4px;">${industrialStatus}</div>` : ""}
        </div>
        `;
    });

    facilitiesHtml += `
        </div>
    </div>
    `;
    html += facilitiesHtml;

    // 5. Company Leases
    const maxLeaseSlots = 1 + (planet.buildings?.civic_services || 0);
    const activeLeasesCount = (planet.leases || []).filter(l => l.status === "active").length;

    html += `
    <div class="card" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--accent-cyan);">Industrial Lease Slots</strong>
            <span>${activeLeasesCount} / ${maxLeaseSlots} Leased</span>
        </div>
        <div style="margin-top: 8px;">
    `;

    if (!planet.leases || planet.leases.length === 0) {
        html += `<div class="muted small">No company leases established yet. Build Civic Services to attract tenant firms.</div>`;
    } else {
        planet.leases.forEach(lease => {
            const leaseCondColor = lease.condition >= 70 ? "var(--accent-green)" : (lease.condition >= 40 ? "var(--accent-amber)" : "var(--accent-red)");
            html += `
            <div style="border-bottom: 1px solid var(--line-dim); padding: 6px 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${escapeHtml(lease.companyName)}</strong><br>
                    <span class="small muted">Rent: ${lease.rentDaily}c/day | Cond: <span style="color: ${leaseCondColor};">${Math.round(lease.condition)}%</span></span>
                </div>
                <div class="compact-actions" style="margin: 0;">
                    <button style="padding: 3px 6px; min-height: 0;" data-action="maintainColonyLease" data-arg0="${lease.id}">Maintain (150c)</button>
                    <button style="padding: 3px 6px; min-height: 0;" data-action="terminateColonyLease" data-arg0="${lease.id}">Evict</button>
                </div>
            </div>
            `;
        });
    }

    html += `
        </div>
    </div>
    `;

    document.getElementById("actions").innerHTML = html;
}

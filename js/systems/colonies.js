import { state } from '../state.js';
import { BALANCE, COMMODITIES, getCommodityDef } from '../config/economy.js';
import { PLANET_TYPES, BUILDING_DEFS } from '../config/entities.js';
import { FACTIONS } from '../config/factions.js';
import { clampRange, makeStock, formatCommodity, formatCredits, getFreeHolds, hasCargo, removeCargo, describeCost, log, random } from '../utils.js';
import { getDominantInfluence, addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { getGuildTier, getFactionRep, addFactionRep, addFactionTrust, addFactionHeat, applyPoliticalEffect, getColonyProductionMultiplier } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { getTraitBonus } from '../core/traitHooks.js';
import { getColonyActionAdjustment, getPoliticalActionAdjustment } from '../core/characterChecks.js';
import { recordLogisticsDelivery } from './logisticsObjectives.js';
import { rebuildEconomicProfiles } from './economy/profiles.js';
import { setSectorPirateThreat } from '../core/state/mutations.js';
import { PRODUCTION_RECIPES } from './economy/production.js';

export function getColonyMaxStock(planet) {
    const maxStock = makeStock();
    const warehouseLvl = planet.buildings?.warehouse || 0;
    const coldLvl = planet.buildings?.cold_storage || 0;
    const factoryLvl = planet.buildings?.factory || 0;
    const fabLvl = planet.buildings?.electronics_fab || 0;
    const pulseLvl = planet.buildings?.pulse_works || 0;

    COMMODITIES.forEach(c => {
        const def = getCommodityDef(c);
        const storageClass = def ? def.storageClass : "bulk";
        let cap = 50;
        if (storageClass === "bulk") {
            cap += warehouseLvl * 200;
        } else if (storageClass === "cold") {
            cap += coldLvl * 200;
        } else if (storageClass === "secure") {
            cap += (factoryLvl + fabLvl) * 100;
        } else if (storageClass === "pulse") {
            cap += pulseLvl * 100;
        }
        maxStock[c] = cap;
    });
    return maxStock;
}

export function foundColony() {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner) return;
    const cost = { org: 50, eq: 20 };
    if (state.player.credits < 2500 || !hasCargo(cost)) {
        log("Founding a colony requires 50 Organics, 20 Equipment, and 2,500 credits.");
        return;
    }
    if (!spendTime(480)) return;
    state.player.credits -= 2500;
    removeCargo(cost);
    planet.owner = "Player";
    planet.factionId = getGuildTier("colonists") > 0 ? "colonists" : "fu";
    planet.policy = {
        registration: getFactionRep("sda") >= 0 ? "registered" : "informal",
        economy: "free_trade",
        security: "local_militia",
        hiddenInfluence: { vc: 0 }
    };
    const colonyAdjustment = getColonyActionAdjustment(state.player.character);
    planet.colonists = 100 + getTraitBonus(state.player.character, "colonyStability") + Math.max(0, colonyAdjustment);
    
    planet.buildings = {
        habitat: 1,
        mine: 0,
        farm: 0,
        refinery: 0,
        factory: 0,
        electronics_fab: 0,
        medical_lab: 0,
        pulse_works: 0,
        warehouse: 0,
        cold_storage: 0,
        housing: 0,
        civic_services: 0,
        defense: 0
    };
    planet.stock = makeStock();
    planet.maxStock = getColonyMaxStock(planet);
    planet.housingTier = 1;
    planet.serviceTier = 1;
    planet.satisfactionBreakdown = { housing: 100, services: 100, supply: 100 };
    planet.demandProfile = {};
    planet.leases = [];
    planet.facilityCondition = 100;

    planet.satisfaction = clampRange((planet.satisfaction || 60) + getTraitBonus(state.player.character, "colonyStability") + Math.max(0, colonyAdjustment), 0, 100);
    applyPoliticalEffect({ factionId: "colonists", publicRep: 5, trust: 2, sectorId: state.player.currentSector, influence: 4, reason: "new colony founded", memoryKey: "reliableJobs" });
    applyPoliticalEffect({ factionId: "fu", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 7, reason: "frontier settlement" });
    addFactionHeat("sda", planet.policy.registration === "registered" ? 0 : 3, "informal colony paperwork");
    addWorldEvent({ type: "colony", factionId: planet.factionId, sectorId: state.player.currentSector, text: `You founded a colony on the ${PLANET_TYPES[planet.typeKey].name} planet in sector ${state.player.currentSector}.`, importance: 3, alert: false });
    rebuildEconomicProfiles();
    log(`Founded a colony on the ${PLANET_TYPES[planet.typeKey].name} planet in sector ${state.player.currentSector}.`);
    Notifications.show(`Colony founded in sector ${state.player.currentSector}`, 3);
}

export function alignColony(factionId) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    if (!FACTIONS[factionId] || getGuildTier(factionId) <= 0) {
        log("You need guild membership before aligning a colony to that guild.");
        return;
    }
    if (!spendTime(60)) return;
    planet.factionId = factionId;
    if (!planet.policy) planet.policy = { registration: "registered", economy: "free_trade", security: "local_militia", hiddenInfluence: { vc: 0 } };
    if (factionId === "smugglers") {
        planet.policy.hiddenInfluence.vc = Math.min(100, (planet.policy.hiddenInfluence.vc || 0) + 15);
        addFactionRep("vc", 5, "shadow colony access", "private");
        addFactionHeat("sda", 5, "unusual colony traffic");
    }
    addFactionRep(factionId, 3, "colony alignment");
    addFactionTrust(factionId, 1, "colony charter");
    const major = FACTIONS[factionId].majorAffinity;
    if (major) addSectorInfluence(state.player.currentSector, major, 4, "guild colony charter");
    rebuildEconomicProfiles();
    log(`Colony aligned with ${FACTIONS[factionId].name}.`);
}

export function setColonyPolicy(key, value) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    if (key === "security" && value === "cartel_protection" && getGuildTier("smugglers") <= 0) {
        log("You need Smugglers Syndicate membership for Cartel protection.");
        return;
    }
    if (!planet.policy) planet.policy = { registration: "registered", economy: "free_trade", security: "local_militia", hiddenInfluence: { vc: 0 } };
    if (!spendTime(60)) return;
    planet.policy[key] = value;
    if (key === "registration" && value === "registered") {
        const politicalAdjustment = getPoliticalActionAdjustment(state.player.character);
        applyPoliticalEffect({ factionId: "sda", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 3 + Math.max(0, politicalAdjustment), reason: "registered colony charter" });
    }
    if (key === "registration" && value === "informal") {
        applyPoliticalEffect({ factionId: "fu", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 2, reason: "informal frontier autonomy" });
        addFactionHeat("sda", 3, "informal colony status");
    }
    if (key === "security" && value === "sda_patrol") {
        applyPoliticalEffect({ factionId: "sda", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 4, reason: "colony patrol contract" });
        const sector = state.universe[state.player.currentSector];
        setSectorPirateThreat(state.player.currentSector, Math.max(0, Number(sector?.pirateThreat || 0) - 1));
    }
    if (key === "security" && value === "local_militia") {
        applyPoliticalEffect({ factionId: "fu", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 3, reason: "local militia charter" });
    }
    if (key === "security" && value === "cartel_protection") {
        planet.policy.hiddenInfluence.vc = Math.min(100, (planet.policy.hiddenInfluence.vc || 0) + 20);
        applyPoliticalEffect({ factionId: "vc", privateRep: 5, trust: 2, sectorId: state.player.currentSector, influence: 6, reason: "cartel protection compact" });
        addFactionHeat("sda", 6, "shadow protection rumors");
    }
    rebuildEconomicProfiles();
    log(`Colony policy updated: ${key} = ${value}.`);
}

export function depositToColony(commodity) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    const amount = Math.min(BALANCE.TRADE_BATCH, state.player.cargo[commodity]);
    if (amount <= 0) { log(`You have no ${formatCommodity(commodity)} to deposit.`); return; }
    if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
    
    // Check storage capacity
    const maxStock = planet.maxStock ? planet.maxStock[commodity] : 50;
    const currentStock = planet.stock[commodity] || 0;
    const allowed = Math.max(0, Math.min(amount, maxStock - currentStock));
    
    if (allowed <= 0) {
        log(`No storage space available for ${formatCommodity(commodity)} at the colony.`);
        return;
    }
    
    state.player.cargo[commodity] -= allowed;
    planet.stock[commodity] += allowed;
    recordLogisticsDelivery({
        source: "colony_deposit",
        sectorId: state.player.currentSector,
        commodity,
        amount: allowed
    });
    log(`Deposited ${allowed} ${formatCommodity(commodity)} at the colony.`);
}

export function loadFromColony(commodity) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    const freeHolds = getFreeHolds();
    const amount = Math.min(BALANCE.TRADE_BATCH, planet.stock[commodity], Math.max(0, freeHolds));
    if (amount <= 0) { log(`No available ${formatCommodity(commodity)} or no free cargo holds.`); return; }
    if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
    planet.stock[commodity] -= amount;
    state.player.cargo[commodity] += amount;
    log(`Loaded ${amount} ${formatCommodity(commodity)} from the colony.`);
}

export function buildColonyStructure(key) {
    const planet = state.planets[state.player.currentSector];
    const def = BUILDING_DEFS[key];
    if (!planet || planet.owner !== "Player" || !def) return;
    if (state.player.credits < def.credits || !hasCargo(def.cargo)) {
        log(`${def.name} requires ${formatCredits(def.credits)} credits and cargo: ${describeCost(def.cargo)}.`);
        return;
    }
    if (!spendTime(def.minutes)) return;
    state.player.credits -= def.credits;
    removeCargo(def.cargo);
    
    if (!planet.buildings) planet.buildings = {};
    planet.buildings[key] = (planet.buildings[key] || 0) + 1;
    
    // Recalculate max stock
    planet.maxStock = getColonyMaxStock(planet);
    
    rebuildEconomicProfiles();
    log(`Built ${def.name} level ${planet.buildings[key]} on the colony.`);
}

export function getColonyDailyNeeds(planet) {
    if (!planet || planet.owner !== "Player") return makeStock();
    const needs = makeStock();
    const pop = planet.colonists || 100;
    
    const housingTier = clampRange((planet.buildings?.housing || 0) + (planet.buildings?.habitat || 0), 1, 5);
    
    // Tier 1 needs
    needs.water_ice = Math.max(1, Math.floor(pop / 100));
    needs.org = Math.max(1, Math.floor(pop / 80 + (planet.buildings?.habitat || 0) + (planet.buildings?.farm || 0)));

    // Tier 2 needs
    if (housingTier >= 2) {
        needs.repair_parts = Math.max(0, Math.floor(pop / 150));
        needs.medical_supplies = Math.max(0, Math.floor(pop / 200));
    }

    // Tier 3 needs
    if (housingTier >= 3) {
        needs.pulse_canister = Math.max(0, Math.floor(pop / 250));
        needs.electronics = Math.max(0, Math.floor(pop / 300));
    }

    // Tier 4 needs
    if (housingTier >= 4) {
        needs.eq = Math.max(0, Math.floor(pop / 350));
        needs.construction_kits = Math.max(0, Math.floor(pop / 400));
    }

    // Tier 5 needs
    if (housingTier >= 5) {
        needs.machinery = Math.max(0, Math.floor(pop / 500));
    }

    // Industrial / defense maintenance needs
    const mine = planet.buildings?.mine || 0;
    const farm = planet.buildings?.farm || 0;
    const refinery = planet.buildings?.refinery || 0;
    const factory = planet.buildings?.factory || 0;
    const electronics_fab = planet.buildings?.electronics_fab || 0;
    const medical_lab = planet.buildings?.medical_lab || 0;
    const pulse_works = planet.buildings?.pulse_works || 0;
    const defense = planet.buildings?.defense || 0;
    const habitat = planet.buildings?.habitat || 0;

    needs.ore = Math.floor(factory * 3 + refinery * 2 + defense * 2 + pop / 180);
    
    // Add industrial maintenance
    needs.repair_parts = (needs.repair_parts || 0) + Math.floor((mine + farm + refinery + factory + electronics_fab + medical_lab + pulse_works) * 0.5);
    needs.eq = (needs.eq || 0) + Math.floor(habitat + mine + farm + refinery + factory + electronics_fab + medical_lab + pulse_works + defense * 2);
    needs.coolants = Math.floor(refinery * 1 + pulse_works * 1 + defense * 0.5);

    // Apply policy adjustments if any
    if (planet.policy) {
        if (planet.policy.security === "sda_patrol") {
            needs.pulse_canister = (needs.pulse_canister || 0) + 1;
        }
    }

    // Ensure all values are non-negative integers
    Object.keys(needs).forEach(k => {
        needs[k] = Math.max(0, Math.floor(needs[k] || 0));
    });

    return needs;
}

export function applyColonyNeedsConsumption() {
    Object.values(state.planets).forEach(planet => {
        if (planet.owner !== "Player") return;
        if (!planet.shortages) planet.shortages = makeStock();
        
        const needs = getColonyDailyNeeds(planet);
        let totalNeeded = 0;
        let totalMet = 0;
        
        COMMODITIES.forEach(c => {
            const need = needs[c] || 0;
            if (need > 0) {
                totalNeeded += need;
                const used = Math.min(planet.stock[c] || 0, need);
                planet.stock[c] -= used;
                totalMet += used;
                const missing = Math.max(0, need - used);
                planet.shortages[c] = missing;
            } else {
                planet.shortages[c] = 0;
            }
        });

        // Compute breakdown
        const housingCapacity = 100 + (planet.buildings?.habitat || 0) * 250 + (planet.buildings?.housing || 0) * 150;
        const housingSat = planet.colonists <= housingCapacity ? 100 : Math.max(0, Math.round((housingCapacity / planet.colonists) * 100));
        
        const servicesCapacity = 50 + (planet.buildings?.civic_services || 0) * 150;
        const servicesSat = planet.colonists <= servicesCapacity ? 100 : Math.max(0, Math.round((servicesCapacity / planet.colonists) * 100));

        const supplySat = totalNeeded > 0 ? Math.round((totalMet / totalNeeded) * 100) : 100;

        planet.satisfactionBreakdown = {
            housing: housingSat,
            services: servicesSat,
            supply: supplySat
        };
        
        planet.housingTier = clampRange((planet.buildings?.housing || 0) + (planet.buildings?.habitat || 0), 1, 5);
        planet.serviceTier = clampRange(1 + (planet.buildings?.civic_services || 0), 1, 5);
        
        // Generate demand profile to be used by profiles.js
        planet.demandProfile = {
            baselineConsumption: makeStock(needs),
            targetStock: makeStock(),
            strategicReserve: makeStock()
        };
        COMMODITIES.forEach(c => {
            if (needs[c] > 0) {
                planet.demandProfile.targetStock[c] = Math.max(20, needs[c] * 8);
                planet.demandProfile.strategicReserve[c] = Math.round(planet.demandProfile.targetStock[c] * 0.25);
            }
        });
    });
}

export function updateColonyNeedsDaily() {
    applyColonyNeedsConsumption();
    updateColonySatisfactionDaily();
}

export function applyColonySpoilage(planet, sectorId) {
    COMMODITIES.forEach(c => {
        const def = getCommodityDef(c);
        if (def && def.decayRate > 0) {
            const current = planet.stock[c] || 0;
            if (current > 0) {
                let mitigation = 1.0;
                if (def.storageClass === "cold") {
                    mitigation = Math.max(0, 1 - (planet.buildings?.cold_storage || 0) * 0.4);
                } else if (def.storageClass === "pulse") {
                    mitigation = Math.max(0, 1 - (planet.buildings?.pulse_works || 0) * 0.4);
                }
                const spoiled = Math.round(current * def.decayRate * mitigation);
                if (spoiled > 0) {
                    planet.stock[c] = Math.max(0, current - spoiled);
                    if (spoiled > 5) {
                        addWorldEvent({
                            type: "colony_spoilage",
                            sectorId,
                            text: `${spoiled} units of ${formatCommodity(c)} spoiled at Colony S${sectorId} due to storage decay.`,
                            importance: 2,
                            alert: false
                        });
                    }
                }
            }
        }
    });
}

export function tickColonyLeasesDaily(planet, sectorId) {
    let rentCollected = 0;
    if (!planet.leases) planet.leases = [];
    
    planet.leases.forEach(lease => {
        if (lease.status === "active") {
            rentCollected += lease.rentDaily;
            lease.condition = Math.max(0, lease.condition - (0.5 + random() * 0.5));
            
            if (lease.condition < 50 && random() < 0.1) {
                addWorldEvent({
                    type: "colony_lease_dispute",
                    sectorId,
                    text: `Lease dispute at S${sectorId}: tenant company is contesting rent due to poor facility condition (${Math.round(lease.condition)}%).`,
                    importance: 2,
                    alert: true
                });
            }
        }
    });
    
    if (rentCollected > 0) {
        state.player.credits += rentCollected;
    }
    
    const maxLeasedSlots = 1 + (planet.buildings?.civic_services || 0);
    if (planet.leases.length < maxLeasedSlots && random() < 0.25) {
        const companies = Object.values(state.companies || {});
        if (companies.length > 0) {
            const company = companies[Math.floor(random() * companies.length)];
            const rent = Math.round(60 + random() * 50 + (planet.satisfaction - 50) * 0.5);
            planet.leases.push({
                id: `lease-${sectorId}-${planet.leases.length + 1}`,
                companyId: company.id,
                companyName: company.name,
                rentDaily: rent,
                condition: 100,
                status: "active"
            });
            addWorldEvent({
                type: "colony_lease_signed",
                sectorId,
                text: `${company.name} leased an industrial slot at Colony S${sectorId} for ${rent} credits/day.`,
                importance: 2,
                alert: false
            });
        }
    }
}

export function generateColonyMissionsDaily(planet, sectorId) {
    // Emergency shortage relief
    Object.entries(planet.shortages || {}).forEach(([c, amount]) => {
        if (amount > 0 && random() < 0.3) {
            const exists = state.missions.some(m => m.type === "delivery" && m.destinationSector === sectorId && m.commodity === c && m.status === "available");
            if (!exists) {
                const reward = Math.round(amount * (getCommodityDef(c)?.basePrice || 100) * 1.5 + 500);
                const m = {
                    id: state.nextMissionId++,
                    title: `Emergency Shortage Relief: ${amount} ${formatCommodity(c)} to Colony S${sectorId}`,
                    type: "delivery",
                    status: "available",
                    originSector: state.player.currentSector,
                    destinationSector: sectorId,
                    commodity: c,
                    amount: amount,
                    factionId: planet.factionId || "colonists",
                    rewardCredits: reward,
                    rewardRep: 3,
                    expiresDay: state.player.time.day + 4,
                    operationMinutes: 60
                };
                state.missions.push(m);
            }
        }
    });

    // Pulse restock job
    const pulseStock = planet.stock?.pulse_canister || 0;
    if (pulseStock < 5 && random() < 0.25) {
        const exists = state.missions.some(m => m.type === "delivery" && m.destinationSector === sectorId && m.commodity === "pulse_canister" && m.status === "available");
        if (!exists) {
            const m = {
                id: state.nextMissionId++,
                title: `Pulse Restock: 10 Pulse Canisters to Colony S${sectorId}`,
                type: "delivery",
                status: "available",
                originSector: state.player.currentSector,
                destinationSector: sectorId,
                commodity: "pulse_canister",
                amount: 10,
                factionId: planet.factionId || "colonists",
                rewardCredits: 4000,
                rewardRep: 2,
                expiresDay: state.player.time.day + 5,
                operationMinutes: 60
            };
            state.missions.push(m);
        }
    }

    // Maintenance Crisis
    if (planet.facilityCondition < 60 && random() < 0.2) {
        const exists = state.missions.some(m => m.type === "contest" && m.targetSector === sectorId && m.title.includes("Maintenance") && m.status === "available");
        if (!exists) {
            const m = {
                id: state.nextMissionId++,
                title: `Resolve Maintenance Crisis at Colony S${sectorId}`,
                type: "contest",
                status: "available",
                originSector: state.player.currentSector,
                targetSector: sectorId,
                factionId: planet.factionId || "colonists",
                rewardCredits: 1500,
                rewardRep: 2,
                expiresDay: state.player.time.day + 3,
                operationMinutes: 120,
                context: "Perform emergency repairs and structural stabilization."
            };
            state.missions.push(m);
        }
    }
}

export function maintainColonyLease(leaseId) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || !planet.leases) return;
    const lease = planet.leases.find(l => l.id === leaseId);
    if (!lease) return;
    if (state.player.credits < 150) {
        log("Maintaining a leased slot costs 150 credits.");
        return;
    }
    state.player.credits -= 150;
    lease.condition = 100;
    log(`Maintained leased slot for ${lease.companyName}. Condition restored to 100%.`);
}

export function terminateColonyLease(leaseId) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || !planet.leases) return;
    planet.leases = planet.leases.filter(l => l.id !== leaseId);
    log(`Terminated lease ${leaseId}. Slot is now vacant.`);
}

export function updateColonySatisfactionDaily() {
    Object.entries(state.planets).forEach(([sectorIdText, planet]) => {
        if (planet.owner !== "Player") return;
        const sectorId = Number(sectorIdText);
        if (typeof planet.satisfaction !== "number") planet.satisfaction = 60;
        if (!planet.satisfactionBreakdown) {
            planet.satisfactionBreakdown = { housing: 100, services: 100, supply: 100 };
        }
        
        const { housing, services, supply } = planet.satisfactionBreakdown;
        const targetSatisfaction = Math.round((housing + services + supply) / 3);
        
        const diff = targetSatisfaction - planet.satisfaction;
        if (diff > 0) {
            planet.satisfaction = clampRange(planet.satisfaction + Math.min(3, diff), 0, 100);
        } else if (diff < 0) {
            const shortageRelief = getTraitBonus(state.player.character, "shortageReliefPercent") / 100;
            const penalty = Math.max(3, Math.round(Math.abs(diff) * 0.15 * (1 - shortageRelief)));
            planet.satisfaction = clampRange(planet.satisfaction - penalty, 0, 100);
        }

        if (planet.satisfaction >= 80 && random() < 0.18) {
            addFactionRep("colonists", 1, "well-supplied colony");
        }

        if (planet.satisfaction < 25) {
            const lost = Math.max(1, Math.floor(planet.colonists * 0.02));
            planet.colonists = Math.max(20, planet.colonists - lost);
            addWorldEvent({
                type: "colony_shortage", sectorId, factionId: planet.factionId || "colonists",
                text: `Colony S${sectorId} is undersupplied. Satisfaction fell to ${planet.satisfaction}, and ${lost} colonists left.`,
                importance: 3, alert: true
            });
        } else if (supply < 100) {
            addWorldEvent({
                type: "colony_shortage", sectorId, factionId: planet.factionId || "colonists",
                text: `Colony S${sectorId} reported shortages of daily necessities.`,
                importance: 2, alert: false
            });
        }

        // Apply spoilage
        applyColonySpoilage(planet, sectorId);

        // Tick leases
        tickColonyLeasesDaily(planet, sectorId);

        // Generate missions
        generateColonyMissionsDaily(planet, sectorId);
    });
}

export function produceColonies() {
    Object.entries(state.planets).forEach(([sectorIdText, planet]) => {
        if (planet.owner !== "Player") return;
        const sectorId = Number(sectorIdText);
        const type = PLANET_TYPES[planet.typeKey];
        
        // Update facilityCondition if not defined
        if (typeof planet.facilityCondition !== "number") planet.facilityCondition = 100;
        
        // Auto-repair using repair_parts from stock
        const totalFacilities = (planet.buildings?.mine || 0) + (planet.buildings?.farm || 0) +
            (planet.buildings?.refinery || 0) + (planet.buildings?.factory || 0) +
            (planet.buildings?.electronics_fab || 0) + (planet.buildings?.medical_lab || 0) +
            (planet.buildings?.pulse_works || 0) + (planet.buildings?.defense || 0);
            
        // Condition decay
        const conditionDecay = 0.5 + 0.1 * totalFacilities;
        planet.facilityCondition = Math.max(0, planet.facilityCondition - conditionDecay);
        
        const repairPartsUsed = Math.min(planet.stock.repair_parts || 0, Math.ceil((100 - planet.facilityCondition) / 5));
        if (repairPartsUsed > 0) {
            planet.stock.repair_parts -= repairPartsUsed;
            planet.facilityCondition = Math.min(100, planet.facilityCondition + repairPartsUsed * 5);
        }
        
        // Recompute maxStock based on built structures
        planet.maxStock = getColonyMaxStock(planet);
        
        const habitat = planet.buildings?.habitat || 0;
        const housingCapacity = 100 + habitat * 250 + (planet.buildings?.housing || 0) * 150;
        
        let growthMultiplier = type.growth;
        if (planet.policy && planet.policy.registration === "informal") growthMultiplier *= 1.08;
        if (planet.policy && planet.policy.security === "sda_patrol") growthMultiplier *= 0.97;
        if (planet.factionId === "colonists") growthMultiplier *= 1 + getGuildTier("colonists") * 0.05;
        const growth = Math.floor((4 + habitat * 3) * growthMultiplier);
        planet.colonists = Math.min(housingCapacity, planet.colonists + growth);
        
        const dominant = getDominantInfluence(sectorId);
        const hcIndustrialBonus = dominant === "hc" ? 1.08 : 1.0;
        const fuColonyBonus = dominant === "fu" ? 1.07 : 1.0;
        const vcShadowBonus = planet.policy && planet.policy.security === "cartel_protection" ? 1.06 : 1.0;
        
        // Calculate efficiency modifiers
        const laborFactor = (planet.satisfaction || 60) / 100;
        const conditionFactor = planet.facilityCondition / 100;
        const hasRoute = state.tradeRoutes && state.tradeRoutes.some(r => r.status === 'active' && (r.originSector === sectorId || r.destinationSector === sectorId));
        const routeAccessFactor = hasRoute ? 1.0 : 0.5;
        const efficiency = laborFactor * conditionFactor * routeAccessFactor;
        
        // 1. Raw extraction
        const mineLevel = planet.buildings?.mine || 0;
        if (mineLevel > 0 || planet.colonists > 0) {
            const oreProduced = Math.floor((mineLevel * 14 + planet.colonists / 60) * type.ore * hcIndustrialBonus * vcShadowBonus * efficiency * getColonyProductionMultiplier(planet, "ore"));
            const heavyMetalsProduced = Math.floor((mineLevel * 6 + planet.colonists / 120) * type.ore * efficiency);
            const rareEarthsProduced = Math.floor((mineLevel * 3 + planet.colonists / 200) * type.ore * efficiency);
            
            planet.stock.ore = Math.min(planet.maxStock.ore, (planet.stock.ore || 0) + oreProduced);
            planet.stock.heavy_metals = Math.min(planet.maxStock.heavy_metals, (planet.stock.heavy_metals || 0) + heavyMetalsProduced);
            planet.stock.rare_earths = Math.min(planet.maxStock.rare_earths, (planet.stock.rare_earths || 0) + rareEarthsProduced);
        }
        
        const farmLevel = planet.buildings?.farm || 0;
        if (farmLevel > 0 || planet.colonists > 0) {
            const orgProduced = Math.floor((farmLevel * 14 + planet.colonists / 70) * type.org * fuColonyBonus * efficiency * getColonyProductionMultiplier(planet, "org"));
            const waterIceProduced = Math.floor((farmLevel * 8 + planet.colonists / 90) * type.org * efficiency);
            
            planet.stock.org = Math.min(planet.maxStock.org, (planet.stock.org || 0) + orgProduced);
            planet.stock.water_ice = Math.min(planet.maxStock.water_ice, (planet.stock.water_ice || 0) + waterIceProduced);
        }
        
        // 2. Run recipe production
        const FACILITY_RECIPES = {
            refinery: ['refined_metals', 'polymers', 'coolants', 'fertilizer'],
            factory: ['machinery', 'eq', 'repair_parts', 'construction_kits'],
            electronics_fab: ['electronics', 'control_cores'],
            medical_lab: ['medical_supplies'],
            pulse_works: ['pulse_canister', 'heavy_pulse_module', 'gate_coils']
        };
        
        Object.entries(FACILITY_RECIPES).forEach(([facilityKey, commoditiesList]) => {
            const lvl = planet.buildings?.[facilityKey] || 0;
            if (lvl <= 0) return;
            
            commoditiesList.forEach(c => {
                const recipe = PRODUCTION_RECIPES[c];
                if (!recipe) return;
                
                const baseCap = recipe.baseCapacity || 1;
                const capacity = Math.max(1, Math.round(lvl * baseCap * efficiency));
                
                let maxByInput = capacity;
                Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
                    const currentStock = planet.stock[input] || 0;
                    maxByInput = Math.min(maxByInput, Math.floor(currentStock / amountPerUnit));
                });
                
                const currentOutput = planet.stock[c] || 0;
                const maxOutput = planet.maxStock[c] || 50;
                const availableSpace = Math.max(0, maxOutput - currentOutput);
                const recipeOutputUnits = recipe.output || 1;
                const outputUnits = Math.min(maxByInput, Math.floor(availableSpace / recipeOutputUnits));
                
                if (outputUnits > 0) {
                    // Consume inputs
                    Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
                        planet.stock[input] = Math.max(0, (planet.stock[input] || 0) - outputUnits * amountPerUnit);
                    });
                    // Produce outputs
                    planet.stock[c] = Math.min(maxOutput, currentOutput + outputUnits * recipeOutputUnits);
                }
            });
        });
        
        const major = planet.factionId && FACTIONS[planet.factionId] && FACTIONS[planet.factionId].majorAffinity ? FACTIONS[planet.factionId].majorAffinity : planet.factionId;
        if (["sda", "fu", "hc", "vc"].includes(major)) addSectorInfluence(sectorId, major, 1, "");
        if (planet.policy && planet.policy.security === "cartel_protection") addSectorInfluence(sectorId, "vc", 1, "");
    });
}

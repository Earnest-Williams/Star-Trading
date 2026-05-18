export const LOGISTICS_OBJECTIVE_TEMPLATES = Object.freeze({
    shortageRelief: Object.freeze({
        id: "shortage_relief_colony_org",
        kind: "route_supply",
        title: "Shortage Relief: Organics Corridor",
        description: "Keep a colony or port supplied with Organics before local stores collapse.",
        sponsorFactionId: "colonists",
        targetSectorRole: "player_colony_or_port",
        durationDays: 10,
        riskPosture: "steady",
        requirements: Object.freeze({
            throughput: Object.freeze({ org: 120 }),
            minReliability: 70,
            maxFailedRuns: 2,
            acceptedSources: Object.freeze(["trade_route", "colony_deposit", "market_trade"]),
            allowAmbient: false
        }),
        rewards: Object.freeze({ credits: 900, reputation: 2, trust: 1, influence: 2 }),
        penalties: Object.freeze({ reputation: -1, trust: -1, heat: 1 }),
        politicalConsequence: "Stabilizes colonist-aligned supply claims in the target sector."
    }),
    convoyRisk: Object.freeze({
        id: "convoy_risk_contested_corridor",
        kind: "convoy_risk",
        title: "Convoy Risk Premium",
        description: "Move cargo through a dangerous corridor while avoiding raid losses.",
        sponsorFactionId: "traders",
        targetSectorRole: "contested_or_threatened_port",
        durationDays: 12,
        riskPosture: "bold",
        requirements: Object.freeze({
            throughput: Object.freeze({ ore: 60, eq: 30 }),
            minRouteHeat: 3,
            maxFailedRuns: 3,
            acceptedSources: Object.freeze(["trade_route"]),
            allowAmbient: false
        }),
        rewards: Object.freeze({ credits: 1200, reputation: 2, trust: 1, influence: 1 }),
        penalties: Object.freeze({ reputation: -1, trust: 0, heat: 2 }),
        politicalConsequence: "Sponsors reward commanders who prove hot corridors can remain commercially viable."
    }),
    sectorControl: Object.freeze({
        id: "sector_control_logistics",
        kind: "sector_control_campaign",
        title: "Sector-Control Logistics Campaign",
        description: "A faction-backed multi-stage effort to supply, stabilize, and influence a contested sector.",
        sponsorFactionId: "sda",
        targetSectorRole: "contested_sector",
        durationDays: 18,
        riskPosture: "campaign",
        stages: Object.freeze([
            Object.freeze({ id: "supply", label: "Deliver campaign supplies", throughput: Object.freeze({ eq: 40, org: 40 }) }),
            Object.freeze({ id: "stabilize", label: "Stabilize route operations", routeRuns: 3, maxFailedRuns: 2 }),
            Object.freeze({ id: "secure", label: "Reduce pirate pressure or confirm dominance", pirateThreatReduction: 1, dominanceRequired: true })
        ]),
        requirements: Object.freeze({
            throughput: Object.freeze({ eq: 40, org: 40 }),
            routeRuns: 3,
            maxFailedRuns: 2,
            pirateThreatReduction: 1,
            acceptedSources: Object.freeze(["trade_route", "market_trade", "colony_deposit", "secure_delivery"]),
            allowAmbient: false
        }),
        rewards: Object.freeze({ credits: 1400, reputation: 3, trust: 2, influence: 5, rivalInfluence: -2 }),
        penalties: Object.freeze({ reputation: -2, trust: -1, heat: 2 }),
        politicalConsequence: "Successful campaign logistics harden sponsor claims and undermine the nearest rival bloc."
    })
});

export const LOGISTICS_OBJECTIVE_TEMPLATE_ORDER = Object.freeze([
    "shortageRelief",
    "convoyRisk",
    "sectorControl"
]);

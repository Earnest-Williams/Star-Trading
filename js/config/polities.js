export const POLITY_DEFS = Object.freeze({
    stardock_federation: Object.freeze({
        id: "stardock_federation",
        name: "StarDock Federation",
        type: "federation",
        dominantFactionId: "sda",
        laws: Object.freeze({ inspectionLevel: 0.7, tollPolicy: "regulated", contrabandPolicy: "strict", corporatePrivileges: 0.35, militiaRights: 0.3 })
    }),
    helion_imperial_compact: Object.freeze({
        id: "helion_imperial_compact",
        name: "Helion Imperial Compact",
        type: "empire",
        dominantFactionId: "hc",
        laws: Object.freeze({ inspectionLevel: 0.55, tollPolicy: "chartered", contrabandPolicy: "industrial", corporatePrivileges: 0.85, militiaRights: 0.25 })
    }),
    frontier_free_leagues: Object.freeze({
        id: "frontier_free_leagues",
        name: "Frontier Free Leagues",
        type: "league",
        dominantFactionId: "fu",
        laws: Object.freeze({ inspectionLevel: 0.35, tollPolicy: "local", contrabandPolicy: "lenient", corporatePrivileges: 0.25, militiaRights: 0.8 })
    }),
    void_protectorates: Object.freeze({
        id: "void_protectorates",
        name: "Void Protectorates",
        type: "protectorate",
        dominantFactionId: "vc",
        laws: Object.freeze({ inspectionLevel: 0.15, tollPolicy: "protection", contrabandPolicy: "open_secret", corporatePrivileges: 0.45, militiaRights: 0.65 })
    }),
    independent_worlds: Object.freeze({
        id: "independent_worlds",
        name: "Independent Worlds",
        type: "independent",
        dominantFactionId: "fu",
        laws: Object.freeze({ inspectionLevel: 0.25, tollPolicy: "local", contrabandPolicy: "variable", corporatePrivileges: 0.35, militiaRights: 0.7 })
    })
});

export const LOCAL_AUTHORITY_TYPES = Object.freeze([
    "station_council",
    "corporate_prefecture",
    "colonial_administration",
    "freeport_board",
    "cartel_cell"
]);

export const POLITY_SETTINGS = Object.freeze({
    INDEPENDENT_FRACTION: 0.18,
    CAPITAL_COUNT: 4
});

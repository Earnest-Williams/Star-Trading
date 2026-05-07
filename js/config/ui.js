export const MAP_UI = Object.freeze({
    PROJECTION: Object.freeze({ Z_TO_X: 0.35, Z_TO_Y: 0.22 }),
    LAYOUT: Object.freeze({ LEFT: 50, TOP: 35, WIDTH: 600, HEIGHT: 350 }),
    NODES: Object.freeze({ RADIUS: 12, SELECTED_RADIUS: 17, CLICK_RADIUS: 24 }),
    LABELS: Object.freeze({
        ID_FONT: "13px VT323",
        ID_OFFSET_X: -6,
        ID_OFFSET_Y: 4,
        FACTION_FONT: "14px VT323",
        FACTION_OFFSET_X: 9,
        FACTION_OFFSET_Y: -9,
        CAPTAIN_FONT: "13px VT323",
        CAPTAIN_OFFSET_X: -18,
        CAPTAIN_OFFSET_Y: -12
    }),
    LINKS: Object.freeze({ WIDTH: 1 }),
    SELECTION: Object.freeze({ STROKE_WIDTH: 3 })
});

export const StateSlice = {
    PLAYER: 'player',
    TIME: 'time',

    UNIVERSE: 'universe',
    PORTS: 'ports',
    PLANETS: 'planets',
    FACTIONS: 'factions',
    CAPTAINS: 'captains',
    MISSIONS: 'missions',
    TRADE_ROUTES: 'tradeRoutes',
    DATA_CARGO: 'dataCargo',
    ENTANGLEMENTS: 'entanglements',
    WORLD_EVENTS: 'worldEvents',

    CURRENT_SCREEN: 'currentScreen',
    REPUTATION_TAB: 'reputationTab',
    SELECTED_SECTOR: 'selectedSector',
    SELECTED_CAPTAIN: 'selectedCaptain',
    MAP_VIEW: 'mapView'
};

export function stateChanged(...slices) {
    return slices;
}

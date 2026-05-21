import { state } from '../state.js';

export function setEconomyFocus(sectorId, commodity, source) {
    state.economyFocus = {
        sectorId: Number(sectorId || state.player?.currentSector || 0),
        commodity: commodity || null,
        source: source || null,
        updatedDay: Number(state.player?.time?.day || 0)
    };
}

import { createCharacter, normaliseCharacter } from '../characters.js';
import { isObject } from './helpers.js';

function normaliseCaptainCharacters(captains) {
    if (!isObject(captains)) return;
    Object.values(captains).forEach(captain => {
        if (!isObject(captain)) return;
        captain.character = normaliseCharacter(captain.character || createCharacter());
    });
}

export function apply(data) {
    if (!isObject(data)) return data;
    if (isObject(data.player)) data.player.character = normaliseCharacter(data.player.character || createCharacter());
    normaliseCaptainCharacters(data.captains);
    return data;
}

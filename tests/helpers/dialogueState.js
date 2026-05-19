import { resetState, state } from '../../js/state.js';

export function seedDialogueRelationshipState(person) {
    resetState();
    state.player = { time: { day: 1, minuteOfDay: 600 } };
    state.people = person?.id ? { [person.id]: person } : {};
}

export function seedDialogueLoadNormalisationState(people) {
    resetState();
    state.player = { time: { day: 1, minuteOfDay: 600 }, cargo: {}, factions: {} };
    state.people = people;
}

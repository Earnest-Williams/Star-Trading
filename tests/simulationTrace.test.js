import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { addWorldEvent } from '../js/core/worldEvents.js';
import {
    addSimulationTraceEvent,
    getRecentSimulationTrace,
    getSimulationTraceCausalChain,
    getSimulationTraceCauses,
    normaliseSimulationTrace
} from '../js/core/simulationTrace.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from '../js/systems/people/dialogueEvents.js';
import { resetState, state } from '../js/state.js';

beforeEach(() => {
    resetState();
    state.player = { time: { day: 3, minuteOfDay: 120 }, currentSector: 7 };
});

describe('simulation trace layer', () => {
    it('records world and dialogue events with one standard cross-system schema', () => {
        const worldEvent = addWorldEvent({
            type: 'trade_route_failed',
            sourceSystem: 'trade_routes',
            sectorId: 7,
            factionId: 'traders',
            routeId: 12,
            text: 'A route failed because pirate pressure rose.',
            importance: 3,
            causedBy: [{ sourceSystem: 'threat', eventType: 'pirate_pressure_rose', eventId: 4 }]
        });
        const dialogueEvent = addDialogueEvent({
            eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED,
            actor: 'person-1',
            subject: 'player',
            conversationId: 'conversation-1',
            partId: 9,
            causedBy: { sourceSystem: 'world', eventId: worldEvent.id, label: 'route failure' },
            summary: { text: 'A broker opened a follow-up conversation.' }
        });

        assert.equal(state.simulationTrace.length, 2);
        assert.deepEqual(
            state.simulationTrace.map(event => event.sourceSystem),
            ['trade_routes', 'dialogue']
        );
        assert.equal(state.simulationTrace[0].worldEventId, worldEvent.id);
        assert.equal(state.simulationTrace[0].routeId, 12);
        assert.equal(state.simulationTrace[1].dialogueEventId, dialogueEvent.id);
        assert.equal(state.simulationTrace[1].conversationId, 'conversation-1');
        assert.equal(state.simulationTrace[1].causedBy[0].label, 'route failure');
    });

    it('keeps chronological ordering and resolves trace causal chains', () => {
        state.player.time = { day: 5, minuteOfDay: 300 };
        const later = addSimulationTraceEvent({
            eventType: 'route_failed',
            sourceSystem: 'trade_routes',
            summary: { text: 'Route failed.' }
        });
        const earlier = addSimulationTraceEvent({
            eventType: 'pirate_pressure_rose',
            sourceSystem: 'threat',
            summary: { text: 'Pirate pressure rose.' },
            timestamp: { day: 5, minuteOfDay: 240 }
        });
        const linked = addSimulationTraceEvent({
            eventType: 'captain_warning_sent',
            sourceSystem: 'dialogue',
            causedBy: [{ traceId: earlier.id }, { traceId: later.id }],
            summary: { text: 'A captain warned you about the failed route.' },
            timestamp: { day: 5, minuteOfDay: 301 }
        });

        assert.deepEqual(
            state.simulationTrace.map(event => event.id),
            [earlier.id, later.id, linked.id]
        );
        assert.deepEqual(
            getRecentSimulationTrace(2).map(event => event.id),
            [linked.id, later.id]
        );
        assert.deepEqual(
            getSimulationTraceCauses(linked.id).map(event => event.id),
            [earlier.id, later.id]
        );
        assert.deepEqual(
            getSimulationTraceCausalChain(linked.id).map(event => event.id),
            [earlier.id, later.id, linked.id]
        );
    });


    it('normalizes timestamp variants and generic causal ids without mis-linking traces', () => {
        const first = addSimulationTraceEvent({
            eventType: 'first_event',
            sourceSystem: 'test',
            timestamp: { day: 4, minute: 90 },
            causedBy: { sourceSystem: 'world', id: 22, label: 'world row' }
        });
        const second = addSimulationTraceEvent({
            eventType: 'second_event',
            sourceSystem: 'test',
            timestamp: { absoluteMinute: (6 * 1440) + 30 },
            causedBy: { traceId: first.id }
        });

        assert.equal(first.day, 4);
        assert.equal(first.minute, 90);
        assert.equal(first.causedBy[0].traceId, null);
        assert.equal(first.causedBy[0].eventId, 22);
        assert.equal(second.day, 7);
        assert.equal(second.minute, 30);
        assert.deepEqual(
            getSimulationTraceCauses(second.id).map(event => event.id),
            [first.id]
        );
    });

    it('normalises legacy trace rows and advances the next id safely', () => {
        state.simulationTrace = [
            {
                id: '8',
                type: 'legacy_world_event',
                sourceSystem: 'world',
                day: '2',
                minuteOfDay: '30',
                causedBy: { sourceSystem: 'captains', eventId: '5', text: 'Captain action' }
            }
        ];
        state.nextSimulationTraceId = 1;

        normaliseSimulationTrace();

        assert.equal(state.simulationTrace[0].id, 8);
        assert.equal(state.simulationTrace[0].eventType, 'legacy_world_event');
        assert.equal(state.simulationTrace[0].minute, 30);
        assert.deepEqual(state.simulationTrace[0].causedBy[0], {
            traceId: null,
            sourceSystem: 'captains',
            eventType: null,
            eventId: 5,
            label: 'Captain action'
        });
        assert.equal(state.nextSimulationTraceId, 9);
    });

    it('preserves the next id from trimmed high-id legacy trace rows', () => {
        state.simulationTrace = Array.from({ length: 170 }, (_, index) => ({
            id: index + 1,
            eventType: 'legacy_event',
            sourceSystem: 'test',
            day: 1,
            minute: 170 - index
        }));
        state.nextSimulationTraceId = 1;

        normaliseSimulationTrace();

        assert.equal(state.simulationTrace.length, 160);
        assert.equal(state.nextSimulationTraceId, 171);
    });
});

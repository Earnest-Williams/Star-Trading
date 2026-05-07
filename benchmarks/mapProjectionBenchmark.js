import { performance } from 'node:perf_hooks';

import { resetState, state } from '../js/state.js';
import { getMapNodes, invalidateMapProjectionCache } from '../js/ui/renderMap.js';

function buildUniverse(size, chartedFraction) {
    const universe = {};
    for (let id = 1; id <= size; id += 1) {
        universe[id] = {
            id,
            charted: id <= Math.floor(size * chartedFraction),
            coord: {
                x: (id * 37) % 997,
                y: (id * 53) % 991,
                z: (id * 17) % 31
            },
            jumpGates: []
        };
    }
    return universe;
}

function measureScenario({ label, size, chartedFraction, iterations }) {
    resetState();
    invalidateMapProjectionCache();
    state.player = { currentSector: 1 };
    state.universe = buildUniverse(size, chartedFraction);

    const warmStart = performance.now();
    getMapNodes();
    const warmMs = performance.now() - warmStart;

    const repeatedStart = performance.now();
    for (let i = 0; i < iterations; i += 1) {
        getMapNodes();
    }
    const repeatedMs = performance.now() - repeatedStart;

    return {
        label,
        size,
        charted: Object.values(state.universe).filter(site => site.charted).length,
        iterations,
        coldMs: Number(warmMs.toFixed(3)),
        repeatedMs: Number(repeatedMs.toFixed(3)),
        averageRepeatedMs: Number((repeatedMs / iterations).toFixed(6))
    };
}

const scenarios = [
    { label: 'medium', size: 500, chartedFraction: 0.5, iterations: 1000 },
    { label: 'large', size: 5000, chartedFraction: 0.5, iterations: 1000 }
];

console.table(scenarios.map(measureScenario));

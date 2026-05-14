# Star-Trading Architecture

## High-Level Overview
Star-Trading is a browser-based sparse-3D galaxy space-trading / logistics simulation.
Players and AI captains operate persistent trade routes across jump-gate networks whose feasibility depends on Euclidean distance + local *metric shear*. Pulse-energy logistics, living captain economies, faction politics, and emergent ambient trade create a dense, interconnected simulation.

## Module Map (post-split)
- **`js/core/`**
  - `universe/generator.js` – seeded galaxy & gate creation
  - `universe/physics.js` – shear, effective span, corridor legality
  - `universe/projection.js` – 2D/3D canvas math + caching
  - `universe/index.js` – public API
- **`js/systems/`**
  - `captains/core.js`, `economy.js`, `ai.js`, `persistence.js`
  - `tradeRoutes/validation.js`, `economics.js`, `assignment.js`
  - `entanglements/factions.js`, `events.js`
  - `politics.js`, `missions.js`
- **`js/core/dataCargo/`** – data-cargo state, contraband/private payloads, and mission hooks
- **`js/ui/`** – reactive canvas renderers, inspectors, EventBus consumers
- **`js/config/`** – balance constants, archetypes, presets

## Data Flow
1. Seed → `universe/generator` → sites + gates
2. `App.tick()` → `systems/captains/ai` + `tradeRoutes` + `politics` + `entanglements`
3. `EventBus` → UI renderers (invalidate + redraw)
4. Persistence layer normalizes & migrates saves automatically.

## Related design docs

- [Dynamic Dialogue, Memory, Task, and World Simulation](./design/dynamic-dialogue-memory-simulation.md) — Integration plan for bounded NPC dialogue, semantic memory, deferred follow-up tasks, Communications-based follow-up, and causal debugging over existing Star-Trading systems.

## Key Design Decisions
- Sparse coordinate keys (`"x,y,z"`) instead of dense grids
- Seeded RNG everywhere → reproducible galaxies & saves
- Pure functions in `physics` and `economics` modules
- Versioned save migration (see `persistence/migrations/`)
- EventBus for zero-framework reactivity

## How to Add a New Captain Trait
1. Add trait definition in `js/config/captainArchetypes.js` (or the relevant config file):
   ```js
   export const TRAITS = {
     // ... existing
     "risk_averse": {
       name: "Risk Averse",
       effect: { routeBias: -0.3, maintenanceMultiplier: 0.9 }
     }
   };
   ```
2. In `js/systems/captains/ai.js` (after split), extend the decision function:
   ```js
   /**
    * Applies trait modifiers to route scoring.
    * @param {Captain} captain
    * @param {RouteScore} score
    * @returns {RouteScore}
    */
   function applyTraits(captain, score) { … }
   ```
3. Update chargen validation in `js/systems/captains/core.js` if the trait needs validation rules.
4. Add a test in `tests/captains.test.js`.
5. Done — trait is immediately available in new games and existing saves (no migration needed).

## How to Extend Gate Physics
1. Open `js/core/universe/physics.js`.
2. Add new parameter/constant in `js/config/constants.js` (e.g. `NEW_SHEAR_MODIFIER`).
3. Extend `effectiveSpan()` or add a new exported function:
   ```js
   /**
    * @param {string} from
    * @param {string} to
    * @param {number} shearFactor
    * @param {number} newModifier - your new factor
    */
   export function effectiveSpan(...) { … }
   ```
4. Update callsites in `tradeRoutes/economics.js` and `captains/ai.js`.
5. Add unit test in `tests/universe.test.js`.
6. Update `docs/ARCHITECTURE.md` with the new rule under “Gate Physics”.

## Folder-by-Folder Responsibilities
(Links to each split module above)

## Contributing Workflow
- Always run `npm test && npm run lint` before PR.
- New features must include tests + JSDoc on public APIs.

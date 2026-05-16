# Dynamic Dialogue, Memory, and Deferred Follow-Up Architecture

This document defines a staged architecture for semi-dynamic NPC dialogue in Star-Trading.

The goal is not unconstrained AI conversation. The goal is to make NPCs feel socially persistent because they remember meaningful interactions, speak consistently, react to game state, follow up on promises, and route durable effects through the systems that already own them.

## Core principle

> Dialogue proposes intentions. Authoritative systems validate and commit effects.

Dialogue must not directly mutate inventory, relationships, missions, messages, or world state. Dialogue emits structured proposals. The owning subsystem validates and commits or rejects them.

## Scope and intent

This architecture extends the current prototype. It does not replace the repo's existing command layer, world tick flow, persistence model, or UI surfaces.

The first implementation should prove one bounded loop:

> The player asks a used-parts dealer for a missing component. The dealer agrees to look. Time passes. A world-tick-driven follow-up resolves. The player later receives a message or returns and gets context-aware dialogue.

Everything in this document should be read through that constraint.

## Design goals

The architecture should support:

- semi-dynamic dialogue with personality and tone variation
- conversations grounded in relationship, memory, and local world state
- deferred follow-up from dialogue promises
- traceable causal chains for debugging and balancing
- reuse of existing simulation, persistence, and UI systems
- a narrow vertical slice before broader generalization

## Non-goals for the first slice

The first slice should not require:

- generalized multi-agent arbitration
- faction blackboards
- item-history dialogue queries
- lifecycle cascade handling
- a player-facing memory journal
- a second simulation scheduler
- a full event-sourced rewrite

Those may become useful later. They are not prerequisites for proving the loop.

## State and event policy

### Canonical state in early phases

In early phases, canonical state remains in ordinary domain state and save data.

That includes:

- inventory and transfers
- mission or contract state
- relationship and entanglement state
- NPC memory records
- active deferred dialogue tasks
- player messages and notifications
- timestamps needed for missed-time resolution

The first slice should reserve explicit top-level fields on `createInitialState()` and in `SAVE_STATE_FIELDS` so implementation starts from the repo's canonical state and persistence surfaces:

```js
dialogueMemories: [],
dialogueTasks: [],
dialogueMessages: [],
dialogueEventLog: [],
nextDialogueMemoryId: 1,
nextDialogueTaskId: 1,
nextDialogueMessageId: 1,
nextDialogueEventId: 1
```

`dialogueMemories`, `dialogueTasks`, and `dialogueMessages` are the canonical first-slice stores for person-facing memory, deferred work, and inbox-like NPC follow-up. `dialogueEventLog` is the causal/debug record and must not replace those canonical stores.

### Event log in early phases

A structured dialogue event log should exist from the beginning, but it is supportive, not foundational.

Use it for:

- debugging causal chains
- narrow replay in tests
- telemetry and balancing
- player-facing summaries where useful
- future migration support if stricter replay becomes worthwhile

Do not require the first implementation to rebuild all dialogue, memory, task, and inventory state by replaying this log from zero.

### When stricter replay becomes worth considering

A stricter event-sourced model is worth evaluating only if one or more of these become true:

- missed-time simulation becomes too opaque to debug
- deterministic replay becomes necessary for authored content correctness
- multiple systems depend on fine-grained causal reconstruction
- save migration becomes easier through effect streams than direct state migration

Until then, the event log remains an operational record, not the sole source of truth.

## Authority boundaries

| System | Owns | Must not do |
| --- | --- | --- |
| Dialogue coordination | intent interpretation, context gathering, candidate selection, template realization, proposal emission | mutate inventory, memory, relationships, tasks, or messages directly |
| Memory | structured NPC memory records, reinforcement, salience, contradiction handling | schedule world work, render final text, mutate inventory |
| Relationship | relationship axes and validated deltas | generate dialogue text or silently create memories |
| Inventory | item ownership, transfer, pricing validation, trade resolution | create promises or write memories directly |
| Deferred dialogue tasks | ongoing follow-up work such as locate-item promises | mutate inventory without validation or render UI directly |
| Messaging | in-world messages, inbox items, delivery timing | commit inventory, memory, or task effects |
| World tick integration | scheduled advancement and missed-time resolution hooks | own dialogue text generation |
| Structured event log | proposal, validation, and effect records for debugging | become hidden authority for other domains |
| UI read models | player-facing summaries and inspectors | become canonical state |

## Repo placement

The dialogue feature should plug into the repo's existing boundaries.

### `js/core/`

Use `core` for shared plumbing, persistence boundaries, and tick integration.

- `js/core/commands.js`
  - register player-facing dialogue actions such as `askNpcToFindPart`, `checkBackWithNpc`, or `acceptFoundPartOffer`
  - keep this as dispatch only
- `js/core/time.js`
  - scheduling helpers used by deferred dialogue tasks
- `js/core/worldTick.js`
  - hourly or daily advancement hooks for deferred dialogue tasks
  - missed-time catch-up when the player returns to the relevant scope
- `js/core/persistence.js`
  - normalization and migration for new dialogue memory, task, and message fields
- `js/core/worldEvents.js`
  - short player-visible summaries of major dialogue outcomes
  - not canonical dialogue storage

### `js/systems/`

Feature logic belongs in `systems`, not `core`.

#### Preferred new subtree behind `js/systems/people.js`

Keep `js/systems/people.js` as the barrel and public API for person-facing systems. Add a `js/systems/people/` subtree behind it for the feature internals, then re-export stable entry points from the existing `people.js` module as needed. This aligns dialogue with the existing generated people, role, relationship/trust, and service-tag model rather than creating a parallel top-level social architecture.

Suggested modules:

- `js/systems/people/dialogue.js`
  - gather context, choose candidate response, emit structured proposals
- `js/systems/people/memory.js`
  - create, reinforce, and query semantic NPC memories
- `js/systems/people/dialogueTasks.js`
  - create and resolve deferred follow-up tasks
- `js/systems/people/messages.js`
  - construct and deliver NPC follow-up messages
- `js/systems/people/readModels.js`
  - derive small player-facing summaries of active promises and outcomes

Avoid a separate `js/systems/dialogue/` subtree for the first slice unless the people system later stops being the public boundary. The important constraint is separation from `core` while keeping person-facing APIs discoverable through `js/systems/people.js`.

#### Existing systems to extend

Prefer extension over replacement.

- `js/systems/captains/`
  - captain availability, location, competence, and adjacency
- `js/systems/entanglements/`
  - persistent social consequences when the existing model is the best fit
- `js/systems/missions/`
  - optional lightweight tracking surface for promises or favors
- market, economy, and related trade systems
  - scarcity, price pressure, condition, and local availability context

### `js/ui/`

Early UX should reuse existing screens.

- `js/ui/renderCaptains.js`
  - first home for starting the interaction and checking back
- `js/ui/renderComms.js`
  - first home for NPC follow-up messages
- `js/ui/renderMissions.js`
  - optional lightweight tracking surface if a promise is represented as a favor or request
- `js/ui/renderReputation.js` or captain-facing UI
  - relationship and trust changes
- `js/ui/renderHUD.js`
  - short notifications or attention-feed summaries

Add one UI invalidation slice for the first implementation:

```js
DIALOGUE: "dialogue"
```

Dialogue actions should return `stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN)` when they alter dialogue memory, tasks, messages, or the currently visible interaction surface. If an action also changes existing domains, include their established slices too, such as `WORLD_EVENTS` for timeline summaries, `MISSIONS` for tracked favors, or `CAPTAINS` when captain-facing relationship state changes.

### `docs/`

- keep this document as the design boundary
- add a separate implementation note later for concrete schemas, migrations, and UI changes once the first slice is being built

### `tests/`

Add deterministic tests before expanding content breadth.

Minimum useful coverage:

- a request creates one deferred dialogue task
- missed-time simulation resolves the task correctly
- success creates a message and makes the item tradable
- failure creates a follow-up without granting inventory
- duplicate requests do not create duplicate active tasks
- save and load preserve new dialogue state fields

## Vertical slice

The first slice should include only:

- one location
- one NPC
- one requested item
- one memory type
- one task type
- one follow-up message pattern
- one trade handoff
- one relationship adjustment
- one structured operational log for the loop

The first slice should be playable, debuggable, and easy to test.

## Data flow

```text
Player dialogue action
→ dialogue coordination gathers context
→ candidate response selected
→ structured proposals emitted
→ domain systems validate and commit or reject
→ structured event record written
→ existing UI surfaces show result
→ world tick resolves deferred follow-up work later
```

The first slice does not need a generalized Proposal Broker. Ordered validation inside the dialogue flow is sufficient.

## Dialogue pipeline

Dialogue should operate on semantic intent rather than direct string substitution.

```text
Intent
→ semantic frame
→ context selection
→ template selection
→ fragment selection
→ vocabulary resolution
→ personality realization
→ required-slot validation
→ final surface text
→ structured proposals
```

Example semantic frame:

```yaml
frame:
  actor: player
  action: request_help
  object: fujiwattit
  urgency: medium
  tone: polite
```

Example realizations:

- Friendly: "No fujiwattits today, Captain, but I know a few scrapyards. I'll ask around."
- Curt: "No stock. I'll check."
- Formal: "I do not presently have a compatible fujiwattit, though I can make several inquiries on your behalf."

## Minimal proposal contracts

The first implementation only needs a small proposal set.

```yaml
proposed_outcomes:
  - proposal_id: proposal_001
    type: remember_customer_request
    authority: memory
    payload:
      owner: used_parts_salesman
      subject: player
      memory_type: customer_request
      data:
        item_requested: fujiwattit

  - proposal_id: proposal_002
    type: create_dialogue_task
    authority: dialogue_task
    payload:
      owner: used_parts_salesman
      requester: player
      task_type: locate_item
      item: fujiwattit
      interval_hours: 6

  - proposal_id: proposal_003
    type: adjust_relationship
    authority: relationship
    payload:
      owner: used_parts_salesman
      target: player
      trust_delta: 1
```

A later purchase remains an inventory-owned action.

## Minimal structured event record

The first slice should log outcomes in a pragmatic format.

```yaml
event:
  event_id: evt_9001
  event_type: dialogue_task_created
  day: 1432
  minute: 240
  actor: used_parts_salesman
  subject: player
  source_system: dialogue_task
  caused_by:
    interaction_id: dialogue_7844
    proposal_id: proposal_002
  summary:
    item: fujiwattit
    status: active
```

This record should answer questions such as:

- why does this NPC remember the request
- why is there an active follow-up
- why did the player receive a message
- why did the item become available for trade

## Memory model

Memories are structured semantic records, not transcript dumps.

```yaml
memory:
  memory_id: memory_2201
  owner: used_parts_salesman
  subject: player
  type: customer_request
  created_at_day: 1432
  last_reinforced_at_day: 1432
  salience: high
  data:
    requested_item: fujiwattit
    interaction_sentiment: pleasant
```

For the first slice:

- keep memory types narrow
- use simple salience levels
- postpone generalized decay and compression
- do not add faction-level propagation yet

## Relationship model

Relationship consequences should reuse current captain and entanglement concepts where practical instead of introducing a separate social architecture immediately.

A minimal first-slice delta is enough:

```yaml
relationship_delta:
  owner: used_parts_salesman
  target: player
  trust_delta: 1
  familiarity_tag: returning_customer
```

## Deferred dialogue task model

Deferred dialogue tasks represent follow-up work resolved by the world tick.

```yaml
dialogue_task:
  task_id: task_5580
  owner: used_parts_salesman
  requester: player
  task_type: locate_item
  item: fujiwattit
  status: active
  created_at_day: 1432
  next_check_at_hour: 6
  interval_hours: 6
  resolution_model: simple_probability
```

The first slice only needs:

- one owner
- one requester
- one target item
- one next-check timestamp
- one success or failure path
- one resulting message

Later expansion can add supplier flavor, scarcity pressure, damaged outcomes, premium pricing, and sub-contracting.

## World tick integration

Deferred dialogue work should piggyback on the existing tick orchestration.

Recommended approach:

- register dialogue-task advancement in the existing hourly tick first
- optionally perform missed-time catch-up when the player enters the relevant region or opens the relevant screen
- keep resolution deterministic enough for tests

Do not introduce a second scheduler for dialogue.

## Existing UI reuse first

The first implementation should appear through screens the game already has.

### First-pass player experience

- Start the request from a captain or NPC interaction surface.
- Show immediate confirmation through the existing notification or attention flow.
- Deliver follow-up through Communications.
- Optionally show the active promise in Missions as a lightweight tracked favor or request.
- Surface trust or relationship movement through existing captain or reputation UI.

### Do not build first

Do not start with:

- a dedicated dialogue journal
- a dedicated player memory inspector
- a separate social feed
- a Captain's Mirror screen
- a standalone blackboard UI

Those only become worth building if the loop proves durable value.

## Messaging examples

Early follow-up should use both canonical dialogue messages and existing world-event summaries:

- `dialogueMessages` is the canonical inbox-like state for NPC follow-up rendered through Communications. It owns delivery/read status, sender/recipient references, task linkage, and message text needed by the follow-up loop.
- `worldEvents` may receive a concise `type: "dialogue_message"` or related summary record for timeline visibility, notification support, and causal/debug history. It is not the source of truth for the Communications inbox.
- Communications should render NPC follow-up from `dialogueMessages`, optionally alongside existing data-cargo and intel panels, while notifications and reputation/debug timelines can point at the paired `worldEvents` summary.

Example messages:

- "I found a used fujiwattit. Dock 17. Not cheap."
- "No luck yet. Supply's worse than I thought."
- "Someone else bought the part before I could hold it."

These should appear first in Communications or existing notification surfaces rather than a new dialogue-specific inbox.

## Debugging requirements

Build narrow tooling from the beginning.

At minimum, be able to inspect:

- current NPC memory records for the loop
- active deferred dialogue tasks
- recent structured dialogue events
- the latest message emitted by the loop
- relationship changes caused by the loop

A larger inspector suite can wait until the first slice proves valuable.

## Save and load

Persist:

- active dialogue tasks
- NPC memory records added by this feature
- relationship deltas that became canonical state
- player messages produced by the loop
- minimal structured dialogue event records
- timestamps required for missed-time resolution

On load:

- restore canonical state directly from save data
- restore event records for debugging and summaries
- resume task checks from stored timestamps
- do not require full event replay to rebuild the feature

## Recommended implementation order

1. **Vertical slice core**
   - one NPC request flow
   - one memory type
   - one deferred locate-item task
   - one follow-up message
   - one trade handoff
   - one relationship delta
2. **Persistence and tick wiring**
   - save fields
   - load normalization
   - hourly or missed-time resolution
3. **Operational logging and debugging**
   - structured event records
   - narrow inspection for memory, tasks, messages, and relationship effects
4. **Dialogue variation**
   - tagged fragments
   - tone variants
   - fallback lines
5. **Economy and availability depth**
   - scarcity, condition, pricing pressure, supplier flavor
6. **Broader social depth**
   - richer memory rules
   - more relationship hooks
   - additional NPC types
7. **Only after the loop proves value**
   - faction blackboards
   - item histories
   - lifecycle cascades
   - narrative coherence gating
   - player-facing mirror read models
   - generalized proposal arbitration

## Design philosophy

This architecture prioritizes:

- separation of responsibilities
- compatibility with the current repo structure
- persistent but bounded simulation
- traceable causality without premature event-sourcing commitment
- context-aware dialogue grounded in actual game state
- reuse of existing UI and systems before new infrastructure is added
- a small vertical slice that proves player value before architectural expansion

## Consolidated dialogue update path implemented

The final local-contact dialogue update path is:

```text
player action
→ conversation part
→ proposal row
→ authority validation
→ memory/task/offer/message row
→ event log row
→ conversation header update
→ UI read model
→ world tick resolution/expiry/maintenance
```

Conversation parts remain a transcript of what was said or proposed. Proposal rows track the lifecycle of intent. Memory, task, offer, and message rows are the authoritative domain state. Event rows explain what happened. Conversation headers are rebuildable query indexes/read models that link related rows.

Runtime dialogue writes now use cheap storage guards and normalise inserted rows only. Full-table repair and conversation-header rebuilds are reserved for load/import or explicit repair flows.

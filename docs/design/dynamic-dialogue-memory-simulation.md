# Dynamic Dialogue, Memory, Task, and World Simulation Architecture

This document describes a staged architecture for semi-dynamic NPC dialogue in a simulation-driven Star-Trading world. The goal is not unconstrained AI NPCs; the goal is to make NPCs appear socially persistent because they remember meaningful interactions, speak consistently, react to local/global state, follow up on promises, and route all durable effects through authoritative systems.

## Core principle

> Dialogue proposes intentions; authoritative systems commit effects.

Dialogue must not directly mutate inventory, relationships, quests, memories, messages, or world state. Dialogue emits structured proposals or requests. The subsystem that owns the affected domain validates and commits or rejects those proposals.

## Design goals

The architecture should support:

- Semi-dynamic dialogue generation with personality and idiolect.
- Memory-aware, relationship-aware, and world-state-aware conversations.
- Deferred consequences from dialogue promises and NPC follow-up actions.
- Trade, quest, reputation, relationship, and task progression.
- Traceable causal chains for debugging and replay.
- Multi-agent task delegation and sub-contracting chains.
- Faction-level blackboard registries for institutional knowledge.
- Unique item histories that NPCs can inspect and discuss.
- Passive sensory observations that influence dialogue before player input.
- A narrow playable vertical slice before broad generalization.

## Vertical slice first

The first implementation target should be intentionally narrow:

> Player asks a used-parts dealer for a missing ship component. The dealer promises to look for it. The player leaves. Time passes. The local simulation resolves the search. The dealer either finds the part or fails. The player receives a message or returns later and gets context-aware dialogue.

The first slice should include only:

- One location.
- One NPC.
- One requested item.
- One memory type.
- One task type.
- One message template.
- One trade request.
- One inventory transfer.
- One relationship adjustment.
- One append-only event log.
- Basic Proposal Broker arbitration for the single trade, memory, and task proposals emitted.

After this loop works, expand into richer task classes, memory decay, economy, supplier networks, task delegation, faction blackboards, item histories, passive sensory scanning, procedural quests, lifecycle handling, snapshots, player mirror read models, and narrative coherence gates.

## Core systems and responsibilities

| System | Owns | Must not do |
| --- | --- | --- |
| Dialogue | Intent interpretation, semantic response, template selection, personality/idiolect realization, proposed outcomes, sensory context consumption. | Mutate inventory, memories, quests, tasks, messages, or blackboards directly. |
| Dialogue Utility Scoring | Candidate ranking, context multipliers, suppression rules, sensory/blackboard/item-history boosts. | Commit state or render final text without required slots. |
| Memory | Structured semantic facts, salience decay, reinforcement, contradiction handling, provenance. | Schedule tasks, render text, change inventory, or write faction registries directly. |
| Relationship | Multi-axis relationship state and validated relationship deltas. | Generate dialogue or infer memories without validated input. |
| Inventory | Trade validation, ownership, currency/item transfer, capacity, committed inventory events. | Decide dialogue, create promises, or write item history entries directly. |
| Item History | Append-only unique item event logs and queryable provenance. | Render dialogue, propose trades, or mutate NPC memory directly. |
| Task | Validated task registration, ongoing world processes, deferred action resolution. | Render messages or bypass inventory/memory authorities. |
| Task Delegation | Sub-task proposals, sub-contractor selection, causal parent/sub-task links. | Assign unavailable sub-contractors or mutate parent tasks directly. |
| Quest | Quest state and validated quest transitions. | Silently edit relationship or inventory state. |
| World Simulation | Regional/global simulation, registry ticking, economy/faction/environment updates, missed-time simulation. | Bypass validation authorities. |
| Resource Economy | Finite resource nodes, restocks, claims, scarcity, reservations, dynamic pressure. | Render dialogue or silently allocate quest rewards. |
| Faction Registry | Shared blackboards, memory uploads, blackboard queries, provenance, urgency propagation. | Write individual memories or evaluate trade validity. |
| Sensory Validation | Passive local scans and sensory context proposals. | Commit mutations, generate final text, or query blackboards directly. |
| Messaging | Validated in-world messages, templates, scheduled delivery, message provenance. | Commit task, inventory, or memory effects. |
| Event Log | Append-only proposal, validation, rejection, and committed-effect records. | Rewrite history. |
| Validation / Authority | Domain-specific validation and committed effects. | Accept unbrokered conflicting proposal batches. |
| Proposal Broker | Batch deduplication, ordering, lightweight conflict resolution, arbitration logs. | Domain-specific validation, state mutation, dialogue generation, or task creation. |
| NPC Lifecycle | Cascading consistency when NPCs are removed, deceased, or leave factions. | Decide whether an NPC should be removed or render dialogue. |

## Data flow

```text
Sensory scan on local-scope entry
→ Sensory context injections
→ Player input or NPC passive intention
→ Dialogue interpretation
→ Semantic intent
→ NPC semantic response
→ Dialogue utility scoring with sensory, blackboard, and item-history context
→ Dialogue realization
→ Proposed outcomes
→ Narrative Coherence Gate when authored arcs are active
→ Proposal Broker arbitration
→ Domain authority validation
→ Committed effects or rejections
→ Append-only event log
→ Updated queryable read models
```

A proposed outcome is an intention, request, or claim. A committed effect is an authoritative state change that passed broker arbitration and domain validation.

## Dialogue pipeline

Dialogue should reason from semantic meaning rather than raw string substitution:

```text
Intent
→ Semantic frame
→ Context selection
→ Template selection
→ Fragment selection
→ Vocabulary resolution
→ Personality realization
→ Syntax realization
→ Required-slot validation
→ Narrative Coherence Gate
→ Final surface text
→ Proposed outcomes
```

A semantic frame for the vertical slice could be:

```yaml
frame:
  actor: player
  action: request_help
  object: fujiwattit
  urgency: medium
  emotional_tone: polite
```

Example realizations:

- Friendly: "No fujiwattits today, Captain, but I know a few scrapyards. I'll ask around."
- Curt: "No stock. I'll check."
- Formal: "Unfortunately, I do not presently possess a compatible fujiwattit, though I can make several inquiries on your behalf."

## Proposal and event contracts

Every proposed outcome should include source provenance, authority, causality, and payload. For example:

```yaml
proposed_outcomes:
  - proposal_id: proposal_001
    type: propose_memory
    authority: memory
    source:
      system: dialogue
      interaction_id: dialogue_7844
      speaker: used_parts_salesman
      target: player
    payload:
      owner: used_parts_salesman
      subject: player
      memory_type: customer_request
      salience: high
      data:
        item_requested: fujiwattit
        ship_problem: damaged_drive_system
        interaction_sentiment: pleasant

  - proposal_id: proposal_002
    type: propose_task
    authority: task
    source:
      system: dialogue
      interaction_id: dialogue_7844
      speaker: used_parts_salesman
      target: player
    payload:
      requested_task_id: find_fujiwattit_for_player
      scope: local
      registry: starbase_kestrel
      owner: used_parts_salesman
      requester: player
      task_type: locate_item
      item: fujiwattit
      interval_hours: 6
      initial_model: supplier_network_search
```

Every committed or rejected proposal is logged as a first-class event:

```yaml
event:
  event_id: event_9001
  event_type: task_created
  occurred_at: 1432.20
  source_system: task
  authority: task
  actor: used_parts_salesman
  subject: player
  location: starbase_kestrel
  causality:
    caused_by_event_id: event_8999
    caused_by_proposal_id: proposal_002
    interaction_id: dialogue_7844
    simulation_tick_id: null
  payload:
    task_id: task_5580
    task_type: locate_item
    item: fujiwattit
  validation:
    status: accepted
    validator: task_authority
    rule_set: task_creation_v1
```

Rejected proposals are not silent failures; they should be visible in debugging tools and can drive fallback dialogue.

## Append-only event log

The event log is the source of truth for causality, debugging, replay, save/load integrity, telemetry, and balancing. Read models can be persisted for performance, but must be rebuildable from events. A typical chain is:

```text
dialogue_started
→ dialogue_choice_selected
→ npc_response_generated
→ memory_proposed
→ memory_committed
→ task_proposed
→ task_created
→ region_simulation_started
→ task_check_resolved
→ task_succeeded
→ inventory_addition_proposed
→ inventory_addition_committed
→ item_history_entry_proposed
→ item_history_entry_committed
→ message_proposed
→ message_sent
→ later_dialogue_context_selected
```

If a player later asks why a dealer had a fujiwattit, tooling should be able to trace the answer from dialogue interaction to task proposal, broker decision, task creation, simulation tick, task success, inventory mutation, and message delivery.

## Proposal Broker

The Proposal Broker is a thin, stateless layer between emitters and domain authorities. It collects all proposals emitted in a dialogue turn or simulation tick, applies lightweight declarative rules, and emits a deduplicated ordered stream to authorities.

Broker responsibilities:

- Deduplicate identical proposals emitted by multiple systems in the same batch.
- Serialize conflicting mutations on the same item or entity **within the current batch only**. The broker is stateless across batches: inter-batch or accumulated-state conflicts are the responsibility of the receiving Domain Authority, which holds the authoritative record and rejects or merges proposals accordingly.
- Prioritize high-urgency proposals such as crime-alert blackboard uploads.
- Log incoming proposals, rules applied, final stream order, and rationale.

Broker non-responsibilities:

- Domain-specific validation.
- State mutation.
- Dialogue generation.
- Task creation.

Example conflict rule:

```yaml
conflict_rule:
  id: trade_vs_simultaneous_inventory_removal
  condition:
    - same_item_id
    - propose_trade present
    - propose_inventory_mutation removal present
  resolution: serialize inventory_removal first if hard removal; otherwise queue trade after
  broker_log_note: Trade held until removal validated or rejected
```

## Validation authority examples

Task creation checks should include existing owner, owner capability, existing registry, valid scope, duplicate active tasks, valid requested item, plausible NPC capability, and task support in the location.

Trade validation checks should include buyer funds, seller ownership, transferability, current price validity, seller willingness, and faction/legal rules.

Memory validation checks should include valid owner, valid subject, valid memory type, duplicate detection, contradiction handling, and whether an existing memory should be updated instead of creating a new record.

Faction blackboard validation checks should include faction membership, minimum salience, institutional-sharing eligibility, information policy, duplicate entries, clearance, expiry, and provenance.

Item history validation checks should include item existence, uniqueness, valid event type, and traceable causality to a committed inventory event.

## Memory model

Memories are structured semantic records, not raw transcript logs.

```yaml
memory:
  memory_id: memory_2201
  owner: used_parts_salesman
  subject: player
  type: customer_request
  created_at: 1432.20
  last_reinforced_at: 1432.20
  salience: high
  confidence: high
  is_protected: true
  provenance:
    created_by_event_id: event_1004
    source_interaction_id: dialogue_7844
  decay:
    decay_model: social_business_memory
    half_life_hours: 240
    minimum_salience: low
  data:
    requested_item: fujiwattit
    player_ship_issue: damaged_drive_system
    interaction_sentiment: pleasant
```

Salience should decay over time based on recency, reinforcement, emotional intensity, relationship relevance, quest relevance, business relevance, and story-critical protection. Important contradiction strategies include superseding older memories, lowering confidence, storing timestamped beliefs, marking older memories as resolved, and creating correction memories.

Memory queries should be constrained by explicit filters such as owner, subject, location, dialogue topic, interaction type, minimum salience, excluded statuses, included types, limit, and relevance/salience/recency sorting.

Low-salience old memories can later be compressed into broader summaries, such as turning a specific fujiwattit transaction into "player is a ship-parts customer." Compression must preserve provenance summaries and exclude critical facts such as witnessed crimes, unresolved debts, active quest promises, and unresolved sub-contracted fulfillment.

## Relationships, personality, idiolect, and mood

Relationships should be multi-axis rather than a single friendship score:

```yaml
relationship:
  owner: used_parts_salesman
  target: player
  trust: 3
  respect: 1
  affection: 0
  irritation: -1
  fear: 0
  obligation: 1
  familiarity: returning_customer
  provenance:
    last_changed_by_event_id: event_1301
```

NPC speech profiles should separate relatively stable personality/idiolect from transient mood. Personality controls baseline cheerfulness, helpfulness, curtness, formality, technicality, syntax, preferred terms, address terms, and catchphrases. Mood applies temporary modifiers such as stress, satisfaction, alertness, fear, anger, and fatigue.

A normally friendly merchant under stress may say "Captain. Found the fujiwattit. Dock 17. Not cheap." instead of a warmer, longer line. Mood should not permanently rewrite personality; it should decay or update as circumstances change.

## Tagged template fragments

Early versions should avoid unconstrained generation. Dialogue can be assembled from tagged fragments with controlled variation:

```yaml
template:
  id: found_requested_item
  semantic_intent: report_success
  required_context:
    - requested_item
    - item_condition
  fragments:
    greeting:
      tag: greeting.returning_customer
    success_statement:
      tag: task.locate_item.success
    item_comment:
      tag: item.condition.used_color
    closing:
      tag: merchant.trade_prompt
```

This allows outputs such as:

- Friendly: "Captain! I found you an ugly little fujiwattit. Looks half fried, but it'll spin."
- Curt: "Found one. Used. Expensive."
- Formal: "I have located a replacement fujiwattit in used but operational condition."

## Task registries and local simulation

Tasks represent ongoing world processes owned by registries rather than individual NPC update loops.

- Player Registry: always active; tracks player ship systems, timed quests, crew actions, deliveries, messages, and active contracts.
- Global Registry: always active; tracks wars, faction activity, economy shifts, major NPC travel, world events, and story-critical timers.
- Local Registry: region-scoped; tracks shop restocks, local rumors, merchant searches, repair work, local errands, sub-contracts, and missed-time simulation.

When the player returns to a region, the local registry simulates missed time from `last_simulated_time` to current time. A task with a six-hour interval that was abandoned at 100.0 and revisited at 124.0 resolves checks at 106.0, 112.0, 118.0, and 124.0.

## Locate-item task model

The vertical slice can start with simple probability, but the schema should support richer simulation:

```yaml
task:
  task_id: task_5580
  requested_task_id: find_fujiwattit_for_player
  scope: local
  registry: starbase_kestrel
  owner: used_parts_salesman
  requester: player
  task_type: locate_item
  status: active
  created_at: 1432.20
  next_check_at: 1438.20  # created_at + interval_hours (6); first check is a full interval after creation
  interval_hours: 6
  target:
    item: fujiwattit
    acceptable_conditions:
      - used
      - refurbished
      - new
  progress:
    suppliers_checked: []
    calls_made: 0
    leads_found: 0
  resolution_model:
    type: supplier_network_search
    fallback_type: simple_probability
```

Long-term factors should include supplier networks, item rarity, local supply, faction access, merchant competence, player relationship, trade disruption, distance to supply hubs, regional law, black-market access, and current world events.

## Task delegation and sub-contracting

A failed locate-item check does not need to become a binary failure. The Task Delegation System can propose sub-tasks assigned to secondary agents.

Example chain:

```text
locate_item check fails
→ delegation trigger fires
→ propose_sub_task hire_scavenger
→ sub-task authority validates available scavenger and resources
→ sub-task succeeds or fails
→ success proposes inventory transfer to the primary owner
→ parent task updates to succeeded_via_sub_contract
→ dialogue re-entry references the sub-contractor and cost premium
```

Successful sub-contracting can produce dialogue such as: "My guy out in the wastes found one, Captain, but he's charging a premium for the trek. It's not pretty — damaged — but it'll do the job if you've got someone who can coax it."

A sub-contracting failure can produce: "I sent a scavenger out to the junkfields. Nothing. The whole sector's been picked over."

## Resource competition

Supplier searches become more meaningful when resources are finite. Resource nodes can expose stock, restock models, reservation policy, dynamic prices, and competing task claims.

```yaml
resource_node:
  node_id: dock_17_scrapyard
  region: starbase_kestrel
  resource_type: salvage_parts
  stock:
    fujiwattit:
      quantity: 1
      condition: used
      base_price: 80
      rarity: uncommon
  restock_model:
    type: irregular_salvage_arrivals
    average_interval_hours: 72
```

If a rival task resolves first, it can claim the only fujiwattit, causing Verren to report that someone else bought the part before he could hold it. Reservation policies should include none, soft hold, deposit hold, faction priority, and quest locked.

## Trade and item-history flow

Dialogue can propose a trade, but inventory resolves it.

```yaml
choice:
  text: I'll buy it.
  proposed_outcomes:
    - type: propose_trade
      authority: inventory
      payload:
        buyer: player
        seller: used_parts_salesman
        offered:
          currency: credits
          amount: 80
        requested:
          item: fujiwattit
          quantity: 1
```

Successful trade commits currency removal/addition, item transfer, and a transaction record. A committed `item_transferred` event triggers a `propose_item_history_entry` for unique items.

Unique items carry append-only histories:

```yaml
item_history:
  item_id: item_unique_7702
  entries:
    - event_type: manufactured
      actor: Halcyon_Drive_Works
      location: orbital_factory_7
    - event_type: installed_on_ship
      actor: ISV_Cerulean_Drift
      location: drydock_8
    - event_type: ship_lost_in_transit
      location: kestrel_nebula
    - event_type: salvaged
      actor: waste_picker_tonez
      location: junkfields_sector_12
    - event_type: sold_to
      actor: player
      location: starbase_kestrel
```

NPCs can query item histories during trade or inspection. If a serial number is flagged as belonging to a missing ship, a merchant might ask where the player got it. Dialogue reads structured history; it does not invent provenance.

## Faction blackboard registries

Individual memory propagation through gossip is slow. Organized factions should also share institutional knowledge through faction blackboards.

When an NPC witnesses a significant event, they emit a `propose_memory_upload` to the appropriate faction registry. The NPC retains their personal memory; the blackboard stores the faction's shared belief state with witness provenance, urgency, status, expiry, and clearance.

Guards, merchants, or agents query blackboards during dialogue utility scoring. A high-urgency `crime_alert` can override a routine greeting and produce a confrontation. Clearance levels should include all faction members, officers only, leadership only, and sealed informant entries.

Blackboard entries decay or expire. Expired entries stop influencing faction-level dialogue, though individual NPC memories may persist at lower salience.

## Sensory-driven passive intentions

When the player enters a Local Registry scope, the Sensory Validation System runs a passive scan. Scans also trigger at the start of each dialogue interaction and run periodically (each simulation tick while the player remains in scope), so NPCs react to mid-session changes such as equipping a new weapon, switching faction badges, or sustaining ship damage. The scan does not commit state. It produces sensory context injections for the next dialogue utility pass.

Example observable facts:

- Visible player equipment and item condition.
- Visible weapon state.
- Player ship damage if the NPC has docking or sensor access.
- Known-customer status.
- Visible faction badge or public reputation.

A high-salience sensory fact can override a greeting fragment. A helpful used-parts dealer who can detect a damaged drive might say, "Captain, I can smell that fried fujiwattit from across the dock. Want me to look for a spare?"

NPC capabilities must limit the scan. A dockmaster may inspect cargo manifests; an ordinary merchant should not infer hidden cargo or finances.

## Dialogue utility and prioritization

NPCs may have many valid things to say. Dialogue selection should gather candidates, score them, apply context multipliers, apply suppression rules, then select the highest-priority candidate or bundle.

High-salience facts should suppress absurd small talk. An "elephant in the room" rule can apply an interrupt weight and suppress generic greetings after recent theft, violence, betrayal, critical task completion, or urgent faction blackboard entries.

## Narrative Coherence Gate

Emergent systems must not break active authored quests. The Narrative Coherence Gate runs after utility scoring and before proposals are emitted. It can suppress a candidate, force a safe fallback template, or emit a story-critical override proposal that the Quest System must honor.

Example:

```yaml
narrative_gate_rule:
  id: reactor_sabotage_protection
  condition:
    active_quest_arc: main_reactor_sabotage
    proposed_mutation: trade fujiwattit from non-quest NPC
  action: suppress_candidate
  fallback: generic_trade_refusal
```

The gate is optional and active only when authored content requires protection. Every intervention must be logged with provenance.

## NPC lifecycle handling

When an NPC is removed, dies, changes status, or leaves a faction, the Lifecycle System emits cascading validated proposals:

- Active owned tasks auto-delegate or escalate to parents.
- High-salience memories can be promoted to faction blackboards with deceased-witness provenance.
- Item histories referencing the NPC can receive terminal entries.
- Blackboard entries uploaded by the NPC remain but mark source availability.
- Active sub-contracts notify parent task owners of unavailability.
- Read models and registries remove dangling references.
- NPCs who referenced the removed entity get fallback rumor/disappearance dialogue candidates.

The lifecycle system does not decide whether removal should happen; it preserves coherence after the World Simulation or Quest System makes that decision.

## Captain's Mirror read model

The player should have a lightweight, derived mirror of relevant committed facts. The Captain's Mirror is never authoritative and is rebuilt from committed events where the player is subject or requester.

The mirror can expose:

- What major NPCs remember about the player, sanitized and salience-filtered.
- Outstanding promises, tasks, and sub-contracts.
- Reputation and relationship deltas caused by the player.
- Unique item histories and flags for items the player handled.
- Public or cleared blackboard entries mentioning the player.

This creates player-facing symmetry: if Verren remembers a fujiwattit promise, the player can also inspect that promise through a Captain's Log or Insights panel.

## Snapshots and differential replay

Long absences should not require replaying the entire event log for every return. Each Local and Global registry can periodically write compact read-model snapshots containing active tasks, resource stock, blackboard entry counts, aggregate memory salience statistics, and lifecycle state.

On player return or load:

1. Load the latest registry snapshot.
2. Replay only differential events after the snapshot timestamp.
3. Re-derive read models from that differential.

Snapshots are performance aids only. The append-only event log remains the source of truth for debugging and replay.

## Debugging and tooling requirements

Build debugging tools from the beginning:

- Event Chain Viewer: shows proposal-to-effect causal chains.
- NPC State Inspector: memories, relationship axes, tasks, sub-tasks, inventory, factions, recent blackboard query, sensory injections, candidate dialogue, lifecycle status.
- Task Registry Inspector: active tasks, sub-tasks, parent links, next checks, validations, proposals, delegation, snapshots, differential replay.
- Dialogue Context Inspector: selected template, scoring rationale, personality variant, fragments, sensory context, blackboard results, item-history flags, narrative gate status, broker decisions.
- Rejection Log: all rejected proposals with validation reasons.
- Causal Tree Viewer: answers "why did this happen?" rather than only "what happened?"
- Blackboard Inspector: entries by faction, urgency, provenance, queries, expiry, clearance, lifecycle tags.
- Item History Viewer: item event log, faction flags, query history.
- Proposal Broker Decision Log: incoming batch, rules applied, ordered stream, provenance.
- NPC Lifecycle Event Viewer: removal/status events and cascading proposals.
- Captain's Mirror Inspector: visible mirror entries, derivation, and regression checks against actual NPC memory.

## Save/load model

Persist:

- Append-only event log.
- Current read models.
- Task registries with sub-task chains and parent links.
- Memory records.
- Relationship states.
- Inventory state.
- Item history logs per unique item.
- Faction blackboard registries with expiry metadata.
- Quest state.
- Message inbox/outbox.
- Region last-simulated timestamps.
- Periodic registry snapshots.
- Captain's Mirror read model.

On load, restore the event log, load latest snapshots, replay differential events, rebuild the Captain's Mirror, validate lifecycle states, and emit any necessary consistency proposals without silently re-simulating history.

## Recommended implementation order

1. **Vertical Slice:** one NPC, item request, task type, memory type, local registry, message type, trade flow, event log, basic Proposal Broker, event chain/rejection debug views.
2. **Validation Hardening:** proposal validation, rejection events, duplicate prevention, memory duplicate checks, trade failures, provenance inspection, broker conflict logs.
3. **Memory Depth:** salience decay, reinforcement, contradiction handling, query rules, resolved/superseded states.
4. **Dialogue Variation:** tagged fragments, idiolect libraries, relationship variants, scene-aware fragments, fallback templates.
5. **Richer Task Simulation:** supplier networks, rarity, economy modifiers, faction access, disruption events, delayed/partial/expensive/damaged/unavailable outcomes.
6. **Task Delegation:** delegation triggers, sub-task validation, sub-contractor assignment, parent updates, causal-chain debugging, re-entry dialogue context.
7. **Faction Blackboards:** faction memberships, memory uploads, blackboard schema, queries in utility scoring, urgency multipliers, expiry, inspector.
8. **Item History:** unique item registry, item histories, history proposals after inventory events, dialogue queries, faction item flags, viewer, flagged-origin templates.
9. **Sensory Passive Intentions:** passive scans, NPC capability model, sensory context injections, greeting override rules, sensory-to-task proposals, inspector integration.
10. **Quest and World Expansion:** quest transitions, multi-NPC chains, reputation, global events, regional cascades, cross-faction exchange, lifecycle system, snapshots, Captain's Mirror, Narrative Coherence Gate, expanded debug tools.

## Design philosophy

This architecture prioritizes separation of responsibilities, persistent simulation, traceable causality, context-aware dialogue, structured world state, NPC continuity, validated domain authority, controlled language variation, partially emergent interactions, multi-agent causal chains, institutional memory, object-level provenance, sensory-grounded proactive behavior, lightweight proposal arbitration, graceful lifecycle handling, player-world symmetry, authored narrative protection, and efficient long-term simulation.

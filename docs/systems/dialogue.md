# Dialogue System

The dialogue system models local-contact requests, NPC follow-up, located-item offers, and the Communications console.

## Update path

```text
player action
→ conversation part
→ intent
→ semantic frame
→ context selection
→ template selection
→ fragment selection
→ vocabulary resolution
→ personality realization
→ slot validation
→ final text
→ structured proposals
→ proposal row
→ authority validation
→ memory/task/offer/message row
→ event log row
→ conversation header update
→ UI read model
→ world tick resolution/expiry/maintenance
```


## Dialogue realization

`js/systems/people/dialogueRealization.js` is the small deterministic realization layer for NPC lines. It turns semantic intents such as `request_locate_item` and `check_back_locate_item` into a frame containing the actor, owner person, subject, item, state, tone, and vocabulary slots. The current locate-item states are `fresh_request`, `active_task`, `remembered_request`, `offer_ready`, `found_already`, and `failed_previous`.

Templates live in `js/systems/people/dialogueTemplates.js`. Realization is intentionally not open-ended generation: the module selects a template bank by intent, selects one template by state, resolves simple slots such as `itemLabel` and `personName`, validates required slots, and returns a safe generic fallback line when required data is missing. Gameplay callers should not throw on missing item/person display data.

The locate-item request and check-back paths both write player utterance and semantic intent parts first, then add the realized NPC utterance to the same `locate-item:<personId>:<itemId>` conversation. Request actions may still propose memories and tasks. Check-back actions only inspect the authoritative memory/task/offer tables and add transcript parts; they do not create duplicate tasks.

## Authority boundaries

- `dialogueConversationParts`: transcript/readable record of utterances, intents, proposals, effects, and system notes.
- `dialogueProposals`: lifecycle for proposed intents (`proposed`, `accepted`, `rejected`, `committed`).
- `dialogueMemories`: authoritative remembered customer requests and their status (`active`, `resolved`, `superseded`, `expired`).
- `dialogueTasks`: authoritative deferred work such as locating an item.
- `dialogueOffers`: authoritative offers that can be accepted, rejected, or expired.
- `dialogueMessages`: authoritative NPC follow-up notifications.
- `dialogueEventLog`: append-only explanation of proposals, task resolution, offer acceptance/rejection/expiry, message reads, relationship changes, and maintenance.
- `dialogueConversations`: rebuildable headers/read models linking related rows and storing current status.

## World ticks

Hourly ticks resolve due dialogue tasks and then expire offers. Daily ticks decay old memories and run maintenance, which can archive safe resolved conversations, archive old read messages, and prune old events only when they are not needed by active conversations.

## UI

Communications combines conversation summaries, selected conversation timeline, active offers, debug trace counts, and legacy NPC follow-up messages. Sector local-contact buttons use the conversation query read model, so buttons can show `Find nav chip`, `Check status: nav chip`, `Review offer`, `Ask again`, or `Found already` without scanning raw tables in the renderer. Active in-progress requests use `checkBackWithNpc`; failed requests keep the explicit `askNpcToFindPart` ask-again action.

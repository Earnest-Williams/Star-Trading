# Dialogue System
_Last updated: 2026-05-21_

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

## Relationship conversation text

Relationship conversation copy lives in
`js/systems/people/dialogueRelationshipTextStrings.js`. These banks add authored
English strings for `start_personal_chat` and `deepen_relationship` frames such as
`casual_open`, `getting_familiar`, `personal_interest`, `flirting`,
`romantic_tension`, `affection_confessed`, `reassurance`, and `parting`.

This batch is content-only. It provides player prompt and NPC response templates
for casual, familiar, flirty, jealous, guarded, and intimate presentation. It
does not grant offers, create tasks, record memories, mutate inventory, change
reputation, or change relationship state on its own.

## NPC voice realization

NPC dialogue is authored, deterministic, and frame-driven. The realization layer does
not generate open-ended text. It selects a template from the current intent/state,
then applies NPC voice data.

Each generated person carries a `dialogueProfile`:

- `voiceId`: stable descriptive id for future grouping.
- `lexiconId`: word-choice profile used to resolve vocabulary slots.
- `defaultRegister`: `neutral`, `work`, or `personal`.
- `personalRegisterFamiliarity`: minimum familiarity score for personal speech.
- `personalRegisterTrust`: minimum trust score for personal speech.

Registers describe the social situation:

- `neutral`: ordinary public speech.
- `work`: task-specific, transactional, professional speech.
- `personal`: familiar speech unlocked by trust and familiarity.

Emotional tones are derived from relationship state rather than stored as a single
relationship label. Relationship `trust` and `affect` values (`warmth`, `respect`,
`resentment`, `fear`, `envy`, `jealousy`, `attraction`) determine whether the surface
tone is `neutral`, `warm`, `guarded`, `hostile`, `envious`, `jealous`, or `intimate`.
Tones are presentation choices, not canonical relationship states.

Template fallback order is:

1. exact register + exact tone
2. exact register + neutral tone
3. neutral register + exact tone
4. neutral register + neutral tone
5. work register + exact tone
6. work register + neutral tone
7. global fallback line (`DIALOGUE_FALLBACK_LINE`)

Lexicon slots such as `{goodLead}`, `{badStock}`, `{askAround}`, and `{supplier}`
are resolved after register and tone selection from the NPC's `lexiconId` bank. This
keeps per-NPC word choice consistent without duplicating every line for every NPC.
Concrete game data uses `{itemLabel}` and `{personName}`.

Realization remains deterministic and authored:

- Callers build simple semantic frames with intent, state, ids, and slots.
- `dialogueRealization.js` resolves the frame person from `state.people`, reads the
  player relationship, selects register via `selectDialogueRegister`, derives tone via
  `deriveDialogueTone`, resolves lexicon slots, and selects from nested authored templates.
- Template banks are shaped as `state → register → tone → templates[]` per intent.
- Lexicon and template choices use stable keys, not random draws, so repeated
  realization of the same frame produces the same text.
- Templates may mention Communications only for states where a real offer/message
  surface exists, such as `offer_ready`; templates never grant offers, tasks, memories,
  reputation, inventory, or any other gameplay effect.
- Missing required data returns `DIALOGUE_FALLBACK_LINE`.

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

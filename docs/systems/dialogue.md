# Dialogue System

The dialogue system models local-contact requests, NPC follow-up, located-item offers, and the Communications console.

## Update path

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

Communications combines conversation summaries, selected conversation timeline, active offers, debug trace counts, and legacy NPC follow-up messages. Sector local-contact buttons use the conversation query read model, so buttons can show `Find nav chip`, `Looking for nav chip`, `Offer ready`, `Ask again`, or `Found already` without scanning raw tables in the renderer.

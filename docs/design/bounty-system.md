# Bounty System Design
_Last updated: 2026-05-21_

## Purpose and boundary

The bounty system formalizes existing conflict signals into contracts. It is
not a separate crime simulator and does not introduce an independent legality
or faction model. Bounty issuance and pressure must remain downstream of SDA
heat, contraband bust severity, pirate suppression demand, captain hostility,
intel quality, and world events.

## Guild and board model

- Seven competing guilds are defined in `BALANCE.BOUNTY_GUILDS`.
- Legal acceptance/claiming generally requires recognized guild membership.
- Recognition is local and political; a site can recognize overlapping guilds.
- Boards show visible contracts, legally available contracts, and unavailable
  entries with reasons.

## Canonical data model

- `state.bounties = { byId, allIds }` stores normalized records.
- Record fields include target/issuer metadata, reward, expiry, visibility,
  recognition, tier gates, acceptance state, and resolution payload.
- `state.player.bountyGuilds = { memberships, standings, activeGuildId }`
  stores player guild credentials and disciplinary status.

## Core helpers and API

Canonical logic lives in `js/systems/bounties.js` and compatibility exports
remain in `js/new/bounties.js`.

- `getRecognizedBountyGuilds(siteId)` resolves local recognition overlap.
- `canLegallyAcceptBounty(bountyId, guildId, siteId)` returns deterministic
  legality reasons without mutating state.
- `issueBounty(def)` validates, de-duplicates active issuer-target-type records,
  normalizes defaults, persists, and emits a world event.
- `getActiveBounties(context)` returns board-ready records with eligibility
  reasons such as `no_membership`, `guild_not_recognized`,
  `insufficient_tier`, `expired`, and `already_claimed`.
- `claimBounty(id)` validates acceptance + evidence path and applies payouts,
  faction effects, and world events.
- `playerHasBounty()` derives player-target pressure state from active records.

## Release scope

First release validates defeat/capture outcomes and claim authority. Settlement,
surrender, cancellation, and full hunter-pressure encounter loops stay planned
extensions, but data shape and event hooks are preserved for that expansion.

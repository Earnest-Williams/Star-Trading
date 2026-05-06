# Feature Boundary: Frontier Legality, Intel, and Logistics

## Current shipped boundary

The playable loop remains anchored on legal trade, missions, faction reputation, colonies, captains, and persistent trade routes. Route systems must only operate on real jump-gate corridor connectivity: disconnected endpoints are invalid map data, not a short two-node fallback. Save/load normalization, route creation, and daily route execution should expose those failures instead of hiding them behind fabricated paths.

Intel is a canonical core subsystem. All reads, writes, expiry, and sales go through `js/core/intel.js`, while `js/new/intel.js` exists only as a compatibility entry point for older/planned imports. Intel storage remains `state.player.factions.intel` so existing saves and UI continue to work.

Global registries are explicit lifecycle objects. EventBus listeners, renderer handlers, and daily/hourly simulation hooks must support unregister/reset paths so tests, hot reload, and debug tooling can leave no hidden global subscriptions behind.

## Next shipped feature: Contraband

Contraband ships before bounties because it reuses existing mechanics instead of requiring a new combat/capture stack. The first slice is hidden hold state, Void Cartel pickup/delivery, SDA inspections, faction heat/trust consequences, per-route risk, and ports with `hiddenFactionId` receivers. It should create fast payoff in the current map/economy/faction loop without adding unrelated law-enforcement scaffolding.

## Deferred feature: Bounties

Bounties stay planned until the game has clearer enforcement, combat-result, capture, and surrender flows. The current bounty stub should remain non-authoritative and must not introduce a parallel legality model that conflicts with SDA heat, captain combat, or pirate threat.

## Non-goals for this boundary

- No fake paths, silent route repairs, or automatic map rewiring during normalization.
- No second intel store or parallel intel API.
- No renderer/EventBus subscriptions that cannot be removed.
- No bounty board expansion until the contraband loop proves the legality/heat surface.

# Feature Boundary: Sparse Worldgen, Gate Physics, Frontier Legality, Intel, and Logistics

## Current shipped boundary

The playable loop remains anchored on legal trade, missions, faction reputation, colonies, captains, and persistent trade routes. Route systems must only operate on real jump-gate corridor connectivity: disconnected endpoints are invalid map data, not a short two-node fallback. Save/load normalization, route creation, and daily route execution should expose those failures instead of hiding them behind fabricated paths.

The map boundary has moved from a fixed 2D ring of numbered sectors to sparse occupied sites in a 3D integer lattice. Systems should treat `state.universe` as a compatibility view over occupied sites, not as proof that every coordinate exists. New code should prefer role anchors such as `state.world.roles.homeSiteId` and `state.world.roles.shipyardSiteId` instead of hard-coded special sector numbers.

## Sparse world and routing rules

Worldgen should keep these design constraints intact:

- store occupied sites sparsely by id and coordinate key;
- do not materialize empty 3D grid cells;
- keep ordinary stellar systems as the majority site family;
- use rare way stations as relay, maintenance, scheduling, and chokepoint infrastructure rather than rich local economies;
- expose only a charted starting subnetwork at game start;
- keep settlement and standard routing suppressed in high-shear central regions;
- evaluate corridors with effective span cost using distance plus metric-shear penalties.

The exact formulas remain balance constants, but the qualitative behavior is locked: sparse space permits longer practical links, dense/complex space shortens them, and ordinary gates compare against a universal vacuum-span budget.

## Gate-energy economy boundary

Gates must not become a bulk utility power grid. A source mouth provides most of the opening pulse, the destination provides a smaller anchor pulse, and source-side launch capability requires locally stored jump-opening inventory.

Way stations can run baseline station systems from local power, but repeated source-side launches require physically delivered pulse inventory. Multi-way-station routes should therefore be scheduled, packetized, expensive, and strategically important. Use the setting language consistently:

- source-side bulk pulse;
- destination-side anchor pulse;
- local jump-opening inventory;
- Pulse Canisters and Heavy Pulse Modules;
- Metric Pulse Accumulators;
- jump tenders / pulse tenders for rare expeditionary or strategic support.

## Contraband and intel boundary

Intel is a canonical core subsystem. All reads, writes, expiry, and sales go through `js/core/intel.js`, while `js/new/intel.js` exists only as a compatibility entry point for older/planned imports. Intel storage remains `state.player.factions.intel` so existing saves and UI continue to work.

Contraband reuses the existing legality, route-risk, hidden-front, and faction-heat surfaces. The canonical implementation lives in `js/systems/contraband.js`; `js/new/contraband.js` is only a compatibility entry point. It should create fast payoff in the current map/economy/faction loop without adding unrelated law-enforcement scaffolding.

## Deferred feature: Bounties

Bounties stay planned until the game has clearer enforcement, combat-result, capture, and surrender flows. The current bounty stub should remain non-authoritative and must not introduce a parallel legality model that conflicts with SDA heat, captain combat, pirate threat, or way-station inspection rules.

## Non-goals for this boundary

- No dense world arrays or rendering of empty lattice coordinates.
- No hard dependency on special sector numbers for new features.
- No fake paths, silent route repairs, or automatic map rewiring during normalization.
- No continuous wormhole power-grid gameplay.
- No unlimited self-sustaining deep-space relay routes without material pulse resupply.
- No second intel store or parallel intel API.
- No renderer/EventBus subscriptions that cannot be removed.
- No bounty board expansion until the contraband loop proves the legality/heat surface.

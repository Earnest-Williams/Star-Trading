# Feature Boundary: Sparse Worldgen, Gate Physics, Frontier Legality, Intel, and Logistics

This document defines the shipped design boundaries that new work must preserve.
It is intentionally stricter than a roadmap: if a feature needs to cross one of
these lines, update this document and the affected tests in the same change.

## Current shipped boundary

The playable loop remains anchored on legal trade, missions, faction reputation,
colonies, captains, character traits, data cargo, and persistent trade routes.
Route systems must only operate on real jump-gate corridor connectivity:
disconnected endpoints are invalid map data, not a short two-node fallback.
Save/load normalization, route creation, and daily route execution should expose
those failures instead of hiding them behind fabricated paths.

The map boundary has moved from a fixed 2D ring of numbered sectors to sparse
occupied sites in a 3D integer lattice. Systems should treat `state.universe` as
a compatibility view over occupied sites, not as proof that every coordinate
exists. New code should prefer role anchors such as
`state.world.roles.homeSiteId`, `state.world.roles.startingPortSiteId`, and
`state.world.roles.shipyardSiteId` instead of hard-coded special sector numbers.

## Sparse world and routing rules

Worldgen should keep these design constraints intact:

- store occupied sites sparsely by id and coordinate key;
- do not materialize empty 3D grid cells;
- keep ordinary stellar systems as the majority site family;
- use rare way stations as relay, maintenance, scheduling, and chokepoint
  infrastructure rather than rich local economies;
- expose only a charted starting subnetwork at game start;
- keep settlement and standard routing suppressed in high-shear central regions;
- evaluate corridors with effective span cost using distance plus metric-shear
  penalties;
- validate route endpoints against actual corridor topology before execution.

The exact formulas remain balance constants, but the qualitative behavior is
locked: sparse space permits longer practical links, dense/complex space shortens
them, and ordinary gates compare against a universal vacuum-span budget.

## Gate-energy economy boundary

Gates must not become a bulk utility power grid. A source mouth provides most of
the opening pulse, the destination provides a smaller anchor pulse, and
source-side launch capability requires locally stored jump-opening inventory.

Way stations can run baseline station systems from local power, but repeated
source-side launches require physically delivered pulse inventory.
Multi-way-station routes should therefore be scheduled, packetized, expensive,
and strategically important. Use the setting language consistently:

- source-side bulk pulse;
- destination-side anchor pulse;
- local jump-opening inventory;
- Pulse Canisters and Heavy Pulse Modules;
- Metric Pulse Accumulators;
- jump tenders / pulse tenders for rare expeditionary or strategic support.

## Economy and logistics boundary

Explicit routes and ambient trade have different responsibilities:

- player routes and captain routes are durable plans with ownership, cargo,
  risk, setup cost, reliability, and route-history consequences;
- ambient trade is aggregate background flow that can soften shortages and make
  prices feel alive;
- ambient trade must stay capped so it cannot fully solve deficits, guarantee
  supply, replace player income, or make explicit routes irrelevant;
- way-station and long-corridor logistics should preserve pulse-reserve pressure
  instead of becoming self-sustaining free infrastructure.

## Contraband and intel boundary

Intel is a canonical core subsystem. All reads, writes, expiry, and sales go
through `js/core/intel.js`, while `js/new/intel.js` exists only as a compatibility
entry point for older/planned imports. Intel storage remains
`state.player.factions.intel` so existing saves and UI continue to work.

Contraband reuses the existing legality, route-risk, hidden-front, and
faction-heat surfaces. The canonical implementation lives in
`js/systems/contraband.js`; `js/new/contraband.js` is only a compatibility entry
point. Contraband should create fast payoff in the current map/economy/faction
loop without adding unrelated law-enforcement scaffolding. Structured
contraband bust results and derived SDA enforcement status are now the proven
precursor to bounties: enforcement pressure is read from faction heat and bust
severity, and threshold crossings are recorded as world events instead of a
separate legality store.

## Character, captain, and entanglement boundary

Character traits should modify existing systems through explicit trait hooks or
clear domain checks. They should not introduce hidden global state, import-time
side effects, or renderer-only rules that cannot be tested.

Captain relationships and entanglements should remain persistent simulation
state. Relationship events may affect missions, trust, faction pressure, or
captain behavior, but they should not bypass save normalization or duplicate
faction/reputation stores.

## Bounty boundary

Bounties are now implemented as a regulated contract layer that consumes
existing enforcement and faction signals. Canonical ownership lives in
`js/systems/bounties.js`, with `js/new/bounties.js` retained as a compatibility
entry point. The bounty system must not introduce a separate criminality store
or parallel faction/legality model.

Guild licensing and recognition are political and local: jurisdictions may
recognize overlapping guilds, and acceptance legality must be derived from
membership, recognition, and tier rules. Bounty issuance, visibility, and
claiming must remain deterministic and testable for fixed world states.

## Non-goals for this boundary

- No dense world arrays or rendering of empty lattice coordinates.
- No hard dependency on special sector numbers for new features.
- No fake paths, silent route repairs, or automatic map rewiring during
  normalization.
- No continuous wormhole power-grid gameplay.
- No unlimited self-sustaining deep-space relay routes without material pulse
  resupply.
- No ambient market layer that replaces explicit route gameplay.
- No second intel store or parallel intel API.
- No renderer/EventBus subscriptions that cannot be removed.
- No bounty rules that bypass guild recognition, local politics, or existing
  faction/enforcement state.

## Required documentation updates when crossing boundaries

Update this file when a change modifies any of the qualitative boundaries above.
Also update:

- `README.md` for player-facing rule changes;
- `docs/ARCHITECTURE.md` for module ownership or data-flow changes;
- `docs/SYSTEMS.md` for canonical system ownership changes;
- `docs/SAVE_FORMAT.md` for persistence or migration changes;
- `docs/magic-numbers.md` when moving or introducing balance-number homes.

## Character-mediated challenge boundary

Star-Trading does not treat puzzle-like content as a direct test of the
player’s personal decoding, arithmetic, reflex, memory, or optimization skill.
The player chooses what the character attempts and how much risk, time, money,
equipment, intel, staff, crew support, political capital, or fallback support to
commit. The character performs the test.

Challenge difficulty should come from missing or insufficient in-world
capability. Relevant stats, traits, skill nodes, ship systems, property, staff,
crew, contacts, intel, tools, and preparation should reduce uncertainty, reveal
better options, lower costs, shorten time, reduce risk, or convert the attempt
into automatic success.

At very high relevant competency, the correct or safest solution should often be
obvious, directly recommended, or automatically resolved. At low competency, the
same situation may expose only partial information, misleading estimates,
increased danger, higher cost, delayed execution, or a need to hire help.

Stationary careers follow this same doctrine. A property owner should make
active choices about rent, tenants, upkeep, debt, storage, services, and local
influence, while character-mediated system helpers perform the analysis.
Property recommendations must therefore expose tradeoffs such as storage income
versus inspection exposure without requiring renderer-only math or a passive
daily-credit drip.

### Non-goals

- No mandatory player-solved brainteasers that bypass character stats, traits,
  skills, tools, property, intel, staff, crew, or preparation.
- No reflex, timing, or manual dexterity challenges as required resolution for
  core simulation outcomes.
- No renderer-only puzzle rules that cannot be tested through core/system
  helpers.
- No challenge whose difficulty remains fixed when the relevant character
  capability is maxed.

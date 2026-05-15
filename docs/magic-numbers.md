# Magic Number Audit

This audit treats numeric literals as editable configuration when changing the
value would affect balance, routing, economy, UI timing, world-generation shape,
or player-facing simulation behavior. It does **not** treat structural idioms
such as `0`, `1`, `-1`, array indexes, radix `10`, `%` parity checks, or bitwise
PRNG constants as balance magic numbers.

## Relocated in this pass

| Area | Numbers | New home | Used by |
| --- | --- | --- | --- |
| Route defaults | `1`, `50`, `55`, `52`, `12` | `BALANCE.TRADE_ROUTE` / existing trade-route defaults | Route creation and save hydration |
| Captain route sizing | `6`, `60`, `0.18` | `BALANCE.TRADE_ROUTE.CAPTAIN_*` | Captain-created route amounts |
| Route setup pricing | `140`, `24`, `130` | `BALANCE.TRADE_ROUTE.SETUP_*` | Route setup-cost calculation |
| Route profit bands | `8`, `25`, `0.38`, `0.75`, `1.25` | `BALANCE.TRADE_ROUTE.PROFIT_*` | Profit estimates and displayed bands |
| Route market price curve | `0.72`, `0.65`, `0.70`, `1.10` | `BALANCE.TRADE_ROUTE.*PRICE_*` | Buy/sell route valuation |
| Route risk and escort math | `12`, `14`, `8`, `25` | `BALANCE.TRADE_ROUTE.RISK_*` and `ESCORT_*_DIVISOR` | Heat, combat, trust, and opinion effects |
| Route opening rewards | `180`, `3`, `1` | `BALANCE.TRADE_ROUTE.OPEN_*` | Opening time, reputation, trust, influence |
| Escort hiring | `450`, `350`, `10`, `8`, `4`, `45`, `4`, `2`, `1` | `BALANCE.TRADE_ROUTE.ESCORT_*` | Escort price, time, and relationship changes |
| Route failure/success tuning | `3`, `0.02`, `0.55`, `0.04`, `0.035`, `0.025`, `0.003`, `8`, `6`, `1`, `2`, `4` | `BALANCE.TRADE_ROUTE.FAILURE_*`, `STARVED_*`, `SUCCESS_*` | Daily route outage and recovery simulation |
| Route side effects | `3`, `2`, `1`, `0.15` | `BALANCE.TRADE_ROUTE.ESCORT_RELATION_*` and `SMUGGLER_*` | Escort relationship cadence and smuggler heat |
| Planner gate defaults | `100`, `4`, `1`, `1.5`, `0.1`, `25`, `0.5` | `BALANCE.ROUTE_PLANNER` | Gate stability, reserve pressure, risk, edge cost |
| Planner toll conversion | `100` | `BALANCE.ROUTE_PLANNER.TOLL_DIVISOR` | Toll-to-route-cost conversion |
| Colony logistics stock/prices | `9000`, `85`, `160`, `320`, `7`, `26` | `PORT_DEFAULTS.MAX_STOCK` / `PORT_DEFAULTS.BASE_PRICES` | Player-colony logistics nodes |
| Combat tuning | `0.75`, `10`, `60`, `1000`, `3`, `8`, `4`, `12`, `2`, `250`, `350`, `300`, `0.25`, `30`, `5`, `7` | `BALANCE.COMBAT` | Emergency repair penalty, pirate fights, rewards, and recovered intel |
| Travel incident tuning | `0.08`, `0.35`, `0.65`, `50`, `0.55`, `8`, `15`, `2`, `0.30` | `BALANCE.TRAVEL` | Corridor pirate encounter chances, faction modifiers, damage, and leverage |
| Mining and survey tuning | `120`, `0.80`, `0.40`, `1.08`, `1.03`, `1.0`, `0.01`, `6`, `22`, `35`, `60`, `0.45`, `0.85`, `12`, `100`, `35`, `8` | `BALANCE.MINING` | Extraction time/yield, hazard damage, survey time, and front-intel discovery |
| Market price and relationship curve | `0.75`, `0.90`, `0.65`, `1.20`, `0.18`, `2`, `100`, `1`, `2` | `BALANCE.MARKET` | Port prices, quiet hidden-faction ties, routine trade effects, VC equipment routing |
| Private data-cargo generation and sale | `1`, `25`, `0.12`, `26`, `2` | `BALANCE.DATA_CARGO` | Private-intel reputation, generation chance, value variance, and expiry variance |
| Secure courier generation and interception | `45`, `25`, `8`, `4`, `0.45`, `1`, `5`, `3`, `35`, `55`, `2`, `50`, `0.04`, `0.025`, `0.015`, `0.28`, `0.25`, `0.55`, `0.85`, `10`, `50` | `BALANCE.DATA_CARGO` | License thresholds, contract count/value/risk, delivery/expiry reputation, intercept outcomes, transfer-log retention |

## Exhaustive implementation audit

This pass re-scanned every `js/**/*.js` implementation file and classified all
non-trivial numeric literals. The editable balance literals found in the areas
below now live in domain config objects, while intentionally-authored data
tables remain in the existing config files listed later in this document.

| File / area | Magic numbers found | Current editable home or decision |
| --- | --- | --- |
| `js/systems/combat.js` | Emergency repair credit multiplier; minimum fighters; fight time; VC softening divisor; fighter loss; shield damage; pirate reward; intel chance/value/expiry | Moved to `BALANCE.COMBAT` |
| `js/systems/travel.js` | Pirate incident chance cap/curve; SDA/VC modifiers; VC recognition threshold; damage curve; leverage chance | Moved to `BALANCE.TRAVEL` |
| `js/systems/mining.js` | Mining time; yield random band; influence multipliers; minimum hazard chance; hazard damage; survey time/chance; front suspicion/value/expiry | Moved to `BALANCE.MINING` |
| `js/systems/market.js` | Buy/sell price curve; hidden faction relationship chance; suspicion cap/gain; routine trade effects; VC equipment effects | Moved to `BALANCE.MARKET` |
| `js/systems/secureCourier.js` | License thresholds; maximum available contracts; generation attempt divisor; skip chance; risk/value/expiry bands; delivery, expiry, and compromise reputation/trust effects; interception pressure/chance/outcome/damage thresholds | Moved to `BALANCE.DATA_CARGO` |
| `js/core/dataCargo/implementation.js` | Private-intel sale/generation/value/expiry knobs; secure risk min/max; ambient transfer history length | Moved to `BALANCE.DATA_CARGO`; `nextPayloadId` sync and missing-sector cull edge cases fixed while touching the module |
| `js/utils.js` | PRNG bit shifts/constants, minute/hour conversion, log DOM cap | PRNG constants are structural; minute conversion uses global time constants elsewhere; log cap is UI retention and can move to `js/config/ui.js` if made player-facing |
| `js/systems/guilds.js` | Guild ask rewards, progress quotas, membership/promotion thresholds, time costs, rank caps | Authored guild-balance content; should be moved as a full guild config pass rather than piecemeal |
| `js/systems/polities.js`, `js/systems/politics.js` | Sector value scoring, influence and polity thresholds | Political balance already has `js/config/politics.js`; remaining literals are candidates for a dedicated polity scoring config |
| `js/systems/missions.js` | Relationship bonus cap/divisor, generation chance, memory thresholds | Mission templates already live in `js/config/missions.js`; these generator knobs are candidates for a `MISSION_GENERATION` balance group |
| `js/systems/captains/**` | Archetype starting stats, relationship labels, log retention, mission scoring, AI thresholds | Archetype stats are authored data; scoring/log thresholds should move in a future captain-AI balance pass |
| `js/core/universe/**` | Galaxy layout probabilities, geometry scales, candidate search bounds, starfield alpha/depth | World shape numbers mostly belong in `js/config/worldgen.js`; remaining geometry literals were reviewed as generation internals or future worldgen-config candidates |
| `js/core/persistence.js` | Save-version gates, migration defaults, legacy port stock/price defaults | Version gates intentionally stay beside migrations; legacy defaults mirror config values for old saves |
| UI renderers | Percent conversion, dimensions, map styling, notification importance/duration | Core map/layout values belong in `js/config/ui.js`; `100` percent conversion and small display counts are structural formatting |
| Tests and benchmarks | Scenario fixtures, deterministic seeds, expected values, performance sizes | Intentionally local to the scenario being verified |

## Existing appropriate homes

| File | Purpose |
| --- | --- |
| `js/constants.js` | Global balance, time, route, gate, faction, price, cargo, save-version, and commodity tunables. |
| `js/config/worldgen.js` | Galaxy geometry, site spawning, port stock/prices, planet defaults, anchors, gate defaults, and starfield constants. |
| `js/config/ui.js` | Map projection, layout, node radius, label offsets, link width, and selection styling constants. |
| `js/config/player.js` | Starter player and starter ship numbers. |
| `js/config/chargen.js` | Character-generation point budgets, stats, age ranges, and platform package values. |
| `js/config/entanglements.js` | Entanglement strengths, pressure, mission impacts, cooldowns, and faction/social event weights. |
| `js/config/missions.js` | Mission templates: rewards, durations, expiry, risk, and political effects. |
| `js/config/politics.js` | Political drift, expansion, influence, relation, and mission thresholds. |
| `js/config/companies.js`, `js/config/people.js`, `js/config/polities.js`, `js/config/traits.js`, `js/config/characters.js` | Domain data and deliberately-authored content weights or starting values. |

## Remaining implementation literals reviewed

These remain in implementation files because they are structural rather than
balance knobs, or because they are compatibility/version gates that must stay
near migration code:

- Index/count sentinels: `0`, `1`, `-1`, `2` in tuple/index positions, array
  slices, queue cursors, sort ties, and boolean coercion.
- Parser radix: `10` in `parseInt(..., 10)` call sites outside the route module.
- Percent display conversion: `100` where converting a fraction to a percentage
  for labels or clamping a 0–100 domain.
- Time formatting width: `2` in `padStart(2, "0")`.
- PRNG/hash constants: Mulberry32/FNV constants and bit shifts in `js/utils.js`
  and persistence hashing.
- Save migrations: version gates such as `6`, `7`, `8`, `10`, `14`, and `15`,
  which must stay adjacent to migration branches.
- Tests and benchmarks: numeric fixtures are intentionally local to the scenario
  they verify.

Future balance work should continue moving any newly-added player-facing number
into the closest domain config object before using it in system code.

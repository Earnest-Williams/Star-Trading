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

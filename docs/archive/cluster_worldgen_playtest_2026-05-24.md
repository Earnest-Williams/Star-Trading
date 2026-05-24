# Cluster Worldgen Playtest (2026-05-24)

- Command: `node scripts/cluster-worldgen-playtest.mjs`
- Seeds: 101, 202, 303, 404, 505
- Occupied sites per run: 60

## Seed summary

| seed | occupied_sites | home_site (id/name/region) | reachable_sites | nearby_economic_sites | starter_hinted_economic_sites | extraction_hinted_sites | non_extraction_trade_complement | badlands_risk_hint_threats | route_count | economy_profiles | economy_pressure_exists | duplicate_coordinates | forbidden_runtime_blueprint_metadata |
|---|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---|---:|---|
| 101 | 60 | 1/StarDock/Core | 60 | 12 | 3 | 1 | 2 | 7:2, 8:2, 9:4 | 112 | 45 | true | 0 | false |
| 202 | 60 | 1/StarDock/Core | 60 | 12 | 3 | 1 | 2 | 7:1, 8:3, 9:4 | 103 | 50 | true | 0 | false |
| 303 | 60 | 1/StarDock/Core | 60 | 11 | 3 | 1 | 2 | 7:5, 8:4, 9:4 | 112 | 50 | true | 0 | false |
| 404 | 60 | 1/StarDock/Core | 60 | 12 | 3 | 1 | 2 | 7:4, 8:3, 9:2 | 103 | 46 | true | 0 | false |
| 505 | 60 | 1/StarDock/Core | 60 | 12 | 3 | 1 | 2 | 7:5, 8:3, 9:3 | 111 | 48 | true | 0 | false |

## Notes

- Starter quality: every sampled seed produced non-zero starter_hub hinted economic and extraction sites.
- Risk shaping: every sampled seed produced non-zero pirate threat values on badlands_risk hinted sites.
- Economy shape: profiles and pressure were present across sampled seeds through `state.economy.profilesBySector` and `state.economy.pressureBySector`.
- Route shape: route counts were stable and non-zero across seeds, with no synthetic fallback injected by this script.
- Map readability: coordinate uniqueness held in all sampled runs (duplicate count remained zero).

## Limitations

- This is data-driven validation only. No UI play session was run in this pass.

# Cluster Worldgen Playtest (2026-05-24)

- Command: `node scripts/cluster-worldgen-playtest.mjs`
- Seeds: 101, 202, 303, 404, 505
- Occupied sites per run: 60

## Seed summary

| seed | occupied_sites | home_site (id/name/region) | reachable_sites | nearby_economic_sites | starter_hinted_economic_sites | extraction_hinted_sites | non_extraction_trade_complement | badlands_risk_hint_threats | route_count | economy_profiles | economy_pressure_exists | duplicate_coordinates | forbidden_runtime_blueprint_metadata |
|---|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---|---:|---|
| 101 | 60 | 1/StarDock/Core | 1 | 11 | 0 | 0 | 0 | none | 112 | 0 | false | 0 | false |
| 202 | 60 | 1/StarDock/Core | 1 | 12 | 0 | 0 | 0 | none | 109 | 0 | false | 0 | false |
| 303 | 60 | 1/StarDock/Core | 1 | 12 | 0 | 0 | 0 | none | 109 | 0 | false | 0 | false |
| 404 | 60 | 1/StarDock/Core | 1 | 12 | 0 | 0 | 0 | none | 103 | 0 | false | 0 | false |
| 505 | 60 | 1/StarDock/Core | 1 | 12 | 0 | 0 | 0 | none | 110 | 0 | false | 0 | false |

## Notes

- Starter quality: this script observed nearby economic sites around home, but starter-hint and extraction-hint counts were zero in these runtime snapshots, so no positive starter-hint quality claim is made from this data alone.
- Route shape: route counts were stable and non-zero across seeds, with no synthetic fallback injected by this script.
- Faction clarity: faction outcomes were not scored subjectively here; this report is limited to objective generated fields and counts.
- Economy pressure: these snapshots reported no economy profiles and no per-site economy pressure fields at sampling time; this helper is validating generated structure, not downstream simulation ticks.
- Map readability: coordinate uniqueness held in all sampled runs (duplicate count remained zero).

## Limitations

- This is data-driven validation only. No UI play session was run in this pass.

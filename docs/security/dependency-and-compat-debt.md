# Dependency and compatibility debt tracker
_Last updated: 2026-05-21_

## Inflight deprecation cleanup

- **Issue:** `inflight@1.0.6` is deprecated (unsupported and memory-leak prone).
- **Root cause:** it was pulled in via `eslint@8 -> file-entry-cache -> flat-cache -> rimraf@3 -> glob@7`.
- **Action completed (2026-05-20):** upgraded lint toolchain to `eslint@9.17.0`, which removed the `rimraf@3/glob@7/inflight` chain from `package-lock.json`.
- **Verification command:** `npm ls inflight --all` now returns an empty tree.

## StateSlice compatibility alias layer

- **Issue:** `js/ui/stateSlices.js` was a compatibility-only import shim.
- **Risk addressed:** shim maintenance overhead is removed by deleting the alias once no internal consumers remained.
- **Action completed (2026-05-20):** audited repo imports, migrated internal tests to `js/core/state/index.js`, and removed `js/ui/stateSlices.js`.
- **Follow-up:** monitor downstream/plugin consumers and call out the removal in release notes.

- **Pass 2 guardrail (2026-05-20):** added `tests/stateSliceShimGuard.test.js` so internal JS/tests fail CI if `js/ui/stateSlices.js` imports reappear.

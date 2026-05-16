# Contributor Guide

Star-Trading is a framework-light browser prototype built from ES modules. The
project intentionally keeps gameplay logic testable without a browser DOM, so
most changes should include focused Node tests.

## Prerequisites

- Node.js 18 or newer.
- npm for dependency installation and script execution.
- A modern browser for manual playtesting.

## Setup

```bash
npm install
npm run dev
```

The dev server is pinned to port 3000 by `package.json`. You can also open
`index.html` directly for a no-build local run, but the Vite server gives better
module-loading behavior during development.

## Validation commands

Run these before opening a pull request:

```bash
npm test
npm run lint
```

Optional performance check for map-projection changes:

```bash
npm run benchmark:map
```

## Change checklist

- Add or update tests for any gameplay, persistence, migration, or renderer
  behavior that can be exercised programmatically.
- Update docs when changing controls, onboarding, module ownership, save shape,
  balance homes, or feature boundaries.
- Keep player-facing balance values in config or `BALANCE` groups rather than
  burying them in implementation files.
- Preserve save compatibility: normalize missing fields and make migrations
  idempotent.
- Do not fabricate routes, sectors, or graph edges to hide invalid data. Surface
  invalid map connectivity through validation paths.
- Keep renderer subscriptions removable and avoid introducing unbounded event
  listeners.

## Coding conventions

- Use ES modules and named exports for shared logic.
- Keep deterministic simulation logic outside the DOM where practical.
- Prefer pure helpers in `js/core/` and `js/systems/**` when adding logic that
  needs tests.
- Put authored data and tuning in `js/config/**` or `js/constants.js`.
- Use JSDoc for public helpers whose inputs or return values are not obvious.
- Keep persistence migrations close to `js/core/persistence.js` so version gates
  remain auditable.

## Testing guidance

- Use `node --test` style tests under `tests/*.test.js`.
- Create small state fixtures rather than launching the browser UI.
- Seed random behavior explicitly when asserting simulation outcomes.
- Cover legacy or partial save payloads when adding migration logic.
- For UI-facing helpers, test the data transformation separately from DOM
  rendering whenever possible.

## Pull request notes

A useful pull request summary should include:

- player-visible behavior changes;
- affected systems or files;
- save migration notes, if any;
- tests and manual checks run;
- known follow-up work.

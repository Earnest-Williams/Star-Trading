# Blackline Command Implementation Guide
_Last updated: 2026-05-21_

This guide defines a staged, low-risk migration path for applying the Blackline Command design language to the existing Star-Trading browser prototype.

## Current architecture notes

- `index.html` is the shell.
- `style.css` is the canonical stylesheet.
- `js/main.js` is loaded as a module.
- There is no app framework to introduce.
- The project should continue to run as a no-build browser prototype where `index.html` loads `style.css` and `js/main.js` directly.

## Implementation phases

### Phase 1: Documentation and token setup

- Add the Blackline Command design bible and this implementation guide.
- Introduce the Blackline Command token set in `:root`.
- Add compatibility aliases for legacy token names so existing selectors keep working.

### Phase 2: Replace existing CSS variables with Blackline Command tokens

- Gradually replace old token usage with semantic Blackline Command tokens.
- Alias old names to new names first to avoid broad regressions.
- Preserve existing class names and DOM hooks.

### Phase 3: Remove glow-first styling and replace with border/inset/corner systems

- Remove box-shadow glow from `.panel`, `.notification`, `.map-tooltip`, active tabs, validation fields, and other UI surfaces.
- Replace glow emphasis with stronger borders, inset outlines, left rails, corner ticks, and divider rules.
- Ensure no rounded corners remain.

### Phase 4: Normalize components

Normalize these components without changing gameplay behavior:

- Buttons
- Inputs
- Selects
- Tabs
- Panels
- Cards
- Notifications
- Tooltips

The goal is visual consistency, not a markup rewrite.

### Phase 5: Add optional utility classes

Add utility classes that can be wired into markup later:

- Scan text
- Glitch cut
- Corner ticks
- Grid overlays
- Telemetry labels

These utilities should be opt-in and should not change gameplay logic.

### Phase 6: Audit responsive behavior

- Keep the current mobile media queries intact unless a visual regression requires a focused adjustment.
- Confirm the three-column layout still collapses cleanly.
- Confirm the map remains usable on narrow screens.

## Explicit CSS refactor instructions

- Keep `style.css` as the canonical file for now.
- Do not split CSS unless the repo owner asks.
- Replace the old token names gradually or alias old names to new names first.
- Preserve existing class names to avoid JS regressions.
- Do not add GSAP yet.
- Do not add dependencies for fonts or animation libraries.
- Use system fallbacks unless the repo owner explicitly wants external fonts.

## Specific current CSS problems to fix

- Remove box-shadow glow from `.panel`, `.notification`, `.map-tooltip`, active tabs, validation fields, and other UI surfaces.
- Remove passive transitions except where converted to named keyframe animations.
- Ensure border-radius is globally zero.
- Convert buttons to physical command switches.
- Convert panels/cards/subpanels to hard bordered graphite surfaces.
- Make `h1`, `h3`, and `h4` uppercase technical display text.
- Preserve existing semantic color classes `.green`, `.red`, `.amber`, `.blue`, and `.muted`, but map them to the new token palette.

## Acceptance criteria

- The game still opens through `index.html`.
- `npm run lint` passes.
- `npm test` passes.
- No gameplay files are modified unless needed for class hooks.
- No build system, framework, or package dependency is added.
- No rounded corners remain.
- No soft shadows or glass effects remain.
- `style.css` contains the Blackline Command token set.
- `README.md` links to the new design docs.

## First-pass boundaries

The first CSS pass should be safe and reversible. It should establish tokens, global hard-angle rules, no passive transitions, and the major panel/control surface changes. More detailed HTML wiring, specialized component extraction, and full visual QA should happen in later passes.

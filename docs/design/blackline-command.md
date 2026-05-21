# Blackline Command Design Bible
_Last updated: 2026-05-21_

**One-line definition:** Blackline Command is an OLED-black, hard-angle interface language built from heavy typography, 2-4px technical borders, mechanical text motion, dense telemetry, and restrained neon signal colors.

**Design language name:** Blackline Command

**Product feel:** “A command terminal evolved into a high-end control surface.”

## Core rules

- Use **0px border radius everywhere**.
- Use a true black page background with near-black panel hierarchy.
- Use borders, inset outlines, dividers, corner marks, and technical rules instead of shadows.
- Typography should be heavy, uppercase, and condensed where possible.
- Mono typography should be reserved for numeric, status, and telemetry content.
- UI should be dense, angular, data-first, and mechanical.

## Token table

| Token | Value | Role |
| --- | --- | --- |
| `--bg-void` | `#000000` | True black page void |
| `--bg-deck` | `#030506` | Primary deck background |
| `--bg-panel` | `#070b0e` | Standard panel surface |
| `--bg-panel-raised` | `#0d1318` | Raised card/control surface |
| `--bg-panel-hot` | `#111a20` | Active or high-attention surface |
| `--text-primary` | `#f2f7f8` | Primary text |
| `--text-secondary` | `#9aaeb5` | Secondary text |
| `--text-muted` | `#5f747c` | Muted/supporting text |
| `--line-dim` | `#1c3038` | Low-emphasis dividers/grid |
| `--line` | `#35515d` | Standard technical border |
| `--line-strong` | `#7defff` | High-emphasis border/signal line |
| `--accent-cyan` | `#57eaff` | Primary signal accent |
| `--accent-green` | `#39ff14` | Valid/online/safe signal |
| `--accent-amber` | `#ffd15a` | Caution/queued/unstable signal |
| `--accent-red` | `#ff3b3b` | Threat/error/invalid signal |
| `--border-thin` | `2px` | Default technical border |
| `--border-thick` | `4px` | Heavy command border |

## Component rules

### Panels

- Use near-black graphite fills: `--bg-panel`, `--bg-panel-raised`, and `--bg-panel-hot`.
- Use `2px` or `4px` solid borders with inset rules and divider lines.
- Prefer corner ticks, border interruptions, and section IDs to glow or drop shadow.
- Keep panels dense; avoid excessive whitespace unless it reinforces hierarchy.

### Buttons

- Treat buttons as physical command switches.
- Use uppercase command verbs and short labels.
- Use `2px` or `3px` borders, hard fills, and immediate hover/active state changes.
- Avoid soft hover fades, rounded pills, and shadow-based depth.

### Inputs/selects

- Match command switch geometry: hard rectangle, dark fill, strong border.
- Use mono typography only when the value is numeric, a code, a coordinate, or a status.
- Invalid states should use red borders and/or left rails, not glowing fields.

### Tabs

- Tabs are segmented command modes, not soft navigation pills.
- Active tabs should invert or switch to `--bg-panel-hot` with strong line accents.
- Avoid active glow; use heavy borders, top rails, or inset outlines.

### Notifications

- Notifications are attention feed packets.
- Use hard borders, priority rails, timestamp/status metadata, and compact text.
- Amber/red should be rare and reserved for caution or danger.

### Map canvas

- The map is the central command surface.
- Frame it with technical borders, coordinate labels, crosshair marks, and optional grid overlays.
- Keep the map background near-black; signal colors should identify state and interaction.

### Inspector/tooltips

- Inspectors and tooltips should look like tactical readouts.
- Use hard borders, compact rows, labels, coordinates, and status badges.
- No glass blur or glow; make the border system do the work.

### Metric/data tiles

- Metrics are telemetry blocks.
- Use small uppercase labels, larger numeric/status values, and restrained accent rails.
- Reserve mono typography for values, timestamps, identifiers, and coordinates.

### Logs/attention feed

- Logs should read as a dense operational feed.
- Use monospace timestamps, uppercase status labels, compact row spacing, and priority rails.
- Prefer mechanical scan/keyframe motion only for new or escalated items.

## Layout rules

- Use 12-column dashboard thinking where practical.
- The existing three-column game layout may remain.
- Prefer a command bar, side stack, map center, status rail, and telemetry blocks.
- Keep primary interaction paths close to the map and inspector.
- Use dense grouping and hard dividers instead of broad SaaS spacing.

## Visual motifs

- Corner brackets
- Scan lines
- Crosshair marks
- Coordinate labels
- Section IDs
- Diagonal cut corners
- Thin grid overlays
- Monospace timestamps
- Uppercase command labels
- Border interruptions
- Telemetry badges

## Motion rules

- No passive transitions.
- No soft hover fades.
- Allow only named mechanical keyframe classes.
- Keep glitch effects rare and controlled.
- Motion should feel like a device state change, scan pass, lock, or mechanical cut.

## UI copy rules

- Prefer short command-style labels: Initialize, Deploy, Authorize, System Ready, Signal Locked, Queue Active, Vector Online, Execute Scan.
- Avoid soft SaaS copy like “Get started today” or “Explore possibilities.”
- Label system state directly and tersely.

## Color ratio

- 90% black/graphite/off-white
- 7% cyan
- 2% green
- 1% amber/red

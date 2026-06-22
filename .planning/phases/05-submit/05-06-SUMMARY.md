---
phase: 05-submit
plan: 06
subsystem: client
tags: [demo-hook, goal-meter, reveal-preview, accessibility, determinism]
requires: [05-02, 05-04]
provides:
  - "client-local in-session reveal preview (freeze -> score -> reward glyph)"
  - "live goal-progress meter in the HUD (score-backed, steer-causal)"
  - "goalMeter() + revealPreviewSteps() pure logic module"
affects: [src/client/cosmos/hud.ts, src/client/game.ts, src/client/game.html, src/client/game.css]
tech-stack:
  added: []
  patterns:
    - "pure client logic module over engine score() (no Phaser/DOM/rng/timers)"
    - "client-local re-synthesis via existing render handle (regenerate) — no server"
key-files:
  created:
    - src/client/cosmos/revealPreview.ts
    - src/client/cosmos/revealPreview.test.ts
  modified:
    - src/client/cosmos/hud.ts
    - src/client/game.ts
    - src/client/game.html
    - src/client/game.css
    - vitest.config.ts
decisions:
  - "Preview re-synthesizes a FROZEN frontier copy (frontier + its score() outcome) via render.regenerate() so synthesis surfaces goalAchieved and the 04-04 reward glyph bakes on success — reuses existing seams, zero new Phaser code, zero engine change."
  - "goalMeter.progress01 is a display-only 0..1 approach fraction (1 once achieved; monotonic approach while short) mirroring score()'s degree-normalization shape; the VERDICT remains owned by score() (no parallel scoring)."
  - "Reduced-motion is honored by the existing render path: the resolved preview frame + reward glyph are static (04-04 PNT-04), and the HUD meter snaps width with no transition under prefers-reduced-motion — no staged timers/strobe added."
metrics:
  duration_min: 7
  completed: 2026-06-22
  tasks: 3
  files: 7
status: complete
---

# Phase 5 Plan 6: In-Session Reveal Preview + Live Goal Meter Summary

A client-only demo hook that makes Subcosm's goal->steer->reveal loop EXPERIENCEABLE in one judging session: a live, score-backed goal-progress meter that moves when you nudge, plus a non-mod "See tonight's reveal" button that plays a CLIENT-LOCAL freeze -> score -> reward-glyph sequence on the current frontier — reusing the engine `score()` and the 04-04 reward glyph, with no new gameplay system and no server mutation.

## What Was Built

### Task 1 — `revealPreview.ts` (pure logic + tests) — `e35d9cc` (test `7ef798f`)
- `goalMeter(frontierDay, genome)` -> `{ measured, threshold, direction, achieved, progress01 }`: projects the engine `score()` into a 0..1 progress model for the HUD. Because `score()` folds the bounded steering offset (GAME-03, within the I-5 cap), a nudge that biases the frontier's steering visibly moves `measured`/`progress01`.
- `revealPreviewSteps(frontierDay, genome)` -> `{ achieved, degree, goal, measured, phases }`: the outcome is byte-identical to `score()` (the HONEST verdict the overnight tick would produce — T-05-10), plus an ordered, timer-free phase list (`freeze -> resolve -> reward|miss`).
- Pure: no Phaser, no DOM, no rng, no timers, no server. Reuses `src/engine/score.ts`; no engine change.
- 9 unit tests: meter mirrors score(); steer moves the meter BOTH directions; preview outcome == score() exactly across all three genomes; achieved->reward / miss->miss; purity.

### Task 2 — HUD goal-progress meter — `22169ac`
- `updateHud()` now renders a 0..1 goal-progress bar via `goalMeter()`, updated on load AND after every nudge (the existing re-synth path already calls `updateHud`).
- Fill width = `progress01`; `data-state=achieved` drives the on-track accent (cyan -> warm-gold) so crossing the goal line reads instantly.
- ARIA `progressbar` (valuemin/max/now); values only via `textContent`/width — no language text injected (T-02-11).
- prefers-reduced-motion: width snaps with no eased travel (JS `.hud-meter-fill--reduced` class + CSS `@media`).

### Task 3 — In-session reveal preview button + local sequence — `d399a17`
- Non-mod "See tonight's reveal" button (any viewer; shown once a frontier exists, hidden on cold start).
- On press: `revealPreviewSteps()` + `score()` resolve the honest verdict; a FROZEN frontier copy (`{ ...liveFrontier, outcome }`) is re-synthesized through the existing `handle.regenerate(...)` seam — synthesis surfaces `goalAchieved`, and on success the 04-04 reward glyph bakes via the unchanged paint path.
- Clearly labelled "Preview — the real reveal happens overnight" (T-05-10); a reset re-synthesizes back to the live frontier (no frozen outcome -> no glyph, frontier animates again).
- ABSOLUTELY no server call in the preview/reset path (verified by grep): no `/steer`, no tick, no `createRevealPost`, no Redis (T-05-09).
- Static resolved frame + static reward glyph -> reduced-motion safe (PNT-04).

## How the Preview Stays Client-Local + Honest
- **Client-local (T-05-09):** `playRevealPreview()` / `resetRevealPreview()` only call `revealPreviewSteps()`, `score()`, and `handle.regenerate()` — all in-memory engine calls. Confirmed by grep that the preview path contains no `fetch`/`/api`/`/steer`/`createRevealPost`/`connectRealtime`. It re-synthesizes a local copy; it never freezes or mutates the real community frontier.
- **Honest (T-05-10):** the previewed verdict (`achieved`/`degree`/`measured`/`threshold`) comes verbatim from the engine `score()` the overnight tick uses — proven byte-identical by the Task 1 tests across calm/chaotic/crystalline. It is a preview of the real thing, not a fabricated outcome, and is labelled as a preview.

## Deviations from Plan
None — plan executed exactly as written. The reduced-motion requirement is satisfied via the existing static render path (resolved frame + static 04-04 glyph) and the HUD meter's no-transition snap, rather than adding bespoke timer/animation code (the module is intentionally timer-free, per the plan's behavior spec).

## Constraints Honored
- No `src/engine/**` change; reuses `score()`/`measure()` (engine) + `paintRewardAccent`/`REWARD_HUE` (04-04 paint). Determinism intact; no new rng.
- No new npm packages (T-05-SC).
- i18n: all new copy behind `data-i18n` keys (`reveal.*`, `hud.meter.label`); JS substitutes only values/glyphs (CLAUDE.md §7 / T-02-11).
- DoD all green: `npm test` (285), `npm run type-check`, `npm run lint`, `npm run build`.
- Zod boundary discipline unaffected (no new external input boundary introduced; preview reads the already-parsed in-memory RingRecord).

## Self-Check: PASSED
- Files exist: src/client/cosmos/revealPreview.ts, src/client/cosmos/revealPreview.test.ts (created); hud.ts, game.ts, game.html, game.css, vitest.config.ts (modified).
- Commits exist: 7ef798f, e35d9cc, 22169ac, d399a17.

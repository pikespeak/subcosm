---
phase: 05-submit
plan: 03
subsystem: ui
tags: [onboarding, coachmark, splash, devvit, i18n, reduced-motion, vitest]

# Dependency graph
requires:
  - phase: 03-devvit-post
    provides: data-driven game mount (mountUniverse, render seam, HUD chrome)
  - phase: 05-submit (05-02)
    provides: demo backfill seed so the coachmark overlays a populated cosmos
provides:
  - Static in-feed splash card — hook + teaser + open/play CTA (D-09)
  - First-run coachmark overlay (showCoachmarkOnce) — show-once + reduced-motion aware (D-02)
  - SUB-04 onboarding surfaces for both loops (cosmos loop + goal→steer→reveal)
affects: [05-submit on-device UAT, devpost-media-capture, demo-session]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable-seam unit testing for DOM/storage modules (store/reducedMotion/root) so DOM-touching client code is testable in the Phaser-free Node runner without jsdom"
    - "data-i18n markup-only convention: key attribute + English fallback as the rendered text; JS toggles [hidden]/class only, never injects copy (T-02-11)"

key-files:
  created:
    - src/client/cosmos/coachmark.ts
    - src/client/cosmos/coachmark.test.ts
  modified:
    - src/client/game.html
    - src/client/game.css
    - src/client/game.ts
    - vitest.config.ts
    - src/client/splash.html (Task 1, prior commit e94de12)
    - src/client/splash.css (Task 1, prior commit e94de12)
    - src/client/splash.ts (Task 1, prior commit e94de12)

key-decisions:
  - "Teaser visual source (Task 1): static inline SVG cosmos motif (genesis core + cross-flare + day-shells) in splash.html — no live render, no external image fetch (D-09 / RESEARCH Q4 Pitfall 6)"
  - "'seen'-flag persistence: localStorage key 'subcosm.coachmark.seen' = '1' (T-05-10 accepts tampering: a lost/forged flag only re-shows the coachmark, no security impact)"
  - "Coachmark made injectable (store/reducedMotion/root seams) so its two gates unit-test in the existing node-environment runner — avoids adding jsdom (threat model T-05-SC: zero new packages)"
  - "Coachmark shown only when a frontier exists (populated universe), never on cold-start/loading/error overlays"

patterns-established:
  - "Injectable-seam testing for client DOM modules: default to real localStorage/document/prefersReducedMotion, accept fakes for pure-node tests"

requirements-completed: [SUB-04]

# Metrics
duration: ~35min
completed: 2026-06-22
status: complete
---

# Phase 5 Plan 03: Onboarding Surfaces (Splash + Coachmark) Summary

**Static in-feed splash hook+teaser+CTA (D-09) plus a show-once, reduced-motion-aware first-run coachmark (showCoachmarkOnce) that explains both Subcosm loops to a brand-new visitor (SUB-04).**

## Performance

- **Duration:** ~35 min (resume session: Task 2 + completion)
- **Completed:** 2026-06-22
- **Tasks:** 2 of 3 code-actionable (Task 1 verified pre-done; Task 3 = human checkpoint, UAT-deferred)
- **Files modified:** 6 this session (Task 2) + 3 from Task 1 (prior commit)

## Accomplishments
- **Task 1 (verified, not redone):** in-feed splash card rewritten as a fast static hook ("a universe grown from your community") + inline-SVG cosmos teaser + open/play CTA wired to the existing `requestExpandedMode(e, 'game')`; starter boilerplate removed.
- **Task 2 (this session):** `showCoachmarkOnce()` — a one-time dismissible overlay pointing at the six D-02 targets (genesis core / shells / live frontier = depth is time, the goal line, the nudge/steer control, "freezes & reveals overnight"). Persists a 'seen' flag (re-opens no-op); reduced-motion gated (static, no strobe). Markup reuses the locked `.hud` chrome with `data-i18n` keyed English copy; wired into `game.ts` after the first populated universe mount.
- **Unit tests:** 7 new tests for the show-once persistence gate + the reduced-motion gate, run in the Phaser-free node runner via injectable seams (no jsdom added).

## Task Commits

1. **Task 1: Rewrite the in-feed splash card (D-09)** — `e94de12` (feat) — committed by the prior executor; verified via `git show --stat e94de12` (splash.html/css/ts), NOT redone.
2. **Task 2: First-run coachmark overlay (D-02)** — `e7cd577` (feat) — coachmark.ts + coachmark.test.ts + game.html/css/ts + vitest.config.ts.

_Plan metadata commit (this SUMMARY + STATE/ROADMAP) follows separately._

## Files Created/Modified
- `src/client/cosmos/coachmark.ts` — `showCoachmarkOnce()`: show-once gate (localStorage 'seen' flag) + reduced-motion gate, with injectable store/reducedMotion/root seams; binds real localStorage/`prefersReducedMotion`/#coachmark in production.
- `src/client/cosmos/coachmark.test.ts` — 7 tests: shows on fresh client, persists flag on dismiss, re-open no-ops, already-seen no-ops, null-root no-ops, reduced-motion flag applied / not applied.
- `src/client/game.html` — coachmark markup (role=dialog, four `data-i18n` point lines + dismiss button) reusing the `.hud` chrome.
- `src/client/game.css` — `.coachmark` scrim + panel styles; gentle single fade/rise reveal; `.coachmark--reduced` and the `prefers-reduced-motion` media query both disable the animation.
- `src/client/game.ts` — import + `showCoachmarkOnce()` call after the first populated `mountUniverse` (frontier exists only).
- `vitest.config.ts` — added `src/client/cosmos/coachmark.test.ts` to the include allowlist.

## Decisions Made
- **Teaser source:** static inline SVG (Task 1) — no live render, no external asset fetch — keeps the first impression instant (D-09 / RESEARCH Q4).
- **'seen' persistence:** localStorage `subcosm.coachmark.seen`. Read/write are wrapped in try/catch and fail safe (private-mode storage access can throw): a missing store treats the visitor as "already seen" to avoid nagging on every open; a write failure only risks one extra show later (T-05-10 disposition: accept).
- **No jsdom:** rather than switch the coachmark test to a DOM environment (and add a dependency the threat model forbids — T-05-SC zero new packages), the module exposes injectable seams so its logic is asserted with in-memory fakes in the existing node runner.

## Deviations from Plan

None — plan executed exactly as written. Task 2 followed the `<behavior>`/`<action>` spec; no auto-fixes (Rules 1–4) were required.

## Issues Encountered
- **CSS:** an initial edit combined a class selector and a `@media` block in one comma-separated selector list (invalid CSS). Caught immediately on review and split into a standalone `.coachmark--reduced` rule plus the `prefers-reduced-motion` media block before any test/build run. No functional impact.

## Task 3 — Human-Verify Checkpoint: UAT-DEFERRED

**Status: DEFERRED to the later Phase-5 on-device demo session (not performed in this session).**

Task 3 is a `checkpoint:human-verify` (gate="blocking") for on-device onboarding legibility — judging whether a first-time visitor understands BOTH loops from the splash + coachmark alone (SUB-04). This is inherently a human-legibility judgment requiring a real device (`npm run dev` devvit playtest on the dev/demo sub, OS reduced-motion toggle, in-feed splash tap, coachmark dismiss + re-open).

Per the session directive, on-device verification is folded into the later demo/UAT pass (D-06 single on-device validation on the demo subreddit, which also needs the 05-02 backfill seed). **No on-device verification has occurred and none is claimed here.** The CODE is complete, unit-tested, and passes all DoD gates; the human legibility/visual sign-off remains OPEN for the demo session.

Verification steps to run on device (from the plan):
1. In-feed: splash shows hook + static teaser + CTA, loads instantly, NOT a live render; CTA expands into the game.
2. First open: coachmark appears once, points at core/shells/frontier (depth=time), goal line, nudge control, overnight freeze+reveal; dismiss it.
3. Re-open: coachmark does NOT reappear.
4. OS reduced-motion + cleared seen flag: coachmark shows statically, no strobe/animated reveal.
5. Judge: does a first-time visitor understand both loops from splash + coachmark alone?

## Definition of Done — gates

All four DoD gates green (CLAUDE.md non-negotiable), code-only (no publish/upload/post/Devpost/live-platform action):
- `npm test` — **276 passed** (28 files; +7 new coachmark tests over the 269 baseline)
- `npm run type-check` — **pass** (tsc --build clean)
- `npm run lint` — **pass** (eslint clean)
- `npm run build` — **pass** (vite build; only pre-existing config warnings, unrelated to this plan)

## Next Phase Readiness
- Onboarding surfaces (splash + coachmark) code-complete and unit-tested; SUB-04 code satisfied.
- **OPEN:** on-device legibility sign-off (Task 3) deferred to the demo session — requires the 05-02 backfill seed + a real device; folds into the D-06 single on-device validation pass.

## Self-Check: PASSED

- FOUND: src/client/cosmos/coachmark.ts
- FOUND: src/client/cosmos/coachmark.test.ts
- FOUND: .planning/phases/05-submit/05-03-SUMMARY.md
- FOUND commit: e94de12 (Task 1, verified not redone)
- FOUND commit: e7cd577 (Task 2)

---
*Phase: 05-submit*
*Completed: 2026-06-22*

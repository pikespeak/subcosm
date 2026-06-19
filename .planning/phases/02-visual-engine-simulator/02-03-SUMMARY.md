---
phase: 02-visual-engine-simulator
plan: 03
subsystem: ui
tags: [phaser, webgl, paint, styletemplate, accessibility, reduced-motion, crystalline]

# Dependency graph
requires:
  - phase: 02-01
    provides: Painter injection seam, reused glow primitives, addDynamicTexture bake helper, CosmosScene base draw, techno StyleTemplate
provides:
  - Full mock-parity paint draw (per-shell nebula, small+big stars, genesis core, pulsing frontier ignite, full-screen vignette) driven entirely from StyleTemplate data
  - Crystalline StyleTemplate (ice-blue/faceted, techno-id variant — no contract change) with a faceted star primitive
  - Frontier-only frame loop (frozen shells baked once, only shells[0] re-renders per frame)
  - prefers-reduced-motion honored across the whole surface (static, non-strobe frame; loop stopped; re-decides live on media-query change)
affects: [02-04, 02-05, devvit-wiring, live-game]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "paint(Scene, StyleTemplate) reads ALL look constants from StyleTemplate (palette.ramp + genes); never imports DayVector/genome (ENG-02 seam)"
    - "Crystalline = same StyleId 'techno', different data (palette + genes) — a new look is a data file, zero engine change"
    - "Frozen shells baked to one Image each; only the live frontier re-renders per frame (PNT-03)"
    - "reduced-motion = data-driven static branch (matchMedia) that bakes the frontier and stops the rAF loop"

key-files:
  created:
    - src/client/cosmos/paint.ts
    - src/styles/crystalline.ts
    - src/client/cosmos/reduced-motion.ts
  modified:
    - src/client/cosmos/CosmosScene.ts
    - src/client/cosmos/primitives.ts
    - src/styles/index.ts

key-decisions:
  - "Crystalline authored as a techno-id StyleTemplate variant (no new StyleId, StyleIdEnum unchanged) per Open Q2 — proves look is data, not code"
  - "Mock parity accepted within the 2-day dev-fixture limitation; full multi-shell parity re-judged in 02-05 when the 30-day simulator wires into the dev page"
  - "Reduced-motion accepted on the basis of wiring (matchMedia / prefers-reduced-motion present); trusted, not strobe-tested frame-by-frame"

patterns-established:
  - "Painter seam integrity: paint reads style.palette/style.genes, imports no genome/DayVector"
  - "Bake-once + frontier-only animation as the mobile-perf foundation"
  - "Accessibility branch stops the loop and renders a single still frame; re-decides on media-query change"

requirements-completed: [PNT-01, PNT-02, PNT-03, PNT-04]

# Metrics
duration: ~5min (finalization only; implementation pre-committed)
completed: 2026-06-19
status: complete
---

# Phase 02 Plan 03: Mock-Parity Paint + Crystalline + Reduced-Motion Summary

**Full mock-parity Phaser paint (genesis core, shells, nebula, frontier ignite, vignette) driven entirely from StyleTemplate data, a distinct ice-blue/faceted Crystalline techno-id variant, and a static prefers-reduced-motion frame — human-verified side-by-side with the mock.**

## Performance

- **Duration:** ~5 min (finalization only — implementation tasks were committed in a prior session, this run ran gates + closed the plan)
- **Completed:** 2026-06-19
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- `paint.ts` paints a full Scene to mock parity (per-shell nebula, small + big stars, genesis core, frontier ignite, full-screen vignette) using ONLY the Scene geometry + StyleTemplate look data — additive blend == mock's `globalCompositeOperation='lighter'`.
- Crystalline StyleTemplate authored as a `id: 'techno'` variant (ice-blue ramp matching the genome, `facet` gene → faceted/angular star primitive) — a clearly distinct look with zero contract change.
- Frontier-only frame loop: frozen shells (`shells[1..]`) baked once via the bake helper; only `shells[0]` re-renders per frame (PNT-03).
- `reduced-motion.ts` honors `prefers-reduced-motion` via `matchMedia` — renders one static, non-strobe frame across the whole surface, stops the loop, and re-decides live on media-query change (PNT-04).
- Human-verify checkpoint (Task 3) **approved**: Crystalline distinct look confirmed (data-driven divergence proven), mock parity accepted within the dev-fixture limit, reduced-motion accepted on wiring.

## Task Commits

1. **Task 1: Author Crystalline StyleTemplate + complete mock-parity paint draw** — `3d60b59` (feat)
2. **Task 2: Animate only the frontier + honor prefers-reduced-motion** — `7192974` (feat)
3. **Task 3: Human-verify mock parity / Crystalline / reduced-motion** — checkpoint (verification-only, no commit) — **APPROVED**

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `src/client/cosmos/paint.ts` (created) — Scene + StyleTemplate → Phaser objects: nebula, small/big stars, frontier ignite, genesis core, full-screen vignette; additive blend; bakes frozen shells, keeps the frontier live; reads palette ramp + genes only.
- `src/styles/crystalline.ts` (created) — Crystalline techno-id StyleTemplate (`StyleTemplateSchema.parse`), ice-blue palette, facet → faceted primitive.
- `src/client/cosmos/reduced-motion.ts` (created) — `prefersReducedMotion` + `watch` via `matchMedia('(prefers-reduced-motion: reduce)')`.
- `src/client/cosmos/CosmosScene.ts` (modified) — `update()` re-renders only `shells[0]` (ignite pulse + twinkle scaled by `motion.speed`); delegates draw to `paint.ts`; static branch under reduced motion.
- `src/client/cosmos/primitives.ts` (modified) — added `addFacetStar` angular primitive (the Crystalline tell).
- `src/styles/index.ts` (modified) — exports `crystalline`.

## Decisions Made
- **Crystalline as a techno-id variant (no new StyleId).** Keeps `StyleIdEnum` unchanged and proves the architecture bet — a new look is a data file, not engine code (Open Q2).
- **Mock parity accepted within the 2-day dev-fixture limitation.** Full multi-shell side-by-side parity is deferred to plan 02-05, when the 30-day simulator is wired into the dev page and can be re-judged with real depth. (Human review note.)
- **Reduced-motion accepted on the basis of wiring.** `matchMedia` / `prefers-reduced-motion` are present and stop the loop; the human trusted this without a frame-by-frame strobe test. (Human review note.)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. All four gates (`type-check`, `lint`, `test` — 45 passed, `build`) green against the committed state. Build emitted pre-existing vite config warnings (`sourcemapFileNames`, `inlineDynamicImports` deprecation) that are unrelated to this plan and not errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Paint layer at mock parity and accessible; ready for plan 02-04 and 02-05 (style/genome selector + 30-day simulator wired into the dev page).
- **Open caveat for 02-05:** full multi-shell mock parity to be re-judged once the 30-day simulator feeds the dev page (currently a 2-day dev fixture).

## Self-Check: PASSED

- Files verified on disk: paint.ts, crystalline.ts, reduced-motion.ts, CosmosScene.ts
- Commits verified in git: 3d60b59, 7192974

---
*Phase: 02-visual-engine-simulator*
*Completed: 2026-06-19*

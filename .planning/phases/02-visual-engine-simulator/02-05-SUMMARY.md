---
phase: 02-visual-engine-simulator
plan: 05
subsystem: ui
tags: [phaser, vite, steering, determinism, simulator, render-handle]

# Dependency graph
requires:
  - phase: 02-02
    provides: generateDayVectors + the single DayVectorSchema.parse() boundary (the simulator)
  - phase: 02-04
    provides: CameraController + depth scrubber + always-visible HUD readout (scrub/focus is camera-only)
provides:
  - "Filled render() handle bodies (scrub/nudge/regenerate/destroy) delegating to the injected Painter — engine stays Phaser-free (ENG-04)"
  - "Frontier-only steering nudges (Scatter/Arms/Hue) that bias the steering MEAN via steerGain and re-synthesize only shells[0] (STR-01/STR-02)"
  - "Complete dev-page control harness wired end-to-end: scrubber, 3-up nudge grid, Regenerate, seed field with bad-seed fallback, Calm/Chaotic/Crystalline genome-preset selector (QA-01)"
  - "Render teardown: previous render torn down on preset switch / regenerate / seed commit (single HUD/canvas/rAF-loop/wheel-listener)"
affects: [Phase 3 Devvit Scaffold, Phase 4 Live Game (nudge → frontier re-synth, render handle seam)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render handle as the engine↔painter seam: render() delegates to the injected Painter, never importing phaser into src/engine"
    - "Steering biases the mean only — synthesis's seeded RNG dices the elements around the shifted mean (STR-02 invariant)"
    - "Frontier-only re-synth: a nudge re-runs synthesize for shells[0] and repaints only the live frontier layer; frozen shells stay baked"
    - "Single parse boundary preserved: main.ts wires the harness but never calls .parse() — validation stays inside the simulator (QA-03)"

key-files:
  created: []
  modified:
    - src/engine/render.ts
    - src/client/cosmos/PhaserPainter.ts
    - src/client/cosmos/CosmosScene.ts
    - src/client/cosmos-dev/main.ts
    - src/client/cosmos-dev/cosmos-dev.html
    - src/client/cosmos-dev/cosmos-dev.css

key-decisions:
  - "Nudge re-synthesizes ONLY the frontier (shells[0]) and biases the steering mean scaled by genome.steerGain — frozen shells are never re-baked (RESEARCH Pattern 5)"
  - "render.ts keeps a NOT_IMPLEMENTED error key as a defensive guard for the no-painter (headless) path — it is NOT an unfilled stub; all four handle bodies delegate to the Painter"
  - "Render teardown added so repeated preset switches / regenerates / seed commits leave exactly one HUD/canvas/rAF-loop/wheel-listener (post-checkpoint fix)"
  - "VIS-DEPTH and VIS-ANIM visual-quality enhancements deferred to a dedicated follow-up plan (out of scope for this slice)"

patterns-established:
  - "Engine↔painter seam: filled render() bodies delegate to the injected Painter with zero phaser import in src/engine"
  - "Steering = bias-the-mean: nudges shift steering.{branch|symmetry|hue} mean only; the RNG still dices the outcome"
  - "Lifecycle hygiene: every regenerate/preset/seed change tears down the prior render before mounting the next"

requirements-completed: [STR-01, STR-02, QA-01, ENG-04]

# Metrics
duration: ~14min (implementation) + checkpoint
completed: 2026-06-19
status: complete
---

# Phase 2 Plan 5: Steering Nudges + Complete Dev-Page Control Harness Summary

**Filled the render() handle seam (scrub/nudge/regenerate/destroy) delegating to the injected Painter with zero phaser in the engine, added frontier-only steering nudges that bias the mean, and wired the full standalone dev harness (scrubber, nudges, Regenerate, seed field, Calm/Chaotic/Crystalline preset selector) end-to-end through the simulator — the engine is now provably complete before any Reddit code.**

## Performance

- **Duration:** ~14 min implementation (21:40 → 21:54 CEST) + human-verify checkpoint + teardown fix + finalize
- **Started:** 2026-06-19T19:40:17Z
- **Completed:** 2026-06-19T20:14:00Z
- **Tasks:** 2 auto + 1 checkpoint (approved) + 1 deviation fix
- **Files modified:** 6 (per plan scope)

## Accomplishments

- **render() handle bodies filled (ENG-04):** `scrub(day) → painter.focus(day)`, `nudge(param, amount) → bias frontier steering mean (× steerGain) → re-synthesize shells[0] → painter.repaintFrontier`, `regenerate(days, genome) → re-synthesize whole Scene → painter.remount`, `destroy() → painter.destroy`. The engine stays Phaser-free (`grep -rnE "from '(phaser)" src/engine` → 0).
- **Steering nudges (STR-01/STR-02):** Scatter→branch, Arms→symmetry, Hue→hue. Each biases the frontier day's steering MEAN only; synthesis's seeded RNG still dices the element positions around the shifted mean (the outcome is biased, never dictated). Only the live frontier re-synthesizes — frozen shells stay baked.
- **Full dev harness wired (QA-01):** scrub row, "Shape today's frontier" 3-up nudge grid, Regenerate (new seed reflected in the field), seed field, and the Calm/Chaotic/Crystalline genome-preset selector — all driven through the Plan-02 simulator (`generateDayVectors`) and the render handle. The single `DayVectorSchema.parse()` boundary stays inside the simulator; main.ts never parses (`grep -rc ".parse(" src/client/cosmos` non-test → 0, QA-03).
- **Bad-seed fallback (V5 / T-02-13):** non-parseable seed input falls back to a random valid seed with the copy "That seed isn't valid — using a random one instead." — never a broken/blank canvas, zero console errors.
- **Render teardown fix:** previous render torn down on preset switch / regenerate / seed commit, leaving exactly one HUD/canvas/rAF-loop/wheel-listener.

## Task Commits

1. **Task 1: Fill render() handles + frontier-only nudge re-synthesis (STR-01/STR-02, ENG-04)** — `c82e30d` (feat)
2. **Task 2: Wire the full dev-page control harness end-to-end (QA-01)** — `99485af` (feat)
3. **Deviation fix: Tear down previous render on preset/regenerate/seed change** — `d81fb20` (fix)
4. **Task 3: Human-verify final demo** — APPROVED (for the plan's scope, after the teardown fix)

**Plan metadata:** this commit (docs: complete final demo plan + defer VIS-DEPTH/VIS-ANIM)

## Files Created/Modified

- `src/engine/render.ts` — filled the four handle bodies via the injected Painter (no phaser import); frontier-mean bias scaled by `steerGain`, frontier-only re-synth on nudge.
- `src/client/cosmos/PhaserPainter.ts` — implemented `repaintFrontier` (live frontier only), `remount` (clear + re-bake all shells), `focus` (camera), `destroy`.
- `src/client/cosmos/CosmosScene.ts` — the live frontier layer re-rendered on nudge; frozen shells stay baked.
- `src/client/cosmos-dev/main.ts` — full wiring: sim → render → canvas + nudge/Regenerate/seed/preset controls; bad-seed coercion; teardown on regenerate/preset/seed; no `.parse()`.
- `src/client/cosmos-dev/cosmos-dev.html` — control-harness DOM (nudge buttons, Regenerate, seed field, Genome selector).
- `src/client/cosmos-dev/cosmos-dev.css` — harness chrome (faceted buttons, 44px touch targets, accent reserve) per UI-SPEC.

## Verification Results (Final Demo Checkpoint — APPROVED)

Orchestrator verified via Playwright before approval:

- Full 30-shell universe renders; simulator wired end-to-end (dev-fixture removed); single `DayVectorSchema.parse` boundary intact; engine stays Phaser-free.
- Genome/style presets (Calm/Chaotic/Crystalline) visibly differ from the same seed.
- **Teardown fixed:** exactly one HUD/canvas/rAF-loop/wheel-listener after repeated preset switches, regenerates, and seed commits (transient overlap only under synchronous rapid-fire, settles immediately — acceptable for a dev page).
- **Seed determinism (QA-01/SIM-03) PROVEN:** seed A → world A; Regenerate → world B; re-enter seed A → identical world A (matching HUD metrics + nebula positions).
- **Bad-seed fallback (V5):** "abc" → friendly note "That seed isn't valid — using a random one instead." + random valid seed, no crash, zero console errors.
- **Steering nudges** re-synthesize only the live frontier; frozen shells stay baked (STR-01/STR-02).
- "symmetry symmetry" goal text deduped.

**Gate status at finalize (no code changes in this run):**

- `npm run type-check` → exit 0
- `npm run lint` → exit 0
- `npm test` → 7 files, 45 tests passed
- `npm run build` → exit 0 (build complete, only pre-existing deprecation warnings)

## Decisions Made

- Nudge biases the frontier steering MEAN only (× `genome.steerGain`) and re-synthesizes only `shells[0]`; frozen shells are never re-baked (RESEARCH Pattern 5; STR-02 invariant).
- `render.ts` retains a `NOT_IMPLEMENTED` error key as a defensive guard for the headless/no-painter path — this is intentional, not an unfilled stub. All four handle bodies are filled and delegate to the injected Painter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tear down previous render on preset/regenerate/seed change**
- **Found during:** Task 3 (human-verify final demo)
- **Issue:** Switching presets / regenerating / committing a seed mounted a new render without tearing down the prior one, accumulating duplicate HUD/canvas/rAF-loops/wheel-listeners.
- **Fix:** Destroy the previous render handle (and its listeners) before mounting the next one.
- **Files modified:** src/client/cosmos-dev/main.ts (and the painter destroy path)
- **Verification:** Playwright confirmed exactly one HUD/canvas/rAF-loop/wheel-listener after repeated switches; transient overlap only under synchronous rapid-fire, settles immediately.
- **Committed in:** `d81fb20`

---

**Total deviations:** 1 auto-fixed (1 bug — lifecycle hygiene)
**Impact on plan:** Necessary for correct repeated interaction; within plan scope (the dev harness). No scope creep.

## Issues Encountered

None beyond the teardown bug documented above (found and fixed during the checkpoint).

## Deferred to Follow-up Plan

Two visual-quality enhancements were raised during the final demo. They are **OUT OF SCOPE for this plan** and were NOT implemented here — the human chose to finalize 02-05 now and plan the visual enhancements separately. Recorded for a dedicated follow-up plan:

### VIS-DEPTH — Earlier/frozen days are not visually distinguishable

- **Root cause:** Shell radius spacing `radius = Math.pow(0.85, idx)` in `src/engine/synthesis.ts` compresses older shells into a tiny faint central blob. Per-day data variation EXISTS in synthesis and IS painted per shell, but it is spatially crushed.
- **Acceptance intent (follow-up):** Rework the depth/spacing geometry (engine contract `radius`) so earlier days read distinctly (+ likely per-shell brightness/size tuning), with determinism re-baselining + test updates, and a visual checkpoint vs `docs/subcosm-universe-mock.html`.

### VIS-ANIM — Frontier ignite pulse is uniform

- **Root cause:** The frontier ignite pulse is uniform: `pulse = 0.55 + 0.45*sin(time*0.0022*speed)` where `speed` is a StyleTemplate constant — so every day/community animates identically.
- **Acceptance intent (follow-up):** Make the animation data-driven — modulate pulse amplitude/speed (and possibly per-shell "life") from the day's metrics (conflict / energy / momentum) so different days and communities animate differently.

> NOTE: Per the human's instruction, paint/synthesis/animation code was NOT changed in this finalize run — only finalize + record the deferred items.

## User Setup Required

None — no external service configuration required (offline interactive slice, no network/auth/persistence).

## Next Phase Readiness

- **Engine is provably complete before any Reddit code** — synthesis → paint → camera → render handle all wired, deterministic, and demonstrated end-to-end through the simulator.
- Phase 3 (Devvit Scaffold) can proceed: the render handle seam and `generateDayVectors` boundary are the integration points the Redis data layer will later fill.
- Phase 3 pre-work blockers remain open (Devvit template name change, WebGL-in-iframe on mobile, web-view postMessage) — tracked in STATE.md.
- VIS-DEPTH and VIS-ANIM tracked as Planned-next follow-up work (Polish/Follow-up).

---
*Phase: 02-visual-engine-simulator*
*Completed: 2026-06-19*

## Self-Check: PASSED
- FOUND: src/engine/render.ts, PhaserPainter.ts, CosmosScene.ts, cosmos-dev/main.ts, cosmos-dev.html, cosmos-dev.css
- FOUND commits: c82e30d, 99485af, d81fb20
- Gates green: type-check 0, lint 0, test 45/45, build 0

---
phase: 02-visual-engine-simulator
plan: 04
subsystem: ui
tags: [phaser, camera, hud, input, pinch, scrub, accessibility]

# Dependency graph
requires:
  - phase: 02-visual-engine-simulator (plan 02-01)
    provides: PhaserPainter injection seam + CosmosScene + RenderHandle.scrub delegating to Painter.focus
  - phase: 02-visual-engine-simulator (plan 02-03)
    provides: mock-parity paint + baked frozen shells the camera flies through
provides:
  - CameraController (independent zoom/scrub/focus view state, reads Scene.radius, never writes Scene)
  - Input layer (depth slider + scroll-wheel + trackpad-pinch + hand-rolled two-pointer pinch + click-to-focus, all kept in sync)
  - Always-visible legible HUD readout (date/era/theme/stars/comments/contributors/conflict + frontier goal line + day-1 empty state)
  - CAM-04 embeddability design-review note (coordinate model stays multiverse-embeddable)
affects: [02-05 (30-day simulator wiring + full navigation re-judge), 03 (Devvit wiring), 04 (live frontier)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CameraController wraps cameras.main as the single owner of view state — scrub/focus are camera-only, never re-synthesize (CAM-01)"
    - "Hand-rolled two-pointer pinch via input.addPointer(1) — Phaser 4 has no built-in pinch (no plugin install, threat T-02-SC honored)"
    - "Trackpad pinch handled as ctrl+wheel with preventDefault to stop browser page-zoom"
    - "HUD sets every string via textContent (never innerHTML) — XSS-safe for Phase-3 real Reddit data (T-02-11)"
    - "Slider value and click-focus mirror each other through the same CameraController methods (single source of truth for focus day)"

key-files:
  created:
    - src/client/cosmos/camera.ts
    - src/client/cosmos/input.ts
    - src/client/cosmos-dev/hud.ts
  modified:
    - src/client/cosmos/CosmosScene.ts
    - src/client/cosmos/PhaserPainter.ts
    - src/client/cosmos-dev/main.ts
    - src/client/cosmos-dev/cosmos-dev.html
    - src/client/cosmos-dev/cosmos-dev.css

key-decisions:
  - "Trackpad pinch implemented as ctrl+wheel (deltaY) with preventDefault — the standard browser convention for pinch-to-zoom on trackpads; verified via Playwright (defaultPrevented=true + visible zoom)"
  - "Day-1 vs day-44 visual sameness is NOT a bug — root-caused to the 2-day dev-fixture; full depth fly-through re-judged in 02-05 with the 30-day simulator"
  - "CAM-04 recorded as a design-review note only (normalized/relative coords, no global singletons) — no multiverse implementation, just not designing it out"

patterns-established:
  - "View state lives only in the Phaser camera; the Scene is read-only from the imperative shell (CAM-01 determinism guard)"
  - "Hand-roll only where the framework genuinely lacks the primitive (pinch); use Phaser camera.zoom/zoomTo/centerOn everywhere else"

requirements-completed: [CAM-01, CAM-02, CAM-03, CAM-04]

# Metrics
duration: ~35min (incl. checkpoint + trackpad-pinch fix)
completed: 2026-06-19
status: complete
---

# Phase 02 Plan 04: Camera + Input + HUD Summary

**Navigable cosmos: a CameraController (zoom/scrub/focus, never mutating the Scene) driven by a depth slider + scroll-wheel + trackpad/two-pointer pinch + click-to-focus, with an always-visible legible HUD showing each shell's date/era/theme/stats and the frontier goal line.**

## Performance

- **Duration:** ~35 min (across implementation + human-verify checkpoint + trackpad-pinch fix)
- **Completed:** 2026-06-19
- **Tasks:** 2 auto tasks + 1 human-verify checkpoint (approved) + 1 fix
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- `CameraController` wrapping `cameras.main`: `scrub(day)` eases zoom/scroll toward the shell's `radii[day]` target, `focusShell(day)` centers+zooms a clicked shell, `zoom(delta)` clamps `camera.zoom` (1..7). Reads `Scene.shell.radius` for depth→day mapping; never writes the Scene and never re-synthesizes (CAM-01 verified: 0 Scene-field assignments, 0 `synthesize` calls in camera.ts).
- Input layer: depth slider + scroll-wheel (deltaY) + trackpad pinch (ctrl+wheel) + hand-rolled two-pointer pinch (`input.addPointer(1)`, distance-delta → zoom) + click/tap-to-focus, all kept in sync (slider thumb follows click-focus and vice versa).
- Always-visible HUD (`hud.ts`): reads `Scene.shells[focus].meta` (date/era/theme/stars/comments/contributors/conflict), set entirely via `textContent` (0 `innerHTML`); FRONTIER/BIG BANG badges; gold "Goal: …" line on the frontier day from `Genome.dailyGoal`; "Day 1 — the first post" designed empty state (never an error).
- CAM-04 embeddability design-review note recorded in `camera.ts` (normalized/relative coords, no global singletons → future outer multiverse zoom tier not designed out).

## Task Commits

1. **Task 1: CameraController + input layer (scrub/zoom/focus, kept in sync)** — `45fb169` (feat)
2. **Task 2: Always-visible HUD readout + depth scrub slider, wired to camera** — `1e18f87` (feat)
3. **Fix (post-checkpoint): trackpad pinch (ctrl+wheel) zoom + correct wheel deltaY axis** — `846d0ce` (fix)

_Task 3 was the human-verify checkpoint — APPROVED after the trackpad-pinch fix, no code commit of its own._

**Plan metadata:** `docs(02-04): complete camera + input + HUD plan`

## Files Created/Modified
- `src/client/cosmos/camera.ts` — CameraController (CAM-01/CAM-02) + CAM-04 embeddability note
- `src/client/cosmos/input.ts` — slider/wheel/trackpad-pinch/two-pointer-pinch/click-to-focus, kept in sync
- `src/client/cosmos-dev/hud.ts` — always-visible textContent HUD reading ShellMeta + frontier goal line + day-1 empty state
- `src/client/cosmos/CosmosScene.ts` — camera + input wiring into the Scene
- `src/client/cosmos/PhaserPainter.ts` — `Painter.focus(day)` drives the camera (RenderHandle.scrub seam)
- `src/client/cosmos-dev/main.ts` — wires slider/focus → HUD updates; passes Genome for the goal line
- `src/client/cosmos-dev/cosmos-dev.html` / `cosmos-dev.css` — scrub slider chrome (TODAY ··· BIG BANG), translucent+blur, ≥4.5:1 contrast, 44px touch row

## Decisions Made
- **Trackpad pinch = ctrl+wheel:** the browser convention for trackpad pinch-to-zoom; handled with `preventDefault` so the page itself does not zoom. Verified via Playwright (`defaultPrevented=true` + a visible cosmos zoom).
- **Day-1 vs day-44 sameness is expected with the dev-fixture, not a bug** (see Issues Encountered).
- **CAM-04 is a note, not an implementation** — coordinate model kept embeddable for the post-MVP multiverse tier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trackpad pinch did not zoom + wheel handler read the wrong axis**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** Trackpad pinch (ctrl+wheel) did nothing and triggered browser page-zoom; separately, the old `POINTER_WHEEL` handler read `deltaX` instead of `deltaY`, so mouse-wheel zoom was bound to the wrong axis.
- **Fix:** Added a ctrl+wheel handler mapping `deltaY` → `camera.zoom` with `preventDefault`; corrected the wheel handler to read `deltaY`.
- **Files modified:** src/client/cosmos/input.ts
- **Verification:** Playwright (orchestrator) confirmed `defaultPrevented=true` and a visible zoom; human approved.
- **Committed in:** `846d0ce` (fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug, surfaced at the human-verify checkpoint).
**Impact on plan:** Necessary for correct navigation behavior. No scope creep — camera/paint/style behavior otherwise unchanged.

## Issues Encountered
- **"Graphic looks the same at day 1 vs day 44" — root-caused, NOT a bug (human review).** With the 2-day dev-fixture, `zoomTargetFor = 0.34 / radius` and synthesis `radius = 0.85^idx` mean both fixture shells (idx 0 `r=1.0`, idx 1 `r=0.85`) clamp to `MIN_ZOOM` 1×; only shells with `radius < 0.34` (index ≳ 7) zoom in. With the 30-day simulator wired in plan **02-05**, deep shells (e.g. day 1 at idx 29, `r≈0.009`) will zoom toward `MAX_ZOOM` 7× — the real depth/time fly-through. **Re-judge the full navigation feel in 02-05.**

## Human Review Notes (checkpoint approval)
- **Trackpad pinch:** fixed (`846d0ce`) and verified — ctrl+wheel zooms the cosmos, `preventDefault` stops browser page-zoom; orchestrator confirmed `defaultPrevented=true` + visible zoom via Playwright. Incidental bug also fixed: old `POINTER_WHEEL` handler read `deltaX` instead of `deltaY`.
- **Day-1/day-44 sameness:** not a bug — fixture-bound (see Issues Encountered); re-judge in 02-05.
- **HUD:** always-visible, legible, correct per-day fields, frontier goal line, genesis cold-start copy — all confirmed.
- **Instruction:** do NOT change camera/paint/style code — current behavior approved; finalize only.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Navigation + legibility slice complete (CAM-01..04, SC-2, D-01/D-02). Ready for plan **02-05** (30-day simulator wiring), which will re-judge the full depth fly-through with deep shells that actually exercise the 1×→7× zoom range.
- No blockers introduced. Camera/HUD read the Scene only — determinism (CAM-01) intact.

## Self-Check: PASSED
- camera.ts, input.ts, hud.ts and all 5 modified files present on disk.
- Commits 45fb169, 1e18f87, 846d0ce all in git history on master.
- Gates green: type-check 0, lint 0, test 45/45, build complete.

---
*Phase: 02-visual-engine-simulator*
*Completed: 2026-06-19*

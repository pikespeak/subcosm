---
phase: 04-live-game
plan: 05
subsystem: engine
tags: [scoring, steering, determinism, zod, vitest, game-03, invariant-i5]

# Dependency graph
requires:
  - phase: 04-live-game (04-01)
    provides: pure score()/measure()/degreeBounds() spine + Outcome contract + achievability spreads
  - phase: 04-live-game (04-02)
    provides: tick foldSteering — aggregate MEAN × steerGain folded into frozen DayVector.steering exactly once (OQ3/D-08)
provides:
  - "score() reads the already-folded day.steering as a BOUNDED, direction-aware contribution to measured (GAME-03 steering→outcome link is now REAL, not just a HUD readout)"
  - "STEER_BIAS_CAP = 0.15 (fraction of per-goal degree span) — the I-5 bound encoded so steering moves only BORDERLINE days, never flips a clear day"
  - "proving tests: borderline-moves (both directions) + never-dictates bound (±10 extreme) + determinism, per genome"
affects: [re-verification of GAME-03, REQUIREMENTS.md GAME-03 reconciliation, any future steering/scoring change]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded direction-aware bias: saturate lever to [-1,1] → scale by STEER_BIAS_CAP × goal-span → hard-clamp to [-cap,+cap]; ADD for direction 'above', SUBTRACT for 'below'"
    - "Activity base unchanged; steering is an additive bounded offset applied in score() after measure(), re-clamped to the metric's own axis"

key-files:
  created: []
  modified:
    - src/engine/score.ts
    - src/engine/score.test.ts

key-decisions:
  - "SUPERSEDES 04-02 decision 'the scored targetParam measure does NOT depend on day.steering': GAME-03 requires the steering→outcome coupling that decision deferred; the user chose 'make steering matter'. score() now reads day.steering."
  - "Lever mapping: symmetry goal → day.steering.symmetry; density/conflict goals → day.steering.branch; hue is never a scored lever; unknown targetParam → 0 offset"
  - "STEER_BIAS_CAP = 0.15 as a FRACTION of the per-goal degree span (conflict/density span 1.0 → ±0.15; symmetry span 4 arms → ±0.6); chosen so a borderline day (within the cap of the threshold) flips while a clearly-failed/achieved day (beyond the cap) cannot — I-5: biases the mean, never dictates"
  - "A POSITIVE lever is universally the toward-goal nudge (helps); direction-awareness lives in steerContribution, not the test, so the sign convention is consistent across all three goals"
  - "steerGain is NOT re-applied in score.ts (grep -c steerGain == 0): the tick's foldSteering already applied it once before score() runs — re-applying would double-count and break the single-fold OQ3/D-08 guarantee"

patterns-established:
  - "Saturate-then-clamp bias: an extreme/hostile folded value can never exceed the bound (defense-in-depth over the upstream amount∈[-1,1] route clamp)"
  - "measured may be a real number on the symmetry arm axis after the offset; degree already tolerates non-integers — no contract change needed"

requirements-completed: [GAME-03]

# Metrics
duration: ~25min
completed: 2026-06-22
status: complete
---

# Phase 4 Plan 05: GAME-03 Gap Closure Summary

**score() now reads the already-folded `day.steering` as a bounded, direction-aware contribution to `measured` — a nudge measurably moves a borderline day's achieved/degree both directions, hard-clamped to STEER_BIAS_CAP so it can never flip a clear day (I-5: biases the mean, never dictates).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-22T06:31Z (approx)
- **Completed:** 2026-06-22T06:35Z
- **Tasks:** 3 (2 implementation + 1 DoD gate run)
- **Files modified:** 2 (src/engine/score.ts, src/engine/score.test.ts)

## Accomplishments

- Closed the single phase-04 verification blocker **GAME-03**: the scored metric (`conflict`/`density`/`symmetry`) now genuinely moves with the aggregated steer, so a nudge changes the achieved/degree verdict, not just the visual frontier + HUD readout.
- Encoded invariant **I-5** as a hard bound (`STEER_BIAS_CAP = 0.15` × per-goal span, saturate-then-clamp): steering crosses only BORDERLINE days; a clearly-failed day stays failed and a clearly-achieved day stays achieved even under EXTREME (±10) steering — proven per genome.
- Preserved determinism + engine purity: no `Math.random`, no Devvit, no I/O; `score()`/`measure()` signatures and the `Outcome` contract unchanged; `steerGain` is NOT re-applied (no double-count).
- Full DoD gate suite green: 246 tests (was 231; +15 new), type-check clean, lint clean (engine-purity guard passes), build succeeds.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the bounded steering contribution to measure()/score()** — `f661780` (feat)
2. **Task 2: Prove GAME-03 + the I-5 bound + determinism in score.test.ts** — `816d5f9` (test)
3. **Task 3: Run the full Definition-of-Done gate suite** — no code change (verification-only; all four gates green)

_Note: Task 1 (tdd) is a single feat commit — the implementation kept the existing 17 score tests green (zero-steering days produce a zero offset), and Task 2 added the RED→GREEN proving tests for the new behavior._

## Files Created/Modified

- `src/engine/score.ts` — added exported `STEER_BIAS_CAP = 0.15`; added pure `steerContribution(goal, day)` (lever select → saturate to [-1,1] → scale by per-goal cap → direction-aware → hard-clamp to [-cap,+cap]); `score()` adds the offset to the activity base from `measure()`, then re-clamps (conflict/density via `clamp01`, symmetry left on the arm axis). Reads `day.steering` directly with no steer-gain re-application.
- `src/engine/score.test.ts` — new `describe('score — steering → outcome link (GAME-03)')` block: POSITIVE borderline flip + measured-moves-both-directions (per genome); BOUND/never-dictates under ±10 extreme steering (per genome, clear-failed stays false, clear-achieved stays true); explicit cap test (shift ≤ STEER_BIAS_CAP × span); DETERMINISM (deep + JSON equal) for a non-zero-steering day; zero-steering no-op.

## Decisions Made

- **Reversed the documented 04-02 decision** ("the scored targetParam measure ... does NOT depend on day.steering"). 04-02 deliberately kept the scored metric activity-only, showing the contribution only via the visual frontier + HUD readout. GAME-03 / the phase goal require the actual steering→OUTCOME coupling, and the user chose "make steering matter." This plan implements exactly that coupling, within the I-5 bound and the determinism/purity hard rules. The superseded decision is recorded here so the planning history stays coherent (advisory note 2).
- **Lever mapping** (direction-aware so a nudge moves the outcome both ways): symmetry goal → `day.steering.symmetry` (the "make it more faceted" lever); density goal → `day.steering.branch` (structural spread populates the frontier → raises measured density); conflict goal → `day.steering.branch` (loosens/tightens structure). `hue` is never a scored lever; unknown targetParam → 0 (safe fallback).
- **STEER_BIAS_CAP = 0.15 [ASSUMED]** as a fraction of the per-goal degree span. Verified numerically against the 04-01 achievability spreads: calm borderline conflict 0.45 → −0.15 = 0.30 < 0.40 (flips); chaotic borderline 80 posts → normalized 0.648 → +0.15 = 0.798 > 0.70 (flips); crystalline borderline 5 arms → +0.6 = 5.6 > 5 (flips). Clear days (calm 0.95, chaotic 5 posts, crystalline 4 arms / calm 0.05, chaotic 350 posts, crystalline 6 arms) all stay put under the cap.

## Deviations from Plan

None - plan executed exactly as written.

(Note on an acceptance-criterion nuance, not a deviation: the plan's Task 1 criterion is `grep -c 'steerGain' src/engine/score.ts == 0`. The first doc-block draft mentioned "steerGain" conceptually three times; reworded the comments to "the per-param steer gain" / "the steer gain" so the literal token count is 0 while the meaning — no re-application — is preserved. No behavior change.)

## Issues Encountered

None. The STOP clause (advisory note 1 / `the_fix_design`: "if the HUD frontier does not carry folded steering at the moment of scoring, STOP") was checked and did NOT trigger — `tick.ts foldSteering` writes the folded mean onto `day.steering` before `score()`, and the live acting-user re-synth (`render.ts`) folds the nudge into `shells[0].steering`, which the HUD scores. No UI scope was added; `hud.ts`/`game.ts`/`tick.ts`/`synthesis.ts`/genomes were not touched.

## Superseded Decision (planning-history record)

- **Superseded:** 04-02-SUMMARY decision — "The scored targetParam measure (conflict/density/arms) is activity-driven and does NOT depend on day.steering."
- **By:** this plan (04-05) — `score()` now reads the already-folded `day.steering` as a bounded contribution. Reason: GAME-03 / phase-goal require the steering→outcome link; user chose to make steering matter. The I-5 invariant (biases, never dictates) is preserved by the STEER_BIAS_CAP clamp.

## Next Phase Readiness

- GAME-03 implementation + proof is complete. **REQUIREMENTS.md GAME-03 was deliberately NOT flipped here** (advisory note 3) — that reconciliation (and the ROADMAP/REQUIREMENTS "Complete vs Pending" inconsistency noted in 04-VERIFICATION.md) happens at gap-closure re-verification, handled by the orchestrator after this return.
- No blockers. The four on-device human-verify items from 04-VERIFICATION (criteria 4–6 + realtime) remain routed to UAT and are unaffected by this change.

## Self-Check: PASSED

- FOUND: src/engine/score.ts
- FOUND: src/engine/score.test.ts
- FOUND: .planning/phases/04-live-game/04-05-SUMMARY.md
- FOUND commit: f661780 (Task 1 feat)
- FOUND commit: 816d5f9 (Task 2 test)

---
*Phase: 04-live-game*
*Completed: 2026-06-22*

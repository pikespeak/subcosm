---
phase: 04-live-game
plan: 01
subsystem: engine-scoring
tags: [scoring, determinism, zod, redis-round-trip, game-loop]
requires:
  - DayVectorSchema / RingRecordSchema (Phase 1 contracts)
  - DailyGoalSchema on Genome (Phase 1)
  - synthesis.ts starCount + arms heuristic (Phase 1/2)
  - runTick + ring.ts (Phase 3)
provides:
  - OutcomeSchema / Outcome (typed scoring result, z.infer)
  - score(day, genome) → Outcome (pure deterministic scorer)
  - starCount + deriveArms exported from synthesis (one source of truth)
  - DayVector.outcome firmed to OutcomeSchema.optional()
  - 'outcome' in ring.ts JSON_FIELDS (lossless Redis round-trip)
  - runTick now scores + persists outcome on every frozen ring
affects:
  - downstream Phase-4 plans (HUD tracking, reveal post, reward glyph) read this outcome
tech-stack:
  added: []
  patterns:
    - "Pure-engine scorer mirrors synthesis purity discipline (no rng / no Devvit / no I/O)"
    - "Score re-uses synthesis derivations (starCount/deriveArms) — never re-derives"
    - "Single build-boundary parse at the tick; outcome trusted as pure engine output"
key-files:
  created:
    - src/engine/contracts/Outcome.ts
    - src/engine/contracts/Outcome.test.ts
    - src/engine/score.ts
    - src/engine/score.test.ts
  modified:
    - src/engine/contracts/DayVector.ts
    - src/engine/contracts/index.ts
    - src/engine/contracts/contracts.test.ts
    - src/engine/synthesis.ts
    - src/server/core/tick.ts
    - src/server/core/ring.ts
    - src/server/core/ring.test.ts
    - src/server/core/tick.test.ts
decisions:
  - "DENSITY_NORM_CAP=55 normalizes starCount [STAR_FLOOR..55] so the Chaotic density>0.7 goal is reachable-but-not-automatic over the sim arc (drama ~0.76 achieves, mid/quiet miss) — tuned the normalization, NOT the locked genome thresholds (D-01)"
  - "Crystalline symmetry>5 needs deriveArms=6, which requires posts>300 (the gentle sim arc maxes ~90) — proven reachable-but-not-automatic via explicit constructed busy/normal days; behaviour-preserving (deriveArms extraction did not change synthesis output)"
  - "degree = clamp01(|signed distance to threshold| / per-goal span), monotonic for BOTH achieved and missed; symmetry uses a ±2 arm span, conflict/density use the 0..1 axis"
  - "runTick resolves the FULL genome (one config read) not just the version, so version (seed) + dailyGoal (scoring) come from one read"
metrics:
  duration: ~12min
  completed: 2026-06-21
  tasks: 3
  files: 12
status: complete
---

# Phase 4 Plan 01: Deterministic Scoring Spine Summary

Built the deterministic-scoring spine of the live game: a typed `OutcomeSchema`, a PURE `score(day, genome) → Outcome` engine module that re-uses synthesis's own `starCount`/`deriveArms` math, wired into the existing idempotent `runTick`, with the Redis `outcome` round-trip fixed — so a frozen ring now carries a real achieved/degree verdict any client can re-derive byte-identically (GAME-02, LIVE-03).

## What Was Built

**Task 1 — Outcome contract + firm DayVector.outcome** (`cccc863`)
- `OutcomeSchema = { goal: DailyGoalSchema, measured: number, achieved: boolean, degree: number∈[0,1] }`, z.infer `Outcome` type (no hand-written interface), i18n error keys on the degree bounds.
- Replaced `DayVector.outcome: z.unknown().optional()` with `OutcomeSchema.optional()`; barrel re-exports `./Outcome`.
- `Outcome.test.ts`: valid parse, degree out-of-range rejection, absent-`achieved` rejection, DayVector round-trip (valid / omitted / malformed).

**Task 2 — Pure scorer re-using synthesis derivations** (`43e3b4b`)
- Exported `starCount`; extracted the inline arms expression into an exported pure `deriveArms(day, genome)` and called it from `synthesize` — one source of truth, **synthesis golden snapshot byte-unchanged** (verified).
- `score.ts` (PURE: no `Math.random`, no Devvit, no I/O): `measure(targetParam, …)` switch — `conflict` → `day.conflict`; `density` → normalized `starCount` over `[STAR_FLOOR, DENSITY_NORM_CAP]`; `symmetry` → `deriveArms`. Direction-aware `achieved`; monotonic clamped `degree`.
- `score.test.ts`: determinism (deep + byte equal), re-use, degree∈[0,1] for all goals, and the OQ1 achievability assertions across the simulator arc + constructed busy days.

**Task 3 — Wire scoring into runTick + fix the outcome Redis round-trip** (`3484f30`)
- Added `'outcome'` to `JSON_FIELDS` in `ring.ts` so the scoring object JSON-parses on read (Pitfall 5 / T-04-01) instead of hitting `Number()` → NaN.
- `runTick` now resolves the full `Genome` (one config read), builds the `DayVector` once, `score()`s it (one-shot pure call), and parses the same object spread with `{ outcome, genomeVersion }` at the single build boundary. Idempotency guard + reset/lastTickDay ordering unchanged (D-08).
- Extended `ring.test.ts` (outcome round-trip deep-equals) and `tick.test.ts` (outcome present, equals `score()` re-derived from the stored ring).

## Achievability (OQ1) — Proven

| Genome | Goal | Achieved on | Missed on |
|--------|------|-------------|-----------|
| Calm | conflict below 0.4 | most quiet/growth sim days (conflict 0.02–0.30) | drama day-12 (~0.90), day-11 (~0.44) |
| Chaotic | density above 0.7 (normalized) | drama/peak days (~46 stars → ~0.76) | mid + quiet days (≤ ~0.51) |
| Crystalline | symmetry above 5 | a genuinely busy day (posts>300 → 6 arms) | normal/drama days (5 / 4 arms); whole gentle sim arc |

Each goal is reachable-but-not-automatic — never all-✓ or all-✗.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test] Updated two pre-existing tests for the firmed OutcomeSchema**
- **Found during:** Task 3 (full suite run after wiring).
- **Issue:** `contracts.test.ts` asserted `outcome: { score: 7 }` parsed (valid under the old `z.unknown()` placeholder, invalid under `OutcomeSchema`); `tick.test.ts`'s manual deserialize mapper treated `outcome` as a numeric scalar (`Number()` → NaN) once the tick began writing it.
- **Fix:** `contracts.test.ts` now asserts a valid Outcome object parses; `tick.test.ts` deserialize mapper JSON-parses `outcome` alongside `topThreads`/`steering`.
- **Files modified:** `src/engine/contracts/contracts.test.ts`, `src/server/core/tick.test.ts`.
- **Commit:** `3484f30`.

Both were directly caused by this plan's contract firming + tick wiring (in scope, Rule 1).

## Verification

- `npx vitest run src/engine/score.test.ts src/engine/synthesis.test.ts src/engine/contracts src/server/core/ring.test.ts src/server/core/tick.test.ts` — 87 tests green.
- `npm test` (full suite) — **199 tests green**.
- `npm run type-check` (tsc --build) — clean.
- `npm run lint` (eslint) — clean (zero `Math.random` / Devvit-import violations under `src/engine/`).
- Synthesis golden snapshot unchanged (deriveArms extraction is behaviour-preserving).

## Known Stubs

None — the scorer is fully wired into the tick and the outcome round-trips losslessly.

## Threat Flags

None — no new security surface. T-04-01 (outcome round-trip tampering) is mitigated via the JSON_FIELDS fix + the single read-boundary `RingRecordSchema.parse`; T-04-03 (scorer determinism) is mitigated by the pure-engine boundary (no rng/I-O). No new packages installed (T-04-SC).

## Self-Check: PASSED

- Files created exist: `Outcome.ts`, `score.ts`, `score.test.ts` — all FOUND.
- Commits exist: `cccc863`, `43e3b4b`, `3484f30` — all FOUND.

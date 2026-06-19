---
phase: 02-visual-engine-simulator
plan: 02
subsystem: sim
tags: [simulator, zod, determinism, mulberry32, dayvector, tdd, beats]

# Dependency graph
requires:
  - phase: 01-engine-foundation
    provides: "DayVectorSchema Zod contract, mulberry32 seeded PRNG"
  - phase: 02-visual-engine-simulator
    plan: 01
    provides: "src/sim build coverage (tsconfig.sim.json + Phaser-ban ESLint block), placeholder barrel"
provides:
  - "generateDayVectors(config): DayVector[] — the scripted ~30-day seeded story (cold-start -> growth -> drama -> AMA -> quiet)"
  - "src/sim/beats.ts — the tunable 30-day beat table as DATA (per-day means + jitter)"
  - "The single DayVectorSchema.parse() boundary for Phase 2 simulated input (SIM-02/QA-03)"
  - "tools/tsconfig.sim-tests.json — type-checks/lints src/sim/*.test.ts (mirrors styles-tests)"
affects: [02-03-paint-parity, 02-04-camera, 02-05-steering-chrome, "src/client/cosmos-dev/dev-fixture.ts (canonical replacement)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Simulator parse-at-OUTPUT boundary: generateDayVectors builds raw days from beats, then DayVectorSchema.parse() validates each ONCE at the output — the single parse site for the phase, never inside synthesis/paint/frame loop"
    - "Beat table as tunable DATA (mirrors genome preset modules): the story arc is a typed const array of per-day means + jitter; the seed dices values WITHIN each beat (D-03), never dictates the shape"
    - "Two-layer mulberry32 seeding: master RNG yields one float per day, mixed with a day salt into a signed 32-bit per-day seed — reused engine PRNG only, zero Math.random (SIM-03 byte-determinism)"

key-files:
  created:
    - src/sim/beats.ts
    - src/sim/generator.ts
    - src/sim/beats.test.ts
    - src/sim/generator.test.ts
    - tools/tsconfig.sim-tests.json
  modified:
    - src/sim/index.ts
    - tsconfig.json
    - eslint.config.js

key-decisions:
  - "30-day arc with drama spike on day 12 and AMA on day 20 (D-03 discretion); encoded as data in beats.ts so positions are tunable without code change"
  - "Per-day seed = mulberry32(master())^daySalt, signed 32-bit — deterministic, schema-int-valid; day number salts the master draw so reordering can't collide"
  - "AMA day is distinguished from the drama day by HUGE clusters (max topThreads >= 1000 vs drama's ~820); the SIM-01 test asserts on this distinctive data signature, not on beat indices"
  - "Fixed default start date (2026-01-01) instead of Date.now() — a runtime clock would break SIM-03 byte-determinism; callers may override via config.startDate"
  - "Added tools/tsconfig.sim-tests.json + wired it into root tsconfig references and the eslint sim parserOptions — the sim source project excludes *.test.ts (like styles), so without it the new test files would fail typed-linting/type-check"

patterns-established:
  - "Simulator output-boundary discipline: the canonical DayVector[] source for plans 02-03/04/05 and the eventual replacement of dev-fixture.ts"

requirements-completed: [SIM-01, SIM-02, SIM-03, QA-02, QA-03]

# Metrics
duration: 5min
completed: 2026-06-19
status: complete
---

# Phase 2 Plan 02: Deterministic Activity Simulator Summary

**`generateDayVectors(config)` now produces a scripted, seed-deterministic ~30-day community story (cold-start -> growth -> drama spike -> AMA -> quiet) by dicing values WITHIN a tunable beat table via the reused mulberry32 PRNG, validated exactly once at its output boundary by DayVectorSchema.parse() — the single parse site for the whole phase, with zero Math.random.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-19 (from plan-01 docs commit 3aee201)
- **Completed:** 2026-06-19
- **Tasks:** 2 completed (2 commits — TDD RED -> GREEN; no refactor needed)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- Delivered the data simulator that makes `Regenerate` + the seed field real: `generateDayVectors({ seed })` emits the full scripted ~30-day `DayVector[]` story arc.
- Proved the three guarantees via TDD (tests written first, RED, then GREEN): SIM-03 determinism (same seed -> byte-identical array, asserted both `toEqual` and `JSON.stringify`), SIM-03 sensitivity (different seeds diverge), SIM-02 schema-validity (every day passes `DayVectorSchema.parse`), and SIM-01 beats (exactly one drama, exactly one AMA, a safe cold-start, quiet days).
- Encoded the D-03 story arc as a tunable DATA table (`beats.ts`): per-day means + jitter; the seed dices WITHIN each beat so a regenerate stays well-told.
- Held the architecture invariant: the single `DayVectorSchema.parse()` lives only at the generator output (`grep -rc` confirms exactly one non-test parse site in all of `src/sim`), reuses `mulberry32` (5 references) and contains zero `Math.random` (`grep -rE "Math\\.random" src/sim` = 0).
- Closed a build-topology gap left from plan 01: added `tools/tsconfig.sim-tests.json` (mirroring `tsconfig.styles-tests.json`) so the new sim test files are type-checked and typed-linted.

## Task Commits

1. **Task 1 (RED):** `a86585b` (test) — failing determinism + schema-validity + beats tests against the not-yet-existing generator/beats; plus the sim-tests tsconfig wiring so the tests lint/type-check.
2. **Task 2 (GREEN):** `1361099` (feat) — `beats.ts` + `generator.ts` + `index.ts` barrel; AMA-day test predicate tightened to the distinctive huge-cluster threshold.

_TDD task split RED -> GREEN per the gate; no refactor commit required (implementation was clean on first GREEN)._

## Files Created/Modified

**Created:**
- `src/sim/beats.ts` — the tunable 30-day beat table as DATA: `Beat`/`BeatKind` types + a `readonly Beat[]` with per-day means (posts, comments-per-post, contributors, conflict, diversity, topThreads) + `jitter`. Day-1 cold-start, growth ramp, drama spike day 12, AMA day 20, quiet tail.
- `src/sim/generator.ts` — `generateDayVectors(config)`: derives per-day seeds from the master seed via `mulberry32`, dices each day within its beat, computes momentum vs the previous day, guards cold-start `topThreads` non-empty (Pitfall 5), neutral steering, `outcome` undefined, and applies the single `DayVectorSchema.parse()` at the output.
- `src/sim/beats.test.ts` — pins the arc shape on the table (cold-start first, exactly one drama, exactly one AMA, growth+quiet present, ascending positive days).
- `src/sim/generator.test.ts` — SIM-03 determinism (toEqual + JSON.stringify) + sensitivity, SIM-02 schema-validity, SIM-01 beats asserted on OUTPUT data.
- `tools/tsconfig.sim-tests.json` — type-checks `src/sim/**/*.test.ts` (the sim source project excludes test files).

**Modified:**
- `src/sim/index.ts` — barrel now re-exports `generateDayVectors`/`SimConfig` + `beats`/`Beat`/`BeatKind` (was a placeholder `export {}`).
- `tsconfig.json` — added the `tsconfig.sim-tests.json` project reference.
- `eslint.config.js` — added `tsconfig.sim-tests.json` to the sim block's `parserOptions.project`.

## Decisions Made
- **AMA vs drama distinguishability:** the SIM-01 AMA test originally matched any day with a `>=300` cluster and `<=5` threads — which also caught growth/drama days (7 matches). Tightened the assertion (and kept it data-driven) to `Math.max(topThreads) >= 1000`, the AMA day's distinctive signature, so it matches exactly the AMA day. The implementation was correct; the test predicate was over-loose.
- **Deterministic dates:** used a fixed default `startDate` (2026-01-01) computed in UTC; a runtime clock would silently break byte-determinism. Override available via `config.startDate`.
- **Per-day seed derivation:** salted the master RNG draw with the day number so the per-day sequence is stable and collision-resistant, yielding a signed 32-bit int that satisfies `z.number().int()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sim test files had no type-check/lint project**
- **Found during:** Task 1 (RED). The sim source project (`tsconfig.sim.json`) excludes `*.test.ts`, and the ESLint sim block's `parserOptions.project` listed no sim-tests project — so the new `src/sim/*.test.ts` files would fail typed-linting ("file not included in any project") and never type-check, blocking the green gate the plan requires.
- **Fix:** Created `tools/tsconfig.sim-tests.json` mirroring the existing `tsconfig.styles-tests.json`, and wired it into the root `tsconfig.json` references + the eslint sim block. This is the exact build-topology pattern plan 01 established for styles.
- **Files modified:** `tools/tsconfig.sim-tests.json` (new), `tsconfig.json`, `eslint.config.js`.
- **Verification:** `npm run type-check` + `npm run lint` both exit 0 with the test files covered.
- **Committed in:** `a86585b` (with the RED tests, since it is what makes them lintable).

**2. [Test refinement] AMA-day test predicate tightened** — see Decisions Made. Not a behavior change; the over-loose assertion was sharpened to a distinctive data signature.
- **Committed in:** `1361099`.

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking build topology) + 1 test refinement. **Impact:** both necessary for a green TDD gate; no scope creep — the sim-tests tsconfig simply completes the per-area test-project pattern already used for engine + styles.

## Issues Encountered
None beyond the deviations above. No stray build artifacts emitted into the source tree (checked `git status` for `src/**/*.{js,d.ts,map}` — none).

## User Setup Required
None — the simulator is a pure offline data module (no network, no persistence, no new packages). All dependencies (zod, vitest, engine rng) were pre-installed and CI-green from Phase 1.

## Next Phase Readiness
- **Ready:** plans 02-03/04/05 can now consume `generateDayVectors({ seed })` as the canonical `DayVector[]` source instead of the throwaway `src/client/cosmos-dev/dev-fixture.ts`; the seed field + Regenerate are real.
- **Hand-off:** the single `DayVectorSchema.parse()` boundary is established; downstream paint/camera/steering must NOT add new parse sites in synthesis/paint/the frame loop (QA-03 invariant verified by grep).
- **No blockers.**

## Threat Model Verification
- **T-02-04 (malformed sim output):** mitigated — exactly one `DayVectorSchema.parse()` non-test site in `src/sim` (generator output); a malformed day surfaces a structured Zod error, not a silent NaN.
- **T-02-05 (non-determinism):** mitigated — `grep -rE "Math\\.random" src/sim` = 0; only `mulberry32` is used; the SIM-03 test asserts byte-identical output for the same seed.
- **T-02-06 (cold-start empty topThreads):** mitigated — day-1 emits `topThreads: [8]` (floored at 1 in the generator); the SIM-01 cold-start test asserts a non-empty, empty-array-safe topThreads.
- **T-02-SC (package installs):** no new packages added.

## Self-Check: PASSED

All 5 created files present on disk (`src/sim/{beats,generator,beats.test,generator.test}.ts`, `tools/tsconfig.sim-tests.json`); both task commits (`a86585b`, `1361099`) exist in history. Final gate: type-check + lint + full test suite (45 passing) + build all green. Acceptance greps: `DayVectorSchema.parse` in generator.ts = 1; sole non-test parse site in src/sim = generator.ts; `mulberry32` in generator.ts = 5; `Math.random` in src/sim = 0.

---
*Phase: 02-visual-engine-simulator*
*Completed: 2026-06-19*

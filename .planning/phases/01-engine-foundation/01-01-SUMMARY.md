---
phase: 01-engine-foundation
plan: 01
subsystem: engine
tags: [zod, vitest, typescript-project-references, eslint-flat-config, contracts, determinism]

# Dependency graph
requires: []
provides:
  - zod@4.4.3 + vitest@4.1.9 installed; "test": "vitest run" script
  - Isolated src/engine/ TS project (tools/tsconfig.engine.json, no references[]) wired into the root tsc --build
  - ESLint src/engine/** determinism boundary (bans Math.random + @devvit/*/phaser + cross-dir imports)
  - vitest.config.ts (engine-only test discovery, no Devvit plugin)
  - Four contract Zod schemas (DayVector, Scene, Genome, StyleTemplate) + personal-layer schema (ActionBudget/PersonalState), all z.infer
  - Game-loop hook fields: dailyGoal (Genome), outcome (DayVector), goalAchieved (Scene), actionCap default 3 (Genome)
  - Barrel re-export src/engine/contracts/index.ts
affects: [synthesis, rng, presets, paint, simulator, devvit-wiring, game-loop]

# Tech tracking
tech-stack:
  added: [zod@4.4.3, vitest@4.1.9]
  patterns:
    - "Zod single-source-of-truth: every contract type is z.infer, no hand-written interfaces"
    - "Isolated engine TS project reference (leaf, references nothing)"
    - "ESLint per-directory boundary override placed after the catch-all so its no-restricted-* rules win"
    - "i18n error keys in schema messages"

key-files:
  created:
    - tools/tsconfig.engine.json
    - vitest.config.ts
    - src/engine/contracts/DayVector.ts
    - src/engine/contracts/Scene.ts
    - src/engine/contracts/Genome.ts
    - src/engine/contracts/StyleTemplate.ts
    - src/engine/contracts/Personal.ts
    - src/engine/contracts/index.ts
    - src/engine/contracts/contracts.test.ts
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - eslint.config.js

key-decisions:
  - "Pinned zod@4.4.3 and vitest@4.1.9 exactly (no caret) to match the repo's existing exact-pin convention"
  - "Used Zod v4 z.partialRecord(keyEnum, valueSchema) for the §6.3 weights matrix (typed-but-unused, D-05)"
  - "vitest passWithNoTests:true so an empty engine tree keeps the pipeline green (Task 1 standalone)"
  - "outcome (DayVector) typed z.unknown().optional(); goalAchieved (Scene) z.boolean().nullable().default(null) — loose now, firmed Phase 4 (RESEARCH A3)"
  - "PaletteSpecSchema lives only in StyleTemplate.ts; Genome.ts imports it to avoid a barrel export-name collision"

patterns-established:
  - "Pattern 1: z.infer-only contracts — schema first, export type X = z.infer<typeof XSchema>"
  - "Pattern 2: engine isolation via a dedicated tsconfig project that references nothing + an ESLint boundary"
  - "Pattern 3: personal layer (ActionBudget) structurally separate from the community Scene (GAME-05)"

requirements-completed: [ENG-01, ENG-03, TPL-02, TPL-04, GAME-01, GAME-05]

# Metrics
duration: 7min
completed: 2026-06-19
status: complete
---

# Phase 1 Plan 01: Engine Type Backbone & Isolation Boundary Summary

**Four `z.infer`-only Zod contracts (DayVector, Scene, Genome, StyleTemplate) plus a separate personal-layer schema, behind an isolated `src/engine/` TS project and an ESLint boundary that bans `Math.random` + Devvit/phaser — with the game-loop hook fields (`dailyGoal`, `outcome`, `goalAchieved`, `actionCap`) baked in.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-19T15:20:51Z
- **Completed:** 2026-06-19T15:28:04Z
- **Tasks:** 2
- **Files modified:** 13 (9 created, 4 modified)

## Accomplishments

- Added `zod@4.4.3` (dep) + `vitest@4.1.9` (dev) and a `"test": "vitest run"` script.
- Stood up `src/engine/` as a fourth, isolated TS project (`tools/tsconfig.engine.json`, references nothing) wired into the root `tsc --build`.
- Established the ENG-03 determinism boundary: an ESLint `src/engine/**` override bans `Math.random`, `@devvit/*`, `phaser`, and cross-dir imports — **proven** by a planted `Math.random()`+`phaser` fixture that errored on both rules, then deleted.
- Authored the four contracts + the personal layer as Zod schemas, every type `z.infer` (no hand-written interfaces), with the full §6.3 Genome surface (incl. the typed-but-unused Signal→Param weights matrix) and the game-loop hook fields.
- 13-test contracts suite: valid parse, invalid reject (conflict > 1, unknown goal type), field-presence (`dailyGoal`/`outcome`/`goalAchieved`/`actionCap`), and GAME-05 personal-layer separation (`Scene` has no `actionsUsed`/`userId`).

## Task Commits

Each task was committed atomically:

1. **Task 1: zod+vitest, isolated engine TS project, ESLint boundary, vitest config** - `7b15f23` (chore)
2. **Task 2: four contract schemas + personal layer + barrel + contracts test** - `68813e2` (feat)

_Task 2 is TDD-flagged; the contract schemas are inert data definitions so the inspection test passed GREEN on first run (no separate RED commit was meaningful — there is no behavior to fail-first beyond schema shape, which is asserted in the same commit)._

## Files Created/Modified

- `tools/tsconfig.engine.json` - Isolated engine TS project (rootDir `../src/engine`, `lib: ["ES2023"]`, NO `references[]`).
- `tsconfig.json` - Added `./tools/tsconfig.engine.json` to `references[]`.
- `eslint.config.js` - New `src/engine/**` override (after the catch-all) banning `Math.random`/`@devvit/*`/`phaser`/cross-dir imports.
- `vitest.config.ts` - Engine-only test discovery (`src/engine/**/*.test.ts`), no Devvit plugin, `passWithNoTests:true`.
- `package.json` / `package-lock.json` - `zod@4.4.3`, `vitest@4.1.9`, `test` script.
- `src/engine/contracts/DayVector.ts` - `DayVectorSchema` (§6.1) + `outcome` hook; `DayVector = z.infer`.
- `src/engine/contracts/Scene.ts` - `Scene`/`Shell`/`Element`/`CoreNode` (§6.2) + `goalAchieved`; `hue` is a 0..1 hint, never a color.
- `src/engine/contracts/Genome.ts` - Full §6.3 surface + `GoalTypeEnum`/`DailyGoalSchema` + `WeightsSchema` (typed-but-unused) + `actionCap` default 3.
- `src/engine/contracts/StyleTemplate.ts` - §6.4 schema + `StyleIdEnum` (drives `Genome.style`); Techno instance deferred to Phase 2.
- `src/engine/contracts/Personal.ts` - `ActionBudgetSchema`/`PersonalStateSchema` personal layer, distinct from `Scene`.
- `src/engine/contracts/index.ts` - Barrel re-export of all schemas + inferred types.
- `src/engine/contracts/contracts.test.ts` - 13 schema-inspection tests.

## Decisions Made

- **Exact version pins** (`zod@4.4.3`, `vitest@4.1.9`, no caret) to match the repo's existing exact-pin style.
- **`z.partialRecord`** confirmed via Context7 as the Zod v4 helper for `Partial<Record<K,V>>` — used for the §6.3 `weights` matrix, `ranges`, `baseVar`, `steerGain` (resolves RESEARCH assumption A2).
- **Loose-then-firm hook fields:** `outcome` = `z.unknown().optional()`, `goalAchieved` = `z.boolean().nullable().default(null)` — schema-only in Phase 1, firmed in Phase 4 (RESEARCH A3).
- **`PaletteSpecSchema` single-homed** in `StyleTemplate.ts` (Genome imports it) to avoid a duplicate barrel export.
- **`passWithNoTests:true`** so the empty-engine state after Task 1 still exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tsc --build` failed on the empty engine project after Task 1**
- **Found during:** Task 1 (engine project wired in before any `.ts` input existed)
- **Issue:** `error TS18003: No inputs were found in config file tools/tsconfig.engine.json` — the engine project had no source files yet.
- **Fix:** Resolved naturally by Task 2 in the same plan, which adds the contract source files. `tsc --build` is Task 2's verify gate (not Task 1's), so the plan ordering already accounts for this; no extra change required.
- **Files modified:** none beyond the planned Task 2 files
- **Verification:** `npm run type-check` exits 0 after Task 2.
- **Committed in:** `68813e2` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `passWithNoTests:true` added to vitest config**
- **Found during:** Task 1 (Task 1 acceptance requires `npx vitest run` to exit 0 with no tests yet)
- **Issue:** Vitest 4 defaults to exit code 1 on "No test files found", which would red the pipeline between Task 1 and Task 2.
- **Fix:** Set `test.passWithNoTests: true` in `vitest.config.ts`.
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run` exits 0 with an empty engine tree.
- **Committed in:** `7b15f23` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical).
**Impact on plan:** Both are config-level and required to satisfy the plan's own per-task acceptance gates. No scope creep; no schema or API change.

## Issues Encountered

None beyond the deviations above. The Zod v4 `z.partialRecord` helper (RESEARCH A2, flagged for live re-verification) was confirmed via Context7 before use.

## Threat Mitigations Applied

- **T-01-01 (Tampering / engine integrity):** ESLint `src/engine/**` override set up in Task 1 BEFORE any synthesis code; planted-then-deleted fixture proves it fires.
- **T-01-SC (Supply chain):** `zod`/`vitest` pinned exactly; lockfile committed; both are the legitimacy-audited official packages from RESEARCH (no `[ASSUMED]`/`[SLOP]` package → no blocking human checkpoint needed).
- **T-01-02 (Data integrity, latent):** bounded fields enforced in schema (`conflict` 0..1, `momentum` -1..1, `diversity` 0..1); `.parse()` enforcement lands at the Phase 2 sim→engine boundary.

## Next Phase Readiness

- Contracts + personal layer are the single source of truth for all downstream work. Plan 02 (`mulberry32`, `synthesize`, `render` stub, the `calm` preset) and Plan 03 (`chaotic`/`crystalline` presets + TPL-03 divergence proof) can import directly from `src/engine/contracts`.
- The ESLint determinism boundary is live, so the `mulberry32`/`genShell` port in Plan 02 is protected against `Math.random` leakage from the mock.
- No blockers introduced. `render()` orchestrator stub (ENG-04) remains scoped to Plan 02 per the resolved Open Question 1.

## Self-Check: PASSED

All 9 created source/config files + the SUMMARY exist on disk; both task commits (`7b15f23`, `68813e2`) are present in git history.

---
*Phase: 01-engine-foundation*
*Completed: 2026-06-19*

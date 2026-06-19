---
phase: 01-engine-foundation
plan: 02
subsystem: engine
tags: [determinism, mulberry32, synthesis, genShell-port, render-stub, genome-preset, tdd, byte-identical]

# Dependency graph
requires:
  - "01-01: the four z.infer contracts (DayVector, Scene, Genome, StyleTemplate) + barrel"
  - "01-01: ESLint src/engine/** determinism boundary (Math.random + Devvit/phaser ban)"
  - "01-01: isolated engine TS project + vitest config"
provides:
  - "mulberry32(seed) — the sole entropy source in the engine (src/engine/rng.ts)"
  - "synthesize(days, genome): Scene — pure, style-agnostic genShell port, seeded from day.seed"
  - "render(days, genome, style) — typed orchestrator stub (synthesis wired; scrub/nudge/regenerate/destroy deferred to Phase 2)"
  - "calm genome preset (GenomeSchema-validated data file)"
  - "tests/fixtures.ts — DayVectorSchema.parse'd cold-start/dense/AMA day vectors"
  - "byte-identical determinism guarantee (toEqual + JSON.stringify) proven by test"
  - "tools/tsconfig.engine-tests.json — type-checks engine tests + fixtures without source-tree emit"
affects: [presets, paint, camera, simulator, devvit-wiring, game-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One mulberry32 closure per DayVector, seeded from day.seed (NOT array index) — Redis-order-safe determinism"
    - "Fixed-key object literals for every Element/Shell — byte-identical key order (JSON.stringify equality)"
    - "Genome knobs replace mock magic numbers (density/spread/arms) so presets diverge with zero engine branch"
    - "Element.hue is a deterministic 0..1 hint (FNV-1a theme hash blended with steering.hue), never a color"
    - "Separate engine-tests TS project (emits to dist/types/engine-tests) keeps tsc --build honest about test types without polluting src/"

key-files:
  created:
    - src/engine/rng.ts
    - src/engine/rng.test.ts
    - src/engine/synthesis.ts
    - src/engine/synthesis.test.ts
    - src/engine/render.ts
    - src/engine/genomes/calm.ts
    - tests/fixtures.ts
    - tools/tsconfig.engine-tests.json
  modified:
    - tools/tsconfig.engine.json
    - tsconfig.json
    - eslint.config.js

key-decisions:
  - "Seed each per-day RNG closure from day.seed, not the mock's i*9973 index — index seeds break under Redis ordering (SYN-01)"
  - "Reduced topThreads:number[] -> scalar via Math.max(0, ...topThreads) with empty-array guard -> 0 (Pitfall 2)"
  - "Element.hue derived as FNV-1a hash of dominantTheme blended 70/30 with steering.hue, clamped 0..1 (deterministic hint, ENG-02)"
  - "Genome knobs used in Phase 1: baseVar.density (star count), baseVar.spread + volatility*0.55 (radial spread), baseVar.symmetry (arm count); weights matrix stays typed-but-unused (D-05)"
  - "Test files excluded from the engine SOURCE composite project; a sibling engine-tests project type-checks them + tests/fixtures.ts and emits only to dist (no src pollution)"
  - "render() ships as a typed stub per resolved Open Question 1 — synthesis wired, paint/camera/scrub/nudge/regenerate/destroy deferred to Phase 2"

requirements-completed: [SYN-01, SYN-02, SYN-03, SYN-04, ENG-02, ENG-04, TPL-01]

# Metrics
duration: 9min
completed: 2026-06-19
status: complete
---

# Phase 1 Plan 02: Deterministic Synthesis Pipeline Summary

**A pure, style-agnostic `synthesize(DayVector[], Genome) → Scene` ported from the mock's `genShell` heuristic — seeded per-day from `day.seed`, byte-identically reproducible (toEqual + JSON.stringify), driven by Genome knobs (not magic numbers), with the `render()` orchestrator stub naming the Phase-2 paint/camera seam.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-19T15:32:46Z
- **Completed:** 2026-06-19T15:41:29Z
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files:** 11 (8 created, 3 modified)

## Accomplishments

- Ported `mulberry32` verbatim into `src/engine/rng.ts` — the single, documented non-cryptographic entropy source; proven by a fixed-seed golden-sequence test.
- Authored the **Calm** genome preset as a `GenomeSchema.parse`'d data file (low volatility/density/symmetry pole), with zero engine branch — synthesis reads its knobs.
- Built `tests/fixtures.ts`: three `DayVectorSchema.parse`'d days (cold-start genesis day-1, a dense high-conflict day, an AMA-style high-`topThreads` day), each with a fixed `seed`. This is the only Zod boundary in the Phase-1 engine path.
- Ported `genShell`/`starCount`/`lerp` into `synthesize()` with every mandatory deviation applied: per-day seed from `day.seed`, live globals → `day.steering.*`, magic numbers → Genome knobs (TPL-01), `topThreads` reduced via guarded `Math.max`, genesis → core-only shell, `Element.hue` as a 0..1 hint (ENG-02), fixed-key object literals (Pitfall 3), no `.parse()` inside synthesis (QA-03).
- Wired `render(days, genome, style)` as a typed stub: synthesis is called now; `scrub/nudge/regenerate/destroy` are declared with their final signatures but throw `error.engine.render.notImplemented` (Phase 2).
- **Proved the architecture bet:** two `synthesize()` calls on identical inputs produce a byte-identical Scene (`toEqual` AND `JSON.stringify` equality), and a sparse cold-start day yields fewer elements than a dense day (SYN-04). 21 engine tests green.

## Task Commits

1. **Task 1 (RED):** `efb1dc9` — `test(01-02)`: failing determinism + data-sensitivity tests, `rng.ts` + sequence test, Calm preset, fixtures. Verified RED (synthesis test failed only on the missing `synthesize`/`render` import).
2. **Task 2 (GREEN):** `189d5fa` — `feat(01-02)`: `synthesize()` genShell port + `render()` stub; build wiring fix. All gates green.

## TDD Gate Compliance

RED gate (`test(...)` commit `efb1dc9`) and GREEN gate (`feat(...)` commit `189d5fa`) both present and in order. No REFACTOR commit was needed (the GREEN implementation was already clean — fixed-key literals, no dead code). The RED commit was confirmed to fail on the missing `synthesize` import (not a fixture error), per the plan's RED acceptance.

## Files Created/Modified

- `src/engine/rng.ts` — `mulberry32(a)` verbatim port; doc-commented non-crypto / never-seed-secrets (RESEARCH Security V6).
- `src/engine/rng.test.ts` — fixed-seed golden sequence, range `[0,1)`, lockstep, divergence.
- `src/engine/synthesis.ts` — `synthesize(days, genome): Scene`; the genShell port + `hueHint` (FNV-1a theme hash → 0..1), `starCount`, `lerp`, `clamp01` helpers. Imports only `./rng` + `./contracts`.
- `src/engine/synthesis.test.ts` — determinism (toEqual + JSON.stringify), data-sensitivity, genesis-empty, render-stub equality.
- `src/engine/render.ts` — `render()` orchestrator stub + `RenderHandle` interface (scene/style held; interactive methods throw until Phase 2).
- `src/engine/genomes/calm.ts` — Calm preset (`GenomeSchema.parse`, full §6.3 surface, calm-pole knobs).
- `tests/fixtures.ts` — `fixtureDays` + named day accessors + re-exported `calm`; the single Phase-1 `.parse` boundary.
- `tools/tsconfig.engine-tests.json` — **new** project type-checking `src/engine/**/*.test.ts` + `tests/**/*` (emit parked under `dist/types/engine-tests`).
- `tools/tsconfig.engine.json` — engine SOURCE project now excludes `*.test.ts` (tests moved to the engine-tests project).
- `tsconfig.json` — registered the engine-tests project in `references[]`.
- `eslint.config.js` — engine override now lists both engine tsconfigs in `parserOptions.project` and ignores `^_`-prefixed unused args (the render-stub params).

## Decisions Made

- **Per-day `day.seed` seeding** (not `i*9973` index) — the single most important determinism decision; index seeds break when DayVectors arrive from Redis out of order (SYN-01).
- **Hue-hint formula** (Open Question 2, Claude's discretion): FNV-1a hash of `dominantTheme` folded to `[0,1)`, blended 70/30 with the fractional part of `steering.hue`, clamped. Deterministic + visibly varied; paint maps it through the palette in Phase 2.
- **`topThreads` reduction = `Math.max`** (Assumption A1): any monotone reduction reproduces the mock's `nbig`; max with an empty-array guard is the simplest deterministic choice.
- **Arm heuristic** kept the mock's branch shape (`conflict>.7` vs `posts>300`) but the resulting arm counts are now offsets of `genome.baseVar.symmetry`, so Crystalline (high symmetry, Plan 03) will visibly diverge.
- **Engine-tests TS project** (build-wiring deviation, below) — the clean way to keep `tsc --build` type-checking tests that import a cross-`rootDir` fixtures module, without writing `.js`/`.d.ts` into `src/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Engine tests import `tests/fixtures.ts` outside the engine project's `rootDir`**
- **Found during:** Task 2 (`npm run type-check` / GREEN gate)
- **Issue:** The engine source project has `rootDir: ../src/engine` with `composite: true`. `src/engine/synthesis.test.ts` imports `../../tests/fixtures` (outside that rootDir), which `tsc --build` rejects ("not under rootDir" / "must list all files"). A first attempt to broaden `rootDir` to the repo root caused `tsc` to emit `.js`/`.d.ts` **into the source tree** (`src/engine/`, `tests/`) — unacceptable pollution, and ESLint then tried to lint the generated `.d.ts`.
- **Fix:** Excluded `*.test.ts` from the engine SOURCE project and added a dedicated `tools/tsconfig.engine-tests.json` (rootDir = repo root, `outDir` = `dist/types/engine-tests`) that type-checks the test files + `tests/fixtures.ts` and emits only under `dist/` (never `src/`). Registered it in `tsconfig.json` `references[]`. Updated the ESLint engine override to point `parserOptions.project` at both engine tsconfigs.
- **Verification:** `npm run type-check` exits 0; a planted type error in `synthesis.test.ts` is caught (tests are genuinely type-checked) and reverted; `find src/engine tests -name '*.js' -o -name '*.d.ts'` is empty (no source pollution); `npm run lint` exits 0.
- **Files modified:** `tools/tsconfig.engine.json`, `tools/tsconfig.engine-tests.json` (new), `tsconfig.json`, `eslint.config.js`
- **Committed in:** `189d5fa`

**2. [Rule 2 - Missing Critical] ESLint flagged the intentional render-stub params + lacked underscore-ignore**
- **Found during:** Task 2 (`npm run lint` / GREEN gate)
- **Issue:** The `render()` Phase-2 stub methods keep typed-but-unused params (`_day`, `_param`, `_amount`, `_days`, `_genome`) for documentation, but the engine ESLint override (inheriting `@typescript-eslint/recommended`) flagged them as unused.
- **Fix:** Added `argsIgnorePattern: '^_'` (+ vars/caughtErrors) to `@typescript-eslint/no-unused-vars` in the engine override — the repo's underscore convention for intentionally-unused identifiers.
- **Files modified:** `eslint.config.js`
- **Committed in:** `189d5fa`

---

**Total deviations:** 2 auto-fixed (1 blocking build-wiring, 1 missing lint config). Both are config-level, required to satisfy the plan's own GREEN gates (`tsc --build` + lint). No scope creep; no contract/schema/API change; synthesis logic is exactly the planned genShell port.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `render().scrub/nudge/regenerate/destroy` throw `error.engine.render.notImplemented` | `src/engine/render.ts` | **Intentional, plan-mandated.** ENG-04 Phase-1 DoD (resolved Open Question 1 / A4): typed signature + synthesis wired now; paint + camera bodies land in **Phase 2**. The `scene`/`style` properties of the handle are fully live. |

`render` does **not** block the Phase-1 goal — the goal is the deterministic synthesis pipeline (`DayVector → synthesize → Scene`), which is fully implemented and proven. The stub methods are the named Phase-2 seam.

## Threat Mitigations Applied

- **T-02-01 (determinism leak):** Seeded from `day.seed`; `mulberry32` is the only RNG; the byte-identical test (toEqual + JSON.stringify) proves it; the 01-01 ESLint `Math.random` ban holds (lint green). `grep "i*9973"` returns 0.
- **T-02-02 (key-order non-determinism):** Every Element/Shell is one fixed-key object literal (all keys always present); the JSON.stringify-equality test would catch any drift.
- **T-02-03 (style coupling):** `Element.hue` is a 0..1 hint; `grep -Ei "hsl\(|rgb\(|#hex"` on `synthesis.ts` returns nothing; synthesis imports only `./rng` + `./contracts` (ESLint cross-dir ban green).
- **T-02-04 (empty-array crash):** `topThreads` reduced via `day.topThreads.length > 0 ? Math.max(0, ...) : 0` — guarded.
- **T-02-05 (RNG misuse):** accepted — `rng.ts` documents non-crypto / never-seed-secrets.

## Next Phase Readiness

- **Plan 03** adds the Chaotic + Crystalline presets (data files) and the TPL-03 cross-preset divergence proof — synthesis already reads the genome knobs that make them diverge (`baseVar.density/spread/symmetry`, `volatility`); zero engine change required.
- **Phase 2** attaches `paint(Scene, StyleTemplate)` + camera behind the `render()` stub and fills the `scrub/nudge/regenerate/destroy` bodies — the `Scene` seam and the typed `render` signature are final.
- No blockers introduced.

## Self-Check: PASSED

All 8 created files + the SUMMARY exist on disk; both task commits (`efb1dc9`, `189d5fa`) are present in git history; `npx vitest run src/engine` (21 tests), `tsc --build`, and `eslint src/**` are all green.

---
*Phase: 01-engine-foundation*
*Completed: 2026-06-19*

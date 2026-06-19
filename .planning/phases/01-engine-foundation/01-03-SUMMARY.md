---
phase: 01-engine-foundation
plan: 03
subsystem: engine
tags: [template-engine, genome-preset, tpl-03, divergence-proof, data-not-code, tdd, byte-identical]

# Dependency graph
requires:
  - "01-01: GenomeSchema (z.infer) + contracts barrel"
  - "01-02: synthesize(days, genome): Scene reading baseVar.density/spread/symmetry + volatility knobs"
  - "01-02: calm genome preset (the shape template) + tests/fixtures.ts (shared fixtureDays)"
provides:
  - "chaotic genome preset (GenomeSchema-validated data file — max-contrast pole)"
  - "crystalline genome preset (GenomeSchema-validated data file — high symmetry + inheritance)"
  - "src/engine/genomes/index.ts — barrel re-export of calm + chaotic + crystalline"
  - "TPL-03 divergence proof: same DayVector[] → measurably diverging Scenes across 3 presets, zero engine change"
affects: [paint, camera, devvit-wiring, genome-authoring, game-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A new genome = a new data file in src/engine/genomes/ re-exported from the barrel — ZERO engine code change (TPL-03)"
    - "Divergence is proven by data-only knob contrast: density (star count), volatility/spread (turbulence), symmetry (arm count)"
    - "Divergence test forbids engine change (git diff --quiet on synthesis.ts/render.ts) + asserts no 'preset ===' branch"

key-files:
  created:
    - src/engine/genomes/chaotic.ts
    - src/engine/genomes/crystalline.ts
    - src/engine/genomes/index.ts
    - src/engine/presets.test.ts
  modified: []

key-decisions:
  - "Chaotic = max-contrast opposite of Calm: density 0.40 (vs 0.24), volatility 0.92 (vs 0.20), inheritance 0.12 (vs 0.60), spread 0.34 (vs 0.14), symmetry 1 (vs 2)"
  - "Crystalline (Claude's discretion per RESEARCH OQ3): symmetry 5 (many faceted arms), inheritance 0.90, volatility 0.08, density 0.30, tight spread 0.10 — ordered/faceted, neither pole"
  - "Element-count divergence engineered via density: dense fixture day (410 posts) → Calm round(410*0.24)=98 vs Chaotic capped at 112; AMA day (210) → 50 vs 84 — frontier counts differ + Chaotic total > Calm total"
  - "Each preset's dailyGoal matches its character (Chaotic=starThreshold activity goal, Crystalline=reachSymmetry form goal) — data only, scoring is Phase 4"
  - "Zero engine change confirmed: synthesis.ts/render.ts byte-unchanged (git diff --quiet), grep 'preset ===' returns 0"

requirements-completed: [TPL-03]

# Metrics
duration: 4min
completed: 2026-06-19
status: complete
---

# Phase 1 Plan 03: Three Genome Presets — TPL-03 Divergence Proof Summary

**Authored the remaining two genome presets (Chaotic and Crystalline) as pure `GenomeSchema.parse`'d data files and proved the config-driven template-engine claim (TPL-03): running the identical `fixtureDays` through all three presets yields measurably divergent Scenes — Calm vs Chaotic differ in element density (frontier star count + total), Calm vs Crystalline differ by JSON inequality (symmetry/volatility reshape) — with the synthesis/render engine byte-unchanged and no `preset ===` branch anywhere.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 1 (TDD: RED then GREEN)
- **Files:** 4 created, 0 modified
- **Completed:** 2026-06-19

## Accomplishments

- **Chaotic preset** (`src/engine/genomes/chaotic.ts`): the max-contrast opposite of Calm (D-01) — high density (0.40), high volatility (0.92), low inheritance (0.12), loose spread (0.34), few/clumped arms (symmetry 1). Same `style: 'techno'`, `actionCap: 3`, an activity `dailyGoal` (`starThreshold`). Validated by `GenomeSchema.parse` at module load.
- **Crystalline preset** (`src/engine/genomes/crystalline.ts`): high symmetry (5 faceted arms), high inheritance (0.90), very low volatility (0.08), tight crisp spread (0.10), moderate density (0.30) — an ordered, faceted lattice (neither the Calm nor the Chaotic pole). Numeric knobs were Claude's discretion (RESEARCH Open Question 3), tuned for unmistakable divergence. Same `style: 'techno'`, `actionCap: 3`, a form `dailyGoal` (`reachSymmetry`). Final palette/look is deferred to Phase 2.
- **Barrel** (`src/engine/genomes/index.ts`): re-exports `calm`, `chaotic`, `crystalline` — the single import surface; adding a genome is a one-line barrel addition, never an engine change.
- **TPL-03 divergence proof** (`src/engine/presets.test.ts`, 5 tests): runs the shared `fixtureDays` through `synthesize(...)` for all three presets and asserts (a) all three parse + share the Techno style, (b) Calm vs Chaotic differ in frontier element count AND Chaotic total > Calm total, (c) Calm vs Crystalline JSON inequality, (d) Chaotic vs Crystalline JSON inequality, and (e) each preset is independently byte-identical on re-synthesis (the SYN-02 guarantee survives adding presets).
- **Proved the architecture bet's payoff:** three provably distinct universes from one `DayVector[]` and config alone — `synthesis.ts`/`render.ts` byte-unchanged by this plan, `grep "preset ===" src/engine/synthesis.ts` returns 0.

## Task Commits

1. **RED:** `8466802` — `test(01-03)`: failing TPL-03 divergence proof (same fixtureDays → 3 presets → diverging Scenes). Verified RED: failed on the missing `./genomes` barrel (chaotic/crystalline not yet authored), not a fixture error.
2. **GREEN:** `dd656f7` — `feat(01-03)`: Chaotic + Crystalline presets + barrel; 26 engine tests green, `tsc --build` + `eslint` clean, engine byte-unchanged.

## TDD Gate Compliance

RED gate (`test(...)` commit `8466802`) and GREEN gate (`feat(...)` commit `dd656f7`) both present and in order. The RED commit was confirmed to fail on the missing genome barrel import (the presets under test), satisfying the plan's RED acceptance. No REFACTOR commit was needed — the presets are clean fixed-key data literals with no dead code.

## Files Created/Modified

- `src/engine/genomes/chaotic.ts` — **new.** Chaotic preset (`GenomeSchema.parse`, full §6.3 surface, max-contrast knobs vs Calm).
- `src/engine/genomes/crystalline.ts` — **new.** Crystalline preset (`GenomeSchema.parse`, high symmetry + inheritance, low volatility; discretionary knobs).
- `src/engine/genomes/index.ts` — **new.** Barrel re-export of all three presets.
- `src/engine/presets.test.ts` — **new.** The TPL-03 divergence proof (5 tests).
- *(No engine source modified — that is the whole point of TPL-03.)*

## Decisions Made

- **Density-driven element-count divergence (Calm vs Chaotic):** synthesis computes `starCount = clamp(5..112, round(posts * density))`. Calm density 0.24 on the dense fixture day (410 posts) → 98 stars; Chaotic density 0.40 → round(164) capped at 112. AMA day (210 posts): 50 vs 84. So both the frontier-shell count and the total differ measurably — the test asserts `frontierElements(calm) !== frontierElements(chaotic)` and `total(chaotic) > total(calm)`.
- **Crystalline knobs (RESEARCH Open Question 3, Claude's discretion):** symmetry 5 (vs Calm 2, Chaotic 1) is the signature divergence — synthesis turns `baseVar.symmetry` into the arm count, so the per-star angle distribution differs sharply from both other presets even where the element count coincides. Paired with very low volatility (0.08) and high inheritance (0.90) for the ordered/faceted character. JSON inequality vs both Calm and Chaotic is asserted.
- **Per-preset `dailyGoal` as character data:** Chaotic → `starThreshold` (activity), Crystalline → `reachSymmetry` (form). Pure data; scoring is Phase 4. This keeps the `dailyGoal` schema (D-03) exercised by real distinct presets.
- **Zero-engine-change enforcement:** the divergence test plus the plan's verify gate (`git diff --quiet -- synthesis.ts render.ts`) and `grep -c "preset ===" synthesis.ts` (= 0) together prove divergence is data-only.

## Deviations from Plan

None — plan executed exactly as written. The two presets were authored as pure data, the barrel and divergence test created as specified, and no engine source required any change. All verify gates passed on the first GREEN run.

## Threat Mitigations Applied

- **T-03-01 (template-engine claim violated):** Divergence comes purely from Genome data — `git diff --quiet -- src/engine/synthesis.ts src/engine/render.ts` is clean (`ENGINE_UNCHANGED_OK`) and `grep -c "preset ===" src/engine/synthesis.ts` returns 0. No engine branch keys off a preset name.
- **T-03-02 (malformed preset reaches synthesis):** Both `chaotic.ts` and `crystalline.ts` wrap their literal in `GenomeSchema.parse(...)` at module load — an invalid preset throws at import, before synthesis can run.
- **T-03-03 (determinism regression):** `presets.test.ts` re-asserts per-preset byte-identical determinism (`toEqual` + `JSON.stringify`) for all three presets, so adding presets cannot silently break the SYN-02 guarantee from Plan 02.

## Verification Results

- `npx vitest run src/engine/presets.test.ts` → 5/5 passed.
- `npx vitest run src/engine` → 26/26 passed (21 prior + 5 new).
- `npm run type-check` (`tsc --build`) → exit 0.
- `npm run lint` (`eslint 'src/**/*.{ts,tsx}'`, covers `src/engine/`) → exit 0.
- `git diff --quiet -- src/engine/synthesis.ts src/engine/render.ts` → clean (`ENGINE_UNCHANGED_OK`).
- `grep -c "preset ===" src/engine/synthesis.ts` → 0.

## Next Phase Readiness

- **Phase 1 is complete** (Plan 03 of 3): the engine deterministically synthesizes three distinct universes from one `DayVector[]` + config, with the template-engine claim (TPL-03) proven.
- **Phase 2** attaches `paint(Scene, StyleTemplate)` + camera behind the `render()` stub and authors the Techno `StyleTemplate` instance; each preset's final palette/look (esp. Crystalline's cool/faceted skin) is decided there. The three genomes are stable data inputs.
- No blockers introduced.

## Self-Check: PASSED

All 4 created files exist on disk; both task commits (`8466802`, `dd656f7`) are present in git history; `npx vitest run src/engine` (26 tests), `tsc --build`, and `eslint` are all green; engine source is byte-unchanged.

---
*Phase: 01-engine-foundation*
*Completed: 2026-06-19*

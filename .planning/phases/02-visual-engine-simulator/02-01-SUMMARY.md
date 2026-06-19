---
phase: 02-visual-engine-simulator
plan: 01
subsystem: ui
tags: [phaser, webgl, zod, vite, styletemplate, painter, tsconfig, eslint]

# Dependency graph
requires:
  - phase: 01-engine-foundation
    provides: "synthesize() + render() stub, Scene/StyleTemplate/DayVector/Genome Zod contracts, calm/chaotic/crystalline genomes, mulberry32 RNG, per-area tsconfig + ESLint engine boundary"
provides:
  - "src/styles + src/sim build coverage (Phaser-banned tsconfig projects + ESLint block)"
  - "Standalone Cosmos dev page (separate plain-vite entry, NOT a Devvit entrypoint)"
  - "techno StyleTemplate (schema-parsed DATA, the first authored skin)"
  - "Painter seam in src/engine/render.ts (types-only, zero phaser import)"
  - "PhaserPainter adapter (the only Phaser holder reaching the engine call-site)"
  - "Reused additive glow texture + DynamicTexture bake helper (PNT-03 perf foundation)"
  - "End-to-end Scene->pixels render: genesis core + frontier shell-0 stars on a Phaser WebGL canvas"
affects: [02-02-simulator, 02-03-paint-parity, 02-04-camera, 02-05-steering-chrome]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Painter injection seam: engine declares Painter (types only); PhaserPainter under src/client/cosmos/ is injected into render() — phaser never reaches src/engine"
    - "One reused tinted+additive glow Image per draw (BlendModes.ADD == mock 'lighter') instead of per-frame radial gradients"
    - "DynamicTexture bake-on-freeze: flatten a frozen shell's glows into one composited Image"
    - "StyleTemplate as schema-parsed DATA module (mirrors genome preset pattern); hue->color resolved by paint via palette ramp interpolation (ENG-02)"
    - "Standalone plain-vite dev entry kept out of the Devvit bundle (Devvit build inputs = devvit.json entrypoints only)"

key-files:
  created:
    - tools/tsconfig.styles.json
    - tools/tsconfig.sim.json
    - tools/tsconfig.styles-tests.json
    - tools/vite.cosmos.config.ts
    - src/styles/techno.ts
    - src/styles/index.ts
    - src/styles/techno.test.ts
    - src/sim/index.ts
    - src/client/cosmos/primitives.ts
    - src/client/cosmos/bake.ts
    - src/client/cosmos/CosmosScene.ts
    - src/client/cosmos/PhaserPainter.ts
    - src/client/cosmos-dev/cosmos-dev.html
    - src/client/cosmos-dev/cosmos-dev.css
    - src/client/cosmos-dev/main.ts
    - src/client/cosmos-dev/dev-fixture.ts
  modified:
    - tsconfig.json
    - eslint.config.js
    - package.json
    - vitest.config.ts
    - tools/tsconfig.client.json
    - src/engine/render.ts

key-decisions:
  - "Dev page is a separate plain-vite config (tools/vite.cosmos.config.ts) run via `npm run cosmos`; NOT a devvit.json entrypoint — the Devvit build only consumes splash.html + game.html"
  - "Painter interface declared types-only in render.ts; render() takes an optional 4th painter arg so existing 3-arg engine tests stay green and headless calls still throw notImplemented"
  - "Glow is ONE reused soft radial-gradient CanvasTexture, tinted + additive per draw (true falloff per Pitfall 4) — no per-frame gradient allocation"
  - "Client tsconfig now references the engine + styles composite projects (the dev page imports their runtime values, not just types)"
  - "Dev fixture lives in src/client/cosmos-dev/dev-fixture.ts (not tests/fixtures.ts) — tests/ is not a composite project the client build can span; real source is the plan-02-02 simulator"

patterns-established:
  - "Painter seam (engine <-> paint injection): the canonical extension point for paint/camera/steering in plans 03-05"
  - "Phaser glow/bake primitives (primitives.ts + bake.ts): the PNT-03 performance foundation"

requirements-completed: [PNT-01, PNT-02, PNT-03, QA-01, QA-02, QA-03]

# Metrics
duration: 21min
completed: 2026-06-19
status: complete
---

# Phase 2 Plan 01: Visual Engine Build Surface + Thinnest End-to-End Render Slice Summary

**A fixture Scene now synthesizes through the engine and paints to a Phaser WebGL canvas end-to-end — genesis core + frontier stars visible — with the engine staying Phaser-free behind an injected Painter seam, plus full src/styles + src/sim build coverage and a standalone dev page kept out of the Devvit bundle.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-06-19 (from plan-finalize commit 19da25b)
- **Completed:** 2026-06-19
- **Tasks:** 3 completed (4 commits — one TDD task split test->feat)
- **Files modified:** 22 (16 created, 6 modified)

## Accomplishments
- Stood up the Phase-2 build surface: `tools/tsconfig.styles.json` + `tools/tsconfig.sim.json` (Phaser-banned, reference the engine project), registered in `tsconfig.json`, plus a new ESLint flat-config block banning `phaser`/`@devvit/*`/`*/client/*`/`*/server/*` across `src/styles/**` + `src/sim/**`.
- Delivered the thinnest end-to-end render slice: `npm run cosmos` boots a standalone Vite dev page that runs a fixture `DayVector[]` through the engine `render()` entry and paints the genesis core + frontier shell-0 stars on a Phaser WebGL canvas.
- Established the Painter injection seam: `render.ts` declares a types-only `Painter` interface (zero phaser import — verified `grep -rnE "from '(phaser)" src/engine` returns 0); `PhaserPainter` under `src/client/cosmos/` is the only Phaser holder reaching the engine call-site.
- Authored the `techno` StyleTemplate as schema-parsed DATA (PNT-02) and built the PNT-03 perf foundation: one reused additive glow texture (`primitives.ts`) + a DynamicTexture bake-on-freeze helper (`bake.ts`).
- Kept the Devvit build unaffected: the dev page is never a `devvit.json` entrypoint (`grep -c cosmos-dev devvit.json` = 0) and does not appear in `dist/client`.

## Task Commits

1. **Task 1: Build coverage for src/styles + src/sim and a separate dev-page Vite entry** - `9b798e8` (build)
2. **Task 2 (TDD): Techno StyleTemplate + Painter seam + glow/bake primitives**
   - RED: `8fd401e` (test) - failing techno StyleTemplate test + vitest/tsconfig/eslint wiring for src/styles tests
   - GREEN: `14f9477` (feat) - techno.ts, render.ts Painter seam, primitives.ts, bake.ts
3. **Task 3: Boot the standalone dev page and paint one synthesized Scene end-to-end** - `e6656ac` (feat)

_TDD task 2 split test -> feat per the RED/GREEN gate; no refactor commit needed._

## Files Created/Modified

**Created:**
- `tools/tsconfig.styles.json` / `tools/tsconfig.sim.json` - Phaser-free per-area TS projects (extend base, reference engine).
- `tools/tsconfig.styles-tests.json` - type-checks `src/styles/**/*.test.ts` (styles source project excludes test files).
- `tools/vite.cosmos.config.ts` - plain-vite config for the dev page (no Devvit plugin); root = `src/client/cosmos-dev`, opens `/cosmos-dev.html`.
- `src/styles/techno.ts` - the Techno StyleTemplate (schema-parsed DATA): indigo->cyan->magenta->warm-white ramp, gene->primitive refs, `motion.frontierOnly`.
- `src/styles/index.ts` - styles barrel (exports `techno`).
- `src/styles/techno.test.ts` - asserts techno parses, id, ramp stops, frontier-only motion.
- `src/sim/index.ts` - placeholder barrel so the sim project + ESLint block have a covered file until plan 02-02.
- `src/client/cosmos/primitives.ts` - reused soft radial-glow CanvasTexture + tinted additive Image helper (`BlendModes.ADD`).
- `src/client/cosmos/bake.ts` - DynamicTexture bake-on-freeze helper (`addDynamicTexture` -> `draw` -> single composited Image).
- `src/client/cosmos/CosmosScene.ts` - Phaser.Scene painting genesis core + frontier shell-0 stars; hue->color via palette ramp interpolation.
- `src/client/cosmos/PhaserPainter.ts` - implements the engine `Painter`; `mount()` feeds the CosmosScene.
- `src/client/cosmos-dev/cosmos-dev.html` / `cosmos-dev.css` - standalone Vite entry + full-bleed dark stage (`touch-action: none`).
- `src/client/cosmos-dev/main.ts` - boots Phaser (`type: AUTO`, `Phaser.Scale.RESIZE`, DPR capped at 2) and wires fixture days -> `render(days, calm, techno, painter)`.
- `src/client/cosmos-dev/dev-fixture.ts` - local fixture `DayVector[]` (Zod-validated) until the plan-02-02 simulator exists.

**Modified:**
- `tsconfig.json` - added styles/styles-tests/sim project references.
- `eslint.config.js` - new flat block: Phaser ban for `src/styles/**` + `src/sim/**` (+ styles-tests project).
- `package.json` - added `cosmos` script.
- `vitest.config.ts` - include `src/styles/**` + `src/sim/**` test globs.
- `tools/tsconfig.client.json` - reference engine + styles projects (dev page imports their runtime values).
- `src/engine/render.ts` - declared the `Painter` interface (types only) and wired `render()` to accept/delegate to an injected Painter.

## Decisions Made
- **Optional Painter arg:** `render(days, genome, style, painter?)` keeps the Phase-1 3-arg engine tests green; without a painter the interactive methods still throw `notImplemented` (headless engine path).
- **True-falloff glow via CanvasTexture:** chose a radial-gradient CanvasTexture over `Graphics.fillCircle` so additive tinting reads as soft light, not a flat disc (Pitfall 4 / Assumption A3).
- **Dev fixture local to the dev page:** see Deviation 1 below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dev page imports `tests/fixtures.ts` across a composite-project boundary**
- **Found during:** Task 3 (boot dev page).
- **Issue:** The plan's `<action>` imports `fixtureDays` from `tests/fixtures.ts`. `tests/` is not a composite TS project, and the client project (rootDir `src/client`) cannot import runtime values from it without spanning the whole test tree into the client build — `tsc --build` failed with TS6059/TS6307.
- **Fix:** Created `src/client/cosmos-dev/dev-fixture.ts` — a small `DayVector[]` validated through `DayVectorSchema.parse()` (the same boundary discipline), mirroring `tests/fixtures.ts`'s dense frontier day + genesis day. The canonical DayVector source is the plan-02-02 simulator; this is the throwaway stand-in.
- **Files modified:** `src/client/cosmos-dev/dev-fixture.ts`, `src/client/cosmos-dev/main.ts`.
- **Verification:** type-check + lint + build green; dev server serves `cosmos-dev.html` and transforms `main.ts` with no resolution errors.
- **Committed in:** `e6656ac`.

**2. [Rule 3 - Blocking] Phaser 4 GameConfig has no `resolution` field; `override` + `camera.resize` mismatches**
- **Found during:** Task 3.
- **Issue:** Plan/idiom assumed `resolution` on GameConfig (removed in Phaser 4), `override init/create` (Phaser's Scene base doesn't declare them as members → TS4113), and `camera.resize` (does not exist on `Cameras.Scene2D.Camera`).
- **Fix:** DPR cap applied via the Scale Manager (`autoRound` + a `zoom` bound derived from `Math.min(devicePixelRatio, 2)`) instead of `resolution`; removed `override` from `init`/`create`; used `this.cameras.resize(w, h)` (the manager) per `scenes/Game.ts`.
- **Files modified:** `src/client/cosmos-dev/main.ts`, `src/client/cosmos/CosmosScene.ts`.
- **Verification:** type-check green; signatures confirmed against `node_modules/phaser` 4.2.0 types.
- **Committed in:** `e6656ac`.

**3. [Rule 3 - Blocking] Client project could not see engine/styles runtime values**
- **Found during:** Task 3.
- **Issue:** Once `main.ts` imported runtime values (`render`, `calm`, `techno`), the client composite project pulled engine/styles source as plain files outside its rootDir (TS6059/TS6307). In Task 2 these were `import type` only and got elided.
- **Fix:** Added `tools/tsconfig.engine.json` + `tools/tsconfig.styles.json` to `tools/tsconfig.client.json` `references` (mirrors the existing shared reference), so they are consumed as built composite deps.
- **Files modified:** `tools/tsconfig.client.json`.
- **Verification:** type-check + lint + build green.
- **Committed in:** `e6656ac`.

**Build-config bonus (consistency, not a deviation):** added `tools/tsconfig.styles-tests.json` + extended `vitest.config.ts` so the TDD test under `src/styles/` is both run and type-checked — mirrors the engine/engine-tests split the plan's build-topology already established.

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking). **Impact:** all necessary to complete the slice on Phaser 4 + the composite-project layout; no scope creep — the dev fixture is explicitly throwaway and the simulator (its replacement) is plan 02-02.

## Issues Encountered
- **One-time stray emit into the source tree:** during an intermediate edit state, `tsc`/build emitted `.d.ts`/`.js`/`.map` next to source (`src/engine/**`, `src/styles/**`, `tests/fixtures.*`). These tripped ESLint's `src/**` glob. Deleted them; re-running type-check + build clean confirmed they do not regenerate. Not committed. (Consider adding `src/**/*.d.ts` + `src/**/*.js` build artifacts to `.gitignore` in a future plan if it recurs.)

## User Setup Required
None - the dev page runs locally via `npm run cosmos`; no external service configuration required. (Manual visual check is the intended verification: a glowing genesis core + frontier stars on a WebGL canvas — no headless WebGL assertion is in scope per RESEARCH.)

## Next Phase Readiness
- **Ready:** the Painter seam, glow/bake primitives, techno StyleTemplate, and the dev page are the foundation for plan 02-03 (paint parity: full shells, frontier rAF animation, bake-on-freeze trigger), plan 02-04 (camera scrub/zoom via `PhaserPainter.focus`), and plan 02-05 (steering nudge + chrome via `render().nudge` / `regenerate`).
- **Hand-off for plan 02-02 (simulator):** `src/sim/` build coverage + the Phaser-ban ESLint block are live; the simulator should emit `DayVector[]` through the single `DayVectorSchema.parse()` boundary and replace `src/client/cosmos-dev/dev-fixture.ts`.
- **No blockers.**

## Self-Check: PASSED

All 16 created files present on disk; all 4 task commits (`9b798e8`, `8fd401e`, `14f9477`, `e6656ac`) exist in history. Final gate: type-check + lint + test (30 passing) + build all green; `grep -rnE "from '(phaser)" src/engine` returns 0.

---
*Phase: 02-visual-engine-simulator*
*Completed: 2026-06-19*

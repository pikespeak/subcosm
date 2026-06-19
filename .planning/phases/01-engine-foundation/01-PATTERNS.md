# Phase 1: Engine Foundation - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 17 (15 created, 2 modified)
**Analogs found:** 17 / 17 (4 strong config analogs; 11 net-new pure modules with mock/spec source analogs)

> Phase 1 is a **net-new pure `src/engine/` module set** with very limited in-repo source-code analog. The *strong* analogs are the **config/build files** (tsconfig project references, ESLint flat config, package.json) — the scaffold already establishes the exact project-reference + per-directory-override conventions the engine must copy. The **engine source files** (`rng.ts`, `synthesis.ts`, schema modules) have **no TypeScript analog in `src/`** — their pattern source is the mock JS (`docs/subcosm-universe-mock.html`) + the spec interfaces (`docs/subcosm-requirements.md` §6) + the Zod code examples already provided in `01-RESEARCH.md`. This is called out explicitly per file rather than forcing a poor `src/shared/` match.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tools/tsconfig.engine.json` | config (build) | — | `tools/tsconfig.shared.json` | exact (role + structure) |
| `tsconfig.json` (MODIFY: add reference) | config (build) | — | `tsconfig.json` (self, existing `references[]`) | exact |
| `eslint.config.js` (MODIFY: add engine override) | config (lint) | — | `eslint.config.js` shared/server override blocks | exact |
| `package.json` (MODIFY: deps + test script) | config | — | `package.json` (self) | exact |
| `vitest.config.ts` | config (test) | — | `vite.config.ts` | role-match (different tool, same `defineConfig` shape) |
| `src/engine/rng.ts` | utility | transform | mock `mulberry32` (l.134) | exact (verbatim port) |
| `src/engine/synthesis.ts` | service (pure transform) | batch / transform | mock `genShell`/`starCount`/`lerp` (l.137–163) | exact (logic port) |
| `src/engine/render.ts` | service (orchestrator stub) | request-response | spec §7 `render(...)` signature; mock `shells=eras.map(genShell)` (l.165) | role-match (stub only) |
| `src/engine/contracts/DayVector.ts` | model (schema) | — | spec §6.1 interface + RESEARCH Zod example | role-match (spec→Zod translation) |
| `src/engine/contracts/Scene.ts` | model (schema) | — | spec §6.2 interfaces (Scene/Shell/Element/CoreNode) | role-match |
| `src/engine/contracts/Genome.ts` | model (schema) | — | spec §6.3 interface + RESEARCH dailyGoal/weights examples | role-match |
| `src/engine/contracts/StyleTemplate.ts` | model (schema) | — | spec §6.4 interface | role-match (typed now, instance Phase 2) |
| `src/engine/contracts/Personal.ts` | model (schema) | — | RESEARCH Pattern 3 (ActionBudget/PersonalState) | partial (net-new, no spec analog) |
| `src/engine/contracts/index.ts` | barrel (re-export) | — | (no `index.ts` in src/ yet) | no analog — see below |
| `src/engine/genomes/{calm,chaotic,crystalline}.ts` | config (data) | — | RESEARCH Pattern 2 (`GenomeSchema.parse({...})`) | partial (net-new data files) |
| `src/engine/**/*.test.ts` (rng/contracts/synthesis/presets) | test | — | RESEARCH Code Examples (vitest test blocks) | partial (no existing tests in repo) |
| `tests/fixtures.ts` (or co-located) | test (fixture) | — | mock `eras[]` array (l.116–131) | role-match (fixture data shape) |

## Pattern Assignments

### `tools/tsconfig.engine.json` (config, build) — STRONGEST ANALOG

**Analog:** `tools/tsconfig.shared.json` (read in full; 14 lines). Copy this structure exactly — it is the canonical "new pure project reference" pattern. `shared` is the best analog because, like the engine, it is a non-Node, browser-safe, dependency-free leaf project.

**Full analog** (`tools/tsconfig.shared.json` lines 1-14):
```jsonc
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "lib": ["WebWorker", "ES2023"],
    "outDir": "../dist/types/shared",
    "tsBuildInfoFile": "../dist/types/shared/tsconfig.tsbuildinfo",
    "rootDir": "../src/shared"
  },
  "include": ["../src/shared/**/*"],
  "exclude": []
}
```

**Engine adaptation:** set `"rootDir": "../src/engine"`, `"include": ["../src/engine/**/*"]`, `outDir`/`tsBuildInfoFile` → `../dist/types/engine`. Per RESEARCH, synthesis is DOM-free → `"lib": ["ES2023"]` (drop `WebWorker`; the `shared` analog keeps WebWorker only because Devvit shared code may run in a worker — engine does not need it). **Do NOT add a `references[]` block** (unlike `tsconfig.server.json`) — the engine must reference NO other project to stay isolated (RESEARCH "tsconfig wiring").

**Contrast analog** (`tools/tsconfig.server.json` lines 13-17) — shows how a `references[]` block looks; the engine deliberately OMITS this:
```jsonc
  "references": [
    { "path": "./tsconfig.shared.json" }
  ]
```

Note: `tsconfig.base.json` already sets `composite: true` + strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`) — the engine inherits all of these by extending base. Guard `Math.max(...day.topThreads)` against empty arrays (RESEARCH Pitfall 2) because `noUncheckedIndexedAccess` is on.

---

### `tsconfig.json` (MODIFY — add project reference)

**Analog:** the file itself (lines 1-9). Append one entry to the existing `references[]` array, matching the existing literal style:
```jsonc
{
  "files": [],
  "references": [
    { "path": "./tools/tsconfig.client.json" },
    { "path": "./tools/tsconfig.server.json" },
    { "path": "./tools/tsconfig.shared.json" },
    { "path": "./tools/tsconfig.vite.json" },
    { "path": "./tools/tsconfig.engine.json" }   // ADD THIS LINE
  ]
}
```
`npm run type-check` (`tsc --build`) then picks up the engine project.

---

### `eslint.config.js` (MODIFY — add engine boundary override) — STRONG ANALOG + ENG-03 enforcement

**Analog:** the existing per-directory override blocks (lines 20-31 `shared`, lines 8-19 `server`). Copy the block shape exactly, then add the `no-restricted-*` rules that the analogs do NOT have.

**Analog block to copy** (`eslint.config.js` lines 20-31, the `shared` override):
```js
{
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  files: ['src/shared/**/*.{ts,tsx,mjs,cjs,js}'],
  languageOptions: {
    ecmaVersion: 2023,
    globals: globals.browser,
    parserOptions: {
      project: ['./tools/tsconfig.shared.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
},
```

**Engine adaptation:** `files: ['src/engine/**/*.{ts,tsx}']`, `project: ['./tools/tsconfig.engine.json']`, `globals: globals.browser`, plus the ENG-03 rules (NOT present in any existing block):
```js
rules: {
  'no-restricted-imports': ['error', {
    patterns: ['@devvit/*', 'phaser', '*/client/*', '*/server/*'],
  }],
  'no-restricted-properties': ['error',
    { object: 'Math', property: 'random',
      message: 'Use mulberry32 from engine/rng.ts — determinism (ENG-03/SYN-01).' },
  ],
},
```

**Critical (RESEARCH Pitfall 5):** flat-config order matters — the trailing catch-all block at lines 45-67 sets rules for `'**/*.{js,mjs,cjs,ts,tsx}'`. Place the engine override so its `no-restricted-*` rules win for `src/engine/**`. Use `no-restricted-properties` for `Math.random` ONLY — do NOT ban `Math` globally (synthesis needs `Math.imul/max/floor/PI/cos/sin`). Verify with a planted `Math.random()` fixture → `npm run lint` must error, then delete it.

Note: the lint script is `eslint 'src/**/*.{ts,tsx}'` (package.json line 12) — already globs `src/engine/`, no script change needed for lint coverage.

---

### `package.json` (MODIFY — deps + test script)

**Analog:** the file itself. Add `"zod": "4.4.3"` to `dependencies`, `"vitest": "4.1.9"` (+ optional `"@vitest/coverage-v8": "4.1.9"`) to `devDependencies`, and `"test": "vitest run"` to `scripts` (sits alongside existing `"type-check": "tsc --build"`). Install via `npm install zod && npm install -D vitest`. Commit `package-lock.json`.

---

### `vitest.config.ts` (config, test)

**Analog:** `vite.config.ts` (lines 1-15) — same `defineConfig` idiom, ESM, `type: "module"` project.
```ts
import { defineConfig } from 'vite';   // analog pattern
export default defineConfig({ plugins: [ devvit({ ... }) ] });
```
**Adaptation:** `import { defineConfig } from 'vitest/config'`; minimal config to discover `src/engine/**/*.test.ts`. Keep it standalone — do NOT pull in the `devvit()` Vite plugin (the engine test run must not load Devvit). Per RESEARCH this may be optional if the Vite config is reused; prefer an explicit `vitest.config.ts` for isolation.

---

### `src/engine/rng.ts` (utility, transform) — VERBATIM MOCK PORT

**Analog / source:** `docs/subcosm-universe-mock.html` line 134 (`mulberry32`). No `src/` analog exists. Port verbatim into a typed export:
```ts
// docs/subcosm-universe-mock.html line 134 (source of truth — port verbatim)
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
```
Typed TS form is in `01-RESEARCH.md` lines 380-388. Add a doc comment: non-cryptographic, deterministic-by-design (RESEARCH Security V6). This is the **only** entropy source in the engine.

---

### `src/engine/synthesis.ts` (service / pure transform, batch) — MOCK LOGIC PORT

**Analog / source:** `docs/subcosm-universe-mock.html` lines 137-163 (`starCount`, `genShell`, `lerp`). No `src/` analog. Port the logic, substituting fields per the RESEARCH port table (lines 206-221).

**Source `genShell` + helpers** (mock lines 137-163):
```js
function starCount(p){return Math.max(5,Math.min(112,Math.round(p*0.30)));}
function genShell(i){
  const e=eras[i]; const isToday=i===0;
  if(e.genesis) return [];
  const salt=isToday?(todaySym*131+Math.round(todayHue)*7):0;
  const rng=mulberry32((i*9973+7)^salt);              // ← REPLACE with day.seed
  const n=starCount(e.posts);                          // ← day.posts + Genome density knob
  const arms=isToday?(1+todaySym):(e.conflict>.7?1:(e.posts>300?3:2));  // ← Genome symmetry/density
  const spread=isToday?(0.20+todayBranch*1.8):(0.18+e.conflict*0.55);   // ← Genome volatility/spread
  const clumps=Math.max(1,Math.round(1+e.conflict*5));
  const nbig=Math.max(0,Math.min(6,Math.round(e.top/280)));             // ← max(day.topThreads)/280
  const arr=[];
  for(let s=0;s<n;s++){ /* ang/arms/clumps/rj/bright/redshift per mock l.151-160 */ }
  return arr;
}
function lerp(a,b,t){return a+(b-a)*t;}
```

**Mandatory deviations from the mock (RESEARCH Anti-Patterns + Critical note l.222):**
- Seed from `day.seed`, NOT `i*9973+7` (index-based seed breaks under Redis ordering — SYN-01).
- Drop the `isToday`/`todaySym`/`todayHue`/`todayBranch` live globals → read `day.steering.{symmetry,branch,hue}` (port table l.215-217).
- Replace literal magic numbers (`0.30`, `0.18`, `0.55`, arm thresholds) with `Genome` knobs so Calm/Chaotic/Crystalline diverge (TPL-03).
- `Element.hue` is a 0–1 HINT, never a color (ENG-02).
- Build each Element/Shell as ONE fixed-key object literal — no conditional spreads (RESEARCH Pitfall 3, key-order determinism).
- No `.parse()` inside `synthesize` — trust `z.infer` types (RESEARCH Anti-Patterns; QA-03).
- `topThreads` reduction: `Math.max(0, ...day.topThreads)`, guard empty array → `0` (Pitfall 2).

**Fixture-data analog** (mock `eras[]` lines 116-131): the 14-entry `eras` array is the shape template for `tests/fixtures.ts` — reuse its day/posts/conflict/top/genesis fields to build the `DayVector[]` fixtures (cold-start day-1, dense/high-conflict, high-`top` AMA day).

---

### `src/engine/render.ts` (orchestrator stub, request-response)

**Analog / source:** spec §7 `render(DayVector[], Genome, StyleTemplate) → frames` (requirements line 199) + mock `shells=eras.map((_,i)=>genShell(i))` (line 165, the synthesis-driver loop). **Phase-1 STUB only** (RESEARCH A4 / Open Question 1 — flag for user): wire `synthesize` only; declare `scrub/nudge/regenerate/destroy` as `TODO`/throwing stubs. Paint/camera attach in Phase 2.

---

### `src/engine/contracts/*.ts` (model / Zod schemas)

**Analog / source:** spec `docs/subcosm-requirements.md` §6.1 (DayVector, l.115), §6.2 (Scene/Shell/Element/CoreNode, l.137-144), §6.3 (Genome incl. `weights` matrix, l.153-157), §6.4 (StyleTemplate, l.171). The TS-`interface`→Zod translation pattern + exact field examples are already authored in `01-RESEARCH.md` Code Examples (lines 312-374): `DayVectorSchema` (l.318-338), `GoalTypeEnum`/`DailyGoalSchema` (l.345-358), `WeightsSchema` (l.368-372). No `src/` Zod analog exists (`src/shared/api.ts` uses hand-written `type` aliases — the engine must do the OPPOSITE: `z.infer` only, ENG-01/CLAUDE.md).

**Mandatory per CLAUDE.md + ENG-01:** every type is `export type X = z.infer<typeof XSchema>` — NO hand-written interfaces. The §6 spec interfaces are the *shape source*, not the output form. Re-verify the Zod v4 `z.record`/`z.partialRecord` weights-matrix helper via `ctx7 docs /colinhacks/zod` at impl time (RESEARCH A2). Import from package root: `import { z } from "zod"`.

---

### `src/engine/contracts/Personal.ts` (model) — NET-NEW, see "No Analog"

### `src/engine/genomes/{calm,chaotic,crystalline}.ts` (data) — NET-NEW

**Source:** RESEARCH Pattern 2 (lines 228-238). Each preset is `export const calm: Genome = GenomeSchema.parse({ ... })` — plain data validated at module load, no engine branches. Crystalline = low `volatility`, high `inheritance`, high symmetry knobs (RESEARCH Open Q3); `actionCap: 3` default on all (D-04). `.parse()` here is legitimate (module-load boundary, not inside synthesis).

---

## Shared Patterns

### TypeScript project-reference isolation
**Source:** `tools/tsconfig.shared.json` (leaf project) + `tools/tsconfig.base.json` (shared strict base) + `tsconfig.json` `references[]`.
**Apply to:** `tools/tsconfig.engine.json` + the `tsconfig.json` modification.
The engine copies the `shared` leaf pattern but references NOTHING (isolation). All strict flags inherited from `tsconfig.base.json` (lines 5-16): `composite`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`.

### Per-directory ESLint override + boundary ban
**Source:** `eslint.config.js` lines 8-44 (server/shared/client override blocks).
**Apply to:** the new `src/engine/**` override.
Copy the `files` + `languageOptions.parserOptions.project` shape; ADD `no-restricted-imports` (`@devvit/*`, `phaser`, cross-dir) + `no-restricted-properties` (`Math.random`). Order the block to win over the catch-all (lines 45-67).

### Zod single-source-of-truth (`z.infer` only)
**Source:** `CLAUDE.md` §1 + `01-RESEARCH.md` Code Examples (lines 312-374). NOT `src/shared/api.ts` (that uses forbidden hand-written `type` aliases).
**Apply to:** ALL `src/engine/contracts/*.ts`.
Schema first; `export type X = z.infer<typeof XSchema>`; no duplicate interfaces; `as` casts forbidden.

### Determinism discipline
**Source:** mock `mulberry32` (l.134) as sole entropy; RESEARCH Anti-Patterns + Pitfalls 3/4.
**Apply to:** `rng.ts`, `synthesis.ts`, all determinism tests.
Seed from `day.seed`; fixed-key object literals; no `Math.random`; no quantization unless a test proves drift.

### `defineConfig` ESM config idiom
**Source:** `vite.config.ts` (lines 1-4).
**Apply to:** `vitest.config.ts`.

## No Analog Found

Files with no close in-repo match — the planner uses the cited mock/spec/RESEARCH source instead:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/engine/contracts/Personal.ts` | model | — | No personal-layer/ActionBudget concept exists anywhere in repo or spec §6; design from RESEARCH Pattern 3 + D-04. Test must assert `SceneSchema` has no `actionsUsed`/`userId` (GAME-05). |
| `src/engine/contracts/index.ts` | barrel | — | No `index.ts`/barrel re-export exists in `src/` yet. Simple re-export of all schemas + inferred types; no analog needed. |
| `src/engine/**/*.test.ts` | test | — | Repo currently has ZERO tests and no test runner. Pattern source = RESEARCH Code Examples (lines 391-417): `expect(a).toEqual(b)` + `JSON.stringify` equality for byte-identical; preset-divergence asserts element-count/JSON inequality. |
| `tests/fixtures.ts` | test fixture | — | Closest shape is the mock `eras[]` array (l.116-131), but as `DayVector[]` it is net-new. |

## Metadata

**Analog search scope:** `tools/`, `src/{client,server,shared}/`, repo-root configs (`tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `package.json`), `docs/subcosm-universe-mock.html` (port source), `docs/subcosm-requirements.md` §6/§7 (contract source).
**Files scanned:** ~20 (5 tsconfig, eslint config, vite config, package.json, src/shared/api.ts, mock synthesis block, spec §6).
**Pattern extraction date:** 2026-06-19

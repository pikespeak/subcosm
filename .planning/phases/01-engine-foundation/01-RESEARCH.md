# Phase 1: Engine Foundation - Research

**Researched:** 2026-06-19
**Domain:** Pure deterministic TypeScript synthesis engine — Zod-schema contracts, seeded RNG (mulberry32), config-driven template engine, render-agnostic core (no UI/paint/DB/Devvit)
**Confidence:** HIGH (stack + porting source are fully in-repo and verified; the only MEDIUM items are exact Zod field shapes, which are Claude's discretion per D-anything)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Ship **three** genome presets — **Calm** and **Chaotic** (max-contrast poles: volatility / density / conflict-reaction), plus a third thematic preset **Crystalline** (high symmetry + inheritance, cool, faceted; per spec §4.4 preset examples). All three share the Techno style and differ **only in genome data**. Crystalline's final palette/look is decided in Phase 2 (when visible); Phase 1 sets its genome values.
- **D-02:** The presets are how TPL-03 is proven: same `DayVector[]` → visibly different `Scene` output (density, volatility, shell shape) with **zero engine code change**.
- **D-03:** The `dailyGoal` type enum is a **mix** of form-goals and activity-goals. Form: reach symmetry, keep conflict below a threshold, ignite a rare star/gene. Activity: reach a star/density threshold, reach a contributor count. Schema shape ≈ `{ type, targetParam, threshold, direction }`. **Scoring logic is Phase 4** — Phase 1 only defines the schema + the enum.
- **D-04:** The per-user daily action cap is a **Genome field** (`actionCap`), **default 3**, tunable per community. It lives on the **personal layer**, structurally distinct from all community-layer fields. Small default = scarcity makes nudges meaningful and leaves room for fair "extra actions" monetization later (never buying the shared outcome).
- **D-05:** The Genome schema types the **full spec §6.3 surface** (including the Signal→Param `weights` matrix), but Phase-1 synthesis only **exercises the mock's genShell heuristic fields**. The weights matrix stays **typed-but-unused** until Week 2 — no later schema break. Consistent with build-for-flexibility + Zod single-source-of-truth.

### Claude's Discretion
- Exact Zod field names/shapes, the mulberry32 implementation, the `genShell()` port details, the ESLint config (ban `Math.random` + `@devvit/*`/`phaser` imports in `src/engine/`), the Scene/Element shape mapping from the mock, and the test structure are the planner's to design — as long as the decisions above hold and **every contract type is `z.infer` only** (no hand-written interfaces).

### Deferred Ideas (OUT OF SCOPE)
- **Full Signal→Param weight matrix exercised** (not just typed) — Week 2.
- **Daily guess + streaks** (game stage 2), **collection** (stage 3), **monetization** (Devvit Payments, fair/cosmetic) — later phases / stretch.
- **Connected multiverse** outer zoom tier — post-MVP; Phase 1 only keeps the coordinate model embeddable (no implementation, design-review item in Phase 2 camera work).
- **Crystalline final palette/look** — decided in Phase 2 when rendering is visible.
- **Paint / rendering / Phaser** (Phase 2), the **data simulator** (Phase 2), **Devvit wiring** (Phase 3), **goal-scoring logic / live game** (Phase 4).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | All four contracts are Zod schemas; every TS type is `z.infer` (no hand-written interfaces) | §6.1–6.4 of `subcosm-requirements.md` gives the exact interface shapes to translate to Zod. Zod v4 `z.infer` pattern verified (Context7). See Standard Stack + Code Examples. |
| ENG-02 | Synthesis decoupled from paint — synthesis imports no style code; `Scene` is the only seam | Phase 1 has no paint at all, so this is satisfied *by construction*: synthesis returns a style-agnostic `Scene` (geometry + 0–1 hue-hint, never colors). Anti-Pattern 2 below. |
| ENG-03 | `src/engine/` has zero Devvit imports, is pure + unit-testable; ESLint bans `Math.random()` + Devvit imports | ESLint flat-config (eslint 10) override scoped to `src/engine/**` — `no-restricted-imports` for `@devvit/*` + `phaser`, `no-restricted-properties`/`no-restricted-syntax` for `Math.random`. See "ESLint Boundary Enforcement". |
| ENG-04 | A single `render(...)` entry orchestrates synthesis → paint → camera, exposes scrub/nudge/regenerate/destroy | **Phase 1 ships only the synthesis seam of this entry.** Define the orchestrator signature/stub so Phase 2 paint/camera bolt on; do NOT implement paint/camera. Note in Open Questions. |
| TPL-01 | A new/altered Genome or StyleTemplate is pure data — zero engine-code changes | Genome is injected into `synthesize(days, genome)`; presets are data files. Verified by D-02 mechanism. |
| TPL-02 | Genome carries per-community knobs as data; StyleTemplate carries design as data | §6.3 / §6.4 enumerate every field. Genome schema types the full surface (D-05). StyleTemplate schema is typed in Phase 1 but only the Techno instance is authored in Phase 2. |
| TPL-03 | ≥2 selectable Genome presets, same style, different params; switching changes the universe from the same `DayVector[]` | **Three** presets (D-01). Proof mechanism = a test that synthesizes the same fixture `DayVector[]` through Calm/Chaotic/Crystalline and asserts the Scenes differ in density/volatility/shell shape. See "TPL-03 Proof". |
| TPL-04 | One style per community is genome-driven; engine never assumes a hard-coded look | `Genome.style: StyleId` selects the style. Synthesis never reads it (paint does, Phase 2). |
| SYN-01 | Deterministic via seeded mulberry32 — one closure per DayVector, fixed consumption order | Port `mulberry32` from the mock (line 134). Thread one closure per DayVector seeded from `DayVector.seed`. See "Byte-Exact Determinism". |
| SYN-02 | Two synthesis calls with identical inputs → byte-identical Scene (determinism test) | Deep-equal + JSON-serialization-equality test. See "Asserting Byte-Identical". |
| SYN-03 | Ports the mock's `genShell()` logic, mapping DayVector fields to shell elements at visual parity | The mock's `genShell()` (lines 140–162) is the source of truth. Field-by-field port table below. |
| SYN-04 | Changing data visibly changes the universe (sparse vs dense, conflict turbulence, AMA clusters) | Driven by `posts → starCount`, `conflict → arms/spread/redshift`, `top → nbig`. Same heuristic as mock. |
| GAME-01 | Each day carries a goal ("genome quest") as data; legible at dawn | `dailyGoal` schema on Genome (D-03), shape `{ type, targetParam, threshold, direction }`; `outcome` field on DayVector; `goalAchieved` on Scene. Phase 1 = schema only, no scoring. |
| GAME-05 | Daily player actions are a budgeted, countable per-user resource on a personal layer separate from the community layer | `actionCap` Genome field default 3 (D-04) + a structurally distinct personal-layer shape (e.g. `PersonalState`/`ActionBudget` schema) kept out of the community `Scene`. Test asserts the separation. |
</phase_requirements>

## Summary

This phase is a **pure functional core**: four Zod schemas, a seeded RNG, and a deterministic `synthesize(DayVector[], Genome) → Scene` function. There is no rendering, no DOM, no canvas, no Devvit, no database. Every input needed to write it is already in the repo: the four contract shapes are specified almost verbatim in `docs/subcosm-requirements.md` §6, and the synthesis algorithm + RNG already exist as working JavaScript inside `docs/subcosm-universe-mock.html` (the `mulberry32` function at line 134 and the `genShell()` function at lines 140–162). The work is a **faithful port** of two known functions plus schema authoring — not a green-field design problem.

The dominant technical risk is **determinism leakage**: a single `Math.random()` (the mock uses it in non-synthesis code — `bgStars`, the live feed, the `intro` animation, all of which are out of scope) or non-deterministic object-key ordering would silently break the "byte-identical Scene" guarantee that the entire architecture rests on. This is mitigated structurally, not by discipline: an ESLint rule scoped to `src/engine/**` bans `Math.random` and `@devvit/*`/`phaser` imports *before any mock code is ported*, mulberry32 is the only entropy source, and a snapshot/deep-equal determinism test is written alongside synthesis.

The second risk is **scaffold mismatch**: the existing repo is NOT the vanilla-ts setup that `.planning/research/` assumed. It is a **Devvit Phaser Web template** with TypeScript project references (`tsc --build`), an ESLint flat config (eslint 10), and `phaser` already installed — but **`zod` and `vitest` are absent and must be added**. The plan must add `src/engine/` as a *fourth* tsconfig project reference and a *fourth* ESLint override, not bolt onto the existing `client`/`server`/`shared` configs.

**Primary recommendation:** Build strictly bottom-up in one phase: (1) add `zod` + `vitest` + the `src/engine/` tsconfig project + the ESLint engine-boundary override; (2) author the four Zod schemas with `z.infer` types and `.parse`-roundtrip tests; (3) port `mulberry32` to `src/engine/rng.ts` with a sequence-stability test; (4) port `genShell()` to `src/engine/synthesis.ts`, replacing the hardcoded `eras[]` with `DayVector` fields and the literal magic numbers with `Genome` fields, with a byte-identical determinism test and a three-preset divergence test. Keep `render()` as a typed stub that only calls synthesis.

## Architectural Responsibility Map

> All capabilities in this phase live in the **pure engine tier**. There is no browser, server, CDN, or database tier in scope. The "tiers" below are the engine's internal module boundaries.

| Capability | Primary Module | Secondary Module | Rationale |
|------------|---------------|------------------|-----------|
| Contract definitions (4 Zod schemas) | `src/engine/contracts/` | — | Root of all types; nothing else defines these shapes. `zod`-only imports. |
| Seeded randomness | `src/engine/rng.ts` | — | Single importable `mulberry32` factory; the *only* entropy source in the engine. Makes the `Math.random` ban trivially enforceable. |
| DayVector → Scene transform | `src/engine/synthesis.ts` | `rng.ts`, `contracts/` | Pure geometry/heuristic math; style-agnostic; consumes one RNG closure per DayVector. |
| Genome presets (data) | `src/engine/genomes/` (or `src/genomes/`) | `contracts/Genome` | Calm/Chaotic/Crystalline are *data files* validated against `GenomeSchema`, not code. |
| Orchestration entry (stub) | `src/engine/render.ts` | `synthesis.ts` | Phase-1 stub: signature exists, only synthesis is wired. Paint/camera land in Phase 2. |
| Personal layer / action budget | `src/engine/contracts/` (`PersonalState`/`ActionBudget`) | — | Structurally distinct from `Scene` (community layer). Schema only in Phase 1. |

**Boundary note:** Paint, camera, simulator, and Devvit are explicitly *not* in this phase. The plan must create the seams (`render` stub, `Scene` output, `StyleTemplate` schema) so they attach later with zero synthesis rework — but must not implement them.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `4.4.3` | Single source of truth for all four contracts; `z.infer` types; `.parse()` at the (future) sim→engine boundary | Mandated by `CLAUDE.md` (Zod single-source-of-truth standard); v4 is ~6.5× faster object parsing than v3; `[VERIFIED: npm registry]` 201.9M weekly downloads, official `colinhacks/zod` repo |
| `vitest` | `4.1.9` | Unit test runner for the pure engine (determinism, schema-validity, divergence tests) | Zero-config for TS-strict, reuses the existing Vite 8 pipeline already in `package.json`; `[VERIFIED: npm registry]` 71.3M weekly downloads, official `vitest-dev/vitest` repo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | `4.1.9` | Coverage reporting (optional but cheap; engine should approach 100% line coverage given it's pure) | Add if the planner wants a coverage gate; not required by any REQ. `[VERIFIED: npm registry]` 27.5M weekly downloads |

### Already installed (reuse, do NOT re-add)
| Library | Version | Note |
|---------|---------|------|
| `vite` | `8.0.16` | Build/dev server already present; Vitest reuses its config. |
| `typescript` | `6.0.3` | Strict project-reference build (`tsc --build`) already configured. |
| `eslint` + `typescript-eslint` | `10.4.0` / `8.59.4` | Flat config (`eslint.config.js`) already present — extend it, do not replace it. |
| `phaser` | `4.1.0` | Installed for Phase 2 paint. **Must be ESLint-banned inside `src/engine/`** (ENG-03). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `mulberry32` (inline) | `seedrandom` npm package | Adds a dependency + a slopsquatting surface for ~5 lines of code. The mock already uses mulberry32; switching RNG would re-derive every future seed. **Stick with mulberry32 inline (D: Claude's discretion).** |
| `vitest` | `node:test` (built-in) | `node:test` has no Vite integration and weaker watch/snapshot ergonomics. Vitest reuses the existing Vite pipeline — lower friction. |
| Zod | hand-written TS interfaces | Forbidden by `CLAUDE.md` and ENG-01 (`z.infer` only). |

**Installation:**
```bash
npm install zod
npm install -D vitest @vitest/coverage-v8
```

**Version verification (run 2026-06-19):**
- `npm view zod version` → `4.4.3` (modified 2026-05-04) `[VERIFIED: npm registry]`
- `npm view vitest version` → `4.1.9` `[VERIFIED: npm registry]`
- `npm view @vitest/coverage-v8 version` → `4.1.9` `[VERIFIED: npm registry]`
- `npm view vite version` → `8.0.16` (repo has `8.0.13` — compatible; Vitest 4 supports Vite 6/7/8) `[VERIFIED: npm registry]`

> **Zod import path (Zod v4):** import from the package root `import { z } from "zod"`. Zod v4 is shipped from the same package; there is no separate `zod/v4` install needed. Confirm the exact subpath with `ctx7 docs /colinhacks/zod` at implementation time if the planner wants the `zod/v4-mini` tree-shaken variant (not needed for an engine that parses only at boundaries). `[CITED: zod.dev]`

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|-------------|---------|-------------|
| `zod` | npm | 2026-05-04 | 201.9M/wk | github.com/colinhacks/zod | OK | Approved |
| `vitest` | npm | 2026-06-15 | 71.3M/wk | github.com/vitest-dev/vitest | SUS (too-new) → **resolved** | Approved |
| `@vitest/coverage-v8` | npm | 2026-06-15 | 27.5M/wk | github.com/vitest-dev/vitest | SUS (too-new) → **resolved** | Approved (optional) |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `vitest`, `@vitest/coverage-v8` — flagged only on the **`too-new`** signal because their latest patch (`4.1.9`) was published 4 days ago. This is a **false positive**: both have tens of millions of weekly downloads, no postinstall script, no deprecation, and resolve to the official `vitest-dev/vitest` monorepo. The `too-new` heuristic measures the *latest version's* publish date, which for an actively maintained package is always recent. **No `checkpoint:human-verify` task is required** — the download volume + official repo provenance override the age signal. The planner should pin to `4.1.9` (or the then-current 4.x) and proceed.

*No package in this phase was discovered via WebSearch or training-data-only; all three were named in the settled `.planning/research/SUMMARY.md` stack and verified against the npm registry + Context7 (Zod) this session.*

## Architecture Patterns

### System Architecture Diagram (Phase-1 scope only)

```
                       ┌─────────────────────────────────────────────┐
   (Phase 2 simulator) │  TEST FIXTURES / future DayVector[] source   │
        ──────────────▶│  raw day objects                            │
                       └───────────────────┬─────────────────────────┘
                                           │
                          DayVectorSchema.parse()   ◀── Zod boundary
                          (in tests + future sim;      (parse ONCE here,
                           NOT inside synthesis)         never in synthesis)
                                           │
                                  DayVector[] (typed, validated)
                                           │
   Genome (data file:                      │
   Calm / Chaotic / Crystalline) ──────────┤
   GenomeSchema-validated                  ▼
                       ┌─────────────────────────────────────────────┐
                       │  synthesize(days, genome): Scene             │
                       │  ── PURE, STYLE-AGNOSTIC ──                  │
                       │  for each DayVector:                         │
                       │    rng = mulberry32(day.seed)   ← one closure│
                       │    genShell(day, genome, rng) → Element[]    │
                       │    (posts→starCount, conflict→arms/spread/   │
                       │     redshift, top→nbig, genome knobs)        │
                       │  returns Scene{ core, shells[], goalAchieved}│
                       │  hue is a 0–1 HINT, never a color            │
                       └───────────────────┬─────────────────────────┘
                                           │ Scene (geometry only)
                                           ▼
                       ┌─────────────────────────────────────────────┐
                       │  render(days, genome, style)  ── STUB ──     │
                       │  Phase 1: calls synthesize only.             │
                       │  Phase 2 attaches paint(Scene,StyleTemplate) │
                       │  and camera here. Signature defined now.     │
                       └─────────────────────────────────────────────┘

  PERSONAL LAYER (structurally separate, schema-only in Phase 1):
   ActionBudget / PersonalState { actionsUsed, cap, ... }  ── NEVER part of Scene ──
```

A reader can trace the primary use case: a validated `DayVector[]` + a `Genome` data file enter `synthesize`, which threads one mulberry32 closure per day through the ported `genShell` heuristic and returns a style-agnostic `Scene`. The `render` stub is the named seam where Phase 2 paint/camera will attach.

### Recommended Project Structure
```
src/
├── engine/                      # NEW — pure, zero Devvit/phaser imports
│   ├── contracts/
│   │   ├── DayVector.ts         # DayVectorSchema + outcome field; export type DayVector = z.infer<...>
│   │   ├── Scene.ts             # SceneSchema, ShellSchema, ElementSchema, CoreNodeSchema; goalAchieved
│   │   ├── Genome.ts            # GenomeSchema (full §6.3 surface) + dailyGoal + actionCap
│   │   ├── StyleTemplate.ts     # StyleTemplateSchema (typed now, Techno instance authored Phase 2)
│   │   ├── Personal.ts          # ActionBudget / PersonalState — personal layer, distinct from Scene
│   │   └── index.ts             # re-export all schemas + inferred types
│   ├── rng.ts                   # mulberry32(seed: number): () => number   (ported from mock l.134)
│   ├── synthesis.ts             # synthesize(days, genome): Scene          (ported from mock genShell)
│   ├── genomes/                 # data files (validated against GenomeSchema)
│   │   ├── calm.ts
│   │   ├── chaotic.ts
│   │   └── crystalline.ts
│   └── render.ts                # render(days, genome, style) STUB — synthesis only in Phase 1
├── client/  src/server/  src/shared/   # EXISTING Devvit/Phaser scaffold — untouched this phase
tests/  (or src/engine/**/*.test.ts co-located — planner's choice)
├── rng.test.ts                  # sequence stability for a fixed seed
├── contracts.test.ts            # parse valid fixtures; safeParse rejects invalid; field-presence checks
├── synthesis.test.ts            # byte-identical determinism; SYN-04 data-sensitivity
└── presets.test.ts              # TPL-03: same DayVector[] through 3 presets → diverging Scenes
```

> **tsconfig wiring:** add a new `tools/tsconfig.engine.json` (extends `tsconfig.base.json`, `rootDir: ../src/engine`, browser-safe `lib` — `["ES2023"]`, no DOM needed for pure synthesis) and register it in the root `tsconfig.json` `references[]`. The engine must NOT reference `client`/`server`/`shared` projects (keeps it isolated). `[CITED: existing tools/tsconfig.*.json]`

### Pattern 1: Faithful port of `genShell()` with field substitution
**What:** The mock's `genShell(i)` reads the hardcoded `eras[i]` array and three live globals (`todaySym`, `todayHue`, `todayBranch`). The port reads a `DayVector` and a `Genome` instead.
**When to use:** This is the core of SYN-03.
**Mock → Phase-1 field map (port table):**

| Mock expression | Phase-1 source | Notes |
|---|---|---|
| `e.posts` | `day.posts` | drives `starCount` |
| `e.conflict` | `day.conflict` | drives arms, spread, clumps, redshift probability |
| `e.top` | derive from `day.topThreads` (e.g. `max(topThreads)`) | drives `nbig`; §6.1 has `topThreads: number[]`, mock has scalar `top` — pick a reduction (max or sum) and document it |
| `e.genesis` | `day.day === 1` | genesis day returns `[]` elements (core only) |
| `e.hue` | derive a 0–1 **hue-hint** from `dominantTheme`/`day` | **NOT a color** — Scene stays style-agnostic; paint maps hint→palette in Phase 2 |
| `todaySym` (live steer) | `day.steering.symmetry` | replaces the live global |
| `todayBranch` | `day.steering.branch` | replaces the live global |
| `todayHue` | `day.steering.hue` | replaces the live global |
| literal `0.30` in `starCount` | `Genome` density knob (`ranges`/`baseVar`) | makes Calm vs Chaotic diverge |
| literal `0.18`, `0.55` in `spread` | `Genome.volatility` / a spread knob | conflict-reaction differs per preset |
| literal `arms` thresholds (`>.7`, `>300`) | `Genome` symmetry/density knobs | Crystalline = high symmetry → more arms |

**Critical:** the mock's `salt = isToday ? (todaySym*131 + round(todayHue)*7) : 0` and `rng = mulberry32((i*9973+7)^salt)` seed pattern must be replaced with a **per-DayVector seed** (`day.seed`, already `hash(subId, day, genomeVersion)` per §6.1). Do NOT keep the index-based `i*9973` seed — that breaks when DayVectors arrive from Redis in a different order. `[VERIFIED: mock source lines 144–162]`

### Pattern 2: Genome/Style as data, not code (template engine)
**What:** Presets are plain objects validated by `GenomeSchema.parse()`. `synthesize` reads genome fields; it has no `if (preset === 'calm')` branches.
**When to use:** TPL-01/TPL-03. This is the entire "config-driven template engine" claim.
**Example:**
```ts
// engine/genomes/chaotic.ts
import { GenomeSchema, type Genome } from "../contracts";
export const chaotic: Genome = GenomeSchema.parse({
  version: 1, style: "techno",
  volatility: 0.85, inheritance: 0.15,
  // ...density/spread knobs tuned high; weights typed-but-unused (D-05)
  actionCap: 3,
  // ...
});
```

### Pattern 3: Personal layer kept out of the community Scene (GAME-05)
**What:** `ActionBudget`/`PersonalState` is a separate schema. `Scene` (the shared deterministic community universe) never embeds per-user state. `actionCap` lives on `Genome` (per-community policy); per-user *consumption* lives on the personal schema.
**Why:** Lets fair/cosmetic monetization + ethical retention bolt on later without touching synthesis (constraint in REQUIREMENTS §Constraints + D-04).
**Test:** assert `SceneSchema` has no `actionsUsed`/`userId` field and that `PersonalState` is a distinct exported type.

### Anti-Patterns to Avoid
- **Synthesis returning colors:** `Scene.Element.hue` must be a 0–1 hint, not an `hsl()` string. Colors belong to `StyleTemplate`/paint (Phase 2). Returning a color here breaks ENG-02 and is unfixable without a contract change.
- **`Math.random()` anywhere in `src/engine/`:** the mock uses it for `bgStars`, the live feed, and the intro animation — all of which are OUT of Phase-1 scope. Do not port them. Ban it via ESLint before porting.
- **Index-based RNG seed (`i*9973`):** non-portable across Redis ordering. Seed from `day.seed`.
- **`.parse()` inside `synthesize`:** parse at the boundary (tests/sim), trust `z.infer` types inside the engine. (REQUIREMENTS QA-03.)
- **Hand-written `interface DayVector`:** forbidden — `z.infer` only (ENG-01, `CLAUDE.md`).
- **Non-deterministic key ordering:** build Scene/Element objects with a fixed literal key order; never `Object.assign` from an iteration whose order depends on a `Set`/`Map` insertion you don't control.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime validation + types | Custom validators + parallel `interface`s | `zod` `z.infer` | Mandated by CLAUDE.md; one source of truth; v4 is fast enough at boundaries |
| Seeded PRNG | A new RNG algorithm | Port the mock's `mulberry32` verbatim | Already battle-tested in the mock; switching re-derives all seeds; ~5 lines |
| Test runner / snapshot / deep-equal | Custom assert harness | `vitest` (`expect().toEqual`, `toMatchSnapshot`) | Reuses Vite pipeline; deep-equal + snapshot are exactly the determinism tools needed |
| Deep equality for "byte-identical" | Hand-rolled recursive compare | `expect(a).toEqual(b)` + `JSON.stringify(a) === JSON.stringify(b)` | Vitest `toEqual` is structural; JSON-string equality catches key-order drift |

**Key insight:** Phase 1 is almost entirely *porting two existing functions and translating four documented interfaces into Zod*. The temptation to "improve" the synthesis math or redesign the RNG is the main hand-rolling trap — visual parity with the mock (SYN-03) requires faithfulness, not cleverness.

## Runtime State Inventory

> This is a green-field, code-only phase (new `src/engine/` modules + new dev dependencies). There is no rename/refactor of existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB/Redis in Phase 1 scope (Redis schema §6.5 is Phase 3). | None |
| Live service config | None — no Devvit services touched. The existing `devvit.json` is for the unrelated scaffold and is not modified. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None — pure engine has no secrets/env. | None |
| Build artifacts | `package-lock.json` will change (new deps `zod`/`vitest`); a new `tools/tsconfig.engine.json` + root `tsconfig.json` `references[]` entry; `dist/types/engine` build-info on `tsc --build`. | Run `npm install`; commit lockfile; verify `tsc --build` picks up the new project. |

**Nothing found in 4 of 5 categories** — verified by absence of any datastore/Devvit/OS integration in this phase's boundary.

## Common Pitfalls

### Pitfall 1: Porting the mock's non-synthesis randomness
**What goes wrong:** Copy-pasting `genShell` neighbours from the mock drags in `Math.random()` (`bgStars` line 170, live feed line 302, the `intro`/`rot` animation in `frame()`).
**Why it happens:** The mock interleaves the pure synthesis with the render loop and the demo UI.
**How to avoid:** Port ONLY `mulberry32` (l.134) and `genShell` (l.140–162) + `lerp`/`starCount` helpers. The ESLint `Math.random` ban (set up *first*) will hard-fail any leakage at lint time.
**Warning signs:** Lint error in `src/engine/`; a determinism test that passes intermittently.

### Pitfall 2: `topThreads: number[]` vs the mock's scalar `top`
**What goes wrong:** The mock's `nbig = clamp(round(e.top/280))` uses a single `top` number, but §6.1 specifies `topThreads: number[]`.
**Why it happens:** The contract is richer than the mock's flat fixture.
**How to avoid:** Choose and **document** a reduction (e.g. `const top = Math.max(0, ...day.topThreads)`), apply it once at the top of the per-day synthesis. Keep it deterministic (no float surprise).
**Warning signs:** `nbig` always 0, or `NaN` from `Math.max()` of an empty array (guard empty with `0`).

### Pitfall 3: Byte-identical failing on object key order
**What goes wrong:** `toEqual` passes but `JSON.stringify(a) === JSON.stringify(b)` fails, or vice-versa across environments, because Element objects are assembled with conditional/spread key insertion.
**Why it happens:** JS preserves insertion order; conditional spreads (`...(cond ? {x} : {})`) change key order between elements.
**How to avoid:** Construct each Element/Shell with a single fixed object literal (all keys always present, defaults for absent ones). Test both `toEqual` AND JSON-string equality.
**Warning signs:** Determinism test green locally, red in CI; snapshot diffs that only reorder keys.

### Pitfall 4: Float non-determinism fear (over-engineering)
**What goes wrong:** The planner adds rounding/quantization "for determinism" that diverges from the mock's visual output.
**Why it happens:** Misapplied advice about float determinism.
**How to avoid:** IEEE-754 double arithmetic IS deterministic within a single JS engine for the same operation sequence (the real cross-engine risk is transcendentals like `Math.sin`, which synthesis can avoid or use identically client/server). `mulberry32` uses only integer ops + one division — fully deterministic. Same-input/same-Scene holds without quantization. Only quantize if a *specific* test shows drift. `[CITED: ECMAScript spec — Number arithmetic is deterministic; Math.sin/cos are implementation-approximated]`
**Warning signs:** Visual parity with the mock degrades; tests added for a problem that isn't demonstrated.

### Pitfall 5: ESLint override not actually scoping to `src/engine/`
**What goes wrong:** The new override is appended but a later catch-all block re-enables `Math.random`, or the `files` glob doesn't match.
**Why it happens:** Flat-config order matters; the existing config has a trailing catch-all block.
**How to avoid:** Place the engine override so its rules win for `src/engine/**`; write a deliberate failing fixture (a file with `Math.random()` in `src/engine/`) and confirm `npm run lint` errors, then delete it.
**Warning signs:** `npm run lint` green even with a planted `Math.random()`.

## Code Examples

### Zod v4 contract with `z.infer` (the mandatory pattern)
```ts
// engine/contracts/DayVector.ts
// Source: zod.dev v4 (Context7 /colinhacks/zod) — z.infer pattern verified 2026-06-19
import { z } from "zod";

export const DayVectorSchema = z.object({
  day: z.number().int().positive(),
  date: z.string(),                       // ISO
  posts: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  contributors: z.number().nonnegative(),
  scoreSum: z.number().nonnegative(),
  topThreads: z.array(z.number().nonnegative()),
  conflict: z.number().min(0).max(1),
  momentum: z.number().min(-1).max(1),
  diversity: z.number().min(0).max(1),
  dominantTheme: z.string(),
  steering: z.object({
    branch: z.number(),
    symmetry: z.number(),
    hue: z.number(),
  }),
  outcome: z.unknown().optional(),        // GAME-01 hook; shape firmed in Phase 4
  seed: z.number().int(),
});
export type DayVector = z.infer<typeof DayVectorSchema>;   // NO hand-written interface
```

### `dailyGoal` enum (D-03)
```ts
// engine/contracts/Genome.ts (excerpt)
// Source: D-03 — form-goals + activity-goals mix
export const GoalTypeEnum = z.enum([
  "reachSymmetry",      // form
  "conflictBelow",      // form
  "igniteRareGene",     // form
  "starThreshold",      // activity
  "densityThreshold",   // activity
  "contributorCount",   // activity
]);
export const DailyGoalSchema = z.object({
  type: GoalTypeEnum,
  targetParam: z.string(),
  threshold: z.number(),
  direction: z.enum(["above", "below"]),
});
```

### Signal→Param weights matrix (D-05 — typed but unused)
```ts
// engine/contracts/Genome.ts (excerpt)
// §6.3: weights: Record<Param, Partial<Record<Signal, number>>>
const ParamEnum = z.enum([/* density, width, symmetry, branch, twist, sat, lum, ... */]);
const SignalEnum = z.enum([/* activity, conflict, momentum, diversity, recency, ... */]);

export const WeightsSchema = z.record(
  ParamEnum,
  z.partialRecord(SignalEnum, z.number()),  // Partial<Record<Signal, number>>
);
// Typed in Phase 1; synthesis does NOT read this until Week 2 (D-05).
```
> **Note for planner:** confirm the exact `z.record` / `z.partialRecord` signature against `ctx7 docs /colinhacks/zod "z.record partial record key enum v4"` at implementation time — the v4 `z.record` arity and `partialRecord` helper are the one spot where the API shape should be re-verified live. `[ASSUMED]` for the precise helper name (see Assumptions A2).

### mulberry32 port (RNG)
```ts
// engine/rng.ts
// Source: docs/subcosm-universe-mock.html line 134 — verbatim port
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### Byte-identical determinism test (SYN-02)
```ts
// synthesis.test.ts
import { expect, test } from "vitest";
import { synthesize } from "../src/engine/synthesis";
import { fixtureDays, calm } from "./fixtures";

test("same inputs → byte-identical Scene", () => {
  const a = synthesize(fixtureDays, calm);
  const b = synthesize(fixtureDays, calm);
  expect(a).toEqual(b);                                   // structural deep-equal
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));      // key-order / byte-level
});
```

### TPL-03 divergence test (three presets, same data)
```ts
test("same DayVector[] yields diverging Scenes across presets", () => {
  const calmScene = synthesize(fixtureDays, calm);
  const chaoticScene = synthesize(fixtureDays, chaotic);
  const crystallineScene = synthesize(fixtureDays, crystalline);
  // assert measurable divergence: e.g. frontier element count / spread / arm count differ
  const elems = (s: Scene) => s.shells[0]!.elements.length;
  expect(elems(calmScene)).not.toBe(elems(chaoticScene));
  expect(JSON.stringify(calmScene)).not.toBe(JSON.stringify(crystallineScene));
});
```

### ESLint engine-boundary override (ENG-03) — flat config
```js
// append to the existing eslint.config.js array
{
  files: ["src/engine/**/*.{ts,tsx}"],
  languageOptions: {
    globals: globals.browser, // OffscreenCanvas types not needed; synthesis is DOM-free
    parserOptions: { project: ["./tools/tsconfig.engine.json"], tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    "no-restricted-imports": ["error", {
      patterns: ["@devvit/*", "phaser", "*/devvit/*", "*/client/*", "*/server/*"],
    }],
    "no-restricted-properties": ["error",
      { object: "Math", property: "random", message: "Use mulberry32 from engine/rng.ts — determinism (ENG-03/SYN-01)." },
    ],
    "no-restricted-globals": ["error",
      { name: "Math", message: "" }, // optional belt-and-suspenders; or use no-restricted-syntax for Math.random()
    ],
  },
}
```
> Prefer `no-restricted-properties` (targets `Math.random` specifically) over banning `Math` wholesale — synthesis legitimately uses `Math.imul`, `Math.max`, `Math.floor`, `Math.PI`, `Math.cos/sin`. The `no-restricted-globals` line above is illustrative only; **do not ban `Math` globally**. `[VERIFIED: existing eslint.config.js is flat-config eslint 10]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.infer`, slower object parsing | Zod v4 (`4.4.3`), ~6.5× faster, same `z.infer` ergonomics | v4 GA 2026 | Use v4; import from `"zod"` root |
| `.planning/research/` assumed `vanilla-ts` Vite scaffold | Repo is actually a **Devvit Phaser Web template** with TS project references + flat ESLint | discovered this session | Add `src/engine/` as a *new* tsconfig project + ESLint override; `phaser` is installed and must be engine-banned |
| `rollupOptions` in Vite config | Vite 8 uses `build.rolldownOptions` (Rolldown) | Vite 8 | Not relevant to Phase 1 (no build config change needed) but flagged for Phase 2 |

**Deprecated/outdated:**
- Hand-written TS interfaces for the contracts — forbidden (`z.infer` only).
- The mock's index-based RNG seed (`i*9973+7`) — replaced by `DayVector.seed`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reducing `topThreads: number[]` to a scalar via `max()` reproduces the mock's `nbig` behaviour | Pitfall 2 / port table | LOW — any monotone reduction works; visual parity is approximate by spec ("pixel-approximately"). Document the choice. |
| A2 | Zod v4 exposes `z.partialRecord(keyEnum, valueSchema)` (or `z.record` with partial semantics) for the §6.3 weights matrix | Code Examples (weights) | LOW — matrix is typed-but-unused in Phase 1 (D-05); exact helper name verifiable via `ctx7` at impl time; worst case use `z.record(key, value.optional())`. |
| A3 | `outcome` (DayVector) / `goalAchieved` (Scene) can be loosely typed now (`z.unknown().optional()` / `z.boolean().nullable()`) and firmed in Phase 4 | phase_requirements / Code Examples | LOW — D-03 explicitly says Phase 1 is schema-only; loose-then-firm is acceptable as long as the field *exists*. Confirm with planner whether a stricter Phase-1 shape is wanted. |
| A4 | The `render(...)` orchestrator (ENG-04) ships as a typed stub in Phase 1 (synthesis wired, paint/camera not) | phase_requirements ENG-04 | MEDIUM — ENG-04 is listed as a Phase-1 REQ but its full body (scrub/nudge/regenerate/destroy) depends on paint+camera (Phase 2). Recommend stub now; **flag for user confirmation** that a stub satisfies ENG-01..05 acceptance for this phase. |
| A5 | Co-locating `*.test.ts` next to source vs a `tests/` dir is free choice; Vitest discovers both | project structure | LOW — purely organizational. |

## Open Questions (RESOLVED)

1. **ENG-04 scope boundary (the one real ambiguity).**
   - What we know: ENG-04 ("single `render()` orchestrates synthesis → paint → camera, exposes scrub/nudge/regenerate/destroy") is assigned to Phase 1, but paint and camera are explicitly Phase 2.
   - What's unclear: whether the phase's Definition-of-Done requires the *full* `render` API or just the synthesis-wired stub + the typed signature.
   - Recommendation: ship `render(days, genome, style)` as a typed stub that calls `synthesize` and returns/holds a `Scene`, with `scrub/nudge/regenerate/destroy` declared but throwing/`TODO`-stubbed. Phase 2 fills the body. **Confirm with user during planning** (A4).
   - **RESOLVED:** Resolved in Plan 02 (Task 2) — render-stub scope adopted per Assumption A4 / this Open Q1: typed signature + synthesis wired, `scrub/nudge/regenerate/destroy` bodies deferred to Phase 2.

2. **Hue-hint derivation.**
   - What we know: Scene must stay style-agnostic; the mock uses a raw `hue` degree per era.
   - What's unclear: exact 0–1 hue-hint formula from `DayVector` (theme hash? momentum? a Genome palette index?).
   - Recommendation: derive a deterministic 0–1 hint (e.g. hash of `dominantTheme` or a genome-driven base) and let Phase-2 paint map it through `StyleTemplate.palette`. Keep it simple; it only needs to be deterministic + visibly varied.
   - **RESOLVED:** Falls under the Claude's-discretion grant in CONTEXT.md — derive a deterministic 0..1 hint from `dominantTheme`/steering (exact formula is Claude's discretion); Phase 2 paint maps it through `StyleTemplate.palette`.

3. **Crystalline genome values.**
   - What we know: D-01 — Crystalline = high symmetry + inheritance; final palette is Phase 2.
   - What's unclear: precise numeric knobs.
   - Recommendation: set `volatility` low, `inheritance` high, symmetry/arms knobs high; tune so `presets.test.ts` shows visible divergence from Calm/Chaotic. Numbers are Claude's discretion.
   - **RESOLVED:** Crystalline preset existence fixed by D-01 (high symmetry + inheritance); precise numeric knobs are Claude's discretion per the CONTEXT.md grant (tuned for visible cross-preset divergence in Plan 03).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, tsc, npm | ✓ | v26.0.0 (repo `engines` wants `>=22.2.0`) | — |
| npm | install deps | ✓ | 11.12.1 | — |
| TypeScript (project refs) | type-check | ✓ | 6.0.3 (installed) | — |
| Vite | Vitest pipeline / build | ✓ | 8.0.16 (installed) | — |
| ESLint flat config | ENG-03 boundary | ✓ | 10.4.0 (installed) | — |
| `zod` | all contracts | ✗ | — (install `4.4.3`) | none — blocking, must install |
| `vitest` | QA tests | ✗ | — (install `4.1.9`) | `node:test` (weaker; not recommended) |

**Missing dependencies with no fallback:** `zod` — blocking; the whole phase is built on it. Install first.
**Missing dependencies with fallback:** `vitest` — `node:test` exists but loses Vite integration + snapshot ergonomics; install Vitest.

## Validation Architecture

> `workflow.nyquist_validation` not found in config → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.9` (to be installed) |
| Config file | none yet — add `vitest.config.ts` (or rely on Vite 8 config) in Wave 0 |
| Quick run command | `npx vitest run src/engine` |
| Full suite command | `npx vitest run` (add `"test": "vitest run"` to `package.json` scripts) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENG-01 | Every contract type is `z.infer`; schemas parse valid + reject invalid | unit | `npx vitest run src/engine -t "contracts"` | ❌ Wave 0 |
| ENG-03 | `Math.random`/`@devvit/*`/`phaser` banned in `src/engine/` | lint | `npm run lint` (with planted-fixture check) | ❌ Wave 0 (config) |
| SYN-01/02 | Same inputs → byte-identical Scene | unit | `npx vitest run src/engine -t "determinism"` | ❌ Wave 0 |
| SYN-03 | genShell port produces expected element counts vs mock heuristic | unit | `npx vitest run src/engine -t "genShell"` | ❌ Wave 0 |
| SYN-04 | Different data → different Scene (sparse vs dense, conflict redshift) | unit | `npx vitest run src/engine -t "data-sensitivity"` | ❌ Wave 0 |
| TPL-03 | Same `DayVector[]`, 3 presets → diverging Scenes | unit | `npx vitest run src/engine -t "presets"` | ❌ Wave 0 |
| GAME-01 | `dailyGoal`/`outcome`/`goalAchieved` fields exist in schemas | unit | `npx vitest run src/engine -t "goal fields"` | ❌ Wave 0 |
| GAME-05 | Personal layer (`actionCap`/`ActionBudget`) structurally distinct from `Scene` | unit | `npx vitest run src/engine -t "personal layer"` | ❌ Wave 0 |
| QA-02 (carry) | `tsc --build` + `npm run lint` green | build | `npm run type-check && npm run lint` | partial (scaffold exists) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/engine` (sub-second; pure functions)
- **Per wave merge:** `npx vitest run && npm run type-check && npm run lint`
- **Phase gate:** full suite green + `tsc --build` + lint before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Install `zod` + `vitest` (+ optional `@vitest/coverage-v8`); add `"test": "vitest run"` script.
- [ ] `tools/tsconfig.engine.json` + root `tsconfig.json` `references[]` entry.
- [ ] ESLint `src/engine/**` override (Math.random + import bans) — with a planted-fixture lint check.
- [ ] `tests/fixtures.ts` — a small fixed `DayVector[]` (cold-start day-1 + a dense/high-conflict day + an AMA-style high-`top` day) and the three genome presets, for reuse across determinism/divergence tests.
- [ ] `vitest.config.ts` (or confirm Vite config is reused) so `src/engine/**/*.test.ts` is discovered.

## Security Domain

> `security_enforcement` not set to `false` → included. This phase is a pure, offline, dependency-light computation library with **no external input at runtime, no network, no auth, no secrets, no persistence**. The standard ASVS surface is almost entirely N/A.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in a pure engine |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No actors |
| V5 Input Validation | yes (latent) | Zod `.parse()` at the (future) sim→engine + redis→engine boundaries; in Phase 1 only the test fixtures cross a boundary |
| V6 Cryptography | no | `mulberry32` is a **non-cryptographic** PRNG by design (determinism > unpredictability). Must NOT be used for any security purpose — document this. |
| V14 Dependencies | yes | Two new deps; legitimacy-audited above (all OK/resolved). Pin versions; commit lockfile. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Slopsquatted/typosquatted dependency | Tampering | Package Legitimacy Audit (done — `zod`/`vitest` verified against official repos + high downloads) |
| Malicious postinstall script | Tampering/Elevation | `npm view <pkg> scripts.postinstall` → all `null` for the three deps (verified) |
| Supply-chain via transitive deps | Tampering | `npm install` then commit lockfile; Phase keeps the dep tree minimal (zod has zero runtime deps) |
| Misuse of `mulberry32` as a security RNG | Spoofing | Document in `rng.ts` that it is deterministic/non-crypto; never seed secrets or tokens from it |

## Sources

### Primary (HIGH confidence)
- `docs/subcosm-requirements.md` §6.1–6.4 (contract shapes), §6.5 (Redis — Phase 3 context), §7 (architecture), §8.1 (parameter grammar) — the authoritative contract spec.
- `docs/subcosm-universe-mock.html` lines 134 (`mulberry32`) + 140–162 (`genShell`/`starCount`/`lerp`) — the synthesis + RNG source of truth to port.
- `.planning/phases/01-engine-foundation/01-CONTEXT.md` — locked decisions D-01..D-05.
- `.planning/research/ARCHITECTURE.md` + `.planning/research/SUMMARY.md` — settled stack, build order, anti-patterns.
- `package.json`, `eslint.config.js`, `tools/tsconfig.*.json`, `devvit.json` (read this session) — actual repo state (corrects the vanilla-ts assumption).
- `./CLAUDE.md` + `docs/context/subcosm-spec.md` — Zod single-source-of-truth standard + hard rules.

### Secondary (MEDIUM confidence)
- Context7 `/colinhacks/zod` — `z.infer`, `z.enum`, defaults, v4 constructor changes (queried this session).
- `npm view` for `zod@4.4.3`, `vitest@4.1.9`, `@vitest/coverage-v8@4.1.9`, `vite@8.0.16` — version + publish-date + downloads verification.

### Tertiary (LOW confidence)
- Exact Zod v4 `z.partialRecord`/`z.record` helper name for the weights matrix (A2) — re-verify via `ctx7` at implementation time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm; both deps named in settled research and legitimacy-audited.
- Architecture / port mechanics: HIGH — source functions and contract shapes are fully in-repo; this is a port, not a design.
- Contract field exactness: MEDIUM — exact Zod shapes are Claude's discretion (D); §6 gives the surface; weights-matrix helper name is the one item to re-verify live (A2).
- ENG-04 scope: MEDIUM — open question flagged for user confirmation (A4 / Open Question 1).
- Pitfalls: HIGH — determinism/key-order/Math.random pitfalls derived directly from the mock source + architecture research.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable stack; Zod v4 / Vitest 4 unlikely to break within the hackathon window). Re-verify the Zod `z.record`/`partialRecord` helper at implementation time only.

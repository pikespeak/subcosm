# Phase 1: Engine Foundation - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The four **Zod contracts** (DayVector, Scene, Genome, StyleTemplate) + **seeded RNG** (mulberry32) + a **config-driven template engine** (multiple genome presets) + **deterministic synthesis** — delivered as a **pure, render-agnostic, testable core**. Zero Devvit imports, zero Phaser imports, zero paint code. All types are `z.infer` of their schema. Contracts include the `dailyGoal` / `outcome` / `goalAchieved` fields and a personal-layer action-budget shape so the game loop (Phase 4) and monetization (post-MVP) bolt on later without reworking synthesis.

**Not in this phase:** paint/rendering (Phase 2), the data simulator (Phase 2), Devvit wiring (Phase 3), goal-scoring logic / live game (Phase 4).
</domain>

<decisions>
## Implementation Decisions

### Genome Presets (TPL-03)
- **D-01:** Ship **three** presets — **Calm** and **Chaotic** (max-contrast poles: volatility / density / conflict-reaction), plus a third thematic preset **Crystalline** (high symmetry + inheritance, cool, faceted; per spec §4.4 preset examples). All three share the Techno style and differ **only in genome data**. Crystalline's final palette/look is decided in Phase 2 (when visible); Phase 1 sets its genome values.
- **D-02:** The presets are how TPL-03 is proven: same `DayVector[]` → visibly different `Scene` output (density, volatility, shell shape) with **zero engine code change**.

### Daily Goal Types (GAME-01)
- **D-03:** The `dailyGoal` type enum is a **mix** of form-goals and activity-goals. Form: reach symmetry, keep conflict below a threshold, ignite a rare star/gene. Activity: reach a star/density threshold, reach a contributor count. Schema shape ≈ `{ type, targetParam, threshold, direction }`. **Scoring logic is Phase 4** — Phase 1 only defines the schema + the enum.

### Action Budget (GAME-05)
- **D-04:** The per-user daily action cap is a **Genome field** (`actionCap`), **default 3**, tunable per community. It lives on the **personal layer**, structurally distinct from all community-layer fields. Small default = scarcity makes nudges meaningful and leaves room for fair "extra actions" monetization later (never buying the shared outcome).

### Genome Schema Depth
- **D-05:** The Genome schema types the **full spec §6.3 surface** (including the Signal→Param `weights` matrix), but Phase-1 synthesis only **exercises the mock's genShell heuristic fields**. The weights matrix stays **typed-but-unused** until Week 2 — no later schema break. Consistent with build-for-flexibility + Zod single-source-of-truth.

### Claude's Discretion
- Exact Zod field names/shapes, the mulberry32 implementation, the `genShell()` port details, the ESLint config (ban `Math.random` + `@devvit/*`/`phaser` imports in `src/engine/`), the Scene/Element shape mapping from the mock, and the test structure are the planner's to design — as long as the decisions above hold and **every contract type is `z.infer` only** (no hand-written interfaces).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contracts & Architecture
- `docs/subcosm-requirements.md` §6 — the four data contracts (DayVector; Scene/Shell/Element; Genome; StyleTemplate)
- `docs/subcosm-requirements.md` §7 — three-layer architecture (synthesis / paint / camera)
- `docs/subcosm-universe-mock.html` — the `genShell()` heuristic + `mulberry32` to port (synthesis source of truth for visual parity)
- `docs/context/subcosm-spec.md` — condensed engineering brief (hard rules: determinism, no stored images, legibility, steering biases mean)

### Requirements & Research
- `.planning/REQUIREMENTS.md` — ENG-01..04, TPL-01..04, SYN-01..04, GAME-01, GAME-05 (this phase's REQ-IDs)
- `.planning/research/SUMMARY.md` — settled stack (Vite/Vitest/Zod v4), dependency-ordered build sequence, determinism + Zod-boundary + "cannot be retrofitted" constraints
- `.planning/research/ARCHITECTURE.md` — functional-core/imperative-shell, build order, ESLint boundary enforcement

### Standards & Conventions
- `CLAUDE.md` — Zod + Plan-Mode standard (parse at boundaries, infer types, no `as` casts; tests/build always green)
- `docs/context/devvit-conventions.md` — Devvit project conventions (boundary awareness only; the engine stays Devvit-free)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/subcosm-universe-mock.html` — port `mulberry32` → `src/engine/rng.ts` and the `genShell()` logic → `src/engine/synthesis.ts` (replace the hardcoded `eras[]` with DayVector fields).
- Scaffold present from the Devvit Phaser template: `src/client/` (Phaser scenes), `src/server/` (Devvit/Hono routes), `src/shared/`. Phase 1 **adds** `src/engine/` as pure modules; **no imports into client/server yet**.
- `package.json` currently lacks **`zod`** (runtime) and **`vitest`** (dev) — both must be added in this phase.

### Established Patterns
- Functional core / imperative shell: `src/engine/` must stay pure — add an ESLint `no-restricted-imports` rule for `@devvit/*` and `phaser`, plus a `Math.random` ban, scoped to `src/engine/`.
- Zod `.parse()` only at boundaries (the sim→engine boundary arrives in Phase 2); inside the engine, trust the `z.infer` types.

### Integration Points
- `src/engine/` is standalone in Phase 1. Consumed later by: Phase 2 paint (Phaser) + Phase 2 simulator; Phase 4 game scoring (reads `dailyGoal` / `outcome` / `goalAchieved`).
</code_context>

<specifics>
## Specific Ideas

- Preset names: **Calm**, **Chaotic**, **Crystalline**.
- Genome/style visual reference for Phase 2: `docs/subcosm.png` (Techno / bioluminescent — cyan↔magenta nebula, warm-white genesis core).
- `actionCap` default = **3**.
</specifics>

<deferred>
## Deferred Ideas

- **Full Signal→Param weight matrix exercised** (not just typed) — Week 2.
- **Daily guess + streaks** (game stage 2), **collection** (stage 3), **monetization** (Devvit Payments, fair/cosmetic) — later phases / stretch.
- **Connected multiverse** outer zoom tier — post-MVP; Phase 1 only keeps the coordinate model embeddable (no implementation, design-review item in Phase 2 camera work).
- **Crystalline final palette/look** — decided in Phase 2 when rendering is visible.

None of these are in Phase 1 scope — discussion stayed within the contracts/RNG/synthesis boundary.
</deferred>

---

*Phase: 1-Engine Foundation*
*Context gathered: 2026-06-19*

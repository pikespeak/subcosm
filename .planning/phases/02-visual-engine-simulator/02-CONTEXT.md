# Phase 2: Visual Engine + Simulator - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A standalone **Vite dev page** renders a **simulated** Subcosm universe at visual parity with the mock — the `paint(Scene, StyleTemplate)` layer (Phaser/WebGL), the independent `camera`, frontier **steering/nudges**, and the **data simulator** that generates `DayVector[]`. Time-scrubbing, zoom, nudging the frontier, switching genome presets, and seed-deterministic regenerate all work; the day's goal is legible in the readout. This **proves the engine complete before any Reddit/Devvit code is written.**

Implements: PNT-01..04 (Techno Phaser paint), CAM-01..04 (camera/navigation), STR-01..02 (steering), SIM-01..03 (simulator), QA-01..03 (dev page + tests/boundary).

**Not in this phase:** Devvit scaffold / Redis / triggers / scheduler (Phase 3), live frontier + reveal + goal *scoring* (Phase 4), submission/polish (Phase 5). **Renderer choice is already locked: Phaser (WebGL) is the paint layer (PNT-01) — not a discussion item.**
</domain>

<decisions>
## Implementation Decisions

### Navigation & Camera (CAM-01, CAM-02)
- **D-01:** Navigation uses **both** a horizontal **depth slider-scrubber** (drives *time*: dragging flies through the shells) **and pinch/scroll zoom** (drives the *zoom level*); **clicking a shell focuses/zooms it**. This gives full control rather than slider-only. The camera holds independent view state (zoom/focus/scrub/intro) and **never mutates the Scene** (CAM-01).

### Readout & Goal Legibility (CAM-03, GAME-01)
- **D-02:** The per-shell readout is a **fixed, always-visible HUD panel** that updates with the focused/scrubbed shell — showing date / era / theme / stars / comments / contributors / conflict. The **live (frontier) day's HUD additionally shows that day's goal** (e.g. "Goal: tame conflict below 0.3"). Legibility is a **hard rule — this readout is never removed or hidden behind interaction.**

### Simulator Scenario (SIM-01)
- **D-03:** The simulator produces a **scripted ~30-day story scenario** with defined beats: **cold-start day-1 → growth ramp → drama spike (~day 12, red turbulence) → AMA day (~day 20, a few huge bright clusters) → quiet days**. The **seed only dices WITHIN the beats** — so a `regenerate` yields a visibly different but still well-told universe (every demo reads as a good story for judges). Exact day count and beat positions are Claude's discretion within this shape.

### Aesthetic Direction (PNT-01) + Crystalline palette
- **D-04:** **Mock-parity, subtly elevated.** Phaser/WebGL paint must hit visual parity with `docs/subcosm-universe-mock.html` (genesis core, concentric shells, cyan↔magenta nebula, frontier ignite, vignette) — but **cleaner than canvas via real WebGL additive-blend glow**. Not strict 1:1, not over-elevated; must stay **legible and read self-authored (not AI-slop)**. The fbm/shader pass stays **Stretch**.
- **D-05:** **Crystalline's final look** (explicitly deferred from Phase 1) = **cool, faceted, ice-blue/white, high-symmetry, sharper/angular star primitives** — clearly distinct from Calm and Chaotic at a glance. Genome values already exist (Phase 1); this fixes its `StyleTemplate`/palette direction.

### Claude's Discretion
- **Nudge controls (STR-01/02):** control style (buttons vs sliders for branch / symmetry / hue) and per-nudge visible strength — but a nudge **biases the MEAN only** (result still diced around it; `steerGain` from genome data) — invariant, never dictates the outcome.
- **Dev-page (QA-01) control-harness layout/styling** (scrubber + nudge buttons + regenerate + seed field + genome-preset selector).
- **Reduced-motion (PNT-04) static-render look** — a calm, non-animated, non-strobe frame.
- All **Phaser perf mechanics** (PNT-03: frozen shells baked to `RenderTexture`, reused textures/geometry, capped DPR/resolution → ~60fps) — researcher/planner.
- `genShell` Scene → paint primitive mapping fidelity details.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual & Paint reference (the "visual parity" bar)
- `docs/subcosm-universe-mock.html` — the canvas renderer to MATCH (genesis core, concentric shells, nebula, frontier ignite, vignette). Source of truth for visual parity (PNT-01).
- `docs/subcosm.png` — Techno key-art / palette reference (cyan↔magenta nebula, warm-white genesis core).
- `docs/subcosm-requirements.md` §4 (style/paint) and §7 (three-layer architecture: synthesis / paint / camera).

### Contracts the paint layer consumes (from Phase 1)
- `docs/subcosm-requirements.md` §6 — Scene / Shell / Element shape (what paint reads) + `StyleTemplate` shape.
- `src/engine/` — Phase 1 engine: `contracts/*` (z.infer schemas), `synthesis.ts` + `rng.ts` (`synthesize()`), `render.ts` (the **stub** whose `scrub`/`nudge`/`regenerate`/`destroy` bodies this phase implements — ENG-04), `genomes/{calm,chaotic,crystalline}.ts`.
- `docs/context/subcosm-spec.md` — hard rules: determinism, no stored images, **legibility mandatory**, `prefers-reduced-motion`, **steering biases the mean**, 60fps mobile, one style per community.

### Requirements & settled stack
- `.planning/REQUIREMENTS.md` — PNT-01..04, CAM-01..04, STR-01..02, SIM-01..03, QA-01..03 (this phase's IDs).
- `.planning/research/SUMMARY.md` + `.planning/research/ARCHITECTURE.md` — settled stack (Vite/Vitest/Zod, Phaser), functional-core/imperative-shell, ESLint boundary enforcement.

### Standards & conventions
- `CLAUDE.md` — Zod single-source-of-truth; `DayVectorSchema.parse()` at the simulator's OUTPUT boundary (SIM-02) and **NEVER inside synthesis/paint/the frame loop** (QA-03); no `Math.random`/`@devvit/*`/`phaser` inside `src/engine/`; tests + build + tsc green.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/contracts/*` — Scene/Shell/Element/Genome/StyleTemplate schemas + inferred types. Paint reads `Scene` only, never raw `DayVector` (the ENG-02 seam).
- `src/engine/synthesis.ts` + `src/engine/rng.ts` — `synthesize(DayVector[], Genome) → Scene`, deterministic (mulberry32). Phase 2 paint consumes its output unchanged.
- `src/engine/render.ts` — the `render(dayVectors, genome, style)` **stub**; implement the paint/camera bodies + `scrub`/`nudge`/`regenerate`/`destroy` here (ENG-04).
- `src/engine/genomes/{calm,chaotic,crystalline}.ts` — the three presets; Crystalline gets its `StyleTemplate`/palette finalized (D-05).
- `phaser` already installed (bumped to 4.2.0 in Phase 1); `zod` + `vitest` present; **CI live** (type-check · lint · test · build) — keep green.

### Established Patterns
- **Functional core / imperative shell:** synthesis is pure (no Phaser); **paint + camera are the imperative shell.** The ESLint boundary bans `phaser`/`@devvit/*`/`Math.random` inside `src/engine/` → the **Phaser paint module must live OUTSIDE `src/engine/`** (e.g. `src/paint/` or `src/client/`), importing only the `Scene`/`StyleTemplate` types.
- **Parse at boundaries only:** `DayVectorSchema.parse()` at the simulator's output (SIM-02); never inside paint/synthesis/frame loop (QA-03).
- **StyleTemplate as data:** all Techno look constants come from a `StyleTemplate` object (PNT-02), not hard-coded in paint.

### Integration Points
- The **Vite dev page** (QA-01) wires: simulator → `DayVectorSchema.parse()` → `render(dayVectors, genome, style)` → Phaser canvas, plus the control harness (scrubber, pinch/scroll-zoom, nudge buttons, regenerate, seed field, genome-preset selector) and the HUD readout.
- Camera/coordinate model kept **embeddable** for a future multiverse outer zoom tier (CAM-04 — design-review only, no implementation).
</code_context>

<specifics>
## Specific Ideas

- **Story beats:** cold-start day-1 · growth · drama spike (~day 12, red) · AMA day (~day 20, few huge clusters) · quiet days; ~30 days total. Seed dices within the beats.
- **Crystalline:** cool / faceted / ice-blue-white, high symmetry, angular star primitives — unmistakably different from Calm & Chaotic.
- **Mock parity elevated** via WebGL additive-blend glow (cyan↔magenta nebula, warm-white genesis core, vignette) — cleaner than the canvas mock, not beyond it.
- **HUD** shows the frontier day's goal inline (e.g. "Goal: tame conflict below 0.3"), alongside date/era/theme/stars/comments/contributors/conflict.
- Navigation = slider (time) **+** pinch/scroll (zoom) **+** click-to-focus a shell.
</specifics>

<deferred>
## Deferred Ideas

- **fbm/WebGL shader pass** on top of the Phaser renderer (STRETCH-Shader) — Best-of-Phaser polish, not Phase 2.
- **Comic + Pixel StyleTemplates** (STRETCH-Styles) — each a data file, later/stretch.
- **Full Signal→Param weight matrix exercised + rare-event mutation table + presets-UI** (STRETCH-Genome).
- **Mode B** (real community top-post/comment theme extraction) — Stretch.
- **Devvit wiring, live frontier, overnight reveal, goal *scoring*** — Phases 3–4.
- **Connected multiverse outer zoom tier** — post-MVP; Phase 2 only keeps the camera/coordinate model embeddable (CAM-04, design review).

None of these are in Phase 2 scope — discussion stayed within paint / camera / steering / simulator / dev-page.
</deferred>

---

*Phase: 2-Visual Engine + Simulator*
*Context gathered: 2026-06-19*

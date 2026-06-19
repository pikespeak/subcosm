# Subcosm — CLAUDE.md

## What this is
Subcosm is a collaborative, persistent Reddit game (Devvit Web) where a community grows a shared **universe** from its own daily activity. **Depth = time:** a glowing genesis core (the first post / install day) sits at the center; each day adds a concentric **shell of stars** synthesized from that day's activity; the outermost shell is the live **frontier** that freezes at the daily tick.
Full spec: `docs/subcosm-requirements.md`. Visual reference (the renderer to port): `docs/subcosm-universe-mock.html`.

## Stack & platform
- Devvit Web (Reddit Interactive Posts), mobile-first, runs inside the post viewport.
- TypeScript everywhere. Rendering: Canvas2D first; an fbm WebGL shader layer is a later visual upgrade (Phaser allowed/encouraged).
- Reddit hosts front + backend. Devvit primitives: scheduler, redis, realtime, reddit API + triggers, settings.

## Architecture — the pure engine (most important)
One engine, three call sites (real game, simulator, server-side preview):

    render(DayVector[], Genome, StyleTemplate) -> frames

Three decoupled layers, two symmetric contracts:
1. **Synthesis** — `DayVector + seed + Genome -> Scene` (deterministic, STYLE-AGNOSTIC)
2. **Paint** — `Scene + StyleTemplate -> pixels` (the skin layer)
3. **Camera** — independent view state (zoom / scrub / focus)

Contracts (`DayVector`, `Scene`, `Genome`, `StyleTemplate`) are specified in requirements §6 — implement them as the typed seam. **Synthesis must never know about styles; Paint must never touch raw data.**

## Module layout
- `src/engine/` — synthesis, scene types, paint (per-style modules), camera. NO Devvit imports. Pure + unit-testable.
- `src/sim/` — data simulator: generates realistic `DayVector[]` (trends, spikes, quiet spells, growth).
- `src/devvit/` — Devvit app: triggers -> redis aggregation, scheduler tick + sweeper, webroot host. (Later.)
- `docs/` — requirements + mock.

## Current focus (Week 1) — engine + simulator FIRST, no Reddit wiring
1. Port `docs/subcosm-universe-mock.html` into `src/engine/` as the pure engine, introducing the typed `Scene` seam between synthesis and paint. Start with the existing single style. Keep visual parity with the mock.
2. Build `src/sim/` so the engine renders from generated `DayVector[]` — proving *any* data renders. The simulator's output schema IS the `DayVector` contract the real collector will later fill.
Do NOT start the Devvit data layer yet.

## Hard rules (do not violate)
- **Determinism:** every shell reproducible from `DayVector + seed + genomeVersion`. No randomness outside the seeded RNG.
- **No stored images:** store only ~25 scalars + seed per ring; regenerate visuals.
- **Aggregates, not content** (privacy + Devvit limits).
- **Mobile perf:** target 60fps in the post viewport. Only the live frontier animates; frozen shells are cached (bake-on-freeze). LOD by zoom; no literal infinite-fractal math.
- **Legibility is mandatory in every style:** each shell tagged (date + theme + activity stats); depth scrubber maps depth -> date. Never remove these; only restyle them.
- **One style per community** (set in genome at install), never per user.
- **Respect `prefers-reduced-motion`** (disable ambient/strobe, render static).
- **Steering biases the mean, never dictates the outcome.**

## Step 0 before scaffolding the Devvit app
Devvit evolves fast. Before generating the Devvit project, verify against official docs (developers.reddit.com/docs, github.com/reddit/devvit-docs) — do NOT assume command names from memory:
- current CLI/init command + project structure for Devvit Web,
- which post/comment/vote triggers fire, and whether vote/score deltas are real-time or poll-only,
- redis + scheduler + realtime API surface, and the settings schema for the genome.

## Conventions
- TypeScript strict. Small pure functions in `engine/`. Unit-test synthesis with fixed seeds.
- Genome + style are **data** (config), not code. The only style *code* is the primitive library (how to paint a star / filament / edge).
- Use Plan Mode for non-trivial steps; show the typed contracts before implementing.

# Architecture Research

**Domain:** Collaborative persistent Reddit game — pure procedural rendering engine + Devvit Web platform layer
**Researched:** 2026-06-19
**Confidence:** HIGH (derived from spec §6/§7 + mock source; Devvit API surface MEDIUM — verify against live docs before Week 2)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  CALL SITES (three, one engine)                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │  Devvit Web  │  │  Simulator   │  │  Server-side preview       │  │
│  │  (webroot)   │  │  (src/sim/)  │  │  (Week 2+, optional)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬───────────────┘  │
│         │                 │                        │                  │
│         └────────────┬────┘                        │                  │
│                      │  DayVector[] + Genome        │                  │
│                      ▼                             │                  │
├──────────────────────────────────────────────────────────────────────┤
│  ENGINE  src/engine/   (zero Devvit imports, pure + unit-testable)   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  SYNTHESIS  src/engine/synthesis.ts                           │    │
│  │  DayVector[] + Genome + seed → Scene                         │    │
│  │  • Deterministic seeded RNG (mulberry32 closure per day)     │    │
│  │  • Genome weight matrix maps signals → params                │    │
│  │  • STYLE-AGNOSTIC: no color, no canvas, no pixels            │    │
│  └────────────────────────┬─────────────────────────────────────┘    │
│                           │  Scene (Shell[], Element[], CoreNode)    │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  PAINT  src/engine/paint/techno.ts  (+ comic.ts, pixel.ts)  │    │
│  │  Scene + StyleTemplate → pixels (Canvas2D ctx calls)        │    │
│  │  • Reads Style primitives (star, filament, cluster)          │    │
│  │  • Bake-on-freeze: frozen shells → OffscreenCanvas bitmaps  │    │
│  │  • Frontier: re-rendered every rAF frame                    │    │
│  └────────────────────────┬─────────────────────────────────────┘    │
│                           │  rendered frame                          │
│                           ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  CAMERA  src/engine/camera.ts                                │    │
│  │  Independent view-state: zoom, scrubFocus, panOffset         │    │
│  │  • Drives LOD tier selection                                 │    │
│  │  • Maps depth-scrubber → focusedDay                          │    │
│  │  • Does NOT mutate Scene or DayVector                        │    │
│  └──────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│  CONTRACTS  src/engine/contracts/  (Zod schemas, z.infer types)      │
│  DayVectorSchema · SceneSchema · GenomeSchema · StyleTemplateSchema  │
│  Parse at: sim→engine boundary · Devvit redis→engine boundary        │
│  Never parse: inside frame loop, inside synthesis, inside paint      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEVVIT LAYER  src/devvit/  (Week 2+, may import Devvit freely)      │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  triggers/  │  │  scheduler/  │  │  webroot/    │                │
│  │  post create│  │  daily tick  │  │  React host  │                │
│  │  comment    │  │  hourly sweep│  │  camera UI   │                │
│  │  vote       │  │  freeze job  │  │  nudge btns  │                │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                │                 │                         │
│         ▼                ▼                 ▼                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  redis/   agg:{sub}:{day} HASH · :authors SET · :threads ZSET  │  │
│  │           ring:{sub}:{i} HASH (frozen DayVector + seed)        │  │
│  │           steer:{sub}:{day} HASH (live nudge aggregates)       │  │
│  │           organism:{sub} · genome:{sub}                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│         │                                                             │
│         │  DayVector[] (after .parse() at this boundary)             │
│         ▼                                                             │
│       ENGINE (pure, above)                                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Allowed Imports | Forbidden Imports |
|-----------|---------------|-----------------|-------------------|
| `src/engine/contracts/` | Zod schemas + inferred TS types for all four contracts | `zod` only | anything else |
| `src/engine/synthesis.ts` | `DayVector[] + Genome + seed → Scene`; seeded RNG; genome weight math | contracts, RNG util | style, canvas, DOM, Devvit |
| `src/engine/paint/` | `Scene + StyleTemplate + Canvas2D ctx → pixels`; primitive library; bake cache | contracts, browser Canvas2D API | synthesis internals, Devvit, raw DayVector |
| `src/engine/camera.ts` | View-state (zoom, focus, pan); LOD tier; depth→day mapping | contracts (Scene shape) | synthesis, paint, Devvit |
| `src/engine/render.ts` | Top-level entry: calls synthesis, paint, camera in order; returns frame | all engine modules | Devvit |
| `src/sim/` | Generates realistic `DayVector[]` for Week-1 standalone harness | contracts (DayVector), engine render | Devvit, reddit API |
| `src/devvit/triggers/` | Collects activity into redis agg buckets | Devvit SDK, redis | engine (no imports needed here) |
| `src/devvit/scheduler/` | Daily tick (freeze → ring record) + hourly sweeper (timezone-aware) | Devvit SDK, redis, contracts (.parse()) | engine render (server can call synthesis for preview) |
| `src/devvit/webroot/` | React host in post viewport; instantiates canvas; wires camera UI, nudge buttons, depth scrubber | Devvit SDK, engine (render.ts), contracts | redis direct (goes through server API) |
| `src/devvit/redis/` | Typed redis helpers: typed wrappers around hset/hget/zadd/sadd with key templates | Devvit redis, contracts | engine |

---

## Recommended Project Structure

```
redditgame-v1/
├── src/
│   ├── engine/
│   │   ├── contracts/
│   │   │   ├── DayVector.ts        # z.object({...}); export type DayVector = z.infer<...>
│   │   │   ├── Scene.ts            # Shell, Element, CoreNode schemas
│   │   │   ├── Genome.ts           # weights, ranges, palette, steerGain, rareTable
│   │   │   ├── StyleTemplate.ts    # substrate, palette, line, fill, texture, genes, postFX
│   │   │   └── index.ts            # re-export all schemas + types
│   │   ├── rng.ts                  # mulberry32(seed: number): () => number
│   │   ├── synthesis.ts            # synthesize(days: DayVector[], genome: Genome): Scene
│   │   ├── paint/
│   │   │   ├── primitives.ts       # drawStar, drawFilament, drawCluster (style-agnostic shapes)
│   │   │   ├── techno.ts           # paint(scene, style, ctx, cache): void — Techno skin
│   │   │   ├── comic.ts            # (Week 3)
│   │   │   ├── pixel.ts            # (Week 3)
│   │   │   └── bakeCache.ts        # ShellBakeCache: Map<day, OffscreenCanvas>
│   │   ├── camera.ts               # CameraState, updateCamera, lodTier(zoom)
│   │   └── render.ts               # render(days, genome, style, canvas, camera): void
│   ├── sim/
│   │   ├── generator.ts            # generateDays(n, seed): DayVector[]
│   │   ├── patterns.ts             # growth trend, spike, AMA-day, quiet, drama
│   │   └── index.ts
│   ├── devvit/                     # Week 2+ — Devvit imports allowed here only
│   │   ├── triggers/
│   │   │   ├── onPostCreate.ts
│   │   │   ├── onCommentCreate.ts
│   │   │   └── onPostVote.ts
│   │   ├── scheduler/
│   │   │   ├── dailyTick.ts        # freeze front → write ring:{sub}:{i}
│   │   │   └── hourlySweeper.ts    # check IANA tz, run tick for due communities
│   │   ├── redis/
│   │   │   ├── keys.ts             # key template functions
│   │   │   └── aggregates.ts       # typed hset/hget/zadd wrappers
│   │   ├── webroot/
│   │   │   ├── App.tsx             # React host, wires canvas + UI
│   │   │   └── useEngine.ts        # hook: loads DayVectors, calls render()
│   │   └── settings.ts             # Genome settings schema for Devvit settings API
│   └── styles/
│       └── techno.ts               # StyleTemplate constant for Techno skin
├── tests/
│   ├── engine/
│   │   ├── synthesis.test.ts       # determinism: same seed → identical Scene
│   │   ├── contracts.test.ts       # parse/safeParse roundtrips
│   │   └── rng.test.ts             # mulberry32 sequence stability
│   └── sim/
│       └── generator.test.ts
├── docs/
│   ├── mandelbrut-requirements.md
│   └── mandelbrut-universe-mock.html
└── vite.config.ts
```

### Structure Rationale

- **`engine/contracts/`:** All four typed seams live here. Nothing else in the repo duplicates these types — everything uses `z.infer<typeof XSchema>`. This is the single point to update when a contract changes.
- **`engine/paint/`:** One file per style. Each style imports `primitives.ts` and receives a typed `Scene`; it never touches `DayVector`. Adding Comic/Pixel in Week 3 = add one file, zero changes to synthesis.
- **`engine/rng.ts`:** A single, importable `mulberry32` factory. Synthesis imports it; nothing else does. This makes it trivial to enforce "no Math.random in engine/".
- **`sim/`:** Generates `DayVector[]` and calls the engine contracts' `.parse()` once before passing to synthesis. Acts as the proof that any well-formed DayVector renders correctly.
- **`devvit/`:** Hard isolation boundary. An ESLint rule or a `tsconfig.json` path alias can enforce that `engine/**` never imports from `devvit/**`.

---

## Architectural Patterns

### Pattern 1: Functional Core, Imperative Shell

**What:** The engine (synthesis + paint) is a pure functional core — given the same inputs it always produces the same output and has no side effects. The shell (Devvit triggers, scheduler, webroot) handles all I/O: reading redis, scheduling jobs, rendering to a real canvas element, sending realtime events.

**When to use:** Always. This is the primary structural invariant for the whole project.

**Trade-offs:** Slight overhead in passing data through the boundary explicitly, but testing synthesis requires zero mocks (just call `synthesize(days, genome)` and assert on the returned `Scene`). The Devvit layer can change completely without touching the engine.

**Example:**

```typescript
// engine/synthesis.ts — pure
export function synthesize(days: DayVector[], genome: Genome): Scene {
  const rng = mulberry32(days[days.length - 1].seed);
  // ... deterministic geometry math ...
  return scene; // no side effects, no canvas, no DOM
}

// devvit/webroot/useEngine.ts — shell
const rawDays = await redis.lrange(`ring:${subId}`, 0, -1);
const days = rawDays.map(r => DayVectorSchema.parse(JSON.parse(r)));
const scene = synthesize(days, genome);
paint(scene, styleTechno, canvasCtx, bakeCache);
```

### Pattern 2: Zod as Single Source of Truth — Parse at Boundaries Only

**What:** Each contract (DayVector, Scene, Genome, StyleTemplate) is defined once as a Zod schema. TypeScript types are `z.infer<typeof Schema>`. `.parse()` is called exactly at two boundaries: (a) when the simulator hands `DayVector[]` to the engine, and (b) when Devvit's scheduler reads a `ring:{sub}:{i}` redis hash and reconstructs a `DayVector`. Never parse inside the frame loop, never parse inside synthesis or paint.

**When to use:** Always at external/untrusted boundaries. Never inside hot paths.

**Trade-offs:** A small CPU cost at parse-time; negligible because it's once per load, not per frame. The benefit is that if a redis record is malformed, the error surfaces at the boundary with a structured Zod error, not as a silent NaN deep in the geometry math.

**Example:**

```typescript
// contracts/DayVector.ts
export const DayVectorSchema = z.object({
  day: z.number().int().positive(),
  date: z.string(),
  posts: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  contributors: z.number().nonnegative(),
  scoreSum: z.number().nonnegative(),
  topThreads: z.array(z.number()),
  conflict: z.number().min(0).max(1),
  momentum: z.number().min(-1).max(1),
  diversity: z.number().min(0).max(1),
  dominantTheme: z.string(),
  steering: z.object({ branch: z.number(), symmetry: z.number(), hue: z.number() }),
  seed: z.number().int(),
});
export type DayVector = z.infer<typeof DayVectorSchema>;

// sim/index.ts — boundary: parse once before handing to engine
const days = rawSimData.map(d => DayVectorSchema.parse(d));
```

### Pattern 3: Bake-on-Freeze Cache for 60fps Mobile

**What:** When a shell transitions from "frontier" to "frozen" (daily tick), the paint layer renders it once to an `OffscreenCanvas` (or a hidden `HTMLCanvasElement` for iOS < 16.4 fallback), storing the bitmap. On subsequent rAF frames, frozen shells are composited with a single `drawImage()` call per shell instead of iterating all elements. The frontier shell (today's) always re-renders from the Scene.

**When to use:** Immediately on freeze. Week 1: implement bakeCache module even though the sim won't trigger real freezes — it proves the abstraction. Trigger bake manually in the sim when "regenerate" is clicked.

**Trade-offs:** Memory cost: one `OffscreenCanvas` per shell (14 shells in the mock = 14 bitmaps). At 392×362 px each at 2× DPR that is ~14 × 784 × 724 × 4 bytes ≈ ~31 MB — acceptable. At very low zoom the visual contribution per shell is tiny; LOD tiering means we skip baking detail we'd never see.

**Example:**

```typescript
// engine/paint/bakeCache.ts
export class ShellBakeCache {
  private cache = new Map<number, OffscreenCanvas | HTMLCanvasElement>();

  bake(day: number, shell: Shell, style: StyleTemplate, W: number, H: number): void {
    const off = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = off.getContext('2d')!;
    paintShell(shell, style, ctx); // paint module, not synthesis
    this.cache.set(day, off);
  }

  get(day: number): OffscreenCanvas | HTMLCanvasElement | undefined {
    return this.cache.get(day);
  }

  invalidate(): void { this.cache.clear(); } // call on zoom LOD tier change
}
```

### Pattern 4: LOD by Zoom Tier

**What:** Divide zoom levels into three tiers: FAR (all shells visible, low detail), MID (focus shell full detail, neighbors medium), CLOSE (focus shell extreme detail, stars resolvable). At each tier boundary, invalidate the bake cache and re-bake at appropriate resolution. At FAR, don't bake individual stars — bake a nebula approximation. At CLOSE, add star halos and size scaling.

**When to use:** After the bake cache is working. LOD is applied inside the paint layer, not synthesis — synthesis always produces the full Scene graph.

**Trade-offs:** Additional complexity in paint. Worth it because mobile GPU is the bottleneck, not CPU.

### Pattern 5: Devvit Adapter — Engine Stays Ignorant

**What:** The engine never imports Devvit. The Devvit layer imports the engine. When the Devvit webroot needs to render, it: (a) reads redis ring records, (b) parses them to `DayVector[]` via Zod, (c) reads `genome:{sub}` and parses to `Genome`, (d) calls `render(days, genome, style, canvas, camera)`. The engine is called as a library.

**When to use:** When wiring Devvit in Week 2. The interface contract is already established in Week 1 (via simulator as proof).

**Trade-offs:** None meaningful — this is the only correct approach given the simulator-first build order.

---

## Data Flow

### Primary Render Flow (Week 1 — Simulator)

```
Simulator
  generateDays(n, seed) → DayVector[] (raw)
        │
        ▼  DayVectorSchema.parse() ← Zod boundary
  DayVector[] (typed, validated)
        │
        ▼  synthesize(days, genome)
  Scene { core, shells: Shell[], each with Element[] }
        │
        ├──→  bakeCache.bake(day, shell, style, W, H)  [frozen shells]
        │
        └──→  paintFrontier(scene.shells[0], style, ctx)  [live shell]
                      │
                      ▼  requestAnimationFrame
                    frame
                      │
                      ▼  compositeAll(bakeCache, frontierFrame, camera) → canvas
```

### Camera / Scrub Flow

```
User scrubs depth slider
        │
        ▼  camera.setFocus(day)
  CameraState { zoom, focusDay, panOffset, lodTier }
        │  (camera does NOT re-run synthesis)
        ▼  paint reads camera.lodTier to pick detail level
  re-composite from existing bake cache + frontier
```

### Nudge Flow (steering)

```
User clicks nudge button (branch / symmetry / hue)
        │
        ▼  update steeringAccumulator in UI state
  Updated DayVector[0].steering (today's frontier only)
        │
        ▼  synthesize([updatedFrontierDay], genome) ← re-synthesize frontier only
  Scene.shells[0] updated
        │
        ▼  paintFrontier() on next rAF
```

### Devvit Data Flow (Week 2)

```
Reddit event (post/comment/vote)
        │
        ▼  Devvit trigger handler
  redis HINCRBY agg:{sub}:{day} posts 1
  redis SADD agg:{sub}:{day}:authors userId
        │
  [daily tick — scheduler]
        ▼
  read agg:{sub}:{day} → compute DayVector → compute seed = hash(subId, day, genomeVersion)
  redis HSET ring:{sub}:{ringCount} (DayVector fields + seed)
  redis HINCRBY organism:{sub} ringCount 1
        │
  [webroot load]
        ▼
  redis LRANGE ring:{sub} 0 -1 → DayVector[]
        │
        ▼  DayVectorSchema.parse() at this boundary
  render(days, genome, style, canvas, camera)
```

### Realtime Frontier Flow (Week 3)

```
Another user submits nudge
        │
        ▼  webroot sends to Devvit realtime channel
  steer:{sub}:{day} HASH updated in redis
        │
        ▼  realtime broadcast to all subscribers
  All open clients receive updated steering aggregates
        │
        ▼  re-synthesize frontier → re-paint → visible in <100ms
```

---

## Dependency-Ordered Build Sequence

This is the Week 1 build order. Each step is independently testable before the next.

### Step 1: Contracts (Day 1)

Define all four Zod schemas in `src/engine/contracts/`. Write unit tests that `.parse()` valid fixtures and assert Zod errors on invalid ones. No rendering yet.

Deliverable: `DayVectorSchema`, `SceneSchema`, `GenomeSchema`, `StyleTemplateSchema` compile and pass tests.

### Step 2: RNG + Synthesis skeleton (Day 1–2)

Implement `mulberry32` in `rng.ts`. Write `synthesize()` as a pure function stub that maps `DayVector[]` to the `Scene` shape. Port the `genShell()` logic from the mock, replacing the mock's direct `eras` array access with `DayVector` fields and the `Genome` weight constants.

Deliverable: `synthesize(fixtureDays, defaultGenome)` returns a valid `Scene`. Test: same inputs → identical `Scene` with two separate calls (determinism proof).

### Step 3: Paint — Techno style (Day 2–4)

Port the mock's `frame()` rendering function into `src/engine/paint/techno.ts`. It takes a `Scene + StyleTemplate + CanvasRenderingContext2D`. Implement `bakeCache.ts`. Wire a minimal Vite HTML page that calls `render()` with hardcoded fixture days.

Deliverable: Visual output matches `docs/mandelbrut-universe-mock.html` pixel-approximately.

### Step 4: Camera (Day 3–4)

Implement `camera.ts` with `CameraState`, zoom easing, `lodTier`, focus mapping. Wire to the depth scrubber in the Vite test page.

Deliverable: Scrub changes the focused shell; zoom in/out works.

### Step 5: Simulator (Day 4–5)

Build `src/sim/generator.ts`. Implement the five day-type patterns (growth, spike, AMA-day, quiet, drama). Wire a "regenerate" button in the Vite test page that calls `generateDays()` and re-renders.

Deliverable: Changing simulated data visibly changes the universe. Same seed → same universe.

### Step 6: Verify + polish (Day 5–7)

- `prefers-reduced-motion` branch: static frame, no rAF animation.
- Depth readout: day / era / theme / stats / conflict bar.
- Nudge buttons re-synthesize frontier only.
- All tests pass (`vitest run`).
- Build is clean (`tsc --noEmit`).

---

## Integration Points

### Week 2 Devvit Attachment

The engine attaches to Devvit at exactly one seam: `src/devvit/webroot/useEngine.ts` calls `render(days, genome, style, canvas, camera)`. No engine file is modified. The attachment is:

| Devvit Primitive | What It Feeds | Engine Entry Point |
|-----------------|---------------|--------------------|
| `redis.hgetall('ring:{sub}:{i}')` × N rings | `DayVector[]` | `DayVectorSchema.parse()` then `synthesize()` |
| `redis.get('genome:{sub}')` | `Genome` | `GenomeSchema.parse()` then `synthesize()` |
| `realtime.subscribe('steer:{sub}')` | updated `steering` in frontier DayVector | re-synthesize frontier only |
| Devvit `settings` API | `Genome` at install | `GenomeSchema.parse()` in settings handler |

### ESLint Enforcement (Recommended)

Add `eslint-plugin-import` with a rule that forbids `src/engine/**` from importing `src/devvit/**`. This makes the boundary compile-time enforced, not just a convention.

```json
// .eslintrc (engine boundary rule)
{
  "overrides": [{
    "files": ["src/engine/**/*.ts"],
    "rules": {
      "no-restricted-imports": ["error", { "patterns": ["*/devvit/*", "@devvit/*"] }]
    }
  }]
}
```

---

## Scaling Considerations

The engine itself does not scale — it's a pure function with no network. Scaling concerns are entirely in the Devvit layer.

| Scale | Architecture Adjustment |
|-------|------------------------|
| 1 community, < 100 rings | Single scheduler job per community; redis keys trivially small |
| 10–100 communities | Hourly sweeper batches tick jobs; each tick is one redis read + one write (~25 scalars) — negligible |
| 1,000+ communities | Sweeper may need to shard by sub hash; redis size per community is bounded (only live aggregates + ring records, no images) |
| Render performance | Only the frontier animates; N frozen shells = N `drawImage()` calls per frame regardless of community size |

The bake cache is per-client (in the browser), not shared. Server-side preview (Week 2 stretch) runs `synthesize()` server-side and writes a static frame — this is the only server CPU cost per community per render request.

---

## Anti-Patterns

### Anti-Pattern 1: Validation in the Frame Loop

**What people do:** Call `DayVectorSchema.parse()` inside `requestAnimationFrame` or inside `synthesize()`.

**Why it's wrong:** At 60fps with 14 shells this runs `parse()` 840+ times per second. Zod v4 is 6.5× faster than v3 but still costs ~microseconds per parse. More importantly, synthesis already has validated data — re-parsing is semantically wrong.

**Do this instead:** Parse once at the boundary when data arrives (redis read, sim generate). Inside the engine, trust the types.

### Anti-Pattern 2: Synthesis Knowing About Styles

**What people do:** Pass `StyleTemplate` into `synthesis.ts`, or return color values from synthesis.

**Why it's wrong:** Makes it impossible to change styles without touching synthesis. Breaks the two-contract seam. Makes server-side preview require style knowledge.

**Do this instead:** Synthesis returns a `Scene` with only geometry (angle, radius, size, energy, hue-hint as 0–1, conflict). Paint interprets `hue-hint` through the StyleTemplate palette.

### Anti-Pattern 3: Math.random() in Engine

**What people do:** Call `Math.random()` anywhere inside `src/engine/`.

**Why it's wrong:** Breaks determinism. Two calls with the same `DayVector + seed` produce different Scenes on different clients.

**Do this instead:** All randomness uses the `mulberry32` closure seeded from `DayVector.seed`. The seed is `hash(subId, day, genomeVersion)` computed once by the collector. Tests can verify: `synthesize(day, genome).shells[0].elements[0].angle === synthesize(day, genome).shells[0].elements[0].angle`.

### Anti-Pattern 4: Storing Images or Geometry in Redis

**What people do:** Serialize the `Scene` or a canvas bitmap to redis.

**Why it's wrong:** Destroys the memory efficiency guarantee (NFR-3). A `Scene` for 14 shells with 112 elements each is ~3KB of JSON minimum, versus ~25 scalars + seed per ring at ~200 bytes. Bitmaps are orders of magnitude larger.

**Do this instead:** Store only `DayVector` (25 scalars + seed). Regenerate `Scene` deterministically from it on any client, any time.

### Anti-Pattern 5: Engine Importing Devvit

**What people do:** Import `@devvit/web` inside `src/engine/` to access redis or realtime.

**Why it's wrong:** Breaks the simulator call site (sim cannot run Devvit), breaks server-side rendering, breaks unit tests, and ties the engine to a specific platform.

**Do this instead:** Keep `src/engine/` importing only `zod` and browser-native APIs (`CanvasRenderingContext2D`, `OffscreenCanvas`). All Devvit imports live in `src/devvit/`.

### Anti-Pattern 6: Baking the Frontier Shell

**What people do:** Cache today's frontier shell alongside frozen shells.

**Why it's wrong:** The frontier changes on every nudge, every realtime activity event, and pulses on every rAF frame. A stale baked bitmap means users don't see steering results immediately.

**Do this instead:** The bake cache key is `day`. The frontier is always `day === today.day`; check this before looking up the cache and always paint it live.

---

## Key Architectural Decisions with Rationale

| Decision | Rationale |
|----------|-----------|
| Engine has zero Devvit imports | Three call sites (game, sim, server preview) require the engine to be platform-agnostic. This is the fundamental axiom. |
| Zod schemas as contracts, not TS interfaces | Single source of truth; runtime validation at boundaries; `z.infer` eliminates type duplication. Zod v4 is available and 6.5× faster than v3 for object parsing. |
| `mulberry32` as seeded RNG | Tiny (4 lines), fast, well-understood, closure-based. The mock already uses it. Switching would require re-deriving all existing seeds. |
| Paint is per-style file, not per-element | Each style file owns its full rendering algorithm. Adding a style = adding one file. No style switch logic inside shared paint code. |
| Bake cache held in paint layer, not synthesis | Synthesis produces Scene (pure geometry). Caching is a performance concern of the render layer, not of data transformation. |
| Camera is independent of Scene | Camera state drives LOD tier and focus, but does not mutate or re-run synthesis. Scrubbing is free: just re-composite from existing cache. |
| Simulator as Week-1 harness | Decouples visual progress from Devvit API uncertainty (R-5). The sim's output schema IS the DayVector contract the real collector will fill — no schema drift. |
| `src/devvit/` isolated by convention + ESLint | Makes the boundary visible and enforceable without needing a monorepo or separate package. |

---

## Sources

- Project spec: `docs/mandelbrut-requirements.md` §6 (contracts), §7 (architecture), §5 (NFRs) — HIGH confidence (primary source)
- Existing implementation: `docs/mandelbrut-universe-mock.html` — HIGH confidence (ground truth for synthesis logic to port)
- Functional Core, Imperative Shell pattern: [Kenneth Lange](https://kennethlange.com/functional-core-imperative-shell/), [Destroy All Software](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) — LOW confidence (web, corroborates well-known pattern)
- Mulberry32 PRNG: [Emanuele Feronato](https://emanueleferonato.com/2026/01/08/understanding-how-to-use-mulberry32-to-achieve-deterministic-randomness-in-javascript/), [4rknova blog](https://www.4rknova.com/blog/2026/03/01/mulberry32-rng) — LOW confidence (web)
- Canvas2D OffscreenCanvas bake cache: [MDN Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [web.dev OffscreenCanvas](https://web.dev/articles/offscreen-canvas) — LOW confidence (web)
- Zod v4 parse/safeParse API: [zod.dev v4](https://zod.dev/v4) via Context7 — MEDIUM confidence
- Hexagonal architecture / adapter pattern: [runlevel0.me TypeScript series](https://runlevel0.me/blog/hexagonal-architecture-in-typescript-part-1/) — LOW confidence (web)
- Devvit API surface: verify against [developers.reddit.com/docs](https://developers.reddit.com/docs) before Week 2 — currently UNVERIFIED (site not accessible during research; API surface derived from requirements §7.3 and npm package listing)

---

*Architecture research for: Mandelbrut — collaborative persistent Reddit game*
*Researched: 2026-06-19*

# Phase 2: Visual Engine + Simulator - Research

**Researched:** 2026-06-19
**Domain:** Procedural WebGL rendering (Phaser 4.2) of a deterministic Scene + independent camera + steering + data simulator, behind the Phase-1 `Scene`/`StyleTemplate` seam
**Confidence:** HIGH (codebase + mock are ground truth; Phaser 4.2 API surface MEDIUM, verified via Context7)

## Summary

Phase 1 is done: the four Zod contracts, pure `synthesize(DayVector[], Genome) → Scene`, `mulberry32`, the three genome presets, and a typed `render()` **stub** all exist and are CI-green. Phase 2 is the **imperative shell**: a Phaser 4.2 WebGL paint module (living OUTSIDE `src/engine/`), an independent camera, frontier steering, a `DayVector[]` simulator, and a standalone Vite dev page wiring them together at visual parity with `docs/subcosm-universe-mock.html`. **No new packages, no synthesis changes, no contract changes** are required — the typed seam is final.

The single biggest research finding: the Phase-1 `ARCHITECTURE.md` describes the paint/bake layer in **Canvas2D** terms (`OffscreenCanvas`, `ctx.createRadialGradient`, `globalCompositeOperation='lighter'`). The locked stack is **Phaser (WebGL)** (PNT-01, not negotiable). So the architecture's *intent* (bake frozen shells, animate only the frontier, additive glow, LOD by zoom) carries over verbatim, but every primitive maps to a Phaser equivalent: `OffscreenCanvas` → Phaser `DynamicTexture`/`RenderTexture`; `ctx.createRadialGradient` glow → a pre-generated radial-glow **texture** drawn as an additive Sprite/Image; `globalCompositeOperation='lighter'` → `BlendModes.ADD`; per-`drawImage` compositing → one `Image` per baked shell, transformed by the Phaser Camera. This re-mapping is the core deliverable of this RESEARCH.

The mock's whole renderer is ~200 lines of canvas drawing (`frame()`, lines 184–272). It draws, per frame: background radial gradient + 90 bg stars (additive) → faint orbital guide rings → per shell {nebula clouds (additive radial gradients) + stars (additive, big ones get a glow gradient)} → today's frontier ignite ring → genesis core (additive radial gradient + bright dot) → vignette. **Synthesis already ported the geometry** (`genShell` → `Element[]`); paint only has to *draw* the `Scene` Phaser-side and map `hue` (0..1 hint) through the `StyleTemplate` palette.

**Primary recommendation:** Build `src/client/cosmos/` (paint + camera + bake) as the imperative shell, fill the four `render()` stub methods in `src/engine/render.ts` by delegating to it through a thin injected interface (so the engine never imports Phaser), author the `techno` + crystalline `StyleTemplate` data objects, add `src/sim/` for the scripted 30-day scenario, and add a standalone `cosmos-dev.html` Vite entry separate from the Devvit `game.html`. Use Phaser `DynamicTexture` bake-on-freeze, `BlendModes.ADD` glow with a pre-generated radial-glow texture, one Phaser Camera for zoom/scrub/focus, and re-synthesize only `shells[0]` on a nudge.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Geometry from data (`DayVector[]`→`Scene`) | Engine (pure, `src/engine/synthesis.ts`) | — | DONE in Phase 1; style-agnostic, deterministic. Phase 2 must NOT touch it. |
| Pixels from geometry (`Scene`+`StyleTemplate`→WebGL) | Client paint (`src/client/cosmos/paint`) | — | Phaser banned in `src/engine/` (ESLint). Paint reads `Scene`+`StyleTemplate` types only. |
| View state (zoom / scrub / focus / intro) | Client camera (`src/client/cosmos/camera`) | Phaser Camera | Holds independent state; NEVER mutates `Scene` (CAM-01). |
| Frontier re-synthesis on nudge | Engine `synthesize()` (re-called) + client wiring | — | Nudge mutates `shells[0]` steering, re-runs pure synthesis for the frontier day only (STR-01/02). |
| Bake / perf (frozen shells → `DynamicTexture`) | Client paint | Phaser DynamicTexture/RenderTexture | Performance is a render concern, not data (Anti-Pattern: don't bake in synthesis). |
| `DayVector[]` generation + `.parse()` boundary | Simulator (`src/sim/`) | Zod | Only validation point before the engine (SIM-02, QA-03). |
| Dev-page chrome (HUD, controls) | Client DOM/CSS (`src/client/cosmos-dev`) | — | Plain HTML+CSS per UI-SPEC; floats over the Phaser canvas. |
| `render()` orchestration entry | Engine `render.ts` (signature) → injected paint impl | — | Engine owns the typed entry; paint is injected so engine stays Phaser-free (ENG-02/03/04). |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Navigation, CAM-01/02):** Navigation uses **both** a horizontal **depth slider-scrubber** (drives *time* — dragging flies through the shells) **and pinch/scroll zoom** (drives the *zoom level*); **clicking a shell focuses/zooms it**. The camera holds independent view state (zoom/focus/scrub/intro) and **never mutates the Scene** (CAM-01).
- **D-02 (Readout/HUD, CAM-03):** The per-shell readout is a **fixed, always-visible HUD panel** that updates with the focused/scrubbed shell — date / era / theme / stars / comments / contributors / conflict. The **live (frontier) day's HUD additionally shows that day's goal** (e.g. "Goal: tame conflict below 0.3"). Legibility is a **hard rule — never removed or hidden behind interaction.**
- **D-03 (Simulator, SIM-01):** The simulator produces a **scripted ~30-day story scenario**: **cold-start day-1 → growth ramp → drama spike (~day 12, red turbulence) → AMA day (~day 20, a few huge bright clusters) → quiet days**. The **seed only dices WITHIN the beats** — a `regenerate` yields a visibly different but still well-told universe. Exact day count and beat positions are Claude's discretion within this shape.
- **D-04 (Aesthetic, PNT-01):** **Mock-parity, subtly elevated.** Phaser/WebGL paint must hit visual parity with `docs/subcosm-universe-mock.html` (genesis core, concentric shells, cyan↔magenta nebula, frontier ignite, vignette) — but **cleaner than canvas via real WebGL additive-blend glow**. Not strict 1:1, not over-elevated; must stay **legible and read self-authored (not AI-slop)**. The fbm/shader pass stays **Stretch**.
- **D-05 (Crystalline, PNT-02):** **Crystalline's final look** = **cool, faceted, ice-blue/white, high-symmetry, sharper/angular star primitives** — clearly distinct from Calm and Chaotic at a glance. Genome values already exist (Phase 1); this fixes its `StyleTemplate`/palette direction.

### Claude's Discretion
- **Nudge controls (STR-01/02):** control style (buttons vs sliders for branch / symmetry / hue) and per-nudge visible strength — but a nudge **biases the MEAN only** (result still diced around it; `steerGain` from genome data) — invariant, never dictates the outcome.
- **Dev-page (QA-01) control-harness layout/styling** (scrubber + nudge buttons + regenerate + seed field + genome-preset selector).
- **Reduced-motion (PNT-04) static-render look** — a calm, non-animated, non-strobe frame.
- All **Phaser perf mechanics** (PNT-03: frozen shells baked to `RenderTexture`, reused textures/geometry, capped DPR/resolution → ~60fps) — researcher/planner.
- `genShell` Scene → paint primitive mapping fidelity details.

### Deferred Ideas (OUT OF SCOPE)
- **fbm/WebGL shader pass** on top of the Phaser renderer (STRETCH-Shader) — Phase 2 stretch only.
- **Comic + Pixel StyleTemplates** (STRETCH-Styles) — each a data file, later/stretch.
- **Full Signal→Param weight matrix exercised + rare-event mutation table + presets-UI** (STRETCH-Genome).
- **Mode B** (real community top-post/comment theme extraction) — Stretch.
- **Devvit wiring, live frontier, overnight reveal, goal *scoring*** — Phases 3–4.
- **Connected multiverse outer zoom tier** — post-MVP; Phase 2 only keeps the camera/coordinate model embeddable (CAM-04, design review).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PNT-01 | Techno Phaser (WebGL) paint at visual parity with the mock | "Phaser ↔ Canvas mock mapping" table + "System Architecture" below; `BlendModes.ADD` confirmed WebGL-capable [CITED] |
| PNT-02 | All Techno look constants come from a `StyleTemplate` data object | `StyleTemplateSchema` already typed (Phase 1); author `techno` instance + crystalline override (Pattern: StyleTemplate-as-data) |
| PNT-03 | Mobile-perf: bake frozen shells to RenderTexture, reuse textures/geometry, cap DPR → ~60fps | Pattern 3 (Bake-on-freeze via `DynamicTexture`) + Pattern 5 (pre-generated glow texture) + DPR cap |
| PNT-04 | Honor `prefers-reduced-motion` — static frame, no strobe/ignite | Pattern 6 + `StyleTemplate.motion.frontierOnly/speed`; mock's `reduce` branch is the reference |
| CAM-01 | Camera holds independent view state, never mutates Scene | Pattern 4 (Camera adapter); Phaser Camera holds zoom/scroll/focus separate from Scene |
| CAM-02 | Depth scrubber flies through time; focusing a shell zooms it; depth→date | `camera.scrub(day)` + slider↔click sync; `radii[i]` depth→day mapping ported from mock |
| CAM-03 | Per-shell readout (date/era/theme/stars/comments/contributors/conflict) | HUD reads `Scene.shells[focus].meta` — fields already present on `ShellMeta` |
| CAM-04 | Camera/coordinate model kept embeddable (design-review only) | "Embeddability constraints" section — normalized coords, no global singletons; NO implementation |
| STR-01 | Nudge controls (branch/symmetry/hue) re-synthesize the live frontier visibly | Nudge flow: mutate `shells[0]` steering → re-run `synthesize()` for frontier → re-bake frontier |
| STR-02 | Nudges bias the MEAN only; result still diced around it | `steerGain` from genome; mock l.296-299 is the reference (`todayBranch/Sym/Hue` shift the mean, RNG dices) |
| SIM-01 | `generateDayVectors(config)` → realistic 30-day scripted scenario | Pattern: beat-table simulator; D-03 beats; per-day seed dicing |
| SIM-02 | Simulator calls `DayVectorSchema.parse()` at its output boundary | The ONE Zod boundary in this phase (QA-03); `.parse()` after generation, before `render()` |
| SIM-03 | Regenerate from a new seed; same seed reproduces identical universe | Master seed → per-day seeds; deterministic; same seed field → identical `DayVector[]` |
| QA-01 | Dev page (Vite): scrubber, nudges, regenerate, seed field, genome-preset selector | Standalone `cosmos-dev.html` Vite entry separate from Devvit `game.html` |
| QA-02 | `npm test` passes (determinism + schema tests); build + `tsc --noEmit` green | Reuse Phase-1 test infra (vitest); add sim determinism + sim-output schema-validity tests |
| QA-03 | `.parse()` only at boundaries, never in synthesis/paint/frame loop | Single parse in `src/sim/`; paint/camera/frame loop trust the `Scene` type |
</phase_requirements>

## Standard Stack

No new dependencies. Everything is installed and proven in Phase 1.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `phaser` | 4.2.0 (installed) | WebGL paint layer (paint + camera + bake) | Locked by PNT-01; targets "Best Use of Phaser" prize; already in `package.json` [VERIFIED: package.json] |
| `zod` | 4.4.3 (installed) | `DayVectorSchema.parse()` at the sim boundary (SIM-02) | Project single-source-of-truth (CLAUDE.md); already used by contracts/genomes [VERIFIED: package.json] |
| `vite` | 8.x (installed) | Dev page bundling + the standalone cosmos-dev entry | Already the build tool; Devvit uses it [VERIFIED: package.json] |
| `vitest` | 4.1.9 (installed) | determinism + schema-validity tests (QA-02) | Phase-1 test infra; reuse directly [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@devvit/start/vite` | 0.13.4 (installed) | Vite plugin currently wrapping the build | Present; the cosmos-dev entry must coexist with it — see Pitfall 1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Phaser DynamicTexture bake | Raw `OffscreenCanvas` (Phase-1 arch suggestion) | Breaks "WebGL paint" (PNT-01) and the single-renderer model; would run two renderers. **Rejected** — locked to Phaser. |
| Phaser Camera for zoom/scrub | Manual matrix transform of a Container | Phaser Camera gives zoom/scroll/`zoomTo`/`centerOn` for free and is the documented path. Use the Camera. |
| `rexUI`/`rex-pinch` plugin for pinch | Hand-rolled two-pointer pinch (`input.addPointer(1)`) | Phaser has NO built-in pinch gesture; a 3rd-party plugin is an unverified install. Hand-roll from two active pointers (small, in `src/client/`). See "Don't Hand-Roll" exception note. |

**Installation:** none — all packages already in `package.json` and `node_modules`.

**Version verification:** `phaser@4.2.0`, `zod@4.4.3`, `vite@8.x`, `vitest@4.1.9` confirmed present in `package.json` and `node_modules/phaser/package.json` [VERIFIED: package.json]. Context7 docs fetched against Phaser `4.0.0-rc.6` API documentation (closest published API set to 4.2.0) [CITED: docs.phaser.io/api-documentation/4.0.0-rc.6].

## Package Legitimacy Audit

> This phase installs **no new packages**. All four core packages are pre-installed from Phase 1. Verdicts below are from `package-legitimacy check` on the existing stack for completeness.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| phaser | npm | mature (point release dated 2026-06-19) | 222,930/wk | github.com/phaserjs/phaser | SUS (too-new flag) | Approved — false positive; established framework, locked by PNT-01, already installed |
| zod | npm | mature | 201,966,959/wk | github.com/colinhacks/zod | OK | Approved — already installed |
| vite | npm | mature (point release 2026-06-01) | 142,305,412/wk | github.com/vitejs/vite | SUS (too-new flag) | Approved — false positive; already installed |
| vitest | npm | mature (point release 2026-06-15) | 71,277,824/wk | github.com/vitest-dev/vitest | SUS (too-new flag) | Approved — false positive; already installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** phaser, vite, vitest — all flagged ONLY on "too-new" (a recent point release of a long-established package with millions of weekly downloads and a real GitHub repo). All are already installed and exercised by Phase 1's green CI. No new install, no `checkpoint:human-verify` needed. The seam's "too-new" heuristic mis-fires on mature packages that shipped a patch this week.

## Architecture Patterns

### System Architecture Diagram

```
                         STANDALONE DEV PAGE (cosmos-dev.html — Vite entry, QA-01)
                                          │
        ┌─────────────────────────────────┴──────────────────────────────────┐
        │                                                                      │
   CONTROL HARNESS (DOM/CSS, per UI-SPEC)                          PHASER CANVAS (WebGL)
   scrubber · pinch/scroll · click-focus                                  │
   nudge buttons · regenerate · seed field · genome selector              │
        │                │                  │                              │
        │ regenerate     │ nudge            │ scrub/zoom/click             │
        ▼                ▼                  ▼                              │
 ┌──────────────┐   (mutate shells[0]   (camera only —                    │
 │  SIMULATOR   │    steering, re-       no Scene mutation)                │
 │ src/sim/     │    synthesize                                           │
 │ generateDay  │    frontier)                                            │
 │ Vectors(cfg) │        │                                                │
 └──────┬───────┘        │                                                │
        │ DayVector[]    │                                                │
        ▼                │                                                │
  DayVectorSchema        │                                                │
   .parse()  ◄── THE ONLY Zod boundary (SIM-02/QA-03)                     │
        │                │                                                │
        ▼                ▼                                                │
 ┌────────────────────────────────────────────────┐                      │
 │  ENGINE  src/engine/  (PURE — no Phaser)         │                      │
 │  render(days, genome, style) ──► RenderHandle    │                      │
 │     │ scrub() nudge() regenerate() destroy()     │                      │
 │     ▼                                            │                      │
 │  synthesize(days, genome) ──► Scene              │                      │
 │     {core, shells:[{meta, elements:[...]}]}      │                      │
 └───────────────────┬──────────────────────────────┘                     │
                     │ Scene (geometry only; hue = 0..1 hint)              │
                     ▼                                                     │
 ┌────────────────────────────────────────────────────────────┐          │
 │  PAINT + CAMERA + BAKE  src/client/cosmos/  (imperative shell)│ ────────┘
 │  reads Scene + StyleTemplate types ONLY (never DayVector)    │
 │                                                              │
 │  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐    │
 │  │ bake: each │  │ frontier:    │  │ camera: Phaser Cam │    │
 │  │ FROZEN     │  │ shells[0]    │  │ zoom/scroll/focus  │    │
 │  │ shell →    │  │ re-rendered  │  │ holds view state,  │    │
 │  │ Dynamic-   │  │ every rAF    │  │ never mutates Scene│    │
 │  │ Texture    │  │ (ignite,     │  │ (CAM-01)           │    │
 │  │ (1 Image)  │  │  twinkle)    │  │                    │    │
 │  └────────────┘  └──────────────┘  └────────────────────┘    │
 │  glow = pre-generated radial texture, drawn BlendModes.ADD   │
 └──────────────────────────────────────────────────────────────┘
                     │
                     ▼
                HUD readout (DOM overlay) reads Scene.shells[focus].meta
                — always visible (D-02), frontier shows goal line
```

Trace the primary use case: simulator generates `DayVector[]` → parsed once → `synthesize` → `Scene` → paint bakes frozen shells to DynamicTextures (one Image each) and live-renders the frontier per frame → camera (zoom/scrub/focus) transforms the view → HUD reads `meta`. A nudge re-synthesizes only `shells[0]` and re-bakes just that layer.

### The Phaser ↔ Canvas-mock mapping (the core PNT-01 finding)

The Phase-1 `ARCHITECTURE.md` is Canvas2D-flavored. The locked stack is Phaser WebGL. This table is the authoritative translation the planner must encode into tasks:

| Mock canvas operation (`subcosm-universe-mock.html`) | Phaser 4.2 equivalent | Notes |
|---|---|---|
| `ctx.globalCompositeOperation='lighter'` (l.195) | `gameObject.setBlendMode(Phaser.BlendModes.ADD)` | `ADD` is explicitly "For Canvas and WebGL" [CITED: docs.phaser.io/.../constant/blendmodes]. This is the cyan↔magenta glow look. |
| `ctx.createRadialGradient(...)` star/nebula/core glow (l.219, 239, 258) | A **pre-generated radial-glow texture** (one soft white→transparent disc) drawn as an additive `Image`, tinted via `setTint(hue→color)` and scaled | WebGL has no per-draw radial gradient. Generate ONE glow texture at boot (`Graphics.fillGradientStyle`/`generateTexture` or draw a `CanvasTexture` once), reuse for every star/nebula/core (Pattern 5). This is also the perf win (PNT-03: reuse, no per-star alloc). |
| `bgStars` 90 additive dots (l.196) | A static baked `DynamicTexture` background OR a Sprite pool, `BlendModes.ADD` | Bake once; never re-render (not the frontier). |
| Faint orbital guide rings (l.199-203) | `Graphics.strokeCircle` per ring (baked) or a thin ring texture | Low alpha; baked with the frozen shells. |
| Per-shell nebula clouds (l.213-223, additive radial gradient) | Additive glow-texture Images, tinted by `shell` hue, scaled to `cr` | Part of each shell's bake (frozen) or live (frontier). |
| Stars (l.228-246): small dot + big-star glow gradient | Small star = tinted dot (tiny glow texture or 1px additive sprite); big = glow texture Image + bright core dot | `Element.big` → cluster primitive. Crystalline (D-05) swaps the dot for an **angular/faceted** primitive (a small star-polygon texture). |
| Today's frontier ignite ring (l.249-252, pulsing) | `Graphics.strokeCircle` redrawn each frame with animated alpha/lineWidth (frontier only) | Lives in the live layer, not the bake. |
| Genesis core (l.256-263): big additive radial gradient + bright dot | Large additive glow-texture Image (warm-white tint) + small bright core Image | Always live (it twinkles) but cheap — 2 Images. |
| Vignette (l.267-269, dark radial overlay) | A full-screen vignette texture (`BlendModes.NORMAL`, dark, radial alpha) on top, OR a postFX | Drawn last, above everything. A pre-generated vignette texture is simplest. |
| `dpr=Math.min(window.devicePixelRatio||1,2)` (l.173) | Phaser game config `resolution`/scale; cap DPR at 2 | PNT-03: capped resolution. |
| `radii=eras.map((_,i)=>Rmax*Math.pow(0.85,i))` (l.179) | Same math; `Scene.shell.radius` already = `Math.pow(0.85, idx)` from synthesis | Multiply by `Rmax` (screen) in paint; depth→day mapping for the scrubber. |
| `zoom`/`intro` easing toward target (l.186-187) | Phaser Camera `zoom` eased per frame, or `camera.zoomTo()` | Camera state, not Scene. |

### Recommended Project Structure

```
src/
├── engine/                      # PURE — unchanged except render.ts bodies
│   ├── render.ts                # fill scrub/nudge/regenerate/destroy via an INJECTED paint impl
│   └── ...                      # contracts, synthesis, rng, genomes (untouched)
├── styles/                      # NEW — StyleTemplate data objects (PNT-02)
│   ├── techno.ts                # the Techno StyleTemplate constant (TPL-04 default look)
│   └── crystalline.ts           # crystalline StyleTemplate override (D-05: ice-blue, faceted) — or a techno variant
├── client/
│   └── cosmos/                  # NEW — the Phaser imperative shell (Phaser allowed here)
│       ├── CosmosScene.ts       # Phaser.Scene: holds layers, camera wiring, rAF frame
│       ├── paint.ts             # Scene+StyleTemplate → Phaser objects; the mock-mapping above
│       ├── primitives.ts        # glow-texture + star/cluster/facet texture generation (reused)
│       ├── bake.ts              # frozen shell → DynamicTexture; frontier stays live
│       ├── camera.ts            # CameraController: zoom/scrub/focus/intro, depth→day, LOD tier
│       ├── input.ts             # slider + wheel + two-pointer pinch + click-to-focus
│       └── reduced-motion.ts    # static-frame branch (PNT-04)
├── sim/                         # NEW — the simulator (SIM-01/02/03)
│   ├── generator.ts             # generateDayVectors(config): DayVector[]; .parse() at output
│   ├── beats.ts                 # the scripted 30-day beat table (D-03)
│   └── index.ts
└── client/
    └── cosmos-dev/              # NEW — standalone dev page (QA-01), separate from game.html
        ├── cosmos-dev.html      # Vite entry (NOT the Devvit webroot)
        ├── main.ts              # wires sim → render() → CosmosScene + HUD + controls
        ├── hud.ts               # the always-visible readout (D-02, CAM-03)
        └── cosmos-dev.css       # chrome per UI-SPEC
```

> Note: `src/styles/` and `src/sim/` are imported by the engine call-site and the client. They must NOT import Phaser (so the engine can import the StyleTemplate type-side). The `StyleTemplate` *data* is plain objects; only `src/client/cosmos/` imports Phaser. Add the appropriate `tsconfig`/eslint `files` globs for the new dirs (mirror the existing `src/client/**` config; sim can live under a shared/engine-adjacent tsconfig that bans Phaser).

### Pattern 1: Engine stays Phaser-free — inject the paint implementation

**What:** `render.ts` lives in `src/engine/` where Phaser is ESLint-banned. To fill `scrub/nudge/regenerate/destroy` without importing Phaser, `render()` accepts (or the handle is wired to) an injected `Painter` interface implemented in `src/client/cosmos/`.
**When to use:** This phase, to satisfy ENG-04 + ENG-02/03 simultaneously.
**Example:**
```typescript
// src/engine/render.ts — define the seam interface (no Phaser import)
export interface Painter {
  mount(scene: Scene, style: StyleTemplate): void;
  repaintFrontier(frontier: Shell): void;  // after a nudge re-synth
  focus(day: number): void;                // camera scrub/focus
  remount(scene: Scene, style: StyleTemplate): void; // regenerate
  destroy(): void;
}
export function render(days, genome, style, painter: Painter): RenderHandle { /* delegate */ }
```
```typescript
// src/client/cosmos/PhaserPainter.ts — implements Painter, imports Phaser (allowed here)
```
This keeps `synthesize()` + `render()` pure and unit-testable; the painter is the only Phaser holder. (Alternative: leave `render.ts` orchestration in engine but have the dev page construct the painter and pass it in. Planner picks the exact wiring; the invariant is **no `phaser` import path reaches `src/engine/`** — ESLint will fail the build otherwise.)

### Pattern 2: Bake-on-freeze with Phaser DynamicTexture (PNT-03)

**What:** Every shell EXCEPT the frontier (`shells[0]`) is drawn ONCE into a `DynamicTexture` (the object behind `RenderTexture`) and thereafter composited as a single `Image`. The frontier is re-rendered every rAF frame (ignite pulse, twinkle).
**When to use:** Immediately. Even though the sim has no real "freeze" event, treat `shells[1..]` as frozen and only `shells[0]` as live. On `regenerate`/genome-switch, clear and re-bake all. On `nudge`, re-bake only the frontier (it's live, so actually just re-render it).
**Example:**
```typescript
// DynamicTexture.draw accepts GameObjects/Containers and uses the camera.
const dt = this.textures.addDynamicTexture('shell-'+day, W, H)!;
dt.draw(shellContainer);            // one bake; shellContainer = all that shell's additive Images
this.add.image(cx, cy, 'shell-'+day); // composite as ONE object thereafter
```
[CITED: docs.phaser.io/.../class/textures-dynamictexture, .../class/gameobjects-rendertexture]

### Pattern 3: One reused glow texture, additive blend (PNT-03 + the parity look)

**What:** WebGL cannot do per-draw radial gradients. Generate ONE soft radial-glow texture at boot; draw it as an additive `Image`, `setTint(color)` + `setScale(size)` per star/nebula/core. This both reproduces the mock's `lighter` glow AND is the "reuse textures/geometry instead of per-star reallocation" requirement.
**When to use:** All glow (stars, big-star halos, nebula clouds, genesis core).
**Anti-pattern avoided:** creating a Graphics + gradient per element per frame (allocations → GC stalls → dropped frames).

### Pattern 4: Camera adapter — Phaser Camera holds view state (CAM-01)

**What:** A `CameraController` wraps `this.cameras.main`. `scrub(day)` eases zoom toward `radii[day]` target + sets focus; `zoom(delta)` adjusts `camera.zoom`; `focusShell(day)` centers + zooms. It reads `Scene.shell.radius` but NEVER writes to the `Scene`.
**When to use:** All navigation (D-01). Keep slider value and click-focus in sync (UI-SPEC: clicking a shell moves the slider; dragging the slider changes focus).

### Pattern 5: Frontier-only re-synthesis on nudge (STR-01/02)

**What:** A nudge mutates the frontier day's `steering.{branch|symmetry|hue}` (biasing the MEAN, scaled by genome `steerGain`), re-runs `synthesize([frontierDay], genome)` for just that day, and re-renders the live frontier layer. The mock's l.296-299 is the exact reference: `todayBranch += 0.16`, `todaySym += 1`, `todayHue = (todayHue+24)%360`, then `genShell(0)` re-runs and the RNG dices around the new mean.
**Invariant (STR-02):** the nudge shifts the mean; the seeded RNG still dices the actual element positions — never a deterministic dictated outcome.

### Anti-Patterns to Avoid
- **`.parse()` in the frame loop / inside synthesis / paint** — QA-03 hard rule. Parse exactly once in `src/sim/` output. At 60fps this would run thousands of times/sec.
- **Synthesis importing StyleTemplate / Phaser** — breaks ENG-02; ESLint already bans `phaser` in `src/engine/`. Paint maps `hue` (0..1) → color; synthesis stays geometry-only.
- **Baking the frontier shell** — it changes on every nudge + pulses each frame; a stale bake hides steering results (Phase-1 Anti-Pattern 6).
- **Per-element Graphics/gradient allocation per frame** — use the reused glow texture + object pools (PNT-03).
- **Re-running the full simulate/synthesize on a scrub** — scrub is camera-only; never re-synthesizes (CAM-01).
- **Mutating the existing `src/client/` Devvit Phaser counter template in place** — the dev page is a SEPARATE Vite entry; don't entangle it with the Devvit webroot (Phase 3 owns that).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frozen-shell compositing | Manual pixel copy / your own offscreen buffer | Phaser `DynamicTexture` / `RenderTexture` | Built-in WebGL-friendly bake; `.draw()` handles GameObjects + camera |
| Additive glow compositing | Custom WebGL shader pass | `setBlendMode(BlendModes.ADD)` | Native, Canvas+WebGL; matches mock's `lighter` exactly |
| Zoom / scroll / focus view state | Hand matrix math on a Container | Phaser `Camera` (`zoom`, `scrollX/Y`, `centerOn`, `zoomTo`) | Documented, eased effects, less to test |
| Seeded RNG | A new PRNG | Existing `src/engine/rng.ts` `mulberry32` | Already proven, deterministic, byte-stable; the sim seeds days from it |
| Schema validation | Manual field checks on sim output | `DayVectorSchema.parse()` | The single source of truth; structured errors at the boundary |
| Day/era/theme readout shape | New data structure | `Scene.shells[i].meta` (`ShellMeta`) | Already carries date/era/theme/posts/comments/contributors/conflict |

**Exception — pinch-zoom must be hand-rolled (small):** Phaser 4 has **no built-in pinch gesture**. The standard approach is `this.input.addPointer(1)` (enable a 2nd active pointer) and compute the distance between the two active pointers each `pointermove`, mapping the delta to `camera.zoom`. A 3rd-party plugin (`rexUI` pinch) would be an unverified install — prefer ~30 lines in `src/client/cosmos/input.ts`. Scroll-wheel zoom uses the `WHEEL`/`POINTER_WHEEL` event (`deltaY`) [CITED: docs.phaser.io/.../namespace/input-events].

**Key insight:** Almost nothing here is novel — synthesis (the hard, deterministic part) is done. Phase 2 is wiring proven Phaser primitives behind a finished typed seam. The risk is *fidelity + perf discipline*, not algorithmic difficulty.

## Common Pitfalls

### Pitfall 1: The dev page collides with the Devvit Vite build
**What goes wrong:** `vite.config.ts` is wrapped by `@devvit/start/vite`, and `devvit.json` declares two post entrypoints (`splash.html`, `game.html`) building to `dist/client`. A naive second HTML entry can get swept into the Devvit bundle or conflict with the Devvit dev server.
**Why it happens:** Devvit's Vite plugin controls the client build root and outputs; the dev harness is NOT a Devvit post.
**How to avoid:** Treat `cosmos-dev.html` as a **plain Vite dev/preview entry run independently** of `devvit playtest` (e.g. a separate `vite` invocation / a `cosmos` npm script, or a `rollupOptions.input` addition that Devvit ignores). Verify `npm run build` (Devvit) stays green and the dev page runs via plain `vite`. Confirm the exact mechanism against current `@devvit/start` docs at plan time. **[ASSUMED]** the cleanest path is a separate vite run, not adding to `devvit.json` entrypoints.
**Warning signs:** `devvit upload`/`build` tries to ship `cosmos-dev.html`; the dev page only works under `devvit playtest`.

### Pitfall 2: ESLint engine-boundary breakage
**What goes wrong:** Filling `render.ts` by importing the painter directly pulls a `phaser`/`*/client/*` import into `src/engine/` → `no-restricted-imports` fails CI.
**Why it happens:** The boundary rule bans `@devvit/*`, `phaser`, `*/client/*`, `*/server/*` inside `src/engine/**`.
**How to avoid:** Engine defines a `Painter` *interface* (types only) and receives the implementation by injection (Pattern 1). The Phaser implementation lives in `src/client/cosmos/`. Run `npm run lint` after wiring.
**Warning signs:** `error.engine...` or `no-restricted-imports` on `render.ts`.

### Pitfall 3: New dirs not covered by tsconfig/eslint project globs
**What goes wrong:** `src/styles/`, `src/sim/`, `src/client/cosmos/` aren't in any `tools/tsconfig.*.json` `include` or eslint `files` glob → `tsc --build` / typed-lint either ignores them or errors ("file not in project").
**Why it happens:** The repo uses project references with explicit `rootDir`/`include` per area (`tsconfig.client.json` includes `../src/client/**` only; engine/shared/server each own theirs).
**How to avoid:** `src/client/cosmos/` and `src/client/cosmos-dev/` fall under the existing `src/client/**` client project — good. For `src/styles/` and `src/sim/`, add includes (likely a shared or new project ref) that BANS Phaser but allows `zod` + engine contract types. Mirror the engine boundary eslint block for `src/sim/**` if you want the QA-03 parse-only discipline lint-enforced. Run `npm run type-check`.
**Warning signs:** `tsc` "is not under rootDir" / "not included in project"; eslint "parserOptions.project" errors.

### Pitfall 4: WebGL has no `createRadialGradient` (parity gap)
**What goes wrong:** A 1:1 port of the mock's per-element radial gradients produces nothing (no such WebGL call) or murders perf if faked with Graphics per frame.
**Why it happens:** The mock is Canvas2D; WebGL is texture-based.
**How to avoid:** Pre-generate glow/star/facet textures once; tint+scale+additive-draw them (Pattern 3). This is both the look AND the perf strategy.
**Warning signs:** flat discs instead of soft glow; frame time spikes when many stars are visible.

### Pitfall 5: `topThreads` empty array / cold-start day-1 (designed state, not a bug)
**What goes wrong:** Day-1 has `posts:1, contributors small`, genesis shell has NO elements (synthesis returns `elements:[]` for `day===1`). A paint loop that assumes ≥1 element, or a sim that emits an empty `topThreads` spread into `Math.max()`, breaks.
**Why it happens:** The cold-start day is intentionally near-empty (UI-SPEC empty-state copy: "A universe begins…").
**How to avoid:** Synthesis already guards `topThreads.length>0` (Pitfall 2 of Phase 1). Paint must render the genesis core beautifully with zero shell elements; the HUD shows the "BIG BANG" badge + day-1 copy. Treat it as a designed state.
**Warning signs:** blank canvas on the innermost shell; `Math.max()` returning `-Infinity`.

### Pitfall 6: reduced-motion not fully honored on the canvas (PNT-04 hard rule)
**What goes wrong:** Chrome honors reduced-motion (UI-SPEC) but the Phaser frontier still pulses/twinkles → violates the hard rule that the WHOLE surface is a static, non-strobe frame.
**Why it happens:** The rAF loop animates the frontier ignite + star twinkle independent of CSS.
**How to avoid:** Read `prefers-reduced-motion` and drive `StyleTemplate.motion.frontierOnly/speed`; when reduced, render one static frame (mock's `reduce` branch: `zoom=target; intro=1; rot=0; ignite=1; tw=1`) and stop animating. Bake the frontier too in this mode.
**Warning signs:** any movement under the media query.

## Code Examples

### Additive glow via reused texture (the parity look + PNT-03 reuse)
```typescript
// Source: docs.phaser.io/.../constant/blendmodes (ADD) + .../class/textures-dynamictexture
// Generate ONE soft glow texture at boot, then reuse for every star/nebula/core.
const g = this.make.graphics({ x: 0, y: 0 });
g.fillStyle(0xffffff, 1).fillCircle(32, 32, 32);   // soft disc; or build a radial CanvasTexture for true falloff
g.generateTexture('glow', 64, 64);
g.destroy();
// per element:
const star = this.add.image(x, y, 'glow')
  .setBlendMode(Phaser.BlendModes.ADD)             // == canvas 'lighter'
  .setTint(hueToColor(element.hue, style.palette))  // hue 0..1 → palette color
  .setScale(element.size * szScale);
```

### Bake a frozen shell once, composite as one Image (PNT-03)
```typescript
// Source: docs.phaser.io/.../class/gameobjects-rendertexture (draw)
const dt = this.textures.addDynamicTexture(`shell-${shell.day}`, W, H)!;
dt.draw(shellContainer);            // shellContainer holds all that shell's additive Images
const baked = this.add.image(cx, cy, `shell-${shell.day}`);  // 1 draw call/frame thereafter
// frontier (shells[0]) is NOT baked — re-rendered each frame.
```

### Camera zoom from wheel + two-pointer pinch (CAM-01/02, D-01)
```typescript
// Source: docs.phaser.io/.../namespace/input-events (WHEEL) + .../cameras-scene2d-camera (zoom)
this.input.on('wheel', (_p, _o, _dx, dy) => {
  this.cameras.main.zoom = Phaser.Math.Clamp(this.cameras.main.zoom * (1 - dy * 0.001), 1, 7);
});
this.input.addPointer(1);  // enable a 2nd active pointer for pinch
this.input.on('pointermove', () => {
  const [p1, p2] = [this.input.pointer1, this.input.pointer2];
  if (p1.isDown && p2.isDown) {
    const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    // map d vs lastD → camera.zoom (hand-rolled; Phaser has no built-in pinch)
  }
});
```

## State of the Art

| Old Approach (Phase-1 ARCHITECTURE.md) | Current Approach (this phase) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canvas2D paint, `OffscreenCanvas` bake, `ctx.createRadialGradient`, `globalCompositeOperation='lighter'` | Phaser 4.2 WebGL paint, `DynamicTexture` bake, reused glow texture, `BlendModes.ADD` | Stack locked to Phaser (PNT-01) after Phase-1 research | Paint primitives all re-map (table above); intent (bake/animate-frontier-only/LOD) is unchanged |
| Phaser 3 `RenderTexture` as the bake primitive | Phaser 4 `DynamicTexture` (RenderTexture wraps it); new WebGL render-node/DrawingContext pipeline | Phaser 4.x | Use `addDynamicTexture()` / `RenderTexture`; APIs are 4.x-shaped |

**Deprecated/outdated:**
- Treating the Phase-1 `ARCHITECTURE.md` paint section as literal: its Canvas2D primitives are superseded by the Phaser mapping here. Its *patterns* (functional core/shell, parse-at-boundary, bake-on-freeze, LOD, camera-independent) all still hold.

## Runtime State Inventory

> Not a rename/refactor/migration phase. Greenfield additions to an existing codebase. Section included only to confirm no hidden state:
- **Stored data:** None — Phase 2 persists nothing (no Redis until Phase 3; "Regenerate persists nothing" per UI-SPEC).
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** New Vite entry (`cosmos-dev.html`) and new `tsconfig`/eslint globs are the only build-surface additions — verified additive, not migrations.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest way to add the standalone dev page is a **separate plain-`vite` run/entry** rather than a `devvit.json` entrypoint | Pitfall 1 | If Devvit's Vite plugin requires all client HTML to route through it, the dev-page wiring differs; verify against current `@devvit/start` docs at plan time. Low risk — does not affect engine/paint design. |
| A2 | Phaser **4.2.0** behaves per the **4.0.0-rc.6** API docs fetched (closest published API set on Context7) for `DynamicTexture`, `BlendModes.ADD`, Camera zoom, wheel input | Code Examples / mapping table | Minor API drift (method names/signatures) possible between rc.6 and 4.2.0; verify exact `addDynamicTexture`/`draw` signature against installed `node_modules/phaser` types when implementing. |
| A3 | A **pre-generated radial-glow texture** reproduces the mock's gradient glow acceptably for "mock-parity-elevated" (D-04) | Pattern 3 / Pitfall 4 | If a flat-disc glow reads as AI-slop, a true radial-falloff `CanvasTexture` (one-time) is the fallback — still one reused texture, no perf cost. |
| A4 | Injecting a `Painter` interface keeps `render.ts` Phaser-free while filling ENG-04 method bodies | Pattern 1 / Pitfall 2 | If the planner prefers the dev page to own orchestration entirely (engine `render()` stays a thin synth wrapper), the wiring differs but the no-Phaser-in-engine invariant is the same. |
| A5 | The crystalline **faceted/angular** look (D-05) is achievable by a `StyleTemplate`-driven primitive swap (star-polygon texture) without engine changes | Mapping table / styles dir | If "faceted" needs geometry synthesis doesn't provide, it must stay paint-only (rotate/shape the primitive) — synthesis must NOT change (Phase-1 locked). Confirm the faceted look is purely a paint primitive choice. |

## Open Questions

1. **Exact day count & beat positions for the scripted scenario (SIM-01/D-03).**
   - What we know: ~30 days; cold-start → growth → drama ~day 12 → AMA ~day 20 → quiet; seed dices within beats.
   - What's unclear: precise day count and beat day-indices (Claude's discretion per D-03).
   - Recommendation: planner picks (e.g. 30 days, drama=12, AMA=20); encode as a `beats.ts` table so it's tunable data, not code.

2. **Crystalline: separate StyleTemplate vs. techno variant (D-05).**
   - What we know: Crystalline must look ice-blue/faceted/high-symmetry, distinct at a glance; its genome already encodes high symmetry/low volatility.
   - What's unclear: whether "one style per community" (TPL-04) means Crystalline is a *distinct* `StyleId` or a techno palette/primitive variant. `StyleIdEnum` is `['techno','comic','pixel']` — Crystalline isn't an enum member, so it's most likely a **techno StyleTemplate with crystalline palette + faceted primitive**, selected by the genome's `palette`, not a new style id.
   - Recommendation: implement Crystalline as a techno-style instance with ice-blue palette + angular star primitive; do NOT add a `StyleId` (avoids a contract change). Confirm with the planner.

3. **LOD tiering depth for the demo (PNT-03).**
   - What we know: LOD-by-zoom is required; the demo has ≤30 shells.
   - What's unclear: how many LOD tiers are worth building for a 30-shell demo vs. just bake+frontier.
   - Recommendation: start with bake-all-frozen + live-frontier (Patterns 2/3); add coarse FAR/CLOSE LOD only if frame budget demands it. Don't over-engineer LOD for 30 shells.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | ≥22.2.0 (engines) | — |
| phaser | PNT-01 paint | ✓ | 4.2.0 (node_modules) | — |
| zod | SIM-02 parse | ✓ | 4.4.3 | — |
| vite | QA-01 dev page | ✓ | 8.x | — |
| vitest | QA-02 tests | ✓ | 4.1.9 | — |
| WebGL (browser) | PNT-01 WebGL render | ✓ (any modern browser / Reddit webview) | — | Phaser falls back to Canvas (`type: AUTO`); but PNT-01 targets WebGL — keep `AUTO`, expect WebGL |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all installed.

## Validation Architecture

> `workflow.nyquist_validation` not found in config sweep — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | none standalone — vitest invoked via `npm test` (`vitest run`); engine tests already pass |
| Quick run command | `npx vitest run src/sim` (sim tests only) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIM-02 | `generateDayVectors` output passes `DayVectorSchema.parse()` | unit | `npx vitest run src/sim/generator.test.ts` | ❌ Wave 0 |
| SIM-03 | Same seed → identical `DayVector[]` (byte/deep equal); different seed → different | unit | `npx vitest run src/sim/generator.test.ts` | ❌ Wave 0 |
| SIM-01 | Scenario has the required beats (1 drama-spike day, 1 AMA day, cold-start day-1) | unit | `npx vitest run src/sim/beats.test.ts` | ❌ Wave 0 |
| STR-02 | Nudge shifts the mean of `steering.*`; output still varies (not fixed) | unit | `npx vitest run src/sim/steering.test.ts` (pure-fn level) | ❌ Wave 0 |
| QA-02 | Build + type-check + lint + existing engine tests green | integration | `npm run type-check && npm run lint && npm test && npm run build` | ✅ (engine tests exist) |
| PNT-* / CAM-* | Visual parity, camera, paint | manual/UAT | dev page visual check vs `subcosm-universe-mock.html` | n/a — Phaser/WebGL rendering is manual-verify (no DOM-free render harness in scope) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/sim` + `npm run lint`
- **Per wave merge:** `npm test && npm run type-check`
- **Phase gate:** `npm run type-check && npm run lint && npm test && npm run build` all green before `/gsd-verify-work`; visual parity confirmed manually against the mock.

### Wave 0 Gaps
- [ ] `src/sim/generator.test.ts` — covers SIM-02 (parse passes) + SIM-03 (seed determinism)
- [ ] `src/sim/beats.test.ts` — covers SIM-01 (required beats present)
- [ ] `src/sim/steering.test.ts` (optional) — covers STR-02 mean-bias at the pure level (paint is manual)
- Framework: already installed; no new config needed.
- Note: Phaser/WebGL paint (PNT-*, CAM-*) is **manual/UAT-verified** — there is no headless WebGL render assertion in this phase's scope. Determinism is tested at the `Scene`/sim layer (already deterministic); paint correctness is visual.

## Security Domain

> `security_enforcement` not found in config sweep — treat as enabled. This phase has a minimal attack surface: a local dev page + simulator, no network, no persistence, no auth, no user-supplied data beyond a numeric seed field.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this phase (Devvit identity is Phase 3) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No protected resources |
| V5 Input Validation | yes | The seed field is the only external input → parse to a valid integer; on non-parseable input fall back to a random valid seed (UI-SPEC error copy). `DayVectorSchema.parse()` validates sim output. |
| V6 Cryptography | no | `mulberry32` is a non-crypto PRNG by design (determinism, not secrecy) — correct here; never use it for security |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bad seed input crashes/garbles the canvas | DoS (availability) | Validate/coerce the seed field; fall back to a random valid seed; never render a broken canvas (UI-SPEC) |
| Malformed sim output reaching the engine | Tampering | `DayVectorSchema.parse()` at the sim boundary (SIM-02) surfaces a structured error, not a silent NaN |
| XSS via theme/era strings rendered in the HUD | Tampering/Injection | HUD strings come from the in-repo simulator (not user input) in this phase; still set them via `textContent`, never `innerHTML`, to stay safe when Phase-3 real data arrives |

## Sources

### Primary (HIGH confidence)
- `docs/subcosm-universe-mock.html` (read in full) — the visual-parity ground truth; `frame()` l.184-272, `genShell()` l.140-162, reduced-motion branch
- `src/engine/` (read: `render.ts`, `synthesis.ts`, `contracts/{Scene,StyleTemplate,DayVector,Genome}.ts`, `genomes/{calm,chaotic,crystalline}.ts`, `rng` refs) — the finished Phase-1 seam
- `eslint.config.js` — the engine boundary rule (bans `phaser`/`@devvit/*`/`*/client/*`/`Math.random` in `src/engine/**`)
- `tools/tsconfig.*.json`, `tsconfig.json`, `vite.config.ts`, `devvit.json`, `package.json` — build/boundary topology
- `.planning/REQUIREMENTS.md`, `.planning/phases/02-*/02-CONTEXT.md`, `02-UI-SPEC.md`, `docs/context/subcosm-spec.md` (hard rules)

### Secondary (MEDIUM confidence)
- Phaser 4 API documentation via Context7 `/websites/phaser_io_api-documentation_4_0_0-rc_6` — BlendModes (ADD = Canvas+WebGL), DynamicTexture/RenderTexture `.draw`, Camera `zoom`/`zoomTo`, ScaleManager modes, WHEEL input event
- `.planning/research/ARCHITECTURE.md` — Phase-1 architecture (Canvas2D-flavored; patterns carry over, primitives re-mapped here)

### Tertiary (LOW confidence)
- Pinch-gesture approach (two active pointers, distance delta) — derived from Phaser input model; no built-in pinch exists. Verify exact pointer property names against installed Phaser types.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed + CI-green in Phase 1; nothing new
- Architecture / Phaser mapping: MEDIUM-HIGH — mock is ground truth; Phaser API verified via Context7 (rc.6 ≈ 4.2.0; verify signatures at implement time)
- Pitfalls: HIGH — derived directly from the repo's boundary config, tsconfig topology, and Devvit build setup
- Simulator: HIGH — schema + determinism patterns are fully specified by existing contracts

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable stack; Phaser 4.2 API the only fast-moving surface — re-verify method signatures if Phaser bumps)

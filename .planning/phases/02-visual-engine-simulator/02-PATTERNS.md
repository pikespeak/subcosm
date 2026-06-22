# Phase 2: Visual Engine + Simulator - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 17 new + 3 modified
**Analogs found:** 14 / 20 (6 have NO strong in-repo analog → mock + RESEARCH mapping table + Phase-1 contracts)

> Read first: this maps *what existing code each new file should copy patterns from*. The repo is a Devvit + Phaser counter template (`src/client/scenes/*.ts`, `src/client/game.ts`) sitting on top of a finished, pure Phase-1 engine (`src/engine/*`). The Phaser scenes are the strongest in-repo analog for the new cosmos paint layer; the engine genomes/contracts are the analog for `StyleTemplate` data + the simulator's Zod boundary. The canvas mock (`docs/subcosm-universe-mock.html`) is the *visual/behavioural* source but is Canvas-2D JS — every draw call must be translated to Phaser per the RESEARCH mapping table (02-RESEARCH.md lines 180-198). Never copy mock draw calls verbatim into Phaser.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/client/cosmos/CosmosScene.ts` | component (Phaser.Scene) | event-driven (rAF loop) | `src/client/scenes/Game.ts` | role-match (Phaser Scene; different content) |
| `src/client/cosmos/paint.ts` | component (render) | transform (Scene→pixels) | `src/client/scenes/Game.ts` + mock `frame()` l.184-272 | partial (Phaser API from Game.ts; logic from mock — translated) |
| `src/client/cosmos/primitives.ts` | utility (texture gen) | transform | mock glow gradients l.219/239/258 + RESEARCH Code Example l.346-358 | NO in-repo analog (Phaser texture-gen is new) |
| `src/client/cosmos/bake.ts` | utility (DynamicTexture) | transform | RESEARCH Pattern 2 l.253-264 + Code Example l.361-367 | NO in-repo analog (no bake exists) |
| `src/client/cosmos/camera.ts` | controller (view state) | event-driven | `Game.ts` camera/resize (l.21,112-115,120-156) + mock view l.163-189 | role-match (Phaser Camera usage) |
| `src/client/cosmos/input.ts` | controller (gestures) | event-driven | `Game.ts` `.on('pointerover'...)` l.71-73 + RESEARCH Code Example l.369-383 | partial (event-binding shape from Game.ts; pinch hand-rolled) |
| `src/client/cosmos/PhaserPainter.ts` | adapter (implements `Painter`) | request-response | RESEARCH Pattern 1 l.232-251 + `render.ts` `RenderHandle` | NO in-repo analog (the injection seam is new) |
| `src/client/cosmos/reduced-motion.ts` | utility | transform | mock `reduce` branch (l.163,186,250,257) | NO in-repo analog (port mock branch) |
| `src/styles/techno.ts` | model (data object) | CRUD (static data) | `src/engine/genomes/calm.ts` | exact (preset DATA object, schema-parsed on load) |
| `src/styles/crystalline.ts` | model (data object) | CRUD (static data) | `src/engine/genomes/crystalline.ts` + `src/styles/techno.ts` | exact (genome→style sibling) |
| `src/sim/generator.ts` | service (generator) | batch + Zod boundary | `src/engine/genomes/calm.ts` (`.parse()` boundary) + `src/engine/rng.ts` (seeding) | role-match (parse-at-boundary + mulberry32 reuse) |
| `src/sim/beats.ts` | model (data table) | CRUD (static data) | `src/engine/genomes/calm.ts` (data-as-module) | role-match (tunable data table) |
| `src/sim/index.ts` | barrel | — | `src/engine/genomes/index.ts`, `src/engine/contracts/index.ts` | exact |
| `src/sim/generator.test.ts` | test | — | `src/engine/synthesis.test.ts` | exact |
| `src/sim/beats.test.ts` | test | — | `src/engine/synthesis.test.ts` | exact |
| `src/client/cosmos-dev/cosmos-dev.html` | config (Vite entry) | — | `src/client/game.html` | exact |
| `src/client/cosmos-dev/main.ts` | config (bootstrap) | event-driven | `src/client/game.ts` | role-match (Phaser boot + DOMContentLoaded) |
| `src/client/cosmos-dev/hud.ts` | component (DOM readout) | request-response | mock `readout()` l.275-291 | partial (mock DOM logic; no in-repo DOM-render analog) |
| `src/client/cosmos-dev/cosmos-dev.css` | config (styling) | — | mock `<style>` block l.10-65 + `src/client/game.css` | partial (treatments from mock; file shape from game.css) |
| `src/engine/render.ts` (MODIFY) | controller (orchestration) | request-response | itself (fill the 4 stubs) + RESEARCH Pattern 1 | exact (declared stubs already present) |

**Config files to MODIFY (analog = how Phase-1 added them):**

| File | Change | Analog |
|------|--------|--------|
| `tools/tsconfig.*.json` (new `sim`/`styles` project) | add `include` for `src/sim`, `src/styles` (Phaser-banned, zod+contracts allowed) | `tools/tsconfig.engine.json` (rootDir + include + exclude tests) |
| `tsconfig.json` | add `references` entry for the new project | existing `references` array l.3-10 |
| `eslint.config.js` | add a `files: ['src/sim/**','src/styles/**']` block (ban `phaser`, allow zod) + cover `src/client/cosmos*` under existing client block | engine-boundary block l.68-113 (the `no-restricted-imports` pattern) |
| `vite.config.ts` / `package.json` | add `cosmos-dev.html` as a **separate plain-vite entry** (NOT a `devvit.json` entrypoint) | `vite.config.ts` (devvit plugin); Pitfall 1 (RESEARCH l.307-311) |

---

## Pattern Assignments

### `src/styles/techno.ts` + `src/styles/crystalline.ts` (model, static data) — STRONGEST ANALOG

**Analog:** `src/engine/genomes/calm.ts` / `crystalline.ts` — copy the structure verbatim, swap `GenomeSchema`→`StyleTemplateSchema`.

**Module-load `.parse()` boundary pattern** (`calm.ts` lines 16-18, 71):
```typescript
import { GenomeSchema, type Genome } from '../contracts';

export const calm: Genome = GenomeSchema.parse({
  version: 1,
  style: 'techno',
  // ... data ...
});
```
→ For styles: `import { StyleTemplateSchema, type StyleTemplate } from '../engine/contracts'` then `export const techno: StyleTemplate = StyleTemplateSchema.parse({ id: 'techno', substrate, palette, line, fill, texture, genes, postFX, motion, type })`. The exact field set is fixed by `StyleTemplateSchema` (StyleTemplate.ts lines 58-69) — `genes` is `Record<string,string>` (Gene→PrimitiveRef), `motion` is `{ frontierOnly, speed }` (drives PNT-04 reduced-motion).

**Header-comment convention** (every data module opens with a DATA-not-code rationale block — `calm.ts` l.1-15). Mirror it.

**Crystalline note (RESEARCH Open Q2, l.421-424):** `StyleIdEnum` is `['techno','comic','pixel']` — Crystalline is NOT a new style id. Implement `crystalline.ts` as a `techno`-id StyleTemplate with ice-blue palette + faceted primitive ref (`genes.facet → 'star-polygon'`). The genome already carries `palette.ramp: ['#04121a','#0e4d5e','#46e0d8','#e8fbff']` (crystalline.ts l.30-32) and `allowedGenes: ['facet','spike','aura']` (l.61) — the StyleTemplate maps those genes to angular primitives. **No contract change, no synthesis change.**

---

### `src/sim/generator.ts` (service, batch + the ONE Zod boundary)

**Analogs:** `src/engine/genomes/calm.ts` (the `.parse()` boundary discipline) + `src/engine/rng.ts` (the seeding primitive to REUSE, do not re-implement).

**Reuse mulberry32, do NOT write a new PRNG** (`rng.ts` lines 24-32) — RESEARCH "Don't Hand-Roll" l.297. The sim derives per-day seeds from a master seed via `mulberry32`:
```typescript
import { mulberry32 } from '../engine/rng';
// master seed → per-day seeds; same seed → identical DayVector[] (SIM-03)
```

**Parse at the OUTPUT boundary (SIM-02 / QA-03)** — the single `.parse()` in this phase. Mirror `calm.ts`'s module-load parse, but apply it to *generated* output:
```typescript
import { DayVectorSchema, type DayVector } from '../engine/contracts';
export function generateDayVectors(config): DayVector[] {
  const days = /* build from beats + per-day seeded dicing */;
  return days.map(d => DayVectorSchema.parse(d)); // boundary — NEVER inside synthesis/paint/frame loop
}
```
`DayVectorSchema` shape (DayVector.ts l.16-41): `day` (1=genesis), `date`, `posts/comments/contributors/scoreSum`, `topThreads: number[]`, derived `conflict/momentum/diversity/dominantTheme`, `steering: {branch,symmetry,hue}`, `seed: int`. **Pitfall 5 (RESEARCH l.331-335):** day-1 cold-start has `posts:1`, small `topThreads` — emit a valid near-empty DayVector, never an empty `topThreads` spread into `Math.max()`.

---

### `src/sim/beats.ts` (model, static data table)

**Analog:** `src/engine/genomes/calm.ts` (data-as-module). **No behavioural analog** — the 30-day beat table is new content. Encode beats as a tunable table (RESEARCH Open Q1 l.416-419): cold-start day-1 → growth → drama spike (~day 12, high conflict/red) → AMA day (~day 20, few huge `topThreads`) → quiet days. Seed dices WITHIN each beat (D-03). Day count/positions are Claude's discretion.

---

### `src/sim/generator.test.ts` + `beats.test.ts` (test)

**Analog:** `src/engine/synthesis.test.ts` (lines 1-50) — copy its determinism+sensitivity test shape exactly.

**Determinism assertion** (`synthesis.test.ts` l.35-40) — both structural AND byte-level:
```typescript
expect(a).toEqual(b);                              // structural deep-equal
expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // byte / key-order (SIM-03)
```
Add: a schema-validity test (generator output `DayVectorSchema.parse()` does not throw → SIM-02) and a beats test (the required beats are present → SIM-01). Fixtures live in `tests/fixtures.ts` (imported by `synthesis.test.ts` l.16).

---

### `src/client/cosmos/CosmosScene.ts` (component, Phaser.Scene)

**Analog:** `src/client/scenes/Game.ts` — the in-repo Phaser Scene pattern. Copy the class/lifecycle skeleton; replace the counter content with the cosmos.

**Scene class + camera + resize pattern** (`Game.ts` l.5-22, 112-156):
```typescript
import { Scene } from 'phaser';
import * as Phaser from 'phaser';
export class CosmosScene extends Scene {
  camera: Phaser.Cameras.Scene2D.Camera;
  constructor() { super('Cosmos'); }
  create() {
    this.camera = this.cameras.main;          // Game.ts l.21
    this.scale.on('resize', (size) => this.updateLayout(size.width, size.height)); // l.112
  }
}
```
**DPR cap / scale config** lives in the boot config, analog `src/client/game.ts` l.11-24 (`type: AUTO`, `Phaser.Scale.RESIZE`) — cap resolution at DPR 2 per PNT-03 (mock l.173).

**Frame loop:** there is no in-repo rAF analog. Port the mock's `frame()` (l.184-272) into the Scene `update()`, applying the RESEARCH mapping table (l.184-198) for every draw call. Only the frontier (`shells[0]`) re-renders per frame; everything else is baked.

---

### `src/client/cosmos/paint.ts` (component, Scene→pixels transform)

**Analogs:** `src/client/scenes/Game.ts` for *Phaser API idioms* (`this.add.image`, `setBlendMode`, `setTint`, `setScale`); `docs/subcosm-universe-mock.html` `frame()` (l.184-272) + `genShell()` (l.140-162) for *what to draw*.

**The translation is the core deliverable — use the mapping table (RESEARCH l.184-198), not the canvas calls.** Key swaps:
- `ctx.globalCompositeOperation='lighter'` (mock l.195) → `setBlendMode(Phaser.BlendModes.ADD)`
- `ctx.createRadialGradient` star/nebula/core (mock l.219/239/258) → ONE reused glow texture (from `primitives.ts`), `setTint(hue→palette)` + `setScale` (RESEARCH Code Example l.346-358)
- `radii=Rmax*Math.pow(0.85,i)` (mock l.179) → `Scene.shell.radius` already = `pow(0.85,idx)`; multiply by screen `Rmax`
- hue mapping: `Element.hue` is a 0..1 hint → resolve through `style.palette.ramp` (StyleTemplate). Synthesis stays geometry-only — **paint maps hue→color, never the reverse** (Anti-Pattern, RESEARCH l.284).

Paint reads `Scene` + `StyleTemplate` types ONLY — never `DayVector` (the ENG-02 seam, CONTEXT.md l.67).

---

### `src/client/cosmos/camera.ts` (controller, view state — CAM-01)

**Analog:** `Game.ts` camera + `updateLayout` (l.21, 120-156) for Phaser Camera usage; mock view-easing (l.163-189) for the scrub/zoom math.

**CameraController wraps `this.cameras.main`**; `scrub(day)` eases zoom toward `radii[day]`, `focusShell(day)` centers+zooms, `zoom(delta)` adjusts `camera.zoom`. **Reads `Scene.shell.radius`, NEVER writes `Scene`** (CAM-01 hard rule). Mock easing reference (l.186): `zoom+=(target-zoom)*0.09`. Use Phaser's `camera.zoom`/`zoomTo`/`centerOn` (RESEARCH "Don't Hand-Roll" l.296).

---

### `src/client/cosmos/input.ts` (controller, gestures)

**Analog:** `Game.ts` event-binding shape (`.on('pointerover'/'pointerdown', ...)` l.71-73). Wheel + click-focus follow this idiom. **Pinch must be hand-rolled** (~30 lines) — Phaser 4 has no built-in pinch gesture; use `this.input.addPointer(1)` + two-pointer distance delta (RESEARCH Code Example l.369-383, exception note l.290-301). Slider↔click-focus stay in sync (UI-SPEC l.159).

---

### `src/client/cosmos/PhaserPainter.ts` (adapter — the injection seam) — NO in-repo analog

**Analog:** RESEARCH Pattern 1 (l.232-251) + the existing `RenderHandle` interface in `render.ts` (l.19-33). This class implements a `Painter` interface (declared types-only in `src/engine/render.ts`) and is the ONLY Phaser holder reaching the engine call-site. **It must live under `src/client/cosmos/`** so `phaser` never imports into `src/engine/**` (eslint `no-restricted-imports`, eslint.config.js l.87-91; Pitfall 2 l.313-317).

---

### `src/client/cosmos/primitives.ts`, `bake.ts`, `reduced-motion.ts` — NO in-repo analog

Pattern sources: RESEARCH Code Examples (glow texture l.346-358; DynamicTexture bake l.361-367; Patterns 2/3 l.253-270) and the mock `reduce` branch (l.163,186,250,257 → `zoom=target;intro=1;rot=0;ignite=1;tw=1`). These are net-new Phaser-4 primitives; copy the Phaser API shape (`this.make.graphics`, `generateTexture`, `this.textures.addDynamicTexture`) from RESEARCH, verify signatures against installed `node_modules/phaser` types (Assumption A2).

---

### `src/client/cosmos-dev/cosmos-dev.html` + `main.ts` (Vite entry + bootstrap)

**Analog:** `src/client/game.html` (l.1-16) and `src/client/game.ts` (l.1-32).

**HTML entry** — copy `game.html` structure (`<div id="game-container">`, `<script type="module">`, CSS `<link>`). Add the chrome DOM (HUD readout + control panel) per UI-SPEC, lifted from mock markup (mock l.70-95+).

**Boot pattern** (`game.ts` l.11-32): `Phaser.Types.Core.GameConfig` with `type: AUTO`, `Phaser.Scale.RESIZE`, `scene: [CosmosScene]`, then `new Game({...config, parent})` inside `DOMContentLoaded`. `main.ts` additionally wires: `generateDayVectors(config)` → `DayVectorSchema.parse` (in sim) → `render(days, genome, style, painter)` → `CosmosScene` + HUD + controls (CONTEXT.md l.79).

**Pitfall 1 (RESEARCH l.307-311):** `cosmos-dev.html` is a **separate plain-vite entry**, NOT a `devvit.json` entrypoint — keep it out of the Devvit `dist/client` bundle. Verify `npm run build` (Devvit) stays green.

---

### `src/client/cosmos-dev/hud.ts` + `cosmos-dev.css` (DOM readout + chrome)

**Analog:** mock `readout()` (l.275-291) for the update logic; mock `<style>` block (l.10-65) for the treatments; `src/client/game.css` for the file shape.

**HUD update — XSS-safe** (RESEARCH Security l.497): set HUD strings via `textContent`, never `innerHTML` (mock uses both; prefer `textContent`). Reads `Scene.shells[focus].meta` (already carries date/era/theme/stars/comments/contributors/conflict — "Don't Hand-Roll" l.299). Frontier day additionally shows the goal line (D-02, gold accent).

**CSS** — copy the mock's exact authored treatments (translucent `.readout` w/ `backdrop-filter:blur(3px)`, faceted `.fbtn` gradient, gradient scrub track, `▮▯` conflict bar, Space Grotesk + Space Mono) per UI-SPEC. Normalize spacing onto the 4px grid (UI-SPEC Spacing), bump body text to 16px floor, 44px touch targets. Translate German copy → English (UI-SPEC Copywriting).

---

### `src/engine/render.ts` (MODIFY, controller) — exact self-analog

The 4 stubs are already declared with final signatures (l.58-69: `scrub`/`nudge`/`regenerate`/`destroy` all throw `error.engine.render.notImplemented`). Fill them by delegating to an **injected `Painter`** (RESEARCH Pattern 1 l.232-251) — declare the `Painter` interface here (types-only, no `phaser` import) and accept the implementation by injection. **ESLint will fail the build if any `phaser`/`*/client/*` import reaches this file** (eslint.config.js l.87-91).

---

## Shared Patterns

### Schema-parsed data module (module-load boundary)
**Source:** `src/engine/genomes/calm.ts` lines 16-18, 71 (`XSchema.parse({...})` at module load)
**Apply to:** `src/styles/techno.ts`, `src/styles/crystalline.ts`, `src/sim/beats.ts`
```typescript
import { XSchema, type X } from '<contracts>';
export const thing: X = XSchema.parse({ /* DATA */ });
```

### Seeded determinism (REUSE, never re-implement)
**Source:** `src/engine/rng.ts` `mulberry32` (l.24-32) — the engine's ONLY entropy source
**Apply to:** `src/sim/generator.ts` (per-day seeds), paint twinkle/jitter if any (must derive from `Scene`, not fresh randomness). `Math.random` is banned in `src/engine/**` (eslint l.94-100); the sim lives outside engine but should still seed from the master seed for SIM-03.

### Parse only at boundaries (QA-03 hard rule)
**Source:** `src/engine/genomes/calm.ts` (module-load parse) + DayVector.ts header (l.4-6)
**Apply to:** `src/sim/generator.ts` output ONLY — exactly one `DayVectorSchema.parse()` per generation, NEVER inside synthesis/paint/frame loop.

### Phaser Scene lifecycle + camera + responsive resize
**Source:** `src/client/scenes/Game.ts` (l.5-22, 112-156) + `src/client/game.ts` boot (l.11-32)
**Apply to:** `CosmosScene.ts`, `camera.ts`, `cosmos-dev/main.ts`

### Engine boundary (no phaser/client into src/engine)
**Source:** `eslint.config.js` engine block l.87-91 (`no-restricted-imports: ['@devvit/*','phaser','*/client/*','*/server/*']`)
**Apply to:** `src/engine/render.ts` (Painter interface = types only), and mirror a Phaser-ban block for `src/sim/**` + `src/styles/**`.

### New-dir build coverage (tsconfig + eslint + ref)
**Source:** `tools/tsconfig.engine.json` (rootDir+include+exclude-tests) + `tsconfig.json` references (l.3-10) + eslint engine block (l.70-113)
**Apply to:** registering `src/sim/`, `src/styles/` (Pitfall 3, RESEARCH l.319-323). `src/client/cosmos/` + `cosmos-dev/` fall under the existing `src/client/**` client project already.

---

## No Analog Found

Files with no close in-repo match — pattern source is the mock + RESEARCH mapping table + Phase-1 contracts:

| File | Role | Data Flow | Reason / Pattern Source |
|------|------|-----------|-------------------------|
| `src/client/cosmos/primitives.ts` | utility | transform | No Phaser texture-gen exists. Source: RESEARCH glow-texture Code Example (l.346-358), Pattern 3 (l.266-270). |
| `src/client/cosmos/bake.ts` | utility | transform | No bake/RenderTexture exists. Source: RESEARCH Pattern 2 + Code Example (l.253-264, 361-367). |
| `src/client/cosmos/PhaserPainter.ts` | adapter | request-response | The engine↔paint injection seam is new. Source: RESEARCH Pattern 1 (l.232-251) + `render.ts` `RenderHandle`. |
| `src/client/cosmos/reduced-motion.ts` | utility | transform | Source: mock `reduce` branch (l.163,186,250,257) + RESEARCH Pitfall 6 (l.337-341). |
| `src/sim/beats.ts` | model | static data | 30-day scripted scenario is new content. Source: CONTEXT D-03 + RESEARCH Open Q1 (l.416-419). Data-module shape from `calm.ts`. |
| `src/client/cosmos-dev/hud.ts` | component | request-response | No DOM-render module in repo (everything is Phaser-canvas). Source: mock `readout()` (l.275-291), reads `Scene.shells[i].meta`. |

---

## Metadata

**Analog search scope:** `src/engine/**` (contracts, genomes, render, rng, synthesis, tests), `src/client/**` (scenes/*.ts, game.ts/html/css), `tools/tsconfig.*.json`, `eslint.config.js`, `vite.config.ts`, `devvit.json`, `docs/subcosm-universe-mock.html`.
**Files scanned:** 22.
**Pattern extraction date:** 2026-06-19.

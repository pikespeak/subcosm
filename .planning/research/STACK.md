# Stack Research

**Domain:** Collaborative persistent browser game on Reddit (Devvit Web), procedural Canvas2D generation
**Researched:** 2026-06-19
**Confidence:** MEDIUM (Week-1 stack HIGH; Devvit platform stack LOW — official docs blocked, inferred from source + npm)

---

## Week-1 Stack: Pure Engine + Simulator (no Devvit)

This is the standalone Vite harness built in `src/engine/` and `src/sim/`. Zero Devvit imports. Unit-testable, runnable in any browser.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 8.x | Dev server + build | Fastest HMR for canvas iteration; vanilla-ts template ships a working tsconfig in one command; Rolldown bundler replaces Rollup in v7+; Oxc minifier default in v7+ (30–90x faster than Terser) |
| TypeScript | 5.x (strict) | Language | Strict mode is a hard project requirement; Vite transpiles .ts natively, no extra loader needed |
| Vitest | 4.x | Unit testing | Vite-native; reuses the same tsconfig/transform pipeline; near-zero config for a pure-function engine; jest-compatible assertions |
| Zod | 4.x | Schema + runtime validation | Single source of truth for DayVector, Scene, Genome, StyleTemplate; `z.infer` eliminates duplicate interfaces; parse at boundaries, safeParse in UI — v4 stable since mid-2025 |
| Canvas 2D API | browser native | Rendering (Week 1) | Sufficient for ~5,000 draw calls/frame with bake-on-freeze; works in all environments including sandboxed iframes; zero import weight; matches the mock exactly |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mulberry32 (inline ~5 lines) | n/a | Seeded PRNG | Per-ring determinism; already in the mock; passes gjrand; best 32-bit-state JS PRNG. Inline it — no npm package needed |
| sfc32 (inline ~5 lines) | n/a | 128-bit-state PRNG | If mulberry32 period (2^32) proves insufficient for any generator; also inline |
| @types/node | dev | Node types for Vitest | Only needed if test files use Node APIs |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm create vite@latest` with `vanilla-ts` template | Scaffold | Gets strict tsconfig, `vite/client` types, and a working `index.html` in one command |
| Vitest coverage via `@vitest/coverage-v8` | Coverage | `provider: 'v8'` — no extra install beyond the devDep |
| TypeScript `strict: true` | Type safety | Already required by project; add `noUncheckedIndexedAccess: true` for array safety |

### Installation

```bash
# Scaffold (one-time)
npm create vite@latest . -- --template vanilla-ts

# Core runtime deps
npm install zod

# Dev dependencies
npm install -D vitest @vitest/coverage-v8
```

The PRNG (mulberry32 / sfc32) is inlined — no npm dependency.

### tsconfig.json (recommended strict config)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: { provider: 'v8' }
  }
})
```

---

## Week-2+ Stack: Devvit Platform

**Confidence: LOW** — developers.reddit.com was blocked during research. The following is inferred from npm, GitHub source, and community examples. Verify every API name at first scaffold with `devvit new`.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@devvit/cli` | 0.13.x | CLI (install, init, playtest, upload) | Current version as of June 2026; init command: `devvit new` (not `devvit init`) |
| `@devvit/public-api` | 0.12.x | Core Devvit SDK | Exposes Devvit.configure(), addTrigger(), addSchedulerJob(), context.redis, context.realtime, context.settings |
| `@devvit/web` | latest | Devvit Web / web-view utilities | Client-side context, shared utilities, realtime channel client in web views |
| Redis (via context.redis) | managed | Persistent state, aggregation buckets | Context-scoped, no external credentials; use HASH for day aggregates, ZSET for thread rankings, SET for unique contributors |
| Scheduler (via context.scheduler) | managed | Daily tick + hourly sweeper | Cron-style jobs registered at install; timezone-aware cron expression needed for the 4am-jitter tick |

### Devvit Project Structure

```
devvit.yaml            # app config: name, version, permissions
package.json           # "devvit" workspace
src/
  main.ts              # Devvit.configure() + addTrigger() + addSchedulerJob() calls
  triggers/
    onPostCreate.ts    # aggregate post into redis bucket
    onCommentCreate.ts # aggregate comment, update thread ZSET
  scheduler/
    dailyTick.ts       # freeze front, write ring record, open next front
    hourlySweeperJob.ts# find communities past their tick time, invoke tick
  webroot.ts           # Devvit.addCustomPostType() — mounts the iframe
webroot/               # web view (served as iframe inside the post)
  index.html
  src/                 # <-- THIS is where src/engine/ and src/sim/ land
```

The engine (`src/engine/`) and simulator (`src/sim/`) are zero-Devvit-import modules. In Week 2 they are copied/symlinked into `webroot/src/` and bundled by the Devvit web build, or imported directly if the Devvit webroot uses Vite internally.

### Devvit Triggers (confirmed from source)

Available triggers (from `packages/public-api/src/types/triggers.ts`):

| Trigger | Fires When | Use |
|---------|-----------|-----|
| PostCreate | New post published | Count post, seed HASH bucket |
| PostSubmit | Post submitted (may precede create) | — |
| CommentCreate | New comment | Increment comment count, update thread ZSET |
| AppInstall | App installed on a subreddit | Initialize genome + redis schema |
| AppUpgrade | App version updated | Migrate redis schema if needed |
| ModAction, ModMail | Moderation events | Optional conflict signal |

**Vote events: NOT available as triggers.** There is no `OnVoteCreate`, `OnUpvote`, or score-delta trigger. Score is available on the Post object snapshot at trigger time, but vote deltas are not streamed. Conflict proxy must be derived from comment-to-post ratios, thread depth, and post score snapshots — not from real-time vote feeds.

### Realtime (Blocks API, for Week 3 live frontier)

```ts
// In Devvit Blocks component (not web view):
const channel = useChannel({ name: 'frontier', onMessage: (msg) => { ... } });
channel.send({ type: 'nudge', field: 'branch', delta: 0.16 });
```

For web-view posts (the architecture Subcosm uses), the pattern is `postMessage`-based messaging between the Devvit host frame and the webroot iframe, not `useChannel` directly. Verify the exact web-view messaging API at scaffold time.

### Settings Schema (Genome at install)

```ts
Devvit.addSettings([
  { name: 'style', type: SettingScope.App, defaultValue: 'techno' },
  { name: 'palette', type: SettingScope.App, defaultValue: 'default' },
  // ... other genome fields
])
```

Settings are read via `context.settings.get('style')` inside triggers and scheduler jobs.

---

## Week-3+ Stack: Phaser Prize Layer (optional)

**Confidence: MEDIUM** — Phaser 4.1.0 released April 2026, confirmed stable.

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Phaser | 4.1.x | WebGL renderer, shader pipeline | For `Best Use of Phaser` prize ($5k). Canvas renderer is DEPRECATED in Phaser 4 — WebGL only. Install: `npm install phaser` |

**Architecture:** Keep `src/engine/` pure (no Phaser imports). Add `src/paint/phaser/` as a second paint module that implements the same `Scene + StyleTemplate → pixels` contract but delegates to Phaser's WebGL pipeline. The synthesis layer is untouched.

**Risk:** Phaser 4 requires a WebGL context. Devvit webroot iframes may restrict WebGL access on some platforms/mobile browsers. Validate at first Devvit scaffold before investing in the Phaser paint layer. If WebGL is unavailable, `Phaser.AUTO` falls back — but Canvas is deprecated in Phaser 4, so the fallback may produce degraded output.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 8.x | esbuild direct, Parcel, Webpack | Vite is the de-facto standard; esbuild needs manual watch glue; Parcel/Webpack add config overhead |
| Test framework | Vitest 4.x | Jest | Jest requires Babel/ts-jest transform config; Vitest uses the same Vite pipeline — zero config for TS strict |
| Validation | Zod 4.x | io-ts, Yup, Valibot | Zod is the project mandate (CLAUDE.md); v4 is now stable and faster than v3; Valibot is viable alternative for bundle size but not required |
| PRNG | mulberry32 (inline) | chance.js, seedrandom, @stdlib/random | npm PRNG packages add weight and often wrap Math.random which is not re-seedable; mulberry32 is 5 lines and already in the mock |
| Rendering (Week 1) | Canvas 2D API | Phaser 3, PixiJS, Three.js | Overkill for concentric shells; Phaser 3 Canvas is legacy; PixiJS/Three are WebGL-first; raw Canvas2D has zero bundle overhead and ships in the mock already |
| Rendering (Week 3) | Phaser 4.x | PixiJS 8.x, Three.js | Phaser prize exists ($5k); Phaser 4 has unified filter system for glow/bloom/FX needed by Techno style; PixiJS lacks the prize incentive |
| Schema version | Zod v4 | Zod v3 | v4 stable since mid-2025; greenfield project — no migration cost; v4 is 100x fewer tsc instantiations, faster builds |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `Math.random()` anywhere in synthesis | Non-deterministic; breaks the core invariant (same seed → same render) | mulberry32 seeded from `hash(subId, day, genomeVersion)` |
| TypeScript interfaces for contract types | Drift from runtime schemas; no parse(); contracts become unverifiable | Zod schemas + `z.infer` |
| Phaser 3 (for Week-3 upgrade) | Canvas renderer is deprecated; WebGL pipeline is legacy; Phaser 4 is the current stable | Phaser 4.1.x (`npm install phaser`) |
| Phaser for Week-1 engine | Adds 1MB+ bundle; requires DOM/game loop; engine must be pure/unit-testable with no browser deps in Vitest | Raw Canvas 2D API |
| xoshiro128** / xoshiro128+ | Fails statistical tests for linearity and binary rank; lower bits are poor quality | mulberry32 (32-bit state) or sfc32 (128-bit state) |
| `rollupOptions` in vite.config.ts | Deprecated in Vite 7+; aliased to rolldownOptions but will be removed | `build.rolldownOptions` |
| Zod `.parse()` in hot render loops | Parse has overhead; synthesis runs on every frame for the live frontier | Parse once at the sim→engine boundary; cache parsed Scene objects |
| Global Redis keys (non-scoped) | Devvit Redis is shared; key collisions across subreddits corrupt data | Always scope keys: `agg:{subId}:{day}`, `ring:{subId}:{i}` |
| Vote-delta triggers for conflict score | No such trigger exists in Devvit | Derive conflict composite from comment/post ratios + thread depth at tick time |

---

## Stack Patterns by Variant

**If building the Week-1 standalone harness:**
- `npm create vite@latest . -- --template vanilla-ts`
- Add Zod, Vitest — that's the complete dep list
- Engine entry: `src/engine/index.ts` exports `synthesize(days, genome): Scene` and `paint(scene, style, ctx): void`
- No Phaser, no Devvit imports anywhere in `src/engine/` or `src/sim/`

**If scaffolding the Week-2 Devvit app:**
- `devvit new` — choose `experience-post-pro` or `web-view-post` template
- Verify the template still exists (web-view-post was archived Feb 2026; a successor likely exists)
- The engine code moves into `webroot/src/` (or is imported as a workspace package)
- Do NOT mix Devvit imports into engine modules — the pure boundary is the correctness guarantee for server-side preview render

**If pursuing the Week-3 Phaser prize:**
- `npm install phaser` in the webroot package (not the engine package)
- Add `src/paint/phaser/TechnoPainter.ts` implementing `paint(scene, style, gl): void` with Phaser's WebGL pipeline
- Validate WebGL availability in the Devvit iframe before the Phaser prize becomes a viable target
- Keep Canvas2D painter as the primary path; Phaser is an additive layer

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vite@8.x | typescript@5.x, vitest@4.x | Use `moduleResolution: "bundler"` in tsconfig for Vite 7+ |
| zod@4.x | typescript@5.x | Requires TS 4.9+ for `satisfies`; 5.x has no issues |
| vitest@4.x | vite@8.x | Same major era; Vitest follows Vite's release cadence |
| phaser@4.1.x | typescript@5.x | Types ship with the package; no `@types/phaser` needed |
| @devvit/public-api@0.12.x | typescript@5.x | Devvit uses its own bundler; verify TS version compat at scaffold |
| mulberry32 (inline) | any | No deps; pure arithmetic |

---

## Sources

- Context7 `/vitejs/vite` (v8.0.x docs) — Vite config, tsconfig, TypeScript setup. Confidence: MEDIUM
- Context7 `/vitest-dev/vitest` (v4.x docs) — Vitest version, globals config, coverage. Confidence: MEDIUM
- Context7 `/websites/zod_dev_v4` — Zod v4 stable, parse/safeParse, z.infer. Confidence: MEDIUM
- Context7 `/phaserjs/phaser` (v3_90_0 docs) — Render config, GameConfig. Confidence: MEDIUM
- WebSearch / phaser.io — Phaser 4.0.0 released April 2026, 4.1.0 April 30 2026; Canvas deprecated. Confidence: MEDIUM (cross-checked multiple sources)
- GitHub `reddit/devvit` source (`packages/public-api/src/types/triggers.ts`) — trigger names confirmed. Confidence: MEDIUM (direct source read)
- WebSearch / npm — @devvit/cli v0.13.0, @devvit/public-api v0.12.23. Confidence: LOW (npm search result, not official changelog)
- WebSearch / community examples — useChannel, context.redis, project structure inferred from devvit-corridor and Word Maestro. Confidence: LOW
- WebSearch / PRNG comparison — mulberry32 vs xoshiro128 quality. bryc/code PRNGs.md cited. Confidence: LOW (cross-checked against arxiv)
- WebSearch / Canvas2D vs WebGL performance — draw-call thresholds. Confidence: LOW (cross-checked multiple sources)

---

*Stack research for: Subcosm (Reddit Devvit procedural universe game)*
*Researched: 2026-06-19*

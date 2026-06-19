# Project Research Summary

**Project:** Mandelbrut — collaborative persistent Reddit game (Devvit Web)
**Domain:** Procedural generative-art community game on Reddit Interactive Posts
**Researched:** 2026-06-19
**Confidence:** MEDIUM overall (Week-1 stack HIGH; Devvit platform LOW — verify at scaffold)

---

## Executive Summary

Mandelbrut is a deterministic procedural-art game where a Reddit community's daily activity synthesizes into a concentric-shell "universe" accumulating one ring per day. The expert approach is a clean three-layer engine — Synthesis (DayVector + Genome → Scene), Paint (Scene + StyleTemplate → pixels), Camera (view state only) — decoupled by four Zod-schema contracts. The engine is pure and platform-agnostic; Devvit (triggers, scheduler, redis, realtime) only attaches at Week 2. Week 1 delivers the standalone Vite harness plus data simulator, proving any DayVector[] renders as a legible, visually compelling universe.

Build order is dependency-strict: Zod contracts first (root of all types), then seeded RNG + synthesis skeleton, then Techno style paint at visual parity with the mock, then camera + depth scrubber, then simulator with realistic variance. Every step is independently testable before the next begins. The simulator's output schema IS the DayVector contract the real Devvit collector will fill — no schema drift is possible.

The dominant risks are: (1) Math.random() leakage silently breaking determinism — ban with ESLint before porting any mock code; (2) mobile performance collapse from per-star gradient creation and uncapped devicePixelRatio — bake cache and gradient pre-cache are part of the initial implementation, not a retrofit; (3) Devvit platform constraints discovered at research time that must be designed-in at Week-2 scaffold — no vote trigger (use comment proxy), UTC-only scheduler (hourly sweeper pattern), no Redis key scan (explicit ringCount index), colon-prohibited realtime channel names.

---

## Key Findings

### Stack (settled)

Week-1 runtime dep: `zod` only. Dev deps: `vitest @vitest/coverage-v8`. Scaffold: `npm create vite@latest . -- --template vanilla-ts`. mulberry32 inlined (~5 lines), no npm package.

- **Vite 8.x** — dev server + build; fastest HMR for canvas iteration
- **TypeScript 5.x strict** + `noUncheckedIndexedAccess`, `moduleResolution: "bundler"`
- **Vitest 4.x** — zero-config for TS strict, reuses Vite pipeline
- **Zod 4.x** — single source of truth for all four contracts; `z.infer` everywhere; 6.5x faster than v3
- **Canvas 2D API** (native) — sufficient for ~5,000 draw calls/frame with bake-on-freeze; zero bundle weight
- **mulberry32** (inline) — seeded PRNG; closure-based; passes gjrand; already in the mock

**Hard bans:** `Math.random()` in `src/engine/` (ESLint); Zod `.parse()` in hot loops; TypeScript interfaces for contract types (use `z.infer` only); `rollupOptions` (use `build.rolldownOptions`); storing Scene or bitmaps in Redis.

Week-2 Devvit stack confidence is LOW — verify every API name at `devvit new`. Week-3 Phaser 4.1.x (WebGL-only) is contingent on WebGL availability in the Devvit webroot iframe.

### Features

**Table stakes (W1 scope):**
- Deterministic seeded synthesis (`hash(subId, day, genomeVersion)` seed)
- Activity→visuals mapping: posts → stars, conflict → red turbulence, legibly different per day type
- Legible time-axis readout: per-shell date/era/theme/stats/conflict — mandatory every style, never removed
- Depth scrubber + zoom; camera independent of Scene
- Genesis core (glowing center); cold-start legibility (day-1 with 1 post looks intentional)
- Data simulator: growth, AMA, drama spike, quiet, cold-start scenarios

**Differentiators (W2/W3):**
- Genome / style-as-data: different genomes → provably different worlds from same engine
- Overnight freeze + reveal: daily retention hook
- Live frontier animation (W3)
- Per-community style skin: Techno W1, Comic + Pixel W3 (adding a style = one file, zero engine changes)
- Rare overnight mutations from rareTable (W3)

**Anti-features (never build in hackathon):**
- Connected multiverse — forward constraint only; keep Scene/Camera contracts embeddable
- Mode B real-community theme extraction — NLP + moderation risk
- Post-level zoom (star → real post) — scope + privacy
- Per-user styling — violates invariant I-4
- Literal infinite-fractal deep-zoom — never; LOD shells only

### Architecture

Functional Core, Imperative Shell. Engine has zero Devvit imports. Four Zod contracts are the typed seams. Synthesis is style-agnostic; Paint never touches raw DayVector; Camera never mutates Scene. ESLint `no-restricted-imports` enforces the engine boundary at compile time.

**Component map:**
1. `src/engine/contracts/` — four Zod schemas; root of all types
2. `src/engine/synthesis.ts` — DayVector[] + Genome → Scene; mulberry32 per DayVector.seed
3. `src/engine/paint/techno.ts` — Scene + StyleTemplate + ctx → pixels; bakeCache; gradient pre-cache
4. `src/engine/camera.ts` — view state (zoom, focus, pan, LOD tier); never mutates Scene
5. `src/engine/render.ts` — orchestrates synthesis + paint + camera
6. `src/sim/` — generates DayVector[]; calls `.parse()` at its output boundary
7. `src/devvit/` (W2+) — all Devvit imports isolated here; attaches at `useEngine.ts` only

**Cannot be retrofitted (must be correct from day one):**
- Seeded RNG + Math.random ESLint ban
- Bake-on-freeze (OffscreenCanvas per frozen shell, drawImage on subsequent frames)
- Zod parse only at the two system boundaries (sim→engine, redis→engine)
- Gradient pre-cache outside the rAF loop
- `devicePixelRatio` capped at 2.0 at canvas init
- `genomeVersion` stored in every ring record (required before any real rings are written)
- Explicit `ringCount` in `organism:{sub}` (Redis has no key scan)

### Critical Pitfalls (top 5)

1. **Math.random() leakage** — one call anywhere in `src/engine/` silently breaks determinism across clients. ESLint rule + mulberry32 closure per synthesis call + snapshot test. Establish before porting any mock code.

2. **Canvas2D mobile perf cliff** — gradient objects created per-star per-frame + uncapped DPR (3x = 9x fill cost) → 15fps on mid-range Android. Pre-cache CanvasGradient objects outside rAF; cap DPR at 2.0; bake frozen shells; floor all x/y. These are initial implementation requirements, not optimizations.

3. **Zod parse in hot loop** — `.parse()` per shell per frame creates thousands of allocations/second. Parse exactly once at the two boundaries; trust TypeScript types inside the engine.

4. **No Devvit vote trigger** — `onVoteChange` does not exist. Conflict composite must use comment-creation rate + reply depth + tick-time score snapshot. Design the proxy around available signals before writing any collector code.

5. **Devvit scheduler is UTC-only** — no per-community timezone cron. Use hourly UTC sweeper; compute local day boundary crossing in handler via `Intl.DateTimeFormat`; apply `hash(subId) % 60` minute jitter.

Additional Devvit constraints: trigger delivery is not at-most-once (deduplicate via event-ID Redis sorted set); Redis key scan unavailable (maintain explicit `ringCount` index); realtime channel names cannot contain colons (use `-` separator: `frontier-{sub}-{day}`).

---

## Implications for Roadmap

**Suggested phase structure (9 phases):**

1. **Contracts + RNG Foundation** (W1 Day 1) — DayVector is the root dependency; mulberry32 + ESLint Math.random ban established before any synthesis code is written. Delivers four Zod schemas + RNG with sequence stability test.

2. **Synthesis Skeleton** (W1 Day 1-2) — Pure functional core; style-agnostic; determinism test (same inputs → identical Scene × 2 calls). Ports mock's `genShell()` logic replacing `eras[]` with DayVector fields.

3. **Techno Style Paint Layer** (W1 Day 2-4) — Visual parity with the mock; bakeCache + gradient pre-cache + DPR cap as initial implementation; visual grammar anchored to geological strata (not generic neon space); readout labels canvas-drawn within StyleTemplate.

4. **Camera + Depth Scrubber** (W1 Day 3-4) — Independent view state; scrubbing is free (re-composite from existing cache); per-shell readout drawn as canvas primitives; `prefers-reduced-motion` static branch.

5. **Data Simulator** (W1 Day 4-5) — Five day-type patterns; simulator calls `DayVectorSchema.parse()` at its output boundary; regenerate control; cold-start scenario.

6. **Verification + Polish** (W1 Day 5-7) — Nudge re-synthesis on frontier; all nine "Looks Done But Isn't" checklist items green; build + tests clean.

7. **Devvit Scaffold + Data Layer** (W2) — `devvit new` scaffold; Redis aggregation; hourly UTC sweeper with Intl.DateTimeFormat; trigger deduplication; `genomeVersion` in every ring record; explicit `ringCount` index. **Verify at scaffold:** template name, web-view postMessage API, WebGL availability in webroot iframe.

8. **Live Frontier + Multi-Style** (W3) — Devvit realtime with `-` channel names; nudges to Redis steer hash; overnight reveal post; Comic + Pixel styles; rare mutations.

9. **Polish + Submit** (W4) — Mobile perf audit, onboarding, submission package, demo video, live subreddit with real arc visible.

**Research flags:**

Needs deeper research at Week-2 scaffold (before implementing):
- `devvit new` current template name (web-view-post archived Feb 2026)
- Web-view postMessage API for realtime bridging
- WebGL availability in Devvit webroot iframe on mobile

Standard patterns (research already sufficient):
- Phases 1-6 (all W1 work): well-documented technologies, no platform unknowns

**Post-MVP forward constraint:** Connected multiverse (subreddits as galaxies) is out of scope but the Scene/Camera contracts must remain embeddable in a future outer zoom tier. This is a design review item at Phase 4 (Camera) — no implementation, just verify the coordinate model does not preclude an additional outer tier.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (W1) | HIGH | Vite 8, Vitest 4, Zod 4, Canvas2D confirmed via Context7 + npm |
| Stack (W2 Devvit) | LOW | developers.reddit.com blocked during research; derived from GitHub source |
| Stack (W3 Phaser) | MEDIUM | Phaser 4.1.x confirmed; WebGL-in-Devvit-iframe unverified |
| Features | HIGH | Primary spec + PROJECT.md; high fidelity |
| Architecture | HIGH | Derived from spec §6/§7 + mock source; established patterns |
| Pitfalls (engine) | MEDIUM | Canvas2D/Zod patterns from community; consistent across sources |
| Pitfalls (Devvit) | MEDIUM | Direct from `github.com/reddit/devvit-docs` source files |

**Overall: MEDIUM.** W1 engine work is HIGH confidence. W2+ Devvit integration is LOW until scaffold verification.

**Gaps to address:**
- Devvit template name — run `devvit new` at W2 scaffold start
- Web-view realtime bridge postMessage API — verify before W3 live frontier
- WebGL in Devvit iframe — validate early in W2 before committing to Phaser prize layer
- Conflict composite tuning — calibrate formula against real subreddit data in W2
- Multiverse forward constraint — design review at Phase 4 (Camera) to ensure coordinate model is embeddable

---

## Sources

- `.planning/research/STACK.md` — stack dimension (Vite/Vitest/Zod/Canvas2D, Phaser 4, Devvit CLI)
- `.planning/research/FEATURES.md` — feature landscape (table stakes / differentiators / anti-features)
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flow, build order, cache/LOD patterns
- `.planning/research/PITFALLS.md` — 12 phase-mapped pitfalls (determinism, Canvas2D perf, Zod, Devvit)
- `docs/mandelbrut-requirements.md` + `docs/mandelbrut-universe-mock.html` — primary spec + renderer to port

*Research completed: 2026-06-19 | Ready for roadmap: yes*

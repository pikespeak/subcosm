# Subcosm — Requirements

**Scope:** Full hackathon submission — engine → simulator → Devvit integration → **published playable post** → polish, by **2026-07-15, 18:00 PDT (deadline)**. Built in phases; **Phase group A (engine + simulator) is built first, with no Devvit wiring**, then B (Devvit + live game), then C (submission + polish).
**Source:** `docs/subcosm-requirements.md` (§4–§7) + `.planning/research/SUMMARY.md` + Devpost rules (`docs/devpost-submission.md`).
**Core value:** The community's real activity becomes a beautiful, legible, deterministic universe — one engine, provably different worlds from different data + config.

---

## v1 Requirements — the submittable product

### A. Engine + Simulator (no Devvit) — built first

#### Contracts & Engine Seam (ENG)

- [x] **ENG-01**: All four contracts (DayVector, Scene, Genome, StyleTemplate) are **Zod schemas**; every TS type is `z.infer` of its schema (no hand-written interfaces for contract shapes).
- [x] **ENG-02**: Synthesis is fully decoupled from paint — synthesis imports no style code, paint reads no raw DayVector. `Scene` is the only seam.
- [x] **ENG-03**: `src/engine/` has zero Devvit imports and is pure + unit-testable; an ESLint rule bans `Math.random()` and Devvit imports inside `src/engine/`.
- [x] **ENG-04**: A single `render(dayVectors, genome, style)` entry orchestrates synthesis → paint → camera and exposes scrub / nudge / regenerate / destroy.

#### Config-Driven Template Engine (TPL)

- [x] **TPL-01**: A new or altered `Genome` (behaviour/params) or `StyleTemplate` (design/skin) is **pure data** — zero engine-code changes. Both are injected into `render(...)`.
- [x] **TPL-02**: `Genome` carries per-community knobs as data (Signal→Param weight matrix, ranges, volatility, inheritance, `steerGain`, rare-event table, allowed genes, day-boundary, chosen style); `StyleTemplate` carries design as data (substrate, palette, line, fill, texture, gene→primitive, postFX, motion, type).
- [x] **TPL-03**: The harness ships **≥2 selectable Genome presets** (e.g. "Calm" vs "Chaotic", same Techno style, different params); switching presets visibly changes the universe from the **same** `DayVector[]`.
- [x] **TPL-04**: One style per community is genome-driven; the engine never assumes a single hard-coded look.

#### Deterministic Synthesis (SYN)

- [x] **SYN-01**: Given `DayVector + seed + genomeVersion`, synthesis is deterministic via seeded mulberry32 (one closure per DayVector, fixed consumption order).
- [x] **SYN-02**: Two synthesis calls with identical inputs produce a byte-identical Scene (determinism test).
- [x] **SYN-03**: Synthesis ports the mock's `genShell()` logic, mapping DayVector fields to shell elements at visual parity with the mock.
- [x] **SYN-04**: Changing the data visibly changes the universe (sparse vs dense shells, red conflict turbulence, bright AMA clusters).

#### Techno Paint (PNT)

- [x] **PNT-01**: A Techno **Phaser** (WebGL) paint module renders a Scene at visual parity with `docs/subcosm-universe-mock.html` (genesis core, concentric shells, nebula, frontier ignite, vignette); visual reference `docs/subcosm.png`. Phaser is the paint layer behind the `Scene` seam — `src/engine/synthesis` stays Phaser-free.
- [x] **PNT-02**: All Techno look constants come from a `StyleTemplate` data object, not hard-coded in paint.
- [x] **PNT-03**: Mobile-perf foundations from day one (Phaser/WebGL): frozen shells baked to `RenderTexture` (only the live frontier re-renders per frame), reused textures/geometry instead of per-star reallocation, capped resolution/DPR — hold ~60fps in the post viewport.
- [x] **PNT-04**: Paint honors `prefers-reduced-motion` — static render, no strobe/ignite.

#### Camera & Navigation (CAM)

- [x] **CAM-01**: Camera holds independent view state (zoom / focus / scrub / intro) and never mutates the Scene.
- [x] **CAM-02**: A depth scrubber flies through time; focusing a shell zooms it; depth maps to date.
- [x] **CAM-03**: A per-shell readout shows date / era / theme / stars / comments / contributors / conflict (legibility — mandatory, never removed).
- [x] **CAM-04**: The camera/coordinate model is kept embeddable so a future outer zoom tier (multiverse → galaxy) is not designed out (design-review item, no implementation).

#### Steering / Front Nudges (STR)

- [x] **STR-01**: Nudge controls (branch / symmetry / hue) re-synthesize the live frontier visibly.
- [x] **STR-02**: Nudges bias the **mean** of the affected parameter only; the result is still diced around it.

#### Data Simulator (SIM)

- [x] **SIM-01**: `generateDayVectors(config)` produces realistic `DayVector[]` — growth, busy/quiet, one drama spike, one AMA day, plus cold-start day-1.
- [x] **SIM-02**: The simulator calls `DayVectorSchema.parse()` at its output boundary (only validation point before the engine).
- [x] **SIM-03**: A **regenerate** control produces a new universe from a new seed; the same seed reproduces an identical universe.

#### Quality & Verification (QA)

- [x] **QA-01**: A dev page (Vite) renders the simulated universe with scrubber, nudge buttons, regenerate, seed field, and a **genome-preset selector**.
- [x] **QA-02**: `npm test` (Vitest) passes — determinism + schema-validity tests; `npm run build` + `tsc --noEmit` green.
- [x] **QA-03**: Zod `.parse()` only at boundaries, never inside synthesis/paint/the frame loop.

#### Visual Depth & Animation (VIS) — Phase 2.1 (INSERTED)

- [x] **VIS-DEPTH**: Rework shell radius/spacing geometry so earlier/frozen days read distinctly all the way toward the core — the current `radius = Math.pow(0.85, idx)` (`src/engine/synthesis.ts`) crushes deep shells into a faint central blob. Per-shell brightness/size tuning allowed. Touches the engine contract `radius` → golden snapshots re-baselined and determinism tests updated; same `seed + genomeVersion` still reproduces identical output. Re-judged side-by-side vs `docs/subcosm-universe-mock.html`.
- [x] **VIS-ANIM**: The frontier ignite animation is data-driven from the day's metrics (conflict / energy / momentum), not a uniform `StyleTemplate`-constant sine (`pulse = 0.55 + 0.45*sin(time*0.0022*speed)`). Different days and communities animate differently. Preserves the 60fps rule (only the frontier re-renders per frame) and `prefers-reduced-motion` (static frame).
- [x] **VIS-DENSITY**: Every day-shell reads as visibly populated — even quiet days show a clear cluster of stars, not a near-empty faint ring. Raise the per-day star floor / density mapping in synthesis (`starCount`) so no ring looks empty, while preserving the busy/drama/AMA-vs-quiet contrast (busy days still markedly denser). Determinism re-baselined (element counts legitimately change); geometry (`radius`/`weight`) and the genome/style contracts are untouched. Re-judged vs `docs/subcosm-universe-mock.html`.

### B. Devvit Integration & Live Game (Reddit wiring)

#### Devvit Data Layer (DEV)

- [ ] **DEV-01**: A Devvit Web app scaffolds and hosts the engine as the post webroot (interactive post). Verify current template + CLI at scaffold (`devvit new`).
- [ ] **DEV-02**: Event triggers (post/comment create, etc.) increment Redis daily counters; unique contributors via SET, top threads via ZSET. (No vote trigger exists — see DEV-03.)
- [ ] **DEV-03**: A **conflict composite** is derived at tick time from comment-rate / reply-depth proxies + a score snapshot (no streaming vote deltas).
- [ ] **DEV-04**: A scheduler **tick** freezes the frontier, runs the genome transform → writes a Ring record (DayVector + seed, including `genomeVersion`), resets counters, opens the next frontier. An **hourly UTC sweeper** finds due communities via IANA timezone with `hash(subId)%60` jitter (DST-safe).
- [ ] **DEV-05**: Ring records are indexed by an explicit `ringCount` in `organism:{sub}` (Redis has no key scan); no images stored — only ~25 scalars + seed per ring.
- [ ] **DEV-06**: A mod configures the **Genome** at install via Devvit settings (preset + style); the chosen style/genome drives that community's universe end-to-end.

#### Live Front & Reveal (LIVE)

- [ ] **LIVE-01**: The live frontier fills during the day and renders nudges in near-real-time (realtime channel names use `-`, no colons); nudges aggregate into a Redis steer hash.
- [ ] **LIVE-02**: At the tick the frontier **freezes irreversibly** and a pinned **reveal/update post** is created ("what your universe became overnight").
- [ ] **LIVE-03**: Client and server render identically from the same Ring record (determinism holds across the seam).

### B2. Game / Daily Loop (GAME) — MVP core (staged)

> The daily loop is what makes Subcosm a *game*: goal + steering + overnight reveal. Built staged — stage 1 here; guess/streaks and collection are Stretch. **The goal + outcome fields must exist in the contracts from Phase 1** (build-for-flexibility), even though scoring logic lands in Phase 4.

- [x] **GAME-01**: Each day carries a **goal** ("genome quest") as data on the Genome/day (e.g. high symmetry, low conflict, ignite a specific rare gene). It is legible to players at dawn (shown in the readout).
- [ ] **GAME-02**: At the tick the day's shell is **scored against its goal deterministically** (from the DayVector/outcome); achieved ✓/✗ (+ degree) is recorded on the Ring and surfaced in the reveal.
- [ ] **GAME-03**: Steering nudges measurably move the day toward/away from the goal — the contribution → outcome link is legible (steering still biases the mean only, never dictates; invariant I-5).
- [ ] **GAME-04**: An achieved goal leaves a **persistent reward** on the ring (special star / era badge), visible permanently in the universe.
- [x] **GAME-05**: Daily player actions (nudges, and later guesses) are a **budgeted, countable per-user resource** (cap/day) on a **personal layer** kept separate from the shared community universe — so fair/cosmetic monetization and ethical retention can bolt on later without reworking synthesis.

### C. Submission & Polish (required to enter)

- [ ] **SUB-01**: App is **published** with an app listing on developer.reddit.com.
- [ ] **SUB-02**: A **public demo post** on a subreddit runs the game, self-explanatory and playable (judging is primarily based on this).
- [ ] **SUB-03**: Mobile experience is polished (target ~60fps in the post viewport; bonus points).
- [ ] **SUB-04**: Onboarding makes the loop legible at a glance — both the cosmos loop and the goal→steer→reveal game loop; cold-start day looks intentional, not broken-empty.
- [ ] **SUB-05**: Compliant with Devvit Rules; aesthetics read self-authored (not AI-slop / generic neon fractal).
- [ ] **SUB-06**: Devpost write-up complete (`docs/devpost-submission.md`), media gallery + links filled.

### Definition of Done (submittable)

- A community (or the simulator) produces a universe that accumulates daily, reveals overnight, and reads legibly on mobile.
- Published app listing + public playable demo post exist; same Ring data → identical render client/server.
- Engine pure (no Devvit, no `Math.random`); build + tests green; no temporary broken states.

---

## Stretch (only if time allows; clearly separated)

- **STRETCH-Styles**: Comic + Pixel StyleTemplates (each = one data file, zero engine changes).
- **STRETCH-Genome**: full Signal→Param weight matrix exercised, rare-event mutation table, presets UI.
- **STRETCH-Shader**: an advanced fbm/WebGL **shader pass** on top of the Phaser renderer for extra visual depth. Optional polish — the **Phaser base renderer is now core** (PNT-01), targeting the "Best Use of Phaser" prize; the official Phaser template already confirms WebGL runs in the webroot.
- **STRETCH-ModeB**: read a host community's real top-post/comments as the theme source (NLP + moderation).
- **STRETCH-Guess** (game stage 2): players submit a daily prediction at dawn; scored at the reveal → personal points + streaks + a community scoreboard.
- **STRETCH-Collect** (game stage 3): rare overnight mutations / star-types recorded in a per-community and/or personal collection album.
- **STRETCH-Monetize** (post-MVP, needs Reddit approval): Devvit Payments (Reddit Gold) — **fair/cosmetic only** (cosmetics, collection/history, supporter badge, extra guesses/tips). NEVER buy the shared outcome, no gambling/gacha, no paywalling core functionality (Devvit-prohibited). `products.json` + `purchase(sku)` + fulfill/refund endpoints; gold prices from the fixed tiers (5/25/50/100/150/250/500/1000/2500). The personal-layer separation introduced in GAME-05 (Phase 1 contracts) is the prerequisite; no synthesis rework required.
- **STRETCH-Retention** (ethical only): variable-reward reveal, streaks + gentle loss-aversion, social identity, progress/collection, natural FOMO from the permanent freeze. No dark patterns / deceptive scarcity.

## Out of Scope (with reasoning)

- **Connected multiverse** (subreddits as galaxies, opt-in links, ST quadrants) — separate post-MVP milestone; forward constraint only (keep Scene/Camera embeddable). Open questions deferred.
- **Post-level zoom** (star → real post) — scope + privacy.
- **Per-user styling** — violates invariant I-4 (one shared organism per community).
- **Literal infinite-fractal / Mandelbrot deep-zoom** — never; LOD shells, not unbounded math.

---

## Constraints

- **Deadline:** 2026-07-15, 18:00 PDT — hard. ~26 days from kickoff, solo, ~10–15 h/week.
- **Submission requires** a published app listing **and** a public playable demo post; judged primarily on community play via the demo link. No repo/video required (video optional, not provided).
- **Platform:** Devvit Web, mobile-first, runs in the Reddit post viewport; Reddit hosts everything (no own server/DB) — Redis, scheduler, realtime, triggers, settings are Devvit primitives.
- All hard rules from `docs/subcosm-requirements.md` (determinism, no stored images, legibility, reduced-motion, steering biases mean) and the Zod single-source-of-truth standard hold throughout.
- **Layer separation (build-for-flexibility):** keep a per-user *personal layer* (action budget, guesses, collection, cosmetics, streak) cleanly separate from the shared deterministic *community layer* (the universe); model daily actions as a **budgeted, countable resource** (cap/day) so "extra actions" can become a product without touching synthesis; reserve per-contribution cosmetic fields. Payments/cosmetics live in an isolated Devvit layer; the engine stays pure + deterministic. Monetization is **fair/cosmetic-only and post-MVP** (Devvit-approved); retention mechanics are **ethical-only** (no dark patterns, gambling, or paywalling core functionality).

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1: Engine Foundation | Complete |
| ENG-02 | Phase 1: Engine Foundation | Complete |
| ENG-03 | Phase 1: Engine Foundation | Complete |
| ENG-04 | Phase 1: Engine Foundation | Complete |
| TPL-01 | Phase 1: Engine Foundation | Complete |
| TPL-02 | Phase 1: Engine Foundation | Complete |
| TPL-03 | Phase 1: Engine Foundation | Complete |
| TPL-04 | Phase 1: Engine Foundation | Complete |
| SYN-01 | Phase 1: Engine Foundation | Complete |
| SYN-02 | Phase 1: Engine Foundation | Complete |
| SYN-03 | Phase 1: Engine Foundation | Complete |
| SYN-04 | Phase 1: Engine Foundation | Complete |
| GAME-01 | Phase 1: Engine Foundation | Complete |
| GAME-05 | Phase 1: Engine Foundation | Complete |
| PNT-01 | Phase 2: Visual Engine + Simulator | Complete |
| PNT-02 | Phase 2: Visual Engine + Simulator | Complete |
| PNT-03 | Phase 2: Visual Engine + Simulator | Complete |
| PNT-04 | Phase 2: Visual Engine + Simulator | Complete |
| CAM-01 | Phase 2: Visual Engine + Simulator | Complete |
| CAM-02 | Phase 2: Visual Engine + Simulator | Complete |
| CAM-03 | Phase 2: Visual Engine + Simulator | Complete |
| CAM-04 | Phase 2: Visual Engine + Simulator | Complete |
| STR-01 | Phase 2: Visual Engine + Simulator | Complete |
| STR-02 | Phase 2: Visual Engine + Simulator | Complete |
| SIM-01 | Phase 2: Visual Engine + Simulator | Complete |
| SIM-02 | Phase 2: Visual Engine + Simulator | Complete |
| SIM-03 | Phase 2: Visual Engine + Simulator | Complete |
| QA-01 | Phase 2: Visual Engine + Simulator | Complete |
| QA-02 | Phase 2: Visual Engine + Simulator | Complete |
| QA-03 | Phase 2: Visual Engine + Simulator | Complete |
| DEV-01 | Phase 3: Devvit Scaffold + Data Layer | Pending |
| DEV-02 | Phase 3: Devvit Scaffold + Data Layer | Pending |
| DEV-03 | Phase 3: Devvit Scaffold + Data Layer | Pending |
| DEV-04 | Phase 3: Devvit Scaffold + Data Layer | Pending |
| DEV-05 | Phase 3: Devvit Scaffold + Data Layer | Pending |
| DEV-06 | Phase 3: Devvit Scaffold + Data Layer | Pending |
| LIVE-01 | Phase 4: Live Game | Pending |
| LIVE-02 | Phase 4: Live Game | Pending |
| LIVE-03 | Phase 4: Live Game | Pending |
| GAME-02 | Phase 4: Live Game | Pending |
| GAME-03 | Phase 4: Live Game | Pending |
| GAME-04 | Phase 4: Live Game | Pending |
| SUB-01 | Phase 5: Submit | Pending |
| SUB-02 | Phase 5: Submit | Pending |
| SUB-03 | Phase 5: Submit | Pending |
| SUB-04 | Phase 5: Submit | Pending |
| SUB-05 | Phase 5: Submit | Pending |
| SUB-06 | Phase 5: Submit | Pending |

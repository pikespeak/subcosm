# Feature Research

**Domain:** Collaborative persistent generative-art community game (Devvit/Reddit)
**Researched:** 2026-06-19
**Confidence:** HIGH (based on primary spec + requirements doc + comparable game analysis)

---

## Phase Tags

Throughout this document, features are tagged by when they belong in the build sequence:

- **[W1]** — Week 1: pure engine + data simulator (current milestone)
- **[W2]** — Week 2: Devvit scaffold, Redis, scheduler tick
- **[W3]** — Week 3: live frontier, nudges, freeze, multi-style
- **[W4]** — Week 4: polish, mobile, submission
- **[Stretch]** — post-MVP or competition stretch

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the hackathon judges and Reddit community will assume exist. Missing any of these makes the product feel broken or incomplete.

| Feature | Why Expected | Complexity | Phase | Notes |
|---------|--------------|------------|-------|-------|
| **Legible time-axis readout** | Every temporal visualization must let users understand what they are looking at. The spec makes this an invariant (I-2, NFR-4). Judges will dismiss any generative art that looks cool but can't be read. | MEDIUM | [W1] | Per-shell readout: date, era, theme, posts, comments, contributors, conflict-bar. Must survive every style skin — styled differently but never removed. |
| **Depth scrubber / zoom navigation** | r/place trained Reddit users to expect interactive navigation. A static view of concentric rings is a screenshot, not a game. | MEDIUM | [W1] | Scrub maps depth → date. Focus a shell → zoom in. Independent camera state; zoom + scrub are orthogonal. |
| **Deterministic seeded regeneration** | Procedural-gen games (No Man's Sky, Minecraft seeds) have established the expectation: same seed = same world, always. Without this, trust breaks and debugging is impossible. | MEDIUM | [W1] | `hash(subId, day, genomeVersion)` as seed. Vitest fixed-seed tests confirm identity. Identical client + server render (NFR-2). |
| **Visible daily accumulation** | The core hook ("what did our universe become overnight?") only lands if shells visibly differ by day — quiet days look sparse, active days look dense (FR-V2). | MEDIUM | [W1 sim] | Simulator must produce realistic variance: AMA days, quiet weekends, drama spikes. Cold-start (NFR-8): even day-1 with 1 post looks intentional, not broken. |
| **Overnight reveal / freeze mechanic** | Invariant I-1. The r/place "end of event" moment compressed into a daily ritual. This is the retention loop: users return the next morning to see what froze. Without it, there's no hook. | HIGH | [W2] | Requires scheduler tick (FR-D1). The frontier becomes a baked shell. A reveal post is created (FR-D4). Out of scope W1 — but the engine must support the state distinction (frontier vs frozen). |
| **Genesis / Urknall core** | Every origin story needs a beginning. Without a visible genesis, depth has no anchor and the "growing organism" metaphor collapses. | LOW | [W1] | A distinct glowing core (day 1). In the mock this is the brightest element. |
| **Activity → visuals mapping** | The fundamental contract: posts → stars, big threads → bright clusters, contributors → density, conflict → red turbulence (FR-V1, FR-V2). If this mapping isn't visible and legible, the game's core claim ("your activity shaped this") falls apart. | HIGH | [W1] | The DayVector→Scene synthesis layer. Must be perceptibly different across quiet/active/dramatic days. |
| **Live frontier (fills during the day)** | Users expect to see their current-day activity influence the universe in real time, not just after the daily freeze (FR-A4). | HIGH | [W3] | Requires Devvit realtime + Redis live counters. The engine supports this in W1 (frontier render path); wiring is W3. |
| **Contributor agency / nudges** | r/place established: if you have no individual effect, engagement collapses. Nudges (branch/symmetry/hue) give personal stakes without breaking community ownership (FR-A1–A5, I-5). | MEDIUM | [W3] | Per-day action cap. Aggregate nudges bias mean, never dictate. Must re-synthesize the frontier visibly on nudge (FR-A4). |
| **Mobile-first rendering** | This runs in the Reddit app on phones. If it's not smooth on mobile, it will not ship (NFR-1, NFR-3). | HIGH | [W1+] | 60fps target. Only frontier animates. Frozen shells bake-on-freeze (FR-V6). LOD by zoom. No unbounded math. |
| **Cold-start legibility** | A newly installed subreddit has 0 days of history. Day 1 with a single post must look intentional, not broken-empty (NFR-8). | LOW | [W1 sim] | Genome base values + variance ensure even sparse days render as "intentionally minimal." Simulator's day-1 case tests this. |

---

### Differentiators (Competitive Advantage)

Features that set Subcosm apart from every other Devvit game in the hackathon. These are where the product wins prizes.

| Feature | Value Proposition | Complexity | Phase | Notes |
|---------|-------------------|------------|-------|-------|
| **Genome / style-as-data framework** | The same engine produces visibly different worlds from different communities. Two communities with the same data but different genomes look nothing alike. No other hackathon entry will have this architecture. Prize target: Best App with a Hook. | HIGH | [W1 contracts, W2 wiring] | Genome is config, not code. StyleTemplate is data. The typed seam (DayVector→Scene→Paint) makes this possible. W1 establishes the schema; W2 activates genome-driven synthesis. |
| **Conflict turbulence (red signal)** | Drama and conflict become a visible, beautiful, red turbulence layer. This is the most viscerally "Reddit" feature — Redditors recognize conflict as endemic to the platform, and making it part of the art gives it meaning instead of just frustration. | HIGH | [W1 engine, W2 real data] | Conflict is a composite proxy (FR-P4): comment-to-upvote ratio, reply depth, velocity spikes. The engine maps `conflict → 0..1` → branch/roughness/red turbulence. Must tune against real data in W2. |
| **Overnight mutation / rare events** | Occasionally a shell mutates overnight: palette flips, an "outbreak" pattern, a "dead ring." These are rare (low probability in rareTable) but create stories — "remember when our universe went dark for a day?" — that drive return engagement. | MEDIUM | [W3] | Driven by `rareTable` in Genome (FR-G5). The engine needs a mutation-application step. Rarity is the value: if it happens every day it's noise. |
| **Per-community style skin (genome at install)** | Mods choose a visual identity at install. r/gaming looks different from r/knitting even though the same engine renders both. This is the "self-authored artifact" quality the spec prizes. | HIGH | [W2 install, W3 skins] | Techno ships W1. Comic + Pixel are W3. The skin-as-data architecture means adding styles later costs no engine changes. |
| **Biographical depth ("our history")** | Unlike r/place (spatial, one canvas), Subcosm is temporal: you can scrub back through a community's entire history. A 3-month-old subreddit has 90 rings, each readable. This accumulation is the "hook" the competition rewards. | MEDIUM | [W1 engine, W2+ data] | The depth scrubber already serves this in W1 with simulated data. Real history comes with W2+ Redis rings. |
| **Simulator-as-dev-tool (W1 deliverable)** | The data simulator is both a development tool and a proof: "any data renders." It lets the engine be demoed without Reddit wiring. The regenerate control + variant scenarios (AMA day, drama spike, quiet weekend) prove the data→optics mapping. | MEDIUM | [W1] | The simulator's output schema IS the DayVector contract the real collector will fill. This is the derisking strategy for W1. |
| **Theme-sourced visual identity** | The `dominantTheme` in DayVector feeds into the shell's era/label. Mode A uses a community vote; Mode B reads the real top post. This makes each shell uniquely branded by what the community talked about that day — no other game in this category does this. | MEDIUM | [W2 Mode A, Stretch Mode B] | Mode A (curated vote in game sub) ships. Mode B (real host community top post) is a stretch (R-8 moderation risk). |
| **Seeded universe shareable / auditable** | Because the universe is deterministically reproducible from ~25 scalars + seed, any ring can be independently reproduced and verified. This is the "fossil" property of the spec (I-3). | LOW | [W1] | This is a consequence of determinism, not extra work. Its value is trust: the community knows the art is theirs, not server-generated black-box output. |

---

### Anti-Features (Deliberately Not Building)

Features that seem appealing, natural, or commonly requested in this genre, but which violate the spec's invariants, inflate scope, or actively harm the product.

| Feature | Why It Seems Appealing | Why It's Actually Harmful | What to Do Instead |
|---------|----------------------|--------------------------|-------------------|
| **Literal infinite-fractal / Mandelbrot deep-zoom** | The name "Subcosm" suggests it; judges might expect it from a game with that name | True Mandelbrot computation is mathematically unbounded. It kills mobile perf, breaks the LOD model, destroys legibility (you lose track of where you are), and requires shader math that won't ship on time. The name is a pun, not a mandate. | LOD shells: zoom reveals individual elements (stars, clusters) within a ring's fixed radius, not recursive zooming into infinite mathematical structure. Out of Scope, explicitly (PROJECT.md). |
| **Free-form activity dashboard / analytics panel** | Devs often want to show the numbers behind the art (posts per day trend, contributor leaderboard, upvote charts) | This turns the game into a Reddit Analytics tool. It kills the "fossil organism" identity (I-3). A dashboard is not a game. Users don't return to dashboards; they return to living things. | The depth scrubber readout (date + theme + stats per shell) provides all the data legibility needed. Stats serve the art, not the other way around. |
| **Per-user styling / custom skins** | Players naturally want personalization; "let me change the color" seems harmless | Per-user styles break the shared artifact. The whole point is ONE community universe. If everyone sees a different skin, there is no shared experience. Invariant I-4 forbids this. | One style per community, set at install by the mod (genome). Style is community identity, not personal preference. |
| **Real-time activity ticker / live comment stream** | Reddit users are used to live feeds; showing the frontier growing in real-time looks exciting | A raw activity feed transforms the game into a news scroller. The magic is that individual actions are aggregated into art — the aggregate is what's beautiful, not the firehose. Per-post level detail breaks the abstraction. | Live frontier animation shows the shell growing (new stars igniting) without revealing individual posts. The aggregate wins. |
| **Post-level zoom (star → real post)** | Tapping a star to see the actual post seems like an obvious feature that increases depth | This requires significant Devvit API surface (fetching individual post content), massively inflates scope, and breaks the privacy model (aggregates, not content — NFR requirement). Stars symbolize posts; they are not portals to posts. | Mark as Stretch (PROJECT.md). If time allows after all W4 polish is done. Don't build until W4 is confirmed stable. |
| **Community vote on style mid-game** | Style voting seems like a great engagement mechanic | If a community changes style mid-game, all historical shells suddenly re-render with the new skin. This is a massive cache invalidation, breaks visual continuity, and confuses the biographical narrative. | Style is set at install. The rare-event mutation table (rareTable) can include a palette shift as a seltene Event without changing the full skin. Style vote is Stretch only. |
| **Multiple simultaneous styles per community** | "Let mods pick two skins and blend them" | Defeats the "one coherent identity" design. Blending is undefined behavior at the StyleTemplate boundary. Adds a combinatorial explosion to the paint layer. | Single `style: StyleId` in Genome. Multiple flagship styles are for different communities, not layers within one. |
| **fbm / WebGL shader layer (before Canvas2D ships)** | The Phaser prize requires it; shaders look incredible | Building the shader layer before the Canvas2D engine is proven is a classic premature-optimization trap. If Canvas2D doesn't work on mobile, shaders won't save you — they'll add a layer of complexity that masks the root problem. | Canvas2D first, proven + tested. Shader is a Week-3 upgrade once the engine is stable. This is explicitly the Week-1 decision (D-8). |
| **Monetization / payments** | Hackathon judges appreciate sustainable businesses | Payments are post-hackathon. Adding payments to a hackathon entry in 4 weeks is scope suicide and irrelevant to any prize category. | Post-hackathon. Devvit payments exist when the time comes. |
| **Mode B (real host-community theme extraction) in MVP** | Mode B is more magical: the universe literally reflects the real subreddit's conversations | Mode B requires NLP/text processing to extract a meaningful theme from top posts/comments, plus moderation filtering against toxic themes (NFR-7, R-8). This is hard and risky. A moderation failure in the hackathon demo would be devastating. | Mode A (curated vote in game sub) ships. Mode B is architected but deferred. The adapter pattern in FR-P5 ensures the engine never cares which mode is active. |

---

## Feature Dependencies

```
Genesis Core render [W1]
    └──requires──> DayVector contract + seeded synthesis [W1]
                       └──requires──> Zod schema as source of truth [W1]

Depth scrubber + Shell readout [W1]
    └──requires──> Scene contract (Shell.meta) [W1]
    └──requires──> Camera state (zoom/focus) [W1]

Activity→visuals mapping (posts→stars, conflict→turbulence) [W1]
    └──requires──> Synthesis layer (DayVector→Scene) [W1]
    └──requires──> Paint layer (Scene→Canvas2D) [W1]

Data simulator with realistic DayVector[] [W1]
    └──requires──> DayVector contract [W1]
    └──enhances──> Activity→visuals mapping (proves variance) [W1]

Live frontier (fills during day) [W3]
    └──requires──> Overnight freeze / tick [W2]
    └──requires──> Redis live counters [W2]
    └──requires──> Realtime Devvit channel [W3]

Nudges (branch/symmetry/hue) [W3]
    └──requires──> Live frontier [W3]
    └──requires──> Steering in DayVector [W1 contract]
    └──requires──> steerGain in Genome [W1 contract]

Overnight freeze / reveal [W2]
    └──requires──> Devvit scheduler tick [W2]
    └──requires──> Redis ring records [W2]
    └──requires──> Engine bake-on-freeze [W2]

Genome / style-as-data framework [W1 contracts, W2 wiring]
    └──requires──> Genome + StyleTemplate Zod schemas [W1]
    └──enables──> Per-community style skin [W2+]
    └──enables──> Rare overnight mutations [W3]

Per-community style skin (Comic, Pixel) [W3]
    └──requires──> Genome style field [W1]
    └──requires──> Paint layer modular per-style [W1]
    └──depends-on──> Techno style proven + shipped [W1]

Conflict turbulence [W1 engine, W2 real signal]
    └──requires──> conflict: number (0..1) in DayVector [W1]
    └──requires──> conflict→visual mapping in synthesis [W1]
    └──requires──> Real composite proxy (comment:upvote ratio etc.) [W2]

Rare overnight mutations [W3]
    └──requires──> rareTable in Genome [W1 contract]
    └──requires──> Mutation-application step in tick [W3]
    └──depends-on──> Overnight freeze working [W2]

Theme-sourced visual identity (Mode A) [W2]
    └──requires──> dominantTheme in DayVector [W1 contract]
    └──requires──> Devvit post/comment triggers [W2]

Cold-start legibility [W1 sim]
    └──requires──> Genome base values [W1]
    └──requires──> Simulator day-1 scenario [W1]

Post-level zoom (star→real post) [Stretch]
    └──requires──> All above stable [W4+]
    └──conflicts──> scope / hackathon timeline
```

### Key Dependency Notes

- **DayVector Zod schema is the root dependency.** Everything else — synthesis, paint, simulator, Devvit wiring — derives from it. Getting this right in W1 saves rewrites later.
- **Camera / depth scrubber is W1 scope** even though live frontier wiring is W3. The engine must support the state model (frozen shell vs live frontier) from day one.
- **Conflict signal** exists in the DayVector contract from W1 (the `conflict: number` field), but the composite proxy that computes it from real Reddit signals is a W2 problem. The simulator provides synthetic conflict values for W1 testing.
- **Genome steerGain and rareTable** are in the W1 Zod schema (so the contracts are fully typed), but they're not exercised by real user nudges or tick mutations until W3.
- **Comic and Pixel styles** absolutely require a proven Techno style first. The paint layer's modular architecture (StyleTemplate as data, per-style paint modules) must be proven with one style before adding more.

---

## MVP Definition

### Week 1 — Engine + Simulator (current milestone)

The "MVP" of W1 is a self-contained, demo-able, visually compelling proof that any `DayVector[]` array renders as a legible, beautiful universe.

- [x] Zod schemas as single source of truth for DayVector, Scene, Genome, StyleTemplate
- [x] Deterministic seeded synthesis: `DayVector + seed + genomeVersion → Scene`
- [x] Techno-style Canvas2D paint at visual parity with the mock (genesis core, concentric shells, frontier ignite, nebula, vignette)
- [x] Depth scrubber + per-shell readout (date / era / theme / posts / comments / contributors / conflict-bar)
- [x] Camera: zoom + depth-scrub + focus
- [x] Data simulator: growth trend, busy/quiet variance, one drama spike, one AMA day; regenerate control
- [x] Verify: same seed → identical render; changing data changes universe; `prefers-reduced-motion` static; build + tests green
- [x] Nudge re-synthesis on the frontier (branch/symmetry/hue sliders bias mean, result is re-rendered)

### Week 2 — Devvit Wiring (next milestone)

Features that require Reddit platform integration.

- [ ] Devvit scaffold with scheduler tick + hourly sweeper
- [ ] Redis aggregation: daily counters, contributor SET, top-thread ZSET
- [ ] Genome-driven transform: real signal weights, not just mock heuristics
- [ ] End-to-end: real/simulated DayVectors flow through engine as webroot
- [ ] Mode A theme (curated vote in game sub)
- [ ] `dominantTheme` adapter wired to genome

### Week 3 — Live Frontier + Multi-Style (subsequent milestone)

- [ ] Live frontier: Devvit realtime channel; new stars ignite as activity comes in
- [ ] Nudges wired to Redis steer hash; action cap per user/day
- [ ] Overnight reveal post (FR-D4)
- [ ] Contributor flair / streak (FR-D5)
- [ ] Comic style (Techno proven; skin-as-data pays off here)
- [ ] Pixel style
- [ ] Rare overnight mutations from rareTable

### Week 4 — Polish + Submit (final milestone)

- [ ] Mobile perf audit: 60fps on mid-range Android
- [ ] `prefers-reduced-motion` verified on device
- [ ] Onboarding: first visit explains the game in ≤3 sentences
- [ ] Genesis moment: first-post visual celebration
- [ ] LOD verification: zoom reveals element-level detail without fractal math
- [ ] Submission package: demo video, subreddit with real arc visible

### Stretch (only if W4 is stable with time remaining)

- [ ] Mode B: real host-community theme extraction (requires moderation filter)
- [ ] Post-level zoom (star → real post)
- [ ] fbm/WebGL shader layer (Phaser prize upgrade)
- [ ] "Top of all time" backfill for historical rings
- [ ] Community style vote as rare event

---

## Feature Prioritization Matrix

| Feature | Hackathon Judge Value | Implementation Cost | Priority |
|---------|----------------------|---------------------|----------|
| Activity→visuals mapping | HIGH (core claim) | HIGH | P1 — W1 |
| Legible time-axis readout | HIGH (invariant) | MEDIUM | P1 — W1 |
| Deterministic seeded synthesis | HIGH (trust + testing) | MEDIUM | P1 — W1 |
| Depth scrubber + zoom | HIGH (engagement) | MEDIUM | P1 — W1 |
| Data simulator with variance | HIGH (W1 proof) | MEDIUM | P1 — W1 |
| Techno style at visual parity | HIGH (polish criterion) | HIGH | P1 — W1 |
| Overnight freeze / reveal | HIGH (hook criterion) | HIGH | P1 — W2 |
| Genome / style-as-data | HIGH (differentiator) | HIGH | P1 — W1 contracts, W2 wiring |
| Conflict turbulence | MEDIUM (Reddit-y) | MEDIUM | P1 — W1 engine |
| Live frontier animation | MEDIUM (retention) | HIGH | P1 — W3 |
| Nudges (branch/symmetry/hue) | MEDIUM (agency) | MEDIUM | P2 — W3 |
| Comic + Pixel styles | MEDIUM (polish, coverage) | MEDIUM | P2 — W3 |
| Rare overnight mutations | MEDIUM (stories) | MEDIUM | P2 — W3 |
| Cold-start legibility | LOW (edge case) | LOW | P2 — W1 sim |
| Mode B real sub theme | LOW in prize terms (risky) | HIGH | P3 — Stretch |
| Post-level zoom | LOW (scope risk) | HIGH | P3 — Stretch |
| fbm/WebGL shader | LOW until W4 stable | HIGH | P3 — Stretch |

---

## Comparable Reference Points

| Feature | r/place | Idle games | Devvit examples (r/honk, r/DailyGuess) | Subcosm |
|---------|---------|------------|----------------------------------------|------------|
| Shared canvas / artifact | One canvas, all users | No | No | One universe per community |
| Individual agency | Place one pixel / 5 min | Tap/upgrade | Guess/vote per day | Nudge frontier mean (branch/sym/hue) |
| Daily engagement hook | Canvas grows in real-time | Offline rewards accumulate overnight | Daily puzzle resets | Overnight freeze reveals new shell |
| Time axis / history | Timelapse only | Progress bars | N/A | Depth = time; scrubber traverses history |
| Community identity | Emergent from territorial warfare | None | Sub-specific puzzle set | Genome + style = unique identity per community |
| Persistence after "event ends" | Canvas archived, game ends | Permanent | New puzzle each day | Universe accumulates forever |

---

## Sources

- Primary: `docs/subcosm-requirements.md` (all functional requirements, invariants, scope table)
- Primary: `.planning/PROJECT.md` (decisions, constraints, milestone structure)
- Reference: `docs/subcosm-universe-mock.html` (visual target for W1)
- Comparable: r/place design analysis — rate limiting, collaboration forcing function, territorial dynamics
- Comparable: Reddit hackathon criteria (redditgameswithahook.devpost.com) — "hook-y", polish, Reddit-y, retention
- Comparable: Idle game retention patterns — overnight accumulation, offline rewards, compounding loops
- Comparable: Procedural generation determinism patterns — seeded reproducibility as trust mechanism

---

*Feature research for: Subcosm — collaborative persistent generative-art community game (Devvit)*
*Researched: 2026-06-19*

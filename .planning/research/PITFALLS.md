# Pitfalls Research

**Domain:** Deterministic procedural-art game on Devvit Web (Reddit Interactive Posts)
**Researched:** 2026-06-19
**Confidence:** MEDIUM (Devvit API facts from authoritative source; Canvas2D and Zod findings from community; aesthetics from domain knowledge)

---

## Critical Pitfalls

### Pitfall 1: Math.random() Leakage Breaks Determinism Silently

**What goes wrong:**
A single call to `Math.random()` anywhere in the synthesis path — including inside a utility function, a third-party helper, or a style primitive accidentally imported into engine code — destroys the reproducibility guarantee. The render appears correct on first view but produces different star positions on every reload and diverges between client and server.

**Why it happens:**
`Math.random()` is the path of least resistance. It is available everywhere in JS, produces no type errors, and the divergence is invisible until you deliberately compare two renders of the same seed. Developers port the mock's `Math.random()` calls directly without replacing them, or add a helper ("just for layout, not synthesis") that internally calls it.

**How to avoid:**
- Implement one seeded RNG at project start (mulberry32 is 4 lines and sufficient; xoshiro128** is better for longer sequences). Make it the only RNG in `src/engine/`. Instantiate it from `DayVector.seed` at the top of each synthesis call.
- Ban `Math.random` at the ESLint level with `no-restricted-globals` for everything under `src/engine/`.
- Pass the RNG instance explicitly into every function that needs randomness — never import it as a module-level singleton (singleton state leaks across tests).
- The simulator (`src/sim/`) may use `Math.random()` freely because it generates the seed values, not the renders.

**Warning signs:**
- Two renders of the same `DayVector[]` with the same seed produce different star angles.
- A Vitest snapshot test for synthesis fails non-deterministically.
- `Math.random` appears in `src/engine/` in a grep.

**Phase to address:** Week 1 engine port — establish the seeded RNG before porting any synthesis logic from the mock. The ESLint rule and a snapshot test for identical seeds must be green before any other engine work.

---

### Pitfall 2: Float Nondeterminism Between Client and Server Render

**What goes wrong:**
JavaScript's floating-point arithmetic is mostly deterministic within a single V8 version, but transcendental functions (`Math.sin`, `Math.cos`, `Math.pow`, `Math.sqrt`) can produce platform-specific last-bit differences when the JIT compiler uses different instruction sets (x87 vs SSE2 vs ARM NEON). The divergence is typically sub-pixel but causes shell star positions to differ by 0.000001 between the client (WebView on a phone) and a server-side preview render.

**Why it happens:**
The synthesis layer uses `Math.sin`/`Math.cos` heavily for polar-to-Cartesian conversion of stars in concentric shells. These are typically fine within V8, but the risk is non-zero when adding a server-side static preview renderer later (different Node.js version, different architecture).

**How to avoid:**
- Round all final `(x, y)` coordinates in synthesis to the nearest 0.01 before storing in `Scene`. This absorbs last-bit float differences while keeping visual precision.
- Write a cross-environment determinism test: run the synthesis in Vitest (Node) and compare the Scene JSON to a known-good fixture generated in a browser environment.
- Avoid `Math.hypot` and `Math.atan2` in synthesis hot paths if server-side preview is a target — use explicit `Math.sqrt(dx*dx + dy*dy)` instead, which is more consistent.

**Warning signs:**
- Server-generated preview thumbnail shows slightly different star positions than the live client render for the same seed.
- A Vitest snapshot passes locally but fails in CI on a different OS.

**Phase to address:** Week 2 when server-side preview render is introduced. The synthesis coordinate-rounding rule should be established in Week 1 to avoid retrofitting.

---

### Pitfall 3: Zod Parsing Inside the Render Hot Loop

**What goes wrong:**
`DayVectorSchema.parse(raw)` or `SceneSchema.parse(scene)` is called on every animation frame tick or inside the synthesis-per-shell loop. Each `.parse()` call allocates a new validated object and runs the full validator tree. At 60fps with 30+ shells, this is thousands of validations per second, creating constant GC pressure that causes frame-time spikes (jank) on mobile.

**Why it happens:**
The Zod-as-single-source-of-truth rule is correct and important, but developers misapply it by validating at every function boundary rather than at system entry points. The mental model "always parse before use" is right for network/user input but wrong for internal function calls between trusted layers.

**How to avoid:**
- Parse exactly once at the boundary where untrusted data enters the system: sim→engine boundary (when `DayVector[]` is passed into synthesis), and on incoming Devvit trigger payloads (server boundary).
- Inside `src/engine/`, pass TypeScript types (`DayVector`, `Scene`, `Element`) directly — no `.parse()` calls.
- Use `.safeParse()` not `.parse()` in UI/error-reporting paths where validation failure is expected (e.g. user-supplied genome config).
- Do NOT parse `Scene` objects after synthesis returns — synthesis is a pure function that produces a trusted `Scene`; the type inference from `z.infer<typeof SceneSchema>` already guarantees the shape.
- The test suite validates schemas with `.parse()` on fixtures — this is correct and encouraged.

**Warning signs:**
- `SceneSchema.parse` or `DayVectorSchema.parse` appears inside `synthesizeShell()` or any function called per-frame.
- Chrome DevTools flame chart shows Zod validator functions in the render loop.
- Frame time spikes on mobile even with few shells.

**Phase to address:** Week 1 architecture — the engine module boundary rule (parse only at sim→engine boundary) must be established before implementing synthesis.

---

### Pitfall 4: Canvas2D Mobile Performance Cliff from Per-Star Gradients and devicePixelRatio

**What goes wrong:**
Creating a new `CanvasGradient` object for every star on every frame is slow — gradient objects are GPU resources that are expensive to allocate. Combined with a `devicePixelRatio` of 3 (common on modern Android flagship phones), the effective canvas resolution is 3x in each dimension, meaning 9x the fill cost. The frontier shell (the only animated one) easily has 200+ stars, each with a radial gradient glow. On a mid-range Android phone this hits 15–20fps.

**Why it happens:**
The mock HTML file creates gradients inline in the draw loop, which is fine for a one-shot demo but catastrophic at 60fps. Porting the mock directly carries this pattern in.

**How to avoid:**
- Pre-create and cache all `CanvasGradient` objects outside the draw loop, keyed by `(hue, size, energy)` parameter tuple. Gradients that don't change between frames are reused.
- Cap `devicePixelRatio` at 2.0 with `Math.min(window.devicePixelRatio, 2)`. The visual difference between 2x and 3x is imperceptible on a phone screen held at arm's length.
- Batch draws by style state: sort elements by `(fillStyle, strokeStyle, lineWidth)` groupings and set canvas state once per group, not per element.
- Round all `(x, y)` coordinates with `Math.floor` to avoid sub-pixel anti-aliasing paths on mobile GPU.
- The bake-on-freeze strategy (frozen shells rendered to OffscreenCanvas once, then `drawImage`'d on subsequent frames) is the correct solution for non-frontier shells. Implement this from day one, not as a retrofit.

**Warning signs:**
- `requestAnimationFrame` callback takes > 16ms on a simulated mid-range device in Chrome DevTools.
- `createRadialGradient` appears inside the per-element draw call.
- Canvas physical size > 2x the CSS size.

**Phase to address:** Week 1 paint layer — the baked-shell architecture and gradient caching must be part of the initial Canvas2D implementation, not added later.

---

### Pitfall 5: Aesthetics Collapsing into Generic Neon Fractal / AI-Slop

**What goes wrong:**
The universe looks like a Unity Asset Store space scene: black background, cyan/magenta additive glow blobs, random scatter with no visual grammar, generic neon rings. The judges (who have seen hundreds of generative art entries) immediately dismiss it. This is the project's highest-stated risk (R-1, NFR-5).

**Why it happens:**
The default aesthetic of "canvas + dark background + additive blend mode + sine-wave circles" produces the same look in every beginner generative art project. The Techno style description risks this if implemented naively. AI-generated code for "space visualizer" reliably produces exactly this pattern.

**How to avoid:**
- Anchor visual identity to the specific metaphor, not to generic space aesthetics: **tree rings, coral growth, crystal cross-section, geological strata**. These are organic, non-symmetric, time-layered. The visual grammar should read "fossil record of this community", not "space screensaver."
- Enforce a **visual grammar rule per signal**: conflict must look *structurally different* (branching, fracture, turbulence) not just "more red glow." A quiet day must look *intentionally sparse* (NFR-8, not broken).
- Give the Techno style something distinctive that generic neon-space doesn't have: **grid substrate + scanline texture + mono-spaced readout labels integrated into the art**. The readout is part of the art, not overlaid on top of it.
- Create a "neon fractal test": before calling the style done, look at it next to 10 images from "generative art canvas javascript" on Google Images. If yours blends in, it has failed.
- Use **non-default blend modes deliberately**: `multiply` and `color-dodge` over light substrates produce non-neon results. The Comic style with a cream substrate and flat inks explicitly avoids the neon trap.

**Warning signs:**
- The background is pure black and every element uses additive glow.
- Stars are rendered as identical radial gradient blobs differing only in radius and hue.
- There is no visible structural difference between a high-conflict day and a quiet day — just different colors.
- The per-shell readout text is white floating over the art in Arial, not integrated into the style.

**Phase to address:** Week 1 paint layer — the style foundation must be set correctly before adding more elements. Visual review against the mock and against the neon-fractal test before considering it done.

---

### Pitfall 6: Legibility Dying Under Decoration (Scrubber and Shell Tags Buried)

**What goes wrong:**
The depth scrubber, date labels, and per-shell stats readout become invisible because: (a) the canvas art draws over them, (b) the font color has insufficient contrast against the animated background, (c) the scrubber is implemented as a separate DOM element that doesn't scale correctly on mobile, or (d) the readout is removed or hidden in a "clean" mode.

**Why it happens:**
Decorative pressure. As the visual layer gets richer, the readout feels like visual noise and gets pushed to a corner, made semi-transparent, or removed. This violates I-2 and NFR-4 ("Legibility is mandatory in every style — never remove, only restyle").

**How to avoid:**
- Implement the scrubber and readout as **canvas-drawn elements** within the paint layer, not as CSS overlays. They get styled per StyleTemplate alongside the art — they are part of the art.
- Each StyleTemplate must include a `type: TypeSpec` that defines how labels are rendered (Techno = mono grid label, Comic = outlined letterpress, Pixel = pixel font). The type spec is mandatory, not optional.
- Write a legibility invariant test: parse a rendered frame and verify the shell date text is present and not occluded by any element drawn after it (canvas draw order test).
- Never add a "hide labels" control. The spec is explicit: labels are the identity invariant, not a feature.

**Warning signs:**
- Date labels are rendered as CSS `<div>` elements floating over the canvas.
- The type spec in StyleTemplate is empty or stub.
- The scrubber is commented out "temporarily" during art polish.
- Any PR description mentions "cleaner look without the readout."

**Phase to address:** Week 1 camera/UI layer — implement the scrubber and readout as canvas primitives alongside the initial Techno style. Do not defer.

---

### Pitfall 7: No Vote Trigger in Devvit — Conflict Proxy Built on Missing Signal

**What goes wrong:**
The conflict metric (a core visual driver: "red turbulence") is designed to be derived from vote behavior (comment-to-upvote ratio, controversial sort, vote velocity). But **Devvit has no vote trigger**. There is no `onVoteChange` or equivalent event. Vote scores in the Reddit API are also deliberately fuzzed (Reddit applies ±fuzzing to displayed scores). Building the conflict composite expecting real-time vote deltas will produce a flat, inaccurate metric.

**Why it happens:**
The spec (§11 open decisions, R-4) acknowledges the conflict proxy risk but underestimates the platform constraint. Developers assume a vote event exists because it is a fundamental Reddit action.

**How to avoid:**
- Available triggers for conflict signal collection: `onCommentCreate`, `onCommentSubmit`, `onCommentUpdate` — use comment creation rate and reply depth (back-and-forth threads) as primary conflict proxies. Comment volume and reply depth are fully observable without vote triggers.
- At the daily tick, read post/comment score via the Reddit API (polling at tick time, not real-time). Scores are fuzzed but the relative magnitude within a day is useful as a secondary signal.
- Treat vote-based signals as a supplement to, not the foundation of, conflict. The comment-to-post ratio and reply depth are more reliable.
- The composite: `conflict = 0.5 * (replyDepthRatio) + 0.3 * (commentVelocitySpike) + 0.2 * (reportedCommentRate)`. Tune at tick with real data.

**Warning signs:**
- The data collector module imports or listens for a vote event handler.
- The conflict field in `DayVector` is always 0.0 or does not vary meaningfully between simulated drama and calm days.

**Phase to address:** Week 2 Devvit data layer — verify the trigger list against the official docs before implementing the collector. Design the conflict composite around available signals only.

---

### Pitfall 8: Devvit Scheduler Is UTC Cron Only — Timezone Tick Logic Must Live in the Handler

**What goes wrong:**
The daily tick is scheduled to fire at a community-specific local time (mod-set timezone, default ~04:00 local). Developers assume the Devvit scheduler supports timezone-aware cron expressions (like many cloud schedulers). It does not — only standard UTC UNIX cron is supported. A cron job scheduled for `0 4 * * *` fires at 04:00 UTC for every community simultaneously, ignoring timezone.

**Why it happens:**
Cloud schedulers in common frameworks (AWS EventBridge, Vercel Cron, GitHub Actions) support timezone-aware cron. Devvit's scheduler documentation lists only standard UNIX cron format. Developers carry the assumption forward.

**How to avoid:**
- The spec's hourly sweeper pattern is correct: schedule a cron job every hour (`0 * * * *`), and in the handler, check which communities have crossed their local day boundary since the last sweep. Compute: `isTickDue(community) = localHour(community.tz, community.boundary.hour) && !alreadyTickedToday(community)`.
- Use the `Intl.DateTimeFormat` API or a minimal IANA timezone library (e.g. `@spacetimecraft/timezone` or similar) on the server to convert UTC to local time. Do not hardcode UTC offsets — DST transitions will break them twice yearly.
- The `hash(subId) % 60` jitter is applied to the minute, not the hour — implement this as an offset to the boundary hour check, preventing thundering-herd of all communities ticking simultaneously at the sweeper interval.

**Warning signs:**
- A cron expression like `0 4 * * *` is used per-community for the tick.
- The tick fires at the wrong time after DST transitions.
- All communities' frontiers freeze at the same UTC moment.

**Phase to address:** Week 2 Devvit scheduler implementation — the sweeper architecture must be designed correctly before any community data is collected.

---

### Pitfall 9: Devvit Triggers Fire More Than Once — Non-Idempotent Aggregation Overcounts

**What goes wrong:**
`onCommentCreate` and `onPostSubmit` triggers are explicitly documented as not guaranteed to fire exactly once ("Triggers are not guaranteed to deliver only once for a single event"). If the aggregation handler does `redis.incrBy('agg:{sub}:{day}:comments', 1)` on every trigger, a duplicate trigger delivery inflates the comment count. This corrupts the DayVector and makes the universe render more activity than actually occurred.

**Why it happens:**
The trigger guarantee in Devvit docs is easy to miss. Developers assume at-most-once delivery because most event systems work that way in practice.

**How to avoid:**
- Track processed event IDs. On each trigger, check a short-TTL Redis sorted set `events:seen:{sub}:{day}` for the event ID; if present, skip. If not, add the event ID and then increment counters. The sorted set acts as a deduplication window.
- Alternatively, use a Redis SET (via sorted set with score 0) for `agg:{sub}:{day}:authors` — this is already idempotent since it stores unique author IDs.
- For comment and post counts, the deduplication overhead is worth it: one missed duplicate turns a "quiet day" into a "drama day" in the conflict composite.

**Warning signs:**
- Comment counts are 10–20% higher than the actual post listing shows.
- The DayVector conflict value for a genuinely calm day is unexpectedly high.
- No event deduplication logic in the trigger handler.

**Phase to address:** Week 2 Devvit trigger implementation — deduplication must be part of the initial aggregation design.

---

### Pitfall 10: RNG Call-Order Dependency Breaks When Genome Changes

**What goes wrong:**
Synthesis uses the seeded RNG for star angles, sizes, energies, and cluster positions. The number of RNG draws depends on how many elements are generated, which depends on the DayVector parameters AND the Genome weights. If `genomeVersion` changes but the synthesis function does not gate on it, previously frozen rings will re-render with different star positions — violating the reproducibility guarantee for archived shells.

**Why it happens:**
The Genome is mutable config. A mod updates a weight, which causes a ring generated under a previous genome to produce a different number of RNG calls (e.g., a higher branch weight generates more filaments, consuming more RNG draws), shifting the sequence for all subsequent elements in that ring.

**How to avoid:**
- `genomeVersion` is part of the seed formula: `seed = hash(subId, day, genomeVersion)`. This means a genome change produces a different seed for subsequent days but does NOT retroactively change seeds for already-frozen rings (they carry the genomeVersion at freeze time in their `ring:{sub}:{i}` record).
- The `ring` record must store `genomeVersion` alongside the DayVector. Synthesis must read the stored genomeVersion, not the current live genome. Never synthesize a historical ring from the live genome.
- Test: produce a Scene from `DayVector` + `genomeV1`, freeze it, change the genome to `genomeV2`, re-synthesize the same ring — Scene must be identical (same seed, same stored genomeVersion).

**Warning signs:**
- Historical shell star positions change after a mod updates the genome.
- The ring record in Redis does not include `genomeVersion`.
- Synthesis reads the genome from `organism:{sub}` (live) rather than from `ring:{sub}:{i}` (frozen).

**Phase to address:** Week 2 data layer / tick implementation — the ring freeze record schema must include genomeVersion before any real rings are written.

---

### Pitfall 11: Redis Key Scan Not Supported — Lost Community State

**What goes wrong:**
The developer stores community ring data under keys like `ring:{sub}:{i}` but loses track of how many rings exist for a community. Later code tries `redis.keys('ring:{sub}:*')` to find all rings and discovers that Devvit Redis does not support global key scanning (`KEYS`, `SCAN` are not available). Ring data exists but cannot be retrieved.

**Why it happens:**
Redis key scanning is a standard Redis feature. Devvit's Redis subset removes it. This constraint is documented but easy to miss when designing the data model.

**How to avoid:**
- Always maintain a count or index in `organism:{sub}` (e.g., `ringCount`). Enumerate rings as `ring:{sub}:0` through `ring:{sub}:{ringCount-1}`. Never rely on key discovery.
- Use `organism:{sub}` as the authoritative index for all per-community keys. If a key name needs to be discovered later, it must be derivable from data in `organism:{sub}`.
- The schema in §6.5 of the requirements already has `organism:{sub}.ringCount` — follow it exactly.

**Warning signs:**
- Any code that calls `redis.keys(...)` or attempts a key pattern scan.
- `ringCount` is not incremented atomically at tick time.
- Ring data exists in Redis but cannot be displayed because the count is wrong.

**Phase to address:** Week 2 data layer design — establish the key naming convention and index structure before writing any ring records.

---

### Pitfall 12: Realtime Channel Names Cannot Contain Colons

**What goes wrong:**
The natural Redis key convention uses colons as namespacing separators (`steer:{sub}:{day}`). Developers use the same naming convention for realtime channels, e.g., `connectRealtime({ channel: 'steer:t5_abc:42' })`. The Devvit realtime API prohibits colons in channel names. The subscription silently fails or throws a runtime error.

**Why it happens:**
Channel name constraints are documented in a single parenthetical in the Devvit realtime docs. The Redis key naming convention (which does use colons) creates a natural but wrong template for channel names.

**How to avoid:**
- Use hyphens or underscores for realtime channel names: `steer-t5_abc-42` or `steer_t5abc_42`.
- Define channel name constructors as functions that enforce the convention: `frontierChannel(subId: string, day: number): string => \`frontier-${subId}-${day}\``.
- Write a unit test that asserts no channel name string contains a colon.

**Warning signs:**
- Realtime subscription code uses the same string templates as Redis keys.
- Channel names contain `:` characters.
- Live frontier updates never arrive on the client even though the server sends them.

**Phase to address:** Week 3 live frontier / realtime implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Port `Math.random()` calls from mock directly | Faster initial engine port | Determinism is broken from day one; impossible to test | Never — replace with seeded RNG in the same pass |
| Use CSS `<div>` overlays for scrubber and labels | Easier initial layout | Breaks on canvas resize/scale; cannot be styled per StyleTemplate; violates legibility invariant | Never — canvas-drawn only |
| Create gradient objects inside draw loop | Simpler code | GPU resource allocation at 60fps; frame drops on mobile | Never in the frontier animation loop; acceptable for one-shot bakes |
| Validate `Scene` objects after synthesis returns | Catches synthesis bugs | Zod allocation per frame; GC pressure destroys mobile perf | Only in development/debug mode, never in production render path |
| Cap `devicePixelRatio` at 2 from launch | Simpler code, better perf | Slightly softer image on 3x screens | Always acceptable — judges cannot tell the difference |
| Use live genome for historical ring re-synthesis | Simpler code | Historical rings shift appearance when genome changes; violates determinism | Never — always use stored genomeVersion |
| Hard-code UTC offset for timezone tick | Avoids IANA library | Breaks on DST transitions for 2 hours twice/year | Never — DST bugs are invisible until they happen |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Devvit triggers | Assuming `onVoteChange` or vote-delta trigger exists | No vote trigger exists; use comment event proxies and tick-time API polling for scores |
| Devvit triggers | Treating triggers as at-most-once delivery | Add event ID deduplication via short-TTL Redis sorted set |
| Devvit scheduler | Setting per-community timezone-aware cron | Run a UTC hourly sweeper; compute timezone crossing in the handler with `Intl.DateTimeFormat` |
| Devvit Redis | Using `redis.keys('pattern:*')` to enumerate rings | Maintain explicit `ringCount` index in `organism:{sub}`; enumerate by index only |
| Devvit realtime | Using `:` characters in channel names | Use `-` as namespace separator in channel names: `frontier-{sub}-{day}` |
| Devvit Redis | Mixing `redis` and `redisCompressed` on same key | Never mix — pick one client per key and document the convention |
| Reddit vote scores | Treating displayed score as exact | Scores are deliberately fuzzed; use relative magnitude for conflict proxy, not absolute values |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-star gradient creation in draw loop | Frame drops >16ms, janky animation on mobile | Pre-cache CanvasGradient objects outside rAF loop, keyed by parameters | Immediately on mobile with >50 frontier stars |
| devicePixelRatio 3x without capping | High GPU fill, thermal throttle on extended sessions | `Math.min(devicePixelRatio, 2)` at canvas init | Always on Pixel 7+ and recent iPhones (3x density) |
| Float coordinates without Math.floor | Sub-pixel rendering forces anti-aliasing on every draw call | Floor all x/y before ctx.arc/fillRect/moveTo | Subtle but consistent; visible as blurry edges on mobile |
| Zod .parse() inside synthesize-per-shell | GC spike every shell, main thread budget blown | Parse only at sim→engine boundary | With 30+ shells at 60fps |
| Non-baked frozen shells redrawn every frame | rAF dominated by drawing shells that never change | OffscreenCanvas bake-on-freeze; drawImage for frozen shells | With >7 shells (real game will have 30+ after a month) |
| Canvas state thrashing (fillStyle per element) | Many draw call state changes stall GPU pipeline | Sort elements by style group before drawing | With >100 elements per shell |
| Redis write per comment trigger in high-volume subs | 40,000 commands/sec limit hit during a drama spike | Batch counter updates; use `incrBy` for counters (single atomic op) | During AMA-style events with thousands of comments/hour |

---

## "Looks Done But Isn't" Checklist

- [ ] **Determinism:** Render the same DayVector[] twice with the same seed. Compare Scene JSON character-for-character. They must be identical. (`Math.random` not present in `src/engine/`.)
- [ ] **Baked shells:** After a shell is frozen, confirm it is drawn via `drawImage` from OffscreenCanvas, not re-synthesized. Check the rAF profiler — frozen shells should produce zero synthesis calls.
- [ ] **Scrubber legibility:** Load the renderer on a 375px wide viewport (iPhone SE). Confirm the shell date label is readable without squinting. Confirm the depth scrubber is interactive.
- [ ] **prefers-reduced-motion:** Set `prefers-reduced-motion: reduce` in the OS. Confirm the frontier shell does not animate — stars are placed statically, no strobe, no pulse.
- [ ] **Genome version isolation:** Change a genome weight. Confirm that historical ring 1 renders identically before and after the change. (Fails if synthesis reads live genome instead of stored genomeVersion.)
- [ ] **Trigger deduplication:** Manually fire `onCommentCreate` twice with the same event payload. Confirm the comment count increments by 1, not 2.
- [ ] **Realtime channel names:** Assert no channel string in the codebase contains `:`. Grep: `grep -r "connectRealtime\|realtime.send" src/ | grep ":"`.
- [ ] **Zod boundaries:** Assert no `.parse()` or `.safeParse()` call appears inside `src/engine/synthesis/` or the rAF draw function. Grep: `grep -r "\.parse\|\.safeParse" src/engine/`.
- [ ] **Cold start:** Simulate day 1 with DayVector `{ posts: 1, comments: 3, contributors: 1, conflict: 0, ... }`. The universe must look intentional — a sparse genesis core with visible purpose — not a broken empty canvas.

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Math.random leakage | Week 1: Engine port | ESLint rule + Vitest snapshot of identical seeds |
| Float nondeterminism | Week 1 (rule); Week 2 (server render) | Cross-environment snapshot test |
| Zod in hot loop | Week 1: Architecture boundary | Grep for .parse in engine src; rAF profiler |
| Canvas2D perf (gradients, DPR, bake) | Week 1: Paint layer | rAF profiler on simulated mid-range Android |
| Aesthetics collapse | Week 1: Style foundation | Visual review vs. neon-fractal test |
| Legibility / scrubber | Week 1: Camera/UI layer | 375px viewport test; invariant assertion |
| No vote trigger | Week 2: Data layer design | Confirm trigger list before writing any collector |
| Scheduler UTC-only | Week 2: Scheduler design | DST transition simulation test |
| Non-idempotent triggers | Week 2: Aggregation handler | Duplicate event injection test |
| RNG/genome version isolation | Week 2: Ring freeze schema | Genome-change re-render test |
| Redis key scan unavailable | Week 2: Data model | Code review: no `redis.keys()` calls |
| Realtime colon in channel names | Week 3: Live frontier | Grep + subscription test |

---

## Sources

- Devvit triggers documentation (authoritative): `github.com/reddit/devvit-docs` — triggers.mdx (MEDIUM confidence, cross-checked with official repo)
- Devvit Redis documentation (authoritative): `github.com/reddit/devvit-docs` — redis.mdx — 500 MB limit, 5 MB request size, 40k commands/sec, no key scan (MEDIUM confidence)
- Devvit scheduler documentation (authoritative): `github.com/reddit/devvit-docs` — scheduler.mdx — UTC UNIX cron only (MEDIUM confidence)
- Devvit realtime documentation (authoritative): `github.com/reddit/devvit-docs` — realtime/overview.md — no colon in channel names (MEDIUM confidence)
- Reddit vote fuzzing: `quora.com` / community knowledge — scores are fuzzed, no real-time vote events (LOW confidence, but consistent with Devvit trigger list)
- Canvas2D perf: `developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas`, `web.dev/articles/offscreen-canvas` (LOW confidence via websearch)
- Zod performance: `github.com/colinhacks/zod/issues/5310`, `numeric.substack.com/p/how-we-doubled-zod-performance-to` (LOW confidence)
- Seeded RNG: `emanueleferonato.com/2026/01/08/understanding-how-to-use-mulberry32-to-achieve-deterministic-randomness-in-javascript/` (LOW confidence)
- Project requirements §5 NFRs, §11 open decisions, §13 risks: `docs/subcosm-requirements.md` (HIGH confidence — primary source)

---
*Pitfalls research for: Subcosm — deterministic procedural-art Devvit game*
*Researched: 2026-06-19*

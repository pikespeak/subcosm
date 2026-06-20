# Phase 3: Devvit Scaffold + Data Layer - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire real Reddit activity into the (already-scaffolded) Devvit Web app so the engine renders a live community universe: triggers → Redis daily counters → a scheduler tick that freezes a ring and opens the next frontier → the post renders the universe from stored Ring records. The mod configures the Genome at install.

**Scaffold already exists (do NOT re-scaffold from zero):** `devvit.json` (splash + game entrypoints, Hono server, menu/forms), `src/server/{index,routes/{menu,api,forms,triggers},core/post}.ts` using `@devvit/web/server` (`redis`, `reddit`, `context`), Devvit deps `@devvit/web`/`@devvit/start`/`devvit` 0.13.4. **But `src/client/game.ts` is still the boilerplate Phaser demo** (Boot/Preloader/MainMenu/Game/GameOver, blue bg) — it must be replaced with the Subcosm cosmos render.

This is the first set of real Zod boundaries beyond the simulator: **parse at every one** — trigger payloads, Redis reads, scheduler/cron, and install settings (never inside synthesis/paint/the rAF loop).
</domain>

<decisions>
## Implementation Decisions

### Data flow to the post
- **D-01: Thin server, client renders.** A server route returns the community's **Ring records** (DayVector scalars + `seed` + `genomeVersion` + any steer) as JSON; the client calls the engine `render()` and synthesizes + paints. This preserves determinism, the no-stored-images rule (~25 scalars + seed per ring), and identical client/server render. **This phase: fetch-on-load.** Live realtime frontier updates + nudges are Phase 4 (LIVE) — not in scope here.

### Conflict composite (DEV-03)
- **D-02: `conflict` (0..1) = normalized combination of reply-depth + comments-per-post rate,** computed at tick time from Redis-accumulated proxies (no vote stream — no vote trigger exists). Deep threads = contention; high comments/post = heat. Chosen for robustness against trivial manipulation by a few posts. The exact normalization curve / weights are Claude's discretion (research-informed).

### Day boundary / freeze timing (DEV-04)
- **D-03: Per-community LOCAL midnight.** The mod selects the community IANA timezone at install. An **hourly UTC sweeper** finds due communities and fires the tick at their local midnight, with `hash(subId) % 60` minute jitter to spread load (DST-safe via IANA). Rationale: "frozen overnight" should feel real to that community, not fire mid-afternoon. (Auto-detecting timezone from sub data was considered and deferred — only if research finds it reliable; default is mod-choice.)

### Cold-start + install (DEV-06)
- **D-04: Mod picks Genome preset + Style at install; cold-start reads intentional.** Install settings form offers a Genome preset (Calm / Chaotic / Crystalline) **and** a Style; the chosen config drives that community's universe end-to-end with no code changes. Day-1 cold-start renders just the glowing **genesis core** (plus the first star once the first activity arrives) — must look beautiful/intentional, never broken or empty.

### Claude's Discretion
- Exact `conflict` normalization formula/weights (D-02 fixes the inputs + intent).
- Exact Redis key schema **beyond** the locked `organism:{sub}` + explicit `ringCount` index (DEV-05) and the SET (unique contributors) / ZSET (top threads) shapes (DEV-02).
- The fetch route shape / response envelope for D-01.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & spec
- `.planning/REQUIREMENTS.md` §B "Devvit Data Layer (DEV)" — DEV-01..DEV-06 (the phase contract)
- `docs/context/subcosm-spec.md` — hard rules (determinism, no stored images ~25 scalars+seed/ring, identical client/server render, Zod at boundaries)
- `docs/subcosm-requirements.md` §6 (contracts) + §7 (architecture) — the Ring record + data-layer design

### Pre-work blockers — research MUST verify before building (from STATE.md)
- **Devvit template name changed** (`web-view-post` archived Feb 2026) — verify the current template + CLI at scaffold (`devvit new`), since a scaffold already exists confirm it matches the current `@devvit/web` 0.13.4 conventions
- **WebGL-in-iframe on mobile** — validate Phaser/WebGL actually runs in the Devvit post webroot iframe on mobile early, before committing the cosmos render path
- **web-view postMessage API** — verify the client↔server messaging path (needed now for fetch-on-load; critical for Phase 4 realtime)

### Existing code (integration points)
- `src/engine/render.ts` — `render(dayVectors, genome, style) → RenderHandle` (the engine entry to mount; `RenderHandle.scrub/nudge/regenerate/destroy`)
- `src/client/cosmos-dev/main.ts` — **the canonical wiring reference**: `generateDayVectors({seed})` → `render()`. Phase 3 mirrors this but feeds **Ring records from the server** instead of the simulator.
- `src/client/game.ts` — boilerplate Phaser demo to **replace** with the cosmos mount
- `src/client/cosmos/PhaserPainter.ts` — the painter behind the Scene seam
- `src/server/routes/{triggers,api,menu,forms}.ts`, `src/server/core/post.ts`, `src/server/index.ts` — Hono scaffold to fill (`redis`/`reddit` from `@devvit/web/server`)
- `src/engine/contracts/DayVector.ts` — `DayVectorSchema` (the schema Ring records must satisfy; parse Redis reads + trigger-derived day vectors through it)
- `src/sim/generator.ts` — `generateDayVectors` (its output schema IS the DayVector contract the Redis layer fills — no schema drift)
- `devvit.json` — app config (entrypoints, server, menu, forms, settings to add)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`render()` / `RenderHandle` seam** — mount the engine in the game webview exactly as `cosmos-dev/main.ts` does, but source DayVectors from the server fetch instead of `generateDayVectors`.
- **Devvit Hono server scaffold** — `@devvit/web/server` gives `redis`, `reddit`, `context`; `api.ts` already shows the `redis.incrBy` pattern; `triggers.ts` exists to fill.
- **`DayVectorSchema`** — the single parse point for Redis reads + tick-built day vectors (Zod boundary).
- **Genome/Style presets (Calm/Chaotic/Crystalline)** — already data; the install setting just selects which preset id drives `render()`.

### Established Patterns
- **The simulator's output schema IS the live data contract** — Ring records are `DayVector + seed` (`seed = hash(subId, day, genomeVersion)`), so the live collector cannot drift from what the engine already renders.
- **Zod `.parse()` at every boundary** (trigger payloads, Redis reads, scheduler payloads, settings) — never inside synthesis/paint/the frame loop (perf).
- **Determinism across the Redis seam** — same Ring record renders identically on every client and on the server.

### Integration Points
- Replace `src/client/game.ts` boilerplate with a cosmos mount that fetches Ring records and calls `render()`.
- Server route (extend `api.ts`) returns `organism:{sub}` Ring records (indexed by `ringCount`).
- `triggers.ts`: post/comment-create → Redis daily counters (contributors SET, top-threads ZSET, comment/reply proxies for conflict).
- New: scheduler tick (freeze frontier → write Ring record → reset counters → open next frontier) + hourly UTC sweeper; install settings (timezone + genome preset + style).
</code_context>

<specifics>
## Specific Ideas

- Cold-start day-1 = glowing genesis core only (first star on first activity) — judge it looks intentional, mirroring Phase 5 success criterion 4.
- Validate WebGL-in-iframe on mobile and the postMessage path EARLY (spike) before committing the full render wiring — these are the riskiest unknowns.
- The conflict proxy must resist a single user spamming a few deep replies — normalize against volume.
</specifics>

<deferred>
## Deferred Ideas

- **Live realtime frontier fill + nudges** — Phase 4 (LIVE). This phase is fetch-on-load only.
- **Auto-detect community timezone** from sub data — considered; deferred to mod-choice unless research proves a reliable source.
- **Genome inheritance / day-to-day evolution at tick** beyond a straight transform — keep the tick a clean freeze+seed write for now; richer genome evolution is later-phase.

</deferred>

---

*Phase: 3-Devvit Scaffold + Data Layer*
*Context gathered: 2026-06-20*

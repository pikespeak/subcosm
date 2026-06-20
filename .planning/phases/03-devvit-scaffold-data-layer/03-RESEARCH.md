# Phase 3: Devvit Scaffold + Data Layer - Research

**Researched:** 2026-06-20
**Domain:** Devvit Web 0.13.4 (Reddit interactive posts) — server (Hono) + Redis data layer + triggers + scheduler + install settings, wired to the existing pure engine `render()`
**Confidence:** HIGH on the Devvit Web API surface (current official docs via Context7 `/websites/developers_reddit`), MEDIUM on mobile-WebGL-in-iframe (no authoritative platform statement found — spike-gated), HIGH on the determinism/Zod-boundary integration (verified against existing code)

## Summary

Phase 3 does **not** scaffold from zero — the repo already carries a working `@devvit/web` 0.13.4 "Devvit Web" app (`devvit.json` with split `splash.html` + `game.html` post entrypoints, a Hono server under `src/server` using `@devvit/web/server` for `redis`/`reddit`/`context`, plus menu/forms/triggers route stubs). The job is to (a) replace the boilerplate Phaser demo in `src/client/game.ts` with the real cosmos mount that fetches Ring records and calls the existing engine `render()`, and (b) build the server data layer: triggers → Redis daily counters, a scheduler tick that freezes a ring and opens the next frontier, an hourly UTC sweeper for per-community local-midnight ticks, and mod install settings (genome preset + style + IANA timezone).

The single most important finding that **resolves a STATE blocker**: the modern "Devvit Web" model has **no postMessage handshake for client↔server**. The client webview talks to its own server with a plain `fetch('/api/...')` — requests must target a same-origin path under `/api` (external domains are blocked client-side). `[CITED: developers.reddit.com/docs/capabilities/http-fetch]` This is exactly the D-01 "thin server, client renders, fetch-on-load" shape and needs no special bridge. `postMessage` only appears in the *older* blocks/webview-React template (mwood23/devvit-webview-react), which is **not** this app's architecture — do not reintroduce it. Realtime channels (Phase 4) are a separate `@devvit/web` server API, out of scope here.

The second STATE blocker — the archived `web-view-post` template — is moot: the scaffold already exists and matches current `devvit.json` v1 conventions (verified against the official `devvit_web_configuration` example). The third — WebGL/Phaser in the post iframe on mobile — remains genuinely **unverified by any authoritative source**; it must stay a Wave-0 spike, with the Canvas2D path behind the same `Scene` seam as the documented fallback (Phaser is already configured `type: AUTO` = WebGL-preferred, Canvas fallback).

**Primary recommendation:** Keep the existing scaffold; fill the server data layer with `@devvit/web/server` (`redis`, `reddit`, `context`, `settings`, `scheduler`) declaring scheduler tasks + settings + triggers in `devvit.json`; parse every new boundary (trigger payload, Redis read, scheduler `data`, settings) with Zod; the client fetches `/api/organism` and feeds Ring records into the unchanged `render()`. Spike WebGL-in-iframe-on-mobile **first**, before wiring the full client mount.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Thin server, client renders.** A server route returns the community's **Ring records** (DayVector scalars + `seed` + `genomeVersion` + any steer) as JSON; the client calls the engine `render()` and synthesizes + paints. Preserves determinism, the no-stored-images rule (~25 scalars + seed per ring), identical client/server render. **This phase: fetch-on-load.** Live realtime frontier updates + nudges are Phase 4 — NOT in scope.
- **D-02: `conflict` (0..1) = normalized combination of reply-depth + comments-per-post rate,** computed at tick time from Redis-accumulated proxies (no vote stream — no vote trigger exists). Deep threads = contention; high comments/post = heat. Chosen for robustness against trivial manipulation. Exact normalization curve/weights are Claude's discretion (research-informed).
- **D-03: Per-community LOCAL midnight.** Mod selects the community IANA timezone at install. An **hourly UTC sweeper** finds due communities and fires the tick at their local midnight, with `hash(subId) % 60` minute jitter to spread load (DST-safe via IANA).
- **D-04: Mod picks Genome preset + Style at install; cold-start reads intentional.** Install settings form offers a Genome preset (Calm / Chaotic / Crystalline) **and** a Style; the chosen config drives that community's universe end-to-end with no code changes. Day-1 cold-start renders just the glowing **genesis core** (plus the first star once the first activity arrives).

### Claude's Discretion
- Exact `conflict` normalization formula/weights (D-02 fixes the inputs + intent).
- Exact Redis key schema **beyond** the locked `organism:{sub}` + explicit `ringCount` index (DEV-05) and the SET (unique contributors) / ZSET (top threads) shapes (DEV-02).
- The fetch route shape / response envelope for D-01.

### Deferred Ideas (OUT OF SCOPE)
- **Live realtime frontier fill + nudges** — Phase 4 (LIVE). This phase is fetch-on-load only.
- **Auto-detect community timezone** from sub data — deferred to mod-choice unless research proves a reliable source. (No reliable Devvit API for a subreddit's "timezone" was found — confirms mod-choice default.)
- **Genome inheritance / day-to-day evolution at tick** beyond a straight freeze+seed transform.

## Project Constraints (from CLAUDE.md)

These have the authority of locked decisions — no plan may contradict them:

- **Zod is the single source of truth.** Every new external boundary parses with Zod: trigger payloads, Redis reads, scheduler `data`, install settings. Types are `z.infer` — NO duplicate `interface`/`type` for schema-covered shapes. No `as` casts to silence typing.
- **Parse at boundaries with `.parse()`** (trigger handlers, scheduler handlers, Redis read functions, settings reads). **UI uses `.safeParse()`** and returns structured errors — never throws. **Never parse inside synthesis, paint, or the rAF loop** (perf).
- **i18n error keys** — every settings validation error + user-facing string is an i18n key (e.g. `error.settings.timezone.invalidIana`), not hardcoded text.
- **`src/engine/` stays Devvit-free** — no `@devvit/*` imports, no `Math.random()` inside `src/engine/`. Devvit code lives only in `src/server` + `src/client`. (ESLint-enforced via `no-restricted-imports` + the engine tsconfig.)
- **Determinism:** every shell reproducible from `DayVector + seed + genomeVersion`; identical client/server render. `seed = hash(subId, day, genomeVersion)`.
- **No stored images:** ~25 scalars + seed per ring; never store pixels.
- **Plan Mode first** for non-trivial steps; show typed contracts before implementing.
- **Tests + build always green** (`npm test`, `tsc --build`, `eslint`) after each phase/plan.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEV-01 | Devvit Web app hosts the engine as the interactive post webroot. Verify template + CLI. | Scaffold already current (`devvit.json` v1 `post.entrypoints` verified). Client↔server is `fetch('/api/...')`, NOT postMessage (blocker resolved). §"Devvit Web App Shape", Pattern 1. |
| DEV-02 | Triggers increment Redis daily counters; unique contributors via SET, top threads via ZSET. No vote trigger. | `onPostCreate`/`onCommentCreate` declared in `devvit.json`, handled in Hono. `redis.incrBy` / `sAdd`+`sCard` / `zAdd`+`zRange` verified. §"Triggers", §"Redis", Pattern 2/3. |
| DEV-03 | Conflict composite from comment-rate / reply-depth proxies + score snapshot, at tick time. | No vote trigger confirmed — only Post/Comment create. Proxies captured from comment payload (`parentId` → reply depth) + counts. §"Triggers — Conflict Proxies", §"Don't Hand-Roll" (normalization). |
| DEV-04 | Scheduler tick freezes frontier → genome transform → Ring record → reset counters → open next frontier. Hourly UTC sweeper, IANA + `hash(subId)%60` jitter, DST-safe. | `scheduler.tasks` in `devvit.json` (cron) + `scheduler.runJob` runtime API verified. IANA via `Intl.DateTimeFormat` (no Devvit TZ API). §"Scheduler / Sweeper", Pattern 4/5. |
| DEV-05 | Ring records indexed by explicit `ringCount` in `organism:{sub}`; no key scan; no images, ~25 scalars + seed. | Redis has no `KEYS`/scan in Devvit — explicit `ringCount` counter + `organism:{sub}:ring:{n}` keys (hash). §"Redis Key Schema", Pattern 3. |
| DEV-06 | Mod configures Genome (preset + style) at install via Devvit settings; drives the universe end-to-end. | `devvit.json` `settings.subreddit` (= installation scope) with `select` + `string` + `validationEndpoint`; read server-side via `settings.get`. §"Install Settings", Pattern 6. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render the universe (synthesize + paint) | Browser / Client (game webview) | — | D-01 thin-server: determinism requires the client to run the engine `render()`; server only ships scalars. Engine is Devvit-free. |
| Fetch Ring records | Client (`fetch('/api/organism')`) → API/Backend | — | Same-origin `/api` fetch is the only client→server channel in Devvit Web. |
| Accumulate daily activity | API/Backend (trigger handlers) → Redis | — | Triggers fire server-side; only the server touches Redis. |
| Daily tick (freeze + write Ring) | API/Backend (scheduler handler) → Redis | — | Scheduler invokes a server endpoint; the genome transform + seed live server-side. |
| Enumerate due communities | API/Backend (hourly cron sweeper) → Redis | — | Sweeper reads a per-community registry/index in Redis and fires per-sub ticks. |
| Install config (genome/style/TZ) | API/Backend (settings, host-rendered form) | — | Devvit-native settings surface; read server-side via `settings.get`. |
| Splash first-frame | CDN/Static (`splash.html`, inline) | — | Inline static card shown in-feed before the interactive webview loads. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@devvit/web` | 0.13.4 | The Devvit Web runtime: `@devvit/web/server` exports `redis`, `reddit`, `context`, `settings`, `scheduler`, `createServer`, `getServerPort`, `cache`; `@devvit/web/shared` exports `TriggerResponse`, `UiResponse`, request types. | The platform SDK; already a dependency. `[VERIFIED: npm registry]` (`npm view @devvit/web version` → 0.13.4, `latest`) |
| `devvit` | 0.13.4 | The Devvit CLI (`devvit playtest`, `devvit upload`, `devvit publish`, `devvit login`). | Official CLI; already a dependency, used by repo scripts. `[VERIFIED: npm registry]` |
| `@devvit/start` | 0.13.4 | Devvit dev/start tooling. | Already present; companion to the CLI. `[VERIFIED: npm registry]` |
| `hono` | ^4.12.26 | The server router used inside `createServer`. Devvit Web supports Express **or** Hono; this repo uses Hono. | Official docs show first-class Hono examples for every server capability (triggers/scheduler/settings/cache). `[CITED: developers.reddit.com/docs/llms-full.txt]` |
| `@hono/node-server` | ^2.0.5 | `serve()` adapter wiring Hono into Devvit's `createServer`. | Already wired in `src/server/index.ts`. `[VERIFIED: npm registry]` (2.0.5) |
| `phaser` | ^4.2.0 | WebGL/Canvas renderer behind the `Painter` seam (`PhaserPainter`). | Already the engine's injected painter; `type: AUTO` = WebGL-preferred, Canvas2D fallback. `[VERIFIED: codebase]` |
| `zod` | 4.4.3 | Boundary validation for every new Devvit boundary. | CLAUDE.md mandate; `DayVectorSchema` already the contract. `[VERIFIED: codebase]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Intl.DateTimeFormat` (built-in) | — | Resolve "is it local-midnight for this IANA zone right now?" DST-safe, no library. | The sweeper's per-community due-check (D-03). No `process.env.TZ` mutation. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono (current) | Express | Both first-class in Devvit Web. Repo already on Hono — keep it; no reason to churn. |
| `Intl.DateTimeFormat` for TZ math | `luxon` / `date-fns-tz` | A library is heavier and an extra dep to vet; native `Intl` covers IANA + DST for the single "what's the local hour/date?" question. Recommend native unless the tick math grows. |
| postMessage client↔server bridge | plain `fetch('/api/...')` | postMessage is the **old** blocks/webview-React pattern — not this app's model. Using it would fight the platform. Use `fetch`. |

**Installation:** No new install required — every needed library is already a dependency. (If the tick TZ math ever outgrows native `Intl`, vet `luxon` before adding.)

**Version verification:** `npm view @devvit/web version` → `0.13.4` (dist-tag `latest`; `next` = `0.13.5-next-2026-06-18`). `devvit`, `@devvit/start` likewise `0.13.4`. `@hono/node-server` `2.0.5`. All confirmed 2026-06-20.

## Package Legitimacy Audit

> No new external packages are introduced this phase. All four Devvit packages are pre-existing, first-party Reddit packages on the npm registry.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@devvit/web` | npm | mature (0.13.x line) | first-party Reddit | github.com/reddit/devvit | OK | Already installed — keep |
| `devvit` | npm | mature | first-party Reddit | github.com/reddit/devvit | OK | Already installed — keep |
| `@devvit/start` | npm | mature | first-party Reddit | github.com/reddit/devvit | OK | Already installed — keep |
| `@hono/node-server` | npm | mature | high | github.com/honojs/node-server | OK | Already installed — keep |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    REDDIT ACTIVITY                         MOD (install)
                  posts / comments                        genome+style+TZ
                         │                                        │
                         ▼                                        ▼
         ┌───────────────────────────────┐          ┌──────────────────────┐
         │  Devvit triggers (server)      │          │ Devvit settings form  │
         │  onPostCreate / onCommentCreate│          │ (host-rendered)       │
         │  → Zod-parse payload           │          │ → validationEndpoint  │
         └───────────────┬───────────────┘          └───────────┬──────────┘
                         │ incrBy / sAdd / zAdd                  │ settings.get
                         ▼                                       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │                         REDIS  (per community)                    │
         │  organism:{sub}:counters  (hash: posts, comments, scoreSum, …)    │
         │  organism:{sub}:contributors:{day}  (SET → sCard = unique)        │
         │  organism:{sub}:threads:{day}       (ZSET → top thread sizes)     │
         │  organism:{sub}:ringCount           (int index, DEV-05)           │
         │  organism:{sub}:ring:{n}            (hash: ~25 scalars + seed)     │
         │  organism:{sub}:config              (genome/style/TZ snapshot)     │
         │  subs:registry                      (SET of installed sub ids)     │
         └───────────────┬─────────────────────────────────┬────────────────┘
              hourly cron │ (UTC sweeper)                    │ read Ring records
                         ▼                                   │
         ┌───────────────────────────────┐                  │
         │ Sweeper: for each sub in       │                  │
         │ registry, is it local-midnight?│                  │
         │ (IANA + hash(subId)%60 jitter) │                  │
         │  → runJob('tick', {subId})     │                  │
         └───────────────┬───────────────┘                  │
                         ▼                                   │
         ┌───────────────────────────────┐                  │
         │ TICK handler (server):         │                  │
         │ freeze frontier → conflict      │                  │
         │ composite (D-02) → DayVector +  │                  │
         │ seed=hash(subId,day,genomeVer)  │                  │
         │ → write ring:{n}, ringCount++   │                  │
         │ → reset day counters/SET/ZSET   │                  │
         └────────────────────────────────┘                  │
                                                             ▼
   CLIENT (game.html webview, mobile post iframe)   ┌──────────────────────┐
   ────────────────────────────────────────────────┤ GET /api/organism     │
   fetch('/api/organism')  ── same-origin only ────▶│ → Zod-parse all rings │
        │ Ring records (DayVector[] + seed)         │ → JSON envelope (D-01)│
        ▼                                           └──────────────────────┘
   render(days, genome, style, PhaserPainter)
        → synthesize → paint  (deterministic, identical to server)
        → cold-start (day 1) = genesis core only (D-04)
```

The diagram traces the two write paths (triggers, tick) into Redis and the one read path (client fetch → `render()`). The client never talks to Redis; the engine never imports Devvit.

### Recommended Project Structure
```
src/
├── engine/            # UNCHANGED — Devvit-free pure engine (render, synthesis, contracts)
├── sim/               # UNCHANGED — generateDayVectors (its output schema = the live contract)
├── client/
│   ├── splash.html/ts # S1 — replace boilerplate copy (cosmos palette)
│   ├── game.html/ts   # S2 — REPLACE Phaser-demo boot with cosmos mount (fetch → render())
│   └── cosmos/        # UNCHANGED — PhaserPainter, paint, camera, etc.
├── server/
│   ├── index.ts       # UNCHANGED wiring (add new route mounts)
│   ├── routes/
│   │   ├── api.ts        # ADD GET /api/organism (D-01 fetch route)
│   │   ├── triggers.ts   # ADD onPostCreate / onCommentCreate handlers (DEV-02/03)
│   │   ├── scheduler.ts  # NEW — tick handler + hourly sweeper handler (DEV-04)
│   │   ├── settings.ts   # NEW — validationEndpoint handlers (DEV-06, i18n keys)
│   │   ├── menu.ts       # UNCHANGED (create-post action)
│   │   └── forms.ts      # (example form can be removed)
│   ├── core/
│   │   ├── post.ts       # UNCHANGED
│   │   ├── redisKeys.ts  # NEW — central key-builder (organism:{sub}:…)
│   │   ├── ring.ts       # NEW — write/read Ring record (Zod-parsed)
│   │   ├── tick.ts       # NEW — freeze→conflict→DayVector+seed→reset
│   │   └── conflict.ts   # NEW — D-02 normalization (pure, unit-tested)
│   └── contracts/        # NEW — Zod schemas for the Devvit boundaries
│       ├── triggers.ts     # PostCreate/CommentCreate payload schemas
│       ├── settings.ts     # SettingsSchema (genome/style/timezone)
│       └── tickJob.ts      # scheduler `data` payload schema ({ subId, day })
└── shared/
    └── api.ts            # ADD OrganismResponse envelope type (z.infer)
```

### Pattern 1: Client fetches its own server (NO postMessage)
**What:** The game webview calls a same-origin `/api/...` endpoint with `fetch`. There is no postMessage handshake in Devvit Web.
**When to use:** D-01 fetch-on-load — the only client↔server channel this phase needs.
```typescript
// CLIENT — src/client/game.ts (mount)
// Source: developers.reddit.com/docs/capabilities/http-fetch
async function loadCosmos(): Promise<void> {
  const res = await fetch('/api/organism', {           // same-origin, must be /api/*
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  // UI boundary → safeParse, never throw (CLAUDE.md §6)
  const parsed = OrganismResponseSchema.safeParse(json);
  if (!parsed.success) { showError(/* i18n key */); return; }
  const { rings, genome, style } = parsed.data;
  if (rings.length === 0) { showColdStart(); return; }   // D-04 genesis-core-only
  render(toFrontierFirst(rings), genomeFor(genome), styleFor(style), new PhaserPainter());
}
```

### Pattern 2: Trigger handler → Redis daily counters
**What:** `onPostCreate` / `onCommentCreate` declared in `devvit.json`, handled in Hono, Zod-parsed, then `incrBy` / `sAdd` / `zAdd`.
**When to use:** DEV-02/03 accumulation.
```typescript
// devvit.json
"triggers": {
  "onAppInstall":  "/internal/triggers/on-app-install",
  "onPostCreate":   "/internal/triggers/on-post-create",
  "onCommentCreate":"/internal/triggers/on-comment-create"
}
```
```typescript
// SERVER — src/server/routes/triggers.ts
// Source: developers.reddit.com/docs/capabilities/server/triggers (+ migrate/public-api)
import { context, redis } from '@devvit/web/server';
import { CommentCreatePayloadSchema } from '../contracts/triggers';
import { keys } from '../core/redisKeys';

triggers.post('/on-comment-create', async (c) => {
  const payload = CommentCreatePayloadSchema.parse(await c.req.json()); // BOUNDARY parse
  const sub = context.subredditId!;
  const day = await currentDay(sub);
  await Promise.all([
    redis.incrBy(keys.counter(sub, 'comments'), 1),
    redis.sAdd(keys.contributors(sub, day), payload.author.id),        // unique → sCard later
    redis.zIncrBy(keys.threads(sub, day), payload.post.id, 1),         // thread size → top via ZSET
    // conflict proxies: reply-depth (parentId present = a reply) + comments/post rate
    payload.comment.parentId ? redis.incrBy(keys.counter(sub, 'replies'), 1) : Promise.resolve(0),
  ]);
  return c.json({ status: 'ok' }, 200);
});
```

### Pattern 3: Ring records indexed by explicit `ringCount` (no key scan)
**What:** Devvit Redis has **no `KEYS`/`SCAN`** — enumerate via an explicit integer counter, store each ring as a hash of ~25 scalars + seed.
```typescript
// SERVER — src/server/core/ring.ts
import { redis } from '@devvit/web/server';
import { RingRecordSchema } from '../../engine/contracts';   // = DayVector + seed (+genomeVersion)
import { keys } from './redisKeys';

export async function writeRing(sub: string, ring: RingRecord): Promise<void> {
  const n = await redis.incrBy(keys.ringCount(sub), 1);     // DEV-05 explicit index
  // store ONLY scalars + seed — never images (hard rule)
  await redis.hSet(keys.ring(sub, n), serializeScalars(ring));
}

export async function readAllRings(sub: string): Promise<RingRecord[]> {
  const count = Number((await redis.get(keys.ringCount(sub))) ?? '0');
  const raws = await Promise.all(
    Array.from({ length: count }, (_, i) => redis.hGetAll(keys.ring(sub, i + 1)))
  );
  return raws.map((r) => RingRecordSchema.parse(deserializeScalars(r)));  // BOUNDARY parse
}
```

### Pattern 4: Scheduler — hourly UTC sweeper + one-off tick
**What:** Declare an hourly cron task in `devvit.json`; the handler enumerates installed subs, checks per-sub local-midnight (IANA + jitter), and fires a per-sub tick via `scheduler.runJob`.
```typescript
// devvit.json
"scheduler": {
  "tasks": {
    "hourly-sweeper": { "endpoint": "/internal/scheduler/sweeper", "cron": "0 * * * *" },
    "tick":           { "endpoint": "/internal/scheduler/tick" }   // one-off, runJob at runtime
  }
}
```
```typescript
// SERVER — src/server/routes/scheduler.ts
// Source: developers.reddit.com/docs/capabilities/server/scheduler
import { scheduler, redis } from '@devvit/web/server';

scheduler.post?  // (illustrative) handler registered on the Hono router:
scheduler_router.post('/sweeper', async (c) => {
  const subs = await redis.sMembers(keys.registry());          // installed communities
  const nowUtc = new Date();
  for (const sub of subs) {
    const cfg = await readConfig(sub);                          // includes IANA tz
    if (isLocalMidnightWithJitter(nowUtc, cfg.timezone, sub)) {
      const day = (Number(await redis.get(keys.ringCount(sub))) ?? 0) + 1;
      await scheduler.runJob({ name: 'tick', data: { subId: sub, day }, runAt: new Date() });
    }
  }
  return c.json({ status: 'ok' }, 200);
});

scheduler_router.post('/tick', async (c) => {
  const { data } = await c.req.json<TaskRequest<{ subId: string; day: number }>>();
  const { subId, day } = TickJobSchema.parse(data);             // BOUNDARY parse
  await runTick(subId, day);                                    // core/tick.ts
  return c.json({ status: 'ok' }, 200);
});
```

### Pattern 5: DST-safe local-midnight check (native `Intl`)
**What:** No Devvit timezone API exists; compute the community's local hour from UTC with `Intl.DateTimeFormat` (handles DST), then gate by the `hash(subId)%60` minute jitter.
```typescript
// SERVER — src/server/core/tick.ts (pure helper, unit-testable)
function localHourMinute(nowUtc: Date, ianaTz: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(nowUtc);
  const hour = Number(parts.find((p) => p.type === 'hour')!.value) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  return { hour, minute };
}
function isLocalMidnightWithJitter(nowUtc: Date, tz: string, subId: string): boolean {
  const { hour, minute } = localHourMinute(nowUtc, tz);
  const jitter = fnv1a(subId) % 60;          // deterministic 0..59 minute offset
  return hour === 0 && minute >= jitter && minute < jitter + 60; // fires once in the 00:xx hour
}
```
> Validate the IANA string at install (`onValidate`/`validationEndpoint`) by attempting `new Intl.DateTimeFormat('en', { timeZone: value })` in a try/catch — it throws `RangeError` on an invalid zone.

### Pattern 6: Install settings (host-rendered) → server read
**What:** Declare installation-scope settings in `devvit.json` under `settings.subreddit` (subreddit = installation scope). Validate via a `validationEndpoint`. Read server-side via `settings.get`, Zod-parse the result.
```typescript
// devvit.json
"settings": {
  "subreddit": {
    "genome":   { "type": "select", "label": "Universe character",
                  "options": [ {"label":"Calm","value":"calm"},
                               {"label":"Chaotic","value":"chaotic"},
                               {"label":"Crystalline","value":"crystalline"} ],
                  "defaultValue": ["calm"] },
    "style":    { "type": "select", "label": "Visual style",
                  "options": [ {"label":"Techno","value":"techno"} ], "defaultValue": ["techno"] },
    "timezone": { "type": "string", "label": "Community timezone",
                  "defaultValue": "UTC",
                  "validationEndpoint": "/internal/settings/validate-timezone" }
  }
}
```
```typescript
// SERVER — read + parse
import { settings } from '@devvit/web/server';
const raw = {
  genome: await settings.get('genome'),
  style: await settings.get('style'),
  timezone: await settings.get('timezone'),
};
const cfg = SettingsSchema.parse(raw);     // BOUNDARY parse → drives render config
```

### Anti-Patterns to Avoid
- **postMessage bridge for client↔server** — that is the old blocks/webview-React template, NOT Devvit Web. Use `fetch('/api/...')`.
- **`redis.keys('organism:*')` / scanning** — Devvit Redis has no key scan. Use the explicit `ringCount` index (DEV-05).
- **Parsing Redis reads inside the rAF loop or synthesis** — parse once in the read function (`readAllRings`), then trust the inferred type (CLAUDE.md §6, perf hard rule).
- **Mutating `process.env.TZ` / relying on server local time** for the day boundary — use `Intl.DateTimeFormat` with the community's IANA zone (DST-safe).
- **Storing rendered pixels / sprite data in Redis** — store ~25 scalars + seed only (no-stored-images hard rule).
- **Re-scaffolding with `devvit new`** — the scaffold already matches current conventions; only fill it.
- **Hand-written `interface` for trigger/settings/ring shapes** — `z.infer` from the schema (CLAUDE.md §1, §9).
- **Letting a single user spam deep replies inflate `conflict`** — normalize reply-depth against volume (D-02 intent); see Don't Hand-Roll.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IANA timezone → local hour, DST-aware | A UTC-offset table / manual DST rules | `Intl.DateTimeFormat({ timeZone })` (built-in) | DST transitions + historical offsets are a minefield; the platform `Intl` data is correct and free. |
| Validate an IANA zone string | A hardcoded allow-list of zones | `try { new Intl.DateTimeFormat('en',{timeZone:v}) } catch(RangeError)` | The runtime already knows every valid zone; an allow-list goes stale. |
| Unique daily contributors | A JSON array you de-dupe in code | Redis `SET` (`sAdd` + `sCard`) | O(1) add + cardinality; atomic across concurrent triggers (DEV-02). |
| Top threads per day | Sort an in-memory list each read | Redis `ZSET` (`zIncrBy` + `zRange`/`zRevRange`) | Maintained sorted server-side; cheap top-N at tick (DEV-02). |
| Deterministic seed / hash(subId) | `Math.random()` / ad-hoc hash | The engine's `mulberry32` + an FNV-1a `hash(subId, day, genomeVersion)` (already used for `Element.hue` / per-day seed) | Determinism hard rule; reuse the existing seeded primitives — never introduce new entropy. |
| Ring enumeration | Key-scan / list-all | Explicit `ringCount` int + `ring:{n}` keys | Devvit Redis has no scan; DEV-05 mandates the explicit index. |
| Conflict normalization (D-02) | A raw sum that one spammer can spike | A volume-normalized composite: `reply-depth ratio = replies / max(comments,1)` and `heat = comments / max(posts,1)`, each squashed (e.g. `x/(x+k)` saturating curve) into 0..1, then a weighted blend → clamp [0,1] | The intent (D-02) is robustness to a few deep replies; normalizing against volume + a saturating curve resists trivial manipulation. (Exact `k`/weights are Claude's discretion — keep the function PURE + unit-tested.) |

**Key insight:** Every "hard" sub-problem here (TZ math, uniqueness, ranking, determinism, enumeration) already has a correct primitive — native `Intl`, Redis SET/ZSET, the engine's seeded RNG, the explicit `ringCount`. The only genuinely new *design* work is the `conflict` normalization curve, which must be a pure, unit-tested function, not scattered logic in the trigger handler.

## Runtime State Inventory

> Phase 3 is **greenfield wiring** (new server data layer + a client mount replacement), not a rename/refactor of existing stored state. No prior runtime state is being renamed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no Redis data exists yet in production; this phase *creates* the `organism:{sub}:*` schema for the first time. | Define the key schema cleanly now (forward-compatible with Phase 4 realtime). |
| Live service config | None — the app is not yet installed/published with real settings. Install settings are introduced this phase. | None. |
| OS-registered state | None — Devvit scheduler tasks are declared in `devvit.json` (platform-managed), not OS cron. | None. |
| Secrets/env vars | None new — no API keys this phase (`isSecret` settings not used). Genome/style/TZ are non-secret installation settings. | None. |
| Build artifacts | `src/client/game.ts` boilerplate Phaser scenes (`Boot/Preloader/MainMenu/Game/GameOver`) + `src/client/scenes/*` become dead once replaced; `forms.ts` example form is removable. | Remove dead demo scenes/forms when the cosmos mount lands (don't leave the blue-bg demo in the shipped bundle). |

## Common Pitfalls

### Pitfall 1: Assuming a postMessage bridge / wrong client↔server channel
**What goes wrong:** Copying the blocks/webview-React template's `postMessage` handshake into the game webview; it never connects.
**Why it happens:** Older Devvit tutorials and `mwood23/devvit-webview-react` use postMessage; the STATE blocker memorialized this uncertainty.
**How to avoid:** Use `fetch('/api/organism')` from `game.ts` — same-origin, path under `/api`. `[CITED: developers.reddit.com/docs/capabilities/http-fetch]`
**Warning signs:** Reaching for `window.parent.postMessage` or a `useDevvitListener` hook.

### Pitfall 2: WebGL unavailable in the post iframe on mobile (UNVERIFIED)
**What goes wrong:** Phaser boots WebGL on desktop playtest but the universe is blank/janky in the real Reddit post iframe on a phone.
**Why it happens:** Embedded iframes on mobile can refuse WebGL contexts or throttle them; **no authoritative Devvit statement was found either way** in this research.
**How to avoid:** **Wave-0 spike** — deploy a minimal `game.html` that renders a WebGL triangle + a Canvas2D fallback and open the post on a real phone before wiring the full mount. Phaser is already `type: AUTO` (WebGL→Canvas fallback); ensure the Canvas2D painter path behind the same `Scene` seam actually paints. `[ASSUMED]` it works; verify.
**Warning signs:** `WebGL context creation failed` in the webview console; black canvas on device but fine on desktop.

### Pitfall 3: No vote trigger → silently missing conflict signal
**What goes wrong:** Planning `conflict` around upvote/downvote deltas; there is no vote trigger.
**Why it happens:** Reddit/Devvit exposes Post/Comment create triggers, not a vote stream (confirmed: trigger list is `onPostCreate`/`onCommentCreate`/`onCommentSubmit`/`onAppInstall`/`onAppUpgrade`, no `onVote`).
**How to avoid:** Drive `conflict` from comment-rate + reply-depth proxies (D-02), with an optional score *snapshot* read at tick (`reddit.getPostById(...).score`), not a stream.
**Warning signs:** Looking for `onVote` / `onUpvote` in `devvit.json`.

### Pitfall 4: Key-scanning Redis to enumerate rings
**What goes wrong:** `redis.keys('organism:*:ring:*')` returns nothing / is unsupported.
**Why it happens:** Devvit Redis omits `KEYS`/`SCAN`.
**How to avoid:** Maintain the explicit `ringCount` counter (DEV-05); iterate `1..ringCount`.
**Warning signs:** Any `redis.keys(` call.

### Pitfall 5: Day boundary fires at server-UTC midnight, not community-local
**What goes wrong:** Every community freezes at the same UTC instant; "frozen overnight" lands mid-afternoon for many.
**Why it happens:** Using `new Date()` server-local / UTC directly instead of the IANA-resolved local hour.
**How to avoid:** Hourly cron sweeper + `Intl.DateTimeFormat` per-sub local-hour check + `hash(subId)%60` jitter (Pattern 4/5). Idempotency: guard the tick so a sub freezes at most once per local day (e.g. store `lastTickDay` and compare).
**Warning signs:** Tick logic that reads `Date.getHours()` without a `timeZone`.

### Pitfall 6: Re-parsing on the hot path / duplicating types
**What goes wrong:** `tsc` passes but perf drops or types drift between server and engine.
**Why it happens:** Parsing Redis reads inside synthesis/paint, or writing a hand `interface RingRecord`.
**How to avoid:** Parse once in `readAllRings`/trigger/settings/tick handlers; `z.infer` everywhere; the Ring record schema = `DayVectorSchema` (+ `seed`, `genomeVersion`) so it cannot drift from what the engine renders.
**Warning signs:** `.parse(` inside `src/engine/` or inside an rAF callback; a `type RingRecord = {…}` literal.

## Code Examples

### GET /api/organism — the D-01 fetch route (server)
```typescript
// SERVER — src/server/routes/api.ts (added)
// Source: developers.reddit.com/docs/capabilities/server/redis + http-fetch
import { context, settings } from '@devvit/web/server';
import { readAllRings } from '../core/ring';
import { SettingsSchema } from '../contracts/settings';

api.get('/organism', async (c) => {
  const sub = context.subredditId;
  if (!sub) return c.json({ status: 'error', message: 'error.api.noSub' }, 400);

  const cfg = SettingsSchema.parse({
    genome: await settings.get('genome'),
    style: await settings.get('style'),
    timezone: await settings.get('timezone'),
  });
  const rings = await readAllRings(sub);          // already Zod-parsed inside

  // D-01 envelope (shape = Claude's discretion); z.infer the response type in shared/api.ts
  return c.json({ type: 'organism', rings, genome: cfg.genome, style: cfg.style }, 200);
});
```

### Trigger payload schema (Zod boundary)
```typescript
// SERVER — src/server/contracts/triggers.ts
import { z } from 'zod';
export const CommentCreatePayloadSchema = z.object({
  author: z.object({ id: z.string() }),
  comment: z.object({ id: z.string(), parentId: z.string().optional() }),
  post: z.object({ id: z.string() }),
}).passthrough();                                   // tolerate extra platform fields
export type CommentCreatePayload = z.infer<typeof CommentCreatePayloadSchema>;
```

### Reading current subreddit id / name (context)
```typescript
// Source: developers.reddit.com/docs/api/redditapi/... (context.subredditId / reddit.getCurrentSubreddit)
import { context, reddit } from '@devvit/web/server';
const subId = context.subredditId;                  // stable id for organism:{sub} keys
const subName = (await reddit.getCurrentSubreddit())?.name;
```

## State of the Art

| Old Approach | Current Approach (0.13.x) | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| `Devvit.addTrigger` / `Devvit.addSettings` / `Devvit.addSchedulerJob` in code (blocks API) | Declarative `triggers` / `settings` / `scheduler` blocks in `devvit.json` → Hono/Express endpoints | "Devvit Web" migration (`docs/guides/migrate/public-api`) | This phase declares capabilities in `devvit.json`, handles them as server routes — matches the existing scaffold. |
| `web-view-post` blocks template + postMessage bridge | "Devvit Web" split `post.entrypoints` (`splash.html` + `game.html`) + same-origin `fetch('/api/...')` | Template archived Feb 2026 | STATE blocker resolved — no postMessage; the scaffold already uses the new model. |
| `context.scheduler.runJob` (blocks context) | `scheduler.runJob` from `@devvit/web/server` + declared `scheduler.tasks` | Devvit Web | Sweeper + tick use the server import + `devvit.json` tasks. |
| `context.settings.get` (blocks) | `settings.get` from `@devvit/web/server`; `validationEndpoint` for validation | Devvit Web | Settings read server-side; validation is an endpoint, not just an inline `onValidate`. |

**Deprecated/outdated:**
- The `web-view-post` blocks template (archived Feb 2026) — do not scaffold from it.
- postMessage client↔server in interactive posts — superseded by `/api` fetch in Devvit Web.
- `Devvit.addX(...)` in-code registration — superseded by `devvit.json` declarations for Devvit Web apps.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phaser/WebGL runs in the Devvit post iframe on **mobile**; Canvas2D is the documented fallback behind the same `Scene` seam. No authoritative Devvit statement found either way. | Pitfall 2, UI-SPEC S2 | HIGH — gates the whole render path. **Mitigate with a Wave-0 spike on a real phone before wiring the full mount.** |
| A2 | `onPostCreate` / `onCommentCreate` payloads expose `author.id`, `comment.parentId`, `post.id` (exact field nesting). | Pattern 2, triggers schema | MEDIUM — field names may differ slightly; `passthrough()` + a tolerant schema + logging the first real payload in the spike de-risks. Verify against the actual payload during playtest. |
| A3 | `subreddit`-scope settings = installation scope (one config per community), readable via `settings.get`. | Pattern 6, DEV-06 | LOW — confirmed by docs (`settings.subreddit` = installation-specific); option `select` defaultValue is an array. |
| A4 | `scheduler.runJob({ name, data, runAt })` is callable from a server route for one-off ticks; cron tasks declared in `devvit.json`. | Pattern 4, DEV-04 | LOW — confirmed by official Hono scheduler example. |
| A5 | No vote/score-delta trigger exists; score is only available as a snapshot via the Reddit API at tick. | Pitfall 3, DEV-03 | LOW — trigger list confirmed (no `onVote`); drives D-02 by design. |
| A6 | Devvit Redis has no `KEYS`/`SCAN`; enumeration is via explicit index. | Pattern 3, DEV-05 | LOW — consistent with DEV-05's explicit `ringCount` mandate; verify no `redis.keys` in the SDK during the spike. |
| A7 | Conflict normalization constants (`k`, weights) are tunable and should be a pure unit-tested function. | Don't Hand-Roll, D-02 | LOW — D-02 fixes inputs+intent; the curve is explicitly Claude's discretion. |
| A8 | Native `Intl.DateTimeFormat` is available in the Devvit server runtime (Node ≥22) for IANA TZ math. | Pattern 5 | LOW — Node 22 ships full ICU; `engines.node >=22.2.0`. Confirm in the spike. |

## Open Questions (RESOLVED)

1. **Does WebGL initialize in the Reddit post iframe on mobile?**
   - What we know: Phaser supports WebGL+Canvas; `type: AUTO` falls back to Canvas. Reddit games are an official Phaser target.
   - What's unclear: Whether the *mobile* post iframe grants a WebGL context (no authoritative Devvit doc found).
   - Recommendation: **Wave-0 spike on a physical phone** rendering a WebGL probe + Canvas2D fallback before committing the full mount. Plan must include this gate (mirrors STATE pre-work blocker).
   - **RESOLVED — by the 03-01 Wave-0 spike:** the WebGL-on-mobile probe (with the Canvas2D fallback behind the same `Scene` seam) is the first executable task of plan 03-01; its result determines the render path before the full mount is wired.

2. **Exact trigger payload field names in 0.13.4.**
   - What we know: payloads carry author/comment/post objects; docs show `author?.id` access.
   - What's unclear: precise nesting of `parentId` / thread root for reply-depth.
   - Recommendation: log the first real `onCommentCreate` payload during playtest; finalize `CommentCreatePayloadSchema` against it (`passthrough()` in the meantime).
   - **RESOLVED — by the 03-01 Wave-0 spike:** the first real `onCommentCreate`/`onPostCreate` payloads are logged during the 03-01 playtest spike; `CommentCreatePayloadSchema` is then tightened against the captured `parentId`/thread-root nesting in plan 03-02 (Task 2).

3. **Tick idempotency / at-least-once semantics.**
   - What we know: scheduler is at-least-once; the hourly sweeper may overlap a slow tick.
   - What's unclear: exact delivery guarantees.
   - Recommendation: make `runTick` idempotent — guard on a stored `lastTickDay` per sub so a double-fire writes a ring at most once per local day.
   - **RESOLVED — mitigated by the `lastTickDay` guard in 03-03:** `runTick` reads `organism:{sub}:lastTickDay` and is a no-op when `last >= day`, so an at-least-once double-fire writes a ring at most once per local day (plan 03-03, Task 2). Exact delivery guarantees no longer matter because the guard makes the tick idempotent regardless.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@devvit/web` / `devvit` CLI | DEV-01..06 (whole phase) | ✓ | 0.13.4 | — |
| Node | server runtime + `Intl` ICU | ✓ | ≥22.2.0 (`engines`) | — |
| Phaser | client render (S2) | ✓ | ^4.2.0 | Canvas2D painter behind the `Scene` seam |
| Reddit test subreddit (`devvit.json` `dev.subreddit`) | playtest of triggers/scheduler/settings on real Reddit | ✗ (not yet set) | — | Add a `dev.subreddit` + `devvit playtest`; needed to verify A1/A2 |
| `Intl.DateTimeFormat` (IANA) | sweeper TZ math (D-03) | ✓ (Node 22 full ICU) | — | none needed |

**Missing dependencies with no fallback:**
- A real test subreddit for playtest is required to verify the WebGL-in-iframe spike (A1) and the trigger payload shapes (A2). Set `dev.subreddit` in `devvit.json` and run `devvit playtest` as the first executable step.

**Missing dependencies with fallback:**
- WebGL on mobile → Canvas2D painter path (same `Scene` seam) if the spike fails.

## Security Domain

> `security_enforcement: true`, ASVS Level 1. This phase introduces external input boundaries (Reddit triggers, install settings, client fetch) — all validated by the mandated Zod boundary.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reddit/Devvit owns identity; `context.userId`/`subredditId` are platform-trusted. |
| V3 Session Management | no | Platform-managed (post/install context). |
| V4 Access Control | yes | Menu/form/settings actions gated `forUserType: "moderator"` (post-create + install). Server must not act on a `subId` it wasn't invoked for — derive `sub` from `context`, never from client input. |
| V5 Input Validation | **yes** | Zod `.parse()` at every boundary: trigger payloads, Redis reads, scheduler `data`, settings. UI `.safeParse()`. The phase's core security control. |
| V6 Cryptography | no | No secrets/crypto this phase (`seed` is a deterministic non-secret hash, not a security token). |

### Known Threat Patterns for Devvit Web + Redis

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/extra-field trigger payload | Tampering | Tolerant Zod schema (`passthrough` + typed required fields); reject/ignore on parse failure, never trust raw. |
| Client forging `subId` to read another community | Spoofing / Info disclosure | Derive `sub` from `context.subredditId` server-side; ignore any client-supplied sub. |
| Conflict-metric manipulation by spam | Tampering | Volume-normalized, saturating `conflict` curve (D-02) + unique-contributor SET. |
| Tick double-fire (at-least-once scheduler) | Tampering (data integrity) | Idempotent `runTick` guarded by stored `lastTickDay`. |
| Unbounded Redis growth (per-day SET/ZSET) | DoS | TTL/cleanup day-scoped keys after the tick consumes them (`expire` or delete on freeze). |
| Settings injection (bad IANA/genome/style) | Tampering | `validationEndpoint` + `SettingsSchema.parse`; i18n error keys; reject unknown preset ids. |

## Sources

### Primary (HIGH confidence)
- `/websites/developers_reddit` (Context7, 3064 snippets, High reputation) — devvit.json config schema; `@devvit/web/server` (redis/reddit/context/settings/scheduler/cache); Hono server pattern; triggers declaration + handlers; scheduler tasks + `runJob`; settings (`subreddit`/`global`, `select`/`string`, `validationEndpoint`, `settings.get`); client `fetch('/api/...')` constraint.
  - docs/capabilities/devvit-web/devvit_web_configuration
  - docs/capabilities/server/{triggers,scheduler,settings-and-secrets,redis,cache-helper}
  - docs/capabilities/http-fetch
  - docs/guides/migrate/public-api
  - docs/llms-full.txt
- npm registry — `@devvit/web@0.13.4` (latest), `devvit@0.13.4`, `@devvit/start@0.13.4`, `@hono/node-server@2.0.5` (verified 2026-06-20).
- Codebase — `devvit.json`, `package.json`, `src/server/**`, `src/engine/contracts/DayVector.ts`, `src/engine/render.ts`, `src/client/cosmos-dev/main.ts` (the canonical render wiring to mirror).

### Secondary (MEDIUM confidence)
- WebSearch — Phaser supports Reddit games as an official target (WebGL+Canvas); `mwood23/devvit-webview-react` demonstrates the *older* postMessage pattern (used to confirm it is NOT the current model).

### Tertiary (LOW confidence)
- No authoritative source located for **WebGL-in-iframe on mobile** in Devvit posts — flagged A1/OQ1, spike-gated.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm; APIs from current official docs.
- Architecture / patterns: HIGH — every server capability (triggers/scheduler/settings/redis/fetch) confirmed against official docs and aligned with the existing scaffold.
- Conflict normalization (D-02): MEDIUM — inputs/intent locked; the curve is a discretion choice (keep pure + unit-tested).
- WebGL-in-iframe on mobile: LOW — unverified; Wave-0 spike required.
- Trigger payload field nesting: MEDIUM — verify against a real playtest payload.

**Research date:** 2026-06-20
**Valid until:** 2026-07-04 (Devvit moves fast — re-verify the `devvit.json` schema + scheduler/settings API if planning slips past ~2 weeks; `0.13.5-next` already exists)

Sources:
- [Devvit Web configuration](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration)
- [Server triggers](https://developers.reddit.com/docs/capabilities/server/triggers)
- [Server scheduler](https://developers.reddit.com/docs/capabilities/server/scheduler)
- [Settings and secrets](https://developers.reddit.com/docs/capabilities/server/settings-and-secrets)
- [Redis](https://developers.reddit.com/docs/capabilities/server/redis)
- [Client HTTP fetch](https://developers.reddit.com/docs/capabilities/http-fetch)
- [Migrate to public API (Devvit Web)](https://developers.reddit.com/docs/guides/migrate/public-api)
- [Phaser (Reddit games target)](https://github.com/phaserjs/phaser)
- [devvit-webview-react (old postMessage pattern, for contrast)](https://github.com/mwood23/devvit-webview-react)

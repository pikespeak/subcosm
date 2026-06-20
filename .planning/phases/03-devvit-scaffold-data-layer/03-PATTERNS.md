# Phase 3: Devvit Scaffold + Data Layer - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 17 (new + modified)
**Analogs found:** 15 / 17

All analogs are first-party in this repo. The two write paths (triggers, tick) and one read path (client fetch → `render()`) all reuse existing scaffold idioms: the Hono-router-per-file pattern (`src/server/routes/*.ts`), the `@devvit/web/server` `{ context, redis, reddit }` import (`api.ts`), the `DayVectorSchema` Zod-boundary (`generator.ts`), and the `render()` mount wiring (`cosmos-dev/main.ts`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/routes/triggers.ts` (extend) | route/controller | event-driven | `src/server/routes/triggers.ts` (own `on-app-install`) + `src/server/routes/api.ts` (`redis.incrBy`) | exact |
| `src/server/routes/api.ts` (extend: `GET /organism`) | route/controller | request-response | `src/server/routes/api.ts` `/init` | exact |
| `src/server/routes/scheduler.ts` (NEW) | route/controller | event-driven / batch | `src/server/routes/triggers.ts` (router + Zod-parse body) | role-match |
| `src/server/routes/settings.ts` (NEW) | route/controller | request-response | `src/server/routes/forms.ts` (validation endpoint) | role-match |
| `src/server/core/redisKeys.ts` (NEW) | utility | — | (no analog — trivial pure key-builder) | none |
| `src/server/core/ring.ts` (NEW) | service | CRUD (Redis read/write) | `src/server/routes/api.ts` (`redis.get`/`incrBy`) + `src/sim/generator.ts` (`.parse()` boundary) | role-match |
| `src/server/core/tick.ts` (NEW) | service | transform / batch | `src/sim/generator.ts` (DayVector build + parse + seeded RNG) | role-match |
| `src/server/core/conflict.ts` (NEW) | utility | transform (pure) | `src/sim/generator.ts` helpers (`clamp01`, `jittered`) | role-match |
| `src/server/core/post.ts` (maybe modify) | service | — | `src/server/core/post.ts` (own) | exact |
| `src/server/index.ts` (extend mounts) | config/wiring | — | `src/server/index.ts` (own) | exact |
| `src/server/contracts/triggers.ts` (NEW) | model/schema | — | `src/engine/contracts/DayVector.ts` (Zod + z.infer) | role-match |
| `src/server/contracts/settings.ts` (NEW) | model/schema | — | `src/engine/contracts/DayVector.ts` | role-match |
| `src/server/contracts/tickJob.ts` (NEW) | model/schema | — | `src/engine/contracts/DayVector.ts` | role-match |
| `src/engine/contracts/*` RingRecord schema (NEW or in DayVector.ts) | model/schema | — | `src/engine/contracts/DayVector.ts` (`DayVectorSchema` already carries `seed`) | exact |
| `src/shared/api.ts` (extend: `OrganismResponse`) | model/schema | — | `src/shared/api.ts` (`InitResponse`) — but MUST become `z.infer`, not hand `type` | role-match |
| `src/client/game.ts` (REPLACE) | component/mount | request-response → render | `src/client/cosmos-dev/main.ts` (`generateDayVectors`→`render`) | exact (the canonical analog) |
| `devvit.json` (extend) | config | — | `devvit.json` (own; add triggers/scheduler/settings) | exact |

## Pattern Assignments

### `src/server/routes/triggers.ts` (route, event-driven) — DEV-02/03

**Analog:** own `on-app-install` handler (router idiom) + `api.ts` `redis.incrBy`.

**Router + import pattern** (`triggers.ts` lines 1-8 / `api.ts` lines 1-2):
```typescript
import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
export const triggers = new Hono();
```

**Handler shape to copy** — each new handler mirrors the existing `triggers.post('/on-app-install', async (c) => { try { … } catch { c.json<TriggerResponse>({status:'error'},400) } })` envelope (`triggers.ts` lines 8-30), but ADD the Zod boundary parse before any Redis write (RESEARCH Pattern 2):
```typescript
const payload = CommentCreatePayloadSchema.parse(await c.req.json()); // BOUNDARY parse
const sub = context.subredditId!;          // derive sub from context, NEVER client input (V4)
await Promise.all([
  redis.incrBy(keys.counter(sub, 'comments'), 1),   // analog: api.ts line 67 redis.incrBy('count',1)
  redis.sAdd(keys.contributors(sub, day), payload.author.id),
  redis.zIncrBy(keys.threads(sub, day), payload.post.id, 1),
]);
return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
```

**Declare in `devvit.json`** alongside the existing `onAppInstall` key (devvit.json lines 41-43): add `onPostCreate` / `onCommentCreate` → `/internal/triggers/...`.

---

### `src/server/routes/api.ts` — `GET /organism` (route, request-response) — D-01

**Analog:** the same file's `/init` handler (lines 16-53).

**Copy verbatim:** the `const { postId/subredditId } = context;` guard + `c.json<ErrorResponse>({ status:'error', message }, 400)` early-return (lines 17-28), and the `try/catch` with `console.error` + typed-response envelope (lines 30-52). Replace `redis.get('count')` with `readAllRings(sub)` (RESEARCH Code Examples / Pattern 3). Derive `sub` from `context.subredditId`, never client input (V4). Response type is `OrganismResponse` (`z.infer`, see shared/api.ts below).

---

### `src/server/routes/scheduler.ts` (NEW route, event-driven) — DEV-04

**Analog:** `triggers.ts` router idiom + the body-parse boundary.

**Pattern** (RESEARCH Pattern 4): a Hono router with a `/sweeper` (hourly cron) and a `/tick` (one-off `runJob`) handler. Body Zod-parsed (`TickJobSchema.parse(data)`), then delegate to `core/tick.ts`. Import `{ scheduler, redis }` from `@devvit/web/server` (same import surface as `api.ts` line 2). Mount under `internal.route('/scheduler', scheduler)` in `index.ts` (mirroring lines 12-14). Declare `scheduler.tasks` in `devvit.json`.

**Local-midnight check** lives as a PURE helper (RESEARCH Pattern 5, `Intl.DateTimeFormat`) — unit-testable, no Devvit import. Idempotency guard on stored `lastTickDay` (Pitfall 5 / OQ3).

---

### `src/server/routes/settings.ts` (NEW route, request-response) — DEV-06

**Analog:** `forms.ts` (lines 8-22) — a Hono router whose POST reads `await c.req.json()` and returns a typed response.

**Difference:** the `validationEndpoint` returns an i18n error key (CLAUDE.md §7), e.g. `error.settings.timezone.invalidIana`, by attempting `new Intl.DateTimeFormat('en',{timeZone:value})` in try/catch (RESEARCH Pattern 5 footnote). Server-side reads use `settings.get` + `SettingsSchema.parse` (RESEARCH Pattern 6).

---

### `src/server/core/ring.ts` (NEW service, CRUD) — DEV-05

**Analogs:** `api.ts` Redis calls (`redis.get` line 32, `redis.incrBy` line 67) + `generator.ts` `.parse()` boundary (line 137).

**Pattern** (RESEARCH Pattern 3): `writeRing` does `redis.incrBy(keys.ringCount(sub),1)` then `redis.hSet(keys.ring(sub,n), serializeScalars(ring))`. `readAllRings` reads the count, `Promise.all` over `redis.hGetAll`, then `raws.map(r => RingRecordSchema.parse(deserializeScalars(r)))` — the SINGLE Redis-read boundary parse (mirrors `generator.ts` line 137 being the single sim boundary). No `redis.keys`/scan (Pitfall 4). Store ~25 scalars + seed only — never pixels.

---

### `src/server/core/tick.ts` + `conflict.ts` (NEW services, transform) — DEV-03/04

**Analog:** `src/sim/generator.ts` — it builds a `DayVector` from proxies, dices with the engine's seeded `mulberry32`, clamps with `clamp01`/`clampSigned` (lines 57-58, 85-86), and parses at the boundary.

**Copy these idioms:**
- Seeded determinism — reuse `mulberry32` + an FNV-1a `hash(subId, day, genomeVersion)`; NEVER `Math.random()` server-side for game state (generator.ts lines 15, 44-48; CLAUDE.md determinism rule). `seed = hash(subId, day, genomeVersion)` (DayVector.ts line 36 comment).
- `clamp01`/`clampSigned` helpers (generator.ts lines 57-58) for the `conflict` composite output 0..1.
- `conflict.ts` must be a PURE, unit-tested function (RESEARCH Don't Hand-Roll): `replyRatio = replies/max(comments,1)`, `heat = comments/max(posts,1)`, each saturated via `x/(x+k)`, weighted blend, clamp [0,1].
- The tick BUILDS a `DayVector`-shaped record then `RingRecordSchema.parse(raw)` before `writeRing` (mirrors generator.ts line 137).

---

### `src/client/game.ts` (REPLACE component/mount) — DEV-01 / S2

**Analog (canonical):** `src/client/cosmos-dev/main.ts` — mirror it, but source DayVectors from `fetch('/api/organism')` instead of `generateDayVectors`.

**Reuse verbatim from `main.ts`:**
- Phaser config block (lines 75-89): `type: AUTO`, DPR cap at 2, `Scale.RESIZE`, `backgroundColor:'#04030a'`, `parent` = the stage id.
- The mount sequence (lines 167-170): `game = new Game(config); painter = new PhaserPainter(game); handle = render(days, genome, style, painter);` — `render()` is the single orchestration seam, NEVER call synthesis directly.
- `frontierFirst()` reversal (lines 67-70): synthesis wants newest day at index 0.
- `PRESETS` map (lines 37-45) for resolving the settings `genome`/`style` ids → `{ genome, style }`.
- `teardown()` discipline (lines 150-157) if re-rendering.

**Replace, do not copy:** `frontierFirst(seed)` → fetch Ring records, `safeParse` the envelope (UI boundary — CLAUDE.md §6, never throw; RESEARCH Pattern 1 lines 208-220), branch to cold-start (`rings.length === 0` → genesis-core-only, D-04 / UI-SPEC S3) or error overlay (muted ink, no alarm-red). Drop the dev control harness (scrubber/nudges/seed/regenerate) — Phase 3 post is read-only render + HUD (UI-SPEC S2 note). Delete the boilerplate Boot/Preloader/MainMenu/Game/GameOver scenes + the `#028af8` blue config (current game.ts lines 1-32).

---

### Schemas: `src/server/contracts/{triggers,settings,tickJob}.ts` + RingRecord (NEW models)

**Analog:** `src/engine/contracts/DayVector.ts` (lines 7-42) — the canonical Zod-as-source-of-truth idiom.

**Copy the idiom exactly:** `export const XSchema = z.object({…}); export type X = z.infer<typeof XSchema>;` — NO hand-written `interface`/`type` for schema-covered shapes (CLAUDE.md §1/§9). Trigger schemas use `.passthrough()` to tolerate extra platform fields (RESEARCH Code Examples lines 471-476; A2). **RingRecord = `DayVectorSchema` + `seed` + `genomeVersion`** — `DayVectorSchema` already carries `seed` (DayVector.ts line 36), so reuse/extend it rather than redefining; this guarantees no drift from what `render()` consumes (Pitfall 6).

---

### `src/shared/api.ts` (extend) — `OrganismResponse`

**Analog:** the file's existing `InitResponse` (lines 1-6) — BUT it is a hand-written `type`. The new `OrganismResponse` MUST be `z.infer<typeof OrganismResponseSchema>` (CLAUDE.md §1) so the client `safeParse` and server response share one schema. Do not add another hand `type`.

## Shared Patterns

### Zod boundary parse (the phase's core control — V5)
**Source:** `src/sim/generator.ts` line 137 (`DayVectorSchema.parse(raw)`) + `src/engine/contracts/DayVector.ts`.
**Apply to:** every trigger handler (`.parse(await c.req.json())`), `readAllRings` (Redis read), scheduler `/tick` (`TickJobSchema.parse(data)`), settings reads (`SettingsSchema.parse`). Server uses `.parse()`; the client `game.ts` uses `.safeParse()` and never throws (CLAUDE.md §6). NEVER parse inside synthesis/paint/the rAF loop (Pitfall 6).

### `@devvit/web/server` capability import
**Source:** `src/server/routes/api.ts` line 2 — `import { context, redis, reddit } from '@devvit/web/server';`
**Apply to:** all new server handlers; add `settings`, `scheduler` from the same module. `src/engine/` stays Devvit-free (no `@devvit/*` imports there).

### Hono router-per-file + `index.ts` mount
**Source:** `src/server/routes/{api,triggers,menu,forms}.ts` (`export const x = new Hono()`) + `src/server/index.ts` lines 12-17 (`internal.route('/triggers', triggers)`).
**Apply to:** new `scheduler.ts`, `settings.ts` → add `internal.route('/scheduler', scheduler)` + `internal.route('/settings', settings)`.

### Context-derived subreddit (access control — V4)
**Source:** `api.ts` lines 17, 31 (`const { postId } = context; reddit.getCurrentUsername()`).
**Apply to:** every Redis key — derive `sub` from `context.subredditId`, NEVER from client-supplied input (prevents cross-community spoofing).

### Determinism / seeded RNG
**Source:** `src/sim/generator.ts` lines 15, 44-48 (`mulberry32`, `perDaySeed`).
**Apply to:** `tick.ts` seed = `hash(subId, day, genomeVersion)`; reuse the engine's `mulberry32` — never `Math.random()` for game state (CLAUDE.md determinism hard rule).

### i18n error keys
**Source:** UI-SPEC Copywriting Contract (every string is a key).
**Apply to:** `settings.ts` validation responses + all `game.ts` overlay copy (`state.loading`, `state.coldstart.*`, `state.error`, `error.settings.*`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/server/core/redisKeys.ts` | utility | — | Trivial pure key-builder; no existing equivalent (keys were ad-hoc string `'count'`). Define cleanly; forward-compatible with Phase 4. |
| `Intl.DateTimeFormat` local-midnight helper (in `tick.ts`) | utility | transform | No TZ code exists yet; native `Intl` per RESEARCH Pattern 5 (don't hand-roll DST). |

## Metadata

**Analog search scope:** `src/server/**`, `src/client/**`, `src/engine/contracts/**`, `src/sim/**`, `src/shared/**`, `devvit.json`
**Files scanned:** 14 read in full
**Pattern extraction date:** 2026-06-20

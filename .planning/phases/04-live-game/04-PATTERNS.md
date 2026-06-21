# Phase 4: Live Game - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 14 (5 new, 9 modified)
**Analogs found:** 14 / 14 (every new/modified file has a same-repo analog — Phase 4 is additive)

This phase introduces NO new architectural shapes. Every file copies an existing repo pattern:
the steer endpoint copies `/increment`; the steer Redis core copies `ring.ts`/`tick.ts`; the
reveal post copies `createPost`; the scorer copies the pure-engine `synthesis.ts` discipline;
the realtime client copies the `loadCosmos` fetch+safeParse flow in `game.ts`; the reward glyph
copies the per-element paint loop in `paint.ts`. Prefer the in-repo analog over RESEARCH snippets.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engine/contracts/Outcome.ts` (NEW) | model/contract | transform | `src/engine/contracts/Personal.ts` | exact (sibling contract) |
| `src/engine/contracts/DayVector.ts` (MOD) | model/contract | transform | self (firm `outcome` field, line 40) | self-edit |
| `src/engine/contracts/Scene.ts` (MOD) | model/contract | transform | self (firm `goalAchieved`, line 64) | self-edit |
| `src/engine/score.ts` (NEW) | service (pure) | transform | `src/engine/synthesis.ts` (`starCount`, line 85) | role+flow match |
| `src/engine/synthesis.ts` (MOD) | service (pure) | transform | self (export `starCount`/arms derivation) | self-edit |
| `src/server/core/steer.ts` (NEW) | service (Redis core) | event-driven (aggregate) | `src/server/core/ring.ts` + `tick.ts` Redis idioms | role match |
| `src/server/core/redisKeys.ts` (MOD) | utility (pure) | — | self (add `steer`/`budget`/`revealDone` keys) | self-edit |
| `src/server/core/tick.ts` (MOD) | service (orchestrator) | batch | self (extend `runTick`, line 80) | self-edit |
| `src/server/core/post.ts` (MOD) | service | request-response | self (`createPost`) + `menu.ts` | self-edit |
| `src/server/routes/api.ts` (MOD) | route/controller | request-response | self (`/increment` handler, line 111) | self-edit |
| `src/shared/api.ts` (MOD) | model/contract (shared) | request-response | self (`OrganismResponseSchema`, line 58) | self-edit |
| `src/client/game.ts` (MOD) | client mount | event-driven + request-response | self (`loadCosmos`, line 152) | self-edit |
| `src/client/cosmos/PhaserPainter.ts` / `paint.ts` (MOD) | component (paint) | transform | `paint.ts` per-element loop (line 194) | role match |
| `src/client/cosmos/hud.ts` (NEW) | component (UI) | request-response | `game.ts` `setOverlay` (line 97) | role match |

## Pattern Assignments

### `src/engine/contracts/Outcome.ts` (NEW — contract, transform)

**Analog:** `src/engine/contracts/Personal.ts` (sibling pure-zod contract) + the RESEARCH snippet.

Copy the file-header + schema-first discipline from `Personal.ts` lines 1-19: doc comment
explaining boundary role, `z.infer` only (no hand interface), i18n error keys. Shape per D-02 /
RESEARCH "Firm the Outcome contract":

```ts
import { z } from 'zod';
import { DailyGoalSchema } from './Genome';

export const OutcomeSchema = z.object({
  goal: DailyGoalSchema,             // resolved goal (type/targetParam/threshold/direction)
  measured: z.number(),              // derived metric at freeze
  achieved: z.boolean(),
  degree: z.number().min(0).max(1),  // normalized distance to threshold (both directions)
});
export type Outcome = z.infer<typeof OutcomeSchema>;
```

Export from `src/engine/contracts/index.ts` alongside the other contracts (barrel — check the
existing export list there).

**DayVector firm** (`DayVector.ts` line 40, replace the `z.unknown().optional()` placeholder):
```ts
import { OutcomeSchema } from './Outcome';
// ...
  outcome: OutcomeSchema.optional(),   // frozen rings carry it; live frontier may omit
```
**Scene firm** (`Scene.ts` line 64 — `goalAchieved` already `z.boolean().nullable()`): keep the
type; the per-shell wiring is paint-side (see reward glyph). Note the contracts test asserts NO
per-user fields on `Scene` (line 8-9 doc) — `Outcome` carries only community-shared scoring, so
it is safe on `DayVector`/Ring, NOT `ActionBudget`.

---

### `src/engine/score.ts` (NEW — pure service, transform)

**Analog:** `src/engine/synthesis.ts` — copy its purity discipline AND re-use its math.

`synthesis.ts` line 85 already has the exact `starCount(posts, density)` derivation (`STAR_FLOOR=18`,
cap `112`, line 67/88) and the arms derivation (line 232-240). These are currently module-private —
**export them** (Step: change `function starCount` → `export function starCount`; extract the inline
arms expression into an exported `deriveArms(day, genome)` helper). The scorer MUST re-use these, not
re-derive (RESEARCH "Don't Hand-Roll": a second formula = determinism drift / LIVE-03).

Purity rules to copy verbatim from `synthesis.ts` (and CLAUDE.md): no `Math.random`, no Devvit import,
no I/O — only `DayVector`/`Genome`/`Outcome` types. The eslint `no-restricted-imports` guard (cited in
`render.ts` line 6-8) already enforces no `*/client/*` or phaser under `src/engine/`.

Measure per `targetParam` (RESEARCH Pattern 3):
- `conflict` → `day.conflict` (direct field, 0..1)
- `density` → normalize `starCount(day.posts, genome.baseVar.density ?? 0.3)` over `(112-18)` floor..cap
- `symmetry` → `deriveArms(day, genome)` integer arm count

Then `achieved = direction==='above' ? measured > threshold : measured < threshold` and the `degree`
formula from RESEARCH lines 441-445 (clamp01 of signed distance / per-goal scale). **Open Question 1
(achievability test) is unresolved** — the planner MUST add a unit test feeding the simulator's
busy/quiet/drama/AMA beat days and tune the normalization (not the genome thresholds) until each goal
is reachable-but-not-automatic.

---

### `src/server/core/steer.ts` (NEW — Redis service, event-driven aggregation)

**Analog:** `src/server/core/ring.ts` (Redis service shape) + `tick.ts` (the `redis.incrBy`/`Promise.all`
idioms). No engine import (it has I/O). `sub`/`userId` come from trusted `context` server-side (V4).

Copy the import + key-builder usage from `ring.ts` line 19-21 (`import { redis } from '@devvit/web/server'`,
`import { keys } from './redisKeys'`). Budget gate + aggregation per RESEARCH Pattern 4/5 — note `incrBy`
is already the in-repo atomic-counter idiom (`ring.ts` line 75 `redis.incrBy(keys.ringCount(sub), 1)`):

```ts
// budget gate FIRST (incrBy-then-compare is race-free — RESEARCH Pitfall 4)
const cap = genome.actionCap;                                  // default 3
const used = await redis.incrBy(keys.budget(sub, day, userId), 1);
if (used > cap) return { remaining: 0, accepted: false };      // do NOT aggregate
// aggregate (hIncrBy SUMS — never overwrite; concurrent users accumulate)
await redis.hIncrBy(keys.steer(sub, day), param, amount);
await redis.hIncrBy(keys.steer(sub, day), 'count', 1);
return { remaining: cap - used, accepted: true };
```

Realtime broadcast lives here too (server-only sender): `import { realtime } from '@devvit/web/server'`
then `await realtime.send(channel, { branch, symmetry, hue, count })` (RESEARCH Pattern 1, msg = JSONValue).

**redisKeys additions** (`redisKeys.ts` — copy the existing builder style, lines 40-66; NOTE Redis keys
DO use `:` — the colon ban is realtime-channel-only):
```ts
steer(sub, day)            { return `${ns(sub)}:steer:${day}`; },
budget(sub, day, userId)   { return `${ns(sub)}:budget:${day}:${userId}`; },
revealDone(sub, day)       { return `${ns(sub)}:revealDone:${day}`; },   // exactly-once reveal guard
```
Also update the schema doc-comment block at top of `redisKeys.ts` (lines 14-22) to list the new keys.

---

### `src/server/core/tick.ts` (MOD — orchestrator, extend `runTick`)

**Analog:** self. The freeze path (line 80-154) already has the idempotency guard (line 83-84), the
`Promise.all` accumulator read (line 91), the genome resolve (`resolveGenomeVersion`, line 68 — gives
you the `Genome` for scoring + cap), and the single `RingRecordSchema.parse` build boundary (line 124).

Extend in-place, preserving order (RESEARCH "Overnight Tick" diagram + Open Question 3):
1. After reading accumulators, also read the steer hash (`redis.hGetAll(keys.steer(subId, day))`),
   compute per-param `mean = sum/count`, and fold into `DayVector.steering` BEFORE the parse (line 136
   currently hardcodes `{ branch:0, symmetry:0, hue:0 }`). Apply `steerGain` ONCE here.
2. Resolve the full genome (not just version) so you can call the scorer + get `dailyGoal`.
3. `const outcome = score(dayVector, genome);` (pure) → add `outcome` to the parsed record (line 124 object).
4. After `writeRing` (line 141): gate reveal-post creation on `revealDone` (set-if-not-exists, RESEARCH
   Pitfall 3 / OQ2 — confirm `redis.set(key, val, { nx:true })` shape on-device), then
   `await createRevealPost(subredditName, n)`.
5. Add `keys.steer(subId, day)` to the `redis.del(...)` reset (line 146-152), mirroring the counter reset.

**ring.ts round-trip fix** (RESEARCH Pitfall 5, MANDATORY): `JSON_FIELDS` (`ring.ts` line 31) currently
= `['topThreads', 'steering']`. Add `'outcome'`. The serializer (line 40-41) already JSON-stringifies
objects and skips `undefined` (line 39), but `deserializeScalars` (line 55-63) only `JSON.parse`s
`JSON_FIELDS` — without the addition `outcome` hits the `Number(value)` branch → NaN → parse fails.

---

### `src/server/core/post.ts` (MOD — add `createRevealPost`) + `routes/menu.ts` reference

**Analog:** self (`createPost`, line 3-7) shows the `reddit.submitCustomPost({ title })` call; `menu.ts`
line 8-27 shows the route-level try/catch + `context.subredditName` usage. Extend per RESEARCH "Reveal post":
```ts
import { reddit } from '@devvit/web/server';
export async function createRevealPost(subredditName: string, ringIndex: number): Promise<void> {
  const post = await reddit.submitCustomPost({
    subredditName,
    title: `subcosm — day ${ringIndex} revealed`,
    entry: 'game',                 // reuse existing game.html entrypoint — no new entrypoint
    postData: { ringIndex },       // ≤2KB; tells the webview which ring to celebrate
  });
  await post.sticky();             // pin within ~1 min of the tick (LIVE-02)
}
```
Called from `tick.ts`, NOT a menu route (creation happens in the scheduler job, not a user action).

---

### `src/server/routes/api.ts` (MOD — add `POST /steer`, extend `GET /organism`)

**Analog:** self. Copy the `/increment` handler shape (line 111-129): `const { ... } = context`
guard → 400 with i18n key on missing context → `redis` call → typed `c.json` response. Copy the V5
boundary discipline from `/organism` (line 33-70): trusted ids from `context` ONLY, `.parse()` the
envelope on the way out.

New `POST /steer` (RESEARCH Security V4/V5):
```ts
api.post('/steer', async (c) => {
  const { subredditId, userId, postId } = context;     // trusted — never client body (V4)
  if (!subredditId || !userId) return c.json<ErrorResponse>({ status:'error', message:'error.api.noSub' }, 400);
  const body = SteerRequestSchema.parse(await c.req.json());  // UNSAFE input → .parse() at boundary (V5)
  // ... resolve genome+day, call steer.ts (budget gate + aggregate + broadcast)
  return c.json(SteerResponseSchema.parse({ type:'steer', remaining, accepted }), 200);
});
```
`amount` must be range-clamped in `SteerRequestSchema` (RESEARCH Security: hostile client bias).
Extend `GET /organism` to also return the live steer aggregate + each ring's `outcome` (rings already
carry it once `DayVector.outcome` is firmed — `OrganismResponseSchema.rings` reuses `RingRecordSchema`).

---

### `src/shared/api.ts` (MOD — add Steer schemas, client-safe)

**Analog:** self (`OrganismResponseSchema` + `GenomeIdEnum`, lines 47-66). CRITICAL bundle-safety rule
(file header line 4-9): import ONLY zod + engine contracts, NEVER a server module. Add:
```ts
export const SteerRequestSchema = z.object({
  param: z.enum(['branch', 'symmetry', 'hue']),
  amount: z.number().min(-1).max(1),          // clamped — hostile-bias guard
});
export const SteerResponseSchema = z.object({
  type: z.literal('steer'),
  remaining: z.number().int().nonnegative(),
  accepted: z.boolean(),
});
export type SteerRequest = z.infer<typeof SteerRequestSchema>;   // z.infer only — no hand interface
export type SteerResponse = z.infer<typeof SteerResponseSchema>;
```
Also extend `OrganismResponseSchema` (line 58) with the live steer aggregate field.

---

### `src/client/game.ts` (MOD — realtime subscribe + nudge fetch + HUD)

**Analog:** self. Copy `loadCosmos` (line 152-178): same-origin `fetch` → `safeParse` at UI boundary →
overlay/error routing, NEVER throw on bad payload (line 157-168). The nudge is the same pattern
inverted (POST):
```ts
const res = await fetch('/api/steer', { method:'POST', body: JSON.stringify({ param, amount }) });
const parsed = SteerResponseSchema.safeParse(await res.json());   // safeParse, NOT parse (UI boundary)
if (parsed.success) { updateBudget(parsed.data.remaining); handle?.nudge(param, amount); } // local re-synth immediately
```
Realtime subscribe (RESEARCH Pattern 1 — `connectRealtime` is SYNCHRONOUS, do NOT await):
```ts
import { connectRealtime, context } from '@devvit/web/client';
const channel = steerChannel(context.postId);     // colon-free helper (RESEARCH Pattern 2)
connectRealtime<SteerMsg>({ channel, onMessage: (steer) => {
  const m = SteerMsgSchema.safeParse(steer);       // safeParse hostile realtime payload + clamp
  if (m.success) { applyAggregatedSteer(m.data); updateHud(); }   // handle.nudge(param, meanΔ × steerGain)
}});
```
The acting user ALSO nudges locally immediately (no round-trip wait, D-04). `handle.nudge()` already
exists (`render.ts` line 122-153 — biases the frontier MEAN × steerGain, re-synths shells[0] only).
Tear down with `disconnectRealtime(channel)` in `teardown()` (line 113); `Connection.disconnect()` is
deprecated. Build `D-03b fallback first` (RESEARCH Pitfall 1): steer hash via `/api/organism` is the
source of truth; realtime is a pure enhancement.

**Channel-name helper** (NEW shared, RESEARCH Pattern 2 — client AND server build the same name):
```ts
export const steerChannel = (postId: string) =>
  `subcosm-steer-${postId}`.replace(/[^A-Za-z0-9_-]/g, '-');   // NO colons (LIVE-01)
```
**D-03a UNRESOLVED:** realtime-in-mobile-webview must be verified on `devvit playtest` (mirrors the
Phase-3 WebGL risk). API existence is HIGH confidence; mobile behaviour MEDIUM until the on-device spike.

---

### Reward glyph — `src/client/cosmos/paint.ts` + `PhaserPainter.ts` (MOD — paint, transform)

**Analog:** `paint.ts` per-element loop (line 194 `for (const el of shell.elements)`). The glyph is
**paint-only, deterministic, no new rng** (D-06 / GAME-04 / LIVE-03 / RESEARCH Anti-Patterns line 333).
Wire `Scene.goalAchieved` per-shell from the ring's `outcome.achieved`, then in the shell paint:
```ts
if (shell.goalAchievedForDay) {              // resolved from the ring's outcome.achieved (no rng)
  const brightest = shell.elements.reduce((a, b) => b.energy > a.energy ? b : a);  // stable index
  paintRewardAccent(brightest, REWARD_HUE);  // brighter, distinctly-hued accent on a deterministic element
}
```
Copy the existing color-ramp helper `hueToColor(ramp, hue)` (`paint.ts` line 72) for the accent hue so
it stays within the techno style. Frozen shells are bake-cached — the glyph bakes once with the shell;
`render().nudge()` never touches history (`render.ts` line 116-121).

---

### `src/client/cosmos/hud.ts` (NEW — tracking readout, GAME-03)

**Analog:** `game.ts` `setOverlay` (line 97-107) — DOM-toggle pattern, copy lives behind i18n keys in
the HTML, JS only toggles/updates values (never injects language text, line 92-94). The HUD reads the
SAME pure metric the scorer uses (re-compute the `targetParam` measure from the re-synth'd frontier
after each nudge): "conflict 0.32 / goal <0.40 ✓ on track". HUD copy + all i18n keys are Claude's
discretion (D-07 / CONTEXT line 118).

## Shared Patterns

### Trusted-context identity (V4)
**Source:** `api.ts` line 34 (`const { subredditId } = context`), `tick.ts` line 24 doc, `ring.ts` line 17-18.
**Apply to:** `steer.ts`, the `/steer` route, all new Redis keys.
`sub`=`context.subredditId`, `userId`=`context.userId` server-side ONLY. The only client input to
`/steer` is `param`+`amount` (and that is `.parse()`d). NEVER trust ids from the request body.

### Zod at boundaries
**Source:** `api.ts` line 55 (`.parse()` out), `game.ts` line 157 (`safeParse` UI), `ring.ts` line 96 (read boundary), `tick.ts` line 124 (build boundary).
**Apply to:** every new boundary. Server endpoints + tick: `.parse()`. Client UI + realtime `onMessage`: `.safeParse()` + return structured/overlay errors, never throw. `z.infer` only — no duplicate interfaces, no `as`.

### Pure-engine determinism
**Source:** `synthesis.ts` (no rng outside seeded stream), `tick.ts` line 49-58 (FNV-1a seed), `render.ts` line 6-8 (eslint no-restricted-imports under `src/engine/`).
**Apply to:** `score.ts`, `Outcome.ts`. No `Math.random`, no Devvit import, no I/O. Scoring + reward are pure functions of the Ring record so a second client renders identically (LIVE-03 / D-09).

### Central Redis key builder
**Source:** `redisKeys.ts` (whole module — pure string builder, no I/O).
**Apply to:** every new key (`steer`/`budget`/`revealDone`). NEVER inline a key string in `steer.ts`/`tick.ts`. Redis keys use `:`; realtime channel names must NOT (LIVE-01).

### Atomic Redis counters (no read-modify-write)
**Source:** `ring.ts` line 75 (`redis.incrBy(keys.ringCount(sub), 1)`), `api.ts` line 123.
**Apply to:** budget gate (`incrBy`-then-compare) and steer aggregation (`hIncrBy` SUMS). Never read-modify-write a JSON blob (lost updates under concurrency).

## No Analog Found

None. Every Phase-4 surface maps to an existing repo pattern (the phase is additive). The two pieces
with the THINNEST in-repo precedent — both Devvit-Web platform calls, not new logic:

| File/Concern | Role | Data Flow | Note |
|------|------|-----------|------|
| `connectRealtime`/`realtime.send` (in `game.ts`/`steer.ts`) | event-driven | pub-sub | No prior realtime use in the repo. API verified against installed SDK type defs (RESEARCH Standard Stack). On-device feasibility (D-03a) UNVERIFIED — mirror Phase-3 UAT. Use RESEARCH Pattern 1 directly. |
| `reddit.submitCustomPost({ entry, postData })` + `post.sticky()` | service | request-response | `createPost` (post.ts) only uses `{ title }`; `entry`/`postData`/`sticky` are new args/methods — verified on `Post.d.ts` (RESEARCH). |

## Metadata

**Analog search scope:** `src/server/{core,routes}`, `src/engine/{contracts,genomes}`, `src/engine/{render,synthesis}.ts`, `src/shared`, `src/client/{game.ts,cosmos}`.
**Files scanned:** 18 read/grepped.
**Pattern extraction date:** 2026-06-21

**Unresolved (carry to planner — from RESEARCH Open Questions):**
- OQ1: density/symmetry normalization in `score.ts` — needs an achievability unit test (beat days).
- OQ2: exact-once reveal guard primitive (`redis.set` nx option) — confirm on-device.
- OQ3: single application of `steerGain` when folding the steer aggregate into the frozen DayVector.
- D-03a: realtime in mobile webview — on-device `devvit playtest` spike; D-03b fallback locked.

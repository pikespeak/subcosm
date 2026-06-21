# Phase 4: Live Game - Research

**Researched:** 2026-06-21
**Domain:** Devvit Web realtime + scheduler-created posts; deterministic goal scoring; Redis steer-hash aggregation; paint-only reward glyph
**Confidence:** HIGH (the #1 realtime risk is RESOLVED — the API exists in the installed SDK and is fit for purpose)

## Summary

Phase 4 closes the retention loop on top of the verified Phase-3 data layer. The five gray
areas the plan hinges on are all resolvable with the **already-installed** `@devvit/web@0.13.4`
SDK — no new dependencies, no contract rewrites, only typed extensions of `outcome`, a new
steer-hash Redis key, a steer endpoint, and additions to the existing idempotent `runTick`.

**The #1 risk (D-03a) is resolved.** `@devvit/web` ships realtime in the *Devvit Web* client/server
shape the project already uses (same-origin `fetch`, no Blocks): the **post webview** subscribes
with `connectRealtime({ channel, onMessage })` from `@devvit/web/client`, and the **server**
broadcasts with `realtime.send(channel, msg)` from `@devvit/web/server`. This is verified directly
against the installed type definitions (`node_modules/@devvit/realtime/{client,server}/*.d.ts`),
whose own JSDoc example uses `channel: context.postId` — confirming both per-post channels and the
"broadcast aggregated state → all viewers re-synth" model (D-03). The locked fallback (D-03b,
acting-user-local + others-on-reload) remains a *small swap* because the steer hash is the source of
truth either way — but research did not find a reason to default to it.

The reveal post (LIVE-02) is a normal `reddit.submitCustomPost({ entry: 'game', ... })` from inside
the scheduler tick, then `post.sticky()` to pin it; both are on the installed `reddit` client and run
well within the ~1 min budget. Deterministic scoring (GAME-02) needs one careful move: `conflict` is a
direct DayVector field, but `density` and `symmetry` are **synthesis outputs**, not DayVector fields —
so the scored metric must be a **pure derivation re-using the engine's own synthesis math** (the same
`starCount`/`arms` formulas), computed engine-side from the frozen RingRecord so it is byte-identical
on any client.

**Primary recommendation:** Add a pure `score(ring, genome) → Outcome` engine module that re-uses
synthesis's `starCount`/`arms` derivations; firm `DayVector.outcome` to a typed Zod object; add an
`organism:{sub}:steer:{day}` Redis HASH aggregated via `hIncrBy`; gate nudges with an atomic
`actionsUsed` increment in a per-user `budget:{sub}:{day}:{userId}` key; broadcast the aggregated
steer over a per-post realtime channel named from `context.postId` (underscore-safe, colon-free); and
render the reward glyph paint-only from `outcome.achieved` on the frozen shell.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Goal scoring (achieved/degree) | Engine (pure `src/engine/score.ts`) | Server core (tick calls it) | Must be reproducible byte-identically on any client (LIVE-03) → pure, no I/O, no Devvit (CLAUDE.md). Client can re-derive identically. |
| Steer-hash aggregation | Server core (Redis) | — | Shared community state; concurrency-safe via Redis atomic ops. Not engine (has I/O). |
| ActionBudget enforcement | Server route (nudge endpoint) | Personal layer (Redis key) | Per-user state; must stay structurally separate from `Scene` (D-04b). Atomic Redis increment. |
| Realtime broadcast | Server (`realtime.send`) | Client (`connectRealtime`) | Server-authoritative send; client subscribe-only (the SDK enforces this split). |
| Frontier re-synth on nudge | Engine `render().nudge()` | Client (Painter.repaintFrontier) | Already built; biases the mean only (I-5). |
| Reveal-post creation + pin | Server (scheduler tick) | Reddit API | Post creation is a Reddit-platform action; only the server (in a job) may call it. |
| Reward glyph render | Client paint (PhaserPainter) | Engine Scene (`goalAchieved`) | Paint-only, derived from `outcome.achieved` in the Ring record (D-06) — no new rng. |
| Tracking HUD readout | Client | Server (`/api/organism` outcome/steer) | Legibility (GAME-03); reads the same pure metric the scorer uses. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Daily goal is **fixed per genome** — each genome's single `dailyGoal` IS the goal, the same every day. Authored: Calm = `conflict below 0.4`; Chaotic = `density above 0.7`; Crystalline = `symmetry above 5`. (Variable-per-day deferred.)
- **D-01a:** `conflict` is a direct DayVector field; `density`/`symmetry` are NOT — the scored metric for each `targetParam` MUST be a **pure, deterministic derivation from the frozen DayVector** (or the Scene synthesized from it), reproducible byte-identically on any client (LIVE-03).
- **D-02:** `DayVector.outcome` (currently `z.unknown().optional()`) becomes a typed Zod schema carrying: resolved goal (`type`/`targetParam`/`threshold`/`direction`), the **actual measured value** at freeze, `achieved: boolean`, and a normalized **`degree` (0..1)**. Written into the Ring at the tick (GAME-02); `Scene.goalAchieved` mirrors `outcome.achieved`. Scoring is a **pure function** of the frozen DayVector + genome `dailyGoal` — no I/O, no rng, no Devvit. (Exact field names + degree formula = Claude's discretion.)
- **D-03:** Use a **Devvit realtime channel per community** broadcasting the **aggregated steer-hash state** (NOT each raw nudge); all open viewers re-synthesize the frontier on a channel message. The acting user ALSO re-synthesizes locally immediately. Channel names use `-`, **no colons** (LIVE-01 hard constraint).
- **D-03a (#1 RESEARCH RISK):** Realtime-channel feasibility inside the post webview on mobile must be verified early.
- **D-03b (LOCKED fallback):** If realtime proves unreliable, degrade to **acting-user-local re-synth + others-on-reload**. Plan so the fallback is a small swap, not a rewrite.
- **D-04:** A nudge is a **same-origin `fetch` POST** to a steer endpoint that (1) enforces per-user **ActionBudget** (`actionsUsed < cap`, default 3; increment atomically per `{sub}:{day}` dayKey), (2) **aggregates** the nudge into the Redis **steer hash** (sum/mean — never overwrite), (3) triggers the realtime broadcast of the new aggregate. Re-synth biases the frontier steering **MEAN only** (× `steerGain`), never dictates (I-5). NO postMessage.
- **D-04a:** When the budget is exhausted, the UI shows remaining = 0 and disables nudge controls. The endpoint returns remaining budget.
- **D-04b:** ActionBudget stays **structurally separate** from the shared `Scene`.
- **D-05:** At the tick, AFTER freezing the ring, create a **new pinned Subcosm post** (existing `createPost` infra) that **renders the just-frozen ring universe** with the same `render()` engine, plus an overlay stating the day's goal, **achieved ✓/✗**, and degree. Full **interactive** post. One reveal post per community per day, within ~1 min of the tick (LIVE-02).
- **D-06:** An achieved goal leaves a **deterministic special glyph/star** in the frozen ring — brighter, distinctly-hued accent — derived **purely from `outcome.achieved` in the Ring record (paint-only, no new rng)** (GAME-04 + LIVE-03). Scrubbing to that ring shows it permanently.
- **D-07:** The live post HUD shows the **current `targetParam` value vs the threshold + an on-track indicator** (GAME-03). After a nudge the readout updates with the re-synthesized frontier's metric. Steering still biases the mean only (I-5).
- **D-08:** Phase-3 `runTick` already freezes idempotently (`lastTickDay` watermark). Phase 4 ADDS scoring (`outcome`) + reveal-post creation + reward into the same tick path. Frozen shells never re-bake.
- **D-09:** Client and server render identically from the same Ring record; scoring + reward glyph are pure functions of the record (LIVE-03).

### Claude's Discretion
- Exact `outcome` field names + the `degree` normalization formula.
- The per-`targetParam` deterministic derivation (esp. density/symmetry from the DayVector).
- The realtime channel naming scheme (subject to the `-`/no-colon constraint).
- The reveal-post overlay layout + the glyph's exact visual treatment (within the techno style).
- HUD copy + all i18n keys.

### Deferred Ideas (OUT OF SCOPE)
- **Variable-per-day goals** — fixed-per-genome chosen for MVP (D-01); keep a hook for later.
- **Guesses as a second budgeted action** — out of Phase-4 scope.
- **Threshold scaling with community size** — not chosen; revisit if fairness becomes an issue.
- **Era-badge ring ornament** — per-star glyph chosen (D-06); whole-shell badge is later polish.
- **Per-raw-action realtime broadcast** — aggregated-state broadcast chosen (D-03); per-action deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | Live frontier fills during the day; renders nudges near-real-time; channel names use `-`, no colons; nudges aggregate into a Redis steer hash | Realtime API confirmed (`connectRealtime`/`realtime.send`); channel = sanitized `context.postId` (no colon, underscore-safe); steer hash via `hIncrBy` on `organism:{sub}:steer:{day}` (aggregates, never overwrites) — §"Realtime", §"Steer-Hash Aggregation" |
| LIVE-02 | At the tick the frontier freezes irreversibly; a pinned reveal post is created | `reddit.submitCustomPost({ entry:'game', postData })` + `post.sticky()` inside `runTick`, after `writeRing`; idempotency guard already gates double-freeze — §"Reveal Post" |
| LIVE-03 | Client and server render identically from the same Ring record (determinism across the seam) | Scoring + reward are PURE functions of the RingRecord; client re-derives the same `outcome`/glyph; no rng, no Devvit in `src/engine/` — §"Deterministic Scoring", §"Reward Glyph" |
| GAME-02 | At the tick the shell is scored against its goal deterministically; achieved ✓/✗ (+ degree) recorded on Ring + surfaced in reveal | Pure `score(ring, genome) → Outcome` re-using synthesis derivations; written into the RingRecord; mirrored to `Scene.goalAchieved` — §"Deterministic Scoring" |
| GAME-03 | Steering nudges measurably move the day toward/away from the goal; contribution→outcome link legible; biases the mean only (I-5) | `render().nudge()` already biases the frontier mean × `steerGain`; HUD reads the same pure metric the scorer uses, re-computed after each frontier re-synth — §"Tracking HUD" |
| GAME-04 | An achieved goal leaves a persistent reward on the ring, visible permanently | Paint-only glyph keyed off `outcome.achieved`/`goalAchieved` on the frozen shell; deterministic, identical on every client — §"Reward Glyph" |
| (GAME-05) | ActionBudget contract already shipped (Phase 1); Phase 4 ENFORCES it | Atomic `actionsUsed` increment in `organism:{sub}:budget:{day}:{userId}`; endpoint returns remaining; cap from `genome.actionCap` — §"ActionBudget Enforcement" |
</phase_requirements>

## Standard Stack

No new packages. Phase 4 uses only modules already in `@devvit/web@0.13.4` (installed + verified).

### Core
| Module | Import | Purpose | Why Standard |
|--------|--------|---------|--------------|
| `realtime.send` | `@devvit/web/server` | Server broadcasts aggregated steer state to a channel | The Devvit-Web server-authoritative realtime primitive [VERIFIED: node_modules/@devvit/realtime/server/RealtimeClient.d.ts] |
| `connectRealtime` | `@devvit/web/client` | Post webview subscribes to a channel, re-synths on message | The Devvit-Web client realtime primitive; works in the post webview (not Blocks `useChannel`) [VERIFIED: node_modules/@devvit/realtime/client/realtime.d.ts] |
| `reddit.submitCustomPost` | `@devvit/web/server` | Create the interactive reveal post (reuses `game` entrypoint) | Already used by `createPost`; `entry` selects the entrypoint [VERIFIED: node_modules/@devvit/reddit/models/Post.d.ts] |
| `Post.sticky(position?)` | (returned Post) | Pin the reveal post | Verified method on the Post model [VERIFIED: node_modules/@devvit/reddit/models/Post.d.ts:455] |
| `redis.hIncrBy` / `hGetAll` | `@devvit/web/server` | Aggregate the per-day steer hash (sum, never overwrite) | Atomic field increment = the no-clobber aggregation D-04 wants; SDK has no set ops but DOES have hashes [CITED: developers.reddit.com/docs/capabilities/server] |
| `redis.incrBy` | `@devvit/web/server` | Atomic per-user `actionsUsed` increment (budget gate) | Already used for `count`/`ringCount`; atomic increment is the correct budget primitive [VERIFIED: src/server/core/ring.ts] |

### Supporting
| Module | Import | Purpose | When to Use |
|--------|--------|---------|-------------|
| `context.postId` (client) | `@devvit/web/client` | Source for the per-post realtime channel name | Channel naming (colon-free, underscore form `t3_...`) [VERIFIED: node_modules/@devvit/shared-types/client/client-context.d.ts] |
| `context.subredditId` (server) | `@devvit/web/server` | Trusted sub id for the channel + Redis keys | Server-side channel naming / key building (V4) [VERIFIED: node_modules/@devvit/shared-types/shared/baseContext.d.ts] |
| `postData` (≤2 KB) | `submitCustomPost` opt | Stamp the reveal post with its ring index / outcome summary | Optional: lets the reveal post self-identify which ring it celebrates [VERIFIED: node_modules/@devvit/reddit/models/Post.d.ts] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `connectRealtime` (Devvit Web) | `useChannel` (Blocks `@devvit/public-api`) | `useChannel` is the **Blocks** API (JSX render loop, `Devvit.configure({realtime:true})`); this project is Devvit **Web** (webview + Hono server). Do NOT use `useChannel` — wrong runtime. [VERIFIED: node_modules/@devvit/web/client/index.d.ts re-exports `@devvit/realtime/client`] |
| Realtime broadcast (D-03) | Acting-user-local + reload (D-03b) | Fallback if realtime flakes on mobile; smaller fidelity but identical source-of-truth (steer hash). Keep as the locked degrade path. |
| Score from synthesized Scene | Score from DayVector via duplicated math | Re-using synthesis's actual `starCount`/`arms` (exported) avoids a second source of truth; scoring the full Scene re-runs synthesis (heavier, but exactly faithful). Recommend exporting the derivations and scoring from the DayVector. |

**Installation:** none — all modules ship in the installed `@devvit/web@0.13.4`.

**Version verification:**
```bash
npm view @devvit/web version     # → 0.13.4 [VERIFIED: npm registry — matches installed]
```
`@devvit/web@0.13.4` is `latest` on npm and is the exact version in `package.json` (alongside `devvit@0.13.4`, `@devvit/start@0.13.4`). [VERIFIED: npm view dist-tags]

## Package Legitimacy Audit

> Phase 4 installs **NO new packages**. Every module used is a sub-path of the already-installed,
> already-vetted `@devvit/web@0.13.4` (the project's core platform dependency, present since Phase 3).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@devvit/web` | npm | already installed (0.13.4 = latest) | first-party Reddit | github.com/reddit/devvit | OK | Already in use — no action |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
LIVE LOOP (during the day)
                                         ┌─────────────── realtime channel (per post) ───────────────┐
                                         │  channel = sanitize(context.postId)  e.g. "subcosm-t3_abc" │
                                         ▼                                                            │
  [post webview]                   [server: Hono]                         [Redis]                     │
  nudge tap ──fetch POST /api──▶ /internal/api/steer                                                  │
                                   1. budget gate:  incrBy budget:{sub}:{day}:{uid} ──▶ actionsUsed   │
                                      if > cap → 403 + remaining=0 (no aggregate)                     │
                                   2. aggregate:    hIncrBy steer:{sub}:{day} <param> <amount>        │
                                      hIncrBy steer:{sub}:{day} count 1                               │
                                   3. broadcast:    realtime.send(channel, {steer, count}) ───────────┘
                                                                                                      │
  onMessage(steer) ◀──────────────────────────────────────────────────────────────────────────────┘
  derive mean = sum/count ; render().nudge(param, meanΔ × steerGain)  → repaint frontier ONLY
  acting user ALSO nudges locally immediately (no wait for round-trip)
  HUD: recompute targetParam metric from re-synth'd frontier  → "conflict 0.32 / goal <0.40 ✓ on track"

OVERNIGHT TICK (runTick, extended — D-08)
  sweeper ──runJob('tick',{subId,day})──▶ /internal/scheduler/tick ──▶ runTick(sub, day)
    [existing] idempotency guard (lastTickDay) → read accumulators → conflict → build DayVector
    [existing] read steer hash → fold aggregated mean into the frozen DayVector.steering (× steerGain)
    [NEW]      outcome = score(dayVector, genome.dailyGoal)   (PURE — engine/score.ts)
    [existing] RingRecordSchema.parse({ ...dayVector, outcome, genomeVersion }) → writeRing
    [NEW]      reveal = reddit.submitCustomPost({ entry:'game', subredditName, title, postData })
               reveal.sticky()                                   (within ~1 min — LIVE-02)
    [existing] reset day counters + del steer hash + advance lastTickDay

READ / RENDER (any client, any time — LIVE-03)
  GET /api/organism → rings (each carries outcome) + live steer ──safeParse──▶ render()
    frozen shells: paint glyph where outcome.achieved (paint-only — D-06)
    second client after tick → identical frozen ring (pure functions of the record — D-09)
```

### Recommended Project Structure (additions only)
```
src/
├── engine/
│   ├── score.ts                # NEW — pure score(ring, goal) → Outcome (re-uses synthesis derivations)
│   ├── synthesis.ts            # EXPORT starCount/arms derivation helpers (already partly exported)
│   └── contracts/
│       ├── DayVector.ts        # FIRM `outcome` (was z.unknown) → OutcomeSchema
│       └── Outcome.ts          # NEW — OutcomeSchema (D-02)
├── server/
│   ├── core/
│   │   ├── tick.ts             # EXTEND — score + reveal post + fold steer into frozen steering
│   │   ├── steer.ts            # NEW — steer-hash aggregate + budget gate (Redis)
│   │   ├── post.ts             # EXTEND — createRevealPost(sub, ring, outcome) + sticky
│   │   └── redisKeys.ts        # ADD keys.steer(sub,day) + keys.budget(sub,day,userId)
│   └── routes/
│       └── api.ts              # ADD POST /steer ; EXTEND GET /organism (live steer + outcome)
├── shared/
│   └── api.ts                  # ADD SteerRequest/SteerResponse schemas; extend OrganismResponse
└── client/
    ├── game.ts                 # ADD connectRealtime subscribe + nudge UI + HUD wiring
    └── cosmos/
        ├── PhaserPainter.ts    # ADD reward-glyph render on frozen shells with goalAchieved
        └── hud.ts (or inline)  # NEW — tracking readout (GAME-03), i18n keys
```

### Pattern 1: Devvit-Web realtime (client subscribe / server broadcast)
**What:** Per-post pub/sub. Server is the only sender; clients only subscribe.
**When to use:** D-03 aggregated-steer broadcast (LIVE-01).
```ts
// CLIENT — src/client/game.ts  [VERIFIED: node_modules/@devvit/realtime/client/realtime.d.ts]
import { connectRealtime, context } from '@devvit/web/client';

type SteerMsg = { branch: number; symmetry: number; hue: number; count: number };

const channel = steerChannel(context.postId); // see Pattern 2 (colon-free)
const conn = connectRealtime<SteerMsg>({
  channel,
  onConnect: (ch) => { /* update a status pip; optional */ },
  onDisconnect: (ch) => { /* show "reconnecting"; the steer hash is still the truth */ },
  onMessage: (steer) => {
    // Re-synth the frontier from the aggregated MEAN (never the raw deltas).
    applyAggregatedSteer(steer); // → handle.nudge(param, meanΔ × steerGain) per param
    updateHud();                 // GAME-03 readout
  },
});
// NOTE: connectRealtime is SYNCHRONOUS here (returns Connection, not a Promise) — do NOT `await` it.
// Disconnect on teardown: disconnectRealtime(channel) (Connection.disconnect() is @deprecated).
```
```ts
// SERVER — src/server/core/steer.ts  [VERIFIED: node_modules/@devvit/realtime/server/RealtimeClient.d.ts]
import { realtime } from '@devvit/web/server';
await realtime.send(channel, { branch, symmetry, hue, count }); // msg must be JSONValue
```

### Pattern 2: Colon-free channel naming (LIVE-01 hard constraint)
**What:** Derive a stable per-post channel name with `-` separators, never `:`.
**Why it works:** Reddit thing-ids use `_` (`t3_abc123`, `t5_xyz`), never `:`. Build the name from a
literal prefix + the post id; replace any non-`[A-Za-z0-9_-]` defensively.
```ts
// Shared helper (client + server build the SAME name)
export function steerChannel(postId: string): string {
  // e.g. "subcosm-steer-t3_abc123" — letters, digits, '_' and '-' only; NO ':'.
  return `subcosm-steer-${postId}`.replace(/[^A-Za-z0-9_-]/g, '-');
}
```
**Note on the underscore vs hyphen wording:** CONTEXT locks "names use `-`, NO colons". The hard,
verifiable constraint is **no colons** — Devvit's older Blocks docs additionally say
"alphanumeric + underscores" [CITED: context7 /reddit/devvit useChannel], so a name containing only
`[A-Za-z0-9_-]` is safe under both readings. Avoid `:` (it is the namespacing char in many pub/sub
backends and the documented constraint). [CONFIDENCE: MEDIUM — the exact allowed-character set for
Devvit *Web* `connectRealtime` is not in the public docs; the conservative `[A-Za-z0-9_-]` name
satisfies every documented reading. Verify on-device early per D-03a.]

### Pattern 3: Pure deterministic scoring (re-use synthesis derivations)
**What:** Score `density`/`symmetry`/`conflict` from the frozen DayVector with the SAME math
synthesis uses, so the metric the player chases is exactly the one painted.
```ts
// src/engine/score.ts — PURE: no I/O, no rng, no Devvit (CLAUDE.md determinism)
import { starCount, deriveArms } from './synthesis'; // export these from synthesis.ts
import type { DayVector, Genome, Outcome } from './contracts';

// targetParam → measured scalar, derived deterministically from the FROZEN DayVector.
function measure(targetParam: string, day: DayVector, genome: Genome): number {
  switch (targetParam) {
    case 'conflict':
      return day.conflict;                                   // direct field (0..1)
    case 'density': {
      // density goal targets >0.7 on a NORMALIZED scale. starCount is 18..112;
      // normalize against the cap so the goal threshold is comparable.
      const density = genome.baseVar?.density ?? 0.3;
      const n = starCount(day.posts, density);               // exact synthesis count
      return (n - 18) / (112 - 18);                          // 0..1 normalized (floor..cap)
    }
    case 'symmetry':
      return deriveArms(day, genome);                        // exact synthesis arm count (integer)
    default:
      return day.conflict;                                   // safe fallback
  }
}
```
**Landmine:** `density>0.7` and `symmetry>5` in the genomes are thresholds on the **derived metric**,
not on `genome.baseVar` knobs. The `density` threshold (0.7) is a **normalized 0..1** target
(stars relative to floor..cap), and `symmetry` (>5) is the **integer arm count** `deriveArms` returns.
The planner must confirm the normalization so an achievable goal is actually achievable for plausible
activity — see Open Question 1.

### Pattern 4: Atomic ActionBudget gate (GAME-05 / D-04)
**What:** Enforce `actionsUsed < cap` with an atomic Redis increment; reject over-budget without
mutating the steer hash.
```ts
// src/server/core/steer.ts  [VERIFIED: incrBy pattern from src/server/core/ring.ts]
const cap = genome.actionCap;                                // default 3 (D-04)
const used = await redis.incrBy(keys.budget(sub, day, userId), 1); // atomic; key TTL'd to the day
if (used > cap) {
  // over budget: do NOT aggregate. Return remaining = 0 (D-04a). Optionally decr back (cosmetic).
  return { remaining: 0, accepted: false };
}
// within budget: aggregate the nudge (never overwrite — hIncrBy SUMS)
await redis.hIncrBy(keys.steer(sub, day), param, amount);
await redis.hIncrBy(keys.steer(sub, day), 'count', 1);
return { remaining: cap - used, accepted: true };
```
**Why `incrBy` first:** incrementing *then* comparing is race-free (two concurrent nudges get
distinct values); checking-then-incrementing is not. `userId` is `context.userId` server-side (V4) —
never client input.

### Pattern 5: Steer-hash aggregation (no overwrite, LIVE-01)
**Redis shape:** `organism:{sub}:steer:{day}` HASH with fields `branch`, `symmetry`, `hue`, `count`.
`hIncrBy` SUMS each contribution; the consumer (re-synth + tick) computes `mean = sum / count`.
Different users' nudges accumulate — they never clobber each other (each is `+= amount`).
The tick deletes this hash when it freezes the day (mirrors the counter reset).
```ts
keys.steer = (sub, day) => `organism:${sub}:steer:${day}`;             // ADD to redisKeys.ts
keys.budget = (sub, day, userId) => `organism:${sub}:budget:${day}:${userId}`; // per-user, day-scoped
```
**Note:** these Redis KEY strings use `:` (matching the existing `organism:{sub}:*` schema) — the
colon ban applies ONLY to **realtime channel names**, never to Redis keys. Do not confuse the two.

### Anti-Patterns to Avoid
- **Using `useChannel` from `@devvit/public-api`** — that is the Blocks API, wrong runtime for this Devvit-Web project. Use `connectRealtime`/`realtime.send`.
- **`await connectRealtime(...)`** — it is synchronous in `@devvit/web/client` (returns `Connection`). Awaiting it is a type error / no-op.
- **Scoring inside synthesis or the rAF loop** — scoring is a one-shot pure call at the tick (and a HUD re-compute on nudge), never per-frame.
- **Colons in channel names** — banned (LIVE-01). Underscores from thing-ids are fine.
- **Overwriting steer fields (`hSet`)** — must `hIncrBy` (sum) so concurrent users aggregate (D-04).
- **Per-user state in `Scene`** — ActionBudget stays on the personal Redis layer (D-04b); `Scene` is the shared community layer (the contracts test asserts no per-user fields).
- **Re-baking frozen shells on a nudge** — `render().nudge()` already re-synths ONLY `shells[0]`; never touch history.
- **Reward glyph via a new rng draw** — must be paint-only off `outcome.achieved` (D-06), or it breaks cross-client determinism (LIVE-03).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client↔server live updates | A polling loop / SSE / custom WebSocket | `connectRealtime` + `realtime.send` | First-party, works in the post webview, server-authoritative; polling wastes the budget and lags |
| Concurrent nudge aggregation | Read-modify-write of a JSON blob | `redis.hIncrBy` | Atomic per-field SUM — no lost updates under concurrency (the exact no-clobber requirement, D-04) |
| Per-user action counting | A Set/list of action records | `redis.incrBy` on a day-scoped key | Atomic, O(1), race-free; counting is all GAME-05 needs |
| Pinning the reveal post | reddit raw API calls | `post.sticky(position?)` | Verified method on the returned Post; one call |
| The reveal post's universe render | A second renderer / screenshot | `entry:'game'` (reuse game.html) + the SAME `render()` | No new entrypoint; the reveal IS a Subcosm post — only the overlay differs |
| Goal metric derivation | A new density/symmetry formula | Export + reuse synthesis's `starCount`/arms math | A second formula = a second source of truth = determinism drift (LIVE-03) |

**Key insight:** Every "live" primitive Phase 4 needs (realtime, atomic counters, atomic hash sums,
post creation, pinning) is a first-party Devvit/Redis call already adjacent to code in the repo. The
only genuinely new *logic* is the pure scorer — and even that must re-use synthesis math, not invent
its own.

## Runtime State Inventory

> Phase 4 is additive (new keys + extended records), not a rename/migration. Inventory of new/affected runtime state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NEW: `organism:{sub}:steer:{day}` (HASH, aggregated nudges) + `organism:{sub}:budget:{day}:{userId}` (int). EXTENDED: each `organism:{sub}:ring:{n}` hash gains an `outcome` JSON field. | Tick must `del` the steer hash on freeze (mirror counter reset). Budget keys should carry a day TTL so they self-expire. `ring.ts` already skips `undefined` outcome and JSON-encodes objects — confirm `outcome` is added to `JSON_FIELDS`. |
| Live service config | Realtime is on by default in Devvit Web (no `Devvit.configure` in Web; that is Blocks). No new `devvit.json` channel declaration is required for `connectRealtime`/`realtime.send`. | Verify on first playtest that no extra permission/manifest entry is needed (D-03a on-device check). |
| OS-registered state | None — no Task Scheduler / cron registration changes (the hourly sweeper + one-off tick already exist in devvit.json). | None. |
| Secrets / env vars | None — no new secrets; `userId`/`subredditId` come from trusted context. | None. |
| Build artifacts | The reveal post reuses the existing `game.html` entrypoint (already built). No new entrypoint → no devvit.json `post.entrypoints` change. | None — confirm `entry:'game'` resolves to the existing built bundle. |

**Nothing found in OS-registered / secrets / build-artifact categories** — verified by reading
`devvit.json` (no new tasks/entrypoints needed) and the existing Redis schema in `redisKeys.ts`.

## Common Pitfalls

### Pitfall 1: Treating realtime as the source of truth
**What goes wrong:** A dropped/late realtime message leaves a client's frontier out of sync.
**Why it happens:** Realtime is best-effort delivery; mobile webviews disconnect/reconnect.
**How to avoid:** The **steer hash in Redis is the source of truth** (D-03/D-03b). `connectRealtime`
provides *low-latency convergence*, not guaranteed delivery. On reconnect (or on load), re-fetch the
aggregate via `/api/organism` and re-synth. This is also exactly the D-03b fallback path — build it
first so the realtime layer is a pure enhancement.
**Warning signs:** Two clients showing different frontiers after the same nudges.

### Pitfall 2: Density/symmetry threshold mismatch (scoring un-achievable or trivially-achieved)
**What goes wrong:** `density>0.7` is interpreted against the wrong scale → goal is impossible (or
always true), making the game unwinnable/trivial.
**Why it happens:** `0.7`/`5` live in the genomes as plausible-looking numbers, but `starCount`
returns 18..112 and `arms` is a small integer — the threshold must be on the **same derived scale**.
**How to avoid:** Define the normalization in `score.ts` ONCE, write a determinism + achievability
unit test that feeds realistic `DayVector`s (use the simulator's busy/quiet/drama days) and asserts
the goal is reachable but not automatic. See Open Question 1.
**Warning signs:** Every reveal shows ✓ (or every ✗); `degree` clamped at 0 or 1 constantly.

### Pitfall 3: Reveal post fires more than once per day
**What goes wrong:** The scheduler is at-least-once; a double-fire could create two reveal posts.
**Why it happens:** `runTick`'s idempotency guard sets `lastTickDay` AFTER `writeRing` — a crash
between the reveal-post creation and the guard write could double-post on retry.
**How to avoid:** Create the reveal post AFTER `writeRing` but make the *whole* freeze idempotent:
either (a) set `lastTickDay` before the (non-Redis, retry-tolerant) reveal post and accept that a
crash mid-post skips the reveal, or (b) gate reveal creation on a separate `revealDone:{sub}:{day}`
flag set atomically. Recommend (b) — a `setNX`-style guard so the reveal is exactly-once even across
retries, decoupled from the ring-freeze guard. [CONFIDENCE: MEDIUM — confirm the SDK's set-if-not-
exists primitive (`set` with an existence option) on-device.]
**Warning signs:** Duplicate pinned reveal posts after a scheduler retry.

### Pitfall 4: ActionBudget check race (TOCTOU)
**What goes wrong:** Two simultaneous nudges both read `actionsUsed=2 < 3` and both proceed → 4 used.
**Why it happens:** check-then-increment is not atomic.
**How to avoid:** `incrBy` FIRST, then compare the returned value (Pattern 4). The increment is the
authority; over-budget calls simply don't aggregate.
**Warning signs:** A user lands more nudges than the cap.

### Pitfall 5: `outcome` round-trip through the Redis hash
**What goes wrong:** `outcome` is an object; `ring.ts` JSON-encodes only fields in `JSON_FIELDS`
(`topThreads`, `steering`). If `outcome` isn't added there, it serializes as `"[object Object]"`
and fails `RingRecordSchema.parse` on read.
**Why it happens:** The serializer's `typeof value === 'object'` branch DOES `JSON.stringify` it on
write, but `deserializeScalars` only `JSON.parse`s fields listed in `JSON_FIELDS` — `outcome` would
hit the `Number(value)` branch → `NaN`.
**How to avoid:** Add `'outcome'` to `JSON_FIELDS` in `ring.ts`. Unit-test the round-trip (the
existing `ring.test.ts` covers the pattern).
**Warning signs:** Rings with an outcome fail to read back; `/api/organism` 400s.

## Code Examples

### Firm the Outcome contract (D-02)
```ts
// src/engine/contracts/Outcome.ts — NEW (z.infer only; i18n error keys; CLAUDE.md §1/§7)
import { z } from 'zod';
import { DailyGoalSchema } from './Genome';

export const OutcomeSchema = z.object({
  goal: DailyGoalSchema,            // the resolved goal (type/targetParam/threshold/direction)
  measured: z.number(),            // the actual derived metric at freeze
  achieved: z.boolean(),
  degree: z.number().min(0).max(1), // normalized: how far past (achieved) / short (missed) of threshold
});
export type Outcome = z.infer<typeof OutcomeSchema>;
```
```ts
// src/engine/contracts/DayVector.ts — FIRM the placeholder
import { OutcomeSchema } from './Outcome';
// ...
  outcome: OutcomeSchema.optional(),   // was z.unknown().optional() — frozen rings carry it; live frontier may omit
```
**Degree formula (recommended, Claude's discretion):** normalize the signed distance to the threshold
by a per-goal scale so `degree∈[0,1]` for both directions:
```ts
// achieved=above: degree = clamp01((measured - threshold) / (max - threshold))
// achieved=below: degree = clamp01((threshold - measured) / (threshold - min))
// missed: degree mirrors how far short (same denominator) — keep monotonic & deterministic
```

### Reveal post from the tick (LIVE-02)
```ts
// src/server/core/post.ts — EXTEND  [VERIFIED: Post.d.ts submitCustomPost + sticky]
import { reddit, context } from '@devvit/web/server';
export async function createRevealPost(subredditName: string, ringIndex: number): Promise<void> {
  const post = await reddit.submitCustomPost({
    subredditName,
    title: `subcosm — day ${ringIndex} revealed`,
    entry: 'game',                       // reuse the existing game.html entrypoint (no new entrypoint)
    postData: { ringIndex },             // ≤2KB; lets the webview know which ring to celebrate
  });
  await post.sticky();                   // pin (position 1 by default) — within ~1 min of the tick
}
```

### Reward glyph (paint-only, deterministic — D-06 / GAME-04)
```ts
// src/client/cosmos/PhaserPainter.ts — when painting a frozen shell:
// goalAchieved comes from Scene (mirrors outcome.achieved). NO new rng draw.
if (shell.goalAchievedForDay) {           // resolved from the ring's outcome.achieved
  // brighter, distinctly-hued accent on a deterministic element (e.g. the brightest star),
  // chosen by a stable index (shell.elements[0] / max-energy) — pure function of the record.
  paintRewardAccent(brightestElement, REWARD_HUE);
}
```
Wire `Scene.goalAchieved` (already nullable boolean in the contract) per-shell so the painter can
read it without touching raw data (ENG-02). Since `outcome.achieved` is stored on the RingRecord,
both client and server produce the identical glyph (LIVE-03).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Blocks `useChannel` (JSX render loop, `Devvit.configure({realtime:true})`) | Devvit **Web** `connectRealtime` (client) + `realtime.send` (server) | Devvit Web GA (0.12+ → 0.13.x) | This project MUST use the Web API; the Blocks `useChannel` snippets in older docs do not apply |
| `Connection.disconnect()` | `disconnectRealtime(channel)` | 0.13.x | `Connection.disconnect()` is `@deprecated`; use the free function [VERIFIED: realtime.d.ts] |

**Deprecated/outdated:**
- `useChannel` / `@devvit/public-api` realtime — Blocks-only; not for Devvit Web.
- `Connection.disconnect()` — superseded by `disconnectRealtime()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Devvit Web `connectRealtime` channel names allow `[A-Za-z0-9_-]` (the public docs only state "no colons" for Web and "alphanumeric+underscore" for Blocks) | Pattern 2 | A too-strict validator could reject a hyphen → channel won't connect. Mitigated: the conservative name satisfies every documented reading; verify on-device (D-03a). |
| A2 | Realtime works inside the post **webview on mobile** with no extra `devvit.json` permission entry | Runtime State Inventory, Pattern 1 | If a manifest flag is needed, the channel silently won't connect. Mitigated by D-03a early on-device test; D-03b fallback already locked. |
| A3 | `density>0.7` is a threshold on a **normalized 0..1** derived metric and `symmetry>5` on the **integer arm count** | Pattern 3, Pitfall 2 | Wrong scale → unwinnable/trivial goal. Must be pinned by an achievability unit test (OQ1). |
| A4 | A set-if-not-exists guard (`revealDone:{sub}:{day}`) is available to make reveal-post creation exactly-once | Pitfall 3 | Without it, a scheduler retry could double-post. Confirm the SDK's `set` existence option on-device. |
| A5 | Adding `outcome` to `JSON_FIELDS` is the only ring.ts change needed for the outcome round-trip | Pitfall 5 | If the serializer differs, rings fail to read. Low risk — verified the serializer logic directly. |

## Open Questions

1. **Density/symmetry goal achievability (the normalization).**
   - What we know: `starCount` → 18..112; `deriveArms` → small integer; `conflict` → 0..1 direct. Goals: density>0.7, symmetry>5, conflict<0.4.
   - What's unclear: the exact normalization that makes "density>0.7" reachable by a busy/AMA day but not by a quiet day, and "symmetry>5" reachable only with steering toward symmetry.
   - Recommendation: planner adds an **achievability unit test** using the simulator's beat days (busy/quiet/drama/AMA) feeding `score()`; tune the normalization (not the genome thresholds) until each goal is reachable-but-not-automatic. Pure + deterministic, so the test is stable.

2. **Reveal-post exactly-once guard primitive.**
   - What we know: `runTick` is idempotent on the freeze; reveal-post creation is a non-Redis side effect.
   - What's unclear: the precise SDK call for set-if-not-exists in 0.13.4 (`redis.set(key, val, { nx: true })` vs a different option name).
   - Recommendation: confirm on-device during the D-03a realtime spike; default to a `revealDone:{sub}:{day}` flag.

3. **Folding the live steer aggregate into the frozen DayVector at the tick.**
   - What we know: nudges aggregate in `steer:{sub}:{day}`; the frozen DayVector has a `steering` object; `render().nudge` biases the mean × `steerGain`.
   - What's unclear: whether the tick should bake the aggregated mean into `DayVector.steering` (so the frozen ring reflects what the community steered) — almost certainly yes, but confirm the gain is applied once (not double-counted vs the live re-synth).
   - Recommendation: tick reads `steer:{sub}:{day}`, computes per-param mean, writes it into `DayVector.steering` BEFORE the schema parse + seed (the seed already excludes steering, so determinism holds). Document the single-application of `steerGain`.

## Environment Availability

> Phase 4 has no NEW external dependencies — all primitives are in the installed `@devvit/web@0.13.4`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@devvit/web` realtime (`connectRealtime`/`realtime.send`) | LIVE-01 live nudges | ✓ (installed) | 0.13.4 | D-03b: acting-user-local + others-on-reload |
| `reddit.submitCustomPost` + `Post.sticky` | LIVE-02 reveal post | ✓ (installed) | 0.13.4 | — (core platform API) |
| `redis.hIncrBy` / `incrBy` / `hGetAll` / `del` | steer hash + budget | ✓ (installed, already used) | 0.13.4 | — |
| Reddit live session (on-device playtest) | D-03a realtime-on-mobile verification | ⚠ requires `devvit playtest` on a device | — | Unit-gate the pure logic (scorer, aggregation); manually confirm realtime on-device, mirroring the Phase-3 UAT pattern |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the realtime *on-mobile* behavior can only be fully confirmed
on a live device (`devvit playtest`) — exactly as the Phase-3 WebGL risk was. The pure logic is
unit-testable without Reddit; D-03b is the locked degrade path.

## Security Domain

> `security_enforcement: true`, ASVS level 1. Block-on: high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reddit platform handles identity; `context.userId` is platform-trusted (no app auth). |
| V3 Session Management | no | Reddit-managed. |
| V4 Access Control | **yes** | `sub`/`userId` MUST come from trusted server `context` (never client body) for steer + budget + ring keys — the established V4 rule. The steer endpoint must derive both from context; the only client input is `param` + `amount`. |
| V5 Input Validation | **yes** | The nudge POST body (`param`, `amount`) is UNSAFE input → `SteerRequestSchema.parse()` at the endpoint boundary (CLAUDE.md §6). Realtime `onMessage` payloads are app-originated but still `safeParse`d at the client UI boundary. `amount` must be range-clamped so a hostile client can't send a huge bias. |
| V6 Cryptography | no | No secrets/crypto in this phase. |

### Known Threat Patterns for Devvit Web + Redis

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forges `userId`/`sub` to nudge as someone else or write another sub | Spoofing / Elevation | Derive `userId`=`context.userId`, `sub`=`context.subredditId` server-side (V4); never trust the body |
| Budget bypass (replay/concurrent nudges) | Tampering | Atomic `incrBy`-then-compare (Pattern 4); reject `>cap` |
| Oversized/garbage steer `amount` skews the shared frontier | Tampering | `SteerRequestSchema` with a bounded `amount` (clamp); `.parse()` at the endpoint |
| Hostile realtime message re-synths to an extreme | Tampering | Only the server sends (the SDK enforces send=server); client `safeParse`s `onMessage` + clamps before applying |
| Reveal-post spam (one per day cap) | DoS | Idempotent freeze + `revealDone:{sub}:{day}` guard (Pitfall 3) |
| Reflecting raw user text into the reveal post | (n/a here) | The reveal renders only deterministic geometry + i18n overlay — no user free-text is echoed |

## Sources

### Primary (HIGH confidence — verified against installed SDK + codebase)
- `node_modules/@devvit/realtime/client/realtime.d.ts` — `connectRealtime`/`disconnectRealtime`/`isRealtimeConnected` (synchronous; channel=`context.postId` example)
- `node_modules/@devvit/realtime/server/RealtimeClient.d.ts` — `realtime.send(channel, msg)` (server-only)
- `node_modules/@devvit/web/{client,server}/index.d.ts` — re-export of `@devvit/realtime` through `@devvit/web`
- `node_modules/@devvit/reddit/models/Post.d.ts` — `submitCustomPost` (`entry`, `postData`), `Post.sticky(position?)`
- `node_modules/@devvit/shared-types/{shared/baseContext,client/client-context}.d.ts` — `subredditId`/`postId`/`userId` context fields
- `package.json` + `npm view @devvit/web` — `@devvit/web@0.13.4` is installed and `latest`
- Repo: `src/server/core/{tick,ring,redisKeys}.ts`, `src/engine/{render,synthesis}.ts`, `src/engine/contracts/*`, `devvit.json` — the exact seams to extend

### Secondary (MEDIUM confidence — official docs via Context7)
- Context7 `/websites/developers_reddit` — `realtime.send`, `connectRealtime`, `submitCustomPost`, scheduler `runJob`
- Context7 `/reddit/devvit` — `useChannel` (Blocks; flagged as NOT for this project) + the "alphanumeric+underscore" channel-name note

### Tertiary (LOW confidence — web search, not authoritative)
- WebSearch for the exact Devvit-Web `connectRealtime` channel-character set returned no authoritative result → conservative `[A-Za-z0-9_-]` recommendation + on-device verification (A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module verified against the installed SDK type definitions.
- Realtime feasibility (D-03a): HIGH that the API exists & is the right shape; MEDIUM on mobile-webview behavior until the on-device spike (mirrors Phase-3 WebGL risk).
- Scoring derivation: HIGH on the approach (re-use synthesis math); MEDIUM on the exact normalization (OQ1 — needs an achievability test).
- Architecture / pitfalls: HIGH — grounded in the actual repo seams.

**Research date:** 2026-06-21
**Valid until:** ~2026-07-21 (Devvit 0.13.x is moving — `next` is already 0.13.5; re-verify realtime channel-name rules if upgrading past 0.13.4).

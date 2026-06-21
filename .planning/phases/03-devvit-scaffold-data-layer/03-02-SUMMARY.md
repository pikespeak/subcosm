---
phase: 03-devvit-scaffold-data-layer
plan: 02
subsystem: database
tags: [devvit, redis, zod, triggers, conflict-metric, zset, vitest]

# Dependency graph
requires:
  - phase: 03-01
    provides: "central redisKeys.ts key-builder, tolerant trigger payload schemas, confirmed live trigger payload shapes (comment.author/postId/parentId)"
provides:
  - "Pure D-02 conflictComposite(proxies) — volume-normalized, saturating, spam-resistant 0..1 conflict metric (DEV-03)"
  - "counters.ts Redis accumulation service: bumpPost/bumpComment (incrBy + contributor ZSET-as-set + threads ZSET + reply proxy) (DEV-02)"
  - "frontierDay(sub) — the single source of the current/frontier day index = (ringCount ?? 0)+1, shared by triggers (write) and the sweeper (freeze, 03-04)"
  - "Trigger handlers wired to accumulate into per-community Redis daily counters (replaces the 03-01 log-only spike stubs)"
affects: [03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contributor SET via a ZSET (zAdd member-keyed + zCard) — the Devvit SDK 0.13.4 redis client has NO sAdd/sCard"
    - "Single day-index helper (frontierDay) so write-day and freeze-day cannot drift"
    - "Pure unit-tested normalization curve kept Devvit/Redis-free even though it lives under src/server/"
    - "vi.hoisted + vi.mock('@devvit/web/server') in-memory redis fake to unit-test Redis-bearing modules in the standalone (no-real-Devvit) runner"

key-files:
  created:
    - src/server/core/conflict.ts
    - src/server/core/conflict.test.ts
    - src/server/core/counters.ts
    - src/server/core/counters.test.ts
    - src/server/core/frontierDay.ts
    - src/server/core/frontierDay.test.ts
  modified:
    - src/server/contracts/triggers.ts
    - src/server/contracts/triggers.test.ts
    - src/server/routes/triggers.ts
    - vitest.config.ts

key-decisions:
  - "Contributor SET implemented as a ZSET (zAdd/zCard) because @devvit/web/server 0.13.4 exposes no sAdd/sCard — same intent (idempotent O(1) add + O(1) cardinality), same key namespace"
  - "conflict k/weights: K_RATIO=0.35, K_HEAT=12, W_RATIO=0.6 / W_HEAT=0.4 (reply-depth weighted above raw heat); documented inline"
  - "Skip the app's own scaffold post (author t2_2gtt4hhdg3) in onPostCreate so installs don't seed phantom community activity (03-01 edge note)"
  - "Reply proxy keyed on parentId.startsWith('t1_') (parent is a comment = a reply); t3_/absent = top-level"

patterns-established:
  - "ZSET-as-set for unique-membership counting under the Devvit Redis surface"
  - "frontierDay(sub) is the ONE place (ringCount ?? 0)+1 is computed — handlers never inline it"
  - "Redis-bearing server modules are unit-tested via a vi.hoisted in-memory redis mock, keeping them in the pure standalone runner"

requirements-completed: [DEV-02, DEV-03]

# Metrics
duration: 8min
completed: 2026-06-21
status: complete
---

# Phase 3 Plan 02: Triggers → Redis daily counters + pure conflict composite Summary

**Real post/comment activity now accumulates into per-community Redis daily counters (posts/comments via incrBy, unique contributors via a ZSET-as-set, top threads via a ZSET, replies via a t1_-parentId proxy) under a single `frontierDay(sub)` day index, plus a pure, spam-resistant `conflictComposite` 0..1 metric ready for the tick.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-21T14:45:42Z
- **Completed:** 2026-06-21T14:52:53Z
- **Tasks:** 3
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments
- Pure `conflictComposite(proxies)` (DEV-03 / D-02): `replyRatio = replies/max(comments,1)` and `heat = comments/max(posts,1)`, each saturated via `x/(x+k)`, weighted blend, clamp [0,1]. Volume-normalized + saturating → a single spammer's few deep replies cannot spike it (threat T-03-04). Pure/deterministic, no Devvit/Redis/Math.random.
- `counters.ts` accumulation service (DEV-02): `bumpPost`/`bumpComment` write the post/comment counters, the unique-contributor SET, the top-threads ZSET, and the reply-depth proxy — all via `keys.*`, all in parallel (`Promise.all`), no `redis.keys`/scan.
- `frontierDay(sub)` — the single source of the current/frontier day index `(ringCount ?? 0)+1`, reading only `keys.ringCount(sub)`. The day triggers write under and the day the sweeper (03-04) freezes both flow through this one helper → no off-by-one.
- Trigger handlers upgraded from the 03-01 log-only spike stubs to real accumulation (boundary parse → `frontierDay` → `bump*`), tolerant on malformed payloads (200, never 500 — T-03-01), with the app's own scaffold post skipped.
- Tightened `CommentCreatePayloadSchema` to the confirmed 03-01 shape (`comment.author` + `comment.postId` required, `comment.parentId` optional), z.infer-only, `.passthrough()` retained.

## Task Commits

Each task was committed atomically (TDD tasks have test → feat commits):

1. **Task 1: Pure conflict-composite normalization (D-02)** — `f86fa1a` (test, RED) → `bff67ec` (feat, GREEN)
2. **Task 2: Redis accumulation service + tighten comment schema** — `39bd1a6` (feat)
3. **Task 3: frontierDay helper + wire triggers to accumulate** — `633f052` (test, RED) → `46fdf28` (feat, GREEN)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `src/server/core/conflict.ts` — pure D-02 conflictComposite (saturating, volume-normalized, documented k/weights)
- `src/server/core/conflict.test.ts` — low/high/monotonic/spam-resistance/[0,1]/zero-input/purity (7 tests)
- `src/server/core/counters.ts` — bumpPost/bumpComment Redis accumulation (contributor ZSET-as-set, threads ZSET, reply proxy)
- `src/server/core/counters.test.ts` — in-memory redis mock; exact key calls + idempotent contributor add (6 tests)
- `src/server/core/frontierDay.ts` — single (ringCount ?? 0)+1 day-index helper
- `src/server/core/frontierDay.test.ts` — absent/0/non-numeric → 1, ringCount+1, reads only keys.ringCount, sub-scoped (7 tests)
- `src/server/contracts/triggers.ts` — tightened CommentCreatePayloadSchema to the confirmed shape
- `src/server/contracts/triggers.test.ts` — updated valid payloads + new required-field rejection cases
- `src/server/routes/triggers.ts` — handlers wired to accumulate; app-post skip; spike console.log removed
- `vitest.config.ts` — registered the three new test files in the standalone runner (comment explains the vi.mock invariant)

## Decisions Made
- **Contributor SET via ZSET** — the most significant decision; see Deviations below. Same intent and key namespace, different primitive because the SDK lacks set ops.
- **conflict constants** K_RATIO=0.35, K_HEAT=12, weights 0.6/0.4 — reply-depth (contention) weighted slightly above raw heat per D-02; chosen so a "deep" day (replyRatio≈0.8) and a "hot" day (heat≈50) each read clearly high without instantly saturating, while a busy-but-flat day stays low.
- **App-post skip** — `onPostCreate` short-circuits for author `t2_2gtt4hhdg3` (the `subcosm-universe` app account) so the install-time scaffold post is not counted as community activity (Rule 2, 03-01 edge note).
- **no-sub guard** — handlers no-op (200) if `context.subredditId` is absent rather than writing under an `undefined` key (defensive; should not occur for a real trigger).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / Rule 1 - Wrong assumed API] Contributor SET implemented as a ZSET (no sAdd/sCard in the Devvit SDK)**
- **Found during:** Task 2 (counters.ts)
- **Issue:** The plan, RESEARCH Pattern 2, and "Don't Hand-Roll" all specify `redis.sAdd`/`sCard` for the unique-contributor SET. The installed `@devvit/web/server` redis client (v0.13.4) exposes **no native Redis set operations** — `grep -rln "sAdd" node_modules/@devvit/` returns nothing; the RedisClient surface has only string/hash/ZSET ops. Using `sAdd` would not compile/run.
- **Fix:** Implemented the unique-contributor SET as a **ZSET keyed by the contributor id**: `zAdd(keys.contributors(sub,day), {member: authorId, score: day})` is member-keyed (idempotent — re-adding the same author is a membership no-op) and `zCard(key)` returns the unique cardinality at tick time. This preserves the exact DEV-02 intent (O(1) idempotent add + O(1) cardinality, atomic across concurrent triggers), the same `keys.contributors` namespace, and the same day-scoping — only the primitive changes to the one the SDK actually ships. NOT a Rule 4 architectural change (no new table/service/library, same key schema, same data semantics); the score field carries `day` only as a stable payload and is never read for ranking.
- **Files modified:** src/server/core/counters.ts (+ counters.test.ts asserts member-keyed idempotency)
- **Verification:** counters.test.ts proves repeat-author-in-a-day → `zCard` = 1 while the comment counter still increments; `tsc --build` confirms the API exists. No new package (T-03-SC clean).
- **Committed in:** `39bd1a6` (Task 2 commit)

**2. [Rule 2 - Missing critical] Skip the app's own scaffold post when counting community activity**
- **Found during:** Task 3 (wiring onPostCreate)
- **Issue:** The 03-01 spike noted the app's auto-created install post fires `onPostCreate` as the app account (`t2_2gtt4hhdg3`). Counting it would seed a phantom post into every community's day-1 activity.
- **Fix:** `onPostCreate` short-circuits (200, `app-post-skipped`) when `payload.author.id === APP_ACCOUNT_ID` before accumulating.
- **Files modified:** src/server/routes/triggers.ts
- **Verification:** Constant matches the captured id; lint + tsc green. (Behaviour confirmed live deferred to 03-05.)
- **Committed in:** `46fdf28` (Task 3 commit)

**3. [Rule 3 - Blocking] Register new test files in the standalone vitest runner**
- **Found during:** Task 1 (running the RED test)
- **Issue:** `vitest.config.ts` uses an explicit `include` allowlist; new `*.test.ts` files are not picked up automatically (RED test reported "No test files found").
- **Fix:** Added `conflict.test.ts`, `counters.test.ts`, `frontierDay.test.ts` to the include list and updated the file's header comment to explain that the Redis-bearing tests `vi.mock('@devvit/web/server')`, so the runner's "no real Devvit" invariant still holds.
- **Files modified:** vitest.config.ts
- **Verification:** `npm test` → 96 passed across 13 files.
- **Committed in:** `f86fa1a` (Task 1 RED commit, alongside the test it enables)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical)
**Impact on plan:** All three were necessary for the code to run correctly against the real SDK / real install behaviour. The ZSET-as-set substitution is the notable one — it changes the Redis primitive but not the data model, key schema, or DEV-02 intent; 03-03/03-04 must read unique contributors via `zCard(keys.contributors(sub,day))` (not `sCard`). No scope creep.

## Issues Encountered
- `vi.mock` is hoisted above module-level `const` declarations, so the first counters test failed with "Cannot access 'fakeRedis' before initialization". Resolved by building the in-memory fake inside `vi.hoisted(() => …)` and referencing `h.fakeRedis` in the mock factory — the standard Vitest pattern. Applied to both counters and frontierDay tests.

## Deferred verification
- The plan's Task 3 `<human-check>` (live `devvit playtest`: create a post + two comments by different users incl. one reply, then confirm the post/comment/replies counters, contributor-SET cardinality = 2, and threads-ZSET moved, and that the accumulator day equals `frontierDay(sub)`) was **deferred to plan 03-05** per the user's explicit auto-approve decision for this run. 03-05 playtests the full pipeline end-to-end in one live session. All AUTOMATED gates were run and are green (below); only the live-device check is deferred.

## Automated gates (all green)
- `npm test` → **96 passed** (13 files; +20 new: conflict 7, counters 6, frontierDay 7, plus the updated triggers-contract suite)
- `npm run type-check` (`tsc --build`) → exit 0
- `npm run lint` (`eslint 'src/**/*.{ts,tsx}'`) → exit 0
- `npm run build` (`vite build`) → Build complete (pre-existing benign Rollup `inlineDynamicImports`/`sourcemapFileNames` warnings only — tooling, noted in 03-01, out of scope)

## CLAUDE.md / determinism compliance
- Zod at the boundary: trigger handlers `.parse()` the raw body before any Redis write; counters/frontierDay trust the inferred type and derive nothing from client input. `sub` always from `context.subredditId` (V4).
- conflict.ts is pure: no Devvit/Redis import, no `Math.random`, no I/O — Redis access lives only in counters/frontierDay/route layers.
- Types are `z.infer`-only (CommentCreatePayload/PostCreatePayload); no duplicate interfaces, no `as`-to-silence casts. Tests cover valid AND invalid payloads.

## Next Phase Readiness
- DEV-02/DEV-03 data layer is in place: 03-03 (ring store / freeze) and 03-04 (sweeper/tick) can read the accumulated proxies and compose `conflict` at tick time via `conflictComposite`, and must resolve the day via `frontierDay(sub)` (shared helper, no inline ringCount+1).
- **Hand-off note for 03-03/03-04:** unique contributors are a **ZSET** — read the count with `zCard(keys.contributors(sub,day))`, not `sCard`. Day-scoped contributor/thread ZSETs still need TTL/cleanup at tick (T-03-05, accepted for this plan, owed by 03-03).
- Live-device verification of the full accumulate→freeze pipeline is owed in 03-05.

## Self-Check: PASSED
All 6 created source/test files exist on disk; all 5 task commits (f86fa1a, bff67ec, 39bd1a6, 633f052, 46fdf28) present in git history.

---
*Phase: 03-devvit-scaffold-data-layer*
*Completed: 2026-06-21*

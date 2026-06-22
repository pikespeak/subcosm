---
phase: 04-live-game
plan: 02
subsystem: live-steer
tags: [steer, action-budget, redis-aggregate, zod-boundary, hud, determinism]
requires:
  - OutcomeSchema / score(day, genome) (04-01 scoring spine)
  - keys.* central key-builder (03-01)
  - ring.ts read/write boundary + JSON_FIELDS (03-03 / 04-01)
  - runTick build-boundary parse (03-03 / 04-01)
  - frontierDay(sub) single day-index source (03-02)
  - render() handle.nudge() live frontier re-synth (02-05)
  - OrganismResponseSchema shared envelope (03-04)
provides:
  - keys.steer / keys.budget / keys.revealDone day-scoped key builders
  - recordNudge (atomic incrBy budget gate + hIncrBy SUM aggregate) + readSteerAggregate (steer.ts Redis service)
  - SteerRequestSchema / SteerResponseSchema / SteerAggregateSchema (client-safe shared contracts, z.infer)
  - OrganismResponse extended with optional live steer aggregate (D-03b reload source-of-truth)
  - POST /api/steer route (V4 context ids + V5 boundary parse) + extended GET /api/organism
  - tick foldSteering — aggregate MEAN x steerGain folded into frozen DayVector.steering once (OQ3)
  - cosmos/hud.ts updateHud — live goal-tracking readout via the exact score.ts measure
  - measure() exported from score.ts (HUD reuses the scorer metric, no drift)
affects:
  - plan 03 (realtime broadcast to OTHER viewers — bolts onto this acting-user + persistence path)
  - plan 04 (reveal post — revealDone key reserved here; reads the steered frozen ring outcome)
tech-stack:
  added: []
  patterns:
    - "Atomic ActionBudget gate: incrBy-then-compare (TOCTOU closed) before any aggregate write"
    - "Steer aggregate via hIncrBy SUM (never hSet) — concurrent users accumulate, no clobber"
    - "Single steerGain application (OQ3): tick fold mirrors render.ts STEER_KNOB mapping, no double-count"
    - "Steer Redis service imports @devvit + keys but NEVER src/engine (engine purity preserved)"
    - "shared/api.ts stays client-safe: steer schemas are zod + engine contracts only, no server import"
    - "HUD reuses score.ts measure (one source of truth) — never re-implements the metric"
key-files:
  created:
    - src/server/core/steer.ts
    - src/server/core/steer.test.ts
    - src/client/cosmos/hud.ts
  modified:
    - src/server/core/redisKeys.ts
    - src/server/core/redisKeys.test.ts
    - src/shared/api.ts
    - src/server/routes/api.ts
    - src/server/core/tick.ts
    - src/server/core/tick.test.ts
    - src/engine/score.ts
    - src/client/game.ts
    - src/client/game.html
    - vitest.config.ts
decisions:
  - "Budget keys are per-user-per-day and NOT enumerable without a key scan (DEV-05 — no scan), so they self-expire via a 48h TTL backstop set in recordNudge rather than being deleted at the tick; the steer hash IS explicitly deleted on freeze (D-08)"
  - "The scored targetParam measure (conflict/density/arms) is activity-driven and does NOT depend on day.steering — so a nudge biases the VISUAL frontier mean (acting-user re-synth) while the HUD readout tracks the day's underlying goal progress; both are shown, the contribution->outcome link stays legible (GAME-03)"
  - "tick foldSteering mirrors render.ts STEER_KNOB exactly: branch->steerGain.branch, symmetry->steerGain.symmetry, hue->fixed unit gain 1; mean = sum/count applied ONCE (OQ3, no double-count vs the live re-synth)"
  - "NUDGE_AMOUNT = 0.5 per tap (client step); server SteerRequestSchema clamps amount to [-1,1] regardless (T-04-06)"
  - "Initial budget display seeded with genome.actionCap as a hint; the authoritative per-user remaining arrives on the first nudge response (D-04)"
  - "measure() exported from score.ts so the HUD chases the EXACT scorer metric (LIVE-03 single source of truth) instead of re-deriving it"
  - "steer.test.ts added to the vitest include allowlist (the runner uses an explicit include list, not a glob)"
metrics:
  duration: ~10min
  completed: 2026-06-22
  tasks: 3
  files: 13
status: complete
---

# Phase 4 Plan 02: Live-Nudge Vertical Slice Summary

Built the live-nudge vertical slice: a same-origin `POST /api/steer` endpoint that enforces the per-user ActionBudget atomically (incrBy-then-compare, default cap 3), aggregates each nudge into a per-day Redis steer HASH via `hIncrBy` (sum, never clobber), and returns the remaining budget; a nudge UI that re-synthesizes the acting user's frontier immediately and a HUD that tracks the day against its goal using the exact `score.ts` metric; and the tick folding the aggregated steer MEAN x steerGain into the frozen DayVector exactly once (OQ3). After this plan a user can steer the live frontier toward the goal and SEE the contribution->outcome link — the realtime broadcast to OTHER viewers lands in plan 03.

## What Was Built

**Task 1 — Steer-hash core + budget gate + redisKeys + shared schemas** (`b3df030`)
- `redisKeys.ts`: `steer(sub,day)`, `budget(sub,day,userId)`, `revealDone(sub,day)` builders (Redis keys keep `:`); schema doc-block updated. `revealDone` reserved now for plan 04's exactly-once reveal guard.
- `steer.ts` (Redis service — imports `@devvit` + `keys`, NEVER `src/engine`): `recordNudge` runs the ATOMIC budget gate FIRST (`incrBy` the per-user counter, compare to cap) — over-cap returns `{accepted:false, remaining:0}` WITHOUT aggregating (TOCTOU closed, T-04-05); accepted calls `hIncrBy` the param SUM + a `count` field (no-clobber, T-04-07) and set a 48h TTL backstop on the budget key. `readSteerAggregate` folds the hash -> typed `{branch,symmetry,hue,count}` (absent -> all zeros).
- `shared/api.ts` (client-safe — zod + engine contracts only): `SteerRequestSchema` (`param` enum + `amount` clamped to [-1,1], the hostile-bias guard T-04-06), `SteerResponseSchema`, `SteerAggregateSchema`; `OrganismResponse` gains an optional `steer` field; all `z.infer` types, no hand interfaces, no `as`.
- `steer.test.ts`: budget gate (accept up to cap / reject beyond / no aggregate on reject / per-user independence / TTL set), hIncrBy SUM semantics (two +0.5 -> branch 1.0 count 2), `SteerRequestSchema` clamp + enum rejection.

**Task 2 — POST /steer route + extended GET /organism + tick steer-fold** (`02554bc`)
- `api.ts`: `POST /steer` — `subredditId`+`userId` from trusted `context` only (V4 / T-04-04), the body `SteerRequestSchema.parse()`'d at the boundary (V5 — a bad/oversized amount throws -> 400), genome `actionCap` resolved from the config snapshot, `recordNudge` under the cap. Returns typed `{type,remaining,accepted}`; an over-budget refusal is a normal 200, not an error. `GET /organism` now reads + returns the live steer aggregate (D-03b reload source-of-truth).
- `tick.ts`: `foldSteering` collapses the aggregate to `MEAN x steerGain` with the SAME mapping render.ts uses (branch/symmetry knobs, hue fixed unit gain), applied ONCE (OQ3); replaces the hardcoded `{branch:0,symmetry:0,hue:0}`. The steer hash is deleted on freeze (D-08); budget keys self-expire (no scan). The seed excludes steering, so determinism is preserved.
- `tick.test.ts`: unsteered -> zero steering, mean x gain applied once, hue fixed unit gain, steer hash deleted on freeze, folded steering round-trips through `RingRecordSchema`.

**Task 3 — Nudge UI + HUD goal-tracking readout** (`78b4583`)
- `cosmos/hud.ts`: `updateHud` scores the live frontier with the SAME `score.ts` measure the tick freezes (LIVE-03 single source of truth) and substitutes the metric / threshold / on-track VALUES into i18n-keyed nodes via `textContent` only (T-02-11 — never raw-HTML, never re-implements the measure).
- `game.ts`: nudge buttons POST `/api/steer`, `SteerResponseSchema.safeParse` at the UI boundary (never throws — a failure routes to the error overlay), `handle.nudge()` for immediate acting-user local re-synth (D-04, no round-trip wait), budget display updated from `remaining`, all controls disabled at 0 (D-04a).
- `game.html`: nudge controls (branch/symmetry/hue) + budget-remaining display + HUD readout container, each behind `data-i18n` keys (English fallback; JS injects only values + toggles `disabled`).
- `score.ts`: `measure` exported so the HUD chases the exact scorer metric.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Registered steer.test.ts in the vitest include allowlist**
- **Found during:** Task 1 (the new test file was silently skipped — "No test files found").
- **Issue:** `vitest.config.ts` uses an explicit `include` allowlist (not a glob); a new `*.test.ts` is invisible to the runner until listed.
- **Fix:** Added `'src/server/core/steer.test.ts'` to the include array (alphabetically beside ring/tick).
- **Files modified:** `vitest.config.ts`.
- **Commit:** `b3df030`.

This was directly required to run this plan's own new tests (in scope, Rule 3).

No other deviations — the route handler, the tick fold, the budget gate, and the UI were implemented as written. The `score.ts` `measure` export is the plan's explicit instruction ("the SAME measure score.ts uses, imported from the engine"), not a deviation.

## Architecture Note — Scored Metric vs Visual Nudge (GAME-03 legibility)

The scored `targetParam` measure (conflict / density / arms) is ACTIVITY-driven and does not read `day.steering`. So a nudge biases the VISUAL frontier mean (the acting-user re-synth — the immediate, legible contribution the player sees) while the HUD readout tracks the day's underlying progress toward its goal. Both are shown side-by-side, so the contribution->outcome link is legible without the nudge dictating the outcome (STR-02 invariant: steering biases, never dictates). The frozen ring's outcome (plan 01) reflects the steered, activity-driven frontier.

## Verification

- `npm test` (full vitest suite) — **219 tests green** (24 files; +20 over 04-01's 199).
- Targeted: `npx vitest run src/server/core/steer.test.ts src/server/core/redisKeys.test.ts src/server/core/tick.test.ts` — green (budget gate + SUM + clamp; steer fold MEAN x gain once + delete-on-freeze).
- `npm run type-check` (tsc --build) — clean.
- `npm run lint` (eslint) — clean (no `Math.random` / Devvit-import violations under `src/engine/`; `steer.ts` imports `@devvit` + `keys` but ZERO `src/engine`).
- `npm run build` (vite) — succeeds (the sourcemap/inlineDynamicImports warnings are pre-existing config warnings, not from this plan).
- grep gates: ids from `context` not body, `SteerRequestSchema.parse()` at the route, `hIncrBy` aggregate, `readSteerAggregate` + `keys.steer` in the tick reset, `fetch('/api/steer')` + `SteerResponseSchema.safeParse` + `handle?.nudge` in the client, `from '../server'` count 0 in shared/api.ts (bundle safety).

## Known Stubs

None — the steer endpoint, budget gate, aggregate, tick fold, nudge UI, and HUD are fully wired end-to-end for the acting user + others-on-reload. The realtime push to OTHER live viewers is intentionally deferred to plan 03 (LIVE-01 broadcast enhancement); the locked fallback (others-on-reload via the `GET /organism` steer aggregate, D-03b) is delivered here, so plan 03 is a pure enhancement.

## Threat Flags

None — no new security surface beyond the planned threat register. T-04-04 (identity spoofing) mitigated: sub+userId from `context` only. T-04-05 (budget bypass) mitigated: atomic incrBy-then-compare, no aggregate on reject. T-04-06 (oversized amount) mitigated: `SteerRequestSchema` clamp [-1,1] + `.parse()` at the route. T-04-07 (hash clobber) mitigated: `hIncrBy` SUM, never `hSet`. T-04-08 (nudge flood) mitigated: budget cap + day-scoped hash deleted/expired at the tick. T-04-SC (package legitimacy): zero new packages installed.

## Self-Check: PASSED

- Files created exist: `src/server/core/steer.ts`, `src/server/core/steer.test.ts`, `src/client/cosmos/hud.ts` — all FOUND.
- Commits exist: `b3df030`, `02554bc`, `78b4583` — all FOUND in `git log`.
- All three Definition-of-Done gates green (test 219 / type-check / lint).

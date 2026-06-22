// steer — the live-nudge Redis service: ActionBudget gate + steer-hash aggregate.
//
// A Redis service (it has I/O), NOT a pure engine module — so it imports the
// Devvit `redis` client + the central `keys` builder, exactly like ring.ts. It
// must NEVER import anything under `src/engine/*` (the engine stays pure + this
// module stays purely about persistence). The engine-side steering math lives in
// render.ts (the live re-synth) and the tick (the freeze fold); this module only
// records and reads the per-day aggregate.
//
// Two responsibilities, both per community-day:
//   1. recordNudge — the ATOMIC ActionBudget gate (GAME-05 / D-04). `incrBy` the
//      per-user counter FIRST, then compare against the cap: an over-cap call
//      returns `{ accepted:false, remaining:0 }` and does NOT touch the steer
//      hash (TOCTOU closed — T-04-05). An accepted call `hIncrBy`s the param SUM
//      + a `count` field so concurrent users accumulate, never clobber (T-04-07).
//   2. readSteerAggregate — fold the steer HASH into typed per-param sums + count
//      (absent hash → all zeros). The tick reads this to fold the MEAN once.
//
// The realtime broadcast to OTHER viewers is NOT here — it lands in plan 03; this
// module is the acting-user + persistence path only.
//
// `sub` and `userId` are ALWAYS derived by the CALLER from the platform-trusted
// `context` (V4 / T-04-04) — this module never reads context itself; it just takes
// the ids it is handed and builds the keys.
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';
import type { SteerParam, SteerAggregate } from '../../shared/api';

/** The result of an attempted nudge — accepted + the user's remaining budget. */
export interface NudgeResult {
  accepted: boolean;
  remaining: number;
}

// A budget key is per-user-per-day; bound its lifetime so a never-ticked sub does
// not leak counters indefinitely. The tick also explicitly deletes per-day keys on
// freeze (the primary cleanup); this TTL is a backstop (RESEARCH Runtime State
// Inventory — budget keys self-expire). 48h covers a full day plus a generous tick
// jitter / clock-skew margin.
const BUDGET_TTL_SECONDS = 48 * 60 * 60;

/**
 * recordNudge — record one user's nudge under the ATOMIC ActionBudget gate.
 *
 * Budget gate FIRST (race-free, T-04-05): `incrBy` the per-user counter and read
 * back `used`. If `used > cap` the budget is exhausted → return
 * `{ accepted:false, remaining:0 }` WITHOUT aggregating (an over-cap nudge never
 * reaches the shared hash). Otherwise `hIncrBy` the steer hash's `param` field by
 * `amount` AND bump the `count` field by 1 (the SUM-not-overwrite semantics,
 * T-04-07), and return `{ accepted:true, remaining: cap - used }`.
 *
 * `amount` is already clamped to [-1,1] by `SteerRequestSchema.parse` at the route
 * boundary (T-04-06) before it reaches here — this module trusts that boundary.
 */
export async function recordNudge(
  sub: string,
  day: number,
  userId: string,
  param: SteerParam,
  amount: number,
  cap: number,
): Promise<NudgeResult> {
  // Atomic budget gate: increment-then-compare. The counter is the source of
  // truth — a concurrent double-fire can never both see a stale "under cap".
  const budgetKey = keys.budget(sub, day, userId);
  const used = await redis.incrBy(budgetKey, 1);
  // Keep the per-user counter from outliving its day (backstop to the tick reset).
  await redis.expire(budgetKey, BUDGET_TTL_SECONDS);

  if (used > cap) {
    // Over the cap: refuse WITHOUT aggregating. `remaining` is 0 (D-04a disables
    // the UI). A refusal is not an error — the route returns it as a 200.
    return { accepted: false, remaining: 0 };
  }

  // Accepted: SUM the contribution into the shared per-day hash (never hSet — that
  // would clobber other users). Bump `count` so the tick can fold the MEAN once.
  const steerKey = keys.steer(sub, day);
  await redis.hIncrBy(steerKey, param, amount);
  await redis.hIncrBy(steerKey, 'count', 1);

  return { accepted: true, remaining: cap - used };
}

/**
 * readSteerAggregate — read the per-day steer hash into typed per-param sums +
 * count. An absent/empty hash (no nudges yet) folds to all-zeros. This is the
 * D-03b reload source-of-truth (carried on `GET /api/organism`) and the value the
 * tick folds (MEAN = sum/count) into the frozen DayVector exactly once.
 */
export async function readSteerAggregate(
  sub: string,
  day: number,
): Promise<SteerAggregate> {
  const raw = await redis.hGetAll(keys.steer(sub, day));
  // Redis hash fields are strings; a missing field reads back undefined → 0. A
  // non-numeric value (impossible via hIncrBy, but defensive) also floors to 0.
  const num = (v: string | undefined): number => Number(v ?? 0) || 0;
  return {
    branch: num(raw['branch']),
    symmetry: num(raw['symmetry']),
    hue: num(raw['hue']),
    count: num(raw['count']),
  };
}

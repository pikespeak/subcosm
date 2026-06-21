// frontierDay — the SINGLE source of the current/frontier day index (DEV-02/05).
//
// `frontierDay(sub) = (ringCount ?? 0) + 1` — the day the universe is currently
// accumulating activity under. Day 1 is genesis (no ring frozen yet); after the
// nth ring freezes, `ringCount` is n and the live frontier is day n+1. Both the
// accumulators (trigger handlers, here) and the sweeper-fired tick (plan 03-04)
// resolve the day through THIS one helper, so the day a counter is written under
// and the day the tick freezes can never drift (no off-by-one between write and
// freeze).
//
// It reads EXACTLY `keys.ringCount(sub)` via the central key-builder (no ad-hoc
// Redis string), uses NO Math.random, and contains no other logic — the explicit
// `ringCount` counter is the enumeration index (DEV-05; Devvit Redis has no
// scan). `sub` is the platform-trusted `context.subredditId`, passed by the
// caller (V4) — never client input.
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';

/**
 * Resolve the current frontier day index for `sub`: `(ringCount ?? 0) + 1`.
 * Returns 1 when no ring has frozen (absent / 0 / non-numeric ringCount), else
 * the stored ring count plus one. Reads only `keys.ringCount(sub)`.
 */
export async function frontierDay(sub: string): Promise<number> {
  const raw = await redis.get(keys.ringCount(sub));
  // `Number('not-a-number')` is NaN and `NaN || 0` is 0, so a corrupt/absent
  // value safely floors to day 1 — never NaN, never a drift.
  return (Number(raw) || 0) + 1;
}

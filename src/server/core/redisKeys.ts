// redisKeys — the central per-community Redis key-builder (DEV-02/DEV-05).
//
// A PURE string module: no `@devvit/web` import, no I/O, no entropy. Every key
// the data layer touches is built here so the `organism:{sub}:*` namespace has a
// single source of truth and never drifts between the trigger handlers, the ring
// store, and the sweeper. The same args always return the identical string and
// two distinct subs/days never collide — those are the invariants the unit tests
// (redisKeys.test.ts) lock down.
//
// `sub` is ALWAYS the platform-trusted `context.subredditId` server-side (V4) —
// never a client-supplied value. This module does not enforce that (it is just
// string building); the callers must derive `sub` from context.
//
// Schema (RESEARCH "Redis Key Schema"):
//   organism:{sub}:counters:{name}    int   per-day running counters (incrBy)
//   organism:{sub}:contributors:{day} SET   unique daily contributors (sAdd/sCard)
//   organism:{sub}:threads:{day}      ZSET  per-thread comment counts (zIncrBy)
//   organism:{sub}:ringCount          int   explicit ring index (no key scan)
//   organism:{sub}:ring:{n}           hash  ~25 scalars + seed per frozen ring
//   organism:{sub}:config             hash  genome/style/timezone snapshot
//   organism:{sub}:lastTickDay        int   idempotency guard for the daily tick
//   subs:registry                     SET   installed sub ids (sweeper enumerates)

/** A named per-day counter (e.g. 'comments', 'posts', 'replies', 'scoreSum'). */
export type CounterName = string;

/** The per-community Redis key namespace under `organism:{sub}`. */
const ns = (sub: string): string => `organism:${sub}`;

/**
 * keys — pure builders for every key in the `organism:{sub}:*` schema.
 *
 * Counters are standalone integer keys (RESEARCH Pattern 2 uses
 * `redis.incrBy(keys.counter(sub,'comments'), 1)`), so each counter name maps to
 * its own key. Day-scoped keys (`contributors`/`threads`) carry the day so the
 * tick can consume + clear exactly one day's accumulation.
 */
export const keys = {
  /** Standalone integer counter key for `name` under this sub (incrBy target). */
  counter(sub: string, name: CounterName): string {
    return `${ns(sub)}:counters:${name}`;
  },
  /** SET of unique contributor ids for `day` (sAdd → sCard = unique count). */
  contributors(sub: string, day: number): string {
    return `${ns(sub)}:contributors:${day}`;
  },
  /** ZSET of per-thread comment counts for `day` (zIncrBy → top threads). */
  threads(sub: string, day: number): string {
    return `${ns(sub)}:threads:${day}`;
  },
  /** Explicit ring index counter (DEV-05 — Devvit Redis has no key scan). */
  ringCount(sub: string): string {
    return `${ns(sub)}:ringCount`;
  },
  /** Hash for frozen ring `n` (~25 scalars + seed — never images). */
  ring(sub: string, n: number): string {
    return `${ns(sub)}:ring:${n}`;
  },
  /** Hash of this community's config snapshot (genome/style/timezone). */
  config(sub: string): string {
    return `${ns(sub)}:config`;
  },
  /** Idempotency guard: the last local day this sub froze a ring (tick double-fire). */
  lastTickDay(sub: string): string {
    return `${ns(sub)}:lastTickDay`;
  },
  /** SET of installed sub ids the hourly sweeper enumerates. */
  registry(): string {
    return 'subs:registry';
  },
} as const;

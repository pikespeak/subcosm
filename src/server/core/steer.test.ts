// steer — unit tests for the live-nudge Redis service (LIVE-01 / GAME-05).
//
// `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis (mirrors
// ring/tick tests) so this runs in the standalone (no-real-Devvit) runner. The
// fake implements incrBy / expire / hIncrBy / hGetAll — just enough to assert:
//   - the ATOMIC ActionBudget gate: accept up to cap, reject beyond it, and an
//     over-cap nudge does NOT aggregate (T-04-05 TOCTOU closed),
//   - hIncrBy SUM-not-overwrite: two +0.5 'branch' nudges leave branch=1.0, count=2
//     (T-04-07 no-clobber),
//   - readSteerAggregate folds the hash → typed sums + count (absent → all zeros),
//   - SteerRequestSchema clamps `amount` to [-1,1] and `param` to the enum (T-04-06).
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
  const ints = new Map<string, number>();
  const hashes = new Map<string, Record<string, number>>();
  const expireCalls: Array<{ key: string; seconds: number }> = [];

  const fakeRedis = {
    async incrBy(key: string, value: number): Promise<number> {
      const next = (ints.get(key) ?? 0) + value;
      ints.set(key, next);
      return next;
    },
    async expire(key: string, seconds: number): Promise<void> {
      expireCalls.push({ key, seconds });
    },
    async hIncrBy(key: string, field: string, value: number): Promise<number> {
      const hash = hashes.get(key) ?? {};
      const next = (hash[field] ?? 0) + value;
      hash[field] = next;
      hashes.set(key, hash);
      return next;
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      const hash = hashes.get(key);
      if (!hash) return {};
      // Redis returns hash fields as strings — mirror that so the SUT's Number() runs.
      return Object.fromEntries(
        Object.entries(hash).map(([k, v]) => [k, String(v)]),
      );
    },
  };

  return { ints, hashes, expireCalls, fakeRedis };
});

vi.mock('@devvit/web/server', () => ({ redis: h.fakeRedis }));

import { recordNudge, readSteerAggregate } from './steer';
import { keys } from './redisKeys';
import { SteerRequestSchema } from '../../shared/api';

const { ints, hashes, expireCalls, fakeRedis } = h;

const SUB = 't5_sub';
const DAY = 4;
const USER = 't2_user';
const CAP = 3;

beforeEach(() => {
  ints.clear();
  hashes.clear();
  expireCalls.length = 0;
});

describe('recordNudge — atomic ActionBudget gate (T-04-05)', () => {
  test('the first call accepts and returns remaining = cap - 1', async () => {
    const r = await recordNudge(SUB, DAY, USER, 'branch', 0.5, CAP);
    expect(r).toEqual({ accepted: true, remaining: CAP - 1 });
    // It aggregated into the steer hash.
    expect(hashes.get(keys.steer(SUB, DAY))?.['branch']).toBe(0.5);
    expect(hashes.get(keys.steer(SUB, DAY))?.['count']).toBe(1);
  });

  test('accepts exactly up to the cap, decrementing remaining each time', async () => {
    const r1 = await recordNudge(SUB, DAY, USER, 'branch', 0.2, CAP);
    const r2 = await recordNudge(SUB, DAY, USER, 'symmetry', 0.2, CAP);
    const r3 = await recordNudge(SUB, DAY, USER, 'hue', 0.2, CAP);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
    expect(r1.accepted && r2.accepted && r3.accepted).toBe(true);
  });

  test('the (cap+1)-th call REJECTS and does NOT aggregate (TOCTOU closed)', async () => {
    for (let i = 0; i < CAP; i++) {
      await recordNudge(SUB, DAY, USER, 'branch', 0.1, CAP);
    }
    const steerBefore = { ...hashes.get(keys.steer(SUB, DAY)) };

    const over = await recordNudge(SUB, DAY, USER, 'branch', 0.1, CAP);
    expect(over).toEqual({ accepted: false, remaining: 0 });
    // The steer hash is UNCHANGED by the rejected nudge (no extra branch / count).
    expect(hashes.get(keys.steer(SUB, DAY))).toEqual(steerBefore);
  });

  test('a per-user TTL backstop is set on the budget key', async () => {
    await recordNudge(SUB, DAY, USER, 'branch', 0.5, CAP);
    expect(expireCalls.some((c) => c.key === keys.budget(SUB, DAY, USER))).toBe(true);
  });

  test('two distinct users have independent budgets', async () => {
    for (let i = 0; i < CAP; i++) {
      await recordNudge(SUB, DAY, 't2_a', 'branch', 0.1, CAP);
    }
    // 't2_a' is exhausted, but a fresh user still has full budget.
    const fresh = await recordNudge(SUB, DAY, 't2_b', 'branch', 0.1, CAP);
    expect(fresh.accepted).toBe(true);
    expect(fresh.remaining).toBe(CAP - 1);
  });
});

describe('recordNudge — hIncrBy SUM semantics (T-04-07 no-clobber)', () => {
  test('two +0.5 branch nudges SUM to branch = 1.0, count = 2', async () => {
    await recordNudge(SUB, DAY, 't2_a', 'branch', 0.5, CAP);
    await recordNudge(SUB, DAY, 't2_b', 'branch', 0.5, CAP);
    const agg = await readSteerAggregate(SUB, DAY);
    expect(agg.branch).toBeCloseTo(1.0, 10);
    expect(agg.count).toBe(2);
  });

  test('mixed-param nudges accumulate per field independently', async () => {
    await recordNudge(SUB, DAY, 't2_a', 'branch', 0.3, CAP);
    await recordNudge(SUB, DAY, 't2_b', 'symmetry', -0.2, CAP);
    await recordNudge(SUB, DAY, 't2_c', 'hue', 0.7, CAP);
    const agg = await readSteerAggregate(SUB, DAY);
    expect(agg.branch).toBeCloseTo(0.3, 10);
    expect(agg.symmetry).toBeCloseTo(-0.2, 10);
    expect(agg.hue).toBeCloseTo(0.7, 10);
    expect(agg.count).toBe(3);
  });
});

describe('readSteerAggregate', () => {
  test('an absent steer hash folds to all zeros', async () => {
    const agg = await readSteerAggregate(SUB, DAY);
    expect(agg).toEqual({ branch: 0, symmetry: 0, hue: 0, count: 0 });
  });
});

describe('SteerRequestSchema — clamp + enum (T-04-06)', () => {
  test('amount: 0.5 with a valid param passes', () => {
    expect(SteerRequestSchema.parse({ param: 'branch', amount: 0.5 })).toEqual({
      param: 'branch',
      amount: 0.5,
    });
  });

  test('amount: 5 REJECTS (clamped to [-1, 1])', () => {
    expect(() => SteerRequestSchema.parse({ param: 'branch', amount: 5 })).toThrow();
  });

  test('amount: -5 REJECTS', () => {
    expect(() => SteerRequestSchema.parse({ param: 'hue', amount: -5 })).toThrow();
  });

  test('an unknown param REJECTS', () => {
    expect(() =>
      SteerRequestSchema.parse({ param: 'notAParam', amount: 0.1 }),
    ).toThrow();
  });

  test('a non-numeric amount REJECTS', () => {
    expect(() =>
      SteerRequestSchema.parse({ param: 'branch', amount: 'x' }),
    ).toThrow();
  });

  test('the fake redis exposes no hSet — aggregation is hIncrBy only (no clobber)', () => {
    expect((fakeRedis as Record<string, unknown>)['hSet']).toBeUndefined();
  });
});

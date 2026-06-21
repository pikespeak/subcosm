// tick — unit tests for the daily freeze (DEV-04 / DEV-05).
//
// `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis (mirrors
// counters/ring tests) so this runs in the standalone (no-real-Devvit) runner.
// The fake implements get/set/incrBy/hSet/hGet/hGetAll/zAdd/zCard/zRange/del so
// runTick can read the 03-02 accumulators back, write a ring, reset the day, and
// honour the lastTickDay idempotency guard. The tests assert:
//   - genomeVersion resolves from the configured preset (and defaults to the
//     Calm version when no config is set) — for BOTH the configured + unset case,
//   - the written ring's scalars + the deterministic seed = hash(sub, day, gv),
//   - conflict equals conflictComposite(read-back proxies),
//   - the day-scoped counters/SET/ZSET are reset after the freeze,
//   - a re-run for the same (or earlier) day is a no-op (lastTickDay guard),
//   - exactly one ring is written per tick, advancing ringCount by 1.
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
  const ints = new Map<string, number>();
  const strings = new Map<string, string>();
  const hashes = new Map<string, Record<string, string>>();
  const zsets = new Map<string, Map<string, number>>();
  const delCalls: string[] = [];

  const fakeRedis = {
    async get(key: string): Promise<string | undefined> {
      if (strings.has(key)) return strings.get(key);
      const v = ints.get(key);
      return v === undefined ? undefined : String(v);
    },
    async set(key: string, value: string): Promise<void> {
      strings.set(key, value);
    },
    async incrBy(key: string, value: number): Promise<number> {
      const next = (ints.get(key) ?? 0) + value;
      ints.set(key, next);
      return next;
    },
    async hSet(key: string, fields: Record<string, string>): Promise<number> {
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...fields });
      return Object.keys(fields).length;
    },
    async hGet(key: string, field: string): Promise<string | undefined> {
      return hashes.get(key)?.[field];
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      return { ...(hashes.get(key) ?? {}) };
    },
    async zAdd(
      key: string,
      ...members: Array<{ score: number; member: string }>
    ): Promise<number> {
      const set = zsets.get(key) ?? new Map<string, number>();
      for (const m of members) set.set(m.member, m.score);
      zsets.set(key, set);
      return members.length;
    },
    async zCard(key: string): Promise<number> {
      return zsets.get(key)?.size ?? 0;
    },
    async zIncrBy(key: string, member: string, value: number): Promise<number> {
      const set = zsets.get(key) ?? new Map<string, number>();
      const next = (set.get(member) ?? 0) + value;
      set.set(member, next);
      zsets.set(key, set);
      return next;
    },
    async zRange(
      key: string,
      _start: number,
      _stop: number,
      _opts?: unknown,
    ): Promise<Array<{ member: string; score: number }>> {
      const set = zsets.get(key);
      if (!set) return [];
      return [...set.entries()]
        .map(([member, score]) => ({ member, score }))
        .sort((a, b) => b.score - a.score); // reverse (highest first)
    },
    async del(...delKeys: string[]): Promise<void> {
      for (const k of delKeys) {
        delCalls.push(k);
        ints.delete(k);
        strings.delete(k);
        hashes.delete(k);
        zsets.delete(k);
      }
    },
  };

  return { ints, strings, hashes, zsets, delCalls, fakeRedis };
});

vi.mock('@devvit/web/server', () => ({ redis: h.fakeRedis }));

import { runTick } from './tick';
import { keys } from './redisKeys';
import { RingRecordSchema } from '../../engine/contracts';
import { calm } from '../../engine/genomes';

const { ints, strings, hashes, zsets, delCalls, fakeRedis } = h;

const SUB = 't5_sub';
const DAY = 4;

/** Seed the 03-02 accumulators for a community-day. */
async function seedAccumulators(sub: string, day: number): Promise<void> {
  ints.set(keys.counter(sub, 'posts'), 6);
  ints.set(keys.counter(sub, 'comments'), 20);
  ints.set(keys.counter(sub, 'replies'), 8);
  // 3 unique contributors (ZSET-as-set)
  await fakeRedis.zAdd(keys.contributors(sub, day), { member: 't2_a', score: day });
  await fakeRedis.zAdd(keys.contributors(sub, day), { member: 't2_b', score: day });
  await fakeRedis.zAdd(keys.contributors(sub, day), { member: 't2_c', score: day });
  // top threads ZSET
  await fakeRedis.zIncrBy(keys.threads(sub, day), 't3_p1', 9);
  await fakeRedis.zIncrBy(keys.threads(sub, day), 't3_p2', 4);
  await fakeRedis.zIncrBy(keys.threads(sub, day), 't3_p3', 1);
}

beforeEach(() => {
  ints.clear();
  strings.clear();
  hashes.clear();
  zsets.clear();
  delCalls.length = 0;
});

describe('runTick — freeze', () => {
  test('writes exactly one ring, advancing ringCount by 1', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    expect(ints.get(keys.ringCount(SUB))).toBe(1);
    expect(hashes.has(keys.ring(SUB, 1))).toBe(true);
  });

  test('the stored ring parses and carries the read-back proxies', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(Number(raw['posts'])).toBe(6);
    expect(Number(raw['comments'])).toBe(20);
    expect(Number(raw['contributors'])).toBe(3); // zCard
    expect(raw['day']).toBe(String(DAY));
    // topThreads is JSON-encoded, sorted high→low.
    expect(JSON.parse(raw['topThreads']!)).toEqual([9, 4, 1]);
    // The stored hash is a valid RingRecord when deserialized.
    expect(() =>
      RingRecordSchema.parse({
        ...Object.fromEntries(
          Object.entries(raw).map(([k, v]) =>
            k === 'topThreads' || k === 'steering' || k === 'outcome'
              ? [k, JSON.parse(v)]
              : k === 'date' || k === 'dominantTheme'
                ? [k, v]
                : [k, Number(v)],
          ),
        ),
      }),
    ).not.toThrow();
  });

  test('conflict equals conflictComposite of the read-back proxies', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    // conflictComposite({posts:6, comments:20, replies:8}); recompute the curve.
    const { conflictComposite } = await import('./conflict');
    expect(Number(raw['conflict'])).toBeCloseTo(
      conflictComposite({ posts: 6, comments: 20, replies: 8 }),
      10,
    );
  });
});

describe('runTick — scoring (GAME-02 / LIVE-03)', () => {
  test('the frozen ring carries an outcome scored from its DayVector', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    // outcome is JSON-encoded on write; it must be present and parse to an Outcome.
    expect(raw['outcome']).toBeDefined();
    const outcome = JSON.parse(raw['outcome']!);
    expect(typeof outcome.achieved).toBe('boolean');
    expect(outcome.degree).toBeGreaterThanOrEqual(0);
    expect(outcome.degree).toBeLessThanOrEqual(1);
    // default genome is Calm → conflictBelow 0.4; the goal travels with the outcome.
    expect(outcome.goal).toEqual(calm.dailyGoal);
  });

  test('the outcome equals score(dayVector, genome) deterministically', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    const outcome = JSON.parse(raw['outcome']!);
    // Re-derive from the stored DayVector scalars + the Calm genome (LIVE-03):
    // any client re-running score() on the ring gets the identical verdict.
    const { score } = await import('../../engine/score');
    const dayVector = {
      day: Number(raw['day']),
      date: raw['date']!,
      posts: Number(raw['posts']),
      comments: Number(raw['comments']),
      contributors: Number(raw['contributors']),
      scoreSum: Number(raw['scoreSum']),
      topThreads: JSON.parse(raw['topThreads']!),
      conflict: Number(raw['conflict']),
      momentum: Number(raw['momentum']),
      diversity: Number(raw['diversity']),
      dominantTheme: raw['dominantTheme']!,
      steering: JSON.parse(raw['steering']!),
      seed: Number(raw['seed']),
    };
    expect(outcome).toEqual(score(dayVector, calm));
  });

  test('the stored ring (with outcome) parses through RingRecordSchema', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(() =>
      RingRecordSchema.parse(
        Object.fromEntries(
          Object.entries(raw).map(([k, v]) =>
            k === 'topThreads' || k === 'steering' || k === 'outcome'
              ? [k, JSON.parse(v)]
              : k === 'date' || k === 'dominantTheme'
                ? [k, v]
                : [k, Number(v)],
          ),
        ),
      ),
    ).not.toThrow();
  });
});

describe('runTick — genomeVersion resolution', () => {
  test('defaults to the Calm preset version when no config is set', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(Number(raw['genomeVersion'])).toBe(calm.version);
  });

  test('resolves genomeVersion from the configured preset', async () => {
    await seedAccumulators(SUB, DAY);
    hashes.set(keys.config(SUB), { genome: 'chaotic' });
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    // All Phase-1 presets are version 1; assert it equals the chaotic preset's.
    const { chaotic } = await import('../../engine/genomes');
    expect(Number(raw['genomeVersion'])).toBe(chaotic.version);
  });

  test('an unrecognised configured genome id falls back to the Calm version', async () => {
    await seedAccumulators(SUB, DAY);
    hashes.set(keys.config(SUB), { genome: 'not-a-real-preset' });
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(Number(raw['genomeVersion'])).toBe(calm.version);
  });
});

describe('runTick — deterministic seed', () => {
  test('seed = hash(subId, day, genomeVersion) is stable for the same inputs', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const seed1 = Number(hashes.get(keys.ring(SUB, 1))!['seed']);

    // Reset everything and re-freeze the same (sub, day, gv) — same seed.
    ints.clear();
    strings.clear();
    hashes.clear();
    zsets.clear();
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const seed2 = Number(hashes.get(keys.ring(SUB, 1))!['seed']);

    expect(seed1).toBe(seed2);
    expect(Number.isInteger(seed1)).toBe(true);
  });

  test('a different day yields a different seed', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const seedA = Number(hashes.get(keys.ring(SUB, 1))!['seed']);

    ints.clear();
    strings.clear();
    hashes.clear();
    zsets.clear();
    await seedAccumulators(SUB, DAY + 1);
    await runTick(SUB, DAY + 1);
    const seedB = Number(hashes.get(keys.ring(SUB, 1))!['seed']);

    expect(seedA).not.toBe(seedB);
  });
});

describe('runTick — reset + idempotency', () => {
  test('resets the day counters / SET / ZSET after a successful freeze', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);

    // Day-scoped + global counters cleared so the next frontier starts clean.
    expect(zsets.has(keys.contributors(SUB, DAY))).toBe(false);
    expect(zsets.has(keys.threads(SUB, DAY))).toBe(false);
    expect(ints.get(keys.counter(SUB, 'posts'))).toBeUndefined();
    expect(ints.get(keys.counter(SUB, 'comments'))).toBeUndefined();
    expect(ints.get(keys.counter(SUB, 'replies'))).toBeUndefined();
    expect(delCalls).toContain(keys.contributors(SUB, DAY));
    expect(delCalls).toContain(keys.threads(SUB, DAY));
  });

  test('persists lastTickDay = day after the freeze', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    expect(strings.get(keys.lastTickDay(SUB))).toBe(String(DAY));
  });

  test('a re-run for the same day is a no-op (no second ring, ringCount unchanged)', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    expect(ints.get(keys.ringCount(SUB))).toBe(1);

    // Re-seed + re-fire the SAME day — the lastTickDay guard short-circuits.
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    expect(ints.get(keys.ringCount(SUB))).toBe(1); // still one ring
    expect(hashes.has(keys.ring(SUB, 2))).toBe(false);
  });

  test('a re-run for an EARLIER day is a no-op', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    await runTick(SUB, DAY - 1); // earlier than lastTickDay
    expect(ints.get(keys.ringCount(SUB))).toBe(1);
  });

  test('a later day after a freeze writes a second ring', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    await seedAccumulators(SUB, DAY + 1);
    await runTick(SUB, DAY + 1);
    expect(ints.get(keys.ringCount(SUB))).toBe(2);
    expect(strings.get(keys.lastTickDay(SUB))).toBe(String(DAY + 1));
  });
});

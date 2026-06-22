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
    async set(
      key: string,
      value: string,
      opts?: { nx?: boolean },
    ): Promise<string | null> {
      // Honour set-if-not-exists (the reveal exactly-once guard, OQ2): with nx set
      // and the key already present, this is a no-op returning null (mirrors the
      // 0.13.4 `redis.set` contract); otherwise set and return the value.
      if (opts?.nx && (strings.has(key) || ints.has(key))) return null;
      strings.set(key, value);
      return value;
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

  // Reveal-post side effect recorder (LIVE-02 / OQ2). Each accepted reveal pushes
  // its { subredditName, ringIndex, stickied } so the tests can assert exactly-once.
  const revealCalls: Array<{
    subredditName: string;
    ringIndex: number;
    stickied: boolean;
  }> = [];

  const fakeReddit = {
    // Trusted id → name resolution (V4): the tick resolves the subreddit name from
    // the platform-trusted subId, never a payload. 't5_sub' → 'subcosm_test'.
    async getSubredditInfoById(id: string): Promise<{ id: string; name: string }> {
      return { id, name: 'subcosm_test' };
    },
    async submitCustomPost(opts: {
      subredditName: string;
      title: string;
      entry?: string;
      postData?: { ringIndex: number };
    }): Promise<{ sticky(): Promise<void> }> {
      const call = {
        subredditName: opts.subredditName,
        ringIndex: opts.postData?.ringIndex ?? -1,
        stickied: false,
      };
      revealCalls.push(call);
      return {
        async sticky(): Promise<void> {
          call.stickied = true;
        },
      };
    },
  };

  return { ints, strings, hashes, zsets, delCalls, revealCalls, fakeRedis, fakeReddit };
});

vi.mock('@devvit/web/server', () => ({
  redis: h.fakeRedis,
  reddit: h.fakeReddit,
}));

import { runTick } from './tick';
import { keys } from './redisKeys';
import { RingRecordSchema } from '../../engine/contracts';
import { calm } from '../../engine/genomes';

const { ints, strings, hashes, zsets, delCalls, revealCalls, fakeRedis, fakeReddit } =
  h;

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
  revealCalls.length = 0;
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

describe('runTick — steer fold (OQ3 / D-08)', () => {
  /** Seed the per-day steer hash directly (as recordNudge's hIncrBy would leave it). */
  function seedSteer(
    sub: string,
    day: number,
    agg: { branch?: number; symmetry?: number; hue?: number; count: number },
  ): void {
    const fields: Record<string, string> = { count: String(agg.count) };
    if (agg.branch !== undefined) fields['branch'] = String(agg.branch);
    if (agg.symmetry !== undefined) fields['symmetry'] = String(agg.symmetry);
    if (agg.hue !== undefined) fields['hue'] = String(agg.hue);
    hashes.set(keys.steer(sub, day), fields);
  }

  test('an unsteered day folds to zero steering (no steer hash)', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(JSON.parse(raw['steering']!)).toEqual({ branch: 0, symmetry: 0, hue: 0 });
  });

  test('folds the aggregate MEAN × steerGain into the frozen steering, once', async () => {
    await seedAccumulators(SUB, DAY);
    // Two symmetry nudges summing to 1.0 over count 2 → mean 0.5; Calm steerGain.symmetry = 0.5.
    seedSteer(SUB, DAY, { symmetry: 1.0, count: 2 });
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    const steering = JSON.parse(raw['steering']!);
    // mean 0.5 × gain 0.5 = 0.25, applied exactly once.
    expect(steering.symmetry).toBeCloseTo(0.25, 10);
    // branch has no Calm steerGain entry → defaults to gain 1; mean 0 → 0.
    expect(steering.branch).toBeCloseTo(0, 10);
    // hue uses a fixed unit gain; no hue nudge → 0.
    expect(steering.hue).toBeCloseTo(0, 10);
  });

  test('hue folds at a fixed unit gain (mean, no steerGain knob)', async () => {
    await seedAccumulators(SUB, DAY);
    // hue 1.2 over count 3 → mean 0.4 × unit gain 1 = 0.4.
    seedSteer(SUB, DAY, { hue: 1.2, count: 3 });
    await runTick(SUB, DAY);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(JSON.parse(raw['steering']!).hue).toBeCloseTo(0.4, 10);
  });

  test('deletes the steer hash on freeze so the next frontier starts unsteered', async () => {
    await seedAccumulators(SUB, DAY);
    seedSteer(SUB, DAY, { branch: 0.5, count: 1 });
    await runTick(SUB, DAY);
    expect(hashes.has(keys.steer(SUB, DAY))).toBe(false);
    expect(delCalls).toContain(keys.steer(SUB, DAY));
  });

  test('the folded steering survives the ring round-trip parse', async () => {
    await seedAccumulators(SUB, DAY);
    seedSteer(SUB, DAY, { symmetry: 0.6, count: 2 });
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

describe('runTick — reveal post (LIVE-02 / OQ2 / T-04-13)', () => {
  test('creates exactly one pinned reveal post for the just-frozen ring', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);

    // Exactly one reveal post, celebrating the ring the tick just wrote (index 1),
    // pinned, with the subreddit NAME resolved from the trusted id (V4).
    expect(revealCalls).toHaveLength(1);
    expect(revealCalls[0]!.ringIndex).toBe(1);
    expect(revealCalls[0]!.subredditName).toBe('subcosm_test');
    expect(revealCalls[0]!.stickied).toBe(true);

    // The exactly-once guard flag is set for this day.
    expect(strings.get(keys.revealDone(SUB, DAY))).toBe('1');
  });

  test('a scheduler double-fire of the SAME day creates AT MOST one reveal post', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    // Re-fire the same day: the lastTickDay guard short-circuits before any reveal.
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);

    expect(revealCalls).toHaveLength(1);
  });

  test('the reveal nx-guard prevents a second reveal even if the freeze guard is bypassed', async () => {
    // Simulate the exactly-once flag already claimed (e.g. a prior partial fire set
    // revealDone but crashed before lastTickDay). A fresh freeze for the day must
    // write the ring but NOT create a second reveal (the nx-set returns null).
    strings.set(keys.revealDone(SUB, DAY), '1');
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);

    // Ring still frozen (the freeze is independent of the reveal guard) …
    expect(ints.get(keys.ringCount(SUB))).toBe(1);
    // … but NO reveal post, because the day was already revealDone.
    expect(revealCalls).toHaveLength(0);
  });

  test('a reveal-post failure does NOT corrupt the freeze (ring written, lastTickDay set)', async () => {
    // Force submitCustomPost to throw for this one run.
    const spy = vi
      .spyOn(fakeReddit, 'submitCustomPost')
      .mockRejectedValueOnce(new Error('reddit down'));

    await seedAccumulators(SUB, DAY);
    await expect(runTick(SUB, DAY)).resolves.toBeUndefined(); // never throws

    // The freeze committed despite the reveal failure (tolerable miss, never a crash).
    expect(ints.get(keys.ringCount(SUB))).toBe(1);
    expect(strings.get(keys.lastTickDay(SUB))).toBe(String(DAY));
    expect(revealCalls).toHaveLength(0);

    spy.mockRestore();
  });

  test('each new day creates its own reveal post (one per community per day)', async () => {
    await seedAccumulators(SUB, DAY);
    await runTick(SUB, DAY);
    await seedAccumulators(SUB, DAY + 1);
    await runTick(SUB, DAY + 1);

    expect(revealCalls).toHaveLength(2);
    expect(revealCalls.map((r) => r.ringIndex)).toEqual([1, 2]);
  });
});

// backfill — unit tests for the D-01 direct-ring-write history seeding.
//
// `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis + a reddit spy
// (mirrors tick.test.ts) so this runs in the standalone (no-real-Devvit) runner.
// The fake implements get/set/incrBy/hSet/hGet/hGetAll so backfillHistory can
// resolve the genome, write rings, and honour the ringCount idempotency guard.
// The reddit spy records any post-path call so the tests can assert the HARD
// prohibition: the backfill creates ZERO reveal posts (no 30-post spam — the key
// threat of this phase, RESEARCH Pitfall 2 / Q5).
//
// The tests assert:
//   - a fresh run writes one frozen ring per simulator day (ringCount === arc len),
//   - each ring's seed = hashSeed(subId, day, genomeVersion) (overriding the sim
//     seed), dominantTheme === 'community', and the stored hash parses through
//     RingRecordSchema (deterministic, schema-valid, cross-client-identical),
//   - ring index N corresponds to day N (oldest→newest, contiguous),
//   - re-running when ringCount > 0 is a no-op (idempotent — never doubles count),
//   - NO reveal post / submitCustomPost is ever called (rings only).
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
  const ints = new Map<string, number>();
  const strings = new Map<string, string>();
  const hashes = new Map<string, Record<string, string>>();

  const fakeRedis = {
    async get(key: string): Promise<string | undefined> {
      if (strings.has(key)) return strings.get(key);
      const v = ints.get(key);
      return v === undefined ? undefined : String(v);
    },
    async set(key: string, value: string): Promise<string> {
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
  };

  // Reddit post-path spy — backfill MUST NEVER touch it. Every method records a
  // call so the prohibition tests can assert it stays empty (zero reveal posts).
  const postCalls: string[] = [];
  const fakeReddit = {
    async getSubredditInfoById(id: string): Promise<{ id: string; name: string }> {
      postCalls.push('getSubredditInfoById');
      return { id, name: 'subcosm_test' };
    },
    async submitCustomPost(): Promise<{ sticky(): Promise<void> }> {
      postCalls.push('submitCustomPost');
      return { async sticky(): Promise<void> {} };
    },
  };

  return { ints, strings, hashes, postCalls, fakeRedis, fakeReddit };
});

vi.mock('@devvit/web/server', () => ({
  redis: h.fakeRedis,
  reddit: h.fakeReddit,
}));

import { backfillHistory, DEMO_SEED } from './backfill';
import { keys } from './redisKeys';
import { hashSeed } from './seed';
import { RingRecordSchema } from '../../engine/contracts';
import { calm } from '../../engine/genomes';
import { generateDayVectors } from '../../sim';
import { deserializeRing } from './ring';

const { ints, strings, hashes, postCalls } = h;

const SUB = 't5_sub';
const ARC = generateDayVectors({ seed: DEMO_SEED });
const ARC_LEN = ARC.length;

beforeEach(() => {
  ints.clear();
  strings.clear();
  hashes.clear();
  postCalls.length = 0;
});

describe('backfillHistory — fresh seed', () => {
  test('writes one frozen ring per simulator day (ringCount === arc length)', async () => {
    await backfillHistory(SUB);
    expect(ints.get(keys.ringCount(SUB))).toBe(ARC_LEN);
    expect(hashes.has(keys.ring(SUB, 1))).toBe(true);
    expect(hashes.has(keys.ring(SUB, ARC_LEN))).toBe(true);
  });

  test('returns the number of rings written', async () => {
    const written = await backfillHistory(SUB);
    expect(written).toBe(ARC_LEN);
  });

  test('ring index N corresponds to day N (oldest→newest, contiguous)', async () => {
    await backfillHistory(SUB);
    for (let n = 1; n <= ARC_LEN; n++) {
      const raw = hashes.get(keys.ring(SUB, n))!;
      expect(Number(raw['day'])).toBe(n);
    }
  });

  test('frontierDay after backfill is arcLength + 1', async () => {
    await backfillHistory(SUB);
    // frontierDay = (ringCount ?? 0) + 1 — assert via the stored ringCount.
    expect((Number(ints.get(keys.ringCount(SUB))) || 0) + 1).toBe(ARC_LEN + 1);
  });
});

describe('backfillHistory — deterministic, schema-valid, cross-client-identical rings', () => {
  test('each ring seed = hashSeed(subId, day, genomeVersion), overriding the sim seed', async () => {
    await backfillHistory(SUB);
    for (let n = 1; n <= ARC_LEN; n++) {
      const raw = hashes.get(keys.ring(SUB, n))!;
      const day = Number(raw['day']);
      const gv = Number(raw['genomeVersion']);
      expect(Number(raw['seed'])).toBe(hashSeed(SUB, day, gv));
      // The sim seed is NOT carried through — it is overridden by hashSeed.
      const simSeed = ARC.find((d) => d.day === day)!.seed;
      if (hashSeed(SUB, day, gv) !== simSeed) {
        expect(Number(raw['seed'])).not.toBe(simSeed);
      }
    }
  });

  test('each ring dominantTheme is "community" (matches the tick idiom)', async () => {
    await backfillHistory(SUB);
    for (let n = 1; n <= ARC_LEN; n++) {
      expect(hashes.get(keys.ring(SUB, n))!['dominantTheme']).toBe('community');
    }
  });

  test('each stored ring parses through RingRecordSchema', async () => {
    await backfillHistory(SUB);
    for (let n = 1; n <= ARC_LEN; n++) {
      const raw = hashes.get(keys.ring(SUB, n))!;
      expect(() => RingRecordSchema.parse(deserializeRing(raw))).not.toThrow();
    }
  });

  test('each ring carries a deterministically-scored outcome with the genome goal', async () => {
    await backfillHistory(SUB);
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(raw['outcome']).toBeDefined();
    const outcome = JSON.parse(raw['outcome']!);
    expect(typeof outcome.achieved).toBe('boolean');
    // Default genome is Calm → its goal travels with every scored outcome.
    expect(outcome.goal).toEqual(calm.dailyGoal);
  });

  test('rings reproduce byte-identically across runs (determinism)', async () => {
    await backfillHistory(SUB);
    const firstRun = hashes.get(keys.ring(SUB, 5))!;
    const snapshot = { ...firstRun };

    ints.clear();
    strings.clear();
    hashes.clear();
    await backfillHistory(SUB);
    expect(hashes.get(keys.ring(SUB, 5))!).toEqual(snapshot);
  });
});

describe('backfillHistory — idempotency (no double ringCount)', () => {
  test('a re-run when ringCount > 0 is a no-op (count unchanged)', async () => {
    await backfillHistory(SUB);
    expect(ints.get(keys.ringCount(SUB))).toBe(ARC_LEN);

    const writtenAgain = await backfillHistory(SUB);
    expect(writtenAgain).toBe(0); // no-op signals zero rings written
    expect(ints.get(keys.ringCount(SUB))).toBe(ARC_LEN); // never doubled
    expect(hashes.has(keys.ring(SUB, ARC_LEN + 1))).toBe(false);
  });

  test('skips entirely when a pre-existing ring is present (ringCount > 0)', async () => {
    // Simulate an organically-grown sub with one real ring already frozen.
    ints.set(keys.ringCount(SUB), 1);
    const writtenAgain = await backfillHistory(SUB);
    expect(writtenAgain).toBe(0);
    expect(ints.get(keys.ringCount(SUB))).toBe(1);
  });
});

describe('backfillHistory — prohibitions (RINGS ONLY, zero reveal posts)', () => {
  test('NEVER creates a reveal post (no submitCustomPost / post path)', async () => {
    await backfillHistory(SUB);
    expect(postCalls).toHaveLength(0);
  });

  test('does not set the revealDone guard for any day', async () => {
    await backfillHistory(SUB);
    for (let n = 1; n <= ARC_LEN; n++) {
      expect(strings.has(keys.revealDone(SUB, n))).toBe(false);
    }
  });

  test('does not advance lastTickDay (it is a direct ring write, not a tick)', async () => {
    await backfillHistory(SUB);
    expect(strings.has(keys.lastTickDay(SUB))).toBe(false);
  });
});

describe('backfillHistory — genome resolution', () => {
  test('uses the configured genome version for the seed + outcome goal', async () => {
    hashes.set(keys.config(SUB), { genome: 'chaotic' });
    await backfillHistory(SUB);
    const { chaotic } = await import('../../engine/genomes');
    const raw = hashes.get(keys.ring(SUB, 1))!;
    expect(Number(raw['genomeVersion'])).toBe(chaotic.version);
    expect(JSON.parse(raw['outcome']!).goal).toEqual(chaotic.dailyGoal);
  });

  test('defaults to the Calm preset version when no config is set', async () => {
    await backfillHistory(SUB);
    expect(Number(hashes.get(keys.ring(SUB, 1))!['genomeVersion'])).toBe(
      calm.version,
    );
  });
});

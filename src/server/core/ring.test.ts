// ring — unit tests for the scan-free Redis ring read/write service (DEV-05).
//
// `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis (mirrors
// counters.test.ts) so this runs in the standalone (no-real-Devvit) runner. The
// fake implements just enough (incrBy / hSet / hGetAll / get) to assert:
//   - writeRing increments keys.ringCount and hSets the serialized scalars under
//     keys.ring(sub, newCount); the returned index equals the new ringCount,
//   - readAllRings reads ringCount, hGetAll's ring 1..count, and returns
//     RingRecordSchema.parse'd records (the SINGLE read boundary parse),
//   - the serialize → deserialize → parse round-trip is lossless (incl.
//     topThreads array + steering object),
//   - readAllRings returns [] when ringCount is 0 / absent,
//   - NO redis.keys / scan is used (enumeration is the explicit ringCount only —
//     the fake has no keys/scan method, so any such call would throw).
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
  const ints = new Map<string, number>();
  const hashes = new Map<string, Record<string, string>>();
  const hSetCalls: Array<{ key: string; fields: Record<string, string> }> = [];
  const hGetAllCalls: string[] = [];
  const incrCalls: Array<{ key: string; value: number }> = [];

  const fakeRedis = {
    async get(key: string): Promise<string | undefined> {
      const v = ints.get(key);
      return v === undefined ? undefined : String(v);
    },
    async incrBy(key: string, value: number): Promise<number> {
      incrCalls.push({ key, value });
      const next = (ints.get(key) ?? 0) + value;
      ints.set(key, next);
      return next;
    },
    async hSet(key: string, fields: Record<string, string>): Promise<number> {
      hSetCalls.push({ key, fields });
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...fields });
      return Object.keys(fields).length;
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      hGetAllCalls.push(key);
      return { ...(hashes.get(key) ?? {}) };
    },
  };

  return { ints, hashes, hSetCalls, hGetAllCalls, incrCalls, fakeRedis };
});

vi.mock('@devvit/web/server', () => ({ redis: h.fakeRedis }));

import { writeRing, readAllRings } from './ring';
import { keys } from './redisKeys';
import { RingRecordSchema, type RingRecord } from '../../engine/contracts';

const { ints, hashes, hSetCalls, hGetAllCalls, incrCalls, fakeRedis } = h;

const SUB = 't5_sub';

function makeRing(overrides: Partial<RingRecord> = {}): RingRecord {
  return RingRecordSchema.parse({
    day: 4,
    date: '2026-06-04',
    posts: 12,
    comments: 30,
    contributors: 5,
    scoreSum: 84,
    topThreads: [8, 5, 2],
    conflict: 0.42,
    momentum: 0.1,
    diversity: 0.3,
    dominantTheme: 'genesis',
    steering: { branch: 0.2, symmetry: -0.1, hue: 0.5 },
    seed: 123456789,
    genomeVersion: 1,
    ...overrides,
  });
}

beforeEach(() => {
  ints.clear();
  hashes.clear();
  hSetCalls.length = 0;
  hGetAllCalls.length = 0;
  incrCalls.length = 0;
});

describe('writeRing', () => {
  test('increments keys.ringCount by 1 and hSets under keys.ring(sub, newCount)', async () => {
    const n = await writeRing(SUB, makeRing());

    expect(incrCalls).toContainEqual({ key: keys.ringCount(SUB), value: 1 });
    expect(ints.get(keys.ringCount(SUB))).toBe(1);
    expect(n).toBe(1);
    // hSet targets the new index, not an ad-hoc string.
    expect(hSetCalls[0]?.key).toBe(keys.ring(SUB, 1));
    // No image/pixel field is serialized (DEV-05).
    expect(hSetCalls[0]?.fields['image']).toBeUndefined();
  });

  test('the stored index equals the advanced ringCount across multiple writes', async () => {
    const n1 = await writeRing(SUB, makeRing({ day: 1 }));
    const n2 = await writeRing(SUB, makeRing({ day: 2 }));
    expect(n1).toBe(1);
    expect(n2).toBe(2);
    expect(hashes.has(keys.ring(SUB, 1))).toBe(true);
    expect(hashes.has(keys.ring(SUB, 2))).toBe(true);
  });
});

describe('readAllRings', () => {
  test('returns [] when ringCount is absent', async () => {
    const rings = await readAllRings(SUB);
    expect(rings).toEqual([]);
    // No ring hash was read (count short-circuits at 0).
    expect(hGetAllCalls).toEqual([]);
  });

  test('returns [] when ringCount is 0', async () => {
    ints.set(keys.ringCount(SUB), 0);
    expect(await readAllRings(SUB)).toEqual([]);
  });

  test('round-trips written rings losslessly through serialize → deserialize → parse', async () => {
    const a = makeRing({ day: 1, seed: 11, topThreads: [3, 1], steering: { branch: 0.1, symmetry: 0.2, hue: 0.3 } });
    const b = makeRing({ day: 2, seed: 22, topThreads: [9, 4, 2, 1], conflict: 0.9 });
    await writeRing(SUB, a);
    await writeRing(SUB, b);

    const rings = await readAllRings(SUB);
    expect(rings).toHaveLength(2);
    expect(rings[0]).toEqual(a);
    expect(rings[1]).toEqual(b);
    // The single read boundary read ring 1 then ring 2 via keys.ring (1..count).
    expect(hGetAllCalls).toEqual([keys.ring(SUB, 1), keys.ring(SUB, 2)]);
  });

  // Pitfall 5: a ring carrying a populated `outcome` object must survive the
  // serialize → deserialize → parse round-trip — the read-back outcome deep-equals
  // the written one (not NaN, not "[object Object]"). This is the T-04-01 mitigation:
  // 'outcome' must be in JSON_FIELDS so deserializeScalars JSON.parses it.
  test('round-trips a ring carrying an outcome object losslessly (Pitfall 5)', async () => {
    const withOutcome = makeRing({
      day: 3,
      seed: 33,
      outcome: {
        goal: {
          type: 'conflictBelow',
          targetParam: 'conflict',
          threshold: 0.4,
          direction: 'below',
        },
        measured: 0.31,
        achieved: true,
        degree: 0.5,
      },
    });
    await writeRing(SUB, withOutcome);

    const rings = await readAllRings(SUB);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toEqual(withOutcome);
    expect(rings[0]!.outcome).toEqual(withOutcome.outcome);
  });

  test('reads exactly ringCount hashes via keys.ring (no scan)', async () => {
    await writeRing(SUB, makeRing({ day: 1 }));
    await writeRing(SUB, makeRing({ day: 2 }));
    await writeRing(SUB, makeRing({ day: 3 }));
    await readAllRings(SUB);
    expect(hGetAllCalls).toEqual([
      keys.ring(SUB, 1),
      keys.ring(SUB, 2),
      keys.ring(SUB, 3),
    ]);
  });

  test('parses each ring through RingRecordSchema (the single read boundary)', async () => {
    await writeRing(SUB, makeRing());
    const spy = vi.spyOn(RingRecordSchema, 'parse');
    await readAllRings(SUB);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test('the fake redis exposes no keys/scan — enumeration is ringCount only', () => {
    expect((fakeRedis as Record<string, unknown>)['keys']).toBeUndefined();
    expect((fakeRedis as Record<string, unknown>)['scan']).toBeUndefined();
  });
});

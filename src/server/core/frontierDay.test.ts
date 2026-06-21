// frontierDay — unit tests for the single current/frontier-day-index helper.
//
// `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis (no real Devvit
// in the standalone runner). frontierDay(sub) is the ONE source of the current
// frontier day index = (ringCount ?? 0) + 1: it reads EXACTLY keys.ringCount(sub)
// (via the central key-builder, no ad-hoc string), returns 1 when no ring has
// frozen yet (absent or 0), and ringCount+1 otherwise. The triggers (write day)
// and the sweeper (freeze day, plan 03-04) both call this helper so the two can
// never drift (no off-by-one between write and freeze).
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
  const store = new Map<string, string>();
  const getCalls: string[] = [];
  const fakeRedis = {
    async get(key: string): Promise<string | undefined> {
      getCalls.push(key);
      return store.get(key);
    },
  };
  return { store, getCalls, fakeRedis };
});

vi.mock('@devvit/web/server', () => ({ redis: h.fakeRedis }));

import { frontierDay } from './frontierDay';
import { keys } from './redisKeys';

const { store, getCalls, fakeRedis } = h;
const SUB = 't5_sub';

beforeEach(() => {
  store.clear();
  getCalls.length = 0;
});

describe('frontierDay', () => {
  test('returns 1 when ringCount is absent (no ring frozen yet)', async () => {
    expect(await frontierDay(SUB)).toBe(1);
  });

  test('returns 1 when ringCount is explicitly 0', async () => {
    store.set(keys.ringCount(SUB), '0');
    expect(await frontierDay(SUB)).toBe(1);
  });

  test('returns ringCount + 1 when rings have frozen', async () => {
    store.set(keys.ringCount(SUB), '4');
    expect(await frontierDay(SUB)).toBe(5);
  });

  test('reads ONLY keys.ringCount(sub) — the central key, no ad-hoc string', async () => {
    await frontierDay(SUB);
    expect(getCalls).toEqual([keys.ringCount(SUB)]);
  });

  test('tolerates a non-numeric stored value as 0 (→ day 1)', async () => {
    store.set(keys.ringCount(SUB), 'not-a-number');
    expect(await frontierDay(SUB)).toBe(1);
  });

  test('is sub-scoped: distinct subs resolve independently', async () => {
    store.set(keys.ringCount('t5_a'), '2');
    store.set(keys.ringCount('t5_b'), '9');
    expect(await frontierDay('t5_a')).toBe(3);
    expect(await frontierDay('t5_b')).toBe(10);
  });

  // The fake is referenced so an unused-var lint never fires; the behavior is
  // asserted through frontierDay + getCalls above.
  test('uses the mocked redis client', () => {
    expect(typeof fakeRedis.get).toBe('function');
  });
});

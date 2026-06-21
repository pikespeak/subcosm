// config — unit tests for the install-config read + community registration service
// (DEV-06). `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis + a
// stubbed `settings.get`, so the suite runs in the standalone (no-real-Devvit)
// runner. The tests lock down:
//   - readConfig is the SINGLE settings boundary parse: it reads the three values
//     via settings.get and returns SettingsSchema.parse(...) — a valid triple
//     parses, an invalid one throws (rejected at the boundary, V5),
//   - registerCommunity adds the sub to subs:registry (idempotent — re-register is
//     a membership no-op) and snapshots genome/style/timezone to organism:{sub}:config,
//   - every key is built via keys.* (registry + config), never an ad-hoc string,
//   - the registry uses ZSET-as-set semantics (the SDK has no sAdd) — a repeat
//     register keeps cardinality at 1.
import { beforeEach, describe, expect, test, vi } from 'vitest';

// In-memory fake redis (ZSET-as-set + hash) + a settable settings stub, built in
// vi.hoisted so the hoisted vi.mock factory can reference it. `zAdd` is member-keyed
// (idempotent set semantics); `zRange` enumerates members; `hSet` records the snapshot.
const h = vi.hoisted(() => {
  const zsets = new Map<string, Map<string, number>>();
  const hashes = new Map<string, Record<string, string>>();
  const settingsStore: Record<string, unknown> = {};
  const zAddCalls: Array<{ key: string; member: string }> = [];
  const hSetCalls: Array<{ key: string; fields: Record<string, string> }> = [];

  const fakeRedis = {
    async zAdd(
      key: string,
      ...members: Array<{ score: number; member: string }>
    ): Promise<number> {
      const set = zsets.get(key) ?? new Map<string, number>();
      let added = 0;
      for (const m of members) {
        zAddCalls.push({ key, member: m.member });
        if (!set.has(m.member)) added += 1;
        set.set(m.member, m.score);
      }
      zsets.set(key, set);
      return added;
    },
    async zCard(key: string): Promise<number> {
      return zsets.get(key)?.size ?? 0;
    },
    async zRange(
      key: string
    ): Promise<Array<{ member: string; score: number }>> {
      const set = zsets.get(key);
      if (!set) return [];
      return [...set.entries()].map(([member, score]) => ({ member, score }));
    },
    async hSet(key: string, fields: Record<string, string>): Promise<number> {
      hSetCalls.push({ key, fields });
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...fields });
      return Object.keys(fields).length;
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      return hashes.get(key) ?? {};
    },
  };

  const settings = {
    async get(name: string): Promise<unknown> {
      return settingsStore[name];
    },
  };

  return { zsets, hashes, settingsStore, zAddCalls, hSetCalls, fakeRedis, settings };
});

vi.mock('@devvit/web/server', () => ({ redis: h.fakeRedis, settings: h.settings }));

import { readConfig, readSnapshot, registerCommunity } from './config';
import { keys } from './redisKeys';

const { zsets, hashes, settingsStore, zAddCalls, hSetCalls, fakeRedis } = h;

const SUB = 't5_sub';

beforeEach(() => {
  zsets.clear();
  hashes.clear();
  zAddCalls.length = 0;
  hSetCalls.length = 0;
  for (const k of Object.keys(settingsStore)) delete settingsStore[k];
});

describe('readConfig — the single settings boundary parse (current install context)', () => {
  test('reads the three settings and returns the parsed Settings', async () => {
    settingsStore.genome = 'calm';
    settingsStore.style = 'techno';
    settingsStore.timezone = 'Europe/Berlin';

    const cfg = await readConfig();
    expect(cfg).toEqual({
      genome: 'calm',
      style: 'techno',
      timezone: 'Europe/Berlin',
    });
  });

  test('throws (rejects at the boundary) when a setting is invalid', async () => {
    settingsStore.genome = 'calm';
    settingsStore.style = 'techno';
    settingsStore.timezone = 'Mars/Olympus'; // bogus IANA

    await expect(readConfig()).rejects.toThrow();
  });

  test('throws on an unknown genome id (V5)', async () => {
    settingsStore.genome = 'sparkly';
    settingsStore.style = 'techno';
    settingsStore.timezone = 'UTC';

    await expect(readConfig()).rejects.toThrow();
  });

  test('defaults UNSET settings to calm/techno/UTC (fresh install never saved them)', async () => {
    // settingsStore is empty → settings.get returns undefined for all three. A
    // fresh install must still render (genesis cold-start), not crash the boundary.
    const cfg = await readConfig();
    expect(cfg).toEqual({ genome: 'calm', style: 'techno', timezone: 'UTC' });
  });

  test('defaults an empty-string setting (not just undefined) to the install default', async () => {
    settingsStore.genome = '';
    settingsStore.style = '   ';
    settingsStore.timezone = '';

    const cfg = await readConfig();
    expect(cfg).toEqual({ genome: 'calm', style: 'techno', timezone: 'UTC' });
  });

  test('a PRESENT-but-invalid value still throws — only UNSET values are defaulted', async () => {
    settingsStore.genome = 'sparkly'; // present + invalid → must NOT be defaulted
    settingsStore.style = 'techno';
    // timezone unset → defaulted to UTC, but the bad genome still rejects.
    await expect(readConfig()).rejects.toThrow();
  });
});

describe('readSnapshot — per-sub config read for the sweeper (Redis snapshot, not settings)', () => {
  const cfg = { genome: 'calm', style: 'techno', timezone: 'Europe/Berlin' } as const;

  test('returns the parsed snapshot written by registerCommunity', async () => {
    await registerCommunity(SUB, cfg);
    const snap = await readSnapshot(SUB);
    expect(snap).toEqual(cfg);
  });

  test('returns null when no snapshot exists (community not yet configured)', async () => {
    expect(await readSnapshot('t5_unregistered')).toBeNull();
  });

  test('returns null on a malformed/legacy snapshot rather than throwing', async () => {
    hashes.set(keys.config(SUB), { genome: 'calm', style: 'techno', timezone: 'Mars/Olympus' });
    expect(await readSnapshot(SUB)).toBeNull();
  });
});

describe('registerCommunity — registry membership + config snapshot via keys.*', () => {
  const cfg = { genome: 'calm', style: 'techno', timezone: 'Europe/Berlin' } as const;

  test('adds the sub to subs:registry (keys.registry) as a ZSET member', async () => {
    await registerCommunity(SUB, cfg);
    expect(zAddCalls).toContainEqual({ key: keys.registry(), member: SUB });
    expect(await fakeRedis.zCard(keys.registry())).toBe(1);
  });

  test('snapshots genome/style/timezone to organism:{sub}:config (keys.config)', async () => {
    await registerCommunity(SUB, cfg);
    expect(hSetCalls).toContainEqual({
      key: keys.config(SUB),
      fields: { genome: 'calm', style: 'techno', timezone: 'Europe/Berlin' },
    });
    expect(await fakeRedis.hGetAll(keys.config(SUB))).toEqual({
      genome: 'calm',
      style: 'techno',
      timezone: 'Europe/Berlin',
    });
  });

  test('is idempotent — re-registering the same sub keeps registry cardinality at 1', async () => {
    await registerCommunity(SUB, cfg);
    await registerCommunity(SUB, cfg);
    expect(await fakeRedis.zCard(keys.registry())).toBe(1);
  });
});

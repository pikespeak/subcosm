// counters — unit tests for the Redis daily-accumulation service (DEV-02/03).
//
// `@devvit/web/server` is `vi.mock`ed to an in-memory fake redis so this test
// runs in the standalone (no-real-Devvit) runner: the mock replaces the import
// before it resolves, so no Devvit runtime is loaded. The fake records every
// call and implements just enough semantics (incrBy accumulates; zAdd is
// member-keyed/idempotent → zCard = unique cardinality) to assert that:
//   - bumpPost increments the post counter and adds the author once,
//   - bumpComment increments comments, adds the contributor (idempotent),
//     zIncrBy's the thread root, and bumps the reply proxy ONLY for a reply,
//   - all keys are derived via keys.* (never ad-hoc strings),
//   - a repeat author within a day is counted once (SET semantics) while the
//     comment counter still increments.
import { beforeEach, describe, expect, test, vi } from 'vitest';

// In-memory fake redis built inside `vi.hoisted` so the (hoisted) `vi.mock`
// factory can safely reference it. `zAdd` is keyed by member (set semantics),
// `zCard` returns the member count (= unique contributors), `zIncrBy`
// accumulates per-member scores. Call logs let us assert the exact key writes.
const h = vi.hoisted(() => {
  const incrCalls: Array<{ key: string; value: number }> = [];
  const zAddCalls: Array<{ key: string; member: string }> = [];
  const zIncrCalls: Array<{ key: string; member: string; value: number }> = [];
  const ints = new Map<string, number>();
  const zsets = new Map<string, Map<string, number>>();

  const fakeRedis = {
    async incrBy(key: string, value: number): Promise<number> {
      incrCalls.push({ key, value });
      const next = (ints.get(key) ?? 0) + value;
      ints.set(key, next);
      return next;
    },
    async zAdd(
      key: string,
      ...members: Array<{ score: number; member: string }>
    ): Promise<number> {
      const set = zsets.get(key) ?? new Map<string, number>();
      let added = 0;
      for (const m of members) {
        zAddCalls.push({ key, member: m.member });
        if (!set.has(m.member)) added += 1;
        set.set(m.member, m.score); // member-keyed → idempotent (set semantics)
      }
      zsets.set(key, set);
      return added;
    },
    async zIncrBy(key: string, member: string, value: number): Promise<number> {
      zIncrCalls.push({ key, member, value });
      const set = zsets.get(key) ?? new Map<string, number>();
      const next = (set.get(member) ?? 0) + value;
      set.set(member, next);
      zsets.set(key, set);
      return next;
    },
    async zCard(key: string): Promise<number> {
      return zsets.get(key)?.size ?? 0;
    },
  };

  return { incrCalls, zAddCalls, zIncrCalls, ints, zsets, fakeRedis };
});

vi.mock('@devvit/web/server', () => ({ redis: h.fakeRedis }));

import { bumpComment, bumpPost } from './counters';
import { keys } from './redisKeys';

const { incrCalls, zAddCalls, zIncrCalls, ints, zsets, fakeRedis } = h;

const SUB = 't5_sub';
const DAY = 3;

beforeEach(() => {
  incrCalls.length = 0;
  zAddCalls.length = 0;
  zIncrCalls.length = 0;
  ints.clear();
  zsets.clear();
});

describe('bumpPost', () => {
  test('increments the post counter and adds the author to the day contributor SET (via keys.*)', async () => {
    await bumpPost(SUB, DAY, { author: { id: 't2_a' }, post: { id: 't3_p' } });

    expect(ints.get(keys.counter(SUB, 'posts'))).toBe(1);
    expect(zAddCalls).toContainEqual({ key: keys.contributors(SUB, DAY), member: 't2_a' });
    // unique-contributor cardinality reflects the one author.
    const card = await fakeRedis.zCard(keys.contributors(SUB, DAY));
    expect(card).toBe(1);
  });
});

describe('bumpComment', () => {
  test('increments comments, adds contributor, zIncrBy thread root; no reply proxy for a top-level comment', async () => {
    await bumpComment(SUB, DAY, {
      author: { id: 't2_a' },
      comment: { id: 't1_c', author: 't2_a', postId: 't3_p', parentId: 't3_p' }, // t3_ → top-level
      post: { id: 't3_p' },
    });

    expect(ints.get(keys.counter(SUB, 'comments'))).toBe(1);
    expect(zAddCalls).toContainEqual({ key: keys.contributors(SUB, DAY), member: 't2_a' });
    expect(zIncrCalls).toContainEqual({ key: keys.threads(SUB, DAY), member: 't3_p', value: 1 });
    // top-level (parentId t3_) → reply proxy NOT incremented.
    expect(ints.get(keys.counter(SUB, 'replies'))).toBeUndefined();
  });

  test('increments the reply proxy ONLY when parentId is a comment (t1_ reply)', async () => {
    await bumpComment(SUB, DAY, {
      author: { id: 't2_a' },
      comment: { id: 't1_c2', author: 't2_a', postId: 't3_p', parentId: 't1_parent' }, // t1_ → reply
      post: { id: 't3_p' },
    });
    expect(ints.get(keys.counter(SUB, 'replies'))).toBe(1);
  });

  test('a missing parentId is treated as a top-level comment (no reply proxy)', async () => {
    await bumpComment(SUB, DAY, {
      author: { id: 't2_a' },
      comment: { id: 't1_c3', author: 't2_a', postId: 't3_p' }, // no parentId
      post: { id: 't3_p' },
    });
    expect(ints.get(keys.counter(SUB, 'replies'))).toBeUndefined();
  });

  test('repeat author in a day is counted once (SET) but the comment counter still increments', async () => {
    const payload = {
      author: { id: 't2_a' },
      comment: { id: 't1_c', author: 't2_a', postId: 't3_p', parentId: 't3_p' },
      post: { id: 't3_p' },
    };
    await bumpComment(SUB, DAY, payload);
    await bumpComment(SUB, DAY, payload);

    expect(ints.get(keys.counter(SUB, 'comments'))).toBe(2); // counter increments twice
    const card = await fakeRedis.zCard(keys.contributors(SUB, DAY));
    expect(card).toBe(1); // contributor added once (idempotent)
  });

  test('the contributor SET uses the authoritative comment.author string id, not author.id', async () => {
    await bumpComment(SUB, DAY, {
      author: { id: 't2_nested' },
      comment: { id: 't1_c', author: 't2_authoritative', postId: 't3_p', parentId: 't3_p' },
      post: { id: 't3_p' },
    });
    expect(zAddCalls).toContainEqual({
      key: keys.contributors(SUB, DAY),
      member: 't2_authoritative',
    });
  });
});

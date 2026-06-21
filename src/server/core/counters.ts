// counters — the Redis daily-accumulation service (DEV-02/DEV-03).
//
// Turns a parsed (boundary-validated) trigger payload into per-community Redis
// writes: post/comment counters (incrBy), the unique-contributor SET, the
// top-threads ZSET, and the reply-depth proxy counter. The trigger handlers call
// `bumpPost`/`bumpComment` AFTER the boundary `.parse()` — this module trusts
// the inferred payload type and derives NOTHING from raw client input. `sub` is
// the platform-trusted `context.subredditId`, passed in by the handler (V4); the
// `day` is `frontierDay(sub)`, also resolved by the handler — counters never
// inline `ringCount+1` (single source of the day index).
//
// All keys come from the central `keys.*` builder — no ad-hoc Redis strings, and
// NO `redis.keys`/scan anywhere (Pitfall 4 — Devvit Redis has no scan).
//
// ── Contributor "SET" via a ZSET ─────────────────────────────────────────────
// The Devvit `@devvit/web/server` redis client (v0.13.4) exposes NO native set
// ops (`sAdd`/`sCard` do not exist in the SDK). DEV-02 still requires O(1)
// idempotent add + O(1) cardinality for unique daily contributors, so we use a
// ZSET keyed by the contributor id: `zAdd(key, {member: authorId, score: day})`
// is member-keyed (idempotent — re-adding the same author is a no-op on
// membership), and `zCard(key)` returns the unique cardinality at tick time.
// Same key namespace (`keys.contributors`), same day-scoping, same intent — the
// only change is the primitive (ZSET-as-set) the SDK actually ships. The score
// carries `day` purely as a stable, meaningful payload (membership is what
// matters); it is never read for ranking.
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';
import type {
  CommentCreatePayload,
  PostCreatePayload,
} from '../contracts/triggers';

/** True when a comment is a reply (its parent is another COMMENT → `t1_…`). */
function isReply(parentId: string | undefined): boolean {
  // 03-01 spike: parentId `t1_` = reply (parent is a comment, deeper thread →
  // contention signal); `t3_` = top-level (parent is the post). Absent parentId
  // is treated as top-level.
  return parentId?.startsWith('t1_') ?? false;
}

/**
 * bumpPost — accumulate one post into the per-community daily counters (DEV-02).
 * Increments the `posts` counter and adds the author to the day's unique
 * contributor SET (ZSET-as-set). Writes run in parallel (RESEARCH Pattern 2).
 */
export async function bumpPost(
  sub: string,
  day: number,
  payload: PostCreatePayload,
): Promise<void> {
  await Promise.all([
    redis.incrBy(keys.counter(sub, 'posts'), 1),
    redis.zAdd(keys.contributors(sub, day), {
      member: payload.author.id,
      score: day,
    }),
  ]);
}

/**
 * bumpComment — accumulate one comment into the per-community daily counters
 * (DEV-02/DEV-03). Increments the `comments` counter, adds the authoritative
 * `comment.author` id to the unique contributor SET, `zIncrBy`s the thread root
 * (`comment.postId`) in the top-threads ZSET, and increments the reply-depth
 * proxy counter ONLY when the comment is a reply (`parentId` starts `t1_`).
 * Writes run in parallel (RESEARCH Pattern 2).
 */
export async function bumpComment(
  sub: string,
  day: number,
  payload: CommentCreatePayload,
): Promise<void> {
  const writes: Array<Promise<unknown>> = [
    redis.incrBy(keys.counter(sub, 'comments'), 1),
    // Unique contributor — the authoritative `comment.author` string id (03-01).
    redis.zAdd(keys.contributors(sub, day), {
      member: payload.comment.author,
      score: day,
    }),
    // Top threads — accumulate per thread root (`comment.postId` = t3_…).
    redis.zIncrBy(keys.threads(sub, day), payload.comment.postId, 1),
  ];

  // Reply-depth proxy (DEV-03 input) — only a reply (parent is a comment) bumps it.
  if (isReply(payload.comment.parentId)) {
    writes.push(redis.incrBy(keys.counter(sub, 'replies'), 1));
  }

  await Promise.all(writes);
}

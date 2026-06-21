// debug — TEMPORARY mod-only diagnostics for on-device UAT (Phase 3).
//
// Surfaces the live frontier-day Redis accumulators as a toast so a moderator can
// verify, on a real phone, that triggers actually move the counters/contributor
// set/threads ZSET (UAT test 2) and inspect the ring/freeze state (test 3) without
// a second machine. READ-ONLY: it never writes Redis and never mutates the Scene.
//
// `sub` is the platform-trusted `context.subredditId` (V4) — never client input.
// Mirrors the exact reads the tick performs (`get` counters, `zCard` for the
// ZSET-as-set contributors + threads), via the central `keys.*` builder.
//
// REMOVE BEFORE SUBMIT: delete this file, its `internal.route('/debug', …)` mount
// in src/server/index.ts, and the "Subcosm: Dump day state" item in devvit.json.
import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { keys } from '../core/redisKeys';
import { frontierDay } from '../core/frontierDay';

export const debug = new Hono();

const n = (raw: unknown): number => Number(raw ?? 0) || 0;

// POST /internal/debug/day — dump the current frontier-day accumulators as a toast.
debug.post('/day', async (c) => {
  const sub = context.subredditId;
  if (!sub) {
    return c.json<UiResponse>({ showToast: 'debug: no subredditId in context' }, 400);
  }

  try {
    const day = await frontierDay(sub);
    const [postsRaw, commentsRaw, repliesRaw, contributors, threadCount, ringCountRaw, lastTickRaw] =
      await Promise.all([
        redis.get(keys.counter(sub, 'posts')),
        redis.get(keys.counter(sub, 'comments')),
        redis.get(keys.counter(sub, 'replies')),
        redis.zCard(keys.contributors(sub, day)),
        redis.zCard(keys.threads(sub, day)),
        redis.get(keys.ringCount(sub)),
        redis.get(keys.lastTickDay(sub)),
      ]);

    const summary =
      `day ${day} · posts ${n(postsRaw)} comments ${n(commentsRaw)} replies ${n(repliesRaw)} · ` +
      `contrib ${contributors} · threads ${threadCount} · rings ${n(ringCountRaw)} · lastTick ${n(lastTickRaw)}`;

    console.log(`[debug/day] sub=${sub} ${summary}`);
    return c.json<UiResponse>({ showToast: summary }, 200);
  } catch (error) {
    console.error(`[debug/day] error for sub ${sub}:`, error);
    return c.json<UiResponse>({ showToast: 'debug: read failed (see logs)' }, 400);
  }
});

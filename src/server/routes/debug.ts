// debug — TEMPORARY mod-only UAT diagnostics + drivers (Phase 3).
//
// Lets a single moderator drive + inspect the whole data pipeline on a real phone
// — no second user, no waiting for the local-midnight cron — to verify UAT tests
// 2 (triggers move the accumulators) and 3 (freeze → populated render):
//   /day   READ-ONLY — toast the live frontier-day accumulators.
//   /tick  force the daily freeze NOW via the REAL runTick (no waiting for cron).
//   /seed  build a varied multi-shell demo universe via the REAL freeze path
//          (seed varied accumulators → runTick, N times) — proves read→freeze→
//          render with depth + data-driven differentiation.
//   /reset wipe this sub's organism:* state (rings/counters) for a clean re-run;
//          the install config snapshot is kept.
//
// `sub` is the platform-trusted `context.subredditId` (V4) — never client input.
// All Redis access goes through the central `keys.*` builder; rings are frozen by
// the production `runTick` (deterministic FNV-1a seed, RingRecordSchema.parse) —
// nothing is hand-faked. The seed values are deterministic (no Math.random).
//
// REMOVE BEFORE SUBMIT: delete this file, its `internal.route('/debug', …)` mount
// in src/server/index.ts, and the four "Subcosm: …" items in devvit.json.
import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { keys } from '../core/redisKeys';
import { frontierDay } from '../core/frontierDay';
import { runTick } from '../core/tick';

export const debug = new Hono();

const n = (raw: unknown): number => Number(raw ?? 0) || 0;
const ringCountOf = async (sub: string): Promise<number> => n(await redis.get(keys.ringCount(sub)));

/** Number of varied days the /seed action grows in one tap. */
const DEMO_DAYS = 6;

// POST /internal/debug/day — dump the current frontier-day accumulators as a toast.
debug.post('/day', async (c) => {
  const sub = context.subredditId;
  if (!sub) return c.json<UiResponse>({ showToast: 'debug: no subredditId in context' }, 400);

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

// POST /internal/debug/tick — force-freeze the current frontier day NOW.
debug.post('/tick', async (c) => {
  const sub = context.subredditId;
  if (!sub) return c.json<UiResponse>({ showToast: 'debug: no subredditId in context' }, 400);

  try {
    const day = await frontierDay(sub);
    const before = await ringCountOf(sub);
    await runTick(sub, day);
    const after = await ringCountOf(sub);
    const msg =
      after > before
        ? `froze day ${day} → ring ${after} (frontier now day ${after + 1})`
        : `no-op: day ${day} already frozen (rings ${after})`;
    console.log(`[debug/tick] sub=${sub} ${msg}`);
    return c.json<UiResponse>({ showToast: msg }, 200);
  } catch (error) {
    console.error(`[debug/tick] error for sub ${sub}:`, error);
    return c.json<UiResponse>({ showToast: 'debug: tick failed (see logs)' }, 400);
  }
});

// POST /internal/debug/seed — grow DEMO_DAYS varied shells via the REAL freeze path.
debug.post('/seed', async (c) => {
  const sub = context.subredditId;
  if (!sub) return c.json<UiResponse>({ showToast: 'debug: no subredditId in context' }, 400);

  try {
    for (let i = 0; i < DEMO_DAYS; i++) {
      const day = await frontierDay(sub);
      // Deterministic, per-day-varied activity (no Math.random) so every frozen
      // shell differs — visible proof of data-driven differentiation.
      const posts = 2 + (day % 4);
      const comments = 4 + ((day * 3) % 17);
      const replies = (day * 2) % 5;
      const contributors = 2 + (day % 4);
      const threadCount = 1 + (day % 3);

      const writes: Array<Promise<unknown>> = [
        redis.incrBy(keys.counter(sub, 'posts'), posts),
        redis.incrBy(keys.counter(sub, 'comments'), comments),
      ];
      if (replies > 0) writes.push(redis.incrBy(keys.counter(sub, 'replies'), replies));
      for (let k = 0; k < contributors; k++) {
        writes.push(redis.zAdd(keys.contributors(sub, day), { member: `seed_u_${day}_${k}`, score: day }));
      }
      for (let t = 0; t < threadCount; t++) {
        writes.push(redis.zIncrBy(keys.threads(sub, day), `t3_seed_${day}_${t}`, 1 + ((day + t) % 5)));
      }
      await Promise.all(writes);
      await runTick(sub, day); // freeze via the production path (deterministic seed)
    }

    const total = await ringCountOf(sub);
    const msg = `seeded ${DEMO_DAYS} varied rings (now ${total} total) — reopen the post`;
    console.log(`[debug/seed] sub=${sub} ${msg}`);
    return c.json<UiResponse>({ showToast: msg }, 200);
  } catch (error) {
    console.error(`[debug/seed] error for sub ${sub}:`, error);
    return c.json<UiResponse>({ showToast: 'debug: seed failed (see logs)' }, 400);
  }
});

// POST /internal/debug/reset — wipe this sub's organism:* state (config kept).
debug.post('/reset', async (c) => {
  const sub = context.subredditId;
  if (!sub) return c.json<UiResponse>({ showToast: 'debug: no subredditId in context' }, 400);

  try {
    const count = await ringCountOf(sub);
    const frontier = count + 1;
    const dels: string[] = [
      keys.counter(sub, 'posts'),
      keys.counter(sub, 'comments'),
      keys.counter(sub, 'replies'),
      keys.ringCount(sub),
      keys.lastTickDay(sub),
    ];
    for (let r = 1; r <= count; r++) dels.push(keys.ring(sub, r));
    for (let d = 1; d <= frontier; d++) {
      dels.push(keys.contributors(sub, d));
      dels.push(keys.threads(sub, d));
    }
    await redis.del(...dels);
    const msg = `reset — cleared ${count} rings + counters (config kept)`;
    console.log(`[debug/reset] sub=${sub} ${msg}`);
    return c.json<UiResponse>({ showToast: msg }, 200);
  } catch (error) {
    console.error(`[debug/reset] error for sub ${sub}:`, error);
    return c.json<UiResponse>({ showToast: 'debug: reset failed (see logs)' }, 400);
  }
});

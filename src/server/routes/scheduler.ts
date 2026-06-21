// scheduler — the daily freeze tick endpoint (DEV-04).
//
// A Hono router (mirrors routes/triggers.ts) mounted at /internal/scheduler. The
// one-off `tick` task (declared in devvit.json) is invoked at runtime via
// `scheduler.runJob` by the hourly sweeper (plan 03-04) once a community crosses
// its local midnight; this plan only delivers the endpoint that freezes the
// frontier.
//
// BOUNDARY (T-03-06): the scheduler `data` payload is UNTRUSTED input crossing
// into the server, so the handler `TickJobSchema.parse()`s it before calling
// runTick — a malformed payload is rejected (V5), never run. The handler mirrors
// the triggers.ts try/catch + typed-response envelope.
//
// NOTE: this `scheduler` is the Hono ROUTER, distinct from the `scheduler`
// capability client exported by `@devvit/web/server` (used by the sweeper to
// enqueue this task). They never collide here because this module imports no
// `@devvit/web/server` scheduler client — it only routes the inbound task.
import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
// The `scheduler` capability client (runJob) is aliased to `schedulerClient` so it
// does not collide with the Hono ROUTER `scheduler` exported below. `redis` is the
// SDK client; the sweeper enumerates the registry + reads per-sub snapshots through
// it (via core/config).
import { redis, scheduler as schedulerClient } from '@devvit/web/server';
import { TickJobSchema } from '../contracts/tickJob';
import { runTick } from '../core/tick';
import { keys } from '../core/redisKeys';
import { readSnapshot } from '../core/config';
import { frontierDay } from '../core/frontierDay';
import { isLocalMidnightWithJitter } from '../core/schedule';

export const scheduler = new Hono();

// POST /tick — freeze a community's frontier into a Ring record.
//
// The sweeper (03-04) enqueues this one-off task with `data: { subId, day }`.
// We BOUNDARY-parse `data` (T-03-06) then delegate to the idempotent runTick
// (a double-fire writes at most one ring per local day — T-03-07). The
// `TaskResponse` is intentionally empty per the 0.13.4 contract.
scheduler.post('/tick', async (c) => {
  try {
    const req = await c.req.json<TaskRequest>();
    const { subId, day } = TickJobSchema.parse(req.data); // BOUNDARY parse
    await runTick(subId, day);
    return c.json<TaskResponse>({}, 200);
  } catch (error) {
    console.error(`[scheduler/tick] failed: ${error}`);
    // A malformed payload (or transient failure) must not crash the scheduler;
    // log and return 200 — runTick is idempotent, so a retry is safe.
    return c.json<TaskResponse>({}, 200);
  }
});

// POST /sweeper — the hourly UTC cron (declared in devvit.json scheduler.tasks).
//
// Runs every hour in UTC and decides, per installed community, whether THAT
// community's local clock is at midnight — firing its freeze tick only then. The
// flow (RESEARCH Pattern 4):
//   1. enumerate the installed communities from subs:registry (a ZSET-as-set — the
//      SDK has no sMembers, so `zRange(registry, 0, -1)` lists the members),
//   2. for each, read its config snapshot (organism:{sub}:config) for the IANA tz
//      — NOT settings.get, which is scoped to the current context, not an arbitrary
//      sub (see core/config readSnapshot),
//   3. gate on the PURE, DST-safe `isLocalMidnightWithJitter(now, tz, sub)` helper
//      (local 00:xx past the deterministic hash(sub)%60 minute jitter — never
//      server-UTC `getHours()`, T-03-10),
//   4. for a due community, resolve the day to freeze via the SINGLE shared
//      `frontierDay(sub)` helper (so the freeze day equals the accumulators' write
//      day — no off-by-one) and `runJob` the one-off `tick` task (03-03). The tick
//      is idempotent via its lastTickDay guard, so an overlapping/late sweep is
//      safe (T-03-07) and this whole handler is safe to run every hour.
//
// Per-sub failures are isolated: one community's bad snapshot or runJob error is
// logged and skipped, never aborting the rest of the sweep. The handler always
// returns 200 (the cron must not crash on a transient error — the next hourly run
// retries; the tick guard makes that harmless).
scheduler.post('/sweeper', async (c) => {
  try {
    const members = await redis.zRange(keys.registry(), 0, -1);
    const nowUtc = new Date();

    for (const { member: sub } of members) {
      try {
        const cfg = await readSnapshot(sub);
        if (!cfg) continue; // no/invalid snapshot — skip until configured
        if (!isLocalMidnightWithJitter(nowUtc, cfg.timezone, sub)) continue;

        const day = await frontierDay(sub); // single day-index source (no inline +1)
        await schedulerClient.runJob({
          name: 'tick', // matches devvit.json scheduler.tasks.tick
          data: { subId: sub, day },
          runAt: new Date(),
        });
      } catch (perSubError) {
        // Isolate one community's failure so it cannot stall the whole sweep.
        console.error(`[scheduler/sweeper] sub=${sub} failed: ${perSubError}`);
      }
    }

    return c.json<TaskResponse>({}, 200);
  } catch (error) {
    console.error(`[scheduler/sweeper] failed: ${error}`);
    return c.json<TaskResponse>({}, 200);
  }
});

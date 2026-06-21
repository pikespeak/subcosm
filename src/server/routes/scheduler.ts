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
import { TickJobSchema } from '../contracts/tickJob';
import { runTick } from '../core/tick';

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

// menu — the mod-only subreddit menu actions (mounted at /internal/menu).
//
// A Hono router. Every action here is gated to moderators in devvit.json
// (`forUserType: "moderator"`, V4) and acts on the platform-trusted
// `context.subredditId` — NEVER a client-supplied sub/day (RESEARCH Q6 /
// Security V4/V5). Each handler BOUNDARY-parses its request with
// MenuActionRequestSchema and is wrapped in try/catch returning a UiResponse
// toast on failure, so a malformed payload or transient error shows a toast
// instead of crashing (mirrors scheduler.ts return-discipline, T-05-07).
import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { backfillHistory } from '../core/backfill';
import { runTick } from '../core/tick';
import { frontierDay } from '../core/frontierDay';
import { MenuActionRequestSchema } from '../contracts/menuActions';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

// POST /backfill — D-01: seed the demo subreddit with the deterministic 30-day
// simulator arc as frozen rings (so judges open onto a populated "depth = time"
// universe). Writes RINGS ONLY (no reveal posts — backfillHistory enforces that),
// idempotent (no-op when ringCount > 0). The target sub is the trusted
// context.subredditId (V4) — never a client-supplied id.
menu.post('/backfill', async (c) => {
  try {
    // BOUNDARY parse (V5 / T-05-07): reject a malformed payload before acting. We
    // trust no field from the body — the sub comes from context.
    MenuActionRequestSchema.parse(await c.req.json().catch(() => ({})));

    const subId = context.subredditId;
    if (!subId) throw new Error('no subredditId in context');

    const written = await backfillHistory(subId);
    return c.json<UiResponse>(
      {
        showToast:
          written > 0
            ? `Seeded demo history: ${written} days frozen.`
            : 'Demo history already seeded — nothing to do.',
      },
      200
    );
  } catch (error) {
    console.error(`[menu/backfill] failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to seed demo history' }, 400);
  }
});

// POST /force-tick — D-08: advance the day / trigger a tick on demand. Freezes the
// current frontier and creates the single pinned reveal post (exactly-once via
// runTick's revealDone nx-guard). The day is resolved server-side via frontierDay
// (the single day-index source) — never a client-supplied day; the sub is the
// trusted context.subredditId (V4). Idempotent (runTick lastTickDay guard), so the
// button is safe to re-fire.
menu.post('/force-tick', async (c) => {
  try {
    // BOUNDARY parse (V5 / T-05-07): reject a malformed payload before acting.
    MenuActionRequestSchema.parse(await c.req.json().catch(() => ({})));

    const subId = context.subredditId;
    if (!subId) throw new Error('no subredditId in context');

    const day = await frontierDay(subId); // single server-side day source (V4)
    await runTick(subId, day);
    return c.json<UiResponse>(
      { showToast: `Advanced day ${day} — frontier frozen + revealed.` },
      200
    );
  } catch (error) {
    console.error(`[menu/force-tick] failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to advance day' }, 400);
  }
});

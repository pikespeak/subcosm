import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import {
  CommentCreatePayloadSchema,
  PostCreatePayloadSchema,
} from '../contracts/triggers';
import { bumpComment, bumpPost } from '../core/counters';
import { frontierDay } from '../core/frontierDay';

export const triggers = new Hono();

// The app's own account id (`subcosm-universe`, captured in the 03-01 spike).
// The scaffold post auto-created on install fires `onPostCreate` as this author;
// it is app machinery, NOT community activity, so it is skipped when counting
// (03-01-SUMMARY edge note) — otherwise every install would seed a phantom post.
const APP_ACCOUNT_ID = 't2_2gtt4hhdg3';

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

// onPostCreate / onCommentCreate — DEV-02/DEV-03 daily accumulation.
//
// Flow (RESEARCH Pattern 2, plan 03-02): BOUNDARY `.parse()` the raw body
// (T-03-01/V5) → resolve the write day via the single `frontierDay(sub)` helper
// (NEVER inline `ringCount+1`) → accumulate into Redis via counters.ts
// (`bumpPost`/`bumpComment`). The handler only ACCUMULATES proxies; the
// `conflict` composite is derived later, at tick time (D-02), from these
// accumulated counts — it is not computed here.
//
// `sub` is derived from `context.subredditId` server-side, NEVER from the
// payload (V4 — a forged sub must not let one community write another's keys).
// When the context carries no sub (should not happen for a real trigger) we log
// and no-op rather than write under an `undefined` key.
//
// Tolerance (threat T-03-01 "malformed/extra-field trigger payload"): on a parse
// (or write) failure we LOG and still return 200 `{status:'success'}` — a
// slightly-off platform field must never error the trigger and stall the whole
// stream. The `.passthrough()` schema tolerates extra fields; the catch covers a
// genuinely malformed body.

triggers.post('/on-post-create', async (c) => {
  const sub = context.subredditId; // platform-trusted (V4) — never client input
  try {
    const payload = PostCreatePayloadSchema.parse(await c.req.json()); // BOUNDARY parse
    if (!sub) {
      console.warn('[onPostCreate] no subredditId in context — skipping accumulation');
      return c.json<TriggerResponse>({ status: 'success', message: 'no-sub' }, 200);
    }
    // Skip the app's own auto-created scaffold post (03-01 edge note) — it is app
    // machinery, not community activity.
    if (payload.author.id === APP_ACCOUNT_ID) {
      return c.json<TriggerResponse>({ status: 'success', message: 'app-post-skipped' }, 200);
    }
    const day = await frontierDay(sub); // single source of the day index
    await bumpPost(sub, day, payload);
    return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
  } catch (error) {
    // Tolerate a malformed payload / transient write error — log, never 500.
    console.error(`[onPostCreate] failed sub=${sub ?? '(none)'}: ${error}`);
    return c.json<TriggerResponse>({ status: 'success', message: 'ignored' }, 200);
  }
});

triggers.post('/on-comment-create', async (c) => {
  const sub = context.subredditId; // platform-trusted (V4) — never client input
  try {
    const payload = CommentCreatePayloadSchema.parse(await c.req.json()); // BOUNDARY parse
    if (!sub) {
      console.warn('[onCommentCreate] no subredditId in context — skipping accumulation');
      return c.json<TriggerResponse>({ status: 'success', message: 'no-sub' }, 200);
    }
    const day = await frontierDay(sub); // single source of the day index
    await bumpComment(sub, day, payload);
    return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
  } catch (error) {
    // Tolerate a malformed payload / transient write error — log, never 500.
    console.error(`[onCommentCreate] failed sub=${sub ?? '(none)'}: ${error}`);
    return c.json<TriggerResponse>({ status: 'success', message: 'ignored' }, 200);
  }
});

import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import {
  CommentCreatePayloadSchema,
  PostCreatePayloadSchema,
} from '../contracts/triggers';

export const triggers = new Hono();

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

// onPostCreate / onCommentCreate — DEV-02 accumulation groundwork.
//
// SPIKE SCOPE (plan 03-01): these handlers prove the create-triggers fire and
// CAPTURE the real 0.13.4 payload shape (OQ2/A2) — they Zod-parse the body at
// the BOUNDARY (T-03-01/V5) and `console.log` the parsed payload so the
// developer can record the real field nesting (esp. `comment.parentId` /
// thread-root for reply-depth) from the playtest console. The Redis counters
// (incrBy / sAdd / zIncrBy) are NOT written here — accumulation lands in plan
// 03-02 once the captured shape tightens `CommentCreatePayloadSchema`.
//
// `sub` is derived from `context.subredditId` server-side, NEVER from the
// payload (V4 — a forged sub must not let one community write another's keys).
//
// Tolerance (threat "Malformed/extra-field trigger payload"): on a parse
// failure we LOG and still return 200 `{status:'success'}` — a slightly-off
// platform field must never error the trigger and stall the whole stream. The
// `.passthrough()` schema already tolerates extra fields; the catch covers a
// genuinely malformed body.

triggers.post('/on-post-create', async (c) => {
  const sub = context.subredditId; // platform-trusted (V4) — never client input
  try {
    const payload = PostCreatePayloadSchema.parse(await c.req.json()); // BOUNDARY parse
    // SPIKE: log the real shape so the developer can capture it during playtest.
    console.log(
      `[spike onPostCreate] sub=${sub ?? '(none)'} payload=${JSON.stringify(payload)}`
    );
    // No Redis writes this plan (accumulation = plan 03-02).
    return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
  } catch (error) {
    // Tolerate a malformed payload — log, never error the trigger.
    console.error(`[spike onPostCreate] parse failed sub=${sub ?? '(none)'}: ${error}`);
    return c.json<TriggerResponse>({ status: 'success', message: 'ignored' }, 200);
  }
});

triggers.post('/on-comment-create', async (c) => {
  const sub = context.subredditId; // platform-trusted (V4) — never client input
  try {
    const payload = CommentCreatePayloadSchema.parse(await c.req.json()); // BOUNDARY parse
    // SPIKE: log the real shape (esp. comment.parentId / thread root) to capture.
    console.log(
      `[spike onCommentCreate] sub=${sub ?? '(none)'} payload=${JSON.stringify(payload)}`
    );
    // No Redis writes this plan (accumulation = plan 03-02).
    return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
  } catch (error) {
    // Tolerate a malformed payload — log, never error the trigger.
    console.error(`[spike onCommentCreate] parse failed sub=${sub ?? '(none)'}: ${error}`);
    return c.json<TriggerResponse>({ status: 'success', message: 'ignored' }, 200);
  }
});

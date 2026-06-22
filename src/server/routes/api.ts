import { Hono } from 'hono';
import { context, redis, reddit, realtime } from '@devvit/web/server';
import { steerChannel } from '../../shared/channel';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
  GenomeId,
} from '../../shared/api';
import { OrganismResponseSchema, SteerRequestSchema, SteerResponseSchema } from '../../shared/api';
import { readAllRings } from '../core/ring';
import { readConfig } from '../core/config';
import { frontierDay } from '../core/frontierDay';
import { recordNudge, readSteerAggregate } from '../core/steer';
import { calm, chaotic, crystalline } from '../../engine/genomes';
import type { Genome } from '../../engine/contracts';

// Genome preset registry (mirrors tick.ts PRESETS) — maps a config genome id to
// its preset so the steer route can read the community's `actionCap` (the per-user
// nudge cap, GAME-05). A new preset is a data entry here, never an engine change.
const PRESETS: Record<GenomeId, Genome> = { calm, chaotic, crystalline };

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

// GET /api/organism — the D-01 fetch-on-load read path (DEV-01 / DEV-05).
//
// Returns the community's accumulated Ring records (read through the SINGLE
// 03-03 `readAllRings` Redis-read boundary parse) plus its genome/style config
// (read through the SINGLE 03-04 `readConfig` settings boundary), as a shared
// `OrganismResponse` envelope the client `safeParse`s.
//
// `sub` is ALWAYS `context.subredditId` (V4 / T-03-02) — never client input, so
// a client cannot request another community's rings. The envelope is parsed on
// the way OUT (`OrganismResponseSchema.parse`) so the server stays honest to the
// contract the client trusts. An empty community returns `rings: []` + 200 (the
// client renders the genesis-core-only cold-start, D-04) — NOT an error. The
// envelope carries exactly rings (~25 scalars + seed) + two ids — no PII, no
// secrets, no images (T-03-13 / DEV-05).
api.get('/organism', async (c) => {
  const { subredditId } = context;

  if (!subredditId) {
    console.error('API Organism Error: subredditId not found in devvit context');
    return c.json<ErrorResponse>(
      { status: 'error', message: 'error.api.noSub' },
      400
    );
  }

  try {
    // rings via the single Redis-read boundary (03-03); config via the single
    // settings boundary (03-04); the live steer aggregate (D-03b reload source-of-
    // truth) for the current frontier day. All keyed by the trusted context sub.
    const day = await frontierDay(subredditId);
    const [rings, cfg, steer] = await Promise.all([
      readAllRings(subredditId),
      readConfig(),
      readSteerAggregate(subredditId, day),
    ]);

    // Parse on the way out — the server response cannot drift from the shared
    // contract the client safeParses (and rings re-validate against RingRecord).
    return c.json(
      OrganismResponseSchema.parse({
        type: 'organism',
        rings,
        genome: cfg.genome,
        style: cfg.style,
        steer, // the live frontier's accumulated nudges (others-on-reload, D-03b)
      }),
      200
    );
  } catch (error) {
    console.error(`API Organism Error for sub ${subredditId}:`, error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'error.api.organism.failed' },
      400
    );
  }
});

// POST /api/steer — record one live nudge under the per-user ActionBudget gate
// (LIVE-01 / GAME-03 / GAME-05).
//
// Identity is server-trusted (V4 / T-04-04): `subredditId` + `userId` come from
// `context`, NEVER the body — a client cannot nudge as another user or write
// another community. The ONLY client input is `{ param, amount }`, which is
// `SteerRequestSchema.parse()`'d at this boundary (V5 / T-04-06 — an oversized or
// garbage amount is clamped-and-rejected here before it can skew the shared steer
// hash). The per-user cap is the configured genome's `actionCap`; recordNudge
// enforces it atomically (T-04-05) and SUMs accepted nudges (hIncrBy, T-04-07).
//
// A budget refusal is NOT an error: an over-cap call returns 200 with
// `{ accepted:false, remaining:0 }` so the UI disables the controls (D-04a). Only
// a missing context id (400) or a malformed body (400) is an error.
api.post('/steer', async (c) => {
  const { subredditId, userId, postId } = context;

  // V4: ids from trusted context only. A missing id is a 400 (i18n key), never a
  // fallback to body-supplied identity.
  if (!subredditId || !userId) {
    console.error('API Steer Error: subredditId/userId not found in devvit context');
    return c.json<ErrorResponse>(
      { status: 'error', message: 'error.api.noSub' },
      400
    );
  }

  try {
    // V5: the UNSAFE client body is `.parse()`'d at the boundary — a bad param or
    // an out-of-[-1,1] amount throws here (caught below → 400), never aggregated.
    const body = SteerRequestSchema.parse(await c.req.json());

    // Resolve the community's genome (for actionCap) + the current frontier day via
    // the single `frontierDay` helper (so the nudge accumulates under the same day
    // the tick will freeze). genome id from the single settings boundary.
    const cfg = await readConfig();
    const genome = PRESETS[cfg.genome] ?? calm;
    const day = await frontierDay(subredditId);

    const { accepted, remaining } = await recordNudge(
      subredditId,
      day,
      userId,
      body.param,
      body.amount,
      genome.actionCap,
    );

    // LIVE-01 / D-03: on an ACCEPTED nudge, broadcast the NEW absolute aggregate
    // over the colon-free per-post realtime channel so every OTHER open viewer
    // re-synthesizes the frontier near-real-time (the acting user already
    // re-synthed locally, D-04). The broadcast is the absolute summed aggregate
    // (+ count), NOT the delta — receivers reconcile to the absolute steered MEAN
    // (= sum/count), so the acting user does not double-apply their own echo.
    //
    // BEST-EFFORT, NEVER FATAL (RESEARCH Pitfall 1 / T-04-12): the Redis steer hash
    // is the source of truth and the D-03b reload path (GET /organism) reconciles
    // on load/reconnect — so a realtime failure (or an absent postId) is LOGGED but
    // does NOT 500 the nudge. `realtime.send` is server-only; clients are
    // subscribe-only (T-04-10). The channel name is built from the trusted
    // context.postId (T-04-11). `await`ed in its own try so a send error cannot
    // bubble into the route's outer catch and turn an accepted nudge into a 400.
    if (accepted && postId) {
      try {
        const aggregate = await readSteerAggregate(subredditId, day);
        await realtime.send(steerChannel(postId), aggregate);
      } catch (broadcastError) {
        // Degrade gracefully — the nudge still succeeded and persisted; only the
        // live push failed. Other viewers will reconcile on their next reload.
        console.error(
          `API Steer realtime broadcast failed for sub ${subredditId}:`,
          broadcastError
        );
      }
    }

    // Parse on the way out — the response cannot drift from the contract the client
    // safeParses. A refusal (accepted:false) is a normal 200.
    return c.json(
      SteerResponseSchema.parse({ type: 'steer', remaining, accepted }),
      200
    );
  } catch (error) {
    // A malformed body (parse throw) or a Redis failure → 400 i18n error (the UI
    // routes this to the error overlay, never throws).
    console.error(`API Steer Error for sub ${subredditId}:`, error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'error.api.steer.failed' },
      400
    );
  }
});

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  try {
    const [count, username] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({
    count,
    postId,
    type: 'increment',
  });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      {
        status: 'error',
        message: 'postId is required',
      },
      400
    );
  }

  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({
    count,
    postId,
    type: 'decrement',
  });
});

import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api';
import { OrganismResponseSchema } from '../../shared/api';
import { readAllRings } from '../core/ring';
import { readConfig } from '../core/config';

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
    // settings boundary (03-04). Both keyed by the trusted context sub.
    const [rings, cfg] = await Promise.all([
      readAllRings(subredditId),
      readConfig(),
    ]);

    // TEMP (UAT): log every successful read so the playtest terminal shows what
    // /api/organism returns (rings/genome/style) — pairs with the error log below.
    console.log(
      `[api/organism] sub=${subredditId} rings=${rings.length} genome=${cfg.genome} style=${cfg.style}`
    );

    // Parse on the way out — the server response cannot drift from the shared
    // contract the client safeParses (and rings re-validate against RingRecord).
    return c.json(
      OrganismResponseSchema.parse({
        type: 'organism',
        rings,
        genome: cfg.genome,
        style: cfg.style,
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

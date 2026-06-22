// api — the SHARED fetch contracts between the client webview and its own server.
//
// CLIENT-SAFE (CLAUDE.md §6 bundle safety): this module is imported by BOTH the
// server route handlers AND the client bundle, so it must import ONLY client-safe
// code — the Devvit-free engine contracts (`RingRecordSchema`, `StyleIdEnum`) and
// zod. It MUST NOT import any server-only module (the Redis client, the Devvit
// server runtime, route code) — doing so would drag server code into the webview
// bundle.
//
// SCHEMA-FIRST (CLAUDE.md §1/§9): the OrganismResponse fetch envelope is the
// `z.infer` of `OrganismResponseSchema` — there is NO hand-written
// `type OrganismResponse`. Its `rings` reuse the engine's `RingRecordSchema`
// (03-03), so the server response cannot drift from what `render()` consumes and
// the server (`.parse` on the way out) and client (`safeParse` at the UI boundary)
// share ONE contract. The pre-existing Init/Increment/Decrement aliases are the
// counter-template leftovers; they stay for now (counter routes still use them),
// but every NEW contract is schema-first.
import { z } from 'zod';
import { RingRecordSchema, StyleIdEnum } from '../engine/contracts';

export type InitResponse = {
  type: "init";
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: "increment";
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: "decrement";
  postId: string;
  count: number;
};

/**
 * The known genome preset ids (the three Phase-1 presets). This mirrors the
 * server's `GENOME_IDS` (src/server/contracts/settings.ts) but is declared HERE
 * so the client-safe shared contract never imports a server module (bundle
 * safety). A new preset adds an id in both places (and in the engine genomes
 * barrel + the tick PRESETS registry) — never an engine code change.
 */
export const GenomeIdEnum = z.enum(['calm', 'chaotic', 'crystalline']);
export type GenomeId = z.infer<typeof GenomeIdEnum>;

/**
 * SteerAggregateSchema — the per-day live steer accumulation (the D-03b reload
 * source-of-truth carried on `GET /api/organism`). Each param is the SUMMED
 * contribution (hIncrBy, never overwritten); `count` is the number of accepted
 * nudges (so the tick can fold the MEAN = sum / count × steerGain exactly once).
 */
export const SteerAggregateSchema = z.object({
  branch: z.number(),
  symmetry: z.number(),
  hue: z.number(),
  count: z.number(),
});
/** The parsed steer aggregate — `z.infer` only (no hand interface, CLAUDE.md §1). */
export type SteerAggregate = z.infer<typeof SteerAggregateSchema>;

/**
 * OrganismResponseSchema — the `GET /api/organism` envelope (DEV-01 / DEV-05).
 *
 * `rings` reuse the engine `RingRecordSchema` so the wire shape is exactly what
 * `render()` consumes (no drift). `genome`/`style` are the community's config
 * ids (enum-constrained — an unknown id is rejected). `rings: []` is the valid
 * cold-start envelope (the client renders genesis-core-only), NOT an error.
 */
export const OrganismResponseSchema = z.object({
  type: z.literal('organism'),
  rings: z.array(RingRecordSchema),
  genome: GenomeIdEnum,
  style: StyleIdEnum,
  // The live frontier's accumulated nudges (D-03b reload source-of-truth). Optional
  // because an unsteered frontier (or a server that hasn't aggregated yet) omits it;
  // the client renders the current aggregate on load when present.
  steer: SteerAggregateSchema.optional(),
});

/** The parsed fetch envelope — `z.infer` only (no hand interface, CLAUDE.md §1). */
export type OrganismResponse = z.infer<typeof OrganismResponseSchema>;

/**
 * The three nudgeable frontier params (the live-steer axes). Mirrors the engine
 * `SteeringParam` in render.ts but is declared HERE so the client-safe shared
 * contract never imports an engine-render or server module. branch→scatter,
 * symmetry→arms, hue→theme hint.
 */
export const SteerParamEnum = z.enum(['branch', 'symmetry', 'hue']);
export type SteerParam = z.infer<typeof SteerParamEnum>;

/**
 * SteerRequestSchema — the `POST /api/steer` request body (the ONLY client input).
 *
 * `param` is enum-constrained and `amount` is CLAMPED to [-1, 1] (T-04-06: the
 * hostile-bias guard — an oversized/garbage amount is rejected at the route
 * boundary by `.parse()` before it ever reaches the shared steer hash). The
 * acting user's identity (sub/userId) is NEVER in the body — the server derives
 * it from trusted context (V4 / T-04-04). i18n error keys (CLAUDE.md §7).
 */
export const SteerRequestSchema = z.object({
  param: SteerParamEnum,
  amount: z
    .number({ message: 'error.api.steer.amount.type' })
    .min(-1, { message: 'error.api.steer.amount.min' })
    .max(1, { message: 'error.api.steer.amount.max' }),
});
/** The parsed steer request — `z.infer` only (no hand interface, CLAUDE.md §1). */
export type SteerRequest = z.infer<typeof SteerRequestSchema>;

/**
 * SteerResponseSchema — the `POST /api/steer` response envelope.
 *
 * `remaining` is the acting user's remaining ActionBudget for the day (0 disables
 * the controls, D-04a). `accepted` is false when the budget was exhausted — a
 * refusal is a normal 200 response, NOT an error (the UI just stops nudging).
 */
export const SteerResponseSchema = z.object({
  type: z.literal('steer'),
  remaining: z.number().int().nonnegative(),
  accepted: z.boolean(),
});
/** The parsed steer response — `z.infer` only (no hand interface, CLAUDE.md §1). */
export type SteerResponse = z.infer<typeof SteerResponseSchema>;

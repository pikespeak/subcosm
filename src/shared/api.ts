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
});

/** The parsed fetch envelope — `z.infer` only (no hand interface, CLAUDE.md §1). */
export type OrganismResponse = z.infer<typeof OrganismResponseSchema>;

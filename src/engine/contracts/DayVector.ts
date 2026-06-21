// DayVector — contract: raw community data -> synthesis (spec subcosm-requirements.md §6.1).
//
// Zod is the single source of truth (CLAUDE.md §1): the TypeScript type is
// z.infer of the schema — there is NO hand-written `interface DayVector`.
// .parse() runs at the (future) sim->engine boundary (Phase 2); inside the
// engine we trust the inferred type.
import { z } from 'zod';
import { OutcomeSchema } from './Outcome';

export const SteeringSchema = z.object({
  branch: z.number(),
  symmetry: z.number(),
  hue: z.number(),
});
export type Steering = z.infer<typeof SteeringSchema>;

export const DayVectorSchema = z.object({
  day: z.number().int().positive(), // 1 = genesis
  date: z.string(), // ISO

  // counted
  posts: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  contributors: z.number().nonnegative(),
  scoreSum: z.number().nonnegative(),
  topThreads: z.array(z.number().nonnegative()), // largest thread comment-counts -> clusters

  // derived
  conflict: z.number().min(0).max(1), // 0..1 composite proxy
  momentum: z.number().min(-1).max(1), // -1..1 vs previous day
  diversity: z.number().min(0).max(1), // 0..1 topic/nudge spread
  dominantTheme: z.string(),

  // steering (aggregated nudges at the frontier)
  steering: SteeringSchema,

  seed: z.number().int(), // hash(subId, day, genomeVersion)

  // GAME-02 scoring result. Firmed in Phase 4 (RESEARCH A3) from the Phase-1
  // placeholder to the typed OutcomeSchema: a FROZEN ring carries its outcome
  // (achieved + degree); the live frontier may omit it (still being scored).
  outcome: OutcomeSchema.optional(),
});
export type DayVector = z.infer<typeof DayVectorSchema>;

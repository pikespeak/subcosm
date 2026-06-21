// Outcome — contract: the deterministic scoring result of a frozen day (D-02, GAME-02).
//
// Zod is the single source of truth (CLAUDE.md §1): the TypeScript type is
// z.infer of the schema — there is NO hand-written `interface Outcome`. The
// scorer (src/engine/score.ts) produces this shape PURELY from the frozen
// DayVector + the genome's fixed daily goal; the same inputs always yield the
// same Outcome, so any client re-derives an identical verdict (LIVE-03 / D-09).
//
// Outcome carries ONLY community-shared scoring — the resolved goal, the measured
// metric, the achieved verdict, and a normalized 0..1 degree. It has NO per-user
// field (D-04b): it is safe on DayVector / RingRecord (the shared community layer),
// and must never appear on the personal layer (ActionBudget). All types are z.infer
// (ENG-01); custom refinement messages use i18n keys (CLAUDE.md §7).
//
// .parse() runs at boundaries (the Redis read boundary parses an Outcome embedded
// in a RingRecord) — never inside synthesis / paint / the frame loop (Pitfall 6).
import { z } from 'zod';
import { DailyGoalSchema } from './Genome';

export const OutcomeSchema = z.object({
  // The resolved daily goal this day was scored against (genome.dailyGoal).
  goal: DailyGoalSchema,
  // The derived metric at freeze — the SAME number synthesis paints (LIVE-03):
  // a raw 0..1 conflict, a normalized 0..1 density, or an integer arm count.
  measured: z.number(),
  // Whether the goal was met (direction-aware against goal.threshold).
  achieved: z.boolean(),
  // Normalized 0..1 distance to the threshold, monotonic in both directions
  // (achieved AND missed). Rejected outside [0,1] (i18n key on the bound).
  degree: z
    .number()
    .min(0, { message: 'error.outcome.degree.tooLow' })
    .max(1, { message: 'error.outcome.degree.tooHigh' }),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

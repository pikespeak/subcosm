// tickJob — contract: the scheduler `data` payload for the daily freeze tick.
//
// Zod is the single source of truth (CLAUDE.md §1): the type is z.infer of the
// schema — no hand-written interface. The scheduler `data` is an UNTRUSTED
// boundary crossing into the server (T-03-06), so the /tick handler `.parse()`s
// it before calling runTick. `subId` is the platform-trusted subreddit id the
// sweeper (plan 03-04) passes when it enqueues the one-off tick job; `day` is
// the frontier day index (frontierDay) being frozen — a positive integer.
import { z } from 'zod';

export const TickJobSchema = z.object({
  subId: z.string({ message: 'error.tick.subId.required' }),
  day: z
    .number({ message: 'error.tick.day.required' })
    .int({ message: 'error.tick.day.int' })
    .positive({ message: 'error.tick.day.positive' }),
});
export type TickJob = z.infer<typeof TickJobSchema>;

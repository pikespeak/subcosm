// RingRecord — contract: a frozen daily shell as stored in Redis (DEV-05).
//
// Zod is the single source of truth (CLAUDE.md §1): the TypeScript type is
// z.infer of the schema — there is NO hand-written `interface RingRecord`.
//
// A RingRecord is exactly a `DayVector` plus the integer `genomeVersion` under
// which it was frozen. DayVectorSchema already carries `seed`
// (= hash(subId, day, genomeVersion)), so the stored record cannot drift from
// what `render()` consumes — the write boundary (tick → writeRing) and the read
// boundary (readAllRings → render) share this ONE schema. By construction the
// record is ~25 scalars + seed + genomeVersion: there is NO image/pixel field,
// so DEV-05's "no stored images" invariant is structural, not a runtime check.
//
// `.parse()` runs at the Redis read/write boundary (ring.ts), never inside
// synthesis / paint / the frame loop (Pitfall 6 — a single boundary parse).
import { z } from 'zod';
import { DayVectorSchema } from './DayVector';

export const RingRecordSchema = DayVectorSchema.extend({
  // The community's genome preset version this ring was frozen under. Part of
  // the seed (hash(subId, day, genomeVersion)); a genome bump changes the seed
  // and thus the regenerated geometry, so it must travel WITH the stored record.
  genomeVersion: z.number().int().nonnegative(),
});
export type RingRecord = z.infer<typeof RingRecordSchema>;

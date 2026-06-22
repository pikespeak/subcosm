// backfill — D-01 demo history seeding: write the deterministic simulator arc as
// frozen rings DIRECTLY, skipping the reveal side-effect (RESEARCH Q5 / SUB-02).
//
// `backfillHistory(subId)` populates a fresh community with the existing
// deterministic ~30-day simulator arc so the public demo post opens onto a deep,
// populated "depth = time" universe instead of an empty day-1. It reuses the
// SAME ring-build + write path as the live freeze (tick.ts):
//   - resolveGenome(subId) → genomeVersion + dailyGoal (one config read),
//   - per day: OVERRIDE the sim DayVector's seed with hashSeed(subId, day,
//     genomeVersion) (the SAME helper tick.ts uses — no divergent seed) and set
//     dominantTheme:'community' to match the tick idiom,
//   - outcome = score(dayVector, genome) (the one-shot PURE scoring call),
//   - RingRecordSchema.parse({...dayVector, outcome, genomeVersion}) at the build
//     boundary (mirrors generator.ts / tick.ts),
//   - writeRing(subId, record) — the ONE ring write path (no parallel writer).
//
// The written rings are deterministic, schema-valid, and cross-client-identical.
// They are NOT field-identical to an organically-grown tick: the sim DayVectors
// carry their own diversity/momentum/zero-steering and a scripted dominantTheme,
// so the seeded universe differs in those fields — that is ACCEPTABLE (D-01) and
// must NOT be "fixed" by special-casing tick.ts.
//
// HARD PROHIBITIONS (RESEARCH Pitfall 2 / Q5 — the key threat of this phase):
//   - NEVER call runTick / createRevealPost / reddit.submitCustomPost — the
//     backfill writes RINGS ONLY (zero reveal posts → no ~30-post spam tripwire).
//   - NEVER reset accumulators or advance lastTickDay — this is a direct ring
//     write, not a tick.
//
// IDEMPOTENCY (RESEARCH Pitfall 4): skip entirely when ringCount > 0 so a re-run
// never doubles the index. The demo seed is applied exactly once. `subId` is the
// platform-trusted context.subredditId (V4) — never client-supplied.
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';
import { hashSeed } from './seed';
import { resolveGenome } from './genome';
import { writeRing } from './ring';
import { generateDayVectors } from '../../sim';
import { score } from '../../engine/score';
import { RingRecordSchema, type RingRecord } from '../../engine/contracts';

/**
 * DEMO_SEED — the fixed master seed for the demo history arc (Claude's discretion,
 * D-01). A constant integer so the seeded universe is the SAME well-told story on
 * every demo install (the same `generateDayVectors({ seed: DEMO_SEED })` arc). The
 * value is arbitrary but FROZEN — changing it would re-dice the demo universe.
 * 0x53_55_42 spells "SUB" (Subcosm) in ASCII; any fixed int works.
 */
export const DEMO_SEED = 0x535542; // 5461314

/** Optional backfill knobs (Claude's discretion to shorten the arc per D-01). */
export type BackfillOptions = {
  /** Master seed for the simulator arc (defaults to DEMO_SEED). */
  seed?: number;
  /**
   * Cap the number of seeded days (oldest-first). Defaults to the full arc.
   * Useful if perf/clarity ever argues for a shorter demo history (D-01).
   */
  maxDays?: number;
};

/**
 * backfillHistory — seed `subId` with the deterministic simulator arc as frozen
 * rings (D-01). Idempotent: a no-op (returns 0) when ringCount > 0. On a fresh
 * community writes one ring per simulator day, oldest→newest, and returns the
 * number of rings written. Creates ZERO reveal posts.
 */
export async function backfillHistory(
  subId: string,
  opts: BackfillOptions = {},
): Promise<number> {
  // Idempotency guard (RESEARCH Pitfall 4): re-running would double ringCount and
  // mis-index the rings. Skip entirely when any ring already exists — the demo
  // seed is applied exactly once, and an organically-grown sub is never overwritten.
  const existing = Number((await redis.get(keys.ringCount(subId))) ?? 0) || 0;
  if (existing > 0) return 0;

  // Resolve the full genome BEFORE the seed (the seed depends on its version, and
  // scoring needs its dailyGoal) — the SAME single resolve tick.ts uses.
  const genome = await resolveGenome(subId);
  const genomeVersion = genome.version;

  // Generate the deterministic arc from the fixed demo seed (SIM-03). Optionally
  // truncate to maxDays (oldest-first) per D-01's shorten-if-needed discretion.
  const seed = opts.seed ?? DEMO_SEED;
  const days = generateDayVectors({ seed });
  const arc =
    opts.maxDays && opts.maxDays > 0 ? days.slice(0, opts.maxDays) : days;

  let written = 0;
  for (const dayVector of arc) {
    // Align the sim DayVector with the tick.ts ring idiom AS FAR AS the data
    // allows: OVERRIDE the sim seed with the deterministic ring seed and set the
    // neutral 'community' theme. The remaining sim-vs-tick differences (diversity,
    // momentum, scripted-vs-zero steering) are ACCEPTABLE — the ring stays
    // deterministic, schema-valid, and cross-client-identical (D-01). Do NOT
    // special-case tick.ts to force field-for-field parity.
    const aligned = {
      ...dayVector,
      dominantTheme: 'community',
      seed: hashSeed(subId, dayVector.day, genomeVersion),
    };

    // One-shot PURE scoring (RESEARCH Anti-Patterns: never per-frame). Then parse
    // the SAME object spread with { outcome, genomeVersion } at the single build
    // boundary — identical to tick.ts / generator.ts.
    const outcome = score(aligned, genome);
    const record: RingRecord = RingRecordSchema.parse({
      ...aligned,
      outcome,
      genomeVersion,
    });

    // The ONE ring write path (no parallel writer) — advances ringCount + hSets
    // the serialized scalars. NO reveal post, NO accumulator reset (the
    // prohibitions above): writeRing only.
    await writeRing(subId, record);
    written++;
  }

  return written;
}

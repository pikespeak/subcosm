// genome — the SINGLE community-genome resolver (the template-engine bet).
//
// `resolveGenome(subId)` reads the genome id from the community's config snapshot
// (organism:{sub}:config.genome, the 03-04 install snapshot) and returns the
// matching preset object — both its `.version` (for the deterministic seed) and
// its `.dailyGoal` (for scoring) come from this single read. Defaults to the Calm
// preset when the config key is absent or the id is unrecognised (e.g. a tick or
// backfill fires before any install snapshot exists).
//
// Extracted from tick.ts so the live daily freeze (tick.ts) and the D-01 history
// backfill (backfill.ts) resolve the genome IDENTICALLY — a backfilled ring and an
// organic ring use the same genomeVersion + goal, so they stay determinism- and
// schema-consistent (D-01). A new preset is a data entry in PRESETS — never an
// engine code change. `subId` is the platform-trusted context.subredditId (V4).
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';
import { calm, chaotic, crystalline } from '../../engine/genomes';
import type { Genome } from '../../engine/contracts';

/**
 * Genome preset registry, keyed by the id stored in organism:{sub}:config.genome.
 * `calm` is the default when no config snapshot exists or the id is unrecognised.
 */
export const PRESETS: Record<string, Genome> = { calm, chaotic, crystalline };

/** Resolve the community's full genome from its configured preset (default Calm). */
export async function resolveGenome(subId: string): Promise<Genome> {
  const id = await redis.hGet(keys.config(subId), 'genome');
  return (id && PRESETS[id]) || calm;
}

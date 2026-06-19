// generator — the deterministic activity simulator (the ONE Zod boundary that
// emits DayVector[] for Phase 2). Service + batch.
//
// Zod is the single source of truth (CLAUDE.md §1). The ONLY .parse() in this
// phase lives here, at the OUTPUT boundary (SIM-02 / QA-03): each generated day
// is schema-validated before it can reach synthesis/paint. The single parse call
// MUST appear ONLY here — never inside synthesis, paint, or the frame loop.
//
// Determinism (SIM-03): the only entropy source is `mulberry32` from the engine
// (REUSED, never re-implemented — the engine ESLint boundary bans the global
// random API; this module relies solely on the seeded PRNG). A per-day RNG is
// seeded deterministically from the master seed, so the same `config.seed`
// reproduces a byte-identical DayVector[]; a different seed dices DIFFERENT
// values WITHIN the same beats (D-03) — a regenerate stays well-told.
import { mulberry32 } from '../engine/rng';
import { DayVectorSchema, type DayVector } from '../engine/contracts';
import { beats, type Beat } from './beats';

/** Simulator configuration. `seed` is the master seed; everything else derives from it. */
export type SimConfig = {
  /** Master seed — the single external input that drives the whole universe (SIM-03). */
  seed: number;
  /** Optional ISO start date for day-1 (defaults to a fixed date for determinism). */
  startDate?: string;
};

// A fixed default genesis date keeps output byte-stable when no date is given
// (Date.now() would break SIM-03). Callers may override via config.startDate.
const DEFAULT_START_DATE = '2026-01-01';

const MS_PER_DAY = 86_400_000;

/** ISO yyyy-mm-dd for `dayIndex` days after `startISO` (UTC, deterministic). */
function isoDateForDay(startISO: string, dayIndex: number): string {
  const base = Date.parse(`${startISO}T00:00:00.000Z`);
  return new Date(base + dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Derive a stable per-day integer seed from the master seed. Two layers of
 * mulberry32: the master RNG yields a float per day, mixed with the day number
 * into a 32-bit integer. Same master seed → same per-day seeds, always.
 */
function perDaySeed(rngFloat: number, day: number): number {
  // rngFloat ∈ [0,1) → spread across the 32-bit space, XOR a day salt.
  const mixed = (Math.floor(rngFloat * 0xffffffff) ^ (day * 0x9e3779b1)) >>> 0;
  return mixed | 0; // signed 32-bit int (DayVectorSchema requires z.number().int()).
}

/** Dice `mean` by ±(mean*jitter) using one draw from the day RNG. */
function jittered(mean: number, jitter: number, rng: () => number): number {
  if (jitter <= 0) return mean;
  const factor = 1 + (rng() * 2 - 1) * jitter; // [1-jitter, 1+jitter)
  return mean * factor;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const clampSigned = (n: number): number => Math.min(1, Math.max(-1, n));

/**
 * Build one day's RAW (pre-parse) shape from its beat, dicing within the beat
 * using the per-day RNG. `prevPosts` feeds momentum (this day vs the previous).
 */
function buildRawDay(
  beat: Beat,
  daySeed: number,
  date: string,
  prevPosts: number | null,
): unknown {
  const rng = mulberry32(daySeed);

  const posts = Math.max(1, Math.round(jittered(beat.postsMean, beat.jitter, rng)));
  const commentsPerPost = jittered(beat.commentsPerPost, beat.jitter * 0.5, rng);
  const comments = Math.max(0, Math.round(posts * commentsPerPost));
  const contributors = Math.max(1, Math.round(jittered(beat.contributorsMean, beat.jitter, rng)));
  // scoreSum scales with engagement, lightly diced.
  const scoreSum = Math.max(0, Math.round(jittered((posts + comments) * 1.8, beat.jitter, rng)));

  // topThreads: dice each mean cluster; never emit an empty array (Pitfall 5 —
  // a spread into Math.max() would yield -Infinity). Round, floor at 1.
  const topThreads = beat.topThreadsMean.map((m) =>
    Math.max(1, Math.round(jittered(m, beat.jitter, rng))),
  );

  const conflict = clamp01(jittered(beat.conflictMean, beat.jitter * 0.4, rng));
  const diversity = clamp01(jittered(beat.diversityMean, beat.jitter * 0.4, rng));

  // momentum: signed growth in posts vs the previous day, normalized to -1..1.
  // Day-1 (no previous) has zero momentum by definition.
  const momentum =
    prevPosts === null || prevPosts === 0
      ? 0
      : clampSigned((posts - prevPosts) / (prevPosts + posts));

  return {
    day: beat.day,
    date,
    posts,
    comments,
    contributors,
    scoreSum,
    topThreads,
    conflict,
    momentum,
    diversity,
    dominantTheme: beat.theme,
    // Neutral steering — aggregated nudges are wired in plan 02-05.
    steering: { branch: 0, symmetry: 0, hue: 0 },
    seed: daySeed,
    // GAME-01 hook — left undefined this phase (per plan).
    outcome: undefined,
  };
}

/**
 * Generate the scripted ~30-day community story as a DayVector[].
 *
 * Deterministic in `config.seed` (SIM-03): the same seed reproduces a
 * byte-identical array; a different seed dices a different-but-well-told
 * universe WITHIN the same beats (D-03). Validated once at this boundary
 * (SIM-02 / QA-03) — the single schema-parse site for the entire phase.
 */
export function generateDayVectors(config: SimConfig): DayVector[] {
  const startDate = config.startDate ?? DEFAULT_START_DATE;
  const master = mulberry32(config.seed | 0);

  const result: DayVector[] = [];
  let prevPosts: number | null = null;

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]!;
    const daySeed = perDaySeed(master(), beat.day);
    const date = isoDateForDay(startDate, beat.day - 1); // day 1 == startDate
    const raw = buildRawDay(beat, daySeed, date, prevPosts);

    // THE boundary: validate generated output before it can reach the engine.
    const day = DayVectorSchema.parse(raw);
    result.push(day);
    prevPosts = day.posts;
  }

  return result;
}

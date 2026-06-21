// tick — the daily freeze: accumulators → conflict → Ring record → reset (DEV-04/05).
//
// `runTick(subId, day)` turns one community-day's accumulated Redis activity
// (written by counters.ts in 03-02) into a frozen Ring record the universe can
// render, then opens the next frontier. The pipeline:
//   1. idempotency guard — if lastTickDay >= day, no-op (OQ3 / T-03-07): an
//      at-least-once scheduler double-fire writes at most one ring per local day.
//   2. resolve genomeVersion from the community's configured genome preset
//      (organism:{sub}:config → genome id → preset.version), defaulting to the
//      Calm preset's version when no config snapshot exists yet (03-04 writes it).
//   3. read back the day's accumulators (posts/comments/replies counters,
//      unique contributors via zCard — the ZSET-as-set from 03-02, NOT sCard —
//      and the top-threads ZSET) and compose conflict via conflictComposite.
//   4. build a DayVector + the resolved genomeVersion, set
//      seed = hash(subId, day, genomeVersion), and RingRecordSchema.parse it (the
//      single build boundary, mirroring generator.ts) before writeRing.
//   5. reset the frozen day's counters/SET/ZSET (bounds per-day growth — T-03-05)
//      and persist lastTickDay = day.
//
// DETERMINISM (CLAUDE.md): the seed is a pure FNV-1a over
// `${subId}:${day}:${genomeVersion}` — NEVER Math.random for game state. The same
// (subId, day, genomeVersion) always yields the same seed, so a ring regenerates
// byte-identically. No images are ever stored (DEV-05 — the RingRecord schema has
// no image field). `sub` is the platform-trusted subreddit id (V4).
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';
import { conflictComposite } from './conflict';
import { writeRing } from './ring';
import { RingRecordSchema, type RingRecord } from '../../engine/contracts';
import { calm, chaotic, crystalline } from '../../engine/genomes';
import { score } from '../../engine/score';
import type { DayVector, Genome } from '../../engine/contracts';

// Genome preset registry, keyed by the id stored in organism:{sub}:config.genome
// (the install snapshot, written in 03-04). A new preset is a data entry here —
// never an engine code change (the template-engine bet). `calm` is the default
// when no config snapshot exists yet or the stored id is unrecognised.
const PRESETS: Record<string, Genome> = { calm, chaotic, crystalline };

/** Clamp helpers — same idiom as src/sim/generator.ts. */
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const clampSigned = (n: number): number => Math.min(1, Math.max(-1, n));

/**
 * Deterministic FNV-1a 32-bit hash of `${subId}:${day}:${genomeVersion}`,
 * returned as a signed 32-bit int (DayVectorSchema requires z.number().int()).
 * Pure + seedless — NEVER Math.random (CLAUDE.md determinism): the same inputs
 * always yield the same seed, so a frozen ring is reproducible.
 */
function hashSeed(subId: string, day: number, genomeVersion: number): number {
  const input = `${subId}:${day}:${genomeVersion}`;
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // FNV prime 16777619, via Math.imul to stay in 32-bit.
    h = Math.imul(h, 0x01000193);
  }
  return h | 0; // signed 32-bit int
}

/**
 * Resolve the community's full genome from its configured preset. Reads the genome
 * id from organism:{sub}:config (03-04 install snapshot) and returns that preset
 * object — both its `.version` (for the seed) and its `.dailyGoal` (for scoring)
 * come from this single config read. Defaults to the Calm preset (`calm`, not a
 * hardcoded literal — the default tracks the preset) when the config key is absent
 * or the id is unrecognised (e.g. a tick fires before any install snapshot exists).
 */
async function resolveGenome(subId: string): Promise<Genome> {
  const id = await redis.hGet(keys.config(subId), 'genome');
  return (id && PRESETS[id]) || calm;
}

/**
 * runTick — freeze `day`'s frontier for `subId` into a Ring record, idempotently.
 * A no-op when `day <= lastTickDay` (double-fire guard). Otherwise reads the
 * accumulators, composes conflict, builds + parses the RingRecord, writes it,
 * resets the day, and advances lastTickDay.
 */
export async function runTick(subId: string, day: number): Promise<void> {
  // 1. Idempotency guard (OQ3 / T-03-07): a re-fire for the same/earlier day is
  //    a no-op — at most one ring per local day, ringCount never corrupted.
  const last = Number((await redis.get(keys.lastTickDay(subId))) ?? 0) || 0;
  if (last >= day) return;

  // 2. Resolve the full genome BEFORE the seed (the seed depends on its version,
  //    and scoring needs its dailyGoal — one config read serves both).
  const genome = await resolveGenome(subId);
  const genomeVersion = genome.version;

  // 3. Read back the day's accumulators (the 03-02 keys). Unique contributors via
  //    zCard — the ZSET-as-set from 03-02 (the Devvit SDK has no sCard).
  const [postsRaw, commentsRaw, repliesRaw, contributors, threads] =
    await Promise.all([
      redis.get(keys.counter(subId, 'posts')),
      redis.get(keys.counter(subId, 'comments')),
      redis.get(keys.counter(subId, 'replies')),
      redis.zCard(keys.contributors(subId, day)),
      // Top threads, highest comment-count first (reverse by score).
      redis.zRange(keys.threads(subId, day), 0, -1, {
        by: 'score',
        reverse: true,
      }),
    ]);

  const posts = Number(postsRaw ?? 0) || 0;
  const comments = Number(commentsRaw ?? 0) || 0;
  const replies = Number(repliesRaw ?? 0) || 0;
  // Largest thread comment-counts → clusters (DayVector.topThreads). Already
  // sorted high→low by the reverse zRange; map to the bare scores.
  const topThreads = threads.map((t) => t.score);

  // conflict — the pure D-02 composite from the read-back proxies (03-02).
  const conflict = conflictComposite({ posts, comments, replies });

  // scoreSum proxy — engagement volume (posts+comments). This phase does NOT
  // evolve the genome day-to-day (CONTEXT deferred); momentum/diversity are kept
  // simple + clamped (a clean freeze + seed write, not a day-over-day model).
  const scoreSum = posts + comments;
  const momentum = clampSigned(0); // no previous-day delta tracked this phase
  const diversity = clamp01(contributors > 0 ? contributors / (posts + comments + 1) : 0);

  const seed = hashSeed(subId, day, genomeVersion);

  // 4. Build the DayVector ONCE, score it, then parse the SAME object spread with
  //    { outcome, genomeVersion } at the single build boundary (generator.ts idiom).
  //    score() is a one-shot PURE call at the tick (RESEARCH Anti-Patterns: never
  //    per-frame, never inside synthesis) — it adds no entropy / no I/O.
  const dayVector: DayVector = {
    day,
    date: isoDateForDay(day),
    posts,
    comments,
    contributors,
    scoreSum,
    topThreads,
    conflict,
    momentum,
    diversity,
    dominantTheme: 'community', // genome-driven theming lands later; neutral here
    steering: { branch: 0, symmetry: 0, hue: 0 }, // aggregated nudges wired later
    seed,
  };

  // Deterministic verdict from the frozen DayVector + the genome's fixed goal
  // (GAME-02 / LIVE-03) — any client re-derives the identical outcome from the ring.
  const outcome = score(dayVector, genome);

  const record: RingRecord = RingRecordSchema.parse({
    ...dayVector,
    outcome,
    genomeVersion,
  });

  await writeRing(subId, record);

  // 5. Reset the frozen day's counters/SET/ZSET so the next frontier starts clean
  //    (bounds unbounded per-day growth — T-03-05), then advance the guard. The
  //    guard is set AFTER the write so a crash mid-write leaves day re-freezable.
  await redis.del(
    keys.counter(subId, 'posts'),
    keys.counter(subId, 'comments'),
    keys.counter(subId, 'replies'),
    keys.contributors(subId, day),
    keys.threads(subId, day),
  );
  await redis.set(keys.lastTickDay(subId), String(day));
}

const MS_PER_DAY = 86_400_000;
// A fixed genesis epoch keeps the ring date deterministic (no Date.now() — that
// would break reproducibility). Day 1 maps to this date; day N is N-1 days later.
const GENESIS_DATE = '2026-01-01';

/** Deterministic ISO yyyy-mm-dd for a 1-based `day` (UTC). */
function isoDateForDay(day: number): string {
  const base = Date.parse(`${GENESIS_DATE}T00:00:00.000Z`);
  return new Date(base + (day - 1) * MS_PER_DAY).toISOString().slice(0, 10);
}

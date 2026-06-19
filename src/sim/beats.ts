// beats — the scripted 30-day story arc as tunable DATA, not code (D-03).
//
// Zod is the single source of truth (CLAUDE.md §1), but this table is NOT a
// boundary: it is the simulator's internal script. The ONE .parse() boundary
// lives at the generator's OUTPUT (generator.ts) — beats describe the per-day
// MEANS, and `generateDayVectors` dices the actual values WITHIN each beat using
// a seed-derived mulberry32 (so a regenerate stays well-told; D-03).
//
// The arc (RESEARCH OQ1 / 02-CONTEXT D-03):
//   cold-start day-1 -> growth ramp -> drama spike (~day 12, red turbulence)
//   -> AMA day (~day 20, a few huge clusters) -> quiet days. ~30 days total.
//
// Day count and beat positions are Claude's discretion within this shape. The
// tests assert on OUTPUT data (not on indices here), so this table is freely
// tunable. Each row is the MEAN for that day; the seed shifts values around it
// by at most ±`jitter` (a fraction, 0..1) so the story shape is preserved.

/** The story role of a scripted day — drives both the means and the dominant theme. */
export type BeatKind = 'cold-start' | 'growth' | 'drama' | 'ama' | 'quiet';

/**
 * One scripted day's tunable means. `generateDayVectors` dices the emitted
 * DayVector around these via the per-day seeded RNG; the schema parse happens at
 * the generator's output, never here.
 */
export type Beat = {
  /** Calendar day number; 1 = genesis. Strictly ascending across the table. */
  day: number;
  /** Story role of this day. */
  kind: BeatKind;
  /** Mean post count for the day (seed dices ± jitter around it). */
  postsMean: number;
  /** Mean comments-per-post multiplier (comments ≈ posts * commentsPerPost). */
  commentsPerPost: number;
  /** Mean contributor count. */
  contributorsMean: number;
  /** Mean conflict (0..1 composite). */
  conflictMean: number;
  /** Mean diversity (0..1 topic spread). */
  diversityMean: number;
  /** The largest-thread comment-counts that define this day's clusters (means). */
  topThreadsMean: number[];
  /** A short, legible theme label for the day (judges read this in the HUD). */
  theme: string;
  /** Fractional jitter the seed may apply to numeric means (0..1). */
  jitter: number;
};

// Helper: a steady growth ramp between two cold/hot endpoints reads as a story
// rising. Kept inline as literal rows for readability + easy tuning.
export const beats: readonly Beat[] = [
  // --- Cold-start: a universe begins (Pitfall 5 — small but never empty). ---
  {
    day: 1,
    kind: 'cold-start',
    postsMean: 1,
    commentsPerPost: 6,
    contributorsMean: 4,
    conflictMean: 0.02,
    diversityMean: 0.05,
    topThreadsMean: [8],
    theme: 'the first post',
    jitter: 0,
  },

  // --- Growth ramp: word spreads, the community finds its feet (days 2-11). ---
  { day: 2, kind: 'growth', postsMean: 6, commentsPerPost: 7, contributorsMean: 9, conflictMean: 0.08, diversityMean: 0.18, topThreadsMean: [22, 14], theme: 'early settlers', jitter: 0.2 },
  { day: 3, kind: 'growth', postsMean: 11, commentsPerPost: 8, contributorsMean: 15, conflictMean: 0.1, diversityMean: 0.24, topThreadsMean: [40, 26, 12], theme: 'introductions', jitter: 0.2 },
  { day: 4, kind: 'growth', postsMean: 18, commentsPerPost: 9, contributorsMean: 24, conflictMean: 0.12, diversityMean: 0.3, topThreadsMean: [70, 44, 20], theme: 'first traditions', jitter: 0.22 },
  { day: 5, kind: 'quiet', postsMean: 14, commentsPerPost: 8, contributorsMean: 20, conflictMean: 0.09, diversityMean: 0.28, topThreadsMean: [55, 30], theme: 'a calm weekend', jitter: 0.2 },
  { day: 6, kind: 'growth', postsMean: 27, commentsPerPost: 10, contributorsMean: 36, conflictMean: 0.15, diversityMean: 0.36, topThreadsMean: [120, 70, 38, 18], theme: 'momentum builds', jitter: 0.24 },
  { day: 7, kind: 'growth', postsMean: 38, commentsPerPost: 11, contributorsMean: 50, conflictMean: 0.18, diversityMean: 0.42, topThreadsMean: [180, 96, 52, 24], theme: 'going mainstream', jitter: 0.24 },
  { day: 8, kind: 'growth', postsMean: 49, commentsPerPost: 12, contributorsMean: 64, conflictMean: 0.22, diversityMean: 0.46, topThreadsMean: [240, 130, 70, 34], theme: 'a busy week', jitter: 0.26 },
  { day: 9, kind: 'quiet', postsMean: 33, commentsPerPost: 10, contributorsMean: 45, conflictMean: 0.16, diversityMean: 0.4, topThreadsMean: [150, 80, 40], theme: 'catching breath', jitter: 0.22 },
  { day: 10, kind: 'growth', postsMean: 58, commentsPerPost: 13, contributorsMean: 78, conflictMean: 0.28, diversityMean: 0.5, topThreadsMean: [300, 170, 92, 44], theme: 'tensions simmer', jitter: 0.26 },
  { day: 11, kind: 'growth', postsMean: 66, commentsPerPost: 14, contributorsMean: 88, conflictMean: 0.4, diversityMean: 0.52, topThreadsMean: [360, 210, 120, 60], theme: 'the debate opens', jitter: 0.28 },

  // --- Drama spike: the community fractures for a day (~day 12, red). ---
  { day: 12, kind: 'drama', postsMean: 92, commentsPerPost: 18, contributorsMean: 120, conflictMean: 0.88, diversityMean: 0.34, topThreadsMean: [820, 540, 360, 180], theme: 'the great schism', jitter: 0.18 },

  // --- Recovery growth: the dust settles, people return (days 13-19). ---
  { day: 13, kind: 'quiet', postsMean: 40, commentsPerPost: 9, contributorsMean: 55, conflictMean: 0.3, diversityMean: 0.38, topThreadsMean: [200, 100, 50], theme: 'an uneasy truce', jitter: 0.22 },
  { day: 14, kind: 'growth', postsMean: 52, commentsPerPost: 11, contributorsMean: 70, conflictMean: 0.22, diversityMean: 0.46, topThreadsMean: [260, 150, 80, 38], theme: 'rebuilding trust', jitter: 0.24 },
  { day: 15, kind: 'growth', postsMean: 61, commentsPerPost: 12, contributorsMean: 82, conflictMean: 0.2, diversityMean: 0.5, topThreadsMean: [320, 180, 100, 48], theme: 'new projects', jitter: 0.24 },
  { day: 16, kind: 'quiet', postsMean: 44, commentsPerPost: 10, contributorsMean: 60, conflictMean: 0.14, diversityMean: 0.44, topThreadsMean: [210, 110, 56], theme: 'a quiet stretch', jitter: 0.22 },
  { day: 17, kind: 'growth', postsMean: 70, commentsPerPost: 13, contributorsMean: 92, conflictMean: 0.18, diversityMean: 0.54, topThreadsMean: [380, 220, 124, 60], theme: 'anticipation', jitter: 0.24 },
  { day: 18, kind: 'growth', postsMean: 78, commentsPerPost: 14, contributorsMean: 104, conflictMean: 0.2, diversityMean: 0.56, topThreadsMean: [430, 250, 140, 70], theme: 'the announcement', jitter: 0.24 },
  { day: 19, kind: 'growth', postsMean: 84, commentsPerPost: 15, contributorsMean: 112, conflictMean: 0.22, diversityMean: 0.58, topThreadsMean: [470, 280, 160, 80], theme: 'the eve', jitter: 0.24 },

  // --- AMA day: a few huge bright clusters dwarf everything else (~day 20). ---
  { day: 20, kind: 'ama', postsMean: 64, commentsPerPost: 22, contributorsMean: 140, conflictMean: 0.18, diversityMean: 0.4, topThreadsMean: [1400, 760, 420], theme: 'the big AMA', jitter: 0.16 },

  // --- Settle + quiet: the universe cools toward the frontier (days 21-30). ---
  { day: 21, kind: 'growth', postsMean: 56, commentsPerPost: 12, contributorsMean: 74, conflictMean: 0.16, diversityMean: 0.5, topThreadsMean: [300, 170, 90, 44], theme: 'the afterglow', jitter: 0.24 },
  { day: 22, kind: 'quiet', postsMean: 38, commentsPerPost: 9, contributorsMean: 52, conflictMean: 0.12, diversityMean: 0.42, topThreadsMean: [180, 96, 48], theme: 'winding down', jitter: 0.22 },
  { day: 23, kind: 'quiet', postsMean: 29, commentsPerPost: 8, contributorsMean: 40, conflictMean: 0.1, diversityMean: 0.38, topThreadsMean: [140, 72, 34], theme: 'a slow day', jitter: 0.22 },
  { day: 24, kind: 'growth', postsMean: 46, commentsPerPost: 11, contributorsMean: 62, conflictMean: 0.14, diversityMean: 0.48, topThreadsMean: [240, 130, 68, 32], theme: 'small revival', jitter: 0.24 },
  { day: 25, kind: 'quiet', postsMean: 24, commentsPerPost: 8, contributorsMean: 34, conflictMean: 0.09, diversityMean: 0.34, topThreadsMean: [110, 58, 28], theme: 'the long tail', jitter: 0.2 },
  { day: 26, kind: 'quiet', postsMean: 19, commentsPerPost: 7, contributorsMean: 28, conflictMean: 0.08, diversityMean: 0.3, topThreadsMean: [90, 44, 20], theme: 'regulars only', jitter: 0.2 },
  { day: 27, kind: 'quiet', postsMean: 16, commentsPerPost: 7, contributorsMean: 24, conflictMean: 0.07, diversityMean: 0.28, topThreadsMean: [72, 36, 16], theme: 'embers', jitter: 0.2 },
  { day: 28, kind: 'quiet', postsMean: 13, commentsPerPost: 6, contributorsMean: 20, conflictMean: 0.06, diversityMean: 0.24, topThreadsMean: [58, 28], theme: 'quiet skies', jitter: 0.2 },
  { day: 29, kind: 'quiet', postsMean: 11, commentsPerPost: 6, contributorsMean: 17, conflictMean: 0.05, diversityMean: 0.22, topThreadsMean: [46, 22], theme: 'near silence', jitter: 0.2 },
  { day: 30, kind: 'quiet', postsMean: 9, commentsPerPost: 6, contributorsMean: 14, conflictMean: 0.05, diversityMean: 0.2, topThreadsMean: [38, 18], theme: 'the frontier', jitter: 0.2 },
];

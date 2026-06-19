// fixtures — fixed DayVector[] for deterministic engine tests.
//
// This is the ONE place a Zod boundary runs in Phase 1: each raw day object is
// validated by DayVectorSchema.parse() here (the test/sim boundary), so the
// synthesis tests can trust the z.infer type (no .parse inside synthesize —
// QA-03). The shapes mirror the mock's `eras[]` (docs/subcosm-universe-mock.html
// lines 116-131): day / posts / conflict / topThreads / steering.
//
// Three representative days, each with a fixed `seed` so synthesis is byte-
// reproducible:
//   - cold-start day-1 (genesis): posts 1, conflict 0 → core only, no elements
//   - dense high-conflict day: high posts, conflict ~0.9 → many turbulent stars
//   - AMA day: high topThreads → many "big" clusters (high nbig)
import { DayVectorSchema, type DayVector } from '../src/engine/contracts';
import { calm } from '../src/engine/genomes/calm';

const rawDays = [
  // Dense, high-conflict day (frontier-style). Many posts → dense shell; high
  // conflict → turbulence + redshift. AMA-like high topThreads too.
  {
    day: 44,
    date: '2026-06-16',
    posts: 410,
    comments: 6200,
    contributors: 350,
    scoreSum: 12000,
    topThreads: [980, 540, 320],
    conflict: 0.85,
    momentum: 0.4,
    diversity: 0.6,
    dominantTheme: 'election night',
    steering: { branch: 0.2, symmetry: 1, hue: 0.7 },
    seed: 0x44a1b2c3,
  },
  // AMA-style day: moderate posts but very high topThreads → high nbig clusters.
  {
    day: 36,
    date: '2026-06-08',
    posts: 210,
    comments: 5200,
    contributors: 240,
    scoreSum: 9000,
    topThreads: [1500, 300, 120],
    conflict: 0.2,
    momentum: 0.1,
    diversity: 0.7,
    dominantTheme: 'ask me anything',
    steering: { branch: 0.1, symmetry: 0, hue: 0.12 },
    seed: 0x36ffee01,
  },
  // Cold-start genesis day-1: a single post. genesis → core only, no elements.
  {
    day: 1,
    date: '2026-05-04',
    posts: 1,
    comments: 12,
    contributors: 8,
    scoreSum: 20,
    topThreads: [12],
    conflict: 0,
    momentum: 0,
    diversity: 0,
    dominantTheme: 'the first post',
    steering: { branch: 0, symmetry: 0, hue: 0.13 },
    seed: 0x00010203,
  },
];

// Validate at the boundary (the only .parse in the Phase-1 engine path).
export const fixtureDays: DayVector[] = rawDays.map((d) =>
  DayVectorSchema.parse(d),
);

// Convenience accessors for assertions (index-stable).
export const denseDay: DayVector = fixtureDays[0]!;
export const amaDay: DayVector = fixtureDays[1]!;
export const coldStartDay: DayVector = fixtureDays[2]!;

// Re-export the Calm preset so tests import a single fixtures module.
export { calm };

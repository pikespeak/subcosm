// dev-fixture — a small DayVector[] for the dev harness, BEFORE the simulator.
//
// Why local (deviation, Rule 3): the plan points at `tests/fixtures.ts`, but
// `tests/` is not a composite TS project and the client project cannot import
// across that rootDir boundary without spanning the test tree into the client
// build. Plan 02-02 introduces the real simulator (the canonical DayVector
// source); this module is the throwaway stand-in until then. The values mirror
// tests/fixtures.ts (a dense high-conflict frontier day + a genesis day) so the
// dev page shows a populated frontier shell + a genesis core.
//
// This IS a legitimate Zod boundary (CLAUDE.md §6): each raw day is validated by
// DayVectorSchema.parse() once here; the engine then trusts the inferred type.
import { DayVectorSchema, type DayVector } from '../../engine/contracts';

const rawDays = [
  // Dense, high-conflict frontier day → many turbulent stars in shell-0.
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
  // Cold-start genesis day-1: a single post → core only, no elements.
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

// Validate at the boundary — the one .parse() the dev page runs (QA-03).
export const fixtureDays: DayVector[] = rawDays.map((d) => DayVectorSchema.parse(d));

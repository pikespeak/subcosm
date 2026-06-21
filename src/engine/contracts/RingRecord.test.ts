// RingRecord — contract tests (DEV-05 read/write boundary shape).
//
// RingRecordSchema = DayVectorSchema extended with `genomeVersion`. These tests
// lock the boundary behaviour the tick (write) and the ring service (read) rely
// on: a full DayVector + integer genomeVersion parses; a record missing a
// required DayVector scalar is REJECTED (V5 — a malformed Redis hash must never
// reach render); and the schema carries ONLY scalars (no image/pixel field), so
// DEV-05's "no stored images" is structurally guaranteed.
import { describe, expect, test } from 'vitest';
import { RingRecordSchema, type RingRecord } from './RingRecord';

// A minimal-but-complete valid DayVector payload (mirrors DayVectorSchema).
const validDayVector = {
  day: 4,
  date: '2026-06-04',
  posts: 12,
  comments: 30,
  contributors: 5,
  scoreSum: 84,
  topThreads: [8, 5, 2],
  conflict: 0.42,
  momentum: 0.1,
  diversity: 0.3,
  dominantTheme: 'genesis',
  steering: { branch: 0, symmetry: 0, hue: 0 },
  seed: 123456789,
};

describe('RingRecordSchema', () => {
  test('accepts a full DayVector plus an integer genomeVersion', () => {
    const parsed = RingRecordSchema.parse({ ...validDayVector, genomeVersion: 1 });
    expect(parsed.genomeVersion).toBe(1);
    expect(parsed.day).toBe(4);
    expect(parsed.seed).toBe(123456789);
    expect(parsed.topThreads).toEqual([8, 5, 2]);
  });

  test('rejects a record missing a required DayVector scalar (posts)', () => {
    const { posts: _omit, ...withoutPosts } = validDayVector;
    void _omit;
    expect(() =>
      RingRecordSchema.parse({ ...withoutPosts, genomeVersion: 1 }),
    ).toThrow();
  });

  test('rejects a record missing genomeVersion', () => {
    expect(() => RingRecordSchema.parse({ ...validDayVector })).toThrow();
  });

  test('rejects a negative genomeVersion (must be a nonnegative int)', () => {
    expect(() =>
      RingRecordSchema.parse({ ...validDayVector, genomeVersion: -1 }),
    ).toThrow();
  });

  test('carries no image/pixel field — DEV-05 no-stored-images is structural', () => {
    const parsed: RingRecord = RingRecordSchema.parse({
      ...validDayVector,
      genomeVersion: 1,
    });
    const record = parsed as Record<string, unknown>;
    // The render-shaped record is ~scalars + seed + genomeVersion only.
    expect(record['image']).toBeUndefined();
    expect(record['pixels']).toBeUndefined();
    expect(record['png']).toBeUndefined();
    expect(record['bitmap']).toBeUndefined();
  });
});

// beats.test — the scripted-story beat table exists and describes the D-03 arc.
//
// RED (Task 1): `beats` does not exist yet, so this file fails to import. Task 2
// authors `src/sim/beats.ts` and turns it GREEN.
//
// These assertions pin the SHAPE of the story (cold-start -> growth -> drama ->
// AMA -> quiet over ~30 days) on the beat table itself, deliberately WITHOUT
// hard-coding exact day indices — the planner left beat positions to Claude's
// discretion (D-03), so the tests must survive tuning.
import { describe, expect, test } from 'vitest';
import { beats } from './beats';

describe('beats table (SIM-01 — the scripted story arc)', () => {
  test('covers a ~30-day arc with positive, ascending day numbers starting at genesis', () => {
    expect(beats.length).toBeGreaterThanOrEqual(25);
    expect(beats.length).toBeLessThanOrEqual(40);

    // Day 1 = genesis cold-start is the first beat.
    expect(beats[0]!.day).toBe(1);

    // Every beat has a positive day; days are strictly ascending (genesis-ward).
    for (let i = 0; i < beats.length; i++) {
      expect(beats[i]!.day).toBeGreaterThan(0);
      expect(Number.isInteger(beats[i]!.day)).toBe(true);
      if (i > 0) expect(beats[i]!.day).toBeGreaterThan(beats[i - 1]!.day);
    }
  });

  test('day-1 cold-start beat is intentionally quiet (low activity mean)', () => {
    const genesis = beats[0]!;
    expect(genesis.kind).toBe('cold-start');
    // A near-empty universe begins: very few posts on average.
    expect(genesis.postsMean).toBeLessThanOrEqual(5);
  });

  test('exactly one drama beat with a high conflict mean', () => {
    const drama = beats.filter((b) => b.kind === 'drama');
    expect(drama.length).toBe(1);
    expect(drama[0]!.conflictMean).toBeGreaterThanOrEqual(0.7);
  });

  test('exactly one AMA beat that produces a few large clusters', () => {
    const ama = beats.filter((b) => b.kind === 'ama');
    expect(ama.length).toBe(1);
    // AMA = a handful of huge threads (few big topThreads), not a flood.
    expect(ama[0]!.topThreadsMean.length).toBeGreaterThanOrEqual(1);
    expect(ama[0]!.topThreadsMean.length).toBeLessThanOrEqual(5);
    expect(Math.max(...ama[0]!.topThreadsMean)).toBeGreaterThanOrEqual(300);
  });

  test('contains growth and quiet beats (the full arc)', () => {
    const kinds = new Set(beats.map((b) => b.kind));
    expect(kinds.has('growth')).toBe(true);
    expect(kinds.has('quiet')).toBe(true);
  });

  test('the drama beat precedes the AMA beat (story order: rising action -> climax)', () => {
    const dramaDay = beats.find((b) => b.kind === 'drama')!.day;
    const amaDay = beats.find((b) => b.kind === 'ama')!.day;
    expect(dramaDay).toBeLessThan(amaDay);
  });
});

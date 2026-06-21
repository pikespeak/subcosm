// schedule — unit tests for the PURE, DST-safe local-midnight + jitter helpers (DEV-04 / D-03).
//
// These helpers gate the hourly UTC sweeper: a community freezes its frontier only
// when its OWN IANA-local clock is at 00:xx (past a deterministic per-sub minute
// jitter). The point of these tests is to prove DST-correctness WITHOUT a live run:
//   - localHourMinute(nowUtc, tz) reads the community-local wall clock via native
//     Intl.DateTimeFormat — the SAME UTC instant maps to different local hours
//     across a DST boundary (Berlin is UTC+2 in summer, UTC+1 in winter), so a
//     fixed 22:00Z is local midnight in July but 23:00 in January.
//   - isLocalMidnightWithJitter is true only during the local 00:xx hour at/after
//     the hash(subId)%60 minute offset, and is deterministic (no Math.random).
//
// PURE module: no @devvit/web import, no Redis, no process.env.TZ mutation — so the
// suite runs in the standalone (no-real-Devvit) runner with no mock needed.
import { describe, expect, test } from 'vitest';
import {
  localHourMinute,
  isLocalMidnightWithJitter,
  jitterMinute,
} from './schedule';

describe('localHourMinute — native Intl, DST-aware', () => {
  test('Berlin: a fixed 22:00Z is local midnight in summer (CEST, UTC+2)', () => {
    const { hour, minute } = localHourMinute(
      new Date('2024-07-01T22:00:00Z'),
      'Europe/Berlin'
    );
    expect(hour).toBe(0); // 22:00Z + 2h (CEST) = 00:00 local
    expect(minute).toBe(0);
  });

  test('Berlin: the SAME 22:00Z is 23:00 local in winter (CET, UTC+1) — DST-aware', () => {
    const { hour } = localHourMinute(
      new Date('2024-01-01T22:00:00Z'),
      'Europe/Berlin'
    );
    expect(hour).toBe(23); // 22:00Z + 1h (CET) = 23:00 local — NOT midnight
  });

  test('Berlin: 23:00Z is local midnight in winter (CET, UTC+1)', () => {
    const { hour, minute } = localHourMinute(
      new Date('2024-01-01T23:00:00Z'),
      'Europe/Berlin'
    );
    expect(hour).toBe(0); // 23:00Z + 1h = 00:00 local
    expect(minute).toBe(0);
  });

  test('UTC zone is the identity (no offset)', () => {
    const { hour, minute } = localHourMinute(
      new Date('2024-03-15T00:30:00Z'),
      'UTC'
    );
    expect(hour).toBe(0);
    expect(minute).toBe(30);
  });

  test('America/New_York: 05:00Z in winter (EST, UTC-5) is local midnight', () => {
    const { hour } = localHourMinute(
      new Date('2024-01-01T05:00:00Z'),
      'America/New_York'
    );
    expect(hour).toBe(0); // 05:00Z - 5h (EST) = 00:00 local
  });
});

describe('jitterMinute — deterministic per-sub minute offset (no Math.random)', () => {
  test('is in [0, 60) for any sub id', () => {
    for (const sub of ['t5_a', 't5_b', 't5_zzz', 'subcosm', '']) {
      const j = jitterMinute(sub);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(60);
      expect(Number.isInteger(j)).toBe(true);
    }
  });

  test('is deterministic — the same sub id always yields the same minute', () => {
    expect(jitterMinute('t5_subcosm')).toBe(jitterMinute('t5_subcosm'));
  });

  test('spreads load — distinct sub ids do not all collapse to one minute', () => {
    const minutes = new Set(
      ['t5_a', 't5_b', 't5_c', 't5_d', 't5_e', 't5_f'].map(jitterMinute)
    );
    expect(minutes.size).toBeGreaterThan(1);
  });
});

describe('isLocalMidnightWithJitter — gates the sweeper at local 00:xx past the jitter', () => {
  const SUB = 't5_fixed';
  const j = jitterMinute(SUB); // the deterministic offset for this sub

  test('true during the local 00:xx hour at/after the jitter minute', () => {
    // Construct a UTC instant whose Berlin-local time is 00:(j) in summer:
    // local midnight is 22:00Z (CEST), so add j minutes.
    const nowUtc = new Date(Date.UTC(2024, 6, 1, 22, j, 0));
    expect(localHourMinute(nowUtc, 'Europe/Berlin').hour).toBe(0); // sanity
    expect(isLocalMidnightWithJitter(nowUtc, 'Europe/Berlin', SUB)).toBe(true);
  });

  test('false BEFORE the jitter minute within the local 00:xx hour', () => {
    if (j === 0) return; // no "before" minute exists for a 0 jitter
    const nowUtc = new Date(Date.UTC(2024, 6, 1, 22, j - 1, 0));
    expect(localHourMinute(nowUtc, 'Europe/Berlin').hour).toBe(0); // still 00:xx
    expect(isLocalMidnightWithJitter(nowUtc, 'Europe/Berlin', SUB)).toBe(false);
  });

  test('false outside the local 00:xx hour (e.g. local 01:xx)', () => {
    const nowUtc = new Date(Date.UTC(2024, 6, 1, 23, j, 0)); // Berlin 01:(j)
    expect(localHourMinute(nowUtc, 'Europe/Berlin').hour).toBe(1);
    expect(isLocalMidnightWithJitter(nowUtc, 'Europe/Berlin', SUB)).toBe(false);
  });

  test('DST-safe: a fixed 22:00Z fires for Berlin in summer but NOT in winter', () => {
    const summer = new Date(Date.UTC(2024, 6, 1, 22, j, 0)); // local 00:(j)
    const winter = new Date(Date.UTC(2024, 0, 1, 22, j, 0)); // local 23:(j)
    expect(isLocalMidnightWithJitter(summer, 'Europe/Berlin', SUB)).toBe(true);
    expect(isLocalMidnightWithJitter(winter, 'Europe/Berlin', SUB)).toBe(false);
  });

  test('is deterministic — same inputs always yield the same gate (no Math.random)', () => {
    const nowUtc = new Date(Date.UTC(2024, 6, 1, 22, j, 0));
    const a = isLocalMidnightWithJitter(nowUtc, 'Europe/Berlin', SUB);
    const b = isLocalMidnightWithJitter(nowUtc, 'Europe/Berlin', SUB);
    expect(a).toBe(b);
  });
});

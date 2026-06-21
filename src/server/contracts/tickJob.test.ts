// tickJob — boundary schema tests for the scheduler `data` payload (T-03-06).
//
// The scheduler `data` ({ subId, day }) is an UNTRUSTED boundary crossing into
// the server; the /tick handler `.parse()`s it before runTick. These tests lock
// the accept/reject behaviour: a well-formed payload parses; a missing subId or
// a non-positive / non-integer day is REJECTED (V5).
import { describe, expect, test } from 'vitest';
import { TickJobSchema, type TickJob } from './tickJob';

describe('TickJobSchema', () => {
  test('accepts { subId: string, day: positive int }', () => {
    const parsed: TickJob = TickJobSchema.parse({ subId: 't5_sub', day: 3 });
    expect(parsed.subId).toBe('t5_sub');
    expect(parsed.day).toBe(3);
  });

  test('rejects a missing subId', () => {
    expect(() => TickJobSchema.parse({ day: 3 })).toThrow();
  });

  test('rejects a non-string subId', () => {
    expect(() => TickJobSchema.parse({ subId: 123, day: 3 })).toThrow();
  });

  test('rejects a non-positive day (0)', () => {
    expect(() => TickJobSchema.parse({ subId: 't5_sub', day: 0 })).toThrow();
  });

  test('rejects a negative day', () => {
    expect(() => TickJobSchema.parse({ subId: 't5_sub', day: -2 })).toThrow();
  });

  test('rejects a non-integer day', () => {
    expect(() => TickJobSchema.parse({ subId: 't5_sub', day: 2.5 })).toThrow();
  });
});

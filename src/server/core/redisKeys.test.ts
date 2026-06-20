// redisKeys — unit tests for the central organism:{sub}:* key-builder.
//
// The key-builder is a PURE string module (no Devvit import): the same args
// always return the identical key, and two distinct subs/days never collide.
// These are the namespacing invariants the whole data layer (triggers, ring
// store, sweeper) depends on (DEV-02/DEV-05).
import { describe, expect, test } from 'vitest';
import { keys } from './redisKeys';

describe('redisKeys', () => {
  test('every key is namespaced under organism:{sub}', () => {
    const sub = 't5_abc';
    expect(keys.counter(sub, 'comments')).toContain(`organism:${sub}`);
    expect(keys.contributors(sub, 3)).toContain(`organism:${sub}`);
    expect(keys.threads(sub, 3)).toContain(`organism:${sub}`);
    expect(keys.ringCount(sub)).toContain(`organism:${sub}`);
    expect(keys.ring(sub, 1)).toContain(`organism:${sub}`);
    expect(keys.config(sub)).toContain(`organism:${sub}`);
    expect(keys.lastTickDay(sub)).toContain(`organism:${sub}`);
  });

  test('keys are pure — identical args return the identical string', () => {
    expect(keys.counter('t5_a', 'comments')).toBe(keys.counter('t5_a', 'comments'));
    expect(keys.contributors('t5_a', 7)).toBe(keys.contributors('t5_a', 7));
    expect(keys.ring('t5_a', 2)).toBe(keys.ring('t5_a', 2));
    expect(keys.registry()).toBe(keys.registry());
  });

  test('two distinct subs never collide', () => {
    expect(keys.counter('t5_a', 'comments')).not.toBe(keys.counter('t5_b', 'comments'));
    expect(keys.ringCount('t5_a')).not.toBe(keys.ringCount('t5_b'));
    expect(keys.config('t5_a')).not.toBe(keys.config('t5_b'));
    expect(keys.contributors('t5_a', 1)).not.toBe(keys.contributors('t5_b', 1));
  });

  test('day-scoped keys differ across days; counter keys differ across names', () => {
    expect(keys.contributors('t5_a', 1)).not.toBe(keys.contributors('t5_a', 2));
    expect(keys.threads('t5_a', 1)).not.toBe(keys.threads('t5_a', 2));
    expect(keys.ring('t5_a', 1)).not.toBe(keys.ring('t5_a', 2));
    expect(keys.counter('t5_a', 'comments')).not.toBe(keys.counter('t5_a', 'posts'));
  });

  test('the key schema matches the RESEARCH organism:{sub}:* shape', () => {
    const sub = 't5_x';
    expect(keys.contributors(sub, 4)).toBe(`organism:${sub}:contributors:4`);
    expect(keys.threads(sub, 4)).toBe(`organism:${sub}:threads:4`);
    expect(keys.ringCount(sub)).toBe(`organism:${sub}:ringCount`);
    expect(keys.ring(sub, 4)).toBe(`organism:${sub}:ring:4`);
    expect(keys.config(sub)).toBe(`organism:${sub}:config`);
    // counters are standalone integer keys (RESEARCH Pattern 2 uses
    // redis.incrBy(keys.counter(sub,'comments'),1) — an incrBy on a KEY, so each
    // counter name is its own key under the per-sub counters namespace).
    expect(keys.counter(sub, 'comments')).toBe(`organism:${sub}:counters:comments`);
    expect(keys.lastTickDay(sub)).toBe(`organism:${sub}:lastTickDay`);
    expect(keys.registry()).toBe('subs:registry');
  });
});

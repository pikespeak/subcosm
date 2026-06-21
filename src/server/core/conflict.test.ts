// conflict — unit tests for the pure D-02 conflict-composite normalization.
//
// The conflict metric (DEV-03 / D-02) is a 0..1 composite derived from two
// volume-normalized proxies: reply-depth ratio (replies / max(comments,1)) and
// heat (comments / max(posts,1)), each squashed through a saturating x/(x+k)
// curve and blended. These tests lock the INTENT (T-03-04 manipulation
// resistance): a few deep replies from one user must NOT spike the metric, the
// output is always within [0,1] for any non-negative input (no NaN/Infinity),
// and the function is pure + deterministic. This is the only genuinely-new
// design work in the plan, so it is proven first (RED) before implementing.
import { describe, expect, test } from 'vitest';
import { conflictComposite } from './conflict';

describe('conflictComposite', () => {
  test('low conflict for modest heat with no replies', () => {
    // 10 posts, 10 comments, 0 replies → replyRatio 0, heat 1.
    const c = conflictComposite({ posts: 10, comments: 10, replies: 0 });
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(0.5);
  });

  test('high conflict for a deep + hot day', () => {
    // 1 post, 50 comments, 40 replies → replyRatio 0.8, heat 50.
    const c = conflictComposite({ posts: 1, comments: 50, replies: 40 });
    expect(c).toBeGreaterThan(0.7);
  });

  test('monotonic: more replies at fixed volume never lowers conflict', () => {
    const base = conflictComposite({ posts: 5, comments: 100, replies: 10 });
    const more = conflictComposite({ posts: 5, comments: 100, replies: 30 });
    expect(more).toBeGreaterThanOrEqual(base);
  });

  test('spam resistance: a handful of deep replies on a high-comment day barely moves conflict', () => {
    // A single spammer adds ~5 deep replies to a busy day (200 comments).
    // Because replyRatio = replies / max(comments,1) is volume-normalized, the
    // metric must move only marginally and stay well below saturation (T-03-04).
    const before = conflictComposite({ posts: 20, comments: 200, replies: 10 });
    const afterSpam = conflictComposite({ posts: 20, comments: 200, replies: 15 });
    expect(afterSpam - before).toBeLessThan(0.05);
    expect(afterSpam).toBeLessThan(0.85);
  });

  test('output is always within [0,1] for assorted non-negative inputs', () => {
    const cases = [
      { posts: 0, comments: 0, replies: 0 },
      { posts: 0, comments: 100, replies: 100 },
      { posts: 1000, comments: 0, replies: 0 },
      { posts: 1, comments: 1, replies: 1 },
      { posts: 1, comments: 99999, replies: 99999 },
      { posts: 7, comments: 3, replies: 9 }, // replies > comments (degenerate but non-negative)
    ];
    for (const proxies of cases) {
      const c = conflictComposite(proxies);
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  test('zero input yields exactly 0 with no NaN (guarded max(comments,1)/max(posts,1))', () => {
    const c = conflictComposite({ posts: 0, comments: 0, replies: 0 });
    expect(c).toBe(0);
  });

  test('pure + deterministic: identical input returns identical output', () => {
    const a = conflictComposite({ posts: 3, comments: 12, replies: 4 });
    const b = conflictComposite({ posts: 3, comments: 12, replies: 4 });
    expect(a).toBe(b);
  });
});

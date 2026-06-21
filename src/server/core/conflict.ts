// conflict — the pure D-02 conflict-composite normalization (DEV-03).
//
// PURITY (CLAUDE.md determinism + plan threat T-03-04): this module is a pure,
// deterministic 0..1 function — NO Devvit import, NO Redis, NO I/O, NO
// Math.random. Although `src/server/**` is permitted to import `@devvit/*`, the
// conflict curve must stay pure so it is trivially unit-testable and reusable by
// the tick (plan 03-04) without any runtime. Redis access for the input proxies
// lives in counters.ts / the route layer, never here. Parse at boundaries only —
// this is downstream of the boundary, operating on already-accumulated scalars.
//
// Design (RESEARCH "Don't Hand-Roll" conflict row + Assumption A7): there is no
// vote stream (Pitfall 3 — no onVote trigger), so `conflict` is derived from two
// volume-normalized proxies and squashed through a saturating curve so a few
// deep replies from a single spammer cannot spike it (D-02 intent):
//
//   replyRatio = replies / max(comments, 1)   // 0..~1 — thread depth, per comment
//   heat       = comments / max(posts, 1)     // 0..∞  — comments per post
//
// Each is squashed independently through `x / (x + k)` — a saturating curve that
// maps [0,∞) → [0,1), is 0 at x=0, monotonically increasing, and flattens as x
// grows (so doubling an already-high value barely moves the output). The two
// squashed terms are blended with documented weights and clamped to [0,1].
//
// Manipulation resistance (T-03-04): because replyRatio normalizes replies
// AGAINST the comment volume, adding a handful of deep replies to a busy day
// raises `replies` by a small fraction of `comments`, so replyRatio — and thus
// conflict — moves only marginally. The saturating curve compounds this: near
// saturation the marginal gain per extra reply is tiny.

/**
 * Accumulated conflict proxies for one community-day. All non-negative integers
 * read from Redis counters (posts / comments / replies). Declared as a narrow
 * inline param type — it is NOT a contract shape (it never crosses a trust
 * boundary), so there is no Zod schema / no `z.infer` duplication here.
 */
export type ConflictProxies = {
  /** Daily post count (denominator of heat). */
  posts: number;
  /** Daily comment count (denominator of replyRatio, numerator of heat). */
  comments: number;
  /** Daily reply count (comments whose parentId is another comment → t1_). */
  replies: number;
};

// Saturation constants (A7 — Claude's discretion, tuned + documented here).
//
// K_RATIO governs the reply-depth term. replyRatio ∈ [0, ~1] in normal use, so a
// smaller k makes the curve rise faster across that range. At replyRatio = 0.5
// (half of comments are replies — a genuinely deep day) the squashed term is
// 0.5/(0.5+0.35) ≈ 0.59; at 0.8 it is ≈ 0.70 — clearly "deep" without saturating.
const K_RATIO = 0.35;

// K_HEAT governs the heat term. heat (comments/post) is unbounded and routinely
// larger than replyRatio, so a larger k keeps a merely-busy day from pinning the
// term at 1. At heat = 10 the squashed term is 10/(10+12) ≈ 0.45; at heat = 50
// it is ≈ 0.81 — a hot day reads hot but never instantly saturates.
const K_HEAT = 12;

// Blend weights — reply-depth (contention) is weighted slightly above raw heat,
// since deep threading is the stronger contention signal (D-02). Sum to 1 so the
// blend is already in [0,1]; the final clamp is a defensive guard.
const W_RATIO = 0.6;
const W_HEAT = 0.4;

/** Clamp to [0,1] — same idiom as `clamp01` in src/sim/generator.ts. */
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Saturating squash `x / (x + k)`: maps [0,∞) → [0,1), 0 at x=0, monotone. */
const saturate = (x: number, k: number): number => x / (x + k);

/**
 * conflictComposite — pure 0..1 conflict metric from comment-rate + reply-depth
 * proxies (DEV-03 / D-02). Volume-normalized and saturating, so it is robust to
 * a single user spamming deep replies (T-03-04). Returns exactly 0 for an empty
 * day and never NaN/Infinity (denominators guarded via max(·,1)).
 */
export function conflictComposite(proxies: ConflictProxies): number {
  // Guard denominators so an empty/degenerate day yields 0, never NaN/Infinity.
  const comments = Math.max(0, proxies.comments);
  const posts = Math.max(0, proxies.posts);
  const replies = Math.max(0, proxies.replies);

  const replyRatio = replies / Math.max(comments, 1); // volume-normalized depth
  const heat = comments / Math.max(posts, 1); // comments per post

  const depthTerm = saturate(replyRatio, K_RATIO); // [0,1)
  const heatTerm = saturate(heat, K_HEAT); // [0,1)

  return clamp01(W_RATIO * depthTerm + W_HEAT * heatTerm);
}

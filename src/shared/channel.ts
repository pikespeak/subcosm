// channel — the per-post realtime channel-name builder (LIVE-01 / D-03).
//
// CLIENT-SAFE (CLAUDE.md §6 bundle safety): this module is imported by BOTH the
// client (`connectRealtime` subscribe) AND the server (`realtime.send` broadcast),
// so it must stay free of any server-only or Devvit-server import. It is pure
// string math — zero dependencies.
//
// WHY A SHARED HELPER: the client and the server MUST build the BYTE-IDENTICAL
// channel name (the server broadcasts on it; the client subscribes to it). The
// single source of truth lives here so the two sides cannot drift (RESEARCH
// Pattern 2).
//
// THE COLON BAN (LIVE-01 hard constraint): realtime channel names must contain NO
// colons. Reddit thing-ids (`t3_abc123`, `t5_xyz`) use `_`, never `:`, so the post
// id is already safe — but we whitelist `[A-Za-z0-9_-]` and replace everything
// else (defensively, including any stray `:`) with `-`. NB: this ban applies ONLY
// to realtime channel names; the Redis KEY builders (redisKeys.ts) keep `:` to
// match the existing `organism:{sub}:*` schema — do not confuse the two.

/**
 * steerChannel — the colon-free per-post live-steer channel name (client + server
 * build the identical string).
 *
 * Returns `subcosm-steer-${postId}` with any char outside `[A-Za-z0-9_-]` replaced
 * by `-`, so the result is guaranteed to contain NO `:` (LIVE-01). `postId` is the
 * platform-trusted `context.postId` on both sides (never client-body input).
 */
export const steerChannel = (postId: string): string =>
  `subcosm-steer-${postId}`.replace(/[^A-Za-z0-9_-]/g, '-');

import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'subcosm-universe',
  });
};

/**
 * createRevealPost — the LIVE-02 overnight reveal post (D-05).
 *
 * At the daily tick, AFTER the frontier has frozen into ring `ringIndex` (and been
 * scored), the community wakes up to a PINNED interactive Subcosm post that renders
 * the just-frozen universe with a goal/achieved overlay. It reuses the EXISTING
 * `game` entrypoint (game.html) — no new devvit.json entrypoint — and stamps
 * `postData: { ringIndex }` (≤2KB) so the webview knows which frozen ring this
 * reveal celebrates. `post.sticky()` pins it (position 1 by default) within ~1 min
 * of the tick.
 *
 * Boundary discipline:
 *   - `subredditName` MUST be resolved from trusted server context (V4 / T-04-15) by
 *     the caller (the tick resolves it from `context.subredditId` via the reddit
 *     client) — NEVER from a client/scheduler payload.
 *   - The post renders ONLY deterministic ring geometry + an i18n goal/achieved
 *     overlay; no user-authored free text is echoed (T-04-16 — nothing to sanitize).
 *
 * This is a NON-Redis, retry-tolerant side effect: the caller gates it on an
 * exactly-once `revealDone:{sub}:{day}` flag and wraps it in its own try/catch so a
 * reveal failure can never corrupt the already-committed freeze (a missed reveal is
 * tolerable; a DOUBLE reveal is not — Pitfall 3 / OQ2 / T-04-13).
 */
export async function createRevealPost(
  subredditName: string,
  ringIndex: number,
): Promise<void> {
  const post = await reddit.submitCustomPost({
    subredditName,
    title: `subcosm — day ${ringIndex} revealed`,
    entry: 'game', // reuse the built game.html entrypoint (no new entrypoint)
    postData: { ringIndex }, // ≤2KB — which frozen ring this reveal celebrates
  });
  await post.sticky(); // pin (position 1) — within ~1 min of the tick (LIVE-02)
}

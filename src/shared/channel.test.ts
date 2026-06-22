// channel.test — the per-post realtime channel-name builder (LIVE-01 / D-03).
//
// The ONE hard, verifiable constraint is the COLON BAN: a realtime channel name
// must contain no `:` (LIVE-01). The client and server build the name with this
// same helper, so a single contract here proves both sides stay colon-free and
// byte-identical.
import { describe, it, expect } from 'vitest';
import { steerChannel } from './channel';

describe('steerChannel', () => {
  it('contains NO colon for a t3_ post id (LIVE-01 hard constraint)', () => {
    expect(steerChannel('t3_abc123')).not.toContain(':');
  });

  it('builds the stable subcosm-steer-<postId> name for a clean thing-id', () => {
    // t3_/t5_ thing-ids are already [A-Za-z0-9_-]-only — pass through unchanged.
    expect(steerChannel('t3_abc123')).toBe('subcosm-steer-t3_abc123');
  });

  it('replaces every non-[A-Za-z0-9_-] char (incl. a stray colon) with a hyphen', () => {
    // Defensive: anything outside the whitelist (here a `:`) becomes `-`, never `:`.
    const out = steerChannel('weird:id:42');
    expect(out).toBe('subcosm-steer-weird-id-42');
    expect(out).not.toContain(':');
  });

  it('is deterministic — the same post id always yields the same channel', () => {
    expect(steerChannel('t3_xyz')).toBe(steerChannel('t3_xyz'));
  });
});

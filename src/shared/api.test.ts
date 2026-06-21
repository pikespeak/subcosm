// api.test — the shared OrganismResponse contract (DEV-01 / DEV-05).
//
// OrganismResponse is the ONE fetch contract spanning the server `/api/organism`
// handler (which `.parse`s on the way out) and the client `safeParse` at the UI
// boundary. It MUST be `z.infer` of `OrganismResponseSchema` (CLAUDE.md §1) and
// its `rings` MUST reuse `RingRecordSchema` (the 03-03 engine contract) so the
// response cannot drift from what `render()` consumes.
import { describe, it, expect } from 'vitest';
import { OrganismResponseSchema, type OrganismResponse } from './api';
import type { RingRecord } from '../engine/contracts';

/** A minimal-but-complete valid RingRecord (a DayVector + genomeVersion). */
function validRing(day: number): RingRecord {
  return {
    day,
    date: `2026-06-${String(day).padStart(2, '0')}`,
    posts: 4,
    comments: 9,
    contributors: 3,
    scoreSum: 27,
    topThreads: [5, 2],
    conflict: 0.2,
    momentum: 0,
    diversity: 0.4,
    dominantTheme: 'launch',
    steering: { branch: 0, symmetry: 0, hue: 0 },
    seed: 12345 | 0,
    genomeVersion: 1,
  };
}

describe('OrganismResponseSchema', () => {
  it('accepts a valid envelope (rings reuse RingRecordSchema)', () => {
    const envelope = {
      type: 'organism' as const,
      rings: [validRing(1), validRing(2)],
      genome: 'calm',
      style: 'techno',
    };
    const parsed = OrganismResponseSchema.parse(envelope);
    expect(parsed.type).toBe('organism');
    expect(parsed.rings).toHaveLength(2);
    expect(parsed.genome).toBe('calm');
    expect(parsed.style).toBe('techno');
  });

  it('accepts the cold-start empty-rings envelope (rings: [] is valid, not an error)', () => {
    const parsed = OrganismResponseSchema.parse({
      type: 'organism',
      rings: [],
      genome: 'chaotic',
      style: 'techno',
    });
    expect(parsed.rings).toEqual([]);
  });

  it('rejects a ring that is not a valid RingRecord (reuses RingRecordSchema)', () => {
    const result = OrganismResponseSchema.safeParse({
      type: 'organism',
      // missing required scalars (posts/comments/seed/…): not a RingRecord
      rings: [{ day: 1, date: '2026-06-01' }],
      genome: 'calm',
      style: 'techno',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown genome id (enum-constrained)', () => {
    const result = OrganismResponseSchema.safeParse({
      type: 'organism',
      rings: [],
      genome: 'nonsense',
      style: 'techno',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown style id (enum-constrained)', () => {
    const result = OrganismResponseSchema.safeParse({
      type: 'organism',
      rings: [],
      genome: 'calm',
      style: 'hologram',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a wrong type literal (a hostile/foreign envelope)', () => {
    const result = OrganismResponseSchema.safeParse({
      type: 'init',
      rings: [],
      genome: 'calm',
      style: 'techno',
    });
    expect(result.success).toBe(false);
  });

  it('OrganismResponse is the z.infer of the schema (no hand-written type)', () => {
    // Type-level assertion: the inferred type structurally matches the parsed
    // value. If a hand-written `type OrganismResponse` drifted, this would fail
    // to compile.
    const value: OrganismResponse = OrganismResponseSchema.parse({
      type: 'organism',
      rings: [validRing(1)],
      genome: 'calm',
      style: 'techno',
    });
    expect(value.rings[0]?.genomeVersion).toBe(1);
  });
});

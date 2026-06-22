// seed — the SINGLE deterministic ring-seed helper (CLAUDE.md determinism).
//
// `hashSeed(subId, day, genomeVersion)` is a PURE FNV-1a 32-bit hash of
// `${subId}:${day}:${genomeVersion}`, returned as a signed 32-bit int (the
// DayVectorSchema `seed` field requires `z.number().int()`). It is the ONE source
// of a ring's seed: both the live daily freeze (tick.ts) and the D-01 history
// backfill (backfill.ts) call THIS helper, so a backfilled ring and an
// organically-frozen ring for the same (subId, day, genomeVersion) carry the
// identical seed and regenerate byte-identically (D-01 — no divergent seed).
//
// PURE + seedless: NEVER Math.random (CLAUDE.md). The same inputs always yield
// the same int, so a frozen ring is reproducible on every client.

/**
 * Deterministic FNV-1a 32-bit hash of `${subId}:${day}:${genomeVersion}`,
 * returned as a signed 32-bit int. Pure — never Math.random.
 */
export function hashSeed(
  subId: string,
  day: number,
  genomeVersion: number,
): number {
  const input = `${subId}:${day}:${genomeVersion}`;
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // FNV prime 16777619, via Math.imul to stay in 32-bit.
    h = Math.imul(h, 0x01000193);
  }
  return h | 0; // signed 32-bit int
}

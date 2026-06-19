// rng — the ONLY entropy source in the engine (spec subcosm-requirements.md §7; ENG-03/SYN-01).
//
// `mulberry32` is a verbatim port of the seeded PRNG in
// docs/subcosm-universe-mock.html line 134. It is the single source of
// randomness inside src/engine/ — the ESLint engine boundary bans Math.random,
// so every shell's geometry derives from a mulberry32 closure seeded from
// `DayVector.seed`. This is what makes synthesis byte-identically reproducible
// (SYN-01/SYN-02).
//
// SECURITY (RESEARCH §Security V6): mulberry32 is NON-CRYPTOGRAPHIC and
// deterministic-by-design — that is the point (reproducibility > unpredictability).
// It MUST NEVER be used for any security purpose and MUST NEVER be seeded with a
// secret or token. Its sole job is visual determinism.

/**
 * mulberry32 — seeded, non-cryptographic PRNG.
 *
 * Returns a generator that yields a stable, reproducible sequence of floats in
 * [0, 1) for a given integer seed. Same seed → same sequence, always.
 *
 * @param a integer seed (e.g. `DayVector.seed`); never a secret.
 * @returns a zero-arg function producing the next float in [0, 1).
 */
export function mulberry32(a: number): () => number {
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

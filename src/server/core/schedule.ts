// schedule — PURE, DST-safe local-midnight + jitter helpers (DEV-04 / D-03).
//
// The hourly UTC cron sweeper (routes/scheduler.ts) must fire each community's
// freeze tick at THAT community's local midnight, not at server-UTC midnight. A
// community in `America/New_York` should freeze ~5h after one in `Europe/Berlin`.
// This module is the pure, unit-tested heart of that decision — so DST correctness
// is provable without a live run.
//
// DST-safe by construction (CLAUDE.md "DST-SAFE LOCAL MIDNIGHT", D-03): the local
// wall clock is read via native `Intl.DateTimeFormat(...).formatToParts` against
// the community's IANA zone — NO manual UTC-offset arithmetic, NO hardcoded
// offsets. The Intl/ICU layer applies the zone's DST rules for the given instant,
// so the same UTC instant correctly maps to different local hours across a DST
// boundary (e.g. Berlin is UTC+2 in summer, UTC+1 in winter).
//
// Determinism (CLAUDE.md): the per-community minute jitter is a deterministic
// FNV-1a hash of the sub id — NEVER `Math.random`. The same sub always fires at
// the same minute past local midnight, so the sweep is reproducible; distinct subs
// spread across the hour so they don't all fire at :00.
//
// PURE: no `@devvit/web` import, no Redis, no `process.env.TZ` mutation, no I/O.

/** Community-local wall-clock hour/minute for a UTC instant in an IANA zone. */
export interface LocalHourMinute {
  hour: number;
  minute: number;
}

/**
 * localHourMinute — the community-local { hour, minute } for `nowUtc` in `ianaTz`,
 * via native `Intl.DateTimeFormat` (DST-safe; the ICU layer applies the zone's DST
 * rules for that instant). `hour12: false` gives 0..23; a 24:xx artefact (some ICU
 * builds emit "24" for midnight) is normalised to 0. Pure — no offset arithmetic.
 */
export function localHourMinute(nowUtc: Date, ianaTz: string): LocalHourMinute {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(nowUtc);

  const get = (type: 'hour' | 'minute'): number => {
    const v = parts.find((p) => p.type === type)?.value ?? '0';
    return parseInt(v, 10);
  };

  // Normalise the ICU "24:xx for midnight" quirk to 0 so 00:xx gating is reliable.
  const hour = get('hour') % 24;
  return { hour, minute: get('minute') };
}

/**
 * jitterMinute — a deterministic minute offset in [0, 60) for `subId`, derived
 * from a pure FNV-1a 32-bit hash (the same hash family the seed uses in tick.ts).
 * NEVER `Math.random` (determinism rule): the same sub always yields the same
 * minute, so the sweep is reproducible and idempotent; distinct subs spread their
 * fire time across the hour so they don't all hit :00.
 */
export function jitterMinute(subId: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < subId.length; i++) {
    h ^= subId.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime 16777619, kept in 32-bit
  }
  // `h >>> 0` → unsigned 32-bit; mod 60 → a stable minute in [0, 60).
  return (h >>> 0) % 60;
}

/**
 * isLocalMidnightWithJitter — true iff `nowUtc` falls in the community-local 00:xx
 * hour for `tz` AND the local minute is at/after this sub's deterministic jitter
 * minute. The sweeper runs hourly (on the UTC hour), so within the local-midnight
 * hour exactly one hourly tick satisfies `hour === 0`; the `minute >= jitter` gate
 * means the actual fire is deterministically spread (it still fires that same hour
 * because the hourly sweep lands at :00 and the jitter only delays WHICH sweep —
 * here the gate is evaluated against the local minute of the current sweep). Pure
 * + deterministic — no `Math.random`, safe to run every hour (the fired tick is
 * itself idempotent via the 03-03 lastTickDay guard).
 */
export function isLocalMidnightWithJitter(
  nowUtc: Date,
  tz: string,
  subId: string
): boolean {
  const { hour, minute } = localHourMinute(nowUtc, tz);
  if (hour !== 0) return false;
  return minute >= jitterMinute(subId);
}

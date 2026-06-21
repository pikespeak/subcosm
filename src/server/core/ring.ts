// ring — the scan-free Redis ring read/write service (DEV-05).
//
// A frozen daily shell is stored as a Redis HASH at `keys.ring(sub, n)` — ~25
// scalars + seed + genomeVersion, NEVER an image (DEV-05). Rings are enumerated
// by an EXPLICIT integer index `keys.ringCount(sub)` because the Devvit Redis
// client has no key scan (Pitfall 4 — there is NO `redis.keys`/scan call
// anywhere in this module). `writeRing` advances that count atomically via
// `incrBy`; `readAllRings` reads the count and walks `ring:1 … ring:count`.
//
// SINGLE READ BOUNDARY (Pitfall 6 / CLAUDE.md §6): `readAllRings` is the ONE
// place a stored ring is `RingRecordSchema.parse()`'d — a partial/malformed hash
// is rejected here (V5, T-03-08), never trusted raw by render. The write side
// mirrors the sim→engine handoff in generator.ts: the tick builds + parses the
// record (the build boundary) and hands a validated `RingRecord` to `writeRing`,
// which only serializes it.
//
// `sub` is ALWAYS the platform-trusted `context.subredditId` (V4), passed in by
// the caller — never client input.
import { redis } from '@devvit/web/server';
import { keys } from './redisKeys';
import { RingRecordSchema, type RingRecord } from '../../engine/contracts';

// ── Hash field round-trip ────────────────────────────────────────────────────
// Redis hash fields are strings. Composite fields (topThreads array, steering
// object) are JSON-encoded; every other field is a primitive (number/string)
// stringified. `deserializeScalars` reverses this into the raw shape that
// `RingRecordSchema.parse` validates. The round-trip is lossless for the
// RingRecord surface and is unit-covered (ring.test.ts).

/** The composite (JSON-encoded) fields — everything else is a primitive. */
const JSON_FIELDS = ['topThreads', 'steering'] as const;

/** Serialize a validated RingRecord into Redis hash string fields. */
function serializeScalars(ring: RingRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(ring)) {
    // `outcome` is an optional GAME-01 hook, undefined for a frozen ring — skip
    // undefined so we never write the string "undefined" into a hash field.
    if (value === undefined) continue;
    out[key] =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return out;
}

/** True for the keys that were JSON-encoded on write. */
function isJsonField(key: string): key is (typeof JSON_FIELDS)[number] {
  return (JSON_FIELDS as readonly string[]).includes(key);
}

/** Reverse `serializeScalars` into the raw (pre-parse) RingRecord shape. */
function deserializeScalars(raw: Record<string, string>): unknown {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isJsonField(key)) {
      out[key] = JSON.parse(value);
    } else if (key === 'date' || key === 'dominantTheme') {
      out[key] = value; // genuine string scalars
    } else {
      // Numeric scalars (day/posts/comments/…/seed/genomeVersion). A non-numeric
      // string yields NaN and is rejected by RingRecordSchema.parse (V5).
      out[key] = Number(value);
    }
  }
  return out;
}

/**
 * writeRing — freeze one ring. Advances `keys.ringCount(sub)` by 1 (the explicit
 * index — no scan) and hSets the serialized scalars under `keys.ring(sub, n)`.
 * Returns the new ring index `n` (== the advanced ringCount). The caller passes
 * an already-parsed RingRecord (the build boundary lives in the tick).
 */
export async function writeRing(sub: string, ring: RingRecord): Promise<number> {
  const n = await redis.incrBy(keys.ringCount(sub), 1);
  await redis.hSet(keys.ring(sub, n), serializeScalars(ring));
  return n;
}

/**
 * readAllRings — the SINGLE Redis-read boundary. Reads `ringCount`, hGetAll's
 * `ring:1 … ring:count`, and parses each through `RingRecordSchema` (T-03-08 — a
 * malformed hash is rejected, never rendered raw). Returns `[]` when ringCount is
 * 0 / absent. No `redis.keys`/scan — enumeration is the explicit count only.
 */
export async function readAllRings(sub: string): Promise<RingRecord[]> {
  const count = Number((await redis.get(keys.ringCount(sub))) ?? 0) || 0;
  if (count <= 0) return [];

  const raws = await Promise.all(
    Array.from({ length: count }, (_unused, i) =>
      redis.hGetAll(keys.ring(sub, i + 1)),
    ),
  );

  return raws.map((raw) => RingRecordSchema.parse(deserializeScalars(raw)));
}

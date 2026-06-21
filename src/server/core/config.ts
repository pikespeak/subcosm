// config — read the install settings + register an installed community (DEV-06).
//
// Two responsibilities, both server-side:
//   1. readConfig(sub) — the SINGLE settings-read boundary. It reads the three
//      mod-supplied install values via `settings.get` and returns
//      `SettingsSchema.parse({...})` (CLAUDE.md §6: parse at the boundary). Every
//      consumer (the sweeper's tz lookup, onAppInstall's snapshot, /api/organism)
//      goes through this one parse — no value is trusted unparsed. A bogus zone or
//      unknown id throws here (V5), never reaching scheduling or render.
//   2. registerCommunity(sub, cfg) — makes the community enumerable by the hourly
//      sweeper and snapshots its config so the sweeper reads the IANA tz (and the
//      tick reads the genome) WITHOUT re-hitting the settings store every hour.
//
// Devvit Redis has NO set ops (no sAdd/sMembers/sCard in the 0.13.4 client — same
// constraint 03-02/03-03 hit). The installed-community registry is therefore a
// ZSET-as-set: `zAdd(keys.registry(), { member: sub })` is member-keyed and
// idempotent (re-register is a membership no-op), and the sweeper enumerates with
// `zRange(keys.registry(), 0, -1)`. Same set intent, the primitive the SDK ships.
//
// All keys come from the central 03-01 `keys.*` builder (no ad-hoc strings, no
// scan). `sub` is ALWAYS the platform-trusted `context.subredditId` passed by the
// caller (V4) — never client input.
import { redis, settings } from '@devvit/web/server';
import { keys } from './redisKeys';
import { SettingsSchema, type Settings } from '../contracts/settings';

/**
 * readConfig — the single SETTINGS-read boundary parse, for the CURRENT install
 * context. Reads genome/style/timezone via `settings.get` (in parallel) and
 * returns the parsed `Settings`. Throws (rejects at the boundary, V5) when any
 * value is missing/invalid.
 *
 * NB on scope: the Devvit 0.13.4 `settings.get(name)` is scoped to the *current
 * request's* installation/subreddit context — it takes no sub argument and cannot
 * fetch an arbitrary community's settings. So this is called at onAppInstall (the
 * context IS the installing community) to snapshot the config; the hourly sweeper,
 * which runs over MANY subs in one context, must NOT call this per-sub — it reads
 * each community's snapshot from Redis via `readSnapshot(sub)` below. This is the
 * single place install settings are parsed; downstream trusts the inferred type.
 */
export async function readConfig(): Promise<Settings> {
  const [genome, style, timezone] = await Promise.all([
    settings.get('genome'),
    settings.get('style'),
    settings.get('timezone'),
  ]);
  // BOUNDARY parse — a bogus zone / unknown id throws here, never drives the app.
  return SettingsSchema.parse({ genome, style, timezone });
}

/**
 * readSnapshot — read a community's config snapshot from `organism:{sub}:config`
 * (written by registerCommunity at install) and parse it through `SettingsSchema`.
 * This is how the hourly sweeper resolves each enumerated community's IANA tz
 * WITHOUT calling the context-scoped `settings.get`. Returns null when no snapshot
 * exists yet (community registered before a config write, or a malformed hash) so
 * the sweeper can skip it rather than throw. The Redis read is the boundary — the
 * stored hash is untrusted and re-parsed (it could predate a schema change).
 */
export async function readSnapshot(sub: string): Promise<Settings | null> {
  const hash = await redis.hGetAll(keys.config(sub));
  const parsed = SettingsSchema.safeParse(hash);
  return parsed.success ? parsed.data : null;
}

/**
 * registerCommunity — make `sub` enumerable by the hourly sweeper and snapshot its
 * config. `zAdd(registry, { member: sub })` is the idempotent ZSET-as-set membership
 * (the SDK has no sAdd); `hSet(config, {...})` snapshots genome/style/timezone so
 * the sweeper reads the IANA tz (and the tick reads the genome) without re-hitting
 * the settings store. Both keys via `keys.*` (03-01). The ZSET score is a constant
 * payload (1) — it is never read for ranking; membership is the only signal.
 */
export async function registerCommunity(sub: string, cfg: Settings): Promise<void> {
  await Promise.all([
    // ZSET-as-set: member-keyed → idempotent. Score is an inert constant.
    redis.zAdd(keys.registry(), { member: sub, score: 1 }),
    redis.hSet(keys.config(sub), {
      genome: cfg.genome,
      style: cfg.style,
      timezone: cfg.timezone,
    }),
  ]);
}

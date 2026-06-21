// settings — the install-settings boundary contract (DEV-06).
//
// Zod is the single source of truth (CLAUDE.md §1): the `Settings` type is the
// `z.infer` of `SettingsSchema` — NO hand-written interface, NO `as` casts. A mod
// configures three things at install via Devvit settings (genome preset id, style
// id, IANA timezone); the server reads them through `settings.get` and parses the
// triple with `SettingsSchema.parse` (the single read boundary, in core/config.ts)
// before any of it drives render or scheduling. An unknown id or a bogus zone is
// rejected here (V5) — the `validationEndpoint` (routes/settings.ts) surfaces the
// same rejection to the mod at edit time.
//
// i18n (CLAUDE.md §7): every error message is an i18n KEY, never hardcoded
// language text. The host maps the key to the mod's locale.
//
// Determinism / no-drift: the genome ids are the three Phase-1 presets (the same
// registry tick.ts resolves genomeVersion from); the style id is validated against
// the canonical `StyleIdEnum` from the engine contract (one source of truth — a
// new style id added to the contract is automatically accepted, no edit here);
// the timezone is validated by a RUNTIME `Intl.DateTimeFormat` probe, not a
// hand-maintained allow-list that would go stale.
import { z } from 'zod';
import { StyleIdEnum } from '../../engine/contracts/StyleTemplate';

/** The three known genome preset ids (the Phase-1 presets — calm/chaotic/crystalline).
 *  This is the same id set tick.ts resolves `genomeVersion` from; a new preset adds
 *  an entry here (and in the tick PRESETS registry) — never an engine code change. */
export const GENOME_IDS = ['calm', 'chaotic', 'crystalline'] as const;

/**
 * isValidIana — a RUNTIME probe (not an allow-list) for whether `tz` is a valid
 * IANA timezone the host's ICU recognises. `new Intl.DateTimeFormat('en', { timeZone })`
 * throws a `RangeError` for an unknown zone; we treat any throw as invalid. This
 * never goes stale: every zone Node's full-ICU build ships is accepted, bogus ones
 * rejected. Pure — no I/O, no entropy.
 */
export function isValidIana(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    // RangeError ("Invalid time zone specified") for an unknown/malformed zone.
    return false;
  }
}

/**
 * SettingsSchema — the install-config boundary. `genome` ∈ the known preset ids
 * (reject unknown → error.settings.genome.unknown); `style` ∈ the canonical
 * StyleIdEnum (reject unknown → error.settings.style.unknown); `timezone` a valid
 * IANA zone via the runtime probe (reject → error.settings.timezone.invalidIana).
 * `z.infer`-only — the `Settings` type below is derived, never duplicated.
 */
export const SettingsSchema = z.object({
  genome: z.enum(GENOME_IDS, { message: 'error.settings.genome.unknown' }),
  // The canonical style-id contract (StyleIdEnum) is the single source of truth;
  // override only the error message to the i18n key. One style per community.
  style: z.enum(StyleIdEnum.options, { message: 'error.settings.style.unknown' }),
  timezone: z
    .string({ message: 'error.settings.timezone.invalidIana' })
    .refine(isValidIana, { message: 'error.settings.timezone.invalidIana' }),
});

/** The parsed install config — `z.infer` only (no hand interface, CLAUDE.md §1/§9). */
export type Settings = z.infer<typeof SettingsSchema>;

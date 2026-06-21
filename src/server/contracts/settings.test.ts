// settings — unit tests for the install-settings boundary schema (DEV-06).
//
// SettingsSchema is the single boundary the server parses mod-supplied install
// config (genome preset id + style id + IANA timezone) through before any of it
// drives render or scheduling. The tests lock down:
//   - a valid { genome, style, timezone } parses and infers the right type,
//   - an unknown genome/style id is rejected (V5) with its i18n error KEY,
//   - an invalid IANA zone is rejected with error.settings.timezone.invalidIana,
//   - the timezone check is a RUNTIME Intl probe (try/catch), not a stale
//     allow-list — any real IANA zone the host ships is accepted.
// i18n: every error message is an i18n KEY, never hardcoded language (CLAUDE.md §7).
import { describe, expect, test } from 'vitest';
import { SettingsSchema, isValidIana } from './settings';

describe('SettingsSchema — valid install config', () => {
  test('accepts a known genome + style + valid IANA timezone', () => {
    const parsed = SettingsSchema.parse({
      genome: 'calm',
      style: 'techno',
      timezone: 'Europe/Berlin',
    });
    expect(parsed).toEqual({
      genome: 'calm',
      style: 'techno',
      timezone: 'Europe/Berlin',
    });
  });

  test('accepts each known genome preset id', () => {
    for (const genome of ['calm', 'chaotic', 'crystalline'] as const) {
      expect(() =>
        SettingsSchema.parse({ genome, style: 'techno', timezone: 'UTC' })
      ).not.toThrow();
    }
  });

  test('accepts the default UTC timezone', () => {
    expect(() =>
      SettingsSchema.parse({ genome: 'calm', style: 'techno', timezone: 'UTC' })
    ).not.toThrow();
  });
});

describe('SettingsSchema — rejection with i18n error keys (V5)', () => {
  test('rejects an unknown genome id with error.settings.genome.unknown', () => {
    const r = SettingsSchema.safeParse({
      genome: 'sparkly',
      style: 'techno',
      timezone: 'UTC',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain('error.settings.genome.unknown');
    }
  });

  test('rejects an unknown style id with error.settings.style.unknown', () => {
    const r = SettingsSchema.safeParse({
      genome: 'calm',
      style: 'watercolor',
      timezone: 'UTC',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain('error.settings.style.unknown');
    }
  });

  test('rejects an invalid IANA zone with error.settings.timezone.invalidIana', () => {
    const r = SettingsSchema.safeParse({
      genome: 'calm',
      style: 'techno',
      timezone: 'Mars/Olympus',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain('error.settings.timezone.invalidIana');
    }
  });

  test('error messages are i18n KEYS, never hardcoded language', () => {
    const r = SettingsSchema.safeParse({
      genome: 'x',
      style: 'y',
      timezone: 'z',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      for (const issue of r.error.issues) {
        // every message is a dotted i18n key, no spaces / sentence text
        expect(issue.message).toMatch(/^error\.settings\.[a-z.]+$/i);
      }
    }
  });
});

describe('isValidIana — runtime Intl probe, not an allow-list', () => {
  test('accepts real IANA zones the host ships (no stale list)', () => {
    for (const tz of [
      'UTC',
      'Europe/Berlin',
      'America/New_York',
      'Asia/Tokyo',
      'Australia/Sydney',
    ]) {
      expect(isValidIana(tz)).toBe(true);
    }
  });

  test('rejects bogus / malformed zones', () => {
    // NB: ICU accepts a handful of legacy abbreviations as IANA links (PST/EST/GMT),
    // so the probe is correctly permissive there; we assert only genuinely-bogus
    // zones are rejected — that is the boundary the runtime probe must hold.
    for (const tz of ['Mars/Olympus', 'Not/A/Zone', '', 'foo', 'Europe/Atlantis']) {
      expect(isValidIana(tz)).toBe(false);
    }
  });
});

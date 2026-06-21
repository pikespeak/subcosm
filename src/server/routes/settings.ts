// settings (router) — the install-settings validationEndpoint (DEV-06, T-03-09).
//
// A Hono router (mirrors routes/forms.ts) mounted at /internal/settings. Devvit
// calls a field's `validationEndpoint` (declared in devvit.json) when the mod edits
// that setting, POSTing `{ value, isEditing }` and expecting `{ success, error? }`.
// For the IANA `timezone` field we validate the submitted value with the SAME
// runtime `isValidIana` predicate the SettingsSchema boundary uses (one source of
// truth — no re-implementation, no drift) and, on failure, return the i18n error
// KEY `error.settings.timezone.invalidIana` (CLAUDE.md §7 — never hardcoded
// language). genome/style are constrained `select`s in devvit.json, so their
// validation is the SettingsSchema enum at read time; they need no endpoint here.
//
// NOTE: the `settings` name here is the Hono ROUTER, distinct from the `settings`
// capability client from `@devvit/web/server` (used in core/config.ts to read
// values). This module imports no `@devvit/web/server` settings client, so there
// is no name clash — it only validates inbound field values.
import { Hono } from 'hono';
import type {
  SettingsValidationRequest,
  SettingsValidationResponse,
} from '@devvit/web/shared';
import { isValidIana } from '../contracts/settings';

export const settings = new Hono();

// POST /validate-timezone — Devvit field validation for the IANA `timezone` setting.
// Returns the i18n error KEY on a bogus zone (the runtime Intl probe, not an
// allow-list), success otherwise. An empty/undefined value is treated as invalid
// here so the mod is nudged to enter a zone (devvit.json defaults it to "UTC", so
// the saved value is never actually empty).
settings.post('/validate-timezone', async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<string>>();
  if (typeof value === 'string' && isValidIana(value)) {
    return c.json<SettingsValidationResponse>({ success: true }, 200);
  }
  return c.json<SettingsValidationResponse>(
    { success: false, error: 'error.settings.timezone.invalidIana' },
    200
  );
});

// menuActions — contract: the mod-menu action request payload (D-01 / D-08).
//
// Zod is the single source of truth (CLAUDE.md §1): the type is z.infer of the
// schema — no hand-written interface. A moderator clicking "Seed demo history"
// (/backfill) or "Advance day / trigger tick" (/force-tick) POSTs a request to the
// endpoint. That body is an UNTRUSTED boundary crossing into the server, so the
// handler `.parse()`s it before acting (V5 / T-05-07).
//
// SECURITY (RESEARCH Q6 / Security V4): we deliberately trust NO sub/day from this
// payload. The handlers resolve the target community from the platform-trusted
// `context.subredditId` and the day from `frontierDay(subId)` server-side. So the
// schema's only job is to REJECT a malformed (non-object) payload — it strips any
// attacker-supplied envelope fields (e.g. a forged subredditId/day) rather than
// surfacing them, closing T-05-05 (tampering) at the type level. A rejected parse
// lets the handler return a UiResponse toast instead of throwing (mirrors
// scheduler.ts return-discipline). Error messages are i18n keys (CLAUDE.md §7).
import { z } from 'zod';

/**
 * The mod-menu action request body. An object is required (a non-object payload is
 * rejected with `error.menu.payload.invalid`); unknown keys are STRIPPED (zod's
 * default), so no client-supplied field can leak through as trusted input — the
 * parsed result is intentionally empty. The handlers read the sub/day from trusted
 * context, never from here.
 */
export const MenuActionRequestSchema = z.object(
  {},
  { message: 'error.menu.payload.invalid' },
);
export type MenuActionRequest = z.infer<typeof MenuActionRequestSchema>;

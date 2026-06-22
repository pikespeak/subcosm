# Phase 5: Submit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 5-Submit
**Areas discussed:** Demo-Post Seeding, Onboarding/Legibility, Devpost Narrative + Media, Mobile Polish + On-Device UAT, Self-authored Aesthetic, Force-Tick/Demo Control, Splash Card
**Language note:** discussed in German (user preference); artifact written in English (project rule).

---

## Demo-Post Seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill script (mod-menu + 30-day sim) | One-time mod-menu action writes the deterministic 30-day sim arc as historical rings via the same synthesis/ring path (byte-identical) | ✓ |
| Grow organically | Install ~2-3 weeks pre-judging, let real activity + ticks build rings | |
| Beautiful cold-start only | Rely on a nice day-1 + a few growth days, no seeding | |

**User's choice:** Backfill script → triggered by a **mod-menu action**, source = **30-day sim arc** (`beats.ts`) via the real `runTick`/`writeRing` path.
**Notes:** Byte-identical to real ticks; no engine special-casing, no fake user text.

---

## Onboarding / Legibility

| Option | Description | Selected |
|--------|-------------|----------|
| Splash + one-time first-run overlay | Richer splash + dismissible coachmark overlay pointing at the loops | ✓ |
| Persistent HUD labels + "?" affordance | Labeled HUD + always-available legend, no interruption | |
| Rich splash only | Explain everything on the splash card, no in-game overlay | |

**User's choice:** Splash + one-time first-run coachmark overlay (reduced-motion-safe).

---

## Devpost Narrative + Media

| Option | Description | Selected |
|--------|-------------|----------|
| Hook first, tech as proof | Open emotional ("universe grown from your community"), back it with the architecture | ✓ (narrative) |
| Tech/architecture first | Lead with the engineering bet, then the hook | |

| Prize category | | Selected |
|--------|-------------|----------|
| Best App with a Hook ($15k) — primary | The core hook | ✓ |
| Best User Contributions ($3k) | Universe from community activity + nudges | ✓ |
| Best Retention ($3k) | Daily loop + persistent rewards | (not targeted) |
| Best Use of Phaser ($5k) | Phaser as painter; fbm/WebGL shader layer is stretch/unbuilt | (not targeted) |

**User's choice:** Narrative = Hook first, tech as proof. Targets = Best App with a Hook (primary) + Best User Contributions.

---

## Mobile Polish + On-Device UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Perf first (frontier/rAF profiling) | Hit ~60fps on mid-range Android first, then touch/layout | ✓ (priority) |
| Touch/layout first | Touch targets + viewport layout first, then perf | |

| UAT approach | | Selected |
|--------|-------------|----------|
| Fold into the demo-sub session | Backfill seed + triggered tick → validate all on-device items in one pass | ✓ |
| Separate UAT run pre-demo | Dedicated two-device test run, separate from demo setup | |

**User's choice:** Perf first; deferred Phase-4 UAT folded into the demo-sub session.

---

## Self-authored Aesthetic (SUB-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Sharpen the bespoke Techno signature | Genesis-core cross-flare/logo, curated cyan↔magenta palette, wide-sans typo, brand mark | ✓ |
| Movement/composition as signature | Emphasize data-driven ignite pulse + shell composition as the differentiator | |

**User's choice:** Sharpen the bespoke Techno signature; Devvit-compliance = check.

---

## Force-Tick / Demo Control

| Option | Description | Selected |
|--------|-------------|----------|
| Mod-menu action, keep | "Advance day / trigger tick" mod-only action, kept as a real feature | ✓ |
| Mod-menu action, remove before publish | Temporary demo/test tool only | |

**User's choice:** Mod-menu action, kept (mod-gated, real feature — not debug scaffold).

---

## Splash Card (In-Feed Preview)

| Option | Description | Selected |
|--------|-------------|----------|
| Pitch + static teaser visual + CTA | One-line hook + teaser image + clear open/play CTA | ✓ |
| Live mini-render of the universe | Card shows a real static-frame render of the current cosmos | |

**User's choice:** Pitch line + static teaser visual + clear CTA.

---

## Claude's Discretion

- Backfill length (30 days vs shorter); exact coachmark copy/sequence; splash teaser image source; plan-wave ordering.

## Deferred Ideas

- Best Use of Phaser (fbm/WebGL shader layer); Best Retention category + guess loop/streaks; connected multiverse; monetization (Devvit Payments); Mode B theme extraction; Comic/Pixel StyleTemplates.

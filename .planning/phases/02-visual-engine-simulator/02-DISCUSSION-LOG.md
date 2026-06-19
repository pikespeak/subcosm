# Phase 2: Visual Engine + Simulator — Discussion Log

**Date:** 2026-06-19
**Mode:** discuss (default, batched)

> Human-reference record of the discuss-phase session. Not consumed by downstream agents — CONTEXT.md is the canonical output.

## Areas selected for discussion
All four offered gray areas: Navigation, Readout, Simulator scenario, Aesthetic direction.

## Q1 — Navigation & time-travel feel (CAM-02)
**Options:** Slider-scrubber only (recommended) · Drag-to-fly in canvas · Both slider + pinch/scroll-zoom
**Chosen:** **Both** — slider for time + pinch/scroll for zoom + click-to-focus a shell.
**Note:** User wants full control over both time and zoom level, beyond the slider-only recommendation. Adds some build surface; accepted.

## Q2 — Readout & goal legibility (CAM-03 + GAME-01)
**Options:** Fixed HUD panel (recommended) · On-focus label on the shell · Fixed sidebar
**Chosen:** **Fixed always-visible HUD panel**, updates with the scrubbed/focused shell; frontier day additionally shows the day's goal.
**Note:** Aligns with the legibility hard rule ("never removed").

## Q3 — Simulator scenario / story arc (SIM-01)
**Options:** Scripted ~30-day story scenario (recommended) · Pure seed-driven/random · Few curated days (~10)
**Chosen:** **Scripted ~30-day story scenario** with beats (cold-start → growth → drama spike ~day 12 → AMA ~day 20 → quiet); seed dices within the beats.
**Note:** Guarantees every demo reads as a good story for judges; regenerate still varies it.

## Q4 — Aesthetic direction + Crystalline palette (PNT-01)
**Options:** Mock-parity, subtly elevated (recommended) · Strict 1:1 mock · Elevate further
**Chosen:** **Mock-parity, subtly elevated** via real WebGL additive-blend glow; Crystalline = cool/faceted/ice-blue-white, high-symmetry, angular stars.
**Note:** Balances "visual parity" + "not AI-slop" + Best-of-Phaser, without risking legibility. fbm/shader pass stays Stretch.

## Wrap-up
User selected **"Ready for CONTEXT.md"** — left to Claude's discretion: nudge controls/strength (STR), dev-page control-harness layout (QA-01), reduced-motion static look (PNT-04), all Phaser perf mechanics (PNT-03).

## Deferred ideas (captured, not in Phase 2)
fbm/shader pass · Comic/Pixel styles · full weight-matrix + rare-event table + presets-UI · Mode B theme extraction · Devvit wiring/live frontier/reveal/scoring (Phases 3–4) · connected multiverse outer zoom (post-MVP, keep camera embeddable).

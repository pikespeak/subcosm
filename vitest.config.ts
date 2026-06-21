import { defineConfig } from 'vitest/config';

// Standalone pure-module test runner. Deliberately does NOT load the Devvit
// Vite plugin (vite.config.ts) — the pure engine/styles/sim test run must not
// pull in Devvit. Covers the Phaser-free cores: engine, styles, sim, plus the
// PURE client cosmos helpers (cosmos/ignite.ts — a no-Phaser/no-DOM/no-rng math
// module whose no-strobe bound must be unit-tested, VIS-ANIM D-04). Only
// Phaser-free client modules belong here; Phaser-bearing client code is not a
// target of this runner.
//
// Server: the PURE server modules belong here — the central Redis key-builder
// and the Zod trigger contracts (no Devvit import), plus the pure D-02
// conflict-composite. The Redis-accumulation modules (counters / frontierDay)
// import `@devvit/web/server` but their tests `vi.mock` that module to an
// in-memory fake, so NO real Devvit runtime is loaded by this runner — the
// "Phaser-free / no real Devvit" invariant holds (the mock replaces the import
// before it resolves). Devvit-bearing route handlers themselves are still NOT a
// target of this runner.
export default defineConfig({
  test: {
    include: [
      'src/engine/**/*.test.ts',
      'src/styles/**/*.test.ts',
      'src/sim/**/*.test.ts',
      'src/client/cosmos/ignite.test.ts',
      'src/server/core/redisKeys.test.ts',
      'src/server/contracts/triggers.test.ts',
      'src/server/core/conflict.test.ts',
      'src/server/core/counters.test.ts',
      'src/server/core/frontierDay.test.ts',
    ],
    environment: 'node',
    passWithNoTests: true,
  },
});

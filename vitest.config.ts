import { defineConfig } from 'vitest/config';

// Standalone pure-module test runner. Deliberately does NOT load the Devvit
// Vite plugin (vite.config.ts) — the pure engine/styles/sim test run must not
// pull in Devvit. Covers the Phaser-free cores: engine, styles, sim, plus the
// PURE client cosmos helpers (cosmos/ignite.ts — a no-Phaser/no-DOM/no-rng math
// module whose no-strobe bound must be unit-tested, VIS-ANIM D-04). Only
// Phaser-free client modules belong here; Phaser-bearing client code is not a
// target of this runner.
//
// Server: only the PURE server modules belong here — the central Redis
// key-builder (no Devvit import) and the Zod trigger contracts (pure schemas).
// Devvit-bearing server route handlers are NOT a target of this runner.
export default defineConfig({
  test: {
    include: [
      'src/engine/**/*.test.ts',
      'src/styles/**/*.test.ts',
      'src/sim/**/*.test.ts',
      'src/client/cosmos/ignite.test.ts',
      'src/server/core/redisKeys.test.ts',
      'src/server/contracts/triggers.test.ts',
    ],
    environment: 'node',
    passWithNoTests: true,
  },
});

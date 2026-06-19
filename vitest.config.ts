import { defineConfig } from 'vitest/config';

// Standalone pure-module test runner. Deliberately does NOT load the Devvit
// Vite plugin (vite.config.ts) — the pure engine/styles/sim test run must not
// pull in Devvit. Covers the Phaser-free cores: engine, styles, sim.
export default defineConfig({
  test: {
    include: [
      'src/engine/**/*.test.ts',
      'src/styles/**/*.test.ts',
      'src/sim/**/*.test.ts',
    ],
    environment: 'node',
    passWithNoTests: true,
  },
});

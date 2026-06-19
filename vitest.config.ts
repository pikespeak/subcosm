import { defineConfig } from 'vitest/config';

// Standalone engine test runner. Deliberately does NOT load the Devvit Vite
// plugin (vite.config.ts) — the pure engine test run must not pull in Devvit.
export default defineConfig({
  test: {
    include: ['src/engine/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});

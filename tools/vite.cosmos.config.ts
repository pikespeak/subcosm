// Plain-vite config for the standalone Cosmos dev page (Pitfall 1).
//
// This config is DELIBERATELY free of the `@devvit/start/vite` plugin: the dev
// harness (`src/client/cosmos-dev/cosmos-dev.html`) must boot a Phaser WebGL
// canvas in a normal browser tab WITHOUT entering the shipped Devvit bundle.
// The Devvit build (`vite build` → `vite.config.ts`) only consumes the entries
// declared in `devvit.json` (splash.html + game.html), so `cosmos-dev.html` is
// never picked up there. Run this page with `npm run cosmos`.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root: `${repoRoot}src/client/cosmos-dev`,
  // Resolve `src/...` imports from the dev page back to the repo source tree.
  resolve: {
    alias: {
      '/src': `${repoRoot}src`,
    },
  },
  server: {
    port: 5180,
    open: '/cosmos-dev.html',
  },
});

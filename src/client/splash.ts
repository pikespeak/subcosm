// splash — the Subcosm in-feed card (D-09).
//
// The post's default inline entrypoint (devvit.json post.entrypoints.default =
// splash.html). It is a fast, RELIABLE static teaser: a one-line pitch hook, a
// static SVG cosmos motif (markup in splash.html), and a single open/play CTA
// that expands into the full game. There is deliberately NO live render here
// (D-09 / RESEARCH Q4 Pitfall 6): a heavy inline render is the first thing judges
// see, and iOS throttles cross-origin-iframe rAF to 30fps until the user
// interacts — so the splash must read perfectly while completely static.
//
// All user-facing copy lives behind data-i18n keys in splash.html (English source
// is the visible fallback); this module injects NO language text and echoes NO
// user-authored content (CLAUDE.md §7 / T-05-09). Its only job is wiring the CTA
// to the existing requestExpandedMode(e, 'game') expand action.
import { requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button') as HTMLButtonElement;

// Open/play: expand the inline card into the game webroot (game.html). This is
// the existing, supported expand seam — kept verbatim from the starter so the
// in-feed → game transition stays on the blessed path.
startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

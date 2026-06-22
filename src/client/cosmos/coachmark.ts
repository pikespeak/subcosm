// coachmark — the one-time first-run onboarding overlay (D-02 / SUB-04).
//
// A brand-new visitor's highest-value moment: the first time they open the game,
// a single dismissible overlay explains BOTH loops without leaving the post —
// depth = time (genesis core → day-shells → live frontier), the goal line, the
// nudge/steer control, and the overnight freeze+reveal. It is shown EXACTLY once
// per client: a persisted 'seen' flag gates it, so every subsequent open no-ops
// (D-02 prohibition: never reappear after dismissal).
//
// The reveal is motion-gated (PNT-04 / D-02): under prefers-reduced-motion the
// overlay still shows its full content but with NO animated reveal/strobe — a
// single static frame. The gate reuses the existing reduced-motion.ts detection,
// and is also surfaced as a `.coachmark--reduced` class on the root so the CSS
// keyframe is disabled (the JS gate and the stylesheet agree).
//
// SECURITY (T-02-11 / T-05-09): this module injects NO language text. All copy
// lives behind data-i18n keys in game.html (English source is the visible
// fallback); here we only toggle the [hidden] attribute and a motion class, and
// wire the dismiss button. No raw-HTML sink, no echoed user content.
//
// TESTABILITY: the persisted store, the reduced-motion check, and the root
// element are injectable (a tiny seam) so the show-once gate and the reduced-
// motion branch are unit-testable in a pure Node runner WITHOUT a DOM — the
// production call uses the real localStorage / prefersReducedMotion / document.
import { prefersReducedMotion } from './reduced-motion';

/** The localStorage key persisting that this client has seen the coachmark. */
export const COACHMARK_SEEN_KEY = 'subcosm.coachmark.seen';

/** The persisted-flag store seam (localStorage shape; SSR/test-injectable). */
export interface SeenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The overlay root seam — the minimal surface coachmark drives (DOM-injectable). */
export interface CoachmarkRoot {
  /** Reveal/hide the overlay (maps to the [hidden] attribute on the real node). */
  setHidden(hidden: boolean): void;
  /** Toggle the reduced-motion class so the CSS reveal keyframe is disabled. */
  setReducedMotion(reduced: boolean): void;
  /** Register the one-shot dismiss handler (the dismiss button click). */
  onDismiss(handler: () => void): void;
}

/** Injectable dependencies (all default to the real webview environment). */
export interface CoachmarkDeps {
  store: SeenStore;
  reducedMotion: () => boolean;
  root: CoachmarkRoot | null;
}

/** Truthy persisted value written when the coachmark is dismissed. */
const SEEN_VALUE = '1';

/**
 * hasSeenCoachmark — true once the client has dismissed the coachmark. A storage
 * read failure (private mode / disabled storage) is treated as "not seen" so the
 * overlay still shows rather than throwing (graceful: the worst case is it shows
 * again, never a crash — T-05-10 accepts tampering/loss of the flag).
 */
export function hasSeenCoachmark(store: SeenStore): boolean {
  try {
    return store.getItem(COACHMARK_SEEN_KEY) === SEEN_VALUE;
  } catch {
    return false;
  }
}

/**
 * markCoachmarkSeen — persist the 'seen' flag so subsequent opens no-op. A write
 * failure is swallowed (private mode): the overlay was already dismissed for this
 * session; the only cost of a failed persist is it may show once more later.
 */
export function markCoachmarkSeen(store: SeenStore): void {
  try {
    store.setItem(COACHMARK_SEEN_KEY, SEEN_VALUE);
  } catch {
    // No-op: persistence is best-effort (T-05-10 — losing the flag only re-shows).
  }
}

/** Resolve the real localStorage as a SeenStore, or null when unavailable. */
function defaultStore(): SeenStore | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Accessing localStorage can throw under strict privacy settings.
    return null;
  }
}

/**
 * Resolve the real coachmark DOM node into a CoachmarkRoot, or null when the
 * markup / document is absent (e.g. a non-DOM runner). Wires the [hidden]
 * attribute, the `.coachmark--reduced` class, and the dismiss button — the only
 * DOM this module touches.
 */
function defaultRoot(): CoachmarkRoot | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('coachmark');
  if (!el) return null;
  return {
    setHidden: (hidden: boolean): void => {
      el.hidden = hidden;
    },
    setReducedMotion: (reduced: boolean): void => {
      el.classList.toggle('coachmark--reduced', reduced);
    },
    onDismiss: (handler: () => void): void => {
      const btn = document.getElementById('coachmark-dismiss');
      btn?.addEventListener('click', handler, { once: true });
    },
  };
}

/**
 * showCoachmarkOnce — show the first-run coachmark exactly once.
 *
 * No-ops (returns false) when the persisted 'seen' flag is already set OR when no
 * overlay root is available. Otherwise it reveals the overlay, applies the
 * reduced-motion gate (static appearance under prefers-reduced-motion), and wires
 * the dismiss control to hide the overlay AND persist 'seen' so a re-open never
 * shows it again. Returns true when it showed the overlay.
 *
 * Dependencies are injectable for testing; in production it binds the real
 * localStorage, prefersReducedMotion(), and the #coachmark DOM node. Called from
 * game.ts after the first successful universe mount (so it overlays a populated
 * cosmos, never the loading/error state).
 */
export function showCoachmarkOnce(deps: Partial<CoachmarkDeps> = {}): boolean {
  const store = deps.store ?? defaultStore();
  // No store at all → cannot gate show-once reliably; treat as already-seen to
  // avoid showing on every open (fail safe: do not nag).
  if (!store) return false;

  const root = deps.root ?? defaultRoot();
  if (!root) return false;

  // Show-once gate: if the flag is already set, never show again (D-02).
  if (hasSeenCoachmark(store)) return false;

  const reducedMotion = deps.reducedMotion ?? prefersReducedMotion;
  const reduced = reducedMotion();

  // Reduced-motion gate FIRST so the panel never flashes its reveal animation
  // before the class lands (PNT-04 — static, no strobe).
  root.setReducedMotion(reduced);
  root.setHidden(false);

  // Dismiss: hide + persist 'seen' so a re-open no-ops (one-shot).
  root.onDismiss(() => {
    root.setHidden(true);
    markCoachmarkSeen(store);
  });

  return true;
}

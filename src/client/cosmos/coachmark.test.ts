// coachmark.test — the show-once gate + the reduced-motion gate, proven without
// a DOM (D-02 / SUB-04).
//
// showCoachmarkOnce's two contracts are pure logic over injectable seams: a
// persisted 'seen' flag (the show-once gate) and a reduced-motion predicate (the
// no-strobe gate). We drive both with in-memory fakes — a Map-backed SeenStore
// and a recording CoachmarkRoot — so the gates are asserted in the Phaser-free /
// no-DOM Node runner (same discipline as ignite.test.ts), no jsdom dependency.
import { beforeEach, describe, expect, test } from 'vitest';
import {
  COACHMARK_SEEN_KEY,
  showCoachmarkOnce,
  type CoachmarkRoot,
  type SeenStore,
} from './coachmark';

/** A Map-backed localStorage-shaped store (the persisted 'seen' flag seam). */
function makeStore(initial?: Record<string, string>): SeenStore {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

/** A recording overlay root — captures every drive the module makes. */
interface FakeRoot extends CoachmarkRoot {
  hidden: boolean | null;
  reduced: boolean | null;
  dismiss: (() => void) | null;
  /** Simulate the user tapping the dismiss control. */
  fireDismiss(): void;
}

function makeRoot(): FakeRoot {
  const r: FakeRoot = {
    hidden: null,
    reduced: null,
    dismiss: null,
    setHidden(hidden) {
      this.hidden = hidden;
    },
    setReducedMotion(reduced) {
      this.reduced = reduced;
    },
    onDismiss(handler) {
      this.dismiss = handler;
    },
    fireDismiss() {
      this.dismiss?.();
    },
  };
  return r;
}

describe('showCoachmarkOnce — show-once gate (D-02)', () => {
  let store: SeenStore;
  let root: FakeRoot;

  beforeEach(() => {
    store = makeStore();
    root = makeRoot();
  });

  test('shows the overlay on a fresh client (no seen flag)', () => {
    const shown = showCoachmarkOnce({ store, root, reducedMotion: () => false });

    expect(shown).toBe(true);
    expect(root.hidden).toBe(false); // revealed
  });

  test('persists the seen flag when the overlay is dismissed', () => {
    showCoachmarkOnce({ store, root, reducedMotion: () => false });
    expect(store.getItem(COACHMARK_SEEN_KEY)).toBeNull(); // not yet — only on dismiss

    root.fireDismiss();

    expect(root.hidden).toBe(true); // hidden on dismiss
    expect(store.getItem(COACHMARK_SEEN_KEY)).toBe('1'); // persisted
  });

  test('a second call (re-open) does NOT show the overlay once seen', () => {
    // First open + dismiss → flag persists in the SAME store.
    showCoachmarkOnce({ store, root, reducedMotion: () => false });
    root.fireDismiss();

    // Simulate a re-open with a fresh root but the SAME persisted store.
    const reopenRoot = makeRoot();
    const shownAgain = showCoachmarkOnce({
      store,
      root: reopenRoot,
      reducedMotion: () => false,
    });

    expect(shownAgain).toBe(false); // no-op on re-open
    expect(reopenRoot.hidden).toBeNull(); // never even touched the overlay
  });

  test('does NOT show when the seen flag is already present', () => {
    const seenStore = makeStore({ [COACHMARK_SEEN_KEY]: '1' });

    const shown = showCoachmarkOnce({ store: seenStore, root, reducedMotion: () => false });

    expect(shown).toBe(false);
    expect(root.hidden).toBeNull();
  });

  test('no-ops safely when no overlay root is present', () => {
    const shown = showCoachmarkOnce({ store, root: null, reducedMotion: () => false });
    expect(shown).toBe(false);
  });
});

describe('showCoachmarkOnce — reduced-motion gate (PNT-04 / D-02)', () => {
  test('applies the reduced-motion flag when prefers-reduced-motion is set', () => {
    const root = makeRoot();

    const shown = showCoachmarkOnce({
      store: makeStore(),
      root,
      reducedMotion: () => true,
    });

    expect(shown).toBe(true);
    expect(root.hidden).toBe(false); // content still shows…
    expect(root.reduced).toBe(true); // …but statically (no animated reveal)
  });

  test('does NOT apply the reduced-motion flag when motion is allowed', () => {
    const root = makeRoot();

    showCoachmarkOnce({ store: makeStore(), root, reducedMotion: () => false });

    expect(root.reduced).toBe(false); // animated reveal allowed
  });
});

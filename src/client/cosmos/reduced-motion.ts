// reduced-motion — honor prefers-reduced-motion across the WHOLE surface (PNT-04).
//
// Hard rule (UI-SPEC Motion, subcosm-spec "respect prefers-reduced-motion"):
// under reduced motion the entire cosmos presents a SINGLE static, non-strobe
// frame — no pulsing ignite, no star twinkle, no rotation. The mock encodes this
// as `reduce` (matchMedia at l.112) collapsing every animated term to its rest
// value (l.163/186/250/257). Here it is a tiny, framework-free helper the
// CosmosScene consults on boot and on media-query change.
//
// This is paint-side accessibility, not a look constant — but it cooperates with
// data: CosmosScene only animates when BOTH the user allows motion AND the
// StyleTemplate says `motion.frontierOnly`. So a style can also opt out of motion
// via data (motion.frontierOnly = false ⇒ fully static), and reduced-motion is
// the user-preference override on top.

/** The media query string for the OS "reduce motion" accessibility preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user has requested reduced motion (SSR-safe: false if no matchMedia). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Subscribe to changes in the prefers-reduced-motion preference. Invokes
 * `onChange(reduced)` whenever the OS setting flips, so the canvas can switch
 * between an animated frontier and a single static frame WITHOUT a reload.
 * Returns an unsubscribe function (no-op when matchMedia is unavailable).
 */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  const handler = (event: MediaQueryListEvent): void => onChange(event.matches);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

// primitives — reusable Phaser glow primitives (PNT-03 perf foundation).
//
// The mock paints every star/nebula/core with a fresh per-frame
// `createRadialGradient` under globalCompositeOperation='lighter'
// (docs/subcosm-universe-mock.html l.219/239/258). That is far too expensive at
// 60fps on mobile. Instead we bake ONE soft radial-glow texture at boot and draw
// every glow as a tinted + scaled ADDITIVE Image — the additive blend reproduces
// 'lighter', the tint maps Element.hue through the StyleTemplate ramp, the scale
// reproduces the per-element radius. Zero per-frame gradient allocation.
//
// The glow texture uses a true radial-gradient CanvasTexture (Pitfall 4 /
// Assumption A3) so the falloff is genuinely soft — Graphics.fillCircle gives a
// hard edge, which reads as a flat disc once tinted additively.
import * as Phaser from 'phaser';

/** Texture key for the single reused soft radial-glow sprite. */
export const GLOW_TEXTURE_KEY = 'cosmos-glow';

/** Diameter (px) of the baked glow texture. Larger = softer when scaled down. */
const GLOW_TEX_SIZE = 128;

/**
 * Ensure the reused soft radial-glow texture exists in this scene's texture
 * manager. Idempotent — safe to call from every Scene.create(). Draws a white
 * radial gradient (opaque center → transparent edge) into a CanvasTexture so
 * tinting (`setTint`) recolors it per the palette.
 */
export function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GLOW_TEXTURE_KEY)) return;

  const tex = scene.textures.createCanvas(GLOW_TEXTURE_KEY, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
  if (!tex) return;

  const ctx = tex.getContext();
  const c = GLOW_TEX_SIZE / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  // Soft falloff — mirrors the mock's star glow stops (l.240-241): bright core
  // fading to fully transparent. White so setTint can map it to any palette hue.
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
  tex.refresh();
}

/**
 * Add one additive glow Image — the single draw primitive for stars, nebulae,
 * and the genesis core. `radius` is the on-screen glow radius (px); `color` is
 * the resolved palette color (paint maps Element.hue → ramp → color, never the
 * reverse — ENG-02). `alpha` caps the per-glow energy (StyleTemplate.fill.alpha).
 *
 * Additive blend == the mock's globalCompositeOperation='lighter' (l.195).
 */
export function addGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, GLOW_TEXTURE_KEY);
  img.setBlendMode(Phaser.BlendModes.ADD);
  img.setTint(color);
  img.setAlpha(alpha);
  // Texture is GLOW_TEX_SIZE wide; scale so the visible glow ≈ 2*radius.
  img.setDisplaySize(radius * 2, radius * 2);
  return img;
}

/**
 * Add one additive light BEAM — a long, thin, soft-falloff streak built from the
 * reused glow texture (the genesis-core cross-flare spike, D-07). Where addGlow is
 * a square radial blob, a beam stretches the SAME soft texture into an anisotropic
 * streak (`length` along its axis, `thickness` across) and rotates it to `angle`,
 * so a deterministic cross/star flare is just four+ rotated beams. Additive, so it
 * reads as light over the core. `color` is resolved from the StyleTemplate ramp by
 * the caller (paint maps the core stop → color, never a hard-coded literal — PNT-02).
 *
 * @param scene     the owning scene.
 * @param x         center x (px) — the core center the flare radiates from.
 * @param y         center y (px).
 * @param length    full length of the beam along its axis (px).
 * @param thickness cross-axis thickness of the beam (px).
 * @param angle     beam rotation in radians (0 = horizontal).
 * @param color     resolved palette color (caller maps via the ramp — ENG-02/PNT-02).
 * @param alpha     additive energy of the beam.
 */
export function addBeam(
  scene: Phaser.Scene,
  x: number,
  y: number,
  length: number,
  thickness: number,
  angle: number,
  color: number,
  alpha: number,
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, GLOW_TEXTURE_KEY);
  img.setBlendMode(Phaser.BlendModes.ADD);
  img.setTint(color);
  img.setAlpha(alpha);
  img.setDisplaySize(length, thickness);
  img.setRotation(angle);
  return img;
}

/**
 * Add one faceted/angular star — the Crystalline 'facet' primitive (D-05).
 *
 * Where the default star is a soft round glow dot, Crystalline communities read
 * as an ordered, many-armed lattice (genome symmetry 5). This draws a sharp
 * `points`-pointed star polygon (additive, so it still reads as light) — the
 * angular silhouette is what distinguishes Crystalline at a glance from the
 * round Calm/Chaotic Techno stars. Still ONE draw call per star; the painter
 * selects it via `style.genes` (paint-only — no synthesis change, ENG-02).
 *
 * @param scene  the owning scene.
 * @param x      center x (px).
 * @param y      center y (px).
 * @param radius outer radius of the facet star (px).
 * @param color  resolved palette color (paint maps Element.hue → ramp → color).
 * @param alpha  per-element energy cap (StyleTemplate.fill.alpha).
 * @param points number of facet arms (the genome's symmetry — angular spikes).
 */
export function addFacetStar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
  points: number,
): Phaser.GameObjects.Star {
  // Phaser's Star takes (x, y, points, innerRadius, outerRadius). A tight inner
  // radius (~38% of outer) gives the crisp faceted spikes that read as "crystal".
  const star = scene.add.star(x, y, Math.max(3, Math.round(points)), radius * 0.38, radius, color, alpha);
  star.setBlendMode(Phaser.BlendModes.ADD);
  return star;
}

// paint — the full mock-parity draw: a Scene + StyleTemplate → Phaser objects.
//
// This is the PNT-01 paint layer. It translates the mock's behaviour
// (docs/subcosm-universe-mock.html frame() l.184-272) into Phaser 4.2 using ONLY
// the mapping table (02-03-PLAN <mock_mapping>): the mock's per-frame
// `createRadialGradient` + globalCompositeOperation='lighter' become ONE reused
// additive glow texture (primitives.ts); the 90 bg stars + frozen shells bake
// once (bake.ts); only the live frontier re-renders per frame (PNT-03).
//
// Contract discipline (ENG-02 / PNT-02):
//   - paint reads geometry from the engine `Scene` (hue is a 0..1 hint) and EVERY
//     look constant from the `StyleTemplate` — palette ramp, fill alpha, line,
//     motion, and the per-gene primitive ref. NOTHING is hard-coded here that the
//     style owns. paint maps Element.hue → ramp → color, never the reverse.
//   - paint NEVER imports raw day data or a behaviour preset (the synthesis→paint
//     seam): it reads only the Scene + StyleTemplate. The painter selects the
//     faceted vs round star primitive via `style.genes` (Crystalline = facet) —
//     paint-only, zero synthesis change.
import * as Phaser from 'phaser';
import type { Scene as CosmosSceneData, Shell, StyleTemplate } from '../../engine/contracts';
import { addFacetStar, addGlow, ensureGlowTexture } from './primitives';
import { bakeShell } from './bake';

/** Texture key for the full-screen vignette (drawn last, NORMAL blend). */
const VIGNETTE_TEXTURE_KEY = 'cosmos-vignette';

/** Background space color (UI-SPEC dominant: near-black space stage). */
export const SPACE_BG = 0x04030a;

/**
 * Geometry of the current viewport — the px frame paint lays the universe into.
 * `rMax` is the outer radius the normalized shell radii (0..1) map onto; `band`
 * is the radial jitter band a shell's stars spread within (mock l.178-180).
 */
export interface PaintFrame {
  width: number;
  height: number;
  cx: number;
  cy: number;
  rMax: number;
  band: number;
}

/** A single drawn star — round glow (Techno) or faceted polygon (Crystalline). */
export type StarObject = Phaser.GameObjects.Image | Phaser.GameObjects.Star;

/** Handles paint hands back so CosmosScene can animate ONLY the frontier (PNT-03). */
export interface PaintResult {
  /** The Graphics layer the pulsing frontier ignite ring is redrawn into per frame. */
  igniteGraphics: Phaser.GameObjects.Graphics;
  /** The live frontier star objects (re-alpha'd per frame for twinkle). */
  frontierStars: StarObject[];
  /** The frontier shell radius (px) for the ignite ring + star layout. */
  frontierRadius: number;
  /** The frontier shell (null if the scene has no shells). */
  frontier: Shell | null;
}

/** Compute the viewport frame the universe is laid into (mock l.177-180). */
export function computeFrame(width: number, height: number): PaintFrame {
  const minD = Math.min(width, height);
  const rMax = minD * 0.46;
  return { width, height, cx: width / 2, cy: height / 2, rMax, band: rMax * 0.075 };
}

/** Build the palette ramp (hex → int) once from the StyleTemplate (PNT-02). */
export function buildRamp(style: StyleTemplate): number[] {
  return style.palette.ramp.map((hex) => Phaser.Display.Color.HexStringToColor(hex).color);
}

/** Resolve a 0..1 hue hint to a palette color by interpolating the ramp (ENG-02). */
export function hueToColor(ramp: number[], hue: number): number {
  if (ramp.length === 0) return 0xffffff;
  if (ramp.length === 1) return ramp[0]!;
  const clamped = Math.min(0.999999, Math.max(0, hue));
  const scaled = clamped * (ramp.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = Phaser.Display.Color.IntegerToColor(ramp[i]!);
  const b = Phaser.Display.Color.IntegerToColor(ramp[i + 1]!);
  const r = Math.round(Phaser.Math.Linear(a.red, b.red, t));
  const g = Math.round(Phaser.Math.Linear(a.green, b.green, t));
  const bl = Math.round(Phaser.Math.Linear(a.blue, b.blue, t));
  return Phaser.Display.Color.GetColor(r, g, bl);
}

/** The warm-white core stop (last ramp entry, or white). */
function coreStop(ramp: number[]): number {
  return ramp.length > 0 ? ramp[ramp.length - 1]! : 0xffffff;
}

/**
 * Ensure the full-screen vignette texture exists: transparent center → dark edge
 * (mock l.267-269). Drawn LAST with NORMAL blend so it darkens the corners
 * regardless of the additive light beneath (keeps the cosmos legible — D-02).
 */
function ensureVignette(scene: Phaser.Scene, width: number, height: number): void {
  if (scene.textures.exists(VIGNETTE_TEXTURE_KEY)) scene.textures.remove(VIGNETTE_TEXTURE_KEY);
  const tex = scene.textures.createCanvas(VIGNETTE_TEXTURE_KEY, width, height);
  if (!tex) return;
  const ctx = tex.getContext();
  const cx = width / 2;
  const cy = height / 2;
  const minD = Math.min(width, height);
  const grad = ctx.createRadialGradient(cx, cy, minD * 0.34, cx, cy, minD * 0.8);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  tex.refresh();
}

/** Does this style draw faceted stars (Crystalline) rather than round glows? */
function usesFacet(style: StyleTemplate): boolean {
  const ref = style.genes['star'] ?? style.genes['facet'];
  return typeof ref === 'string' && ref.includes('facet');
}

/**
 * Draw one shell's nebula clouds + stars into the scene at radius `shellR` (px),
 * returning the created objects. Used for BOTH frozen shells (then baked) and the
 * live frontier (kept individual for per-frame twinkle). `facetArms` is the
 * Crystalline symmetry hint for the faceted primitive.
 */
function drawShell(
  scene: Phaser.Scene,
  shell: Shell,
  shellR: number,
  frame: PaintFrame,
  ramp: number[],
  style: StyleTemplate,
  facet: boolean,
): StarObject[] {
  const objects: StarObject[] = [];
  const { cx, cy, rMax, band } = frame;
  const fillAlpha = style.fill.alpha;

  // --- per-shell nebula clouds (mock l.213-223) ---
  // Density derived from geometry (element count), NOT raw activity — paint stays
  // on the Scene contract. More elements ⇒ more, brighter nebula.
  const dens = Math.min(1, shell.elements.length / 60);
  const nClouds = Math.round(2 + dens * 4);
  for (let c = 0; c < nClouds; c++) {
    const ca = (c / nClouds) * Math.PI * 2 + shell.day;
    const nx = cx + Math.cos(ca) * shellR;
    const ny = cy + Math.sin(ca) * shellR;
    const cr = band * 2.4 + shellR * 0.05;
    // Nebula hue: the mean element hue of this shell, mapped through the ramp.
    const hue = shell.elements.length
      ? shell.elements.reduce((s, e) => s + e.hue, 0) / shell.elements.length
      : 0.5;
    objects.push(addGlow(scene, nx, ny, cr, hueToColor(ramp, hue), fillAlpha * 0.22 * (0.5 + dens)));
  }

  // --- stars (mock l.228-246): small dot + big glow ---
  for (const el of shell.elements) {
    const rr = shellR + el.r * band;
    const x = cx + Math.cos(el.angle) * rr;
    const y = cy + Math.sin(el.angle) * rr;
    const color = hueToColor(ramp, el.hue);
    const sz = Math.max(2, el.size * rMax * 0.06) * (el.big ? 1.6 : 1);
    const energyAlpha = fillAlpha * (0.6 + el.energy * 0.4);

    if (el.big) {
      // Big star: soft additive glow halo first (mock l.238-242).
      objects.push(addGlow(scene, x, y, sz * 2.4, color, energyAlpha));
    }
    if (facet) {
      // Crystalline: a faceted/angular star-polygon (D-05). Arm count = the
      // genome symmetry hint surfaced as element conflict-ordered spikes; a fixed
      // crisp 5/6-point silhouette reads unmistakably "crystal".
      const points = el.big ? 6 : 5;
      objects.push(
        addFacetStar(scene, x, y, sz * (el.big ? 1.4 : 1), color, Math.min(1, energyAlpha + 0.25), points),
      );
    } else {
      // Techno: a tiny bright additive dot (the round star core).
      objects.push(addGlow(scene, x, y, sz * (el.big ? 1.7 : 1), color, Math.min(1, energyAlpha + 0.3)));
    }
  }

  return objects;
}

/** Draw the genesis core (mock l.255-263): big warm glow + bright dot (always live, cheap). */
function drawCore(
  scene: Phaser.Scene,
  cosmos: CosmosSceneData,
  frame: PaintFrame,
  ramp: number[],
): void {
  const { cx, cy, rMax } = frame;
  const core = cosmos.core;
  const warm = coreStop(ramp);
  const coreGlowR = Math.max(40, core.radius * rMax * 6);
  addGlow(scene, cx, cy, coreGlowR, warm, 0.9);
  addGlow(scene, cx, cy, coreGlowR * 0.45, hueToColor(ramp, core.hue), 0.7 + core.energy * 0.2);
  addGlow(scene, cx, cy, Math.max(6, core.radius * rMax), warm, 1);
}

/**
 * paintScene — the full draw. Lays the whole universe into the viewport:
 *   1. faint orbital guide rings (baked) — mock l.199-203
 *   2. frozen shells (shells[1..]) — drawn then BAKED to one Image each (PNT-03)
 *   3. genesis core (live, cheap) — mock l.255-263
 *   4. the live frontier (shells[0]) — kept individual for per-frame animation
 *   5. the frontier ignite ring Graphics — redrawn per frame by CosmosScene
 *   6. the full-screen vignette (NORMAL blend, on top) — mock l.267-269
 *
 * Returns the handles CosmosScene needs to animate ONLY the frontier (PNT-03);
 * everything else is static/baked.
 */
export function paintScene(
  scene: Phaser.Scene,
  cosmos: CosmosSceneData,
  style: StyleTemplate,
  frame: PaintFrame,
): PaintResult {
  ensureGlowTexture(scene);
  const ramp = buildRamp(style);
  const facet = usesFacet(style);
  const { cx, cy, rMax } = frame;

  // 1. faint orbital guide rings, baked low-alpha (mock l.199-203).
  const guides = scene.add.graphics();
  guides.lineStyle(style.line.width, coreStop(ramp), 0.05);
  for (const shell of cosmos.shells) {
    const r = shell.radius * rMax;
    if (r >= 2) guides.strokeCircle(cx, cy, r);
  }

  // 2. frozen shells (shells[1..]) — draw then bake each into one Image (PNT-03).
  const frozen = cosmos.shells.slice(1);
  for (const shell of frozen) {
    const shellR = shell.radius * rMax;
    if (shellR < 1.5) continue;
    const objs = drawShell(scene, shell, shellR, frame, ramp, style, facet);
    if (objs.length > 0) {
      // Bake the frozen shell's glows into ONE composited Image — frozen shells
      // are never redrawn per frame (only the frontier animates, PNT-03).
      bakeShell(scene, `shell-${shell.day}`, objs, frame.width, frame.height);
    }
  }

  // 3. genesis core (always live, cheap).
  drawCore(scene, cosmos, frame, ramp);

  // 4. the live frontier (shells[0]) — kept individual for twinkle/ignite.
  const frontier = cosmos.shells[0] ?? null;
  let frontierStars: StarObject[] = [];
  let frontierRadius = 0;
  if (frontier) {
    frontierRadius = frontier.radius * rMax;
    frontierStars = drawShell(scene, frontier, frontierRadius, frame, ramp, style, facet);
  }

  // 5. the frontier ignite ring — its own Graphics, redrawn per frame.
  const igniteGraphics = scene.add.graphics();
  igniteGraphics.setBlendMode(Phaser.BlendModes.ADD);

  // 6. vignette LAST, NORMAL blend, on top of everything.
  ensureVignette(scene, frame.width, frame.height);
  const vignette = scene.add.image(cx, cy, VIGNETTE_TEXTURE_KEY);
  vignette.setBlendMode(Phaser.BlendModes.NORMAL);

  return { igniteGraphics, frontierStars, frontierRadius, frontier };
}

/**
 * Draw the pulsing frontier ignite ring (mock l.249-252) at the given pulse
 * (0..1). Called every frame by CosmosScene for the frontier ONLY; under
 * reduced-motion it is called once with pulse=1 (fully on, no strobe).
 */
export function drawIgniteRing(
  graphics: Phaser.GameObjects.Graphics,
  style: StyleTemplate,
  ramp: number[],
  frame: PaintFrame,
  frontierRadius: number,
  pulse: number,
): void {
  graphics.clear();
  if (frontierRadius < 1.5) return;
  // Ignite color = the warm core stop (the live "still igniting" edge).
  graphics.lineStyle(Math.max(2, frame.band * 0.5), coreStop(ramp), style.line.alpha * pulse);
  graphics.strokeCircle(frame.cx, frame.cy, frontierRadius);
}

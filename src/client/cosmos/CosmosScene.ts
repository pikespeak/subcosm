// CosmosScene — the Phaser.Scene that paints a synthesized Scene to pixels.
//
// The thinnest end-to-end paint slice (plan 02-01): draw the genesis core +
// the frontier shell's stars as tinted additive glows (primitives.ts). Fuller
// shell parity, the frontier rAF animation, and bake-on-freeze land in plan 03.
//
// Contract discipline (ENG-02): this Scene reads only the engine `Scene`
// (geometry, hue is a 0..1 hint) + the `StyleTemplate` (look). It NEVER reaches
// back for a raw DayVector. Hue → color is resolved here through the palette
// ramp — paint maps hue to color, never the reverse.
import * as Phaser from 'phaser';
import type { Scene as CosmosSceneData, StyleTemplate } from '../../engine/contracts';
import { addGlow, ensureGlowTexture } from './primitives';

export interface CosmosSceneInit {
  scene: CosmosSceneData;
  style: StyleTemplate;
}

/** Background space color (UI-SPEC dominant: near-black space stage). */
const SPACE_BG = 0x04030a;

export class CosmosScene extends Phaser.Scene {
  private cosmos!: CosmosSceneData;
  private style!: StyleTemplate;
  private ramp: number[] = [];

  constructor() {
    super('Cosmos');
  }

  /** Phaser passes the data object from `scene.start('Cosmos', data)`. */
  init(data: CosmosSceneInit): void {
    this.cosmos = data.scene;
    this.style = data.style;
    this.ramp = this.style.palette.ramp.map((hex) =>
      Phaser.Display.Color.HexStringToColor(hex).color,
    );
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(SPACE_BG);

    ensureGlowTexture(this);
    this.paint(this.scale.width, this.scale.height);

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      // Cheapest correct response for this slice: resize the camera and repaint.
      this.cameras.resize(size.width, size.height);
      this.paintReset();
      this.paint(size.width, size.height);
    });
  }

  /** Clear previously drawn glows (full re-layout on resize for this slice). */
  private paintReset(): void {
    this.children.removeAll(true);
  }

  /** Paint the genesis core + frontier shell stars into the current viewport. */
  private paint(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    // Map the normalized radii (0..1) onto the smaller screen half-extent so the
    // whole universe fits with margin (mock uses ~0.95 of min dimension).
    const rMax = Math.min(width, height) * 0.46;
    const fillAlpha = this.style.fill.alpha;

    // --- frontier shell (shells[0] — outermost, radius pow(0.85,0)=1) ---
    const frontier = this.cosmos.shells[0];
    if (frontier) {
      const shellR = frontier.radius * rMax;
      for (const el of frontier.elements) {
        const x = cx + Math.cos(el.angle) * shellR * el.r;
        const y = cy + Math.sin(el.angle) * shellR * el.r;
        const color = this.hueToColor(el.hue);
        // size is a small normalized factor; scale into px and brighten "big".
        const glowR = Math.max(2, el.size * rMax * 0.08) * (el.big ? 1.6 : 1);
        addGlow(this, x, y, glowR, color, fillAlpha * (0.6 + el.energy * 0.4));
      }
    }

    // --- genesis core (large warm-white glow + bright dot) ---
    const core = this.cosmos.core;
    const coreColor = this.hueToColor(core.hue);
    const coreGlowR = Math.max(40, core.radius * rMax * 6);
    addGlow(this, cx, cy, coreGlowR, this.warmWhite(), 0.9);
    addGlow(this, cx, cy, coreGlowR * 0.45, coreColor, 0.7 + core.energy * 0.2);
    // Bright core dot on top.
    addGlow(this, cx, cy, Math.max(6, core.radius * rMax), this.warmWhite(), 1);
  }

  /** Resolve a 0..1 hue hint to a palette color by interpolating the ramp. */
  private hueToColor(hue: number): number {
    const ramp = this.ramp;
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
  private warmWhite(): number {
    return this.ramp.length > 0 ? this.ramp[this.ramp.length - 1]! : 0xffffff;
  }
}

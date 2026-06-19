// PhaserPainter — the ONLY Phaser holder that reaches the engine call-site.
//
// This is the injection seam (RESEARCH Pattern 1): it implements the engine's
// `Painter` interface (declared types-only in src/engine/render.ts) and is the
// single place `phaser` meets the engine `render()` orchestration. It lives
// under src/client/cosmos/ precisely so `phaser` never imports into
// src/engine/** (eslint no-restricted-imports; Pitfall 2).
//
// For this slice `mount` boots/feeds the CosmosScene with the synthesized Scene.
// repaintFrontier/focus/remount are minimal now — their full behaviour lands in
// plans 03 (frontier animation/bake) / 04 (camera) / 05 (steering re-mount).
import * as Phaser from 'phaser';
import type { Painter } from '../../engine/render';
import type { Scene as CosmosSceneData, StyleTemplate } from '../../engine/contracts';
import { CosmosScene, type CosmosSceneInit } from './CosmosScene';
import type { CameraController } from './camera';

const SCENE_KEY = 'Cosmos';

export class PhaserPainter implements Painter {
  private readonly game: Phaser.Game;

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  /** Paint a freshly synthesized Scene with the given style. */
  mount(scene: CosmosSceneData, style: StyleTemplate): void {
    const data: CosmosSceneInit = { scene, style };
    const manager = this.game.scene;
    if (manager.getScene(SCENE_KEY)) {
      manager.start(SCENE_KEY, data);
    } else {
      manager.add(SCENE_KEY, CosmosScene, true, data);
    }
  }

  /** Plan 03: repaint only the live frontier shell (PNT-03). */
  repaintFrontier(_frontier: CosmosSceneData['shells'][number]): void {
    // Frontier rAF animation + bake-on-freeze land in plan 03.
  }

  /**
   * Move the camera focus to a given shell/day (CAM-01). Delegates to the
   * CosmosScene's CameraController — camera-only, never re-synthesizes. This is
   * the seam `RenderHandle.scrub(day)` drives.
   */
  focus(day: number): void {
    const scene = this.game.scene.getScene(SCENE_KEY) as CosmosScene | null;
    scene?.getController()?.scrub(day);
  }

  /**
   * Expose the live CameraController so the dev page can wire the DOM slider +
   * HUD to the SAME view state the in-canvas gestures drive (slider/click sync,
   * D-01). Returns null until the Scene has booted.
   */
  getController(): CameraController | null {
    const scene = this.game.scene.getScene(SCENE_KEY) as CosmosScene | null;
    return scene?.getController() ?? null;
  }

  /** Plan 05: re-mount after a re-synthesis (new data / genome / steering). */
  remount(scene: CosmosSceneData, style: StyleTemplate): void {
    this.mount(scene, style);
  }

  /** Tear down all paint resources. */
  destroy(): void {
    this.game.destroy(true);
  }
}

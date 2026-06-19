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

  /** Plan 04: move the camera focus to a given shell/day (CAM-01). */
  focus(_day: number): void {
    // Camera scrub/zoom lands in plan 04.
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

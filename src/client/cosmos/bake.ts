// bake — flatten a frozen shell's many additive glows into ONE texture (PNT-03).
//
// "Depth = time": a community accumulates one shell per day, each shell holding
// many glow Images. Re-drawing every glow of every historical shell each frame
// would blow the 60fps mobile budget. Once a shell freezes (it is no longer the
// frontier), we bake its glow Images into a single DynamicTexture and composite
// it as ONE Image — the rest of the universe becomes effectively free to draw.
// Only the live frontier keeps its individual animated glows (StyleTemplate
// motion.frontierOnly). This is the bake-on-freeze foundation; the freeze
// trigger + LOD wiring land in plan 03.
import * as Phaser from 'phaser';

/**
 * Bake a group of glow Images (a frozen shell) into a single composited Image.
 *
 * Draws the supplied game objects into a DynamicTexture of the given size, then
 * destroys the source objects and returns one Image showing the baked texture.
 * The bake preserves the additive look because the source Images already carry
 * `BlendModes.ADD`, and `dt.draw` composites them with their own blend.
 *
 * @param scene   the owning scene.
 * @param key     unique texture key for this shell's bake (e.g. `shell-12`).
 * @param objects the per-glow Images to flatten (consumed/destroyed on bake).
 * @param width   bake canvas width (px) — typically the stage width.
 * @param height  bake canvas height (px) — typically the stage height.
 * @returns the single composited Image, or null if the DynamicTexture could not
 *          be created (the caller keeps the live objects as a fallback).
 */
export function bakeShell(
  scene: Phaser.Scene,
  key: string,
  objects: Phaser.GameObjects.GameObject[],
  width: number,
  height: number,
): Phaser.GameObjects.Image | null {
  if (scene.textures.exists(key)) scene.textures.remove(key);

  const dt = scene.textures.addDynamicTexture(key, width, height);
  if (!dt) return null;

  // Composite every glow into the texture at its current transform, then drop
  // the live objects — they are now pixels, not scene-graph nodes.
  dt.draw(objects);
  for (const obj of objects) obj.destroy();

  // The baked texture covers the stage; place it at the stage center as ADD so
  // the flattened shell still reads as additive light over the background.
  const baked = scene.add.image(width / 2, height / 2, key);
  baked.setBlendMode(Phaser.BlendModes.ADD);
  return baked;
}

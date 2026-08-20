/*
 * Draws a field scene: baked background, then every body in the map as a 3D
 * model. Ordering is left to the depth buffer — including against the baked
 * scenery — so nothing here needs the painter's sort the 2D renderer uses.
 */
import { bakeField, bakedMapId, focusField, beginFieldFrame, drawCharacter, compositeField } from './field.js';

const MODEL_FOR_NPC = (npc) => {
  if (npc.actor === 'dog') return 'dog';
  if (npc.actor) return npc.actor;
  return npc.sprite || 'villager';
};

/**
 * @param {CanvasRenderingContext2D} ctx target 2D canvas
 * @param {object} scene { mapId, map, player, time, rift }
 * @returns {boolean} false when the 3D path could not run
 */
export function drawWorld3D(ctx, scene) {
  const { mapId, map, player, actors = [], time = 0, rift = null } = scene;
  if (bakedMapId() !== mapId) {
    if (!bakeField(mapId, map, { dark: !!map.dark })) return false;
  }
  focusField(player.px, player.py);
  if (!beginFieldFrame()) return false;

  for (const npc of map.npcs || []) {
    drawCharacter({
      model: MODEL_FOR_NPC(npc), x: npc.cx, y: npc.cy,
      facing: npc.dir || npc.facing || 'down', clip: 'idle', t: time + npc.cx * 0.7,
    });
  }
  for (const a of actors) {
    drawCharacter({
      model: a.sprite || 'villager', x: a.px, y: a.py,
      facing: a.dir || 'down', clip: a.moving ? 'walk' : 'idle', t: time + 0.3,
      alpha: a.alpha ?? 1,
    });
  }
  if (rift) {
    drawCharacter({ model: 'rift', x: rift.x, y: rift.y, facing: 'down', clip: 'idle', t: time });
    for (const s of rift.spawns) {
      drawCharacter({ model: s.id, x: s.x, y: s.y, facing: 'down', clip: 'idle', t: time + s.x, tint: [0.29, 0.64, 1, 0.35] });
    }
  }
  drawCharacter({
    model: 'tata', x: player.px, y: player.py, facing: player.facing,
    clip: player.moving ? 'walk' : 'idle', t: player.moving ? player.anim : time,
  });

  compositeField(ctx);
  return true;
}

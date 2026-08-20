/*
 * Draws a field scene: baked background, then every body in the map as a 3D
 * model. Ordering is left to the depth buffer — including against the baked
 * scenery — so nothing here needs the painter's sort the 2D renderer uses.
 *
 * Every body gets a stable `key`, which is what lets the renderer ease its
 * yaw through turns; the camera leads a moving player by their facing.
 */
import { bakeField, bakedMapId, focusField, beginFieldFrame, drawCharacter, compositeField } from './field.js';

const MODEL_FOR_NPC = (npc) => {
  if (npc.actor === 'dog') return 'dog';
  if (npc.actor) return npc.actor;
  return npc.sprite || 'villager';
};

const LOOK = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

let lastTime = 0;

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
  const dt = Math.max(0, Math.min(0.1, time - lastTime));
  lastTime = time;
  focusField(player.px, player.py, dt, player.moving ? LOOK[player.facing] : null);
  if (!beginFieldFrame()) return false;

  for (const npc of map.npcs || []) {
    drawCharacter({
      model: MODEL_FOR_NPC(npc), key: `npc:${npc.id}`, x: npc.cx, y: npc.cy,
      facing: npc.dir || npc.facing || 'down', clip: 'idle', t: time + npc.cx * 0.7,
    });
  }
  actors.forEach((a, i) => {
    drawCharacter({
      model: a.sprite || 'villager', key: `actor:${a.id ?? i}`, x: a.px, y: a.py,
      facing: a.dir || 'down', clip: a.moving ? 'walk' : 'idle', t: time + 0.3,
      alpha: a.alpha ?? 1,
    });
  });
  if (rift) {
    drawCharacter({ model: 'rift', x: rift.x, y: rift.y, facing: 'down', clip: 'idle', t: time, shadow: false });
    rift.spawns.forEach((s, i) => {
      drawCharacter({ model: s.id, key: `spawn:${i}`, x: s.x, y: s.y, facing: 'down', clip: 'idle', t: time + s.x, tint: [0.29, 0.64, 1, 0.35] });
    });
  }
  drawCharacter({
    model: 'tata', key: 'player', x: player.px, y: player.py, facing: player.facing,
    clip: player.moving ? 'walk' : 'idle', t: player.moving ? player.anim : time,
  });

  compositeField(ctx);
  return true;
}

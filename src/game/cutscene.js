import { G, enterMap, save } from './state.js';
import { showDialogue, Dialog } from './dialogue.js';
import { startBattle } from './battle.js';

/*
 * Tiny step-runner for scripted beats. A script is an array of steps:
 *   { say: [lines] }            dialogue, waits for the player
 *   { wait: seconds }
 *   { flash: 'rift' }           blue shockwave across the screen
 *   { spawn: {id, sprite, x, y, dir} }
 *   { walk: {id, to:[x,y], speed} }
 *   { despawn: id }
 *   { flag: 'name' }
 *   { battle: {ids, boss, intro, onLose} }
 *   { enterMap: {id, x, y, facing} }
 *   { fn: () => {} }
 *   { save: true }
 */
export const Cut = {
  steps: [], i: 0, running: false, blocking: false, timer: 0, flash: 0,
};

export function runScript(steps) {
  Cut.steps = steps.slice();
  Cut.i = 0;
  Cut.running = true;
  Cut.blocking = false;
  Cut.timer = 0;
  step();
}

export const cutsceneActive = () => Cut.running;

function step() {
  if (Cut.i >= Cut.steps.length) { Cut.running = false; return; }
  const s = Cut.steps[Cut.i++];

  if (s.say) { Cut.blocking = true; showDialogue(s.say, () => { Cut.blocking = false; step(); }); return; }
  if (s.wait) { Cut.blocking = true; Cut.timer = s.wait; return; }
  if (s.flash) { Cut.flash = 1; return step(); }
  if (s.spawn) {
    G.actors.push({ frame: 0, dir: 'down', ...s.spawn, px: s.spawn.x, py: s.spawn.y, path: [], t: 0 });
    return step();
  }
  if (s.walk) {
    const a = G.actors.find((x) => x.id === s.walk.id);
    if (a) { a.target = { x: s.walk.to[0], y: s.walk.to[1] }; a.speed = s.walk.speed || 3; Cut.blocking = true; return; }
    return step();
  }
  if (s.despawn) { G.actors = G.actors.filter((a) => a.id !== s.despawn); return step(); }
  if (s.flag) { G.flags[s.flag] = true; return step(); }
  if (s.enterMap) { enterMap(s.enterMap.id, s.enterMap.x, s.enterMap.y, s.enterMap.facing); return step(); }
  if (s.fn) { s.fn(); return step(); }
  if (s.save) { save(); return step(); }
  if (s.battle) {
    Cut.blocking = true;
    startBattle(s.battle.ids, {
      boss: s.battle.boss,
      intro: s.battle.intro,
      onEnd: (result) => {
        Cut.blocking = false;
        if (result === 'win') { step(); return; }
        // a loss or a retreat ends the script here — the rest of the beat
        // has not happened yet, so it must not play out
        Cut.running = false;
        Cut.steps.length = 0;
        if (s.battle.onEnd) s.battle.onEnd(result);
      },
    });
    return;
  }
  return step();
}

export function updateCutscene(dt) {
  Cut.flash = Math.max(0, Cut.flash - dt * 0.9);
  if (!Cut.running) return;
  if (Dialog.active) return;              // dialogue drives its own advance
  if (!Cut.blocking) return;

  if (Cut.timer > 0) {
    Cut.timer -= dt;
    if (Cut.timer <= 0) { Cut.blocking = false; step(); }
    return;
  }

  // walking actors
  let stillWalking = false;
  for (const a of G.actors) {
    if (!a.target) continue;
    stillWalking = true;
    const speed = a.speed || 3;
    const dx = a.target.x - a.px, dy = a.target.y - a.py;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) { a.px = a.target.x; a.py = a.target.y; a.x = a.target.x; a.y = a.target.y; a.target = null; continue; }
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    a.px += (dx / dist) * speed * dt;
    a.py += (dy / dist) * speed * dt;
    a.t = (a.t || 0) + dt;
    a.frame = Math.floor(a.t * 6) % 2;
  }
  if (stillWalking && !G.actors.some((a) => a.target)) { Cut.blocking = false; step(); }
}

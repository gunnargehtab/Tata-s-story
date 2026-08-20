import { G, noteAnomaly, addItem, addClue, grantXp, stat, save } from './state.js';
import { startBattle } from './battle.js';
import { showDialogue } from './dialogue.js';
import { SPRITES } from '../art/sprites.js';
import { PAL } from '../art/palette.js';
import { TILE } from '../art/tiles.js';
import { VIEW, inkPanel, text, bar } from '../engine/ui.js';

/*
 * Rift events (gameplan §7): random distortions, a clock, and monsters that
 * spawn out of ordinary objects. A rift opens near Tata, counts down, and
 * pulls things through. Reach it in time and she can seal it; ignore it and it
 * collapses into a fight on its own terms.
 */

const TS = TILE * 2;
const RIFT_LIFE = 42;          // seconds before it collapses
const SPAWN_POOL = ['wisp', 'crate', 'hound'];

export function riftOpen() { return !!G.rift; }

/** Rolls for a new rift after a step. Only on maps that allow them. */
export function maybeOpenRift(isWalkable, tileAt) {
  if (G.rift || !G.map.rifts) return false;
  if (G.tata.level < 2) return false;                 // let her find her feet first
  if (G.flags.riftTutorialDone && Math.random() > 0.05) return false;
  if (!G.flags.riftTutorialDone && G.steps < 6) return false;

  const p = G.player;
  // find an open tile a few paces off — close enough to matter, far enough to run to
  const candidates = [];
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < 3 || d > 6) continue;
      const x = p.x + dx, y = p.y + dy;
      if (isWalkable(tileAt(x, y))) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return false;
  const spot = candidates[Math.floor(Math.random() * candidates.length)];

  G.rift = {
    x: spot.x, y: spot.y,
    life: RIFT_LIFE, maxLife: RIFT_LIFE,
    spawns: [],
    spawnTimer: 6,
    pulse: 0,
  };
  const first = !G.flags.riftTutorialDone;
  G.flags.riftTutorialDone = true;
  noteAnomaly(`A rift opened in ${G.map.name} without anything opening it.`);
  showDialogue(first
    ? ['The air tears open a few paces off — a slit of blue standing upright in nothing.',
       { who: 'Tata', text: 'Right. New rule: things that open on their own get closed by me.' },
       'Reach it before it collapses. Standing in it is the only way to shut it.']
    : ['A slit of blue opens nearby, patient as a held breath.']);
  return true;
}

export function updateRift(dt) {
  const r = G.rift;
  if (!r) return;
  r.pulse += dt;
  r.life -= dt;
  r.spawnTimer -= dt;

  if (r.spawnTimer <= 0 && r.spawns.length < 2) {
    r.spawnTimer = 14;
    const id = SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
    r.spawns.push({ id, x: r.x, y: r.y, px: r.x, py: r.y, step: 0 });
  }
  if (r.life <= 0) collapse();
}

/** Spawns shuffle one tile toward Tata every other step she takes. */
export function riftStep(blocked) {
  const r = G.rift;
  if (!r) return;
  const p = G.player;
  for (const s of r.spawns) {
    s.step++;
    if (s.step % 2) continue;
    const dx = Math.sign(p.x - s.x), dy = Math.sign(p.y - s.y);
    const tryOrder = Math.abs(p.x - s.x) > Math.abs(p.y - s.y)
      ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const [mx, my] of tryOrder) {
      if (!mx && !my) continue;
      if (blocked(s.x + mx, s.y + my)) continue;
      s.x += mx; s.y += my;
      break;
    }
  }
  if (checkContact()) return true;
  if (p.x === r.x && p.y === r.y) { seal(); return true; }
  return false;
}

function checkContact() {
  const r = G.rift;
  const p = G.player;
  const hit = r.spawns.find((s) => s.x === p.x && s.y === p.y);
  if (!hit) return false;
  r.spawns = r.spawns.filter((s) => s !== hit);
  startBattle([hit.id], {
    empower: 1.15,
    intro: 'It came through the tear still wearing the shape of a thing you own.',
    onEnd: (result) => { if (result === 'lose') riftFail(); save(); },
  });
  return true;
}

function seal() {
  const r = G.rift;
  const roll = stat('RES') + Math.floor(Math.random() * 8);
  G.rift = null;
  if (roll >= 8) {
    noteAnomaly('Sealed a rift by standing in it. It closed like a held breath let go.');
    addItem('ward');
    const up = grantXp(14);
    showDialogue([
      'Tata steps into the blue. It is cold the way a name you have forgotten is cold.',
      'She holds still. The tear closes around nothing and leaves a nail behind.',
      { who: 'Notebook', text: 'Rift sealed. +1 Rift Ward. +14 XP.' },
      ...(up ? [{ who: 'Notebook', text: `Level ${G.tata.level}.` }] : []),
    ]);
  } else {
    G.tata.hp = Math.max(1, G.tata.hp - 6);
    noteAnomaly('A rift threw her out. Sealing one takes more resistance than she has.');
    showDialogue([
      'The blue does not want her. It shoves — hard, and from a direction that does not exist.',
      { who: 'Tata', text: 'Noted. Bring more iron next time.' },
    ]);
  }
  save();
}

function collapse() {
  const r = G.rift;
  G.rift = null;
  noteAnomaly('An unsealed rift collapsed. Whatever it was holding came out all at once.');
  const id = SPAWN_POOL[Math.floor(Math.random() * SPAWN_POOL.length)];
  startBattle([id, id], {
    empower: 1.2,
    intro: 'The tear folds shut and puts everything it was holding on the floor in front of her.',
    onEnd: (result) => { if (result === 'lose') riftFail(); save(); },
  });
}

function riftFail() {
  addClue('rift-cost', 'Rifts do not care who is standing near them when they close.');
}

// -------------------------------------------------------------------- draw

export function drawRift(ctx, camX, camY) {
  const r = G.rift;
  if (!r) return;
  const pulse = 0.6 + 0.4 * Math.sin(r.pulse * 4);

  const x = Math.round(r.x * TS - camX), y = Math.round(r.y * TS - camY);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PAL.B;
  ctx.fillRect(x + 10, y - 6, 12, TS + 12);
  ctx.fillStyle = PAL.b;
  ctx.fillRect(x + 6, y + 4, 6, TS - 8);
  ctx.fillRect(x + 20, y + 4, 6, TS - 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.W;
  ctx.fillRect(x + 14, y + 6, 4, TS - 12);

  for (const s of r.spawns) {
    const img = SPRITES.enemy[s.id];
    const scale = 1.1;
    const w = img.width * scale, h = img.height * scale;
    const sx = Math.round(s.x * TS - camX + (TS - w) / 2);
    const sy = Math.round(s.y * TS - camY + TS - h);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, sx, sy, w, h);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.B;
    ctx.fillRect(sx, sy, w, h);
    ctx.globalAlpha = 1;
  }
}

/** The countdown strip under the HUD while a rift is open. */
export function drawRiftHud(ctx) {
  const r = G.rift;
  if (!r) return;
  inkPanel(ctx, 8, 66, VIEW.width - 16, 34);
  text(ctx, 'RIFT OPEN', 22, 76, { size: 10, bold: true, color: PAL.b });
  bar(ctx, 100, 76, 170, 8, r.life / r.maxLife, PAL.B);
  text(ctx, `${Math.ceil(r.life)}s`, VIEW.width - 26, 75, { size: 10, align: 'right', color: PAL.g });
}

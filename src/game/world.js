import { G, enterMap, save } from './state.js';
import { tileArt, TILE, isWalkable } from '../art/tiles.js';
import { SPRITES } from '../art/sprites.js';
import { PAL } from '../art/palette.js';
import { VIEW, WORLD_SCALE, inkPanel, text, wrap, bar, drawControls } from '../engine/ui.js';
import { Input } from '../engine/input.js';
import { Dialog, showDialogue, updateDialogue, drawDialogue } from './dialogue.js';
import { Cut, updateCutscene } from './cutscene.js';
import { SCRIPTS } from './scripts.js';
import { startBattle } from './battle.js';

const TS = TILE * WORLD_SCALE;      // 32 screen px per tile
const STEP_TIME = 0.16;             // seconds per tile
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const World = { notebook: false, camX: 0, camY: 0, encounterCooldown: 0 };

// ------------------------------------------------------------------ helpers

function tileAt(x, y) {
  const m = G.map;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return '#';
  return m.grid[y][x];
}

function npcAt(x, y) {
  return (G.map.npcs || []).find((n) => n.cx === x && n.cy === y);
}

function blocked(x, y) {
  if (!isWalkable(tileAt(x, y))) return true;
  // a bolted door is a door you can knock on, not walk through
  if ((G.map.warps || []).some((w) => w.locked && w.x === x && w.y === y)) return true;
  if (npcAt(x, y)) return true;
  if (G.actors.some((a) => Math.round(a.px) === x && Math.round(a.py) === y)) return true;
  return false;
}

/** Breadth-first path for tap-to-move. Returns a list of {x,y} steps. */
function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const m = G.map;
  const seen = new Uint8Array(m.w * m.h);
  const prev = new Int32Array(m.w * m.h).fill(-1);
  const q = [sy * m.w + sx];
  seen[sy * m.w + sx] = 1;
  const goal = ty * m.w + tx;
  let found = false;
  while (q.length && !found) {
    const cur = q.shift();
    const cx = cur % m.w, cy = (cur / m.w) | 0;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const idx = ny * m.w + nx;
      if (seen[idx]) continue;
      if (blocked(nx, ny)) continue;
      seen[idx] = 1;
      prev[idx] = cur;
      if (idx === goal) { found = true; break; }
      q.push(idx);
    }
  }
  if (!found) return null;
  const path = [];
  let cur = goal;
  while (cur !== sy * m.w + sx) {
    path.push({ x: cur % m.w, y: (cur / m.w) | 0 });
    cur = prev[cur];
    if (cur < 0) return null;
  }
  return path.reverse();
}

// ------------------------------------------------------------------- update

export function updateWorld(dt) {
  G.time += dt;
  updateCutscene(dt);
  updateDialogue(dt);
  World.encounterCooldown = Math.max(0, World.encounterCooldown - dt);

  if (Input.menuPressed && !Dialog.active && !Cut.running) World.notebook = !World.notebook;
  if (World.notebook) {
    if (Input.actionPressed) World.notebook = false;
    for (const tap of Input.taps) if (tap.y < 90 || tap.y > 560) World.notebook = false;
    return;
  }
  if (Dialog.active || Cut.running) { animateNpcs(dt); return; }

  const p = G.player;

  if (p.moving) {
    p.t += dt / STEP_TIME;
    if (p.t >= 1) {
      p.t = 0; p.moving = false;
      p.px = p.x; p.py = p.y;
      onArrive();
    } else {
      p.px = p.fx + (p.x - p.fx) * p.t;
      p.py = p.fy + (p.y - p.fy) * p.t;
    }
  } else {
    handleInput();
  }

  p.anim += dt;
  animateNpcs(dt);
}

function handleInput() {
  const p = G.player;

  if (Input.actionPressed) { p.path.length = 0; interact(); return; }

  if (Input.dir) {
    p.path.length = 0;
    tryStep(Input.dir);
    return;
  }

  for (const tap of Input.taps) {
    const tx = Math.floor((tap.x + World.camX) / TS);
    const ty = Math.floor((tap.y + World.camY) / TS);
    const npc = npcAt(tx, ty);
    const spot = (G.map.interacts || []).find((i) => i.x === tx && i.y === ty);
    if (npc || spot || !isWalkable(tileAt(tx, ty))) {
      // walk to the nearest free neighbour, then face and interact
      const targets = Object.values(DIRS)
        .map(([dx, dy]) => ({ x: tx + dx, y: ty + dy }))
        .filter((t) => !blocked(t.x, t.y));
      let best = null, bestPath = null;
      for (const t of targets) {
        const path = findPath(p.x, p.y, t.x, t.y);
        if (path && (!bestPath || path.length < bestPath.length)) { best = t; bestPath = path; }
      }
      if (bestPath) { p.path = bestPath; p.pendingInteract = { x: tx, y: ty }; }
      else if (Math.abs(tx - p.x) + Math.abs(ty - p.y) === 1) { faceTowards(tx, ty); interact(); }
      return;
    }
    const path = findPath(p.x, p.y, tx, ty);
    if (path) { p.path = path; p.pendingInteract = null; }
    return;
  }

  if (p.path.length) {
    const next = p.path[0];
    const dir = next.x > p.x ? 'right' : next.x < p.x ? 'left' : next.y > p.y ? 'down' : 'up';
    if (!tryStep(dir)) p.path.length = 0;
    else p.path.shift();
    return;
  }

  if (p.pendingInteract) {
    const t = p.pendingInteract;
    p.pendingInteract = null;
    if (Math.abs(t.x - p.x) + Math.abs(t.y - p.y) === 1) { faceTowards(t.x, t.y); interact(); }
  }
}

function faceTowards(x, y) {
  const p = G.player;
  p.facing = x > p.x ? 'right' : x < p.x ? 'left' : y > p.y ? 'down' : 'up';
}

function tryStep(dir) {
  const p = G.player;
  p.facing = dir;
  const [dx, dy] = DIRS[dir];
  const nx = p.x + dx, ny = p.y + dy;
  if (blocked(nx, ny)) return false;
  p.fx = p.x; p.fy = p.y;
  p.x = nx; p.y = ny;
  p.moving = true; p.t = 0;
  return true;
}

function onArrive() {
  const p = G.player;
  G.steps++;

  // warps
  const warp = (G.map.warps || []).find((w) => w.x === p.x && w.y === p.y);
  if (warp && warp.to) {
    enterMap(warp.to, warp.tx, warp.ty, warp.facing);
    save();
    return;
  }

  // proximity triggers
  for (const t of (G.map.triggers || [])) {
    if (t.done || (t.once && G.flags[`trigger:${G.mapId}:${t.id}`])) continue;
    if (t.requires && !G.flags[t.requires]) continue;
    const r = t.radius || 0;
    if (Math.abs(t.x - p.x) <= r && Math.abs(t.y - p.y) <= r) {
      if (t.once) G.flags[`trigger:${G.mapId}:${t.id}`] = true;
      SCRIPTS[t.script]?.();
      return;
    }
  }

  maybeEncounter();
}

function maybeEncounter() {
  const enc = G.map.encounters;
  if (!enc || World.encounterCooldown > 0) return;
  if (Math.random() > enc.rate) return;
  World.encounterCooldown = 1.5;
  // pairs only once Tata has a level or two under her hat
  const count = (G.tata.level > 1 && Math.random() < 0.3) ? 2 : 1;
  const ids = Array.from({ length: count }, () => enc.pool[Math.floor(Math.random() * enc.pool.length)]);
  startBattle(ids, {
    intro: count > 1 ? 'Two shapes peel away from the brickwork.' : 'Something detaches itself from the dark.',
    onEnd: (result) => {
      if (result === 'lose') {
        G.tata.hp = Math.max(1, Math.round(G.tata.maxHp * 0.4));
        enterMap('village', 11, 11, 'down');
        showDialogue(['Tata comes to at the lip of the well, ears ringing.',
          { who: 'Tata', text: 'Noted. Do not do that again.' }]);
      }
      save();
    },
  });
}

function interact() {
  const p = G.player;
  const [dx, dy] = DIRS[p.facing];
  const tx = p.x + dx, ty = p.y + dy;

  const npc = npcAt(tx, ty);
  if (npc) {
    npc.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[p.facing];
    const set = (G.flags.wellOpen && npc.lines.post) ? npc.lines.post : npc.lines.default;
    const lines = set.map((l) => ({ who: npc.name, text: l }));
    if (npc.clue && G.flags.capsule) {
      const gained = !G.clues.some((c) => c.id === npc.clue.id);
      if (gained) {
        G.clues.push({ id: npc.clue.id, text: npc.clue.text });
        lines.push({ who: 'Notebook', text: npc.clue.text });
        save();
      }
    }
    showDialogue(lines);
    return;
  }

  const spot = (G.map.interacts || []).find((i) => i.x === tx && i.y === ty);
  if (spot) { SCRIPTS[spot.script]?.(); return; }

  const locked = (G.map.warps || []).find((w) => w.x === tx && w.y === ty && w.locked);
  if (locked) { showDialogue([locked.locked]); return; }

  const warp = (G.map.warps || []).find((w) => w.x === tx && w.y === ty && w.to);
  if (warp) { enterMap(warp.to, warp.tx, warp.ty, warp.facing); save(); return; }

  // ambient "detective mode" reading of the tile in front
  const ch = tileAt(tx, ty);
  const notes = {
    T: 'A tree. It has been a tree all evening.',
    h: 'Whitewash, cracked. Somebody repainted over a hand print.',
    c: 'Crates. Stamped with a port mark she doesn’t recognise.',
    f: 'Fence rails, splintered outward. Something left in a hurry.',
    B: 'Shelves. Detective novels, mostly. One is missing.',
    '#': 'Cold stone. The damp draws a map on it.',
    r: 'Rubble, still warm.',
    w: 'Still water, refusing to reflect the moon properly.',
    '*': 'The ground here is blue and thinks it is somewhere else.',
  };
  if (notes[ch]) showDialogue([notes[ch]]);
}

function animateNpcs(dt) {
  for (const npc of (G.map.npcs || [])) {
    npc.frame = Math.floor(G.time * 1.4) % 2 === 0 ? 0 : 2;   // idle hat tilt
  }
}

// --------------------------------------------------------------------- draw

export function drawWorld(ctx) {
  const m = G.map;
  const p = G.player;

  const worldW = m.w * TS, worldH = m.h * TS;
  let camX = p.px * TS + TS / 2 - VIEW.width / 2;
  let camY = p.py * TS + TS / 2 - VIEW.height / 2;
  camX = worldW <= VIEW.width ? (worldW - VIEW.width) / 2 : Math.max(0, Math.min(worldW - VIEW.width, camX));
  camY = worldH <= VIEW.height ? (worldH - VIEW.height) / 2 : Math.max(0, Math.min(worldH - VIEW.height, camY));
  World.camX = camX; World.camY = camY;

  ctx.fillStyle = PAL.K;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const x0 = Math.floor(camX / TS), x1 = Math.ceil((camX + VIEW.width) / TS);
  const y0 = Math.floor(camY / TS), y1 = Math.ceil((camY + VIEW.height) / TS);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inside = x >= 0 && y >= 0 && x < m.w && y < m.h;
      if (!inside) continue;                       // outside the map stays ink-black
      ctx.drawImage(tileArt(m.grid[y][x], x, y), Math.round(x * TS - camX), Math.round(y * TS - camY), TS, TS);
    }
  }

  // everything that stands on the ground, painter-sorted by feet
  const bodies = [];
  for (const npc of (m.npcs || [])) bodies.push({ y: npc.cy, draw: () => drawNpc(ctx, npc, camX, camY) });
  for (const a of G.actors) bodies.push({ y: a.py, draw: () => drawActor(ctx, a, camX, camY) });
  bodies.push({ y: p.py, draw: () => drawPlayer(ctx, p, camX, camY) });
  bodies.sort((a, b) => a.y - b.y).forEach((b) => b.draw());

  if (m.dark) drawLantern(ctx, p, camX, camY);
  drawHud(ctx);
  if (Cut.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, Cut.flash);
    ctx.fillStyle = PAL.B;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
  }
  drawDialogue(ctx);
  if (World.notebook) drawNotebook(ctx);
  else if (!Dialog.active) drawControls(ctx, { pad: true, actionLabel: 'LOOK', menu: true, menuLabel: 'NOTE' });
}

function frameFor(set, dir, moving, anim, idleFrame) {
  const frames = set[dir] || set.down;
  if (moving) return frames[Math.floor(anim * 7) % 2];
  return frames[idleFrame] || frames[0];
}

function drawPlayer(ctx, p, camX, camY) {
  const set = SPRITES.tata;
  const img = frameFor(set, p.facing, p.moving, p.anim, Math.floor(G.time * 1.2) % 2 === 0 ? 0 : 2);
  const w = img.width * WORLD_SCALE, h = img.height * WORLD_SCALE;
  ctx.drawImage(img, Math.round(p.px * TS - camX + (TS - w) / 2), Math.round(p.py * TS - camY - (h - TS)), w, h);
}

function drawNpc(ctx, npc, camX, camY) {
  const set = npc.actor === 'dog' ? SPRITES.dog : SPRITES.npc[npc.sprite] || SPRITES.npc.villager;
  const frames = set[npc.dir] || set.down;
  const img = frames[npc.frame] || frames[0];
  const w = img.width * WORLD_SCALE, h = img.height * WORLD_SCALE;
  ctx.drawImage(img, Math.round(npc.cx * TS - camX + (TS - w) / 2), Math.round(npc.cy * TS - camY - (h - TS)), w, h);
}

function drawActor(ctx, a, camX, camY) {
  const set = SPRITES[a.sprite] || SPRITES.tata;
  const frames = set[a.dir] || set.down;
  const img = frames[a.frame] || frames[0];
  const w = img.width * WORLD_SCALE, h = img.height * WORLD_SCALE;
  ctx.drawImage(img, Math.round(a.px * TS - camX + (TS - w) / 2), Math.round(a.py * TS - camY - (h - TS)), w, h);
}

// Flashlight falloff for the well: ink over the page with a hole punched at Tata.
let shadowCv = null;
function drawLantern(ctx, p, camX, camY) {
  if (!shadowCv) {
    shadowCv = document.createElement('canvas');
    shadowCv.width = VIEW.width; shadowCv.height = VIEW.height;
  }
  const sctx = shadowCv.getContext('2d');
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, VIEW.width, VIEW.height);
  sctx.fillStyle = PAL.K;
  sctx.globalAlpha = 0.62;
  sctx.fillRect(0, 0, VIEW.width, VIEW.height);
  sctx.globalAlpha = 1;
  const cx = p.px * TS - camX + TS / 2;
  const cy = p.py * TS - camY + TS / 2;
  const grad = sctx.createRadialGradient(cx, cy, 20, cx, cy, 150);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.globalCompositeOperation = 'destination-out';
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.drawImage(shadowCv, 0, 0);
}

function drawHud(ctx) {
  inkPanel(ctx, 8, 8, VIEW.width - 16, 52);
  text(ctx, G.map.name, 22, 18, { size: 12, bold: true });
  text(ctx, `HP ${G.tata.hp}/${G.tata.maxHp}`, 22, 38, { size: 10 });
  bar(ctx, 92, 38, 70, 8, G.tata.hp / G.tata.maxHp, PAL.R);
  text(ctx, `FOC ${G.tata.foc}/${G.tata.maxFoc}`, 176, 38, { size: 10 });
  bar(ctx, 252, 38, 70, 8, G.tata.foc / G.tata.maxFoc, PAL.B);
  text(ctx, `Lv${G.tata.level}`, VIEW.width - 26, 18, { size: 11, align: 'right', bold: true });
}

/** Phase 1 stub of the Detective Notebook (full system is Phase 2). */
function drawNotebook(ctx) {
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = PAL.K;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.globalAlpha = 1;
  inkPanel(ctx, 16, 70, VIEW.width - 32, 500);
  text(ctx, 'DETECTIVE NOTEBOOK', 34, 90, { size: 14, bold: true });
  text(ctx, `Clues: ${G.clues.length}   Steps: ${G.steps}`, 34, 112, { size: 10, color: PAL.g });
  let y = 138;
  if (!G.clues.length) {
    text(ctx, 'Nothing written down yet.', 34, y, { size: 12, color: PAL.g });
  }
  for (const clue of G.clues) {
    const lines = wrap(ctx, `— ${clue.text}`, VIEW.width - 80, 12);
    for (const line of lines) {
      if (y > 500) break;
      text(ctx, line, 34, y, { size: 12 });
      y += 17;
    }
    y += 8;
  }
  text(ctx, 'tap outside, or NOTE, to close', VIEW.width / 2, 540, { size: 10, align: 'center', color: PAL.g });
}

import { G, enterMap, save, noteProfile } from './state.js';
import { tileArt, TILE, isWalkable } from '../art/tiles.js';
import { SPRITES } from '../art/sprites.js';
import { PAL } from '../art/palette.js';
import { VIEW, WORLD_SCALE, inkPanel, text, bar, drawControls } from '../engine/ui.js';
import { Input } from '../engine/input.js';
import { Dialog, showDialogue, updateDialogue, drawDialogue } from './dialogue.js';
import { Cut, updateCutscene } from './cutscene.js';
import { SCRIPTS } from './scripts.js';
import { startBattle } from './battle.js';
import { Notebook, openNotebook, updateNotebook, drawNotebook } from './notebook.js';
import { startTalk, talkActive } from './talk.js';
import { startInterrogation } from './interrogation.js';
import { maybeOpenRift, updateRift, riftStep, drawRift, drawRiftHud } from './rift.js';
import { gfxEnabled, drawWorld3D, fieldProject, fieldUnproject, fieldPPU } from '../gfx/index.js';

const TS = TILE * WORLD_SCALE;      // 32 screen px per tile
const STEP_TIME = 0.16;             // seconds per tile
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const World = { camX: 0, camY: 0, encounterCooldown: 0, threeD: false };

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

  if (Notebook.open) { updateNotebook(dt); animateNpcs(dt); return; }
  if (Input.menuPressed && !Dialog.active && !Cut.running) { openNotebook(); return; }
  updateRift(dt);
  if (Dialog.active || Cut.running || talkActive()) { animateNpcs(dt); return; }

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
    const { tx, ty } = screenToTile(tap.x, tap.y);
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

  if (riftStep(blocked)) return;      // a rift spawn caught her, or she sealed it
  if (maybeOpenRift(isWalkable, tileAt)) return;
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

    // a subject who has been rattled enough gets questioned properly
    if (npc.interro && G.flags[`${npc.interro}Interro`] && !G.flags[`${npc.interro}Broken`]) {
      delete G.flags[`${npc.interro}Interro`];
      startInterrogation(npc.interro, { onEnd: () => save() });
      return;
    }
    if (npc.talk && startTalk(npc.talk, 'start', () => save())) return;

    const set = (G.flags.wellOpen && npc.lines.post) ? npc.lines.post : npc.lines.default;
    showDialogue(set.map((l) => ({ who: npc.name, text: l })));
    if (npc.name) noteProfile(npc.id, { name: npc.name });
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

/**
 * Screen pixels to map tile, through whichever projection is drawing the field.
 *
 * In 3D a body is drawn *above* the tile it stands on, so unprojecting straight
 * onto the ground plane would send a tap on someone's hat to the tile behind
 * them. Standing things are hit-tested first, ground last.
 */
function screenToTile(sx, sy) {
  if (!(gfxEnabled() && World.threeD)) {
    return { tx: Math.floor((sx + World.camX) / TS), ty: Math.floor((sy + World.camY) / TS) };
  }
  const z = fieldPPU() / 32;         // hit boxes track the per-map camera distance
  const inBody = (tx, ty, halfW, top) => {
    const feet = fieldProject(tx, ty, 0);
    return sx >= feet.x - halfW * z && sx <= feet.x + halfW * z && sy <= feet.y + 6 * z && sy >= feet.y - top * z;
  };
  for (const npc of (G.map.npcs || [])) {
    if (inBody(npc.cx, npc.cy, 15, npc.actor === 'dog' ? 18 : 42)) return { tx: npc.cx, ty: npc.cy };
  }
  for (const spot of (G.map.interacts || [])) {
    if (inBody(spot.x, spot.y, 17, 40)) return { tx: spot.x, ty: spot.y };
  }
  const p = fieldUnproject(sx, sy);
  return { tx: Math.round(p.x), ty: Math.round(p.y) };
}

/** Tile to screen pixels — the 2D overlays (lantern, rift HUD) draw through this. */
function tileToScreen(tx, ty, height = 0) {
  if (gfxEnabled() && World.threeD) return fieldProject(tx, ty, height);
  return { x: tx * TS - World.camX + TS / 2, y: ty * TS - World.camY + TS / 2 };
}

// --------------------------------------------------------------------- draw

export function drawWorld(ctx) {
  World.threeD = gfxEnabled() && drawWorld3D(ctx, {
    mapId: G.mapId, map: G.map, player: G.player, actors: G.actors, time: G.time, rift: G.rift,
  });
  if (World.threeD) {
    if (G.map.dark) drawLantern(ctx, G.player);
    drawHud(ctx);
    drawRiftHud(ctx);
    drawOverlays(ctx);
    return;
  }
  drawWorld2D(ctx);
}

/** Flash, dialogue, notebook and controls sit on top of either renderer. */
function drawOverlays(ctx) {
  if (Cut.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, Cut.flash);
    ctx.fillStyle = PAL.B;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
  }
  drawDialogue(ctx);
  if (Notebook.open) drawNotebook(ctx);
  else if (!Dialog.active) drawControls(ctx, { pad: true, actionLabel: 'LOOK', menu: true, menuLabel: 'NOTE' });
}

function drawWorld2D(ctx) {
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

  drawRift(ctx, camX, camY);
  if (m.dark) drawLantern(ctx, p);
  drawHud(ctx);
  drawRiftHud(ctx);
  drawOverlays(ctx);
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
function drawLantern(ctx, p) {
  if (!shadowCv) {
    shadowCv = document.createElement('canvas');
    shadowCv.width = VIEW.width; shadowCv.height = VIEW.height;
  }
  const sctx = shadowCv.getContext('2d');
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, VIEW.width, VIEW.height);
  sctx.fillStyle = PAL.K;
  sctx.globalAlpha = 0.74;
  sctx.fillRect(0, 0, VIEW.width, VIEW.height);
  sctx.globalAlpha = 1;
  const centre = tileToScreen(p.px, p.py, 0.5);
  const cx = centre.x, cy = centre.y;
  const z = World.threeD ? fieldPPU() / 32 : 1;   // the light pool tracks the camera distance
  const grad = sctx.createRadialGradient(cx, cy, 16 * z, cx, cy, 128 * z);
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


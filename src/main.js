import { buildSprites, SPRITES } from './art/sprites.js';
import { buildTiles } from './art/tiles.js';
import { VIEW, inkPanel, text } from './engine/ui.js';
import { initInput, Input, endFrame } from './engine/input.js';
import { G, enterMap, loadSave, hasSave, clearSave, newTata } from './game/state.js';
import { updateWorld, drawWorld, World } from './game/world.js';
import { updateBattle, drawBattle, startBattle } from './game/battle.js';
import { updateInterrogation, drawInterrogation, Interro } from './game/interrogation.js';
import { Notebook } from './game/notebook.js';
import { Shop, updateShop, drawShop } from './game/shop.js';
import { Talk } from './game/talk.js';
import { Cut } from './game/cutscene.js';
import { showDialogue, Dialog } from './game/dialogue.js';
import { PAL } from './art/palette.js';
import { initGfx, gfxEnabled, setGfxEnabled } from './gfx/index.js';
import { initAudio, updateAudio, setMusic, sfx, soundOn, setSoundOn, suspendAudio, resumeAudio } from './engine/audio.js';
import { updateTransition, drawTransition } from './engine/fx.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

buildSprites();
buildTiles();
initGfx(VIEW.width, VIEW.height);   // 2.5D renderer; falls back to sprites on its own
initInput(canvas, VIEW);
initAudio();                        // arms itself on the first tap (mobile autoplay rules)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline play is a bonus, not a requirement */ });
}

// --- presentation: fit the 360x640 field to the device, integer scale first
function fit() {
  const availW = innerWidth, availH = innerHeight;
  const scale = Math.min(availW / VIEW.width, availH / VIEW.height);
  const snapped = scale >= 1 ? Math.floor(scale * 2) / 2 : scale;
  canvas.style.width = `${Math.round(VIEW.width * snapped)}px`;
  canvas.style.height = `${Math.round(VIEW.height * snapped)}px`;
}
addEventListener('resize', fit);
addEventListener('orientationchange', fit);
fit();

// ------------------------------------------------------------------- title
const TITLE_BTNS = [
  { id: 'new', label: 'NEW CASE', x: 60, y: 400, w: 240, h: 54 },
  { id: 'continue', label: 'CONTINUE', x: 60, y: 470, w: 240, h: 54 },
  // clear of the D-pad and A/NOTE hit zones, which classify() claims first
  { id: 'sound', x: 148, y: 598, w: 110, h: 34 },
];

let titleTime = 0;

function drawTitle(dt) {
  titleTime += dt;
  ctx.fillStyle = PAL.W;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // hatched night band, kept clear of the lettering — it drifts, slowly,
  // the way rain crosses a window
  const drift = Math.floor(titleTime * 6);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PAL.k;
  for (let i = 0; i < 90; i++) {
    ctx.fillRect((i * 37 + drift) % VIEW.width, 150 + (i % 18) * 9, 6 + (i % 4) * 5, 1);
  }
  ctx.globalAlpha = 1;

  const bob = Math.sin(titleTime * 1.6) * 2;
  const tata = SPRITES.tata.down[Math.floor(titleTime * 1.2) % 2 === 0 ? 0 : 2];
  ctx.drawImage(tata, VIEW.width / 2 - tata.width * 2, 170 + bob, tata.width * 4, tata.height * 4);
  const trav = SPRITES.traveler.down[0];
  ctx.globalAlpha = 0.75 + 0.15 * Math.sin(titleTime * 0.9);   // he is not quite there
  ctx.drawImage(trav, VIEW.width / 2 + 26, 150 - bob * 0.5, trav.width * 3, trav.height * 3);
  ctx.globalAlpha = 1;

  text(ctx, 'TATA', VIEW.width / 2, 60, { size: 40, align: 'center', bold: true });
  text(ctx, '& THE TRAVELER', VIEW.width / 2, 106, { size: 18, align: 'center', bold: true });
  text(ctx, 'Act I — The Whisper Under the Floorboards', VIEW.width / 2, 132, { size: 10, align: 'center', color: PAL.g });

  for (const b of TITLE_BTNS) {
    if (b.id === 'sound') {
      ctx.globalAlpha = 0.8;
      inkPanel(ctx, b.x, b.y, b.w, b.h);
      text(ctx, `SOUND ${soundOn() ? 'ON' : 'OFF'}`, b.x + b.w / 2, b.y + 11, { size: 11, align: 'center', bold: true });
      ctx.globalAlpha = 1;
      continue;
    }
    const dim = b.id === 'continue' && !hasSave();
    const hot = b.id === 'new' && !hasSave();
    ctx.globalAlpha = dim ? 0.4 : hot ? 0.85 + 0.15 * Math.sin(titleTime * 3) : 1;
    inkPanel(ctx, b.x, b.y, b.w, b.h);
    text(ctx, b.label, b.x + b.w / 2, b.y + 18, { size: 16, align: 'center', bold: true });
    ctx.globalAlpha = 1;
  }
  text(ctx, gfxEnabled() ? 'pre-rendered fields · low-poly cast · 3D battles' : 'pixel renderer (WebGL2 unavailable)',
    VIEW.width / 2, 552, { size: 9, align: 'center', color: PAL.g });
  text(ctx, 'tap to move · A to look · NOTE for the notebook', VIEW.width / 2, 570, { size: 9, align: 'center', color: PAL.g });
}

function updateTitle() {
  for (const tap of Input.taps) {
    for (const b of TITLE_BTNS) {
      if (tap.x < b.x || tap.x > b.x + b.w || tap.y < b.y || tap.y > b.y + b.h) continue;
      if (b.id === 'sound') { setSoundOn(!soundOn()); sfx('tap'); return; }
      sfx('confirm');
      if (b.id === 'new') startNewCase();
      else if (hasSave() && loadSave()) G.scene = 'world';
      return;
    }
  }
  if (Input.actionPressed) { sfx('confirm'); startNewCase(); }
}

function startNewCase() {
  clearSave();
  G.tata = newTata();
  G.flags = {};
  G.clues = [];
  G.items = { bandage: 3, tonic: 2 };
  G.tool = null;
  G.weapon = 'smg';
  G.weapons = { smg: true };
  G.coin = 0;
  G.quests = {};
  G.profiles = {};
  G.anomalies = [];
  G.lore = [];
  G.rift = null;
  G.steps = 0;
  enterMap('room', 4, 6, 'up');
  G.scene = 'world';
  World.notebook = false;
  showDialogue([
    'Late autumn. Tata is twelve, and reads detective novels the way other people pray.',
    'Under the floorboards, something taps. Three times. Then twice. Then once.',
    { who: 'Tata', text: 'That is not a pipe. Pipes have no opinions.' },
    'Walk onto the loose board by the window. (tap a tile, or use the pad)',
  ]);
}

// -------------------------------------------------------------------- loop
let last = performance.now();

/** Which track fits the moment. Ambience is a scene decision, made in one place. */
function sceneMusic() {
  if (G.scene === 'title') return 'title';
  if (G.scene === 'battle') return G.battle && G.battle.enemies.some((e) => e.boss) ? 'boss' : 'battle';
  if (G.scene === 'interrogation') return 'interro';
  if (G.scene === 'shop') return 'market';
  if (!G.map) return 'village';
  if (G.map.dark) return 'dark';
  if (G.mapId === 'forest') return 'forest';
  if (G.mapId === 'market') return 'market';
  return 'village';
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.scene === 'title') { updateTitle(); drawTitle(dt); }
  else if (G.scene === 'battle') { updateBattle(dt); drawBattle(ctx); }
  else if (G.scene === 'interrogation') { updateInterrogation(dt); drawInterrogation(ctx); }
  else if (G.scene === 'shop') { updateShop(dt); drawShop(ctx); }
  else { updateWorld(dt); drawWorld(ctx); }

  updateTransition(dt);
  drawTransition(ctx);          // ink over everything, including the controls
  setMusic(sceneMusic());
  updateAudio();

  endFrame();
  requestAnimationFrame(frame);
}

// Backgrounded tab: stop the clock cleanly and pick it up without a lurch.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspendAudio();
  else { last = performance.now(); resumeAudio(); }
});

// handy while prototyping: inspect live state from the console
window.TATA = G;
window.TATA_DEBUG = { Dialog, Cut, World, Notebook, Talk, Interro, Shop, warp: enterMap, fight: startBattle };
// TATA_GFX.set(false) drops back to the Phase 1/2 pixel renderer at any time
window.TATA_GFX = { enabled: gfxEnabled, set: setGfxEnabled };
window.TATA_AUDIO = { on: soundOn, set: setSoundOn, sfx };

requestAnimationFrame(frame);

import { buildSprites, SPRITES } from './art/sprites.js';
import { buildTiles } from './art/tiles.js';
import { VIEW, inkPanel, text } from './engine/ui.js';
import { initInput, Input, endFrame } from './engine/input.js';
import { G, enterMap, loadSave, hasSave, clearSave, newTata } from './game/state.js';
import { updateWorld, drawWorld, World } from './game/world.js';
import { updateBattle, drawBattle } from './game/battle.js';
import { updateInterrogation, drawInterrogation, Interro } from './game/interrogation.js';
import { Notebook } from './game/notebook.js';
import { Talk } from './game/talk.js';
import { Cut } from './game/cutscene.js';
import { showDialogue, Dialog } from './game/dialogue.js';
import { PAL } from './art/palette.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

buildSprites();
buildTiles();
initInput(canvas, VIEW);

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
];

function drawTitle() {
  ctx.fillStyle = PAL.W;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // hatched night band, kept clear of the lettering
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PAL.k;
  for (let i = 0; i < 90; i++) ctx.fillRect((i * 37) % VIEW.width, 150 + (i % 18) * 9, 6 + (i % 4) * 5, 1);
  ctx.globalAlpha = 1;

  const tata = SPRITES.tata.down[0];
  ctx.drawImage(tata, VIEW.width / 2 - tata.width * 2, 170, tata.width * 4, tata.height * 4);
  const trav = SPRITES.traveler.down[0];
  ctx.globalAlpha = 0.85;
  ctx.drawImage(trav, VIEW.width / 2 + 26, 150, trav.width * 3, trav.height * 3);
  ctx.globalAlpha = 1;

  text(ctx, 'TATA', VIEW.width / 2, 60, { size: 40, align: 'center', bold: true });
  text(ctx, '& THE TRAVELER', VIEW.width / 2, 106, { size: 18, align: 'center', bold: true });
  text(ctx, 'Act I — The Whisper Under the Floorboards', VIEW.width / 2, 132, { size: 10, align: 'center', color: PAL.g });

  for (const b of TITLE_BTNS) {
    const dim = b.id === 'continue' && !hasSave();
    ctx.globalAlpha = dim ? 0.4 : 1;
    inkPanel(ctx, b.x, b.y, b.w, b.h);
    text(ctx, b.label, b.x + b.w / 2, b.y + 18, { size: 16, align: 'center', bold: true });
    ctx.globalAlpha = 1;
  }
  text(ctx, 'Phase 1 prototype — movement, combat, one village, one dungeon', VIEW.width / 2, 552, { size: 9, align: 'center', color: PAL.g });
  text(ctx, 'tap to move · A to look · NOTE for the notebook', VIEW.width / 2, 570, { size: 9, align: 'center', color: PAL.g });
}

function updateTitle() {
  for (const tap of Input.taps) {
    for (const b of TITLE_BTNS) {
      if (tap.x < b.x || tap.x > b.x + b.w || tap.y < b.y || tap.y > b.y + b.h) continue;
      if (b.id === 'new') startNewCase();
      else if (hasSave() && loadSave()) G.scene = 'world';
      return;
    }
  }
  if (Input.actionPressed) startNewCase();
}

function startNewCase() {
  clearSave();
  G.tata = newTata();
  G.flags = {};
  G.clues = [];
  G.items = { bandage: 3, tonic: 2 };
  G.tool = null;
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

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (G.scene === 'title') { updateTitle(); drawTitle(); }
  else if (G.scene === 'battle') { updateBattle(dt); drawBattle(ctx); }
  else if (G.scene === 'interrogation') { updateInterrogation(dt); drawInterrogation(ctx); }
  else { updateWorld(dt); drawWorld(ctx); }

  endFrame();
  requestAnimationFrame(frame);
}

// handy while prototyping: inspect live state from the console
window.TATA = G;
window.TATA_DEBUG = { Dialog, Cut, World, Notebook, Talk, Interro };

requestAnimationFrame(frame);

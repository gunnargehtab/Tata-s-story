import { PAL } from '../art/palette.js';
import { inkPanel, text, wrap, VIEW } from '../engine/ui.js';
import { Input } from '../engine/input.js';
import { sfx } from '../engine/audio.js';

/*
 * Notebook-style dialogue box: typewriter reveal, tap to advance,
 * tap again mid-line to reveal it instantly.
 */
export const Dialog = {
  active: false,
  queue: [],
  who: '',
  body: '',
  revealed: 0,
  timer: 0,
  onDone: null,
  choices: null,      // [{label, hint}] once the line has finished revealing
  onChoice: null,
  cursor: 0,
  rects: [],
  navTimer: 0,
};

const CPS = 52; // characters per second

export function showDialogue(lines, onDone = null) {
  Dialog.queue = lines.map((l) => (typeof l === 'string' ? { who: '', text: l } : l));
  Dialog.active = Dialog.queue.length > 0;
  Dialog.choices = null;
  Dialog.onChoice = null;
  Dialog.onDone = onDone;
  next();
}

/**
 * A line that ends in a fork. `choices` are [{label, hint}]; `onPick` gets the
 * chosen index once the player commits. This is the spine of Phase 2 dialogue.
 */
export function showChoices(who, body, choices, onPick) {
  Dialog.queue = [];
  Dialog.active = true;
  Dialog.who = who || '';
  Dialog.body = body;
  Dialog.revealed = 0;
  Dialog.timer = 0;
  Dialog.choices = choices;
  Dialog.cursor = 0;
  Dialog.navTimer = 0;
  Dialog.onChoice = onPick;
  Dialog.onDone = null;
}

function next() {
  const entry = Dialog.queue.shift();
  if (!entry) {
    Dialog.active = false;
    const cb = Dialog.onDone;
    Dialog.onDone = null;
    if (cb) cb();
    return;
  }
  Dialog.who = entry.who || '';
  Dialog.body = entry.text;
  Dialog.revealed = 0;
  Dialog.timer = 0;
}

export function updateDialogue(dt) {
  if (!Dialog.active) return;
  Dialog.timer += dt;
  const full = Dialog.body.length;
  Dialog.revealed = Math.min(full, Math.floor(Dialog.timer * CPS));
  const done = Dialog.revealed >= full;

  if (Dialog.choices && done) return updateChoices(dt);

  const pressed = Input.actionPressed || Input.taps.length > 0;
  if (!pressed) return;
  if (!done) {
    // skip the typewriter by fast-forwarding the clock, not the counter,
    // or the next frame would recompute it back down
    Dialog.timer = full / CPS;
    Dialog.revealed = full;
  } else if (!Dialog.choices) { sfx('dialog'); next(); }
}

function updateChoices(dt) {
  Dialog.navTimer -= dt;
  if (Input.dir && Dialog.navTimer <= 0) {
    Dialog.navTimer = 0.18;
    if (Input.dir === 'down') Dialog.cursor = (Dialog.cursor + 1) % Dialog.choices.length;
    if (Input.dir === 'up') Dialog.cursor = (Dialog.cursor - 1 + Dialog.choices.length) % Dialog.choices.length;
  }
  let pick = -1;
  for (const tap of Input.taps) {
    const hit = Dialog.rects.find((r) => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h);
    if (hit) pick = hit.index;
  }
  if (Input.actionPressed) pick = Dialog.cursor;
  if (pick < 0) return;
  sfx('confirm');
  const cb = Dialog.onChoice;
  Dialog.active = false;
  Dialog.choices = null;
  Dialog.onChoice = null;
  if (cb) cb(pick);
}

export function drawDialogue(ctx) {
  if (!Dialog.active) return;
  if (Dialog.choices) return drawChoiceBox(ctx);
  const h = 150;
  const y = VIEW.height - h - 10;
  inkPanel(ctx, 8, y, VIEW.width - 16, h);
  let ty = y + 18;
  if (Dialog.who) {
    text(ctx, Dialog.who, 24, ty, { size: 12, bold: true });
    ty += 20;
  }
  const shown = Dialog.body.slice(0, Dialog.revealed);
  wrap(ctx, shown, VIEW.width - 60, 13).slice(0, 5).forEach((line, i) => {
    text(ctx, line, 24, ty + i * 19, { size: 13 });
  });
  if (Dialog.revealed >= Dialog.body.length) {
    const blink = (performance.now() % 900) < 550;
    text(ctx, blink ? 'tap anywhere to continue ▼' : 'tap anywhere to continue', VIEW.width - 30, y + h - 26,
      { size: 10, align: 'right', color: PAL.g });
  }
}

function drawChoiceBox(ctx) {
  const rows = Dialog.choices.length;
  const h = 132 + rows * 32;
  const y = VIEW.height - h - 10;
  Dialog.rects = [];
  inkPanel(ctx, 8, y, VIEW.width - 16, h);

  let ty = y + 16;
  if (Dialog.who) { text(ctx, Dialog.who, 24, ty, { size: 12, bold: true }); ty += 20; }
  const shown = Dialog.body.slice(0, Dialog.revealed);
  wrap(ctx, shown, VIEW.width - 60, 13).slice(0, 4).forEach((line, i) => {
    text(ctx, line, 24, ty + i * 19, { size: 13 });
  });

  if (Dialog.revealed < Dialog.body.length) {
    text(ctx, 'tap to skip', VIEW.width - 30, y + h - 22, { size: 10, align: 'right', color: PAL.g });
    return;
  }

  let cy = y + h - rows * 32 - 12;
  ctx.fillStyle = PAL.K;
  ctx.fillRect(24, cy - 10, VIEW.width - 48, 1);
  Dialog.choices.forEach((choice, i) => {
    const on = i === Dialog.cursor;
    if (on) { ctx.fillStyle = PAL.K; ctx.fillRect(20, cy + 6, 8, 8); }
    text(ctx, choice.label, 36, cy, { size: 13, bold: on });
    if (choice.hint) text(ctx, choice.hint, VIEW.width - 30, cy + 2, { size: 9, align: 'right', color: PAL.g });
    Dialog.rects.push({ index: i, x: 16, y: cy - 6, w: VIEW.width - 40, h: 30 });
    cy += 32;
  });
}

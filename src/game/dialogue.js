import { PAL } from '../art/palette.js';
import { inkPanel, text, wrap, VIEW } from '../engine/ui.js';
import { Input } from '../engine/input.js';

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
};

const CPS = 52; // characters per second

export function showDialogue(lines, onDone = null) {
  Dialog.queue = lines.map((l) => (typeof l === 'string' ? { who: '', text: l } : l));
  Dialog.active = Dialog.queue.length > 0;
  Dialog.onDone = onDone;
  next();
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
  const pressed = Input.actionPressed || Input.taps.length > 0;
  if (!pressed) return;
  if (Dialog.revealed < full) {
    // skip the typewriter by fast-forwarding the clock, not the counter,
    // or the next frame would recompute it back down
    Dialog.timer = full / CPS;
    Dialog.revealed = full;
  } else next();
}

export function drawDialogue(ctx) {
  if (!Dialog.active) return;
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

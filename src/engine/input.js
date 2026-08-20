/*
 * Touch-first input. Two ways to move, both supported at once:
 *   - the ink D-pad in the bottom-left (hold to walk)
 *   - tapping a tile in the world (walks a path to it, gameplan §4 "tap to move")
 * Keyboard is mirrored for desktop testing.
 */

export const Input = {
  dir: null,            // held direction from D-pad / keys
  taps: [],             // queued logical-space taps {x, y}
  actionPressed: false, // A button / Space this frame
  menuPressed: false,   // notebook button
  _keys: new Set(),
  _pointers: new Map(),
};

let canvas, view;

// On-screen buttons in logical pixels; the renderer draws these same rects.
export const PAD = {
  up: { x: 52, y: 512, w: 44, h: 44, dir: 'up' },
  down: { x: 52, y: 600, w: 44, h: 44, dir: 'down' },
  left: { x: 8, y: 556, w: 44, h: 44, dir: 'left' },
  right: { x: 96, y: 556, w: 44, h: 44, dir: 'right' },
};
export const BTN = {
  action: { x: 272, y: 560, w: 76, h: 64, id: 'action' },
  menu: { x: 272, y: 512, w: 76, h: 42, id: 'menu' },
};

function toLogical(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * view.width,
    y: ((ev.clientY - r.top) / r.height) * view.height,
  };
}

const hit = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

function classify(p) {
  for (const key of Object.keys(PAD)) if (hit(p, PAD[key])) return { kind: 'pad', dir: PAD[key].dir };
  for (const key of Object.keys(BTN)) if (hit(p, BTN[key])) return { kind: 'btn', id: BTN[key].id };
  return { kind: 'world', x: p.x, y: p.y };
}

function refreshDir() {
  let dir = null;
  for (const info of Input._pointers.values()) if (info.kind === 'pad') dir = info.dir;
  if (!dir) {
    if (Input._keys.has('ArrowUp') || Input._keys.has('KeyW')) dir = 'up';
    else if (Input._keys.has('ArrowDown') || Input._keys.has('KeyS')) dir = 'down';
    else if (Input._keys.has('ArrowLeft') || Input._keys.has('KeyA')) dir = 'left';
    else if (Input._keys.has('ArrowRight') || Input._keys.has('KeyD')) dir = 'right';
  }
  Input.dir = dir;
}

export function initInput(cv, viewport) {
  canvas = cv;
  view = viewport;

  const down = (ev) => {
    ev.preventDefault();
    const p = toLogical(ev);
    const info = classify(p);
    Input._pointers.set(ev.pointerId, info);
    if (info.kind === 'btn') {
      if (info.id === 'action') Input.actionPressed = true;
      if (info.id === 'menu') Input.menuPressed = true;
    } else if (info.kind === 'world') {
      Input.taps.push({ x: info.x, y: info.y });
    }
    refreshDir();
  };
  const move = (ev) => {
    if (!Input._pointers.has(ev.pointerId)) return;
    const prev = Input._pointers.get(ev.pointerId);
    if (prev.kind !== 'pad') return;         // only the D-pad tracks drags
    const info = classify(toLogical(ev));
    if (info.kind === 'pad') Input._pointers.set(ev.pointerId, info);
    refreshDir();
  };
  const up = (ev) => {
    Input._pointers.delete(ev.pointerId);
    refreshDir();
  };

  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (['Space', 'Enter'].includes(e.code)) Input.actionPressed = true;
    if (e.code === 'KeyN' || e.code === 'Tab') { Input.menuPressed = true; e.preventDefault(); }
    if (e.code.startsWith('Arrow')) e.preventDefault();
    Input._keys.add(e.code);
    refreshDir();
  });
  addEventListener('keyup', (e) => { Input._keys.delete(e.code); refreshDir(); });
  addEventListener('blur', () => { Input._keys.clear(); Input._pointers.clear(); refreshDir(); });
}

/** Called at the end of every frame: edge-triggered flags last exactly one frame. */
export function endFrame() {
  Input.actionPressed = false;
  Input.menuPressed = false;
  Input.taps.length = 0;
}

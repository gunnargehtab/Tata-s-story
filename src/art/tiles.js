import { PAL } from './palette.js';

export const TILE = 16;

/*
 * Tiles are drawn procedurally rather than hand-pixelled: heavy ink strokes on
 * paper, sparse hatching, blocky shapes. Each tile is baked once into a canvas.
 */

// Deterministic noise so hatching never shimmers between frames.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hatch(ctx, x, y, w, h, count, seed, color = PAL.K) {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const px = x + Math.floor(r() * w);
    const py = y + Math.floor(r() * h);
    const len = 1 + Math.floor(r() * 3);
    ctx.fillRect(px, py, len, 1);
  }
}

const PAINTERS = {
  // grass
  '.': (c, v) => {
    c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 16);
    // sparse grass ticks, two or three pen flicks per tile
    const r = rng(11 + v * 97);
    c.fillStyle = PAL.G;
    for (let i = 0; i < 2 + (v % 2); i++) {
      const x = 1 + Math.floor(r() * 13), y = 2 + Math.floor(r() * 12);
      c.fillRect(x, y, 1, 2);
      c.fillRect(x + 2, y - 1, 1, 3);
    }
  },
  // trodden path
  ',': (c, v) => { c.fillStyle = PAL.w; c.fillRect(0, 0, 16, 16); hatch(c, 0, 0, 16, 16, 2 + (v % 3), 23 + v * 71, PAL.g); },
  // stone wall / cliff
  '#': (c) => {
    c.fillStyle = PAL.G; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    c.fillRect(0, 0, 16, 1); c.fillRect(0, 15, 16, 1);
    c.fillRect(0, 0, 1, 16); c.fillRect(15, 0, 1, 16);
    c.fillRect(0, 7, 16, 1); c.fillRect(7, 0, 1, 8); c.fillRect(4, 8, 1, 8); c.fillRect(11, 8, 1, 8);
    hatch(c, 1, 1, 14, 14, 8, 37, PAL.g);
  },
  // tree
  T: (c, v) => {
    c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    const lean = (v % 3) - 1;
    c.fillRect(3 + lean, 1, 10, 9); c.fillRect(2 + lean, 3, 12, 5);
    c.fillRect(6, 9, 3, 6);                       // trunk
    c.fillStyle = PAL.W; hatch(c, 4, 2, 8, 6, 5 + (v % 3), 53 + v * 31, PAL.W);
  },
  // house wall
  h: (c, v) => {
    // whitewash: reads as one wall mass, not a grid of boxes
    c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K; c.fillRect(0, 14, 16, 2);
    c.fillStyle = PAL.w;
    c.fillRect(v % 2 ? 4 : 10, 0, 1, 14);
    hatch(c, 1, 2, 14, 11, 5, 71 + v * 41, PAL.w);
  },
  // roof
  '^': (c) => {
    c.fillStyle = PAL.K; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.W;
    for (let y = 1; y < 16; y += 4) c.fillRect(0, y, 16, 1);
  },
  // door
  D: (c) => {
    c.fillStyle = PAL.t; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    c.fillRect(0, 0, 16, 2); c.fillRect(0, 0, 2, 16); c.fillRect(14, 0, 2, 16); c.fillRect(0, 14, 16, 2);
    c.fillRect(8, 7, 2, 2);
  },
  // water
  w: (c) => {
    c.fillStyle = PAL.b; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.B;
    c.fillRect(1, 3, 6, 1); c.fillRect(9, 7, 5, 1); c.fillRect(3, 11, 7, 1);
  },
  // the old well
  O: (c) => {
    c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 16);
    // stone rim
    c.fillStyle = PAL.K; c.fillRect(1, 5, 14, 10);
    c.fillStyle = PAL.G; c.fillRect(2, 6, 12, 8);
    c.fillStyle = PAL.g;
    c.fillRect(2, 9, 12, 1); c.fillRect(6, 6, 1, 3); c.fillRect(10, 10, 1, 4);
    // the mouth
    c.fillStyle = PAL.K; c.fillRect(4, 7, 8, 6);
    // frame and rope
    c.fillStyle = PAL.K;
    c.fillRect(1, 1, 2, 5); c.fillRect(13, 1, 2, 5); c.fillRect(1, 1, 14, 2);
    c.fillRect(7, 3, 1, 5);
  },
  // plank floor
  '=': (c) => {
    c.fillStyle = PAL.T; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.t;
    c.fillRect(0, 5, 16, 1); c.fillRect(0, 11, 16, 1); c.fillRect(6, 0, 1, 5); c.fillRect(11, 6, 1, 5);
  },
  // the loose board — prised up once already
  '{': (c) => {
    c.fillStyle = PAL.T; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.t;
    c.fillRect(0, 5, 16, 1); c.fillRect(0, 11, 16, 1);
    c.fillStyle = PAL.K;
    c.fillRect(2, 6, 12, 5); c.fillRect(2, 6, 12, 1);
    c.fillStyle = PAL.B; c.fillRect(6, 8, 4, 2);
  },
  // dungeon floor (damp brick)
  '-': (c, v) => {
    c.fillStyle = PAL.w; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.g;
    c.fillRect(0, 7, 16, 1);
    c.fillRect(v % 2 ? 7 : 11, 0, 1, 8);
    c.fillRect(v % 2 ? 3 : 5, 8, 1, 8);
    hatch(c, 0, 0, 16, 16, 3 + (v % 3), 97 + v * 53, PAL.G);
  },
  // stairs down
  '>': (c) => {
    c.fillStyle = PAL.G; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    for (let i = 0; i < 4; i++) { c.fillRect(i * 2, 4 + i * 3, 16 - i * 4, 2); }
    c.fillRect(0, 0, 16, 1); c.fillRect(0, 15, 16, 1);
  },
  // stairs up
  '<': (c) => {
    c.fillStyle = PAL.G; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    for (let i = 0; i < 4; i++) { c.fillRect(6 - i * 2, 13 - i * 3, 4 + i * 4, 2); }
    c.fillRect(0, 0, 16, 1); c.fillRect(0, 15, 16, 1);
  },
  // rift-torn ground
  '*': (c) => {
    c.fillStyle = PAL.b; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.B;
    c.fillRect(3, 2, 2, 4); c.fillRect(7, 5, 2, 6); c.fillRect(11, 3, 2, 5); c.fillRect(5, 12, 6, 2);
    c.fillStyle = PAL.K; c.fillRect(0, 0, 16, 1); c.fillRect(0, 15, 16, 1);
  },
  // rubble
  'r': (c) => {
    c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    c.fillRect(2, 9, 5, 5); c.fillRect(8, 6, 6, 4); c.fillRect(6, 12, 7, 3);
  },
  // fence
  'f': (c) => {
    c.fillStyle = PAL.W; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.K;
    c.fillRect(0, 6, 16, 2); c.fillRect(0, 11, 16, 2);
    c.fillRect(3, 3, 2, 12); c.fillRect(11, 3, 2, 12);
  },
  // crate / market stall
  'c': (c) => {
    c.fillStyle = PAL.T; c.fillRect(1, 3, 14, 12);
    c.fillStyle = PAL.K;
    c.fillRect(1, 3, 14, 1); c.fillRect(1, 14, 14, 1); c.fillRect(1, 3, 1, 12); c.fillRect(14, 3, 1, 12);
    c.fillRect(1, 8, 14, 1);
  },
  // archive shelf
  'B': (c) => {
    c.fillStyle = PAL.t; c.fillRect(0, 0, 16, 16);
    c.fillStyle = PAL.W;
    for (let x = 1; x < 15; x += 3) c.fillRect(x, 2, 2, 5);
    for (let x = 2; x < 15; x += 3) c.fillRect(x, 9, 2, 5);
    c.fillStyle = PAL.K; c.fillRect(0, 7, 16, 2); c.fillRect(0, 14, 16, 2);
  },
};

export const TILESET = {};
const VARIANTS = 4;   // ground tiles get a few passes so hatching doesn't tile visibly

export function buildTiles() {
  for (const [key, paint] of Object.entries(PAINTERS)) {
    TILESET[key] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const cv = document.createElement('canvas');
      cv.width = TILE; cv.height = TILE;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      paint(ctx, v);
      TILESET[key].push(cv);
    }
  }
}

/** Stable per-position variant pick. */
export function tileArt(ch, x, y) {
  const set = TILESET[ch] || TILESET['.'];
  return set[((x * 7 + y * 13) % set.length + set.length) % set.length];
}

// Tiles a body can stand on.
const WALKABLE = new Set(['.', ',', 'D', '=', '{', '-', '>', '<', '*']);
export const isWalkable = (ch) => WALKABLE.has(ch);

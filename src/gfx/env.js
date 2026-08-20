/*
 * Turns a tile map into environment geometry. This is the "Blender pass" of the
 * FFVII pipeline done in code: the map is modelled once in 3D, then baked to a
 * flat image plus a depth buffer (see field.js) and never re-rendered.
 *
 * One tile = one world unit; the tile at (tx, ty) is centred on (tx+0.5, ty+0.5).
 */
import { MeshBuilder } from './mesh.js';
import { isWalkable } from '../art/tiles.js';
import { PAL } from '../art/palette.js';

const WALL_H = 1.5;
const HOUSE_H = 1.7;
const CUT_H = 0.42;      // height a near-side wall is trimmed to

/*
 * The camera looks from the south, so a wall on the south side of a room stands
 * between the lens and the floor behind it. FFVII solved that by simply not
 * modelling those walls; here they are trimmed to knee height instead, which
 * keeps the enclosure readable and lets the depth buffer do the rest.
 */
const CUTTABLE = new Set(['h', 'D', '#']);
function isNearWall(map, tx, ty) {
  if (!CUTTABLE.has(map.grid[ty][tx]) || ty === 0) return false;
  return isWalkable(map.grid[ty - 1][tx]);
}

/** Deterministic per-tile noise, so a re-bake looks identical. */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Ground tones are pulled a little off the paper white so the village reads at a
// glance: grass sits green-grey, trodden path sits warm.
const GRASS = '#dfe0c8';
const PATH = '#d8cbb0';

const GROUND = {
  '.': GRASS, ',': PATH, '#': '#6f6a62', T: PAL.W, h: PAL.w, '^': PAL.w,
  D: PATH, w: '#2f4a63', O: PATH, '=': PAL.T, '{': PAL.T,
  '-': '#776d62', '>': '#776d62', '<': '#776d62', '*': '#2d4e7a',
  r: '#776d62', f: GRASS, c: GRASS, B: PAL.T,
};

const TILE_BUILDERS = {
  // grass: paper, with two or three pen-flick tufts
  '.'(b, x, z, r) {
    b.color('#6f7d55');
    for (let i = 0; i < 1 + Math.floor(r() * 2); i++) {
      b.card({ x: x + r() - 0.5, y: 0.001, z: z + r() - 0.5, w: 0.09, h: 0.12 + r() * 0.10, ry: r() * 3 });
    }
  },
  // trodden path: hatch ticks lying on the ground
  ','(b, x, z, r) {
    b.color('#b9ab8c');
    for (let i = 0; i < 3; i++) {
      b.plane({ x: x + r() - 0.5, y: 0.002, z: z + r() - 0.5, w: 0.16 + r() * 0.1, d: 0.03 });
    }
  },
  '#'(b, x, z, r, cut) {
    if (cut) {
      b.color('#6c655c').box({ x, y: CUT_H / 2, z, w: 1.0, h: CUT_H, d: 1.0, skipBottom: true });
      b.color(PAL.g).box({ x, y: CUT_H + 0.01, z, w: 1.0, h: 0.03, d: 1.0 });          // capstone
      b.color(PAL.K).box({ x, y: CUT_H - 0.02, z: z + 0.5, w: 1.02, h: 0.06, d: 0.04 });
      return;
    }
    b.color('#6c655c').box({ x, y: WALL_H / 2, z, w: 1.0, h: WALL_H, d: 1.0, taperX: 0.94, taperZ: 0.94, skipBottom: true });
    b.color(PAL.g);
    // course lines, cut a couple of blocks so the wall reads as masonry
    for (let i = 1; i <= 2; i++) {
      b.box({ x, y: (WALL_H / 3) * i, z: z + 0.5, w: 0.98, h: 0.03, d: 0.02 });
      b.box({ x: x + 0.5, y: (WALL_H / 3) * i, z, w: 0.02, h: 0.03, d: 0.98 });
    }
    if (r() > 0.6) b.color('#6a6259').box({ x: x + r() * 0.4 - 0.2, y: WALL_H - 0.1, z, w: 0.3, h: 0.2, d: 1.02 });
  },
  T(b, x, z, r) {
    const lean = (r() - 0.5) * 0.16;
    const h = 1.5 + r() * 0.5;
    b.color(PAL.t).cylinder({ x, y: h * 0.35, z, r: 0.11, rTop: 0.08, h: h * 0.7, segments: 6, ry: r() });
    b.color('#3b4a34');
    b.box({ x: x + lean, y: h * 0.78, z, w: 0.92, h: 0.5, d: 0.92, taperX: 0.6, taperZ: 0.6, rz: lean });
    b.color('#2c3a28');
    b.box({ x: x + lean * 1.6, y: h * 1.05, z, w: 0.62, h: 0.44, d: 0.62, taperX: 0.35, taperZ: 0.35, rz: lean });
    b.color(PAL.K).box({ x: x + lean * 2, y: h * 1.22, z, w: 0.22, h: 0.16, d: 0.22, taperX: 0.2, taperZ: 0.2 });
  },
  h(b, x, z, r, cut) {
    if (cut) return cutWall(b, x, z);
    b.color(PAL.W).box({ x, y: HOUSE_H / 2, z, w: 1.0, h: HOUSE_H, d: 1.0, skipBottom: true });
    b.color(PAL.K);
    // ink trim, drawn as thin slabs on the visible faces only — a full-depth box
    // here would read as a black roof from the three-quarter camera
    b.box({ x, y: HOUSE_H - 0.06, z: z + 0.5, w: 1.02, h: 0.09, d: 0.04 });   // eave line
    b.box({ x, y: 0.07, z: z + 0.5, w: 1.02, h: 0.10, d: 0.04 });             // base line
    b.color(PAL.w).box({ x, y: HOUSE_H + 0.005, z, w: 1.0, h: 0.02, d: 1.0 }); // wall top
    b.color(PAL.t).box({ x, y: HOUSE_H * 0.62, z: z + 0.5, w: 0.34, h: 0.34, d: 0.06 });  // shutter
  },
  '^'(b, x, z) {
    b.color(PAL.W).box({ x, y: HOUSE_H / 2, z, w: 1.0, h: HOUSE_H, d: 1.0, skipBottom: true });
    b.color('#7a4a2c').prism({ x, y: HOUSE_H + 0.28, z, w: 1.0, h: 0.56, d: 1.0, overhang: 0.12 });
    b.color(PAL.K).box({ x, y: HOUSE_H + 0.56, z, w: 0.10, h: 0.05, d: 1.24 });   // ridge ink
  },
  D(b, x, z, r, cut) {
    if (cut) {
      // near-side doorway: low jambs and a threshold, nothing to look over
      b.color(PAL.W).box({ x: x - 0.38, y: CUT_H / 2, z, w: 0.24, h: CUT_H, d: 1.0, skipBottom: true });
      b.color(PAL.W).box({ x: x + 0.38, y: CUT_H / 2, z, w: 0.24, h: CUT_H, d: 1.0, skipBottom: true });
      b.color(PAL.w).box({ x: x - 0.38, y: CUT_H + 0.01, z, w: 0.24, h: 0.03, d: 1.0 });
      b.color(PAL.w).box({ x: x + 0.38, y: CUT_H + 0.01, z, w: 0.24, h: 0.03, d: 1.0 });
      b.color(PAL.K).box({ x: x - 0.38, y: CUT_H - 0.02, z: z + 0.5, w: 0.26, h: 0.06, d: 0.04 });
      b.color(PAL.K).box({ x: x + 0.38, y: CUT_H - 0.02, z: z + 0.5, w: 0.26, h: 0.06, d: 0.04 });
      b.color(PAL.t).box({ x, y: 0.03, z, w: 0.54, h: 0.06, d: 0.9 });
      return;
    }
    // doorway: two jambs and a lintel, so she can actually walk through it
    b.color(PAL.W);
    b.box({ x: x - 0.38, y: HOUSE_H / 2, z, w: 0.24, h: HOUSE_H, d: 1.0, skipBottom: true });
    b.box({ x: x + 0.38, y: HOUSE_H / 2, z, w: 0.24, h: HOUSE_H, d: 1.0, skipBottom: true });
    b.box({ x, y: HOUSE_H - 0.22, z, w: 1.0, h: 0.44, d: 1.0, skipBottom: true });
    b.color(PAL.t).box({ x, y: 0.62, z: z - 0.30, w: 0.56, h: 1.24, d: 0.08 });
    b.color(PAL.K).box({ x, y: 1.34, z: z + 0.5, w: 1.04, h: 0.09, d: 0.04 });
    b.color(PAL.Y).box({ x: x + 0.42, y: 1.34, z: z + 0.46, w: 0.10, h: 0.14, d: 0.10 });  // door lantern
  },
  w(b, x, z, r) {
    b.color('#3c5f7d');
    for (let i = 0; i < 2; i++) b.plane({ x: x + r() - 0.5, y: 0.02, z: z + r() - 0.5, w: 0.4, d: 0.03 });
  },
  O(b, x, z) {
    b.color('#0b0d12').plane({ x, y: 0.02, z, w: 0.72, d: 0.72 });                    // the dark down there
    b.color('#7d7469').cylinder({ x, y: 0.26, z, r: 0.50, h: 0.52, segments: 10, caps: false });
    b.color(PAL.g).cylinder({ x, y: 0.50, z, r: 0.52, rTop: 0.46, h: 0.10, segments: 10 });
    b.color(PAL.t);
    b.box({ x: x - 0.42, y: 0.75, z, w: 0.09, h: 1.0, d: 0.09 });
    b.box({ x: x + 0.42, y: 0.75, z, w: 0.09, h: 1.0, d: 0.09 });
    b.box({ x, y: 1.22, z, w: 1.02, h: 0.10, d: 0.12 });
    b.color(PAL.K).box({ x, y: 1.02, z, w: 0.03, h: 0.30, d: 0.03 });                 // rope
    b.color(PAL.G).cylinder({ x, y: 0.84, z, r: 0.13, h: 0.16, segments: 6 });        // bucket
  },
  '='(b, x, z, r) {
    b.color(PAL.t);
    for (let i = -1; i <= 1; i++) b.plane({ x, y: 0.002, z: z + i * 0.33, w: 0.98, d: 0.03 });
    if (r() > 0.8) b.color(PAL.k).plane({ x, y: 0.003, z, w: 0.2, d: 0.02 });
  },
  '{'(b, x, z) {
    b.color(PAL.t);
    for (let i = -1; i <= 1; i++) b.plane({ x, y: 0.002, z: z + i * 0.33, w: 0.98, d: 0.03 });
    b.color('#6b4526').box({ x, y: 0.06, z, w: 0.86, h: 0.10, d: 0.30, rz: 0.06 });   // the prised-up board
    b.color('#120f0c').plane({ x, y: 0.012, z: z + 0.28, w: 0.8, d: 0.16 });
  },
  '-'(b, x, z, r) {
    if (r() > 0.75) b.color(PAL.g).plane({ x: x + r() - 0.5, y: 0.002, z: z + r() - 0.5, w: 0.3, d: 0.04 });
  },
  '>'(b, x, z) { steps(b, x, z, -1); },
  '<'(b, x, z) { steps(b, x, z, 1); },
  '*'(b, x, z, r) {
    b.color(PAL.B).plane({ x, y: 0.01, z, w: 0.94, d: 0.94 });
    b.color(PAL.b);
    for (let i = 0; i < 2; i++) {
      b.card({ x: x + (r() - 0.5) * 0.6, y: 0.01, z: z + (r() - 0.5) * 0.6, w: 0.12, h: 0.28 + r() * 0.3, ry: r() * 3 });
    }
  },
  r(b, x, z, r) {
    b.color('#6f6a62');
    for (let i = 0; i < 4; i++) {
      const s = 0.16 + r() * 0.18;
      b.box({ x: x + (r() - 0.5) * 0.6, y: s / 2, z: z + (r() - 0.5) * 0.6, w: s, h: s, d: s, ry: r() * 3 });
    }
  },
  f(b, x, z) {
    b.color(PAL.t);
    b.box({ x: x - 0.4, y: 0.32, z, w: 0.09, h: 0.64, d: 0.09 });
    b.box({ x: x + 0.4, y: 0.32, z, w: 0.09, h: 0.64, d: 0.09 });
    b.box({ x, y: 0.50, z, w: 1.0, h: 0.07, d: 0.05 });
    b.box({ x, y: 0.28, z, w: 1.0, h: 0.07, d: 0.05 });
  },
  c(b, x, z, r) {
    b.color(PAL.T).box({ x, y: 0.30, z, w: 0.72, h: 0.60, d: 0.72, ry: (r() - 0.5) * 0.4 });
    b.color(PAL.t).box({ x, y: 0.58, z, w: 0.76, h: 0.06, d: 0.76 });
    if (r() > 0.5) {
      b.color(PAL.T).box({ x: x + 0.1, y: 0.82, z: z - 0.06, w: 0.52, h: 0.44, d: 0.52, ry: r() });
    }
  },
  B(b, x, z, r) {
    b.color(PAL.t).box({ x, y: 0.70, z, w: 0.94, h: 1.40, d: 0.44, skipBottom: true });
    const spines = ['#a5321f', '#3c4a5c', '#4a4f43', '#5b4a6b', PAL.k];
    for (let shelf = 0; shelf < 3; shelf++) {
      for (let i = 0; i < 5; i++) {
        b.color(spines[Math.floor(r() * spines.length)]);
        b.box({ x: x - 0.36 + i * 0.18, y: 0.34 + shelf * 0.42, z: z + 0.10, w: 0.10, h: 0.24 + r() * 0.08, d: 0.22 });
      }
    }
  },
};

/** A wall the camera would otherwise look straight through: kept knee-high. */
function cutWall(b, x, z) {
  b.color(PAL.W).box({ x, y: CUT_H / 2, z, w: 1.0, h: CUT_H, d: 1.0, skipBottom: true });
  b.color(PAL.w).box({ x, y: CUT_H + 0.01, z, w: 1.0, h: 0.03, d: 1.0 });              // sawn top
  b.color(PAL.K).box({ x, y: CUT_H - 0.02, z: z + 0.5, w: 1.02, h: 0.06, d: 0.04 });   // ink edge
  b.color(PAL.K).box({ x, y: 0.07, z: z + 0.5, w: 1.02, h: 0.10, d: 0.04 });
}

function steps(b, x, z, dir) {
  b.color('#7d7469');
  for (let i = 0; i < 4; i++) {
    const y = dir > 0 ? i * 0.14 : -i * 0.14;
    b.box({ x, y: y + 0.07, z: z - 0.36 + i * 0.24, w: 0.9, h: 0.16, d: 0.26 });
  }
  if (dir < 0) b.color('#0b0d12').plane({ x, y: -0.45, z: z + 0.3, w: 0.86, d: 0.5 });
}

/**
 * Builds the whole map as one world-space mesh.
 * @returns {{data: Float32Array, tris: number, bounds: {maxY: number}}}
 */
export function buildEnv(map, opts = {}) {
  const b = new MeshBuilder();
  let maxY = 0;

  // underlay so gaps between tiles never show the clear colour; underground it is
  // the same near-black the dark maps clear to
  b.color(opts.dark ? '#0f0d0c' : PAL.W)
    .plane({ x: map.w / 2, y: -0.02, z: map.h / 2, w: map.w + 4, d: map.h + 4 });

  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const ch = map.grid[ty][tx];
      const x = tx + 0.5, z = ty + 0.5;
      const r = rng(1 + tx * 73856093 + ty * 19349663);
      b.color(GROUND[ch] || PAL.W).plane({ x, y: 0, z, w: 1.0, d: 1.0 });
      const builder = TILE_BUILDERS[ch];
      const cut = isNearWall(map, tx, ty);
      if (builder) builder(b, x, z, r, cut);
      if (cut) { maxY = Math.max(maxY, CUT_H); continue; }
      if (ch === 'T') maxY = Math.max(maxY, 2.4);
      else if (ch === '^' || ch === 'D' || ch === 'h') maxY = Math.max(maxY, 2.4);
      else if (ch === 'O' || ch === 'B') maxY = Math.max(maxY, 1.5);
      else maxY = Math.max(maxY, WALL_H);
    }
  }
  return { data: b.build(), tris: b.tris, maxY };
}

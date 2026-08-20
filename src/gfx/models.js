/*
 * Low-poly cast, built in code. Every model is a rigid part hierarchy — the same
 * trick the PlayStation field models used, where a character is a bag of boxes
 * pinned to joints rather than a skinned mesh. Parts are authored around their
 * own pivot; anim.js supplies the rotations.
 *
 * One world unit = one map tile. Tata stands about 1.45 units tall including hat.
 */
import { MeshBuilder } from './mesh.js';
import { PAL } from '../art/palette.js';

export const P = {
  ROOT: 0, TORSO: 1, HEAD: 2, HAT: 3,
  ARM_L: 4, ARM_R: 5, LEG_L: 6, LEG_R: 7,
  PROP: 8, EXTRA: 9,
};

/** Pivot positions for the humanoid rig, in model space with feet at y = 0. */
const HUMAN_PIVOTS = [
  [0, 0, 0],        // ROOT
  [0, 0.52, 0],     // TORSO
  [0, 1.04, 0],     // HEAD
  [0, 1.20, 0],     // HAT
  [0.20, 0.96, 0],  // ARM_L (+x is her left on screen)
  [-0.20, 0.96, 0], // ARM_R
  [0.09, 0.52, 0],  // LEG_L
  [-0.09, 0.52, 0], // LEG_R
  [0.24, 0.88, 0.10], // PROP — notebook / weapon hand
  [0, 0.52, 0],     // EXTRA — cloaks, tails, satchels
];

// --------------------------------------------------------------- humanoids

/** Shared body: legs, torso, arms, head. Accessories are layered on top. */
function humanoid(b, opts) {
  const {
    coat = PAL.K, shirt = PAL.W, trouser = PAL.k, skin = PAL.S,
    torsoW = 0.34, torsoH = 0.52, torsoD = 0.20, taper = 0.86,
    legH = 0.52, armH = 0.42, headR = 0.15, boots = PAL.t,
  } = opts;

  b.part(P.LEG_L).color(trouser);
  b.box({ x: 0, y: -legH / 2, z: 0, w: 0.13, h: legH, d: 0.14 });
  b.color(boots).box({ x: 0, y: -legH + 0.04, z: 0.02, w: 0.15, h: 0.09, d: 0.19 });
  b.part(P.LEG_R).color(trouser);
  b.box({ x: 0, y: -legH / 2, z: 0, w: 0.13, h: legH, d: 0.14 });
  b.color(boots).box({ x: 0, y: -legH + 0.04, z: 0.02, w: 0.15, h: 0.09, d: 0.19 });

  b.part(P.TORSO).color(coat);
  b.box({ x: 0, y: torsoH / 2, z: 0, w: torsoW, h: torsoH, d: torsoD, taperX: taper, taperZ: taper });
  // shirt front: a lighter slab so the silhouette reads against the coat
  b.color(shirt).box({ x: 0, y: torsoH * 0.55, z: torsoD / 2 - 0.005, w: torsoW * 0.34, h: torsoH * 0.6, d: 0.03 });
  b.color(coat).box({ x: 0, y: torsoH - 0.03, z: 0, w: torsoW + 0.06, h: 0.06, d: torsoD + 0.04 });  // shoulders

  for (const [part, side] of [[P.ARM_L, 1], [P.ARM_R, -1]]) {
    b.part(part).color(coat);
    b.box({ x: 0, y: -armH / 2, z: 0, w: 0.10, h: armH, d: 0.11 });
    b.color(skin).box({ x: 0, y: -armH - 0.03, z: 0, w: 0.09, h: 0.08, d: 0.10 });
    void side;
  }

  b.part(P.HEAD).color(skin);
  b.box({ x: 0, y: headR * 0.9, z: 0, w: headR * 1.7, h: headR * 1.8, d: headR * 1.6, taperX: 0.94 });
  // minimal face: two ink ticks, no mouth (gameplan §6)
  b.color(PAL.K).box({ x: 0.05, y: headR * 1.05, z: headR * 0.82, w: 0.035, h: 0.03, d: 0.02 });
  b.color(PAL.K).box({ x: -0.05, y: headR * 1.05, z: headR * 0.82, w: 0.035, h: 0.03, d: 0.02 });
}

/** The Borsalino: wide brim, blocky crown, band. */
function borsalino(b, { brim = 0.42, crown = 0.19, ink = PAL.K, band = PAL.R } = {}) {
  b.part(P.HAT).color(ink);
  b.cylinder({ x: 0, y: 0.02, z: 0, r: brim, h: 0.035, segments: 10 });
  b.cylinder({ x: 0, y: 0.02 + crown / 2, z: 0, r: 0.17, rTop: 0.155, h: crown, segments: 8 });
  b.color(band).cylinder({ x: 0, y: 0.06, z: 0, r: 0.178, h: 0.045, segments: 8, caps: false });
  b.color(ink).box({ x: 0, y: 0.02 + crown, z: 0, w: 0.10, h: 0.03, d: 0.24 });   // pinched crease
}

function longHair(b, { ink = PAL.K, len = 0.42 } = {}) {
  b.part(P.HEAD).color(ink);
  b.box({ x: 0, y: 0.30, z: -0.02, w: 0.32, h: 0.16, d: 0.30 });            // cap of hair
  b.box({ x: 0, y: 0.30 - len / 2, z: -0.13, w: 0.30, h: len, d: 0.08, taperX: 0.72 });  // fall down the back
  b.box({ x: 0.15, y: 0.26 - len * 0.35, z: 0.02, w: 0.06, h: len * 0.7, d: 0.14 });     // side locks
  b.box({ x: -0.15, y: 0.26 - len * 0.35, z: 0.02, w: 0.06, h: len * 0.7, d: 0.14 });
  b.box({ x: 0, y: 0.34, z: 0.12, w: 0.30, h: 0.07, d: 0.10 });             // fringe under the brim
}

// ------------------------------------------------------------------ models

export const MODELS = {
  /** Tata: hat, hair, coat, satchel, and the compact SMG she should not have. */
  tata(b) {
    humanoid(b, { coat: '#2f2a3d', shirt: PAL.W, trouser: PAL.k, torsoW: 0.32, torsoH: 0.50 });
    longHair(b);
    borsalino(b);
    b.part(P.EXTRA).color(PAL.t);
    b.box({ x: 0.20, y: 0.24, z: -0.06, w: 0.20, h: 0.16, d: 0.10, rz: 0.2 });   // satchel
    b.color(PAL.K).box({ x: 0.06, y: 0.40, z: -0.02, w: 0.05, h: 0.34, d: 0.05, rz: -0.5 });  // strap
    b.part(P.PROP).color(PAL.g);
    b.box({ x: 0, y: -0.06, z: 0.06, w: 0.07, h: 0.09, d: 0.26 });               // SMG body
    b.color(PAL.K).box({ x: 0, y: -0.12, z: 0.02, w: 0.05, h: 0.10, d: 0.06 });  // grip
    b.color(PAL.G).box({ x: 0, y: -0.05, z: 0.21, w: 0.04, h: 0.04, d: 0.12 });  // barrel
  },

  /** The Traveler: a cloak with a person rumoured inside it. */
  traveler(b) {
    b.part(P.TORSO).color('#1b1a24');
    b.box({ x: 0, y: 0.46, z: 0, w: 0.62, h: 0.92, d: 0.46, taperX: 0.52, taperZ: 0.52 });
    b.box({ x: 0, y: 1.00, z: 0, w: 0.40, h: 0.20, d: 0.30, taperX: 0.8 });
    b.color('#111018').box({ x: 0, y: 0.70, z: 0.20, w: 0.10, h: 0.60, d: 0.10 });   // clasp seam
    b.part(P.HEAD).color('#1b1a24');
    b.box({ x: 0, y: 0.12, z: -0.01, w: 0.30, h: 0.28, d: 0.30, taperX: 0.7, taperZ: 0.7 });  // hood
    b.color('#05060a').box({ x: 0, y: 0.10, z: 0.13, w: 0.19, h: 0.15, d: 0.06 });           // no face, only dark
    b.part(P.ARM_L).color('#1b1a24').box({ x: 0, y: -0.24, z: 0, w: 0.13, h: 0.48, d: 0.13, taperX: 1.3, taperZ: 1.3 });
    b.part(P.ARM_R).color('#1b1a24').box({ x: 0, y: -0.24, z: 0, w: 0.13, h: 0.48, d: 0.13, taperX: 1.3, taperZ: 1.3 });
    b.part(P.EXTRA).color(PAL.b);
    b.box({ x: 0, y: 0.02, z: -0.26, w: 0.5, h: 0.03, d: 0.16 });    // the blue he drags behind him
  },

  villager(b) { humanoid(b, { coat: '#6d6355', shirt: PAL.W, trouser: PAL.t }); capNPC(b, '#6d6355'); },

  merchant(b) {
    humanoid(b, { coat: '#7a3f2c', shirt: '#d9cfba', trouser: PAL.t, torsoW: 0.40, taper: 0.95 });
    capNPC(b, '#a5321f', 0.30);
    b.part(P.EXTRA).color(PAL.T).box({ x: 0, y: 0.30, z: 0.16, w: 0.30, h: 0.30, d: 0.06 });   // apron
  },

  archivist(b) {
    humanoid(b, { coat: '#3c4a5c', shirt: PAL.W, trouser: PAL.k, torsoW: 0.30, torsoH: 0.56 });
    b.part(P.HEAD).color(PAL.G).box({ x: 0, y: 0.30, z: -0.02, w: 0.30, h: 0.12, d: 0.28 });   // grey hair
    b.part(P.PROP).color(PAL.T).box({ x: 0, y: -0.06, z: 0.04, w: 0.20, h: 0.06, d: 0.16 });   // ledger
    b.color(PAL.W).box({ x: 0, y: -0.02, z: 0.04, w: 0.19, h: 0.02, d: 0.15 });
  },

  guard(b) {
    humanoid(b, { coat: '#4a4f43', shirt: PAL.G, trouser: PAL.k, torsoW: 0.40, taper: 0.92, boots: PAL.K });
    b.part(P.HAT).color(PAL.G);
    b.cylinder({ x: 0, y: 0.06, z: 0, r: 0.20, rTop: 0.12, h: 0.18, segments: 8 });            // kettle helm
    b.color(PAL.g).box({ x: 0, y: 0.02, z: 0.16, w: 0.22, h: 0.05, d: 0.10 });
    b.part(P.PROP).color(PAL.t).box({ x: 0, y: 0.24, z: 0, w: 0.05, h: 1.10, d: 0.05 });       // pike
    b.color(PAL.G).box({ x: 0, y: 0.84, z: 0, w: 0.07, h: 0.22, d: 0.03, taperX: 0.2 });
  },

  teacher(b) {
    humanoid(b, { coat: '#5b4a6b', shirt: PAL.W, trouser: '#4a3d55', torsoW: 0.32, legH: 0.40 });
    b.part(P.TORSO).color('#4a3d55').box({ x: 0, y: 0.06, z: 0, w: 0.36, h: 0.34, d: 0.30, taperX: 1.5, taperZ: 1.4 });  // long skirt
    capNPC(b, '#5b4a6b', 0.26);
  },

  smuggler(b) {
    humanoid(b, { coat: '#2b3a34', shirt: PAL.k, trouser: PAL.K, torsoW: 0.36 });
    b.part(P.HAT).color(PAL.K);
    b.cylinder({ x: 0, y: 0.02, z: 0, r: 0.30, h: 0.03, segments: 8 });
    b.cylinder({ x: 0, y: 0.10, z: 0, r: 0.16, h: 0.16, segments: 6 });
  },

  /** The village dog. Four legs, one opinion. */
  dog(b) {
    b.part(P.TORSO).color('#7a6a58');
    b.box({ x: 0, y: 0.30, z: 0, w: 0.20, h: 0.22, d: 0.52, taperZ: 0.9 });
    b.part(P.HEAD).color('#7a6a58');
    b.box({ x: 0, y: 0.06, z: 0.10, w: 0.19, h: 0.19, d: 0.24 });
    b.box({ x: 0, y: 0.02, z: 0.24, w: 0.11, h: 0.10, d: 0.12 });        // muzzle
    b.color(PAL.K).box({ x: 0.07, y: 0.16, z: 0.04, w: 0.05, h: 0.10, d: 0.05 });  // ears
    b.color(PAL.K).box({ x: -0.07, y: 0.16, z: 0.04, w: 0.05, h: 0.10, d: 0.05 });
    b.part(P.LEG_L).color('#6a5a48');
    b.box({ x: 0.07, y: -0.10, z: 0.16, w: 0.07, h: 0.20, d: 0.07 });
    b.box({ x: -0.07, y: -0.10, z: 0.16, w: 0.07, h: 0.20, d: 0.07 });
    b.part(P.LEG_R).color('#6a5a48');
    b.box({ x: 0.07, y: -0.10, z: -0.16, w: 0.07, h: 0.20, d: 0.07 });
    b.box({ x: -0.07, y: -0.10, z: -0.16, w: 0.07, h: 0.20, d: 0.07 });
    b.part(P.EXTRA).color('#7a6a58');
    b.box({ x: 0, y: 0.10, z: -0.08, w: 0.06, h: 0.06, d: 0.22, rx: -0.6 });   // tail
  },

  // ------------------------------------------------------------- bestiary

  /** Lantern Wisp: a lantern that got ideas. Floats, so no legs. */
  wisp(b) {
    b.part(P.TORSO).color(PAL.G);
    b.cylinder({ x: 0, y: 0.62, z: 0, r: 0.20, rTop: 0.16, h: 0.34, segments: 6 });
    b.color(PAL.K).cylinder({ x: 0, y: 0.82, z: 0, r: 0.19, rTop: 0.05, h: 0.14, segments: 6 });
    b.cylinder({ x: 0, y: 0.44, z: 0, r: 0.21, h: 0.05, segments: 6 });
    b.box({ x: 0, y: 0.96, z: 0, w: 0.04, h: 0.14, d: 0.04 });          // hook
    b.part(P.PROP).color(PAL.B);
    b.cylinder({ x: 0, y: 0.62, z: 0, r: 0.11, rTop: 0, h: 0.26, segments: 6 });   // cold flame
    b.color(PAL.b).cylinder({ x: 0, y: 0.52, z: 0, r: 0.12, rTop: 0.06, h: 0.10, segments: 6 });
  },

  /** Crate Crawler: smuggler's crate walking on splinters it grew tonight. */
  crate(b) {
    b.part(P.TORSO).color(PAL.T);
    b.box({ x: 0, y: 0.36, z: 0, w: 0.56, h: 0.46, d: 0.50 });
    b.color(PAL.t);
    b.box({ x: 0, y: 0.36, z: 0.26, w: 0.58, h: 0.07, d: 0.02 });
    b.box({ x: 0, y: 0.55, z: 0.26, w: 0.58, h: 0.06, d: 0.02 });
    b.color(PAL.K).box({ x: 0.12, y: 0.40, z: 0.26, w: 0.14, h: 0.12, d: 0.02 });   // no-port stamp
    b.part(P.LEG_L).color(PAL.t);
    b.box({ x: 0.22, y: -0.06, z: 0.16, w: 0.05, h: 0.28, d: 0.05, rz: 0.3 });
    b.box({ x: 0.24, y: -0.06, z: -0.14, w: 0.05, h: 0.26, d: 0.05, rz: 0.2 });
    b.part(P.LEG_R).color(PAL.t);
    b.box({ x: -0.22, y: -0.06, z: 0.16, w: 0.05, h: 0.28, d: 0.05, rz: -0.3 });
    b.box({ x: -0.24, y: -0.06, z: -0.14, w: 0.05, h: 0.26, d: 0.05, rz: -0.2 });
  },

  /** Rift Hound: too many legs, and all of them agree. */
  hound(b) {
    b.part(P.TORSO).color('#3a3038');
    b.box({ x: 0, y: 0.34, z: 0, w: 0.26, h: 0.26, d: 0.70, taperZ: 0.8 });
    b.color(PAL.b).box({ x: 0, y: 0.48, z: 0, w: 0.10, h: 0.06, d: 0.56 });     // rift seam down the spine
    b.part(P.HEAD).color('#3a3038');
    b.box({ x: 0, y: 0.04, z: 0.16, w: 0.22, h: 0.22, d: 0.28 });
    b.box({ x: 0, y: -0.02, z: 0.34, w: 0.14, h: 0.12, d: 0.16 });
    b.color(PAL.B).box({ x: 0.06, y: 0.10, z: 0.30, w: 0.05, h: 0.04, d: 0.03 });
    b.color(PAL.B).box({ x: -0.06, y: 0.10, z: 0.30, w: 0.05, h: 0.04, d: 0.03 });
    for (const [part, dir] of [[P.LEG_L, 1], [P.LEG_R, -1]]) {
      b.part(part).color('#2b232a');
      for (let i = 0; i < 3; i++) {
        const z = 0.26 - i * 0.26;
        b.box({ x: 0.13 * dir, y: -0.14, z, w: 0.06, h: 0.30, d: 0.06, rz: 0.12 * dir });
      }
    }
  },

  /** The Lantern Keeper: posted at the well, holding a light that asks questions. */
  keeper(b) {
    b.part(P.TORSO).color('#26303a');
    b.box({ x: 0, y: 0.70, z: 0, w: 0.70, h: 1.40, d: 0.52, taperX: 0.45, taperZ: 0.5 });
    b.color('#1a222b').box({ x: 0, y: 1.34, z: 0, w: 0.46, h: 0.14, d: 0.36 });
    b.part(P.HEAD).color('#26303a');
    b.box({ x: 0, y: 0.14, z: 0, w: 0.34, h: 0.30, d: 0.32, taperX: 0.8 });
    b.color(PAL.B).box({ x: 0, y: 0.14, z: 0.16, w: 0.22, h: 0.05, d: 0.04 });     // slit of light for a face
    b.part(P.HAT).color(PAL.G);
    b.cylinder({ x: 0, y: 0.04, z: 0, r: 0.36, rTop: 0.10, h: 0.26, segments: 8 });
    b.part(P.ARM_L).color('#26303a').box({ x: 0, y: -0.34, z: 0, w: 0.14, h: 0.68, d: 0.14 });
    b.part(P.ARM_R).color('#26303a').box({ x: 0, y: -0.34, z: 0, w: 0.14, h: 0.68, d: 0.14 });
    b.part(P.PROP).color(PAL.K);
    b.box({ x: 0, y: 0.10, z: 0, w: 0.04, h: 1.00, d: 0.04 });                     // pole
    b.color(PAL.G).cylinder({ x: 0, y: -0.30, z: 0, r: 0.16, h: 0.26, segments: 6 });
    b.color(PAL.B).cylinder({ x: 0, y: -0.30, z: 0, r: 0.10, rTop: 0, h: 0.22, segments: 6 });
  },
  /** A rift: a standing tear in the world, blue and badly attached. */
  rift(b) {
    b.part(P.TORSO).color(PAL.b);
    b.box({ x: 0, y: 0.55, z: 0, w: 0.30, h: 1.10, d: 0.10, taperX: 0.25 });
    b.color(PAL.B).box({ x: 0, y: 0.55, z: 0.04, w: 0.14, h: 1.00, d: 0.06, taperX: 0.2 });
    b.color(PAL.W).box({ x: 0, y: 0.58, z: 0.07, w: 0.05, h: 0.80, d: 0.03, taperX: 0.1 });
    b.part(P.PROP).color(PAL.B);
    b.card({ x: 0.22, y: 0.30, z: -0.05, w: 0.10, h: 0.34, ry: 0.6 });
    b.card({ x: -0.24, y: 0.55, z: 0.05, w: 0.09, h: 0.28, ry: -0.7 });
    b.card({ x: 0.14, y: 0.95, z: 0.08, w: 0.08, h: 0.22, ry: 1.1 });
    b.part(P.EXTRA).color(PAL.b);
    b.plane({ x: 0, y: 0.012, z: 0, w: 0.9, d: 0.9 });
  },
};

/** Flat cap / headscarf shared by the villagers. */
function capNPC(b, color, r = 0.24) {
  b.part(P.HAT).color(color);
  b.cylinder({ x: 0, y: 0.02, z: 0, r, h: 0.05, segments: 8 });
  b.cylinder({ x: 0, y: 0.08, z: 0, r: r * 0.62, h: 0.10, segments: 6 });
}

/*
 * Rig metadata. `pivots` are the joint origins each part's geometry was authored
 * around; the animator rotates parts about these. Non-humanoid cast (dog, crate,
 * hound, wisp) is authored mostly in absolute model space, so their pivots are
 * only set where a joint actually swings.
 */
const HUMAN_RIG = { pivots: HUMAN_PIVOTS.map((p, i) => (i === P.EXTRA ? [0, 0.30, 0] : p)), gait: 'human' };

const zeros = () => HUMAN_PIVOTS.map(() => [0, 0, 0]);
function rig(overrides, gait) {
  const pivots = zeros();
  for (const [part, p] of overrides) pivots[part] = p;
  return { pivots, gait };
}

export const RIGS = {
  tata: HUMAN_RIG,
  villager: HUMAN_RIG,
  merchant: HUMAN_RIG,
  archivist: HUMAN_RIG,
  guard: HUMAN_RIG,
  teacher: HUMAN_RIG,
  smuggler: HUMAN_RIG,

  traveler: rig([
    [P.HEAD, [0, 1.06, 0]],
    [P.ARM_L, [0.24, 0.92, 0]],
    [P.ARM_R, [-0.24, 0.92, 0]],
  ], 'glide'),

  dog: rig([
    [P.HEAD, [0, 0.36, 0.22]],
    [P.LEG_L, [0, 0.20, 0]],
    [P.LEG_R, [0, 0.20, 0]],
    [P.EXTRA, [0, 0.30, -0.26]],
  ], 'quad'),

  wisp: rig([], 'float'),

  crate: rig([
    [P.LEG_L, [0, 0.22, 0]],
    [P.LEG_R, [0, 0.22, 0]],
  ], 'scuttle'),

  hound: rig([
    [P.HEAD, [0, 0.34, 0.30]],
    [P.LEG_L, [0, 0.30, 0]],
    [P.LEG_R, [0, 0.30, 0]],
  ], 'quad'),

  rift: rig([], 'float'),

  keeper: rig([
    [P.HEAD, [0, 1.40, 0]],
    [P.HAT, [0, 1.62, 0]],
    [P.ARM_L, [0.32, 1.28, 0]],
    [P.ARM_R, [-0.32, 1.28, 0]],
    [P.PROP, [0.44, 0.95, 0.05]],
  ], 'float'),
};

/**
 * Per-model world scale. The Traveler reads as "tall figure" in the prose, so he
 * is drawn a head and a half above everyone else.
 */
export const SCALES = { traveler: 1.28, keeper: 1.1, guard: 1.05 };

export const scaleOf = (id) => SCALES[id] || 1;

/** Rough standing height per model, used to place name tags and hit sparks. */
export const HEIGHTS = {
  tata: 1.42, traveler: 1.66, villager: 1.40, merchant: 1.42, archivist: 1.40,
  guard: 1.48, teacher: 1.40, smuggler: 1.42, dog: 0.60,
  wisp: 1.05, crate: 0.62, hound: 0.72, keeper: 2.00, rift: 1.20,
};

const cache = new Map();

/** Builds (once) and returns the raw interleaved vertex data for a model id. */
export function modelData(id) {
  if (cache.has(id)) return cache.get(id);
  const build = MODELS[id] || MODELS.villager;
  const b = new MeshBuilder();
  build(b);
  const out = { data: b.build(), tris: b.tris };
  cache.set(id, out);
  return out;
}

export const hasModel = (id) => !!MODELS[id];

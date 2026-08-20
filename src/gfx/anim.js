/*
 * Animation groups, in the PS1 sense: no skinning, just rotations applied to
 * rigid parts around their pivots. Every clip is a closed-form function of time,
 * so nothing needs baking and a pose costs a couple of dozen matrix composes.
 *
 * Humanoids are articulated one level deeper than the old rig: forearms hang
 * off the upper arms, shins off the thighs, and the held prop off the left
 * forearm — a `chain` map on the rig names each child's parent, and the child's
 * matrix is composed through it. That is what lets elbows and knees actually
 * bend, which is most of what "fluid motion" (issue #8) means at this budget.
 *
 * Clips: idle, walk, attack, interrogate, hurt, cast, down.
 */
import { mat4, compose, identity, multiply } from './math.js';
import { P, RIGS } from './models.js';

const PART_COUNT = 16;
const TMP = mat4();
const TMP_PARENT = mat4();
const TMP_LOCAL = mat4();

/** Scratch buffer of 16 mat4s, uploaded straight into uParts[]. */
export function poseBuffer() {
  const buf = new Float32Array(PART_COUNT * 16);
  for (let i = 0; i < PART_COUNT; i++) {
    buf[i * 16] = buf[i * 16 + 5] = buf[i * 16 + 10] = buf[i * 16 + 15] = 1;
  }
  return buf;
}

function composeAt(out, pivot, origin, trs) {
  compose(out, {
    x: pivot[0] - origin[0] + (trs.dx || 0),
    y: pivot[1] - origin[1] + (trs.dy || 0),
    z: pivot[2] - origin[2] + (trs.dz || 0),
    ry: trs.ry || 0, rx: trs.rx || 0, rz: trs.rz || 0,
    sx: trs.sx ?? 1, sy: trs.sy ?? 1, sz: trs.sz ?? 1,
  });
  return out;
}

const ZERO3 = [0, 0, 0];
const NO_TRS = {};

/**
 * Model-space matrix for one part, composed through its parent chain. Chains
 * are at most three deep (prop -> forearm -> upper arm), so the recursion and
 * re-derivation of parents cost nothing worth caching.
 */
function partMatrix(out, rig, i, trsMap) {
  const pivot = rig.pivots[i] || ZERO3;
  const trs = trsMap[i] || NO_TRS;
  const parent = rig.chain ? rig.chain[i] : undefined;
  if (parent === undefined) {
    return composeAt(out, pivot, ZERO3, trs);
  }
  partMatrix(TMP_PARENT, rig, parent, trsMap);
  composeAt(TMP_LOCAL, pivot, rig.pivots[parent] || ZERO3, trs);
  return multiply(out, TMP_PARENT, TMP_LOCAL);
}

const sin = (t, hz, amp = 1) => Math.sin(t * hz * Math.PI * 2) * amp;

/**
 * Writes the pose for one character into `buf`.
 * @param {Float32Array} buf from poseBuffer()
 * @param {string} rigId key into RIGS
 * @param {{clip?: string, t?: number, phase?: number, speed?: number}} state
 */
export function pose(buf, rigId, state = {}) {
  const rig = RIGS[rigId] || RIGS.villager;
  const pivots = rig.pivots;
  const clip = state.clip || 'idle';
  const t = state.t || 0;
  const k = state.phase ?? 0;          // 0..1 progress for one-shot clips

  const bob = { dy: 0, rz: 0, rx: 0, dz: 0 };
  let legSwing = 0, armSwing = 0, hatTilt = 0;
  // joint bends, humanoid rigs only (positive = the natural bend direction:
  // elbows fold forward, knees fold back)
  let elbowL = 0.22, elbowR = 0.22, kneeL = 0.05, kneeR = 0.05;

  switch (clip) {
    case 'walk': {
      legSwing = sin(t, 2.4, 0.58);
      armSwing = -legSwing * 0.55;
      bob.dy = Math.abs(sin(t, 2.4, 0.035));
      bob.rx = 0.06;                       // eager forward lean
      bob.rz = sin(t, 2.4, 0.03);          // weight shifting over the stance leg
      hatTilt = sin(t, 2.4, 0.05);
      // the knee folds while its leg swings through, and is straight in stance
      kneeL = 0.10 + Math.max(0, -legSwing) * 1.05;
      kneeR = 0.10 + Math.max(0, legSwing) * 1.05;
      // elbows carry a jog-like bend, deepening as the arm comes forward
      elbowL = 0.35 + Math.max(0, -armSwing) * 0.55;
      elbowR = 0.35 + Math.max(0, armSwing) * 0.55;
      break;
    }
    case 'attack': {
      const lunge = Math.sin(Math.min(1, k) * Math.PI);
      bob.dz = lunge * 0.28;
      bob.rx = -lunge * 0.12;
      armSwing = -1.15 * lunge;
      legSwing = 0.30 * lunge;
      hatTilt = -0.12 * lunge;
      elbowL = 0.9 - lunge * 0.8;          // wound up, then thrown straight
      elbowR = 0.5 + lunge * 0.4;
      kneeL = 0.05 + lunge * 0.35;
      kneeR = 0.05 + lunge * 0.5;
      break;
    }
    case 'cast': {
      const rise = Math.sin(Math.min(1, k) * Math.PI);
      bob.dy = rise * 0.06;
      armSwing = -1.5 * rise;
      hatTilt = -0.18 * rise;
      elbowL = 0.2 + rise * 0.5;
      elbowR = 0.2 + rise * 0.5;
      break;
    }
    case 'interrogate': {
      // notebook flick: head down, book up, one sharp page turn
      const flick = Math.sin(Math.min(1, k) * Math.PI * 3) * (1 - k);
      bob.rx = 0.05;
      armSwing = -0.55;
      hatTilt = -0.22 + flick * 0.16;
      elbowL = 1.15;                       // book held up to the brim
      elbowR = 0.75 + flick * 0.25;        // the page hand
      break;
    }
    case 'hurt': {
      const recoil = Math.sin(Math.min(1, k) * Math.PI);
      bob.dz = -recoil * 0.16;
      bob.rx = recoil * 0.30;
      armSwing = recoil * 0.5;
      hatTilt = recoil * 0.3;
      elbowL = 0.3 + recoil * 0.6;
      elbowR = 0.3 + recoil * 0.6;
      kneeL = 0.05 + recoil * 0.4;
      kneeR = 0.05 + recoil * 0.4;
      break;
    }
    case 'down':
      bob.rx = 1.35;
      bob.dy = -0.18;
      legSwing = 0.4;
      hatTilt = 0.5;
      elbowL = 0.8; elbowR = 0.6;
      kneeL = 1.1; kneeR = 0.9;
      break;
    default: {  // idle — the hat tilt from the gameplan, plus a slow breath
      hatTilt = sin(t, 0.55, 0.055);
      bob.dy = sin(t, 0.7, 0.012);
      armSwing = sin(t, 0.7, 0.05);
      elbowL = 0.24 + sin(t, 0.7, 0.04);
      elbowR = 0.24 - sin(t, 0.7, 0.04);
      break;
    }
  }

  switch (rig.gait) {
    case 'float':
      bob.dy += sin(t, 0.45, 0.07);
      bob.rz += sin(t, 0.31, 0.04);
      legSwing = 0;
      break;
    case 'glide':
      bob.dy += sin(t, 0.35, 0.03);
      bob.rz += sin(t, 0.22, 0.05);
      legSwing = 0;
      break;
    case 'scuttle':
      bob.dy += Math.abs(sin(t, 3.4, 0.05));
      legSwing = sin(t, 3.4, 0.5);
      break;
    case 'quad':
      legSwing = clip === 'walk' ? sin(t, 3.0, 0.7) : sin(t, 0.9, 0.09);
      break;
    default:
      break;
  }

  const chained = !!rig.chain;
  const trsMap = {
    [P.ROOT]: { dy: bob.dy, dz: bob.dz, rx: bob.rx, rz: bob.rz },
    [P.TORSO]: { dy: bob.dy, dz: bob.dz, rx: bob.rx * 0.7, rz: bob.rz },
    [P.HEAD]: { dy: bob.dy, dz: bob.dz, rx: bob.rx * 0.4 + hatTilt * 0.3, rz: bob.rz + hatTilt * 0.5 },
    [P.HAT]: { dy: bob.dy, dz: bob.dz, rz: bob.rz + hatTilt, rx: bob.rx * 0.4 },
    [P.ARM_L]: { dy: bob.dy, dz: bob.dz, rx: armSwing, rz: bob.rz },
    [P.ARM_R]: { dy: bob.dy, dz: bob.dz, rx: -armSwing * 0.55, rz: bob.rz },
    [P.LEG_L]: { rx: legSwing },
    [P.LEG_R]: { rx: -legSwing },
    // forearms fold towards the chest (negative rx is forward/up on the arms)
    [P.FORE_L]: { rx: -elbowL },
    [P.FORE_R]: { rx: -elbowR },
    // shins fold backwards relative to the thigh
    [P.SHIN_L]: { rx: kneeL },
    [P.SHIN_R]: { rx: kneeR },
    // chained props ride the hand and only add a grip angle; unchained rigs
    // (keeper's lantern pole) keep the old shoulder-level swing
    [P.PROP]: chained
      ? { rx: 0.15 }
      : { dy: bob.dy, dz: bob.dz, rx: armSwing * 0.9, rz: bob.rz },
    [P.EXTRA]: { dy: bob.dy, dz: bob.dz, rz: bob.rz + sin(t, 0.8, 0.05), rx: bob.rx * 0.5 },
  };

  for (let i = 0; i < PART_COUNT; i++) {
    if (!trsMap[i] && !(pivots[i])) { identity(TMP); buf.set(TMP, i * 16); continue; }
    partMatrix(TMP, rig, i, trsMap);
    buf.set(TMP, i * 16);
  }
  return buf;
}

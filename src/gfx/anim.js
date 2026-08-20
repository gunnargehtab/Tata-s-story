/*
 * Animation groups, in the PS1 sense: no skinning, just rotations applied to
 * rigid parts around their pivots. Every clip is a closed-form function of time,
 * so nothing needs baking and a pose costs a dozen matrix composes.
 *
 * Clips: idle, walk, attack, interrogate, hurt, cast, down.
 */
import { mat4, compose, identity } from './math.js';
import { P, RIGS } from './models.js';

const PART_COUNT = 12;
const TMP = mat4();

/** Scratch buffer of 12 mat4s, uploaded straight into uParts[]. */
export function poseBuffer() {
  const buf = new Float32Array(PART_COUNT * 16);
  for (let i = 0; i < PART_COUNT; i++) {
    buf[i * 16] = buf[i * 16 + 5] = buf[i * 16 + 10] = buf[i * 16 + 15] = 1;
  }
  return buf;
}

function setPart(buf, index, pivot, trs) {
  compose(TMP, {
    x: pivot[0] + (trs.dx || 0),
    y: pivot[1] + (trs.dy || 0),
    z: pivot[2] + (trs.dz || 0),
    ry: trs.ry || 0, rx: trs.rx || 0, rz: trs.rz || 0,
    sx: trs.sx ?? 1, sy: trs.sy ?? 1, sz: trs.sz ?? 1,
  });
  buf.set(TMP, index * 16);
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

  for (let i = 0; i < PART_COUNT; i++) {
    const pivot = pivots[i] || [0, 0, 0];
    identity(TMP);
    TMP[12] = pivot[0]; TMP[13] = pivot[1]; TMP[14] = pivot[2];
    buf.set(TMP, i * 16);
  }

  const bob = { dy: 0, rz: 0, rx: 0, dz: 0 };
  let legSwing = 0, armSwing = 0, hatTilt = 0;

  switch (clip) {
    case 'walk':
      legSwing = sin(t, 2.4, 0.62);
      armSwing = -legSwing * 0.6;
      bob.dy = Math.abs(sin(t, 2.4, 0.035));
      hatTilt = sin(t, 2.4, 0.05);
      break;
    case 'attack': {
      const lunge = Math.sin(Math.min(1, k) * Math.PI);
      bob.dz = lunge * 0.28;
      bob.rx = -lunge * 0.12;
      armSwing = -1.15 * lunge;
      legSwing = 0.30 * lunge;
      hatTilt = -0.12 * lunge;
      break;
    }
    case 'cast': {
      const rise = Math.sin(Math.min(1, k) * Math.PI);
      bob.dy = rise * 0.06;
      armSwing = -1.5 * rise;
      hatTilt = -0.18 * rise;
      break;
    }
    case 'interrogate': {
      // notebook flick: head down, book up, one sharp page turn
      const flick = Math.sin(Math.min(1, k) * Math.PI * 3) * (1 - k);
      bob.rx = 0.05;
      armSwing = -0.85;
      hatTilt = -0.22 + flick * 0.16;
      break;
    }
    case 'hurt': {
      const recoil = Math.sin(Math.min(1, k) * Math.PI);
      bob.dz = -recoil * 0.16;
      bob.rx = recoil * 0.30;
      armSwing = recoil * 0.5;
      hatTilt = recoil * 0.3;
      break;
    }
    case 'down':
      bob.rx = 1.35;
      bob.dy = -0.18;
      legSwing = 0.4;
      hatTilt = 0.5;
      break;
    default:  // idle — the hat tilt from the gameplan, plus a slow breath
      hatTilt = sin(t, 0.55, 0.055);
      bob.dy = sin(t, 0.7, 0.012);
      armSwing = sin(t, 0.7, 0.05);
      break;
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

  setPart(buf, P.ROOT, pivots[P.ROOT] || [0, 0, 0], { dy: bob.dy, dz: bob.dz, rx: bob.rx, rz: bob.rz });
  setPart(buf, P.TORSO, pivots[P.TORSO], { dy: bob.dy, dz: bob.dz, rx: bob.rx * 0.7, rz: bob.rz });
  setPart(buf, P.HEAD, pivots[P.HEAD], { dy: bob.dy, dz: bob.dz, rx: bob.rx * 0.4 + hatTilt * 0.3, rz: bob.rz + hatTilt * 0.5 });
  setPart(buf, P.HAT, pivots[P.HAT], { dy: bob.dy, dz: bob.dz, rz: bob.rz + hatTilt, rx: bob.rx * 0.4 });
  setPart(buf, P.ARM_L, pivots[P.ARM_L], { dy: bob.dy, dz: bob.dz, rx: armSwing, rz: bob.rz });
  setPart(buf, P.ARM_R, pivots[P.ARM_R], { dy: bob.dy, dz: bob.dz, rx: -armSwing * 0.55, rz: bob.rz });
  setPart(buf, P.LEG_L, pivots[P.LEG_L], { rx: legSwing });
  setPart(buf, P.LEG_R, pivots[P.LEG_R], { rx: -legSwing });
  setPart(buf, P.PROP, pivots[P.PROP], { dy: bob.dy, dz: bob.dz, rx: armSwing * 0.9, rz: bob.rz });
  setPart(buf, P.EXTRA, pivots[P.EXTRA], { dy: bob.dy, dz: bob.dz, rz: bob.rz + sin(t, 0.8, 0.05), rx: bob.rx * 0.5 });
  return buf;
}

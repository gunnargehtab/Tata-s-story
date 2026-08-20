/*
 * Battle scenes are the one place the game goes fully real-time 3D: a live
 * perspective camera, higher-poly versions of the same models the field uses,
 * and particle work for the flash / slash / shockwave beats.
 *
 * The scene renders into the top band of the frame; the ink UI is drawn over it
 * on the 2D canvas, so menus stay crisp.
 */
import { GL, program, uploadMesh, updateMesh, bindTarget, rgb } from './gl.js';
import { SCENE_VS, SCENE_FS } from './shaders.js';
import { mat4, perspective, lookAt, compose, multiply, transformPoint } from './math.js';
import { MeshBuilder } from './mesh.js';
import { modelData, RIGS, HEIGHTS, scaleOf } from './models.js';
import { poseBuffer, pose } from './anim.js';
import { PAL } from '../art/palette.js';

const STAGE_H = 252;          // pixels of the frame the 3D battle occupies (top band)
const FOV = 27 * Math.PI / 180;   // a long lens: keeps Tata and the enemies the same size

const state = {
  ready: false,
  scene: null,
  proj: mat4(),
  view: mat4(),
  model: mat4(),
  parts: poseBuffer(),
  stage: null,
  stageKind: null,
  models: new Map(),
  particles: [],
  partMesh: null,
  time: 0,
  viewW: 0,
  viewH: 0,
};

/** Queued animation beats, pushed by battle.js as actions resolve. */
const fx = { tata: null, enemies: new Map() };

export function resetBattleFx() {
  fx.tata = null;
  fx.enemies.clear();
  state.particles.length = 0;
}

export function fxAct(clip, targetIndex = -1) {
  fx.tata = { clip, t: 0, dur: clip === 'interrogate' ? 0.9 : 0.55, target: targetIndex };
}

export function fxHit(index, kind = 'hit') {
  fx.enemies.set(index, { clip: kind === 'down' ? 'down' : 'hurt', t: 0, dur: kind === 'down' ? 1e9 : 0.45 });
}

export function initBattle3D(viewW, viewH) {
  if (state.ready) return true;
  if (!GL.ok) return false;
  try {
    state.scene = program(SCENE_VS, SCENE_FS, 'battle');
  } catch (err) {
    console.warn(err.message);
    return false;
  }
  state.viewW = viewW;
  state.viewH = viewH;
  state.partMesh = uploadMesh(new Float32Array(0), null, true);
  state.ready = true;
  return true;
}

export const battle3DReady = () => state.ready;

function meshFor(id) {
  if (state.models.has(id)) return state.models.get(id);
  const { data } = modelData(id);
  const mesh = uploadMesh(data, null);
  state.models.set(id, mesh);
  return mesh;
}

// -------------------------------------------------------------------- stage

/** The arena: a paper disc scuffed with ink, plus whatever the location suggests. */
function buildStage(kind) {
  const b = new MeshBuilder();
  const rng = (() => { let s = 20240817; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const ground = kind === 'dark' ? '#3a352f' : '#d3cab2';
  b.color(ground).cylinder({ x: 0, y: -0.06, z: 0, r: 6.5, h: 0.12, segments: 16 });
  b.color(kind === 'dark' ? '#2b2723' : PAL.g);
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2, d = 0.6 + rng() * 5.6;
    b.plane({ x: Math.cos(a) * d, y: 0.005, z: Math.sin(a) * d, w: 0.30 + rng() * 0.5, d: 0.04 });
  }
  // scattered stones, so the ground has silhouette at the edges
  b.color(kind === 'dark' ? '#5c564d' : '#8e857a');
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2, d = 3.4 + rng() * 2.6;
    const s = 0.14 + rng() * 0.24;
    b.box({ x: Math.cos(a) * d, y: s / 2, z: Math.sin(a) * d, w: s, h: s * 0.8, d: s, ry: rng() * 3 });
  }
  if (kind === 'dark') {
    b.color('#4a443c');
    for (let i = 0; i < 9; i++) {
      const a = -0.3 + rng() * 3.7;
      b.box({ x: Math.cos(a) * 6.2, y: 1.4, z: Math.sin(a) * 6.2, w: 1.4, h: 2.8, d: 1.4, ry: rng(), taperX: 0.8 });
    }
  } else {
    b.color('#3b4a34');
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      const x = Math.cos(a) * 6.0, z = Math.sin(a) * 6.0;
      b.color(PAL.t).cylinder({ x, y: 0.5, z, r: 0.10, h: 1.0, segments: 5 });
      b.color('#3b4a34').box({ x, y: 1.35, z, w: 1.1, h: 0.8, d: 1.1, taperX: 0.5, taperZ: 0.5 });
    }
  }
  return uploadMesh(b.build(), null);
}

// ---------------------------------------------------------------- particles

function spawn(kind, x, y, z, color, count = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.2 + Math.random() * 2.4;
    state.particles.push({
      kind, x, y, z, color,
      vx: kind === 'ring' ? 0 : Math.cos(a) * sp,
      vy: kind === 'ring' ? 0.2 : 1.4 + Math.random() * 2.2,
      vz: kind === 'ring' ? 0 : Math.sin(a) * sp,
      life: 0, max: kind === 'ring' ? 0.6 : 0.45 + Math.random() * 0.3,
      size: kind === 'ring' ? 0.2 : 0.06 + Math.random() * 0.10,
    });
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += dt;
    if (p.life >= p.max) { state.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.kind !== 'ring') p.vy -= 6.5 * dt;
    if (p.kind === 'ring') p.size += dt * 4.5;
  }
}

/** Rebuilds the particle mesh as camera-facing quads. */
function drawParticles(right, up) {
  if (!state.particles.length) return;
  const b = new MeshBuilder();
  for (const p of state.particles) {
    const fade = 1 - p.life / p.max;
    const s = p.kind === 'ring' ? p.size : p.size * (0.4 + fade);
    const col = typeof p.color === 'string' ? rgb(p.color) : p.color;
    b.color([col[0], col[1], col[2]]);
    if (p.kind === 'ring') {
      // a flat expanding ring on the ground, drawn as a thin polygon fan
      const seg = 12;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const r0 = s, r1 = s + 0.08;
        b.quad(
          [p.x + Math.cos(a1) * r0, p.y, p.z + Math.sin(a1) * r0],
          [p.x + Math.cos(a0) * r0, p.y, p.z + Math.sin(a0) * r0],
          [p.x + Math.cos(a0) * r1, p.y, p.z + Math.sin(a0) * r1],
          [p.x + Math.cos(a1) * r1, p.y, p.z + Math.sin(a1) * r1]);
      }
      continue;
    }
    const rx = right[0] * s, ry = right[1] * s, rz = right[2] * s;
    const ux = up[0] * s, uy = up[1] * s, uz = up[2] * s;
    b.quad(
      [p.x - rx - ux, p.y - ry - uy, p.z - rz - uz],
      [p.x + rx - ux, p.y + ry - uy, p.z + rz - uz],
      [p.x + rx + ux, p.y + ry + uy, p.z + rz + uz],
      [p.x - rx + ux, p.y - ry + uy, p.z - rz + uz]);
  }
  const gl = GL.gl;
  const s = state.scene;
  updateMesh(state.partMesh, b.build(), null);
  gl.uniformMatrix4fv(s.u.uModel, false, compose(state.model, {}));
  gl.uniformMatrix4fv(s.u.uParts, false, state.parts);
  gl.uniform1f(s.u.uUnlit, 1);
  gl.uniform1f(s.u.uSnap, 0);
  gl.disable(gl.CULL_FACE);
  gl.depthMask(false);
  gl.bindVertexArray(state.partMesh.vao);
  gl.drawArrays(gl.TRIANGLES, 0, state.partMesh.count);
  gl.bindVertexArray(null);
  gl.depthMask(true);
  gl.enable(gl.CULL_FACE);
  gl.uniform1f(s.u.uUnlit, 0);
}

// -------------------------------------------------------------------- scene

/** Where each combatant stands. Tata holds the right, enemies the far arc. */
function enemySpot(i, n) {
  // enemies hold the left of frame, Tata the right — the FFVII party split
  const step = n > 2 ? 1.35 : 1.7;
  const x = -1.9 + i * step - (n - 1) * 0.05;
  const z = -0.5 - (i % 2) * 0.55;
  return [x, z];
}
const TATA_SPOT = [2.0, 2.4];

function drawModel(id, x, z, ry, clip, phase, tint, scale = 1) {
  const s3 = scale * scaleOf(id);
  const gl = GL.gl;
  const s = state.scene;
  const rigId = RIGS[id] ? id : 'villager';
  const mesh = meshFor(id);
  pose(state.parts, rigId, { clip, t: state.time, phase });
  compose(state.model, { x, y: 0, z, ry, sx: s3, sy: s3, sz: s3 });
  gl.uniformMatrix4fv(s.u.uModel, false, state.model);
  gl.uniformMatrix4fv(s.u.uParts, false, state.parts);
  gl.uniform4f(s.u.uTint, tint ? tint[0] : 0, tint ? tint[1] : 0, tint ? tint[2] : 0, tint ? tint[3] : 0);
  gl.bindVertexArray(mesh.vao);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  gl.cullFace(gl.FRONT);
  gl.uniform1f(s.u.uInkOnly, 1);
  gl.uniform1f(s.u.uOutline, 0.02);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  gl.cullFace(gl.BACK);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uOutline, 0);
  gl.bindVertexArray(null);
}

/**
 * Renders the battle scene and returns screen-space rects for each enemy so the
 * 2D layer can keep tap-targeting and stat bars lined up.
 */
export function drawBattleScene(ctx, b, dt, opts = {}) {
  if (!state.ready) return null;
  const gl = GL.gl;
  state.time += dt;
  updateParticles(dt);

  const kind = opts.dark ? 'dark' : 'field';
  if (!state.stage || state.stageKind !== kind) {
    state.stage = buildStage(kind);
    state.stageKind = kind;
  }

  // ---- animation bookkeeping
  if (fx.tata) {
    fx.tata.t += dt;
    if (fx.tata.t >= fx.tata.dur) {
      if (fx.tata.clip === 'attack' || fx.tata.clip === 'cast') {
        const n = b.enemies.length;
        const i = fx.tata.target >= 0 ? fx.tata.target : 0;
        const [ex, ez] = enemySpot(i, n);
        spawn('spark', ex, 0.7, ez, fx.tata.clip === 'cast' ? PAL.B : PAL.Y, 12);
      }
      fx.tata = null;
    }
  }
  for (const [i, e] of fx.enemies) {
    e.t += dt;
    if (e.t >= e.dur) fx.enemies.delete(i);
  }

  // ---- camera: fixed three-quarter with a slow drift, nudged on impact
  const sway = Math.sin(state.time * 0.5) * 0.22;
  const jolt = (b.shakeScreen > 0 ? (Math.random() - 0.5) * 0.10 : 0);
  const eye = [sway + jolt + 0.3, 3.3, 10.6];
  const target = [0, 1.05, 0.7];
  lookAt(state.view, eye, target, [0, 1, 0]);
  perspective(state.proj, FOV, state.viewW / STAGE_H, 0.5, 60);

  bindTarget(null);
  const paper = opts.dark ? rgb('#15120f') : rgb(PAL.W);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(0, 0, state.viewW, state.viewH);
  gl.clearColor(paper[0], paper[1], paper[2], 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, state.viewH - STAGE_H, state.viewW, STAGE_H);
  gl.scissor(0, state.viewH - STAGE_H, state.viewW, STAGE_H);

  const s = state.scene;
  gl.useProgram(s.prog);
  gl.uniformMatrix4fv(s.u.uProj, false, state.proj);
  gl.uniformMatrix4fv(s.u.uView, false, state.view);
  gl.uniform3fv(s.u.uLightDir, [0.4, 0.85, 0.34]);
  gl.uniform3fv(s.u.uInk, rgb(PAL.K));
  gl.uniform3fv(s.u.uPaper, paper);
  gl.uniform3f(s.u.uFog, 11.0, 19.0, opts.dark ? 0.85 : 0.55);
  gl.uniform1f(s.u.uHatch, 0.7);
  gl.uniform1f(s.u.uAlpha, 1);
  gl.uniform1f(s.u.uUnlit, 0);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uOutline, 0);
  gl.uniform1f(s.u.uSnap, 0);
  gl.uniform4f(s.u.uTint, 0, 0, 0, 0);

  // stage
  gl.uniformMatrix4fv(s.u.uModel, false, compose(state.model, {}));
  gl.uniformMatrix4fv(s.u.uParts, false, state.parts);
  gl.bindVertexArray(state.stage.vao);
  gl.drawArrays(gl.TRIANGLES, 0, state.stage.count);
  gl.bindVertexArray(null);

  // combatants — battle models keep the PS1 wobble off: these are the close-ups
  const n = b.enemies.length;
  const rects = [];
  b.enemies.forEach((e, i) => {
    if (!e.alive) return;
    const [x, z] = enemySpot(i, n);
    const hit = fx.enemies.get(i);
    const clip = hit ? hit.clip : 'idle';
    const phase = hit ? hit.t / Math.min(hit.dur, 1) : 0;
    const tint = e.flash > 0 ? [...rgb(PAL.B), Math.min(0.6, e.flash * 3)] : null;
    const shake = e.shake > 0 ? (Math.random() - 0.5) * 0.06 : 0;
    const scale = e.boss ? 1.0 : 1.15;
    drawModel(e.sprite, x + shake, z, 0, clip, phase, tint, scale);
    const h = (HEIGHTS[e.sprite] || 1.2) * scale * scaleOf(e.sprite);
    rects.push({ index: i, ...projectBox(x, h, z, scale) });
  });

  const tataClip = opts.down ? 'down' : (fx.tata ? fx.tata.clip : 'idle');
  const tataPhase = fx.tata ? fx.tata.t / fx.tata.dur : 0;
  drawModel('tata', TATA_SPOT[0], TATA_SPOT[1], Math.PI - 0.35, tataClip, tataPhase,
    opts.hurt ? [...rgb(PAL.R), Math.min(0.5, opts.hurt * 2)] : null);

  // particles use the camera basis for billboarding
  const right = [state.view[0], state.view[4], state.view[8]];
  const up = [state.view[1], state.view[5], state.view[9]];
  drawParticles(right, up);

  gl.disable(gl.SCISSOR_TEST);
  gl.viewport(0, 0, state.viewW, state.viewH);
  ctx.drawImage(GL.canvas, 0, 0);
  return rects;
}

/** Projects a standing box into game-screen pixels (y down) inside the stage band. */
function projectBox(x, h, z, scale = 1) {
  const vp = mat4();
  multiply(vp, state.proj, state.view);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const halfW = 0.45 * scale;
  for (const [dx, dy, dz] of [[-halfW, 0, 0], [halfW, 0, 0], [0, h, 0], [0, 0, 0], [0, h * 0.5, 0.4], [0, h * 0.5, -0.4]]) {
    const p = transformPoint(vp, x + dx, dy, z + dz);
    if (p[3] <= 0) continue;
    const sx = (p[0] / p[3] * 0.5 + 0.5) * state.viewW;
    const sy = (1 - (p[1] / p[3] * 0.5 + 0.5)) * STAGE_H;
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0, cx: 0, groundY: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, groundY: maxY };
}

/** Spawns the impact burst for a hit landed on enemy `index`. */
export function fxImpact(index, count, color) {
  const n = Math.max(1, count);
  const [x, z] = enemySpot(index, n);
  spawn('spark', x, 0.75, z, color || PAL.R, 14);
  spawn('ring', x, 0.02, z, color || PAL.K, 1);
}

/*
 * Field scenes, the FFVII way.
 *
 * The map is modelled in 3D once and baked into a background image *plus its
 * depth buffer*. Every frame we paste the visible slice of that background back
 * in — colour and depth together — and then draw only the characters in real 3D
 * on top. Because the baked depth is restored, Tata walks behind a house and is
 * correctly hidden by it, even though the house is a flat image.
 *
 * The camera is a fixed 40-degree orthographic three-quarter view. Orthographic
 * (rather than perspective) is what lets one bake cover a whole scrolling map:
 * panning is a pure translation, so the baked depth stays valid everywhere.
 */
import { GL, initGL, program, uploadMesh, deleteMesh, renderTarget, deleteTarget, bindTarget, rgb } from './gl.js';
import { SCENE_VS, SCENE_FS, BLIT_VS, BLIT_FS } from './shaders.js';
import { mat4, ortho, lookAt, compose } from './math.js';
import { buildEnv } from './env.js';
import { modelData, RIGS, scaleOf } from './models.js';
import { poseBuffer, pose } from './anim.js';
import { PAL } from '../art/palette.js';

export const PPU = 32;                       // baked pixels per world unit (= per tile)
export const ELEV = 40 * Math.PI / 180;      // camera elevation above the ground plane
const SIN_E = Math.sin(ELEV), COS_E = Math.cos(ELEV);
const DIST = 100, NEAR = 60, FAR = 130;
const MARGIN = 1.2;                          // world units of paper around the map

const state = {
  ready: false,
  scene: null,      // scene program
  blit: null,       // background blit program
  view: mat4(),
  proj: mat4(),
  model: mat4(),
  parts: poseBuffer(),
  models: new Map(),
  bake: null,       // { target, left, bottom, width, height, mapId }
  viewW: 0,
  viewH: 0,
  cam: { x: 0, y: 0 },
  ink: rgb(PAL.K),
  paper: rgb(PAL.W),
};

// -------------------------------------------------------------- camera math

/** World point -> camera space. z is the view depth (bigger = further away). */
export const camX = (x) => x;
export const camY = (y, z) => y * COS_E - z * SIN_E;

export function initField(viewW, viewH) {
  if (state.ready) return true;
  if (!initGL(viewW, viewH)) return false;
  try {
    state.scene = program(SCENE_VS, SCENE_FS, 'scene');
    state.blit = program(BLIT_VS, BLIT_FS, 'blit');
  } catch (err) {
    console.warn(err.message);
    return false;
  }
  lookAt(state.view, [0, SIN_E * DIST, COS_E * DIST], [0, 0, 0], [0, 1, 0]);
  state.viewW = viewW;
  state.viewH = viewH;
  state.ready = true;
  return true;
}

export const fieldReady = () => state.ready;

// ------------------------------------------------------------------- models

function meshFor(id) {
  if (state.models.has(id)) return state.models.get(id);
  const { data } = modelData(id);
  const mesh = uploadMesh(data, null);
  state.models.set(id, mesh);
  return mesh;
}

// --------------------------------------------------------------- background

/** Models the map and renders it once into a colour+depth target. */
export function bakeField(mapId, map, opts = {}) {
  if (!state.ready) return null;
  const gl = GL.gl;
  const env = buildEnv(map, { dark: !!opts.dark });

  // The bake always covers at least a full screen, so panning never runs off the
  // edge of the texture (a clamped sample there would smear the border pixels).
  const spanX = map.w + MARGIN * 2;
  const spanY = camY(env.maxY + 0.6, -MARGIN) - camY(0, map.h + MARGIN);
  const width = Math.min(2048, Math.max(state.viewW, Math.round(spanX * PPU)));
  const height = Math.min(2048, Math.max(state.viewH, Math.round(spanY * PPU)));
  const left = map.w / 2 - width / PPU / 2;
  const bottom = camY(0, map.h / 2) - height / PPU / 2;

  if (state.bake) deleteTarget(state.bake.target);
  const target = renderTarget(width, height);
  const proj = ortho(mat4(), left, left + width / PPU, bottom, bottom + height / PPU, NEAR, FAR);

  bindTarget(target);
  const paper = opts.dark ? rgb('#0f0d0c') : rgb(PAL.W);
  gl.clearColor(paper[0], paper[1], paper[2], 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const mesh = uploadMesh(env.data, null);
  const s = state.scene;
  gl.useProgram(s.prog);
  gl.uniformMatrix4fv(s.u.uProj, false, proj);
  gl.uniformMatrix4fv(s.u.uView, false, state.view);
  gl.uniformMatrix4fv(s.u.uModel, false, compose(state.model, {}));
  gl.uniformMatrix4fv(s.u.uParts, false, state.parts);
  gl.uniform3fv(s.u.uLightDir, [0.42, 0.86, 0.30]);
  gl.uniform3fv(s.u.uInk, state.ink);
  gl.uniform3fv(s.u.uPaper, paper);
  gl.uniform4f(s.u.uTint, 0, 0, 0, 0);
  gl.uniform3f(s.u.uFog, opts.dark ? 62 : 200, opts.dark ? 96 : 400, opts.dark ? 0.55 : 0);
  gl.uniform1f(s.u.uHatch, 0.75);
  gl.uniform1f(s.u.uAlpha, 1);
  gl.uniform1f(s.u.uUnlit, 0);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uSnap, 0);
  gl.uniform1f(s.u.uOutline, 0);

  gl.bindVertexArray(mesh.vao);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);

  // ink outline pass: expanded backfaces, the cheap toon contour
  gl.cullFace(gl.FRONT);
  gl.uniform1f(s.u.uInkOnly, 1);
  gl.uniform1f(s.u.uOutline, 0.022);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  gl.cullFace(gl.BACK);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uOutline, 0);
  gl.bindVertexArray(null);

  deleteMesh(mesh);
  bindTarget(null);

  state.bake = { target, left, bottom, width, height, mapId, dark: !!opts.dark, tris: env.tris };
  return state.bake;
}

export const bakedMapId = () => (state.bake ? state.bake.mapId : null);

// ------------------------------------------------------------------- camera

/** Centres the camera on a tile, clamped to the baked area. */
export function focusField(tileX, tileY) {
  const b = state.bake;
  if (!b) return;
  const halfW = state.viewW / PPU / 2;
  const halfH = state.viewH / PPU / 2;
  const spanX = b.width / PPU, spanY = b.height / PPU;
  let cx = camX(tileX + 0.5);
  let cy = camY(0.6, tileY + 0.5);
  cx = spanX <= halfW * 2 ? b.left + spanX / 2 : Math.max(b.left + halfW, Math.min(b.left + spanX - halfW, cx));
  cy = spanY <= halfH * 2 ? b.bottom + spanY / 2 : Math.max(b.bottom + halfH, Math.min(b.bottom + spanY - halfH, cy));
  state.cam.x = cx;
  state.cam.y = cy;
}

const viewLeft = () => state.cam.x - state.viewW / PPU / 2;
const viewBottom = () => state.cam.y - state.viewH / PPU / 2;

/** Tile coordinates -> game-screen pixels (y down), for 2D overlays and hit tests. */
export function fieldProject(tileX, tileY, height = 0) {
  const cx = camX(tileX + 0.5);
  const cy = camY(height, tileY + 0.5);
  return {
    x: (cx - viewLeft()) * PPU,
    y: state.viewH - (cy - viewBottom()) * PPU,
  };
}

/** Game-screen pixels -> tile coordinates on the ground plane. */
export function fieldUnproject(sx, sy) {
  const cx = viewLeft() + sx / PPU;
  const cy = viewBottom() + (state.viewH - sy) / PPU;
  return { x: cx - 0.5, y: -cy / SIN_E - 0.5 };
}

// -------------------------------------------------------------------- frame

/** Pastes the baked background (colour + depth) for the current camera. */
function drawBackground() {
  const gl = GL.gl;
  const b = state.bake;
  const p = state.blit;
  gl.useProgram(p.prog);
  gl.uniform4f(p.u.uRegion,
    (viewLeft() - b.left) / (b.width / PPU),
    (viewBottom() - b.bottom) / (b.height / PPU),
    (state.viewW / PPU) / (b.width / PPU),
    (state.viewH / PPU) / (b.height / PPU));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, b.target.color);
  gl.uniform1i(p.u.uColorTex, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, b.target.depth);
  gl.uniform1i(p.u.uDepthTex, 1);
  gl.disable(gl.CULL_FACE);
  gl.depthFunc(gl.ALWAYS);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
}

const FACING_ANGLE = { down: 0, up: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 };

/**
 * Draws one character.
 * @param {{model: string, x: number, y: number, facing: string, clip?: string,
 *          t?: number, phase?: number, tint?: number[], alpha?: number, lift?: number}} a
 */
export function drawCharacter(a) {
  const gl = GL.gl;
  const s = state.scene;
  const rigId = RIGS[a.model] ? a.model : 'villager';
  const mesh = meshFor(a.model);
  const scale = (a.scale || 1) * scaleOf(a.model);
  pose(state.parts, rigId, { clip: a.clip, t: a.t || 0, phase: a.phase });
  compose(state.model, {
    x: a.x + 0.5, y: a.lift || 0, z: a.y + 0.5,
    ry: FACING_ANGLE[a.facing] ?? 0,
    sx: scale, sy: scale, sz: scale,
  });
  gl.useProgram(s.prog);
  gl.uniformMatrix4fv(s.u.uModel, false, state.model);
  gl.uniformMatrix4fv(s.u.uParts, false, state.parts);
  const tint = a.tint || null;
  gl.uniform4f(s.u.uTint, tint ? tint[0] : 0, tint ? tint[1] : 0, tint ? tint[2] : 0, tint ? tint[3] : 0);
  gl.uniform1f(s.u.uAlpha, a.alpha ?? 1);
  gl.bindVertexArray(mesh.vao);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  // ink contour
  gl.cullFace(gl.FRONT);
  gl.uniform1f(s.u.uInkOnly, 1);
  gl.uniform1f(s.u.uOutline, 0.018);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  gl.cullFace(gl.BACK);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uOutline, 0);
  gl.bindVertexArray(null);
}

/** Begins a field frame: background pasted, scene program primed for characters. */
export function beginFieldFrame() {
  const gl = GL.gl;
  const b = state.bake;
  if (!b) return false;
  bindTarget(null);
  gl.clearColor(state.paper[0], state.paper[1], state.paper[2], 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawBackground();

  const s = state.scene;
  const proj = ortho(state.proj, viewLeft(), viewLeft() + state.viewW / PPU,
    viewBottom(), viewBottom() + state.viewH / PPU, NEAR, FAR);
  gl.useProgram(s.prog);
  gl.uniformMatrix4fv(s.u.uProj, false, proj);
  gl.uniformMatrix4fv(s.u.uView, false, state.view);
  gl.uniform3fv(s.u.uLightDir, [0.42, 0.86, 0.30]);
  gl.uniform3fv(s.u.uInk, state.ink);
  gl.uniform3fv(s.u.uPaper, b.dark ? rgb('#0f0d0c') : state.paper);
  gl.uniform3f(s.u.uFog, b.dark ? 62 : 200, b.dark ? 96 : 400, b.dark ? 0.5 : 0);
  gl.uniform1f(s.u.uHatch, 0.6);
  gl.uniform1f(s.u.uUnlit, 0);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uOutline, 0);
  gl.uniform1f(s.u.uSnap, 260);      // PS1 vertex wobble, tuned to the 360px field
  gl.uniform1f(s.u.uAlpha, 1);
  return true;
}

/** Hands the finished 3D frame to the 2D canvas the UI is drawn on. */
export function compositeField(ctx) {
  ctx.drawImage(GL.canvas, 0, 0);
}

export function disposeField() {
  if (state.bake) deleteTarget(state.bake.target);
  state.bake = null;
}

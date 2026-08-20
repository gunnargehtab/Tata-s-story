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
 *
 * What *does* change between maps is the camera distance. Each map declares the
 * kind of space it is (`space` in maps.js) and the camera frames it to match:
 * tight in Tata's room so the walls press in, pulled far back in the village so
 * she is small under the sky, and somewhere between in the well. The camera also
 * follows on a spring with a little look-ahead instead of bolting to the player,
 * and characters turn through their facing rather than snapping to it — both
 * halves of issue #8.
 */
import { GL, initGL, program, uploadMesh, deleteMesh, renderTarget, deleteTarget, bindTarget, rgb } from './gl.js';
import { SCENE_VS, SCENE_FS, BLIT_VS, BLIT_FS } from './shaders.js';
import { mat4, ortho, lookAt, compose } from './math.js';
import { buildEnv } from './env.js';
import { modelData, RIGS, scaleOf } from './models.js';
import { poseBuffer, pose } from './anim.js';
import { PAL } from '../art/palette.js';

export const BASE_PPU = 32;                  // the reference framing: 32 baked px per tile
export const ELEV = 40 * Math.PI / 180;      // camera elevation above the ground plane
const SIN_E = Math.sin(ELEV), COS_E = Math.cos(ELEV);
const DIST = 100, NEAR = 60, FAR = 130;
const MARGIN = 1.2;                          // world units of paper around the map

/*
 * The camera grammar. `ppu` is the baked pixels per tile — bigger means the
 * camera is closer. `look` is how far (in tiles) the camera leads a moving
 * player: barely at all in a room, most of a tile in open country. The
 * vignette and grain give each kind of space its own weight on the page.
 */
const SPACES = {
  room:   { ppu: 46, look: 0.35, vignette: 0.30, grain: 0.05, paper: '#f3ead8' },
  hall:   { ppu: 38, look: 0.55, vignette: 0.30, grain: 0.05 },
  cavern: { ppu: 36, look: 0.55, vignette: 0.44, grain: 0.06 },
  town:   { ppu: 26, look: 0.95, vignette: 0.15, grain: 0.04 },
  wild:   { ppu: 28, look: 0.85, vignette: 0.22, grain: 0.05 },
};
const spaceFor = (map) => SPACES[map.space] || (map.w * map.h <= 130 ? SPACES.room : SPACES.town);

const CAM_RATE = 6;        // camera spring stiffness (1/s)
const TURN_RATE = 11;      // how fast a body swings onto a new facing (1/s)

const state = {
  ready: false,
  scene: null,      // scene program
  blit: null,       // background blit program
  view: mat4(),
  proj: mat4(),
  model: mat4(),
  parts: poseBuffer(),
  models: new Map(),
  cast: new Map(),  // per-character smoothing: key -> { yaw, lean }
  bake: null,       // { target, left, bottom, width, height, mapId }
  space: SPACES.town,
  ppu: BASE_PPU,
  dt: 1 / 60,
  viewW: 0,
  viewH: 0,
  cam: { x: 0, y: 0, snap: true },
  overlay: null,    // vignette + paper grain, rebuilt when the space changes
  overlayKey: '',
  ink: rgb(PAL.K),
  paper: rgb(PAL.W),
  paperCol: rgb(PAL.W),
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

/** Current camera distance, as baked pixels per tile. The 2D overlays scale by this. */
export const fieldPPU = () => state.ppu;

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
  const space = spaceFor(map);
  const ppu = space.ppu;

  // The bake always covers at least a full screen, so panning never runs off the
  // edge of the texture (a clamped sample there would smear the border pixels).
  const spanX = map.w + MARGIN * 2;
  const spanY = camY(env.maxY + 0.6, -MARGIN) - camY(0, map.h + MARGIN);
  const width = Math.min(2048, Math.max(state.viewW, Math.round(spanX * ppu)));
  const height = Math.min(2048, Math.max(state.viewH, Math.round(spanY * ppu)));
  const left = map.w / 2 - width / ppu / 2;
  const bottom = camY(0, map.h / 2) - height / ppu / 2;

  if (state.bake) deleteTarget(state.bake.target);
  const target = renderTarget(width, height);
  const proj = ortho(mat4(), left, left + width / ppu, bottom, bottom + height / ppu, NEAR, FAR);

  bindTarget(target);
  const paper = opts.dark ? rgb('#0f0d0c') : rgb(space.paper || PAL.W);
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

  state.space = space;
  state.ppu = ppu;
  state.paperCol = paper;
  state.cast.clear();
  state.cam.snap = true;    // a new scene cuts, it doesn't pan
  state.bake = { target, left, bottom, width, height, mapId, dark: !!opts.dark, tris: env.tris };
  return state.bake;
}

export const bakedMapId = () => (state.bake ? state.bake.mapId : null);

// ------------------------------------------------------------------- camera

/**
 * Aims the camera at a tile, clamped to the baked area, and eases towards it
 * on a critically-damped spring. `look` is a unit-ish direction the camera
 * leads by while the player is moving (scaled per space). On a fresh bake the
 * camera snaps — a scene change is a cut, not a pan.
 */
export function focusField(tileX, tileY, dt = 0, look = null) {
  const b = state.bake;
  if (!b) return;
  state.dt = dt > 0 ? Math.min(dt, 0.1) : state.dt;
  const ppu = state.ppu;
  const lead = state.space.look;
  const halfW = state.viewW / ppu / 2;
  const halfH = state.viewH / ppu / 2;
  const spanX = b.width / ppu, spanY = b.height / ppu;
  let cx = camX(tileX + 0.5 + (look ? look.x * lead : 0));
  let cy = camY(0.6, tileY + 0.5 + (look ? look.y * lead : 0));
  cx = spanX <= halfW * 2 ? b.left + spanX / 2 : Math.max(b.left + halfW, Math.min(b.left + spanX - halfW, cx));
  cy = spanY <= halfH * 2 ? b.bottom + spanY / 2 : Math.max(b.bottom + halfH, Math.min(b.bottom + spanY - halfH, cy));
  if (state.cam.snap || !(dt > 0)) {
    state.cam.x = cx;
    state.cam.y = cy;
    state.cam.snap = false;
    return;
  }
  const k = 1 - Math.exp(-dt * CAM_RATE);
  state.cam.x += (cx - state.cam.x) * k;
  state.cam.y += (cy - state.cam.y) * k;
}

const viewLeft = () => state.cam.x - state.viewW / state.ppu / 2;
const viewBottom = () => state.cam.y - state.viewH / state.ppu / 2;

/** Tile coordinates -> game-screen pixels (y down), for 2D overlays and hit tests. */
export function fieldProject(tileX, tileY, height = 0) {
  const cx = camX(tileX + 0.5);
  const cy = camY(height, tileY + 0.5);
  return {
    x: (cx - viewLeft()) * state.ppu,
    y: state.viewH - (cy - viewBottom()) * state.ppu,
  };
}

/** Game-screen pixels -> tile coordinates on the ground plane. */
export function fieldUnproject(sx, sy) {
  const cx = viewLeft() + sx / state.ppu;
  const cy = viewBottom() + (state.viewH - sy) / state.ppu;
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
    (viewLeft() - b.left) / (b.width / state.ppu),
    (viewBottom() - b.bottom) / (b.height / state.ppu),
    (state.viewW / state.ppu) / (b.width / state.ppu),
    (state.viewH / state.ppu) / (b.height / state.ppu));
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
const wrapAngle = (a) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

/**
 * Draws one character: a soft contact shadow flattened onto the floor, then the
 * body, then the ink contour. When `key` names the character across frames, its
 * yaw eases through turns (banking slightly into them) instead of snapping
 * between the four facings.
 * @param {{model: string, x: number, y: number, facing: string, key?: string,
 *          clip?: string, t?: number, phase?: number, tint?: number[],
 *          alpha?: number, lift?: number, shadow?: boolean}} a
 */
export function drawCharacter(a) {
  const gl = GL.gl;
  const s = state.scene;
  const rigId = RIGS[a.model] ? a.model : 'villager';
  const mesh = meshFor(a.model);
  const scale = (a.scale || 1) * scaleOf(a.model);
  pose(state.parts, rigId, { clip: a.clip, t: a.t || 0, phase: a.phase });

  let yaw = FACING_ANGLE[a.facing] ?? 0;
  let lean = 0;
  if (a.key) {
    let e = state.cast.get(a.key);
    if (!e) { e = { yaw, lean: 0 }; state.cast.set(a.key, e); }
    const d = wrapAngle(yaw - e.yaw);
    e.yaw = wrapAngle(e.yaw + d * (1 - Math.exp(-state.dt * TURN_RATE)));
    // bank into whatever part of the turn is still to come
    const targetLean = Math.max(-0.16, Math.min(0.16, d * 0.4));
    e.lean += (targetLean - e.lean) * (1 - Math.exp(-state.dt * 9));
    yaw = e.yaw;
    lean = e.lean;
  }

  const alpha = a.alpha ?? 1;
  const lift = a.lift || 0;
  gl.useProgram(s.prog);
  gl.uniformMatrix4fv(s.u.uParts, false, state.parts);

  // contact shadow: the posed mesh squashed onto the floor, drawn as translucent
  // ink with no depth write, so it hugs whatever the character stands over
  const shadowAlpha = a.shadow === false ? 0 : 0.18 * alpha / (1 + lift * 1.5);
  if (shadowAlpha > 0.02) {
    compose(state.model, {
      x: a.x + 0.5, y: 0.015, z: a.y + 0.5, ry: yaw,
      sx: scale, sy: 0.05 * scale, sz: scale,
    });
    gl.uniformMatrix4fv(s.u.uModel, false, state.model);
    gl.uniform1f(s.u.uInkOnly, 1);
    gl.uniform1f(s.u.uAlpha, shadowAlpha);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.uniform1f(s.u.uInkOnly, 0);
  }

  compose(state.model, {
    x: a.x + 0.5, y: lift, z: a.y + 0.5,
    ry: yaw, rz: lean,
    sx: scale, sy: scale, sz: scale,
  });
  gl.uniformMatrix4fv(s.u.uModel, false, state.model);
  const tint = a.tint || null;
  gl.uniform4f(s.u.uTint, tint ? tint[0] : 0, tint ? tint[1] : 0, tint ? tint[2] : 0, tint ? tint[3] : 0);
  gl.uniform1f(s.u.uAlpha, alpha);
  if (alpha < 1) {
    // ghosts and fades actually blend now instead of rendering solid
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
  }
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
  if (alpha < 1) {
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }
  gl.bindVertexArray(null);
}

/** Begins a field frame: background pasted, scene program primed for characters. */
export function beginFieldFrame() {
  const gl = GL.gl;
  const b = state.bake;
  if (!b) return false;
  bindTarget(null);
  gl.clearColor(state.paperCol[0], state.paperCol[1], state.paperCol[2], 1);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawBackground();

  const s = state.scene;
  const proj = ortho(state.proj, viewLeft(), viewLeft() + state.viewW / state.ppu,
    viewBottom(), viewBottom() + state.viewH / state.ppu, NEAR, FAR);
  gl.useProgram(s.prog);
  gl.uniformMatrix4fv(s.u.uProj, false, proj);
  gl.uniformMatrix4fv(s.u.uView, false, state.view);
  gl.uniform3fv(s.u.uLightDir, [0.42, 0.86, 0.30]);
  gl.uniform3fv(s.u.uInk, state.ink);
  gl.uniform3fv(s.u.uPaper, state.paperCol);
  gl.uniform3f(s.u.uFog, b.dark ? 62 : 200, b.dark ? 96 : 400, b.dark ? 0.5 : 0);
  gl.uniform1f(s.u.uHatch, 0.6);
  gl.uniform1f(s.u.uUnlit, 0);
  gl.uniform1f(s.u.uInkOnly, 0);
  gl.uniform1f(s.u.uOutline, 0);
  gl.uniform1f(s.u.uSnap, 260);      // PS1 vertex wobble, tuned to the 360px field
  gl.uniform1f(s.u.uAlpha, 1);
  return true;
}

// ----------------------------------------------------------- finishing pass

/**
 * The static finishing layer: paper grain over the whole page and a vignette
 * whose weight comes from the space — faint in the open, closing in tight in
 * the well. Rebuilt only when the space (or darkness) changes.
 */
function frameOverlay() {
  const key = `${state.space.ppu}|${state.bake && state.bake.dark ? 1 : 0}`;
  if (state.overlay && state.overlayKey === key) return state.overlay;
  const W = state.viewW, H = state.viewH;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  let seed = 987654321;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.fillStyle = PAL.k;
  c.globalAlpha = state.space.grain;
  for (let i = 0; i < 1600; i++) {
    c.fillRect(rnd() * W, rnd() * H, rnd() < 0.15 ? 2 : 1, 1);
  }
  c.globalAlpha = 1;

  const dark = state.bake && state.bake.dark;
  const strength = state.space.vignette * (dark ? 1.35 : 1);
  const g = c.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.42, W / 2, H * 0.5, Math.hypot(W, H) * 0.58);
  g.addColorStop(0, 'rgba(20,17,15,0)');
  g.addColorStop(1, `rgba(20,17,15,${strength.toFixed(3)})`);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  state.overlay = cv;
  state.overlayKey = key;
  return cv;
}

/** Hands the finished 3D frame to the 2D canvas the UI is drawn on. */
export function compositeField(ctx) {
  ctx.drawImage(GL.canvas, 0, 0);
  ctx.drawImage(frameOverlay(), 0, 0);
}

export function disposeField() {
  if (state.bake) deleteTarget(state.bake.target);
  state.bake = null;
  state.cast.clear();
}

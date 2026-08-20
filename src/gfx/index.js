/*
 * Public face of the 2.5D renderer.
 *
 * The game keeps its 2D sprite renderer as a fallback: if WebGL2 is missing or a
 * shader refuses to compile, `gfxEnabled()` stays false and every caller quietly
 * takes the old path. Nothing else in the game needs to know which one is live.
 */
import { GL, initGL } from './gl.js';
import { initField, fieldReady, disposeField } from './field.js';
import { initBattle3D, battle3DReady, drawBattleScene as drawBattle3D } from './battle3d.js';
import { drawWorld3D as drawField3D } from './worldview.js';

const state = { tried: false, on: false, wanted: true };

export function initGfx(viewW, viewH) {
  if (state.tried) return state.on;
  state.tried = true;
  try {
    state.on = initGL(viewW, viewH) && initField(viewW, viewH) && initBattle3D(viewW, viewH);
  } catch (err) {
    console.warn('[gfx] falling back to the 2D renderer:', err.message);
    state.on = false;
  }
  if (!state.on && GL.reason) console.info(`[gfx] ${GL.reason} — using the 2D sprite renderer`);
  return state.on;
}

export const gfxEnabled = () => state.on && state.wanted && fieldReady() && battle3DReady();

/** Lets the player (or a debug key) drop back to the pixel-art renderer. */
export function setGfxEnabled(on) {
  state.wanted = !!on;
  if (!state.wanted) disposeField();
  return gfxEnabled();
}

/**
 * Any WebGL failure mid-game (context loss, an out-of-memory render target) drops
 * the whole renderer rather than killing the frame loop: the game keeps running
 * on sprites.
 */
function guarded(fn, onFail) {
  return (...args) => {
    if (!gfxEnabled()) return onFail;
    try {
      return fn(...args);
    } catch (err) {
      console.warn('[gfx] disabled after a render error:', err.message);
      state.on = false;
      return onFail;
    }
  };
}

export const drawWorld3D = guarded(drawField3D, false);
export const drawBattleScene = guarded(drawBattle3D, null);

export { fieldProject, fieldUnproject } from './field.js';
export { fxAct, fxHit, fxImpact, resetBattleFx } from './battle3d.js';

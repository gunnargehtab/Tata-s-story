/*
 * Screen-level polish: scene transitions and the low-health vignette.
 *
 * A transition is ink crossing the page — a wipe when Tata walks through a
 * door, an iris when a fight starts. The scene change itself happens at the
 * midpoint, under full ink, so the new map never pops in half-drawn.
 */
import { PAL } from '../art/palette.js';
import { VIEW } from './ui.js';

const Trans = {
  kind: null,       // 'wipe' | 'iris'
  t: 0,             // 0 → 1 across the whole transition
  dur: 0.6,
  onMid: null,
  fired: false,
};

export const transitionActive = () => Trans.kind !== null;

/** Starts a transition; `onMid` runs once, at full cover. No-op while one runs. */
export function startTransition(kind, onMid, dur = 0.6) {
  if (Trans.kind) { if (onMid) onMid(); return; }
  Trans.kind = kind;
  Trans.t = 0;
  Trans.dur = dur;
  Trans.onMid = onMid || null;
  Trans.fired = false;
}

export function updateTransition(dt) {
  if (!Trans.kind) return;
  Trans.t += dt / Trans.dur;
  if (!Trans.fired && Trans.t >= 0.5) {
    Trans.fired = true;
    const cb = Trans.onMid;
    Trans.onMid = null;
    if (cb) cb();
  }
  if (Trans.t >= 1) Trans.kind = null;
}

export function drawTransition(ctx) {
  if (!Trans.kind) return;
  const t = Math.min(1, Trans.t);
  ctx.save();
  ctx.fillStyle = PAL.K;

  if (Trans.kind === 'wipe') {
    // a brush stroke crossing the page: cover left→right, uncover behind it
    const W = VIEW.width, H = VIEW.height;
    const bands = 8;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    for (let i = 0; i < bands; i++) {
      const y = (H / bands) * i;
      const lag = (i % 3) * 0.05;                     // ragged leading edge
      // ×2.4 leaves headroom so every band is fully inked at the midpoint
      if (t < 0.5) ctx.fillRect(0, y, W * clamp01(t * 2.4 - lag), H / bands + 1);
      else {
        const q = clamp01((t - 0.5) * 2.4 - lag);
        ctx.fillRect(W * q, y, W * (1 - q), H / bands + 1);
      }
    }
  } else {
    // iris: a circle of paper shrinking to nothing, then opening again
    const W = VIEW.width, H = VIEW.height;
    const maxR = Math.hypot(W, H) * 0.55;
    // fully shut from 0.45 to 0.55, so the swap happens under complete ink
    const r = t < 0.5 ? maxR * Math.max(0, 1 - t / 0.45) : maxR * Math.min(1, Math.max(0, (t - 0.55) / 0.45));
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H * 0.45, Math.max(0, r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }
  ctx.restore();
}

/**
 * The page bleeds red at the edges when Tata is low. Drawn from cheap rects,
 * not gradients — it flickers slightly with `time`, like a held breath.
 */
export function drawLowHp(ctx, ratio, time) {
  if (ratio > 0.28) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.4);
  const a = (0.16 + 0.1 * pulse) * (1 - ratio / 0.28);
  const W = VIEW.width, H = VIEW.height;
  ctx.globalAlpha = a;
  ctx.fillStyle = PAL.R;
  for (let i = 0; i < 4; i++) {
    const w = 10 - i * 2;
    ctx.fillRect(0, 0, W, w); ctx.fillRect(0, H - w, W, w);
    ctx.fillRect(0, 0, w, H); ctx.fillRect(W - w, 0, w, H);
  }
  ctx.globalAlpha = 1;
}

import { PAL } from '../art/palette.js';
import { PAD, BTN } from './input.js';

export const VIEW = { width: 360, height: 640 };
export const WORLD_SCALE = 2; // tiles are 16px art drawn at 32px on screen

const FONT = (size, bold) => `${bold ? 'bold ' : ''}${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

/** Ink-drawn panel: paper fill, doubled hand-wobbled border (gameplan §6 UI). */
export function inkPanel(ctx, x, y, w, h, { fill = PAL.W, ink = PAL.K } = {}) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ink;
  ctx.fillRect(x, y, w, 3);
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.fillRect(x, y, 3, h);
  ctx.fillRect(x + w - 3, y, 3, h);
  // inner hairline, offset like a second pen pass
  ctx.fillRect(x + 5, y + 5, w - 10, 1);
  ctx.fillRect(x + 5, y + h - 6, w - 10, 1);
  ctx.fillRect(x + 5, y + 5, 1, h - 10);
  ctx.fillRect(x + w - 6, y + 5, 1, h - 10);
}

export function text(ctx, str, x, y, { size = 12, color = PAL.K, align = 'left', bold = false } = {}) {
  ctx.font = FONT(size, bold);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function wrap(ctx, str, maxWidth, size = 12) {
  ctx.font = FONT(size, false);
  const out = [];
  for (const paragraph of String(str).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const attempt = line ? `${line} ${word}` : word;
      if (ctx.measureText(attempt).width > maxWidth && line) { out.push(line); line = word; }
      else line = attempt;
    }
    out.push(line);
  }
  return out;
}

/** Touch controls, drawn in the same rects input.js hit-tests. */
export function drawControls(ctx, { pad = true, action = true, actionLabel = 'A', menu = true, menuLabel = 'NOTE' } = {}) {
  ctx.globalAlpha = 0.55;
  if (pad) {
    for (const key of Object.keys(PAD)) {
      const b = PAD[key];
      ctx.fillStyle = PAL.W; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PAL.K;
      ctx.fillRect(b.x, b.y, b.w, 3); ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3);
      ctx.fillRect(b.x, b.y, 3, b.h); ctx.fillRect(b.x + b.w - 3, b.y, 3, b.h);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      ctx.beginPath();
      if (key === 'up') { ctx.moveTo(cx, cy - 8); ctx.lineTo(cx - 8, cy + 6); ctx.lineTo(cx + 8, cy + 6); }
      if (key === 'down') { ctx.moveTo(cx, cy + 8); ctx.lineTo(cx - 8, cy - 6); ctx.lineTo(cx + 8, cy - 6); }
      if (key === 'left') { ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 6, cy - 8); ctx.lineTo(cx + 6, cy + 8); }
      if (key === 'right') { ctx.moveTo(cx + 8, cy); ctx.lineTo(cx - 6, cy - 8); ctx.lineTo(cx - 6, cy + 8); }
      ctx.closePath(); ctx.fill();
    }
  }
  if (action) {
    const b = BTN.action;
    inkPanel(ctx, b.x, b.y, b.w, b.h);
    text(ctx, actionLabel, b.x + b.w / 2, b.y + b.h / 2 - 7, { size: 13, align: 'center', bold: true });
  }
  if (menu) {
    const b = BTN.menu;
    inkPanel(ctx, b.x, b.y, b.w, b.h);
    text(ctx, menuLabel, b.x + b.w / 2, b.y + b.h / 2 - 6, { size: 11, align: 'center', bold: true });
  }
  ctx.globalAlpha = 1;
}

/** Horizontal stat bar with an ink frame (HP / FOC). */
export function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = PAL.K; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.w; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, ratio)))), h - 2);
}

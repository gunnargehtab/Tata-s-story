import { PAL } from './palette.js';

/**
 * Compiles a string-grid sprite into a canvas.
 * Rows are padded to the longest row, so hand-drawn art is forgiving.
 * `overrides` remaps palette keys per instance (used for NPC colour variants).
 */
export function compile(rows, overrides = null) {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '.';
      const hex = (overrides && overrides[ch]) || PAL[ch];
      if (!hex) continue;
      const i = (y * w + x) * 4;
      img.data[i] = parseInt(hex.slice(1, 3), 16);
      img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
      img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Crops fully transparent rows/columns — keeps big art from floating in its own padding. */
export function trim(src) {
  const ctx = src.getContext('2d');
  const { data } = ctx.getImageData(0, 0, src.width, src.height);
  let top = src.height, bottom = -1, left = src.width, right = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (data[(y * src.width + x) * 4 + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return src;
  const w = right - left + 1, h = bottom - top + 1;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(src, left, top, w, h, 0, 0, w, h);
  return cv;
}

/** Copies a canvas and shifts the bottom `n` rows sideways: the 2-frame walk shuffle. */
export function shuffleFrame(src, legRows, dx) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0, src.width, src.height - legRows, 0, 0, src.width, src.height - legRows);
  ctx.drawImage(src, 0, src.height - legRows, src.width, legRows, dx, src.height - legRows, src.width, legRows);
  return cv;
}

/** Mirrors a canvas horizontally (side-facing sprites are drawn once). */
export function flip(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return cv;
}

/** Idle "hat tilt": nudges the top `n` rows one pixel sideways. */
export function tiltFrame(src, hatRows, dx) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, hatRows, src.width, src.height - hatRows, 0, hatRows, src.width, src.height - hatRows);
  ctx.drawImage(src, 0, 0, src.width, hatRows, dx, 0, src.width, hatRows);
  return cv;
}

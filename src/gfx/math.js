/*
 * Just enough linear algebra for the field and battle cameras.
 * Matrices are column-major Float32Array(16), the layout WebGL expects.
 */

export function mat4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

/** out = a * b (apply b first, then a). Safe when out aliases a or b. */
export function multiply(out, a, b) {
  const t = MUL_TMP;
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      t[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  out.set(t);
  return out;
}
const MUL_TMP = new Float32Array(16);

export function ortho(out, left, right, bottom, top, near, far) {
  identity(out);
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = -2 / (far - near);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = -(far + near) / (far - near);
  return out;
}

export function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function translation(out, x, y, z) {
  identity(out);
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function scaling(out, x, y, z) {
  identity(out);
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

export function rotationX(out, a) {
  identity(out);
  const c = Math.cos(a), s = Math.sin(a);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

export function rotationY(out, a) {
  identity(out);
  const c = Math.cos(a), s = Math.sin(a);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function rotationZ(out, a) {
  identity(out);
  const c = Math.cos(a), s = Math.sin(a);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

/** Translate * RotY * RotX * RotZ * Scale — the only compose order the models need. */
export function compose(out, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1 }) {
  const t = COMPOSE_A, r = COMPOSE_B;
  translation(out, x, y, z);
  if (ry) multiply(out, out, rotationY(t, ry));
  if (rx) multiply(out, out, rotationX(t, rx));
  if (rz) multiply(out, out, rotationZ(t, rz));
  if (sx !== 1 || sy !== 1 || sz !== 1) multiply(out, out, scaling(r, sx, sy, sz));
  return out;
}
const COMPOSE_A = new Float32Array(16);
const COMPOSE_B = new Float32Array(16);

export function lookAt(out, eye, target, up = [0, 1, 0]) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

export function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

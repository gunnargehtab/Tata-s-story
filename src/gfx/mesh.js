/*
 * A tiny polygon builder. Everything in the game is made of boxes, frusta,
 * prisms and low-segment cylinders — the PS1-era budget the gameplan asks for
 * (300–800 triangles a character). Faces are emitted unindexed with a flat
 * per-face normal, which is exactly what the banded toon shader wants.
 */
import { mat4, identity, multiply, compose } from './math.js';
import { rgb } from './gl.js';

const FLOATS_PER_VERTEX = 10;   // pos3 + normal3 + colour3 + part1

export class MeshBuilder {
  constructor() {
    this.data = [];
    this.stack = [identity(mat4())];
    this.curColor = [0.6, 0.6, 0.6];
    this.curPart = 0;
    this.tris = 0;
  }

  get transform() { return this.stack[this.stack.length - 1]; }

  push(trs) {
    const m = mat4();
    compose(m, trs);
    multiply(m, this.transform, m);
    this.stack.push(m);
    return this;
  }

  pop() {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  color(c) {
    this.curColor = typeof c === 'string' ? rgb(c) : c;
    return this;
  }

  part(i) { this.curPart = i; return this; }

  // ---------------------------------------------------------------- points

  xform(p) {
    const m = this.transform;
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  }

  /** Triangle in the builder's current space. Winding decides the facing. */
  tri(a, b, c, color = null) {
    const p0 = this.xform(a), p1 = this.xform(b), p2 = this.xform(c);
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const col = color ? (typeof color === 'string' ? rgb(color) : color) : this.curColor;
    for (const p of [p0, p1, p2]) {
      this.data.push(p[0], p[1], p[2], nx, ny, nz, col[0], col[1], col[2], this.curPart);
    }
    this.tris++;
    return this;
  }

  quad(a, b, c, d, color = null) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
    return this;
  }

  // ------------------------------------------------------------ primitives

  /**
   * Box or frustum. `x,y,z` is the centre; `ty`/`tz` taper the top face, which
   * is how the blocky torsos and wide hat crowns get their silhouette.
   */
  box({ x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, ry = 0, rx = 0, rz = 0, taperX = 1, taperZ = 1, color = null, skipBottom = false }) {
    this.push({ x, y, z, ry, rx, rz });
    const hw = w / 2, hd = d / 2, hh = h / 2;
    const tw = hw * taperX, td = hd * taperZ;
    const b0 = [-hw, -hh, hd], b1 = [hw, -hh, hd], b2 = [hw, -hh, -hd], b3 = [-hw, -hh, -hd];
    const t0 = [-tw, hh, td], t1 = [tw, hh, td], t2 = [tw, hh, -td], t3 = [-tw, hh, -td];
    this.quad(b0, b1, t1, t0, color);   // front (+z)
    this.quad(b1, b2, t2, t1, color);   // right (+x)
    this.quad(b2, b3, t3, t2, color);   // back (-z)
    this.quad(b3, b0, t0, t3, color);   // left (-x)
    this.quad(t0, t1, t2, t3, color);   // top
    if (!skipBottom) this.quad(b3, b2, b1, b0, color);
    this.pop();
    return this;
  }

  /** Ridged roof / wedge. Ridge runs along z. */
  prism({ x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, ry = 0, overhang = 0, color = null }) {
    this.push({ x, y, z, ry });
    const hw = w / 2 + overhang, hd = d / 2 + overhang, hh = h / 2;
    const a = [-hw, -hh, hd], b = [hw, -hh, hd], c = [hw, -hh, -hd], e = [-hw, -hh, -hd];
    const r0 = [0, hh, hd], r1 = [0, hh, -hd];
    this.tri(a, b, r0, color);           // front gable
    this.tri(c, e, r1, color);
    this.quad(b, c, r1, r0, color);      // right slope
    this.quad(e, a, r0, r1, color);      // left slope
    this.quad(e, c, b, a, color);        // underside
    this.pop();
    return this;
  }

  /** Low-segment cylinder / cone. `rTop = 0` gives a cone. */
  cylinder({ x = 0, y = 0, z = 0, r = 0.5, rTop = null, h = 1, segments = 8, ry = 0, color = null, caps = true }) {
    const top = rTop === null ? r : rTop;
    this.push({ x, y, z, ry });
    const hh = h / 2;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p0 = [c0 * r, -hh, s0 * r], p1 = [c1 * r, -hh, s1 * r];
      const q0 = [c0 * top, hh, s0 * top], q1 = [c1 * top, hh, s1 * top];
      if (top === 0) this.tri(p1, p0, [0, hh, 0], color);
      else this.quad(p1, p0, q0, q1, color);
      if (caps) {
        if (top > 0) this.tri(q1, q0, [0, hh, 0], color);
        this.tri([0, -hh, 0], p0, p1, color);
      }
    }
    this.pop();
    return this;
  }

  /** Flat ground quad in the XZ plane, y up. */
  plane({ x = 0, y = 0, z = 0, w = 1, d = 1, color = null }) {
    const hw = w / 2, hd = d / 2;
    this.push({ x, y, z });
    this.quad([-hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], color);
    this.pop();
    return this;
  }

  /** A billboard-ish upright card, used for foliage clusters and rift sheets. */
  card({ x = 0, y = 0, z = 0, w = 1, h = 1, ry = 0, color = null, doubleSided = true }) {
    this.push({ x, y, z, ry });
    const hw = w / 2;
    this.quad([-hw, 0, 0], [hw, 0, 0], [hw, h, 0], [-hw, h, 0], color);
    if (doubleSided) this.quad([hw, 0, 0], [-hw, 0, 0], [-hw, h, 0], [hw, h, 0], color);
    this.pop();
    return this;
  }

  merge(other) {
    for (const v of other.data) this.data.push(v);
    this.tris += other.tris;
    return this;
  }

  build() {
    return new Float32Array(this.data);
  }

  get vertexCount() { return this.data.length / FLOATS_PER_VERTEX; }
}

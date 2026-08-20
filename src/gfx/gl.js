/*
 * The thin WebGL2 layer. No engine, no dependencies: a context on an offscreen
 * canvas, a couple of program/buffer helpers, and render targets that keep both
 * colour and depth — the depth is what lets a pre-rendered background occlude a
 * character walking behind a house, the way FFVII's field scenes did it.
 */

export const GL = {
  ok: false,
  gl: null,
  canvas: null,
  reason: '',
};

export function initGL(width, height) {
  if (GL.canvas) return GL.ok;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
  } catch { /* handled below */ }
  GL.canvas = canvas;
  if (!gl) {
    GL.reason = 'WebGL2 unavailable';
    return (GL.ok = false);
  }
  // Depth textures are core in WebGL2; float colour is not needed anywhere.
  GL.gl = gl;
  GL.ok = true;
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  return true;
}

export function resizeGL(width, height) {
  if (!GL.ok) return;
  if (GL.canvas.width === width && GL.canvas.height === height) return;
  GL.canvas.width = width;
  GL.canvas.height = height;
}

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`[gfx] ${label} shader: ${log}`);
  }
  return sh;
}

/** Compiles a program and caches every active uniform/attribute location on it. */
export function program(vsSrc, fsSrc, label = 'program') {
  const gl = GL.gl;
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, `${label} vertex`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, `${label} fragment`);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`[gfx] ${label} link: ${log}`);
  }
  const u = {};
  const uCount = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uCount; i++) {
    const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(prog, name);
  }
  const a = {};
  const aCount = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < aCount; i++) {
    const name = gl.getActiveAttrib(prog, i).name;
    a[name] = gl.getAttribLocation(prog, name);
  }
  return { prog, u, a };
}

/**
 * Uploads an interleaved mesh (pos3, normal3, colour3, part1 = 10 floats) into a
 * vertex array object. `dynamic` buffers are re-uploaded every frame (particles).
 */
export function uploadMesh(data, indices, dynamic = false) {
  const gl = GL.gl;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  const stride = 10 * 4;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 36);
  let ibo = null;
  if (indices) {
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  }
  gl.bindVertexArray(null);
  return { vao, vbo, ibo, count: indices ? indices.length : data.length / 10 };
}

export function updateMesh(mesh, data, indices) {
  const gl = GL.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  if (indices && mesh.ibo) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
    mesh.count = indices.length;
  } else {
    mesh.count = data.length / 10;
  }
}

export function deleteMesh(mesh) {
  const gl = GL.gl;
  if (!mesh) return;
  gl.deleteVertexArray(mesh.vao);
  gl.deleteBuffer(mesh.vbo);
  if (mesh.ibo) gl.deleteBuffer(mesh.ibo);
}

/** Colour + depth render target. Both attachments are textures so both are readable. */
export function renderTarget(width, height) {
  const gl = GL.gl;
  const color = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, color);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const depth = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depth);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`[gfx] render target incomplete (0x${status.toString(16)})`);
  return { fbo, color, depth, width, height };
}

export function deleteTarget(t) {
  const gl = GL.gl;
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.color);
  gl.deleteTexture(t.depth);
}

export function bindTarget(t) {
  const gl = GL.gl;
  if (t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.width, t.height);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, GL.canvas.width, GL.canvas.height);
  }
}

/** Parses '#rrggbb' into the 0..1 triple the shaders want. */
export function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

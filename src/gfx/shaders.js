/*
 * Two programs carry the whole look.
 *
 * SCENE  — flat-shaded, hard-banded toon lighting with a screen-space cross-hatch
 *          in the shadow bands (the sketchbook ink), optional PS1 vertex snapping,
 *          and a second pass over expanded backfaces for the outline.
 * BLIT   — pastes a pre-rendered background *and its baked depth* into the frame,
 *          so 3D characters are occluded by 2D scenery, FFVII-style.
 */

export const SCENE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aPart;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uParts[12];
uniform float uSnap;      // 0 = off, else the vertical grid the PS1 wobble snaps to
uniform float uOutline;   // world-space push along the normal for the ink pass

out vec3 vColor;
out vec3 vNormal;
out float vDepth;

void main() {
  mat4 m = uModel * uParts[int(aPart)];
  vec3 n = normalize(mat3(m) * aNormal);
  vec4 world = m * vec4(aPos, 1.0);
  world.xyz += n * uOutline;
  vec4 view = uView * world;
  vec4 clip = uProj * view;
  if (uSnap > 0.0) {
    vec2 grid = vec2(uSnap * 0.5);
    clip.xy = floor(clip.xy / clip.w * grid + 0.5) / grid * clip.w;
  }
  vColor = aColor;
  vNormal = n;
  vDepth = -view.z;
  gl_Position = clip;
}`;

export const SCENE_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in float vDepth;

uniform vec3 uLightDir;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec4 uTint;    // rgb + strength, used for hit flashes and rift glow
uniform vec3 uFog;     // near, far, strength — fades scenery into the paper
uniform float uInkOnly;
uniform float uUnlit;
uniform float uHatch;
uniform float uAlpha;

out vec4 frag;

float hatchMask(vec2 p, float scale, float dir) {
  float v = dir > 0.0 ? (p.x + p.y) : (p.x - p.y);
  return step(fract(v * scale), 0.34);
}

void main() {
  if (uInkOnly > 0.5) { frag = vec4(uInk, uAlpha); return; }
  vec3 col = vColor;
  if (uUnlit < 0.5) {
    float ndl = dot(normalize(vNormal), normalize(uLightDir));
    float band = ndl > 0.5 ? 1.0 : (ndl > 0.0 ? 0.80 : (ndl > -0.45 ? 0.62 : 0.48));
    col *= band;
    if (band < 0.85 && uHatch > 0.0) {
      float m = hatchMask(gl_FragCoord.xy, 0.17, 1.0);
      if (band < 0.7) m = max(m, hatchMask(gl_FragCoord.xy, 0.17, -1.0));
      col = mix(col, uInk, m * uHatch * (0.9 - band));
    }
  }
  col = mix(col, uTint.rgb, clamp(uTint.a, 0.0, 1.0));
  if (uFog.z > 0.0) {
    float f = clamp((vDepth - uFog.x) / max(0.001, uFog.y - uFog.x), 0.0, 1.0);
    col = mix(col, uPaper, f * uFog.z);
  }
  frag = vec4(col, uAlpha);
}`;

export const BLIT_VS = `#version 300 es
precision highp float;
uniform vec4 uRegion;   // uv offset (xy) and size (zw) of the visible slice
out vec2 vUV;
void main() {
  // Full-screen triangle: p is 0 or 2, so clip space spans -1..3 and the visible
  // edge (clip +1) sits at p = 1 — which is why the uv slope is uRegion.zw, not half it.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  vUV = uRegion.xy + p * uRegion.zw;
}`;

export const BLIT_FS = `#version 300 es
precision highp float;
uniform sampler2D uColorTex;
uniform sampler2D uDepthTex;
in vec2 vUV;
out vec4 frag;
void main() {
  frag = vec4(texture(uColorTex, vUV).rgb, 1.0);
  gl_FragDepth = texture(uDepthTex, vUV).r;
}`;

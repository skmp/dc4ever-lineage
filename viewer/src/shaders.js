// shaders.js: GLSL ES 3.0 sources
const HEAD = `#version 300 es
precision highp float; precision highp int;
precision highp usampler2D; precision highp usampler2DArray; precision highp sampler2D;
`;
const COMMON = `
uniform mat4 uVP; uniform vec3 uCam; uniform vec3 uFwd; uniform float uFocal;
uniform float uWX[64]; uniform float uWA[64];
vec3 pushK(vec3 p, float k) { return uCam + (p - uCam) * k; }
`;
// ---- glyph lookup shared by lines and labels ----
const GLYPH = `
uniform sampler2D uAtlas;
float glyphCov(uint ch, vec2 l) {   // l: x in cells (fract = within cell), y 0..2 top->bottom
  if (ch <= 32u) return 0.;
  float gi = float(ch - 32u);
  vec2 uv = (vec2(mod(gi, 16.), floor(gi / 16.)) + vec2(fract(l.x), l.y * 0.5)) * vec2(48. / 768., 96. / 576.);
  float sd = texture(uAtlas, uv).r;
  float apx = 48. * max(length(vec2(dFdx(l.x), dFdy(l.x))), 0.5 * length(vec2(dFdx(l.y), dFdy(l.y))));
  float w = clamp(0.55 * apx * (127. / 8.) / 255., 0.004, 0.5);
  return smoothstep(0.5 - w, 0.5 + w, sd);
}
`;

// ---- code lines (T0 glyphs + T1 bars in one program); MORPH variant reads 16-byte morph instances ----
export function lineVS(morph) {
  return HEAD + (morph ? '#define MORPH 1\n' : '') + COMMON + `
uniform usampler2D uInst; uniform usampler2D uMeta; uniform usampler2D uOffs;
uniform int uBase; uniform float uWallX; uniform float uZ0; uniform float uZ0A; uniform int uBake; uniform float uBakeW;
uniform ivec2 uHi; uniform float uMorphT; uniform int uDenseMorph; uniform int uStride;
out vec2 vL; out float vDist;
flat out uvec4 vInfo;  // id, origin, flags, keep
flat out uint vOff; flat out float vLen; flat out vec4 vTint; flat out float vAlpha; flat out float vHi;
void main() {
#ifdef MORPH
  int idx = uBase + gl_InstanceID * uStride;
#else
  int idx = uBase + gl_InstanceID;
#endif
  ivec2 tc = ivec2(idx & 4095, idx >> 12);
#ifdef MORPH
  uvec4 w = texelFetch(uInst, tc, 0);
  uint kind = (w.x >> 26) & 3u, keep = w.w & 63u, flags = 0u;
  float seed = float((w.w >> 8) & 255u) / 255.;
  uint pos = kind == 2u ? w.z : w.y;
#else
  uvec2 w = texelFetch(uInst, tc, 0).xy;
  uint pos = w.y & 0x7FFFFFu, keep = w.y >> 23, flags = w.x >> 26;
#endif
  uint id = w.x & 0xFFFFFu;
  ivec2 lc = ivec2(int(id & 2047u), int(id >> 11));
  uvec2 m = texelFetch(uMeta, lc, 0).xy;
  float ind = float(m.x), len = float(m.y & 127u);
  if (len <= ind) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec2 cr = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float xe = min(len, 124.);
  vec4 tint = vec4(0.); float alpha = 1.; float lift = 0.;
  float zCol = uZ0 + float(pos & 4095u) * 128., rowF = float((pos >> 12) & 2047u);
#ifdef MORPH
  float t = uMorphT;
  if (kind == 0u) {          // kept / moved: arc from A to B
    vec2 a = vec2(float(w.z & 4095u), float((w.z >> 12) & 2047u)), b = vec2(float(w.y & 4095u), float((w.y >> 12) & 2047u));
    float s0 = 0.2 + 0.15 * seed; float u = clamp((t - s0) / 0.45, 0., 1.); u = u * u * (3. - 2. * u);
    zCol = mix(uZ0A + a.x * 128., uZ0 + b.x * 128., u); rowF = mix(a.y, b.y, u);
    lift = sin(3.14159 * u) * (a.x != b.x || uZ0A != uZ0 ? 260. : 12.);
  } else if (kind == 2u) {   // removed: tint red, fade, collapse right to left
    zCol = uZ0A + float(w.z & 4095u) * 128.;
    float r = clamp((t - 0.05 * seed) / 0.3, 0., 1.);
    tint = vec4(1., 0.25, 0.2, 0.8); alpha = 1. - smoothstep(0.55, 1., r);
    xe = mix(xe, ind + 0.5, smoothstep(0.3, 1., r));
    if (uDenseMorph == 0) alpha = 0.;
  } else {                   // added: grow left to right in green, then settle
    float s = clamp((t - 0.6 - 0.1 * seed) / 0.28, 0., 1.);
    xe = mix(ind + 0.01, xe, s); alpha = s > 0. ? 1. : 0.;
    tint = vec4(0.35, 1., 0.45, 0.85 * (1. - smoothstep(0.85, 1., t)));
  }
#endif
  float zl = mix(ind, xe, cr.x);
  vec3 p = vec3(uWallX, 4096. - rowF * 2. - cr.y * 2. + lift, zCol + zl);
  if (uBake == 1) gl_Position = vec4((p.z - uZ0) / uBakeW * 2. - 1., p.y / 4096. * 2. - 1., 0., 1.);
  else gl_Position = uVP * vec4(p, 1.);
  vL = vec2(zl, cr.y * 2.);
  vDist = max(dot(p - uCam, uFwd), 0.5);   // view depth: projected size is uniform across a frontal wall
  vInfo = uvec4(id, (w.x >> 20) & 63u, flags, keep);
  vOff = texelFetch(uOffs, lc, 0).x; vLen = len;
  vTint = tint; vAlpha = alpha * (m.y >= 128u ? 0.75 : 1.);
  vHi = (idx >= uHi.x && idx < uHi.y) ? 1. : 0.;
}`;
}
export function lineFS() {
  return HEAD + COMMON + GLYPH + `
uniform usampler2DArray uText; uniform sampler2D uPal; uniform usampler2D uPres; uniform usampler2D uMark; uniform usampler2D uPoss;
uniform int uMode; uniform int uWall; uniform int uParent; uniform int uHideInc; uniform float uT0; uniform int uBake; uniform int uPresReady;
in vec2 vL; in float vDist;
flat in uvec4 vInfo; flat in uint vOff; flat in float vLen; flat in vec4 vTint; flat in float vAlpha; flat in float vHi;
out vec4 oC;
vec3 pal(int row, uint i) { return texelFetch(uPal, ivec2(int(i), row), 0).rgb; }
void main() {
  uint id = vInfo.x, origin = vInfo.y, flags = vInfo.z, keep = vInfo.w;
  if (uHideInc == 1 && (flags & 2u) != 0u) origin = uint(uWall);
  vec3 c;
  if (uMode == 0) c = pal(0, origin);
  else if (uMode == 1) c = pal(1, origin);
  else if (uMode == 2) {
    if (keep == 63u) c = pal(0, origin) * 0.4;
    else { float poss = float(texelFetch(uPoss, ivec2(int(origin), uWall), 0).r);
      float r = poss > 0. ? clamp(float(keep) / poss, 0., 1.) : 1.; c = pal(3, uint(r * 63. + 0.5)); }
  } else if (uMode == 3) {
    if (uParent < 0) c = vec3(0.3, 0.95, 0.4);
    else if (uPresReady == 0) c = vec3(0.45);
    else { uvec2 pr = texelFetch(uPres, ivec2(int(id & 2047u), int(id >> 11)), 0).xy;
      uint bit = uParent < 32 ? (pr.x >> uint(uParent)) & 1u : (pr.y >> uint(uParent - 32)) & 1u;
      c = bit == 1u ? vec3(0.42, 0.44, 0.48) : vec3(0.3, 0.95, 0.4); }
  } else if (uMode == 4) c = vec3(0.5);
  else c = pal(2, origin);
  c = mix(c, vTint.rgb, vTint.a);
  float ppl = 2. * uFocal / max(vDist, 1e-3);
  float fw = max(fwidth(vL.y), 1e-4);
  float sharp = clamp((0.55 - abs(vL.y - 1.0)) / fw + 0.5, 0., 1.);
  float bar = uBake == 1 ? 0.8 : mix(sharp, 0.55, smoothstep(0.5, 1.5, fw)) * 0.9;
  float tb = uBake == 1 ? 0. : smoothstep(uT0 - 2., uT0, ppl);
  float g = 0.;
  if (tb > 0. && vOff != 0xFFFFFFFFu) {
    float cell = floor(vL.x);
    if (cell < min(vLen, 124.)) {
      uint o = vOff + uint(cell);
      uint ch = texelFetch(uText, ivec3(int(o & 4095u), int((o >> 12) & 4095u), int(o >> 24)), 0).r;
      g = glyphCov(ch, vL);
    }
  } else tb = 0.;
  float cov = mix(bar, g, tb) * (1. - smoothstep(116., 120., vL.x)) * vAlpha;
  uint mk = texelFetch(uMark, ivec2(int(id & 2047u), int(id >> 11)), 0).r;
  vec4 res = vec4(c * cov, cov);
  if (vHi > 0.) res = vec4(res.rgb * 1.25, res.a) + vec4(0.10, 0.12, 0.16, 0.2) * (1. - res.a);
  if ((mk & 1u) != 0u) res = vec4(mix(res.rgb, vec3(1., 0.9, 0.2) * res.a, 0.6), res.a) + vec4(0.45, 0.38, 0.0, 0.5) * (1. - res.a);
  if (res.a < 0.004) discard;
  oC = res;
}`;
}

// ---- rects: wall plates, T3 file quads, header bars, holes, floor strips ----
// aR = (z0, z1, y0, y1)  aX = (x0, x1)  aC = rgba8  aW = (wall | 255, kind)
// kind bits: 0-1 type (0 wall-plane, 1 floor, 2 wall-plane palette colour [origin in aC.r]), 2-3 push level, 4 outline
export const rectVS = HEAD + COMMON + `
layout(location=0) in vec4 aR; layout(location=1) in vec2 aX; layout(location=2) in vec4 aC; layout(location=3) in uvec2 aW;
uniform sampler2D uPal; uniform int uMode;
out vec4 vC; out vec2 vUV; flat out float vOutline;
void main() {
  vec2 cr = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  uint w = aW.x, k = aW.y & 3u, push = (aW.y >> 2) & 3u;
  float wa = w < 64u ? uWA[w] : 1.;
  if (wa <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float bx = w < 64u ? uWX[w] : 0.;
  vec3 p;
  if (k == 1u) p = vec3(bx + mix(aX.x, aX.y, cr.x), aR.z, mix(aR.x, aR.y, cr.y));
  else p = vec3(bx + aX.x, mix(aR.z, aR.w, cr.y), mix(aR.x, aR.y, cr.x));
  p = pushK(p, push == 0u ? 1. : push == 1u ? 1.0012 : push == 2u ? 1.0025 : 1.004);
  gl_Position = uVP * vec4(p, 1.);
  vec4 c = aC;
  if (k == 2u) { int row = uMode == 1 ? 1 : uMode == 5 ? 2 : 0; c = vec4(texelFetch(uPal, ivec2(int(aC.r * 255. + 0.5), row), 0).rgb * aC.g * 2., aC.a); }
  vC = vec4(c.rgb * c.a, c.a) * wa; vUV = cr; vOutline = float((aW.y >> 4) & 1u);
}`;
export const rectFS = HEAD + `
in vec4 vC; in vec2 vUV; flat in float vOutline; out vec4 oC;
void main() {
  if (vOutline > 0.) { vec2 f = fwidth(vUV) * 1.5; if (vUV.x > f.x && vUV.x < 1. - f.x && vUV.y > f.y && vUV.y < 1. - f.y) discard; }
  oC = vC;
}`;

// ---- lines: ribbons, edges, ruler ----  aP = (z, y, s, xabs)  aW = (wallA, wallB)  aC
export const lineSegVS = HEAD + COMMON + `
layout(location=0) in vec4 aP; layout(location=1) in uvec2 aW; layout(location=2) in vec4 aC;
uniform vec2 uFadeFar;
out vec4 vC;
void main() {
  float a = 1., x = aP.w;
  if (aW.x < 64u) { x = mix(uWX[aW.x], uWX[min(aW.y, 63u)], aP.z) + aP.w; a = min(uWA[aW.x], uWA[min(aW.y, 63u)]); }
  if (a <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  gl_Position = uVP * vec4(x, aP.y, aP.x, 1.);
  if (uFadeFar.y > 0.) a *= 1. - smoothstep(uFadeFar.x, uFadeFar.y, length(vec3(x, aP.y, aP.x) - uCam));
  vC = vec4(aC.rgb * aC.a, aC.a) * a;
}`;
export const lineSegFS = HEAD + `in vec4 vC; out vec4 oC; void main() { oC = vC; }`;

// ---- labels: SDF text quads; aP = (z, y, dx, wall) aU advance/char  aV up/char-height  aT = (offset, len)  aK kind ----
export const labelVS = HEAD + COMMON + `
layout(location=0) in vec4 aP; layout(location=1) in vec3 aU; layout(location=2) in vec3 aV; layout(location=3) in uvec2 aT; layout(location=4) in vec4 aC; layout(location=5) in vec2 aK;
uniform float uMinPx; uniform vec3 uRight; uniform vec3 uUp;
out vec2 vL; flat out uint vOff; flat out float vLen; flat out vec4 vC;
void main() {
  vec2 cr = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  uint w = uint(aP.w);
  float wa = w < 64u ? uWA[w] : 1.;
  vec3 o = vec3((w < 64u ? uWX[w] : 0.) + aP.z, aP.y, aP.x);
  vec3 U = aU, V = aV;
  if (aK.x > 0.5) { U = uRight * length(aU); V = uUp * length(aV); }
  bool wallPlane = aK.x < 0.5 && aU.x == 0. && aV.x == 0.;
  float d = length(o - uCam);
  float px = length(V) * 2. * uFocal / max(d, 1.);   // char cell height in px
  if (aK.x > 1.5 && px < aK.x) { float k = aK.x / px; U *= k; V *= k; px = aK.x; }   // billboard with a minimum screen size
  if (wa <= 0. || px < uMinPx || (wallPlane && uCam.x > o.x) || (aK.y > 0. && px > aK.y)) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float L = float(aT.y);
  vec3 p = o + U * (cr.x * L) - V * (cr.y * 2.);
  p = pushK(p, 0.9995);
  gl_Position = uVP * vec4(p, 1.);
  vL = vec2(cr.x * L, cr.y * 2.); vOff = aT.x; vLen = L;
  vC = vec4(aC.rgb, aC.a * wa * smoothstep(uMinPx, uMinPx * 1.6, px));
}`;
export const labelFS = HEAD + GLYPH + `
uniform usampler2D uLab;
in vec2 vL; flat in uint vOff; flat in float vLen; flat in vec4 vC; out vec4 oC;
void main() {
  float cell = floor(vL.x); if (cell >= vLen) discard;
  uint o = vOff + uint(cell);
  uint ch = texelFetch(uLab, ivec2(int(o & 4095u), int(o >> 12)), 0).r;
  float g = glyphCov(ch, vL) * vC.a;
  if (g < 0.004) discard;
  oC = vec4(vC.rgb * g, g);
}`;

// ---- T2 impostor quads ----
export const impVS = HEAD + COMMON + `
uniform float uWallX, uZ0, uC0, uC1, uCols;
out vec2 vUV;
void main() {
  vec2 cr = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float c = mix(uC0, uC1, cr.x);
  vec3 p = vec3(uWallX, (1. - cr.y) * 4096., uZ0 + c * 128.);
  gl_Position = uVP * vec4(pushK(p, 1.0008), 1.);
  vUV = vec2(c / uCols, 1. - cr.y);
}`;
export const impFS = HEAD + `
uniform sampler2D uImp; uniform float uFade; in vec2 vUV; out vec4 oC;
void main() { vec4 c = texture(uImp, vUV); if (c.a < 0.003) discard; float a = sqrt(c.a) * 0.92; oC = vec4(c.rgb / c.a * 1.1 * a, a) * uFade; }`;

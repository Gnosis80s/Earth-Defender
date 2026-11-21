/**
 * The Moon: one body, shared by every stage.
 *
 * The story is a flight from Earth to the Moon, so the Moon must look like
 * the same place each time it appears, only closer: a small disc over the
 * city (stage 1), larger from the asteroid belt (stage 2), a vast limb
 * filling the bottom of the screen in lunar orbit (stage 3).
 *
 * How:
 *  1. Once, on the GPU, the whole visible hemisphere's surface (maria,
 *     basins, four scales of craters) is baked into a 4096x512 map in
 *     "z-pole" coordinates: longitude runs around the view axis and latitude
 *     rises from the limb (0) to the disc centre (90 deg). Rotating the Moon
 *     about the view axis (orbiting it) is then just a longitude shift.
 *     The map stores albedo and surface slopes, with mipmaps, so a small
 *     distant Moon filters cleanly and a huge one shows every crater.
 *  2. Each frame, a cheap shader draws a sphere of any radius from that map,
 *     snapped to the game's 1-unit texel grid, lit by the stage's sun and
 *     quantised into a dithered palette like the rest of the art.
 */
import * as THREE from 'three';

const MAP_W = 4096, MAP_H = 512;

// ---------------------------------------------------------------------------
// Shared GLSL
// ---------------------------------------------------------------------------

const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.96875;
}
// One layer of craters on a 3D grid of cell size 1/F around the unit sphere.
// Returns (height in sphere-radius units, albedo offset).
vec2 craters(vec3 q, float F, float seed, float density) {
  vec3 g = q * F, b = floor(g), o = step(0.5, g - b) - 1.0;
  float h = 0.0, a = 0.0;
  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) for (int k = 0; k < 2; k++) {
    vec3 c = b + o + vec3(float(i), float(j), float(k));
    if (hash3(c + seed) > density) continue;
    vec3 ctr = c + 0.2 + 0.6 * vec3(hash3(c + seed + 1.7), hash3(c + seed + 3.1), hash3(c + seed + 5.3));
    float r = 0.16 + 0.3 * hash3(c + seed + 7.7);
    float d = length(g - ctr) / r;
    if (d < 1.0) {
      h -= (1.0 - d * d) * r * 0.42;
      a -= 0.07 * (1.0 - d);
    } else if (d < 1.4) {
      float t = (1.4 - d) / 0.4;
      h += t * t * r * 0.16;
      a += 0.13 * t;
      // A few young craters throw bright rays.
      if (hash3(c + seed + 9.1) > 0.82) a += 0.05 * t;
    }
  }
  return vec2(h / F, a);
}
`;

// ---------------------------------------------------------------------------
// Bake pass 1: height (16-bit, RG) + albedo (B)
// ---------------------------------------------------------------------------

const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BAKE_SURFACE_FRAG = /* glsl */ `
varying vec2 vUv;
${NOISE}
void main() {
  float lon = vUv.x * 6.2831853;
  float lat = vUv.y * 1.5707963;
  // z-pole parametrisation: (lon around view axis, lat up from the limb).
  vec3 q = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));

  // Maria: dark basalt seas in a fixed, recognisable layout.
  float mare = fbm(q * 1.35 + vec3(3.0, 1.0, 7.0));
  float m = smoothstep(0.53, 0.6, mare);
  float alb = mix(1.0, 0.6, m) + (fbm(q * 11.0) - 0.5) * 0.16;
  float h = (fbm(q * 6.0 + 9.0) - 0.5) * 0.012 * (1.0 - 0.75 * m);

  vec2 c;
  c = craters(q, 4.0, 11.0, 0.45);   h += c.x * 0.6; alb += c.y * 0.6;  // basins
  c = craters(q, 12.0, 23.0, 0.55);  h += c.x;       alb += c.y;
  c = craters(q, 36.0, 37.0, 0.6);   h += c.x;       alb += c.y;
  c = craters(q, 110.0, 51.0, 0.65); h += c.x;       alb += c.y * 0.8;
  c = craters(q, 300.0, 67.0, 0.7);  h += c.x;       alb += c.y * 0.6;

  float hn = clamp(h * 18.0 + 0.5, 0.0, 1.0); // encode
  float hi = floor(hn * 255.0) / 255.0;
  float lo = fract(hn * 255.0);
  gl_FragColor = vec4(hi, lo, clamp(alb * 0.7, 0.0, 1.0), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Bake pass 2: slopes from neighbouring heights -> final map
// ---------------------------------------------------------------------------

const BAKE_SLOPE_FRAG = /* glsl */ `
uniform sampler2D uSurf;
uniform vec2 uTexel;
varying vec2 vUv;
float H(vec2 uv) {
  vec4 t = texture2D(uSurf, vec2(fract(uv.x), clamp(uv.y, 0.0, 1.0)));
  return (t.r + t.g / 255.0 - 0.5) / 18.0;
}
void main() {
  float lat = vUv.y * 1.5707963;
  float dLon = uTexel.x * 6.2831853, dLat = uTexel.y * 1.5707963;
  float sx = (H(vUv + vec2(uTexel.x, 0.0)) - H(vUv - vec2(uTexel.x, 0.0))) / (2.0 * dLon * max(cos(lat), 0.08));
  float sy = (H(vUv + vec2(0.0, uTexel.y)) - H(vUv - vec2(0.0, uTexel.y))) / (2.0 * dLat);
  float alb = texture2D(uSurf, vUv).b;
  gl_FragColor = vec4(alb, clamp(sx / 3.0 * 0.5 + 0.5, 0.0, 1.0), clamp(sy / 3.0 * 0.5 + 0.5, 0.0, 1.0), 1.0);
}
`;

let bakedMap: THREE.Texture | null = null;

/** Bake the surface map (once). Needs the game's renderer. */
function moonMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (bakedMap) return bakedMap;
  const cam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const scene = new THREE.Scene();
  scene.add(quad);

  const surf = new THREE.WebGLRenderTarget(MAP_W, MAP_H, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
  });
  quad.material = new THREE.ShaderMaterial({ vertexShader: BAKE_VERT, fragmentShader: BAKE_SURFACE_FRAG });
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(surf);
  renderer.render(scene, cam);

  const final = new THREE.WebGLRenderTarget(MAP_W, MAP_H, {
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: true, depthBuffer: false,
  });
  (quad.material as THREE.Material).dispose();
  quad.material = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT, fragmentShader: BAKE_SLOPE_FRAG,
    uniforms: { uSurf: { value: surf.texture }, uTexel: { value: new THREE.Vector2(1 / MAP_W, 1 / MAP_H) } },
  });
  renderer.setRenderTarget(final);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);

  surf.dispose();
  (quad.material as THREE.Material).dispose();
  quad.geometry.dispose();
  bakedMap = final.texture;
  return bakedMap;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const MOON_VERT = /* glsl */ `
varying vec2 vLocal;
void main() { vLocal = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const MOON_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uR;
uniform vec2 uCenter;
uniform float uRot;
uniform vec3 uSun;
uniform vec3 uRamp[9];
uniform vec3 uTint;
uniform float uTintAmt;
uniform vec3 uShine;   // night-side fill (earthshine)
uniform float uAlien;  // 0..1 alien lights on the night side
uniform float uTime;
uniform float uBump;
varying vec2 vLocal;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 px = floor(vLocal) + 0.5;           // snap to the game's texel grid
  vec2 p = px - uCenter;
  float r2 = dot(p, p), R2 = uR * uR;
  if (r2 > R2) discard;

  vec3 n0 = vec3(p, sqrt(R2 - r2)) / uR;  // view-space normal
  float lat = asin(clamp(n0.z, 0.0, 1.0));
  float lonV = atan(n0.y, n0.x);
  float lon = lonV - uRot;
  vec2 uv = vec2(lon / 6.2831853, lat / 1.5707963);

  // Mip level from how many map texels fall in one screen texel.
  float texPerPx = 4096.0 / (6.2831853 * uR * max(cos(lat), 0.05));
  float lod = clamp(log2(max(texPerPx, 1.0)), 0.0, 8.0);
  vec4 t = textureLod(uMap, uv, lod);
  float alb = t.r / 0.7;
  float sx = (t.g - 0.5) * 2.0 * 3.0, sy = (t.b - 0.5) * 2.0 * 3.0;

  vec3 tLon = vec3(-sin(lonV), cos(lonV), 0.0);
  vec3 tLat = vec3(-sin(lat) * cos(lonV), -sin(lat) * sin(lonV), cos(lat));
  vec3 n = normalize(n0 - (sx * tLon + sy * tLat) * uBump);

  float ndl = dot(n, uSun);
  float diff = clamp(ndl, 0.0, 1.0);
  // Soften the terminator a touch using the smooth sphere normal.
  float base = clamp(dot(n0, uSun) * 4.0 + 0.5, 0.0, 1.0);
  float v = (0.03 + 0.97 * pow(diff, 0.9)) * alb * base;

  float d = bayer4(px);
  float f = clamp(v, 0.0, 1.0) * 8.0;
  int idx = int(floor(f));
  if (fract(f) > d) idx += 1;
  idx = idx > 8 ? 8 : idx;
  vec3 col = uRamp[0];
  for (int i = 1; i < 9; i++) if (i == idx) col = uRamp[i];

  // Earthshine: a faint cool fill on the night side.
  if (base < 0.5) col = mix(col, uShine, (0.5 - base) * 0.9 * alb);

  // Alien lights glimmering on the night side.
  if (uAlien > 0.0 && base < 0.3) {
    vec2 cell = floor(vec2(uv.x * 2600.0, uv.y * 520.0));
    float hsh = h2(cell);
    if (hsh > 0.9975) {
      float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + hsh * 50.0);
      col = mix(col, vec3(0.45, 1.0, 0.55), uAlien * pulse * (0.3 - base) / 0.3);
    }
  }

  col = mix(col, uTint, uTintAmt);
  gl_FragColor = vec4(col, 1.0);
}
`;

const RAMP = ['#06080c', '#141821', '#242a35', '#38404c', '#525a66', '#717884', '#959ba5', '#bcc1c7', '#e4e6e8'];

export interface MoonView {
  /** Radius in world units. */
  R: number;
  /** Plane size (world units) and the sphere centre relative to the plane centre. */
  planeW: number;
  planeH: number;
  cx: number;
  cy: number;
  sun: [number, number, number];
  tint?: string;
  tintAmt?: number;
  alien?: number;
  bump?: number;
}

/** A Moon mesh drawn by the shared shader; reconfigure per stage with `setView`. */
export class MoonBody {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private geoKey = '';

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: MOON_VERT,
      fragmentShader: MOON_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: null },
        uR: { value: 50 },
        uCenter: { value: new THREE.Vector2() },
        uRot: { value: 0 },
        uSun: { value: new THREE.Vector3(0, 0, 1) },
        uRamp: { value: RAMP.map((h) => new THREE.Color(h)) },
        uTint: { value: new THREE.Color('#9fb4e8') },
        uTintAmt: { value: 0 },
        uShine: { value: new THREE.Color('#141b2b') },
        uAlien: { value: 0 },
        uTime: { value: 0 },
        uBump: { value: 1 },
      },
    });
    // Ramp colours are authored in sRGB and written straight to the sRGB canvas.
    for (const c of this.mat.uniforms.uRamp.value as THREE.Color[]) c.convertLinearToSRGB();
    (this.mat.uniforms.uTint.value as THREE.Color).convertLinearToSRGB();
    (this.mat.uniforms.uShine.value as THREE.Color).convertLinearToSRGB();
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.frustumCulled = false;
  }

  /** Bake the shared map (if needed) and attach it. Call once a renderer exists. */
  ensureMap(renderer: THREE.WebGLRenderer) {
    if (!this.mat.uniforms.uMap.value) this.mat.uniforms.uMap.value = moonMap(renderer);
  }

  setView(v: MoonView) {
    const key = `${v.planeW}x${v.planeH}`;
    if (key !== this.geoKey) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(v.planeW, v.planeH);
      this.geoKey = key;
    }
    const u = this.mat.uniforms;
    u.uR.value = v.R;
    (u.uCenter.value as THREE.Vector2).set(v.cx, v.cy);
    (u.uSun.value as THREE.Vector3).set(...v.sun).normalize();
    (u.uTint.value as THREE.Color).set(v.tint ?? '#000000').convertLinearToSRGB();
    u.uTintAmt.value = v.tintAmt ?? 0;
    u.uAlien.value = v.alien ?? 0;
    u.uBump.value = v.bump ?? 1;
  }

  /** Orbit progress: rotation about the view axis (radians, + turns the near limb leftward). */
  setRotation(rad: number) {
    this.mat.uniforms.uRot.value = rad;
  }

  setTime(t: number) {
    this.mat.uniforms.uTime.value = t;
  }
}

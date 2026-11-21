/**
 * Procedural art for Stage 2 (the asteroid belt).
 *
 * One sun, upper-right and toward the viewer, lights everything: the distant
 * Moon, the belt layers, the tumbling asteroids and the boss fortress.
 *
 * Asteroids are real 3D shapes: a lumpy, cratered ellipsoid stored as a
 * height field on the sphere, ray-marched per pixel. Tumbling is done by
 * rendering several rotation frames (the light stays fixed), rather than by
 * spinning a flat sprite, so the lit side always faces the sun.
 *
 * Background layers are 800 wide and tile seamlessly in x.
 */
import {
  hash, lerp, clamp01, fbm3, fbm2p, bayer, RGB, hex, mix, scale, rampDither, newCanvas, put,
} from './PixelArt';

type V3 = [number, number, number];
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Sun direction (view space, +z toward the viewer). */
const SUN: V3 = norm([0.72, 0.48, 0.42]);
const HALF: V3 = norm([SUN[0], SUN[1], SUN[2] + 1]);

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function ditherRGB(c: RGB, x: number, y: number, step = 6): RGB {
  const b = bayer(x, y) - 0.5;
  return [Math.round(c[0] / step + b) * step, Math.round(c[1] / step + b) * step, Math.round(c[2] / step + b) * step];
}

// ---------------------------------------------------------------------------
// Rock shape: height field on the unit sphere
// ---------------------------------------------------------------------------

export interface RockSpec {
  seed: number;
  /** Ellipsoid semi-axes (object space). */
  axes: V3;
  /** Amplitude of the lumpy noise displacement. */
  lump: number;
  craters: number;
  /** 'gold' adds glittering ore veins. */
  kind?: 'rock' | 'gold';
}

const GU = 96, GV = 48; // lon x lat grid

class RockShape {
  h = new Float32Array(GU * GV);
  alb = new Float32Array(GU * GV);
  vein = new Float32Array(GU * GV);
  crater = new Float32Array(GU * GV); // 1 inside a crater bowl (slightly darker floor)
  hmax = 0;

  constructor(spec: RockSpec) {
    const rnd = rng(spec.seed * 7919 + 13);
    const craters: { c: V3; r: number; d: number }[] = [];
    for (let k = 0; k < spec.craters; k++) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      craters.push({ c: [s * Math.cos(t), u, s * Math.sin(t)], r: 0.18 + rnd() * 0.32, d: 0.05 + rnd() * 0.07 });
    }
    const [a, b, c] = spec.axes;
    const sd = spec.seed * 3;
    for (let j = 0; j < GV; j++) {
      const lat = ((j + 0.5) / GV - 0.5) * Math.PI;
      for (let i = 0; i < GU; i++) {
        const lon = (i / GU) * Math.PI * 2 - Math.PI;
        const d: V3 = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
        const ell = 1 / Math.sqrt((d[0] / a) ** 2 + (d[1] / b) ** 2 + (d[2] / c) ** 2);
        const n = fbm3(d[0] * 1.6 + 3, d[1] * 1.6, d[2] * 1.6, 4, sd + 1) - 0.5;
        const fine = fbm3(d[0] * 5 + 9, d[1] * 5, d[2] * 5, 2, sd + 2) - 0.5;
        let cr = 0, inC = 0;
        for (const k of craters) {
          const ang = Math.acos(Math.max(-1, Math.min(1, dot(d, k.c))));
          const q = ang / k.r;
          if (q < 1) { cr += -k.d * (1 - q * q); inC = Math.max(inC, 1 - q); }
          else if (q < 1.35) cr += k.d * 0.45 * (1 - (q - 1) / 0.35);
        }
        const o = j * GU + i;
        this.h[o] = ell * (1 + spec.lump * n * 2 + 0.05 * fine + cr);
        this.alb[o] = 0.9 + 0.32 * (fbm3(d[0] * 2.2 + 20, d[1] * 2.2, d[2] * 2.2, 3, sd + 4) - 0.5);
        this.crater[o] = inC;
        if (spec.kind === 'gold') {
          const r = 1 - Math.abs(2 * fbm3(d[0] * 2.4 + 50, d[1] * 2.4, d[2] * 2.4, 4, sd + 5) - 1);
          this.vein[o] = clamp01((r - 0.885) / 0.07);
        }
        if (this.h[o] > this.hmax) this.hmax = this.h[o];
      }
    }
  }

  /** Bilinear lookup of a field at unit direction d. */
  sample(f: Float32Array, d: V3): number {
    const lon = Math.atan2(d[2], d[0]);
    const lat = Math.asin(Math.max(-1, Math.min(1, d[1])));
    const u = ((lon + Math.PI) / (Math.PI * 2)) * GU;
    const v = Math.max(0, Math.min(GV - 1.001, ((lat / Math.PI) + 0.5) * GV - 0.5));
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const fu = u - i0, fv = v - j0;
    const a0 = ((i0 % GU) + GU) % GU, a1 = (a0 + 1) % GU;
    const r0 = j0 * GU, r1 = Math.min(GV - 1, j0 + 1) * GU;
    return lerp(lerp(f[r0 + a0], f[r0 + a1], fu), lerp(f[r1 + a0], f[r1 + a1], fu), fv);
  }
}

/** Rotation matrix (row-major 3x3) about unit axis k by angle t. */
function rotMat(k: V3, t: number): number[] {
  const c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  const [x, y, z] = k;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}
const mul = (m: number[], v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const mulM = (a: number[], b: number[]) => {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};

/** Per-pixel ray-march result. */
interface GBuf {
  W: number; H: number; s: number;
  hit: Uint8Array;
  z: Float32Array;
  nx: Float32Array; ny: Float32Array; nz: Float32Array;
  /** Object-space surface direction (sticks to the rock as it turns). */
  dx: Float32Array; dy: Float32Array; dz: Float32Array;
}

/**
 * Ray-march `shape` (rotated by `m`, object->view) into a W x H buffer.
 * `s` = object units per pixel. Orthographic rays along -z.
 */
function rayRock(shape: RockShape, W: number, H: number, s: number, m: number[]): GBuf {
  const N = W * H;
  const g: GBuf = {
    W, H, s, hit: new Uint8Array(N), z: new Float32Array(N),
    nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N),
    dx: new Float32Array(N), dy: new Float32Array(N), dz: new Float32Array(N),
  };
  // inverse rotation = transpose: view -> object
  const mt = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  const R = shape.hmax;
  const inside = (x: number, y: number, z: number) => {
    const r = Math.hypot(x, y, z);
    if (r > R) return false;
    if (r < 1e-6) return true;
    const d = mul(mt, [x / r, y / r, z / r]);
    return r <= shape.sample(shape.h, d);
  };
  const STEPS = 22;
  for (let j = 0; j < H; j++) {
    const y = -(j + 0.5 - H / 2) * s;
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5 - W / 2) * s;
      const rr = x * x + y * y;
      if (rr >= R * R) continue;
      const zt = Math.sqrt(R * R - rr);
      const dz = (2 * zt) / STEPS;
      let z0 = zt, found = false;
      for (let k = 1; k <= STEPS; k++) {
        const z1 = zt - k * dz;
        if (inside(x, y, z1)) {
          let lo = z1, hi = z0; // lo inside, hi outside
          for (let b = 0; b < 6; b++) {
            const mid = (lo + hi) / 2;
            if (inside(x, y, mid)) lo = mid; else hi = mid;
          }
          const o = j * W + i;
          g.hit[o] = 1;
          g.z[o] = (lo + hi) / 2;
          const r = Math.hypot(x, y, g.z[o]);
          const d = mul(mt, [x / r, y / r, g.z[o] / r]);
          g.dx[o] = d[0]; g.dy[o] = d[1]; g.dz[o] = d[2];
          found = true;
          break;
        }
        z0 = z1;
      }
      if (!found) continue;
    }
  }
  // Normals from the depth buffer (central differences, one-sided at edges).
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i;
      if (!g.hit[o]) continue;
      const zAt = (ii: number, jj: number) => (ii >= 0 && jj >= 0 && ii < W && jj < H && g.hit[jj * W + ii] ? g.z[jj * W + ii] : NaN);
      const zl = zAt(i - 1, j), zr = zAt(i + 1, j), zu = zAt(i, j - 1), zd = zAt(i, j + 1);
      const z = g.z[o];
      let dzdx: number, dzdy: number;
      if (!isNaN(zl) && !isNaN(zr)) dzdx = (zr - zl) / (2 * s);
      else if (!isNaN(zr)) dzdx = (zr - z) / s;
      else if (!isNaN(zl)) dzdx = (z - zl) / s;
      else dzdx = NaN;
      if (!isNaN(zu) && !isNaN(zd)) dzdy = (zu - zd) / (2 * s);
      else if (!isNaN(zu)) dzdy = (zu - z) / s;
      else if (!isNaN(zd)) dzdy = (z - zd) / s;
      else dzdy = NaN;
      let n: V3;
      const x = (i + 0.5 - W / 2) * s, y = -(j + 0.5 - H / 2) * s;
      if (isNaN(dzdx) || isNaN(dzdy)) n = norm([x, y, Math.max(0.2, z)]);
      else n = norm([-Math.max(-6, Math.min(6, dzdx)), -Math.max(-6, Math.min(6, dzdy)), 1]);
      // Blend toward the smooth ellipsoid normal near the limb so edges don't go noisy.
      const edge = isNaN(zl) || isNaN(zr) || isNaN(zu) || isNaN(zd);
      if (edge) n = norm([n[0] + x * 0.6, n[1] + y * 0.6, n[2]]);
      g.nx[o] = n[0]; g.ny[o] = n[1]; g.nz[o] = n[2];
    }
  }
  return g;
}

const ROCK_RAMP: RGB[] = ['#0d0b12', '#1d1922', '#2f2930', '#463c3e', '#63544f', '#857163', '#a98f78', '#cdb498'].map(hex);
const GOLD_RAMP: RGB[] = ['#2a1606', '#5c3409', '#94600f', '#cf951c', '#f4c94a', '#fff0a8'].map(hex);
const GOLD_ROCK_RAMP: RGB[] = ['#0f0b08', '#211a12', '#382a1c', '#523d26', '#715535', '#937149', '#b8925e'].map(hex);

/**
 * Shade a ray-marched rock into `img` at (ox, oy). Returns nothing; writes
 * opaque pixels for the rock and a selective 1px outline (dark on the shadow
 * side, a step lighter on the lit side) for readability on any background.
 */
function shadeRock(g: GBuf, shape: RockShape, img: ImageData, ox: number, oy: number, opts: { gold?: boolean; dim?: number; tint?: RGB; tintAmt?: number } = {}) {
  const { W, H } = g;
  const ramp = opts.gold ? GOLD_ROCK_RAMP : ROCK_RAMP;
  const dim = opts.dim ?? 1;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i;
      if (!g.hit[o]) continue;
      const n: V3 = [g.nx[o], g.ny[o], g.nz[o]];
      const d: V3 = [g.dx[o], g.dy[o], g.dz[o]];
      const ndl = dot(n, SUN);
      const diff = clamp01(ndl);
      const alb = shape.sample(shape.alb, d) * (1 - 0.18 * shape.sample(shape.crater, d));
      // Ambient + diffuse; a cool bounce light from the lower-left lifts the shadows a touch.
      const bounce = clamp01(dot(n, [-0.6, -0.5, 0.3])) * 0.1;
      const v = (0.05 + 1.0 * Math.pow(diff, 1.1)) * alb + bounce;
      const px = ox + i, py = oy + j;
      let col: RGB = rampDither(ramp, v * 0.92 * dim, px, py);

      if (opts.gold) {
        const vein = shape.sample(shape.vein, d);
        if (vein > 0.35 + bayer(px, py) * 0.4) {
          const spec = Math.pow(clamp01(dot(n, HALF)), 24);
          col = rampDither(GOLD_RAMP, 0.25 + 0.6 * diff + spec * 0.8, px, py);
          if (spec > 0.55) col = hex('#ffffff');
        }
      }

      // Outline
      const empty = (ii: number, jj: number) => ii < 0 || jj < 0 || ii >= W || jj >= H || !g.hit[jj * W + ii];
      if (empty(i - 1, j) || empty(i + 1, j) || empty(i, j - 1) || empty(i, j + 1)) {
        col = diff > 0.45 ? ramp[Math.min(3, ramp.length - 1)] : ramp[0];
      }
      if (opts.tint) col = mix(col, opts.tint, opts.tintAmt ?? 0.3);
      put(img.data, img.width, px, py, col);
    }
  }
}

// ---------------------------------------------------------------------------
// Asteroid sprite frames
// ---------------------------------------------------------------------------

export type RockKind = 'large' | 'small' | 'chunk' | 'gold';

const ROCK_PRESETS: Record<RockKind, { size: number; specs: RockSpec[] }> = {
  large: {
    size: 72,
    specs: [
      { seed: 11, axes: [1.25, 0.95, 1.0], lump: 0.16, craters: 9 },
      { seed: 23, axes: [1.0, 1.0, 0.9], lump: 0.2, craters: 7 },
      { seed: 37, axes: [1.35, 0.85, 0.95], lump: 0.14, craters: 11 },
    ],
  },
  small: {
    size: 44,
    specs: [
      { seed: 41, axes: [1.2, 0.9, 1.0], lump: 0.2, craters: 5 },
      { seed: 53, axes: [1.0, 1.1, 0.9], lump: 0.22, craters: 4 },
      { seed: 67, axes: [1.3, 0.8, 1.0], lump: 0.18, craters: 6 },
    ],
  },
  chunk: {
    size: 28,
    specs: [
      { seed: 71, axes: [1.3, 0.8, 0.9], lump: 0.26, craters: 2 },
      { seed: 83, axes: [1.0, 1.0, 0.8], lump: 0.28, craters: 2 },
      { seed: 97, axes: [1.2, 0.9, 1.1], lump: 0.24, craters: 3 },
    ],
  },
  gold: {
    size: 56,
    specs: [{ seed: 101, axes: [1.15, 0.95, 1.0], lump: 0.17, craters: 6, kind: 'gold' }],
  },
};

export const ROCK_FRAMES = 16;
export const rockVariantCount = (kind: RockKind) => ROCK_PRESETS[kind].specs.length;

const shapeCache: Record<string, RockShape> = {};
function shapeFor(kind: RockKind, variant: number) {
  const key = `${kind}_${variant}`;
  return (shapeCache[key] ??= new RockShape(ROCK_PRESETS[kind].specs[variant]));
}

/** One tumble frame of an asteroid sprite (square canvas of the preset size). */
export function drawRockFrame(kind: RockKind, variant: number, frame: number): HTMLCanvasElement {
  const { size, specs } = ROCK_PRESETS[kind];
  const spec = specs[variant];
  const shape = shapeFor(kind, variant);
  // Each variant tumbles about its own tilted axis.
  const r = rng(spec.seed + 5);
  const axis = norm([r() - 0.5, 0.6 + r(), r() - 0.5]);
  const base = rotMat(norm([r() - 0.5, r() - 0.5, r() - 0.5]), r() * 6.28);
  const m = mulM(rotMat(axis, (frame / ROCK_FRAMES) * Math.PI * 2), base);
  const s = (shape.hmax * 2) / (size - 2);
  const g = rayRock(shape, size, size, s, m);
  const { canvas, ctx, img } = newCanvas(size, size);
  shadeRock(g, shape, img, 0, 0, { gold: spec.kind === 'gold' });
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Backdrop: deep-space nebula (800x600, tiles in x)
// ---------------------------------------------------------------------------

export function drawSpaceNebula(): HTMLCanvasElement {
  const W = 800, H = 600;
  const { canvas, ctx, img } = newCanvas(W, H);
  const top = hex('#03040c'), bottom = hex('#070a1a');
  const violet = hex('#36204f'), magenta = hex('#5e2560'), teal = hex('#12424f'), dust = hex('#3a2a2a');
  // Gas is computed at half resolution (2x2 texel blocks): it's soft anyway, and 4x cheaper.
  for (let y = 0; y < H; y += 2) {
    const ty = y / (H - 1);
    for (let x = 0; x < W; x += 2) {
      let c = mix(top, bottom, ty);
      // Domain-warped periodic fBm: two gas clouds of different hue.
      const w = fbm2p(x, y, W, 3, 3, 401) - 0.5;
      const n1 = fbm2p(x + w * 160, y + w * 90, W, 4, 5, 402);
      const n2 = fbm2p(x - w * 120, y + 300, W, 3, 5, 403);
      // A faint diagonal-ish band keeps the gas from filling the whole sky.
      const band = Math.exp(-(((ty - 0.38 - 0.08 * Math.sin((x / W) * Math.PI * 2)) / 0.26) ** 2));
      const a1 = clamp01((n1 - 0.48) / 0.3) * (0.35 + 0.65 * band);
      const a2 = clamp01((n2 - 0.55) / 0.28) * 0.8;
      c = mix(c, teal, a2 * 0.75);
      c = mix(c, violet, a1 * 0.9);
      c = mix(c, magenta, clamp01((n1 - 0.68) / 0.18) * band * 0.7);
      // Dark dust lanes cut through the gas.
      const lane = fbm2p(x + 50, y * 1.6, W, 6, 4, 404);
      c = mix(c, dust, clamp01((lane - 0.62) / 0.15) * a1 * 0.5);
      c = scale(c, 1 - clamp01((lane - 0.6) / 0.2) * 0.45);
      const q = ditherRGB(c, x >> 1, y >> 1, 5);
      put(img.data, W, x, y, q); put(img.data, W, x + 1, y, q);
      put(img.data, W, x, y + 1, q); put(img.data, W, x + 1, y + 1, q);
    }
  }
  // Fixed faint stars baked into the gas (the moving starfield sits on top).
  const r = rng(77);
  for (let k = 0; k < 520; k++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * H);
    const b = r();
    const col: RGB = b > 0.97 ? hex('#fff4d6') : b > 0.85 ? hex('#9fb4e8') : hex('#56607a');
    put(img.data, W, x, y, col);
    if (b > 0.985) {
      // A few brighter stars get a tiny cross.
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = (x + ax + W) % W, yy = y + ay;
        if (yy >= 0 && yy < H) put(img.data, W, xx, yy, hex('#6a7598'));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Belt layers
// ---------------------------------------------------------------------------

export const BELT_W = 800;

/**
 * Far belt (800x260): a glowing band of dust packed with tiny rocks, drawn
 * low-contrast so nothing in it reads as a hazard.
 */
export function drawBeltFar(): HTMLCanvasElement {
  const W = BELT_W, H = 260;
  const { canvas, ctx, img } = newCanvas(W, H);
  const dustLit = hex('#6e5660'), dustDim = hex('#2c2338');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cy = H * 0.5 + 18 * Math.sin((x / W) * Math.PI * 2) + 10 * Math.sin((x / W) * Math.PI * 6 + 1);
      const t = (y - cy) / (H * 0.3);
      const band = Math.exp(-t * t);
      const n = fbm2p(x, y * 2.2, W, 8, 4, 501);
      const a = clamp01(band * (0.25 + 0.9 * n) - 0.12);
      const q = Math.floor(a * 5 + bayer(x, y) - 0.3) / 5;
      if (q <= 0) continue;
      const c = mix(dustDim, dustLit, clamp01(0.3 + (n - 0.5) * 1.5 - t * 0.25));
      put(img.data, W, x, y, c, Math.round(q * 185));
    }
  }
  // Tiny lit rocks, concentrated in the band.
  const r = rng(502);
  const ramp: RGB[] = ['#1a1520', '#352b34', '#5a4a4c', '#7f6b62'].map(hex);
  for (let k = 0; k < 650; k++) {
    const x0 = r() * W;
    const cy = H * 0.5 + 18 * Math.sin((x0 / W) * Math.PI * 2) + 10 * Math.sin((x0 / W) * Math.PI * 6 + 1);
    const g = (r() + r() + r() - 1.5) * 0.9;
    const y0 = cy + g * H * 0.32;
    const rad = r() < 0.9 ? 0.6 + r() * 1.2 : 1.8 + r() * 2.2;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const xx = Math.floor(x0) + dx, yy = Math.floor(y0) + dy;
        if (yy < 0 || yy >= H) continue;
        const ux = (xx + 0.5 - x0) / rad, uy = -(yy + 0.5 - y0) / rad;
        const rr = ux * ux + uy * uy;
        if (rr > 1) continue;
        const diff = clamp01(ux * SUN[0] + uy * SUN[1] + Math.sqrt(1 - rr) * SUN[2]);
        put(img.data, W, (xx + W) % W, yy, rampDither(ramp, 0.15 + diff * 0.7, xx, yy));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Mid belt (800x600): scattered larger rocks, real ray-marched shapes but
 * darkened and tinted toward the nebula so they sit back from the playfield.
 */
export function drawBeltMid(): HTMLCanvasElement {
  const W = BELT_W, H = 600;
  const { canvas, ctx, img } = newCanvas(W, H);
  const r = rng(603);
  const tint = hex('#1c1830');
  const placed: { x: number; y: number; s: number }[] = [];
  let tries = 0;
  while (placed.length < 15 && tries++ < 400) {
    const s = Math.floor(10 + Math.pow(r(), 2) * 34);
    const x = Math.floor(r() * W), y = Math.floor(30 + r() * (H - 60));
    if (placed.some((p) => {
      let ddx = Math.abs(p.x - x); ddx = Math.min(ddx, W - ddx);
      return Math.hypot(ddx, p.y - y) < (p.s + s) * 0.9 + 26;
    })) continue;
    placed.push({ x, y, s });
  }
  for (const p of placed) {
    const spec: RockSpec = { seed: 700 + Math.floor(r() * 1000), axes: [1 + r() * 0.4, 0.8 + r() * 0.3, 0.9 + r() * 0.2], lump: 0.18 + r() * 0.08, craters: 3 + Math.floor(r() * 5) };
    const shape = new RockShape(spec);
    const m = rotMat(norm([r() - 0.5, r() - 0.5, r() - 0.5]), r() * 6.28);
    const g = rayRock(shape, p.s, p.s, (shape.hmax * 2) / (p.s - 2), m);
    // Render into a small scratch image, then blit with x-wrap.
    const tmp = new ImageData(p.s, p.s);
    shadeRock(g, shape, tmp, 0, 0, { dim: 0.5, tint, tintAmt: 0.5 });
    for (let j = 0; j < p.s; j++) {
      for (let i = 0; i < p.s; i++) {
        const o = (j * p.s + i) * 4;
        if (!tmp.data[o + 3]) continue;
        const xx = (p.x - (p.s >> 1) + i + W) % W, yy = p.y - (p.s >> 1) + j;
        if (yy < 0 || yy >= H) continue;
        put(img.data, W, xx, yy, [tmp.data[o], tmp.data[o + 1], tmp.data[o + 2]]);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Boss: the asteroid fortress (176x144)
// ---------------------------------------------------------------------------

export const FORTRESS_W = 176;
export const FORTRESS_H = 144;
/** Core socket centre, in texture pixels. */
export const FORTRESS_CORE = { x: 30, y: 72 };
/** Turret housings, in world offsets from the boss centre (y up). */
export const FORTRESS_TURRETS = [
  { x: -20, y: 58 }, { x: -20, y: -58 }, { x: -50, y: 32 }, { x: -50, y: -32 },
];

let fortressShape: RockShape | null = null;
let fortressG: GBuf | null = null;

function fortressBase() {
  if (!fortressShape) {
    fortressShape = new RockShape({ seed: 404, axes: [1.45, 1.0, 1.05], lump: 0.1, craters: 14 });
    // Tilt the belt toward the viewer so the equatorial plating curves.
    const m = mulM(rotMat([1, 0, 0], 0.14), rotMat([0, 1, 0], 0.25));
    const s = (fortressShape.hmax * 2) / (FORTRESS_W - 8);
    fortressG = rayRock(fortressShape, FORTRESS_W, FORTRESS_H, s, m);
  }
  return { shape: fortressShape, g: fortressG! };
}

/**
 * The stage 2 boss body: a hollowed asteroid wrapped in an armoured belt,
 * with a mass-driver socket (where the core sits) facing the player, turret
 * housings, a comms mast and a rear engine block. `damaged` blows plating
 * off and opens glowing fractures for the final phase.
 */
export function drawFortress(damaged = false): HTMLCanvasElement {
  const { shape, g } = fortressBase();
  const W = FORTRESS_W, H = FORTRESS_H;
  const { canvas, ctx, img } = newCanvas(W, H);
  const d = img.data;
  // Darker, cooler basalt than the tan belt rocks so the fortress reads as its own thing.
  shadeRock(g, shape, img, 0, 0, { dim: 0.9, tint: hex('#18203a'), tintAmt: 0.3 });

  const steel: RGB[] = ['#0e1119', '#1d2230', '#2f3647', '#465065', '#64708a', '#8d9ab3', '#c3cede'].map(hex);
  const hazard = hex('#d49a1c');
  const lava: RGB[] = ['#5a0d0a', '#a11d0c', '#e2491a', '#ff9a3a', '#ffe08a'].map(hex);

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i;
      if (!g.hit[o]) continue;
      const dir: V3 = [g.dx[o], g.dy[o], g.dz[o]];
      const n: V3 = [g.nx[o], g.ny[o], g.nz[o]];
      const lat = Math.asin(Math.max(-1, Math.min(1, dir[1])));
      const lon = Math.atan2(dir[2], dir[0]);
      const diff = clamp01(dot(n, SUN));
      const spec = Math.pow(clamp01(dot(n, HALF)), 18);
      const edge = (ii: number, jj: number) => ii < 0 || jj < 0 || ii >= W || jj >= H || !g.hit[jj * W + ii];
      const isEdge = edge(i - 1, j) || edge(i + 1, j) || edge(i, j - 1) || edge(i, j + 1);
      if (isEdge) continue;

      // Bolted-on armour panels scattered over the rock (lon/lat grid cells).
      const cu = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * 22), cv = Math.floor((lat / Math.PI + 0.5) * 11);
      const fu = ((lon + Math.PI) / (Math.PI * 2)) * 22 - cu, fv = (lat / Math.PI + 0.5) * 11 - cv;
      if (hash(cu, cv, 0, 31) > 0.8 && Math.abs(lat) < 1.0 && !(damaged && hash(cu, cv, 1, 32) < 0.5)) {
        let v = 0.08 + 0.55 * Math.pow(diff, 1.0) + spec * 0.35;
        if (fu < 0.1 || fv < 0.1) v *= 0.5;
        else if (fu > 0.9 || fv > 0.9) v *= 1.2;
        let col = rampDither(steel, v, i, j);
        if (Math.abs(fu - 0.5) < 0.06 && Math.abs(fv - 0.5) < 0.12 && hash(cu, cv, 2, 33) > 0.6) col = hex('#ff5a4a');
        put(d, W, i, j, col);
      }

      // Armoured belt around the equator (+ a thinner one above).
      const inBelt = Math.abs(lat) < 0.17;
      const inBelt2 = Math.abs(lat - 0.62) < 0.06;
      if (inBelt || inBelt2) {
        const seg = Math.floor(((lon + Math.PI) / (Math.PI * 2)) * 28);
        let missing = false;
        if (damaged) missing = hash(seg, inBelt2 ? 1 : 0, 0, 77) < 0.3;
        if (!missing) {
          const segF = ((lon + Math.PI) / (Math.PI * 2)) * 28 - seg;
          let v = 0.18 + 0.75 * Math.pow(diff, 0.8) + spec * 0.6;
          // Seams between plates, bevel lip at the belt edges.
          const lip = inBelt ? 0.17 - Math.abs(lat) : 0.06 - Math.abs(lat - 0.62);
          if (segF < 0.08) v *= 0.45;
          if (lip < 0.025) v *= lat > 0 ? 1.25 : 0.6;
          let col = rampDither(steel, v, i, j);
          // Rivets and lit window slits.
          if (inBelt && segF > 0.45 && segF < 0.55 && Math.abs(lat) < 0.05 && hash(seg, 3, 0, 9) > 0.45) col = hex('#ffd27a');
          if (inBelt && Math.abs(Math.abs(lat) - 0.12) < 0.012 && Math.floor(segF * 6) % 2 === 0) col = rampDither(steel, v + 0.25, i, j);
          // Hazard chevrons on the thin belt.
          if (inBelt2 && Math.floor((segF * 4 + lat * 30)) % 2 === 0) col = scale(hazard, 0.35 + 0.65 * diff);
          put(d, W, i, j, col);
        } else {
          // Torn plating: dark scorched rock with a hot edge.
          put(d, W, i, j, scale(d.slice(o * 4, o * 4 + 3) as unknown as RGB, 0.5));
        }
      }

      if (damaged) {
        const crack = 1 - Math.abs(2 * fbm3(dir[0] * 3 + 7, dir[1] * 3, dir[2] * 3, 4, 88) - 1);
        if (crack > 0.965) {
          put(d, W, i, j, rampDither(lava, (crack - 0.965) / 0.035 * 1.1, i, j));
        } else if (crack > 0.94) {
          const cur: RGB = [d[o * 4], d[o * 4 + 1], d[o * 4 + 2]];
          put(d, W, i, j, mix(cur, lava[1], 0.45));
        }
      }
    }
  }

  // Core socket: a bolted ring with a dark throat (the core/shutter sit on top as separate sprites).
  const C = FORTRESS_CORE;
  for (let j = C.y - 26; j <= C.y + 26; j++) {
    for (let i = C.x - 26; i <= C.x + 26; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const dx = i + 0.5 - C.x, dy = j + 0.5 - C.y;
      const r = Math.hypot(dx, dy);
      if (r > 25) continue;
      if (r > 18) {
        // Ring bevel: lit on the upper-right, dark lower-left.
        const lit = clamp01(0.5 + 0.5 * ((dx / r) * SUN[0] - (dy / r) * SUN[1]));
        let col = rampDither(steel, 0.2 + 0.6 * lit, i, j);
        const a = Math.atan2(dy, dx);
        if (Math.abs(r - 21.5) < 1 && Math.abs(Math.sin(a * 6)) < 0.18) col = steel[6];
        if (r > 24) col = steel[0];
        put(d, W, i, j, col);
      } else {
        // Throat: near-black with a dull red glow toward the centre.
        const glow = clamp01(1 - r / 18);
        put(d, W, i, j, mix(hex('#07060a'), hex('#5a0f1a'), glow * glow * (0.6 + 0.4 * bayer(i, j))));
      }
    }
  }

  // Turret housings (beneath the turret sprites).
  for (const t of FORTRESS_TURRETS) {
    const hx = W / 2 + t.x, hy = H / 2 - t.y;
    for (let j = hy - 12; j <= hy + 12; j++) {
      for (let i = hx - 12; i <= hx + 12; i++) {
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        const dx = i + 0.5 - hx, dy = j + 0.5 - hy;
        const r = Math.hypot(dx, dy);
        if (r > 9.5) continue;
        const lit = clamp01(0.5 + 0.5 * ((dx / (r || 1)) * SUN[0] - (dy / (r || 1)) * SUN[1]));
        put(d, W, i, j, r > 7 ? rampDither(steel, 0.15 + 0.6 * lit, i, j) : steel[1]);
        if (r > 8.8) put(d, W, i, j, steel[0]);
      }
    }
  }

  // Rear engine block: three nozzles with a cyan glow.
  for (let k = 0; k < 3; k++) {
    const ny = H / 2 - 22 + k * 22, nx = W - 18;
    for (let j = ny - 7; j <= ny + 7; j++) {
      for (let i = nx - 6; i < W; i++) {
        const dy = Math.abs(j + 0.5 - ny);
        const bellR = 4 + (i - (nx - 6)) * 0.22;
        if (dy > bellR) continue;
        let col: RGB;
        if (i === W - 1 || dy > bellR - 1) col = steel[0];
        else if (i > W - 4 && dy < bellR - 1.5) col = mix(hex('#7ff6ff'), hex('#1a8fb0'), dy / bellR);
        else col = rampDither(steel, 0.25 + 0.5 * clamp01(0.5 - (j - ny) / 10), i, j);
        put(d, W, i, j, col);
      }
    }
  }

  // Comms mast on top with a red beacon.
  const mx = W / 2 + 26;
  let topY = 0;
  while (topY < H && !g.hit[topY * W + mx]) topY++;
  for (let j = Math.max(1, topY - 14); j <= topY + 1; j++) {
    put(d, W, mx, j, steel[4]);
    if ((j & 3) === 0) { put(d, W, mx - 1, j, steel[2]); put(d, W, mx + 1, j, steel[3]); }
  }
  for (let i = -4; i <= 4; i++) put(d, W, mx + i, Math.max(1, topY - 8), steel[3 + (i > 0 ? 1 : 0)]);
  put(d, W, mx, Math.max(0, topY - 15), hex('#ff3b4a'));

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Armoured shutter half (36x18) that closes over the core. `bottom` flips the lighting. */
export function drawFortressShutter(bottom: boolean): HTMLCanvasElement {
  const W = 36, H = 18;
  const { canvas, ctx, img } = newCanvas(W, H);
  const steel: RGB[] = ['#0e1119', '#1d2230', '#2f3647', '#465065', '#64708a', '#8d9ab3', '#c3cede'].map(hex);
  const cx = W / 2;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      // Half-disc: flat edge at the seam (bottom row for the top half).
      const dx = i + 0.5 - cx;
      const dy = bottom ? j + 0.5 : H - (j + 0.5);
      const r = Math.hypot(dx, dy);
      if (r > 17.5) continue;
      const nz = Math.sqrt(Math.max(0, 1 - (r / 19) ** 2));
      const n = norm([dx / 19, (bottom ? -dy : dy) / 19, nz]);
      const diff = clamp01(dot(n, SUN));
      let col = rampDither(steel, 0.12 + 0.8 * diff, i, j);
      if (dy < 1.2) col = steel[0]; // seam
      if (r > 16.5) col = steel[0];
      // Hazard stripes along the seam.
      if (dy >= 1.2 && dy < 4.5 && Math.floor((i + (bottom ? 0 : 2)) / 3) % 2 === 0) col = scale(hex('#d49a1c'), 0.45 + 0.55 * diff);
      put(img.data, W, i, j, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Fortress gun turret (28x28): a squat dome with twin barrels pointing +x.
 * The sprite rotates to aim, so the dome is lit radially (no baked sun side).
 */
export function drawFortressTurret(): HTMLCanvasElement {
  const S = 28;
  const { canvas, ctx, img } = newCanvas(S, S);
  const steel: RGB[] = ['#0e1119', '#1d2230', '#2f3647', '#465065', '#64708a', '#8d9ab3', '#c3cede'].map(hex);
  const c = S / 2;
  // Twin barrels
  for (const by of [c - 3, c + 2]) {
    for (let x = c; x < S - 1; x++) {
      put(img.data, S, x, by, steel[x > S - 4 ? 1 : 4]);
      put(img.data, S, x, by + 1, steel[2]);
    }
    put(img.data, S, S - 1, by, steel[0]); put(img.data, S, S - 1, by + 1, steel[0]);
  }
  // Dome with mounting ring
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const dx = i + 0.5 - c, dy = j + 0.5 - c, r = Math.hypot(dx, dy);
      if (r > 10) continue;
      let col: RGB;
      if (r > 9) col = steel[0];
      else if (r > 7.5) col = rampDither(steel, 0.35 + 0.15 * Math.cos(Math.atan2(dy, dx) * 8), i, j);
      else col = rampDither(steel, 0.25 + 0.6 * (1 - r / 7.5), i, j);
      put(img.data, S, i, j, col);
    }
  }
  // Red sensor eye facing the barrels
  for (const [x, y, col] of [[c + 3, c - 1, '#ff5a4a'], [c + 3, c, '#c4163f'], [c + 4, c - 1, '#ffd0c0']] as [number, number, string][]) {
    put(img.data, S, x, y, hex(col));
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** The reactor core (34x34): a hot magenta-red orb. */
export function drawFortressCore(): HTMLCanvasElement {
  const S = 34;
  const { canvas, ctx, img } = newCanvas(S, S);
  const ramp: RGB[] = ['#3a0418', '#7a0a2c', '#c4163f', '#ff4a5e', '#ff9aa0', '#fff0f0'].map(hex);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const x = (i + 0.5 - S / 2) / 15, y = -(j + 0.5 - S / 2) / 15;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const swirl = fbm3(x * 3 + 1, y * 3, z * 3, 3, 120);
      const v = 0.35 + 0.5 * z + 0.25 * (swirl - 0.5) + 0.3 * Math.pow(clamp01(dot([x, y, z], HALF)), 12);
      put(img.data, S, i, j, rampDither(ramp, v, i, j));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Soft additive glow (64x64) for the core. */
export function drawCoreGlow(): HTMLCanvasElement {
  const S = 64;
  const { canvas, ctx, img } = newCanvas(S, S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const r = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2) / (S / 2);
      if (r >= 1) continue;
      const a = Math.pow(1 - r, 2);
      const q = Math.floor(a * 6 + bayer(i, j)) / 6;
      if (q > 0) put(img.data, S, i, j, hex('#ff3a5a'), Math.round(q * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}


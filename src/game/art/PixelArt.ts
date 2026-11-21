/**
 * Shared helpers for procedural pixel art: seeded noise (including
 * horizontally periodic noise for seamless parallax tiles), ordered
 * dithering into colour ramps, and small colour utilities.
 */

/** Deterministic hash of an integer lattice point to [0, 1). */
export function hash(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const smooth = (t: number) => t * t * (3 - 2 * t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Smooth 3D value noise in [0, 1]. */
export function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf), x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf), x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

export function fbm3(x: number, y: number, z: number, octaves: number, seed: number): number {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** 2D value noise that repeats every `period` lattice cells in x. */
export function noise2p(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const wrap = (v: number) => ((v % period) + period) % period;
  const x0 = wrap(xi), x1 = wrap(xi + 1);
  const a = hash(x0, yi, 0, seed), b = hash(x1, yi, 0, seed);
  const c = hash(x0, yi + 1, 0, seed), d = hash(x1, yi + 1, 0, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

/** Periodic 2D fBm: `x` in texels, repeats every `width` texels. */
export function fbm2p(x: number, y: number, width: number, baseCells: number, octaves: number, seed: number): number {
  let sum = 0, amp = 0.5, norm = 0, cells = baseCells;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2p((x / width) * cells, (y / width) * cells, cells, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    cells *= 2;
  }
  return sum / norm;
}

/** 4x4 Bayer matrix, normalised to [0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const scale = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s];

/** Pick a ramp colour for brightness `v` (0..1) with ordered dithering. */
export function rampDither(ramp: RGB[], v: number, x: number, y: number): RGB {
  const f = clamp01(v) * (ramp.length - 1);
  const i = Math.floor(f);
  const idx = f - i > bayer(x, y) ? Math.min(i + 1, ramp.length - 1) : i;
  return ramp[idx];
}

export function newCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx, img: ctx.createImageData(w, h) };
}

export function put(data: Uint8ClampedArray, w: number, x: number, y: number, c: RGB, a = 255) {
  const o = (y * w + x) * 4;
  data[o] = c[0];
  data[o + 1] = c[1];
  data[o + 2] = c[2];
  data[o + 3] = a;
}


/** Ridged periodic fBm: sharp creases where the noise crosses 0.5 (rock ridges/gullies). */
export function ridged2p(x: number, y: number, width: number, baseCells: number, octaves: number, seed: number): number {
  const n = fbm2p(x, y, width, baseCells, octaves, seed);
  return 1 - Math.abs(2 * n - 1);
}


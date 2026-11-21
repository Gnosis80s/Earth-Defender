/**
 * Stage 5 (inside the Moon): the aliens' factory of horrors.
 *
 * Two sections, flesh and metal grown together:
 *  - The throat: the Moon's rock tunnels, being eaten by wet, veined flesh
 *    with bone ribs and teeth along the walls and glowing pustules.
 *  - The factory: steel plates bolted straight into meat, pipes clamped in
 *    muscle, vats of half-grown aliens, pistons wrapped in sinew.
 *
 * Near tiles (800x600) draw only the ceiling and floor; the corridor stays
 * clear (walls never come closer than |y| = 180, the ship is held to 154 +
 * its radius). Far tiles are opaque and dim. All tiles wrap in x, and the
 * transition tiles let flesh consume the metal unevenly.
 *
 * Light comes from the corridor (bioluminescence), so ceilings are lit from
 * below and floors from above.
 */
import { hash, clamp01, fbm2p, ridged2p, bayer, RGB, hex, mix, scale, rampDither, newCanvas, put } from './PixelArt';
import { FLESH, BONE } from './Stage3Art';

const W = 800, H = 600;
const TAU = Math.PI * 2;
const STEEL: RGB[] = ['#07080c', '#11141c', '#1d222d', '#2c3340', '#414a59', '#5d6778', '#838d9e', '#b4bccb'].map(hex);
const ROCK: RGB[] = ['#050608', '#0d0f14', '#171a21', '#22262f', '#30353f', '#424853', '#575e6a'].map(hex);
const GLOW: RGB[] = ['#0a2010', '#16501f', '#2f8a3c', '#62c95e', '#b4f59a', '#eaffdc'].map(hex);
const BLOOD = hex('#3a0610');

type V3 = [number, number, number];
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wrapX = (x: number) => ((x % W) + W) % W;

export type Stage5Tile = 'entry' | 'throat' | 'throat_to_factory' | 'factory';

// ---------------------------------------------------------------------------
// Wall contours (world y of the wall surface, > 0) for ceiling and floor
// ---------------------------------------------------------------------------

function contour(kind: 'throat' | 'factory', x: number, floor: boolean): number {
  const s = floor ? 7 : 0;
  if (kind === 'throat') {
    return 200 + 20 * (fbm2p(x, 10 + s * 30, W, 5, 3, 501 + s) - 0.5) * 2 + 7 * Math.sin((x / W) * TAU * 4 + s);
  }
  // Factory: stepped plate edges with a little organic sag.
  const seg = Math.floor(wrapX(x) / 100);
  const step = hash(seg, s, 0, 503) < 0.5 ? 0 : 9;
  return 188 + step + 4 * (fbm2p(x, 30 + s * 20, W, 8, 2, 504 + s) - 0.5) * 2;
}

/** Bone teeth along the wall lip: is (x, distance-outside e) inside a tooth? */
function tooth(kind: 'throat' | 'factory', x: number, e: number, floor: boolean): number {
  const X = wrapX(x);
  const zone = kind === 'factory'
    ? (X % 200) > 40 && (X % 200) < 160
    : hash(Math.floor(X / 120), floor ? 1 : 0, 0, 507) > 0.55 && (X % 120) > 30 && (X % 120) < 90;
  if (!zone) return 0;
  const L = kind === 'factory' ? 9 : 7;
  if (e <= 0 || e >= L) return 0;
  const tx = (X % 12) / 12;
  const half = 0.5 * (1 - e / L);
  return Math.abs(tx - 0.5) < half ? 1 - e / L : 0;
}

// ---------------------------------------------------------------------------
// Near tiles
// ---------------------------------------------------------------------------

type Mat = 0 | 1 | 2 | 3 | 4; // none, flesh, bone, rock, metal

export function drawNearTile(tile: Stage5Tile): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(W, H);
  const d = img.data;
  const hgt = new Float32Array(W * H);
  const mat = new Uint8Array(W * H);
  const dep = new Float32Array(W * H);
  const glow = new Float32Array(W * H);

  const kindAt = (x: number, y: number): 'throat' | 'factory' => {
    if (tile === 'factory') return 'factory';
    if (tile !== 'throat_to_factory') return 'throat';
    const t = x / W + (fbm2p(x, y, W, 6, 3, 601) - 0.5) * 0.5;
    return t > 0.55 ? 'factory' : 'throat';
  };
  const contourAt = (x: number, floor: boolean) => {
    if (tile === 'throat_to_factory') {
      const t = clamp01((x / W - 0.25) / 0.5);
      const k = t * t * (3 - 2 * t);
      return contour('throat', x, floor) * (1 - k) + contour('factory', x, floor) * k;
    }
    let c = contour(tile === 'factory' ? 'factory' : 'throat', x, floor);
    if (tile === 'entry' && !floor) {
      // Lift the ceiling around the hatch we dropped through (hatch at tile x ~220).
      const k = clamp01(1 - Math.abs(x - 220) / 200);
      c = Math.max(c, 200 + 60 * Math.min(1, k * 1.6));
    }
    return c;
  };

  // Pass 1: material, height and emissive glow per wall pixel.
  for (let x = 0; x < W; x++) {
    const cTop = contourAt(x, false), cBot = contourAt(x, true);
    for (let Y = 0; Y < H; Y++) {
      const wy = 300 - (Y + 0.5);
      const floor = wy < 0;
      const surf = floor ? cBot : cTop;
      const depth = Math.abs(wy) - surf; // >0 inside the wall
      const o = Y * W + x;
      const kind = kindAt(x, Y);
      if (depth < 0) {
        const t = tooth(kind, x, -depth, floor);
        if (t > 0) { mat[o] = 2; hgt[o] = 0.6 * t; dep[o] = 0; }
        continue;
      }
      dep[o] = depth;
      // Lumpy meat with fine intestinal folds.
      const warp = fbm2p(x, Y, W, 8, 3, 510);
      const lumps = fbm2p(x, Y, W, 20, 4, 511) * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(warp * 38 + x * 0.05));
      const bulge = 0.55 * Math.exp(-depth / 9);
      if (kind === 'throat') {
        // Ribs: wide bone arches every 200px, curving as they sink into the wall.
        const rx = (wrapX(x + depth * 0.45) % 200) - 100;
        const ribW = 10 * (1 - depth / 120);
        const rib = depth < 95 && Math.abs(rx) < ribW ? Math.sqrt(1 - (rx / ribW) ** 2) : 0;
        const rock = fbm2p(x + 300, Y, W, 6, 3, 512) + depth / 95 > 1.05;
        hgt[o] = lumps * 0.6 + bulge + rib * 0.8;
        mat[o] = rib > 0.05 ? 2 : rock ? 3 : 1;
        // Glowing pustules
        const cx = Math.floor(wrapX(x) / 40), cy = Math.floor(depth / 26);
        if (mat[o] === 1 && hash(cx, cy, floor ? 1 : 0, 513) > 0.86) {
          const px = cx * 40 + 20 + (hash(cx, cy, 2, 514) - 0.5) * 16, py = cy * 26 + 13;
          const r = Math.hypot(wrapX(x) - px, depth - py);
          const R = 4 + hash(cx, cy, 3, 515) * 4;
          if (r < R) { hgt[o] += 0.5 * Math.sqrt(1 - (r / R) ** 2); glow[o] = 0.5 + 0.5 * (1 - r / R); }
        }
      } else {
        const u = Math.floor(wrapX(x) / 80), v = Math.floor(depth / 34);
        const fx = (wrapX(x) % 80) / 80, fy = (depth % 34) / 34;
        const plate = depth > 16 && depth < 130 && hash(u, v, floor ? 1 : 0, 521) > 0.28;
        const seam = fx < 0.05 || fy < 0.08;
        if (depth >= 3 && depth < 16) {
          // Pipe along the lip, clamped by bands of muscle.
          const pr = (depth - 9.5) / 6.5;
          hgt[o] = 0.9 * Math.sqrt(Math.max(0, 1 - pr * pr));
          mat[o] = (wrapX(x) % 60) < 9 ? 1 : 4;
        } else if (plate && !seam) {
          const edge = Math.min(fx, 1 - fx, fy * 0.4, (1 - fy) * 0.4) * 10;
          hgt[o] = 0.55 + Math.min(1, edge) * 0.2;
          mat[o] = 4;
          // Rivets driven through into the flesh below.
          const rxp = Math.min(Math.abs(fx - 0.1), Math.abs(fx - 0.9)) * 80, ryp = Math.abs(fy - 0.5) * 34;
          if (Math.hypot(rxp, ryp) < 1.8) hgt[o] += 0.4;
          // Green status lamps in some plates.
          if (hash(u, v, 9, 523) > 0.82 && Math.hypot(fx * 80 - 40, fy * 34 - 17) < 2.5) glow[o] = 1;
        } else {
          hgt[o] = lumps * 0.6 + bulge * 0.4 + (seam && plate ? 0.25 : 0);
          mat[o] = 1;
        }
      }
    }
  }

  // Pass 2: shade.
  for (let Y = 0; Y < H; Y++) {
    const floor = Y >= H / 2;
    const L: V3 = norm([-0.3, floor ? 0.55 : -0.55, 0.78]);
    const Hh: V3 = norm([L[0], L[1], L[2] + 1]);
    for (let x = 0; x < W; x++) {
      const o = Y * W + x;
      const m = mat[o] as Mat;
      if (!m) continue;
      const h = (xx: number, yy: number) => {
        const q = (Math.min(H - 1, Math.max(0, yy))) * W + wrapX(xx);
        return mat[q] ? hgt[q] : hgt[o] - 0.6;
      };
      const k = 7;
      const n = norm([-(h(x + 1, Y) - h(x - 1, Y)) * k, (h(x, Y + 1) - h(x, Y - 1)) * k, 1]);
      const diff = clamp01(dot(n, L));
      const spec = Math.pow(clamp01(dot(n, Hh)), 30);
      const ao = 1 - clamp01((dep[o] - 4) / 90) * 0.8;
      let col: RGB;
      if (m === 1) {
        const vein = ridged2p(x, Y, W, 7, 3, 531);
        let v = (0.03 + 0.72 * Math.pow(diff, 1.4)) * ao;
        if (vein > 0.92) v *= 0.45;
        col = rampDither(FLESH, v, x, Y);
        // Small wet glints on the crests only.
        if (spec > 0.8 && ao > 0.75) col = FLESH[8];
        else if (spec > 0.62 && ao > 0.75) col = FLESH[6];
        // Bioluminescent veins (thin, sparse)
        if (ridged2p(x, Y, W, 6, 3, 532) > 0.982 && fbm2p(x, Y, W, 3, 2, 533) > 0.55) glow[o] = Math.max(glow[o], 0.4);
      } else if (m === 2) {
        col = rampDither(BONE, (0.08 + 0.75 * Math.pow(diff, 1.2)) * ao + spec * 0.3, x, Y);
      } else if (m === 3) {
        col = rampDither(ROCK, (0.12 + 0.6 * diff) * ao, x, Y);
      } else {
        col = rampDither(STEEL, (0.1 + 0.7 * diff) * ao + spec * 0.45, x, Y);
        const stain = fbm2p(x, Y, W, 9, 3, 541);
        if (stain > 0.6) col = mix(col, BLOOD, clamp01((stain - 0.6) / 0.15) * 0.55);
      }
      if (glow[o] > 0) col = rampDither(GLOW, 0.3 + glow[o] * 0.7, x, Y);
      // Dark lip where the wall meets the corridor.
      if (dep[o] < 1.2 && m !== 2) col = FLESH[0];
      put(d, W, x, Y, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Far tiles (opaque, dim)
// ---------------------------------------------------------------------------

export function drawFarTile(tile: 'throat' | 'throat_to_factory' | 'factory'): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(W, H);
  const d = img.data;
  const isFactoryAt = (x: number, Y: number) => {
    if (tile === 'factory') return true;
    if (tile === 'throat') return false;
    return x / W + (fbm2p(x, Y, W, 5, 3, 611) - 0.5) * 0.4 > 0.5;
  };

  for (let Y = 0; Y < H; Y += 2) {
    for (let x = 0; x < W; x += 2) {
      const wy = 300 - Y;
      const fac = isFactoryAt(x, Y);
      let col: RGB;
      if (!fac) col = throatFar(x, Y, wy);
      else col = factoryFar(x, Y, wy);
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(d, W, x + a, Y + b, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Deep cavern: dim flesh walls, hanging tendrils, egg sacs. */
function throatFar(x: number, Y: number, wy: number): RGB {
  const dark = hex('#070205'), maroon = hex('#24070f');
  const ty = Math.abs(wy) / 300;
  let col = mix(dark, maroon, clamp01(ty * 1.3 - 0.2));
  const wall = 150 + 45 * fbm2p(x, wy > 0 ? 20 : 80, W, 4, 3, 621);
  if (Math.abs(wy) > wall) {
    const lump = fbm2p(x, Y, W, 16, 3, 622);
    col = rampDither(FLESH, 0.08 + 0.22 * lump + 0.1 * clamp01((Math.abs(wy) - wall) / 30), x >> 1, Y >> 1);
    // Egg sacs
    const cx = Math.floor(x / 50), cy = Math.floor(Math.abs(wy) / 30);
    if (hash(cx, cy, wy > 0 ? 1 : 0, 623) > 0.8) {
      const r = Math.hypot(x - (cx * 50 + 25), Math.abs(wy) - (cy * 30 + 15));
      if (r < 9) col = r > 7.5 ? FLESH[1] : rampDither(GLOW, 0.15 + 0.35 * (1 - r / 9), x >> 1, Y >> 1);
    }
    return col;
  }
  // Tendrils hanging between ceiling and floor.
  for (let k = 0; k < 7; k++) {
    const x0 = (k + 0.5) * (W / 7) + (hash(k, 0, 0, 631) - 0.5) * 60;
    const w = 2 + hash(k, 1, 0, 632) * 5;
    const sx = x0 + 14 * Math.sin(Y * 0.018 + k * 2.1);
    let dx = x - sx;
    if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
    const gapY = 200 + hash(k, 2, 0, 633) * 200;
    if (Math.abs(dx) < w && !(hash(k, 3, 0, 634) > 0.5 && Math.abs(Y - gapY) < 40)) {
      const lit = 0.5 - dx / (2 * w);
      return rampDither(FLESH, 0.06 + 0.22 * lit, x >> 1, Y >> 1);
    }
  }
  // Faint drifting spores.
  if (hash(x >> 1, Y >> 1, 0, 635) > 0.997) return GLOW[1];
  return col;
}

/** Factory depths: vats of embryos, sinew-wrapped pistons, artery pipes. */
function factoryFar(x: number, Y: number, wy: number): RGB {
  // Back wall: dim plating.
  const u = Math.floor(x / 48), v = Math.floor(Y / 40);
  let col = rampDither(STEEL, 0.06 + 0.08 * hash(u, v, 0, 641) + ((x % 48) < 2 || (Y % 40) < 2 ? -0.05 : 0), x >> 1, Y >> 1);
  // Ceiling/floor masses of flesh.
  const wall = 165 + 35 * fbm2p(x, wy > 0 ? 40 : 90, W, 5, 3, 642);
  if (Math.abs(wy) > wall) return rampDither(FLESH, 0.06 + 0.2 * fbm2p(x, Y, W, 14, 3, 643), x >> 1, Y >> 1);
  // Artery pipes behind everything.
  for (const py of [130, -130]) {
    const r = Math.abs(wy - py);
    if (r < 8) {
      const pulse = 0.5 + 0.5 * Math.sin((x / W) * TAU * 6);
      let c = rampDither(FLESH, 0.18 + 0.3 * (1 - r / 8) + (r < 2 ? 0.15 : 0), x >> 1, Y >> 1);
      if (r < 2.5 && pulse > 0.7) c = FLESH[6];
      col = c;
    }
  }
  // Sinew-wrapped pistons between the vats.
  const px = ((x % 200) + 200) % 200;
  if (px < 10 || px > 190) {
    const dx = px < 10 ? px : px - 200;
    const band = Math.floor((Y + dx * 0.8) / 9) % 3 === 0;
    col = band ? rampDither(FLESH, 0.3 + 0.1 * (dx / 10), x >> 1, Y >> 1) : rampDither(STEEL, 0.25 + 0.15 * (1 - Math.abs(dx) / 10), x >> 1, Y >> 1);
  }
  // Incubation vats with something growing inside.
  const vx = px - 100;
  if (Math.abs(vx) < 34 && Math.abs(wy) < 150) {
    if (Math.abs(wy) > 128) return rampDither(STEEL, 0.2 + 0.25 * (1 - Math.abs(vx) / 34), x >> 1, Y >> 1); // caps
    if (Math.abs(vx) > 31) return STEEL[3];                                                                  // rim
    const fluid = 0.18 + 0.3 * (1 - Math.abs(vx) / 31) + 0.06 * Math.sin(Y * 0.15 + x * 0.05);
    let c = rampDither(GLOW, fluid, x >> 1, Y >> 1);
    // Embryo: a curled dark body with a big head.
    const ex = vx, ey = wy;
    const body = (ex / 13) ** 2 + ((ey + 10) / 30) ** 2 < 1;
    const head = Math.hypot(ex - 2, ey - 28) < 15;
    const tail = Math.abs(Math.hypot(ex + 6, ey + 38) - 12) < 3 && ex < 0;
    if (body || head || tail) c = mix(GLOW[0], hex('#04100a'), 0.6);
    if (head && Math.hypot(ex + 4, ey - 30) < 2.5) c = hex('#b4f59a'); // a single open eye
    // Glass highlight.
    if (vx > 18 && vx < 22) c = mix(c, hex('#dcffe8'), 0.35);
    return c;
  }
  // Fog: keep it a background.
  return scale(col, 0.95);
}

void bayer;

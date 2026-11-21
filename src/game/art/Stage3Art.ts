/**
 * Procedural art for Stage 3 (lunar orbit): the sun's glare, distant alien
 * orbital wreckage, proximity mines and the Solar Dock boss.
 *
 * The sun sits off-screen to the upper right (matching the Moon shader's
 * stage 3 light), so every lit edge faces up-right.
 */
import { clamp01, fbm3, bayer, RGB, hex, mix, scale, rampDither, newCanvas, put } from './PixelArt';

type V3 = [number, number, number];
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const SUN: V3 = norm([0.8, 0.45, 0.4]);
const HALF: V3 = norm([SUN[0], SUN[1], SUN[2] + 1]);

const STEEL: RGB[] = ['#0b0e15', '#191e2a', '#2a3140', '#3f4859', '#596377', '#7b869b', '#a6b0c2', '#d5dbe5'].map(hex);
const GOLD: RGB[] = ['#2a1804', '#5a3608', '#8c5a10', '#c08a1c', '#e6b83a', '#fde39a'].map(hex);
const CELL: RGB[] = ['#050a1c', '#0b1636', '#132658', '#1d3c84', '#2f5cb4', '#5a8ae0', '#a9c6ff'].map(hex);
const ALIEN: RGB[] = ['#08140c', '#123a1e', '#1f6b33', '#38a44c', '#7ae07a', '#d4ffc4'].map(hex);

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------------------------------------------------------------------------
// A tiny shape painter: beveled shapes lit by the sun.
// ---------------------------------------------------------------------------

type Mat = 'steel' | 'dark' | 'gold' | 'cells' | 'alien' | 'glass';
interface Shape {
  /** Signed distance inside (>0) and the outward gradient at (x, y) (world-style coords, y up). */
  sd: (x: number, y: number) => { d: number; gx: number; gy: number };
  mat: Mat;
  bevel: number;
}

const rect = (cx: number, cy: number, hw: number, hh: number, mat: Mat, bevel = 2): Shape => ({
  mat, bevel,
  sd: (x, y) => {
    const dx = hw - Math.abs(x - cx), dy = hh - Math.abs(y - cy);
    return dx < dy ? { d: dx, gx: Math.sign(x - cx), gy: 0 } : { d: dy, gx: 0, gy: Math.sign(y - cy) };
  },
});
const circle = (cx: number, cy: number, r: number, mat: Mat, bevel = 3): Shape => ({
  mat, bevel,
  sd: (x, y) => {
    const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    return { d: r - l, gx: dx / l, gy: dy / l };
  },
});
const octagon = (cx: number, cy: number, r: number, mat: Mat, bevel = 4): Shape => ({
  mat, bevel,
  sd: (x, y) => {
    const dx = x - cx, dy = y - cy;
    const k = Math.SQRT1_2;
    const c = [Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * k];
    let m = 0;
    if (c[1] > c[m]) m = 1;
    if (c[2] > c[m]) m = 2;
    const gx = m === 0 ? Math.sign(dx) : m === 1 ? 0 : Math.sign(dx) * k;
    const gy = m === 0 ? 0 : m === 1 ? Math.sign(dy) : Math.sign(dy) * k;
    return { d: r - c[m], gx, gy };
  },
});

/**
 * Paint shapes (later = on top) into a W x H canvas whose origin is the
 * centre, y up. Adds a dark 1px outline around the union.
 */
function paint(W: number, H: number, shapes: Shape[], opts: { seed?: number; scorch?: number } = {}) {
  const { canvas, ctx, img } = newCanvas(W, H);
  const mask = new Uint8Array(W * H);
  const seed = opts.seed ?? 1;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = i + 0.5 - W / 2, y = H / 2 - (j + 0.5);
      let hit: Shape | null = null, info = { d: 0, gx: 0, gy: 0 };
      for (let k = shapes.length - 1; k >= 0; k--) {
        const r = shapes[k].sd(x, y);
        if (r.d > 0) { hit = shapes[k]; info = r; break; }
      }
      if (!hit) continue;
      mask[j * W + i] = 1;
      const t = clamp01(1 - info.d / hit.bevel);
      const n = norm([info.gx * t * 1.4, info.gy * t * 1.4, 1]);
      const diff = clamp01(dot(n, SUN));
      const spec = Math.pow(clamp01(dot(n, HALF)), 20);
      let col: RGB;
      switch (hit.mat) {
        case 'steel': {
          const grime = (fbm3(x * 0.15, y * 0.15, seed, 3, 9) - 0.5) * 0.2;
          col = rampDither(STEEL, 0.15 + 0.7 * diff + spec * 0.35 + grime, i, j);
          break;
        }
        case 'dark':
          col = rampDither(STEEL, 0.05 + 0.3 * diff, i, j);
          break;
        case 'gold': {
          // Crinkled thermal foil.
          const cr = fbm3(x * 0.45, y * 0.45, seed + 3, 3, 7);
          const nn = norm([n[0] + (cr - 0.5) * 1.6, n[1] + (fbm3(x * 0.45 + 9, y * 0.45, seed, 3, 8) - 0.5) * 1.6, n[2]]);
          col = rampDither(GOLD, 0.15 + 0.6 * clamp01(dot(nn, SUN)) + Math.pow(clamp01(dot(nn, HALF)), 12) * 0.6, i, j);
          break;
        }
        case 'cells': {
          // Photovoltaic cells: blue grid with a sheen sweeping across.
          const gxl = ((x % 7) + 7) % 7, gyl = ((y % 7) + 7) % 7;
          if (gxl < 1 || gyl < 1) { col = STEEL[3]; break; }
          const sheen = clamp01(1 - Math.abs((x - y * 0.6) / 40 - 0.6));
          col = rampDither(CELL, 0.25 + 0.35 * sheen + 0.25 * diff, i, j);
          break;
        }
        case 'alien': {
          // Organic plating grown over the machinery: veined and glowing faintly.
          const v = 1 - Math.abs(2 * fbm3(x * 0.09, y * 0.09, seed + 5, 4, 11) - 1);
          col = rampDither(ALIEN, 0.1 + 0.35 * diff + (v > 0.85 ? 0.5 : 0), i, j);
          break;
        }
        case 'glass':
          col = rampDither(CELL, 0.2 + 0.6 * diff + spec, i, j);
          break;
      }
      if (opts.scorch) {
        const s = fbm3(x * 0.07, y * 0.07, seed + 13, 4, 21);
        if (s > 1 - opts.scorch) col = scale(col, 0.45);
        const crack = 1 - Math.abs(2 * fbm3(x * 0.12, y * 0.12, seed + 17, 4, 23) - 1);
        if (crack > 0.96) col = hex(crack > 0.985 ? '#ffd27a' : '#ff6a2a');
      }
      put(img.data, W, i, j, col);
    }
  }
  // Outline
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (!mask[j * W + i]) continue;
      const e = (a: number, b: number) => a < 0 || b < 0 || a >= W || b >= H || !mask[b * W + a];
      if (e(i - 1, j) || e(i + 1, j) || e(i, j - 1) || e(i, j + 1)) put(img.data, W, i, j, STEEL[0]);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

/** Additive sun glare (320x320): the sun itself sits just off the top-right of the screen. */
export function drawSunGlare(): HTMLCanvasElement {
  const S = 320;
  const { canvas, ctx, img } = newCanvas(S, S);
  const c = S / 2;
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const dx = i + 0.5 - c, dy = j + 0.5 - c;
      const r = Math.hypot(dx, dy) / c;
      if (r >= 1) continue;
      const a = Math.atan2(dy, dx);
      // Soft core + four diffraction spikes + a faint ring.
      let v = Math.pow(1 - r, 3) * 0.9;
      const spike = Math.pow(Math.abs(Math.cos(a * 2)), 60) * Math.pow(1 - r, 1.5) * 0.7;
      v += spike + Math.exp(-(((r - 0.62) / 0.03) ** 2)) * 0.08;
      const q = Math.floor(clamp01(v) * 7 + bayer(i, j)) / 7;
      if (q <= 0) continue;
      const col = mix(hex('#ffb35a'), hex('#fff6dc'), clamp01(q * 1.3));
      put(img.data, S, i, j, col, Math.round(q * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Distant orbital wreckage and alien relay pylons (800x300, tiles in x):
 * dim silhouettes with sunlit edges, set back from the playfield.
 */
export function drawOrbitalWreckage(): HTMLCanvasElement {
  const W = 800, H = 300;
  const { canvas, ctx, img } = newCanvas(W, H);
  const r = rng(321);
  const items: { x: number; y: number; kind: number; s: number }[] = [
    { x: 200, y: 170, kind: 0, s: 1 }, { x: 620, y: 80, kind: 2, s: 1 },
  ];
  const dimRamp: RGB[] = ['#0a0d16', '#121827', '#1b2337', '#263049', '#33405e', '#46557a'].map(hex);
  const lit = (i: number, j: number, v: number) => rampDither(dimRamp, v, i, j);
  const plot = (x: number, y: number, v: number) => {
    const xi = ((Math.round(x) % W) + W) % W, yi = Math.round(y);
    if (yi >= 0 && yi < H) put(img.data, W, xi, yi, lit(xi, yi, v));
  };
  for (const it of items) {
    if (it.kind === 0) {
      // Truss boom with solar panel pairs.
      const L = 220;
      for (let t = 0; t < L; t++) {
        const x = it.x - L / 2 + t;
        plot(x, it.y - 3, 0.75); plot(x, it.y + 3, 0.3);
        if (t % 8 < 1) for (let k = -3; k <= 3; k++) plot(x, it.y + k, 0.5);
        if ((t % 8) === Math.round(4 + 3 * Math.sin(t))) plot(x, it.y, 0.45);
      }
      for (const px of [-80, -30, 30, 80]) {
        for (let j = -34; j <= 34; j++) {
          if (Math.abs(j) < 6) continue;
          for (let i = -16; i <= 16; i++) {
            const grid = (i + 16) % 6 === 0 || (j + 34) % 6 === 0;
            plot(it.x + px + i, it.y + j, grid ? 0.15 : 0.3 + 0.25 * clamp01((i - j * 0.4) / 30 + 0.5));
          }
        }
      }
    } else if (it.kind === 1) {
      // Broken ring segment (a cylinder seen side-on, torn at one end).
      for (let i = -70; i <= 70; i++) {
        const torn = i > 40 ? Math.floor(r() * 10) : 0;
        for (let j = -14 + torn; j <= 14 - torn; j++) {
          const n = j / 14;
          plot(it.x + i, it.y + j, 0.2 + 0.6 * clamp01(0.5 - n * 0.7) * (i % 18 === 0 ? 0.6 : 1));
        }
      }
    } else {
      // Alien relay pylon: a tall spindle with a faint green beacon.
      for (let j = -60; j <= 60; j++) {
        const w = 3 + 9 * Math.pow(1 - Math.abs(j) / 60, 2);
        for (let i = -Math.ceil(w); i <= Math.ceil(w); i++) {
          if (Math.abs(i) > w) continue;
          plot(it.x + i, it.y + j, 0.15 + 0.55 * clamp01(0.5 + i / (2 * w)));
        }
      }
      for (let k = 0; k < 3; k++) {
        const yy = it.y - 20 + k * 20;
        for (let i = -22; i <= 22; i++) plot(it.x + i, yy, 0.35 + 0.3 * (i > 0 ? 1 : 0));
      }
      put(img.data, W, it.x, it.y - 62, hex('#7ae07a'));
      put(img.data, W, it.x, it.y - 63, hex('#38a44c'));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Proximity mine
// ---------------------------------------------------------------------------

/** Spiked alien proximity mine (36x36). `armed` lights the core red. */
export function drawMine(armed: boolean): HTMLCanvasElement {
  const S = 36;
  const shapes: Shape[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    shapes.push(circle(Math.cos(a) * 13.5, Math.sin(a) * 13.5, 3, 'steel', 2));
    shapes.push(circle(Math.cos(a) * 10.5, Math.sin(a) * 10.5, 3, 'steel', 2));
  }
  shapes.push(circle(0, 0, 11.5, 'dark', 7));
  shapes.push(circle(0, 0, 6, 'steel', 2));
  const c = paint(S, S, shapes, { seed: 5 });
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, S, S);
  const eye: RGB[] = armed ? ['#5a0a0a', '#c4161f', '#ff5a4a', '#ffd0c0'].map(hex) : ['#0d3a1a', '#1f8a3a', '#7ae07a', '#e0ffd8'].map(hex);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const r = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2);
      if (r < 4.2) put(img.data, S, i, j, rampDither(eye, 1 - r / 4.2 + 0.15, i, j));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Boss: the Solar Dock
// ---------------------------------------------------------------------------

export const DOCK_HUB_W = 136;
export const DOCK_HUB_H = 100;
/** Lens (solar cannon) centre relative to the hub centre (world units, y up). */
export const DOCK_LENS = { x: -50, y: 0 };
export const DOCK_WING_W = 112;
export const DOCK_WING_H = 112;

/**
 * Hub: an armoured octagonal module half-swallowed by alien growth, with
 * the solar cannon's lens facing the player, gold thermal foil, radiator
 * fins and a docking collar at the back. `damaged` scorches and cracks it.
 */
export function drawDockHub(damaged = false): HTMLCanvasElement {
  const shapes: Shape[] = [
    rect(44, 0, 22, 14, 'steel', 3),              // docking collar
    rect(62, 0, 6, 22, 'dark', 2),
    rect(60, 0, 4, 18, 'steel', 2),
    rect(10, 38, 34, 6, 'steel', 2),               // radiator rails
    rect(10, -38, 34, 6, 'steel', 2),
    octagon(0, 0, 42, 'steel', 6),                 // main module
    rect(14, 0, 20, 30, 'gold', 3),                // foil blanket
    circle(30, 22, 12, 'alien', 6),                // alien growth
    circle(38, -16, 14, 'alien', 7),
    circle(22, -30, 9, 'alien', 5),
    circle(-50, 0, 19, 'steel', 4),                // lens mount
    circle(-50, 0, 15, 'dark', 2),
  ];
  const c = paint(DOCK_HUB_W, DOCK_HUB_H, shapes, { seed: 31, scorch: damaged ? 0.35 : 0 });
  // Lens glass (drawn over the mount; brightened at runtime by the glow sprite).
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, DOCK_HUB_W, DOCK_HUB_H);
  const lx = DOCK_HUB_W / 2 + DOCK_LENS.x, ly = DOCK_HUB_H / 2 - DOCK_LENS.y;
  const lens: RGB[] = ['#06142a', '#0e3456', '#1a6a8a', '#33b0c4', '#8ae8ee', '#f2fff8'].map(hex);
  for (let j = 0; j < DOCK_HUB_H; j++) {
    for (let i = 0; i < DOCK_HUB_W; i++) {
      const dx = i + 0.5 - lx, dy = -(j + 0.5 - ly), r = Math.hypot(dx, dy);
      if (r > 13) continue;
      const z = Math.sqrt(Math.max(0, 1 - (r / 13) ** 2));
      const n: V3 = [dx / 13, dy / 13, z];
      const v = 0.2 + 0.35 * z + Math.pow(clamp01(dot(n, HALF)), 30) * 0.9;
      put(img.data, DOCK_HUB_W, i, j, rampDither(lens, v, i, j));
      if (r > 12.2) put(img.data, DOCK_HUB_W, i, j, STEEL[0]);
    }
  }
  // Radiator fins
  for (const sy of [1, -1]) {
    for (let k = 0; k < 9; k++) {
      const fx = DOCK_HUB_W / 2 - 18 + k * 7, fy = DOCK_HUB_H / 2 - sy * 38;
      for (let t = -4; t <= 4; t++) put(img.data, DOCK_HUB_W, fx, fy + t, STEEL[k % 2 ? 2 : 5]);
    }
  }
  // Status lights
  const lights = [[0, -10], [6, -10], [12, -10]];
  for (const [x, y] of lights) put(img.data, DOCK_HUB_W, DOCK_HUB_W / 2 + x, DOCK_HUB_H / 2 - y, hex(damaged ? '#ff3b3b' : '#7ae07a'));
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * A solar wing (112x112): truss from the hub (bottom of the texture for the
 * top wing) out to a gold-framed photovoltaic array. `bottom` mirrors it.
 */
export function drawDockWing(bottom: boolean): HTMLCanvasElement {
  const s = bottom ? -1 : 1;
  const shapes: Shape[] = [
    rect(0, s * -40, 5, 16, 'steel', 2),          // truss
    rect(0, s * 14, 54, 40, 'gold', 2),            // frame
    rect(-26, s * 14, 24, 36, 'cells', 1),         // two panel sections
    rect(26, s * 14, 24, 36, 'cells', 1),
    rect(0, s * 14, 3, 40, 'steel', 1),            // centre spar
  ];
  const c = paint(DOCK_WING_W, DOCK_WING_H, shapes, { seed: bottom ? 41 : 43 });
  // Truss lattice detail
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, DOCK_WING_W, DOCK_WING_H);
  for (let t = 0; t < 32; t++) {
    const y = DOCK_WING_H / 2 - s * (-56 + t);
    const x = DOCK_WING_W / 2 + (t % 8 < 4 ? (t % 4) - 2 : 2 - (t % 4));
    if (y >= 0 && y < DOCK_WING_H) put(img.data, DOCK_WING_W, Math.round(x), Math.round(y), STEEL[1]);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Power node at the wing root (26x26): a glowing green capacitor in a collar. */
export function drawDockNode(): HTMLCanvasElement {
  const S = 26;
  const c = paint(S, S, [circle(0, 0, 11, 'steel', 3), circle(0, 0, 7.5, 'dark', 1)], { seed: 51 });
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, S, S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const r = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2);
      if (r < 6.5) put(img.data, S, i, j, rampDither(ALIEN, 1.05 - r / 6.5 * 0.8, i, j));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Additive glow (64x64) for the lens; tinted at runtime. */
export function drawLensGlow(): HTMLCanvasElement {
  const S = 64;
  const { canvas, ctx, img } = newCanvas(S, S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const r = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2) / (S / 2);
      if (r >= 1) continue;
      const q = Math.floor(Math.pow(1 - r, 2) * 6 + bayer(i, j)) / 6;
      if (q > 0) put(img.data, S, i, j, hex('#ffffff'), Math.round(q * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}


/**
 * Stage 5 creatures and machinery: the factory's bio-mechanical enemies,
 * the gatekeeper and its jaw-door, and the Mother Brain.
 *
 * Enemies face -x (they fly at the player). Light comes from the corridor
 * in front and above, so lit edges face up-left.
 */
import { paint, rect, circle, ellipse, Shape, FLESH, BONE } from './Stage3Art';
import { clamp01, fbm3, ridged2p, bayer, RGB, hex, mix, rampDither, newCanvas, put } from './PixelArt';

type V3 = [number, number, number];
const L5: V3 = [-0.45, 0.55, 0.7];
const opts = (seed: number) => ({ seed, sun: L5 });
const GLOW: RGB[] = ['#0a2010', '#16501f', '#2f8a3c', '#62c95e', '#b4f59a', '#eaffdc'].map(hex);

/** Draw an eye (iris + pupil) onto a canvas at (cx, cy) texture coords, looking toward (lx, ly). */
function eye(c: HTMLCanvasElement, cx: number, cy: number, r: number, lx: number, ly: number, iris: RGB[] = GLOW) {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const ix = cx + lx * r * 0.35, iy = cy + ly * r * 0.35;
  for (let j = Math.floor(cy - r); j <= cy + r; j++) {
    for (let i = Math.floor(cx - r); i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= c.width || j >= c.height) continue;
      const d = Math.hypot(i + 0.5 - ix, j + 0.5 - iy);
      const ir = r * 0.55;
      if (d < ir * 0.42) put(img.data, c.width, i, j, hex('#020302'));
      else if (d < ir) put(img.data, c.width, i, j, rampDither(iris, 0.9 - (d / ir) * 0.6, i, j));
    }
  }
  // Catch-light
  put(img.data, c.width, Math.round(ix - r * 0.2), Math.round(iy - r * 0.25), hex('#ffffff'));
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

/** Larva drone (36): a fleshy pod in a steel collar, one staring eye, feelers trailing. */
export function drawBioDrone(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(12, 7, 6, 1.6, 'flesh', 1), ellipse(13, -7, 6, 1.6, 'flesh', 1),
    ellipse(2, 0, 13, 10, 'flesh', 6),
    rect(6, 0, 2.5, 10, 'steel', 2),
    ellipse(-8, 0, 7, 7, 'eye', 4),
  ];
  return eye(paint(36, 36, s, opts(301)), 18 - 8, 18, 6.5, -1, 0);
}

/** Stalker (48): a long-limbed hunter, plated skull, mandibles, ribbed body. */
export function drawBioStalker(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(8, 14, 12, 2, 'bone', 1), ellipse(8, -14, 12, 2, 'bone', 1),     // legs
    ellipse(14, 9, 9, 1.8, 'bone', 1), ellipse(14, -9, 9, 1.8, 'bone', 1),
    ellipse(8, 0, 15, 8, 'flesh', 5),                                          // body
    rect(4, 0, 1.5, 7, 'bone', 1), rect(10, 0, 1.5, 7, 'bone', 1), rect(16, 0, 1.5, 6, 'bone', 1),
    ellipse(-10, 0, 10, 8, 'steel', 4),                                        // armoured skull
    ellipse(-19, 4, 6, 1.8, 'bone', 1), ellipse(-19, -4, 6, 1.8, 'bone', 1),  // mandibles
    circle(-12, 3, 2.2, 'glow', 1), circle(-12, -3, 2.2, 'glow', 1),
  ];
  return paint(48, 48, s, opts(303));
}

/** Behemoth (72): a bloated mass of meat on a steel frame, tubes and a cluster of eyes over a toothed maw. */
export function drawBioBehemoth(): HTMLCanvasElement {
  const s: Shape[] = [
    rect(20, 0, 8, 26, 'steel', 3),                       // rear frame
    ellipse(24, 18, 9, 3, 'flesh', 2), ellipse(24, -18, 9, 3, 'flesh', 2),
    ellipse(4, 0, 27, 24, 'flesh', 10),                   // body
    rect(4, 22, 18, 3, 'steel', 2), rect(4, -22, 18, 3, 'steel', 2),  // straps
    ellipse(-20, -6, 9, 7, 'dark', 3),                    // maw
    ellipse(-14, 12, 5, 5, 'eye', 3), ellipse(-4, 16, 4, 4, 'eye', 2), ellipse(-20, 5, 4, 4, 'eye', 2),
  ];
  const c = paint(72, 72, s, opts(305));
  eye(c, 36 - 14, 36 - 12, 4.6, -1, 0.2); eye(c, 36 - 4, 36 - 16, 3.6, -1, 0.3); eye(c, 36 - 20, 36 - 5, 3.6, -1, 0);
  // Teeth around the maw.
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, 72, 72);
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * 0.5 + (k / 6) * Math.PI;
    const tx = 36 - 20 + Math.cos(a) * 8, ty = 36 + 6 - Math.sin(a) * 6;
    put(img.data, 72, Math.round(tx), Math.round(ty), BONE[5]);
    put(img.data, 72, Math.round(tx + Math.cos(a) * -1.5), Math.round(ty + Math.sin(a) * 1.5), BONE[4]);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// Gatekeeper and its door
// ---------------------------------------------------------------------------

/** Gatekeeper (110): an armoured skull grafted to a mass of muscle and cabling, jaw cannons. */
export function drawGatekeeper(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(30, 30, 14, 5, 'flesh', 3), ellipse(30, -30, 14, 5, 'flesh', 3), // cables of muscle
    ellipse(40, 0, 16, 26, 'flesh', 8),
    rect(36, 0, 3, 28, 'steel', 2),
    ellipse(6, 0, 34, 30, 'steel', 10),                                         // skull plate
    ellipse(-4, 18, 22, 8, 'steel', 4), ellipse(-4, -18, 22, 8, 'steel', 4),
    rect(-26, 12, 14, 4, 'dark', 2), rect(-26, -12, 14, 4, 'dark', 2),          // jaw cannons
    rect(-24, 12, 12, 2.5, 'steel', 1), rect(-24, -12, 12, 2.5, 'steel', 1),
    ellipse(-14, 0, 13, 9, 'flesh', 5),                                          // exposed snout
    ellipse(-6, 0, 9, 9, 'eye', 4),
  ];
  const c = paint(110, 110, s, opts(311));
  return eye(c, 55 - 6, 55, 8.5, -1, 0, ['#3a0404', '#7a0a0a', '#c41616', '#ff4a3a', '#ffb0a0'].map(hex));
}

/**
 * Jaw-door half (120x300). Steel slabs with meat grown into every seam and
 * a row of teeth along the closing edge (bottom edge for the top half).
 */
export function drawJawDoor(bottom: boolean): HTMLCanvasElement {
  const W = 120, H = 300;
  const sgn = bottom ? -1 : 1;
  const s: Shape[] = [];
  for (let k = 0; k < 5; k++) s.push(rect(0, sgn * (120 - k * 56), 52, 26, 'steel', 4));
  const c = paint(W, H, [rect(0, 0, 60, 150, 'flesh', 3), ...s], opts(bottom ? 321 : 323));
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, W, H);
  // Teeth along the closing edge.
  for (let i = 0; i < W; i++) {
    const tx = (i % 15) / 15;
    const len = 18 * (1 - Math.abs(tx - 0.5) * 2);
    for (let e = 0; e < len; e++) {
      const j = bottom ? e : H - 1 - e;
      put(img.data, W, i, j, rampDither(BONE, 0.3 + 0.6 * (1 - e / 18) * (tx < 0.5 ? 1 : 0.6), i, j));
    }
  }
  // Glowing veins crawling over the plates.
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const v = ridged2p(i * 4, j, 480, 6, 3, bottom ? 331 : 333);
    if (v > 0.988) put(img.data, W, i, j, rampDither(GLOW, 0.45, i, j));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Jaw-door frame (160x600): two columns of bone and steel, veined, with the opening clear. */
export function drawJawFrame(): HTMLCanvasElement {
  const s: Shape[] = [];
  for (const sx of [-1, 1]) {
    s.push(rect(sx * 70, 0, 10, 300, 'steel', 4));
    for (let k = -5; k <= 5; k++) s.push(ellipse(sx * 70, k * 52, 12, 7, 'bone', 4));
    s.push(rect(sx * 70, 0, 2, 280, 'glow', 1));
  }
  return paint(160, 600, s, opts(341));
}

// ---------------------------------------------------------------------------
// Mother Brain
// ---------------------------------------------------------------------------

export const BRAIN_W = 220;
export const BRAIN_H = 190;
/** Brain-eye centre relative to the sprite centre (world units, y up). */
export const BRAIN_EYE = { x: -48, y: -52 };

/**
 * The Mother Brain: an enormous exposed brain, wet and folded, held in a
 * broken steel cranial cage, a spinal column running off to the right into
 * the factory, and one great eye beneath it. `rage` swells the veins and
 * reddens it for the last phase.
 */
export function drawMotherBrain(rage = false): HTMLCanvasElement {
  const W = BRAIN_W, H = BRAIN_H;
  // Cage, spine and the eye socket via the painter (behind the brain).
  const cage: Shape[] = [
    ellipse(70, -10, 40, 16, 'bone', 6),                    // spinal column root
    ...Array.from({ length: 6 }, (_, k) => ellipse(56 + k * 10, -10, 4, 15, 'bone', 3)),
    rect(80, -10, 30, 5, 'flesh', 2),
    ellipse(-48, -52, 30, 26, 'flesh', 9),                 // eye socket flesh
    ellipse(-48, -52, 20, 19, 'eye', 7),
    rect(10, -64, 70, 6, 'steel', 3),                       // cage bands
    rect(-10, 70, 60, 6, 'steel', 3),
    rect(-58, 30, 6, 40, 'steel', 3),
    rect(56, 40, 6, 46, 'steel', 3),
  ];
  const base = paint(W, H, cage, opts(rage ? 351 : 353));
  const ctx = base.getContext('2d')!;
  const img = ctx.getImageData(0, 0, W, H);
  const L: V3 = [-0.45, 0.55, 0.7];
  const ln = Math.hypot(...L);
  const Ln: V3 = [L[0] / ln, L[1] / ln, L[2] / ln];
  const Hh: V3 = (() => { const v: V3 = [Ln[0], Ln[1], Ln[2] + 1]; const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; })();
  const pink: RGB[] = rage
    ? ['#1a0206', '#3e0610', '#6a0e1c', '#96202a', '#c03a3a', '#e06656', '#f6a08a', '#ffd8c8'].map(hex)
    : ['#1c060c', '#40101c', '#6a1e30', '#954058', '#b86476', '#d6909a', '#eebcc0', '#ffe4e4'].map(hex);
  // Brain: an ellipsoid (two hemispheres) with sulci from ridged noise.
  const cx = W / 2 + 6, cy = H / 2 + 14, rx = 92, ry = 66;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5 - cx) / rx, y = -(j + 0.5 - cy) / ry;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      // Leave the eye socket (below-left) uncovered.
      if (Math.hypot(i + 0.5 - (W / 2 + BRAIN_EYE.x), j + 0.5 - (H / 2 - BRAIN_EYE.y)) < 31) continue;
      const z = Math.sqrt(1 - r2);
      const P: V3 = [x, y, z];
      // Folds: ridged noise on the surface -> grooves; plus the central fissure.
      const fold = 1 - Math.abs(2 * fbm3(P[0] * 3.2 + 9, P[1] * 3.2, P[2] * 3.2, 4, rage ? 61 : 62) - 1);
      const fissure = Math.exp(-(((x - 0.05 * y) / 0.035) ** 2));
      const groove = Math.max(clamp01((fold - 0.82) / 0.12), fissure);
      // Bumped normal from the fold field.
      const e = 0.02;
      const f = (a: number, b: number) => 1 - Math.abs(2 * fbm3(a * 3.2 + 9, b * 3.2, Math.sqrt(Math.max(0, 1 - a * a - b * b)) * 3.2, 4, rage ? 61 : 62) - 1);
      const gx = (f(x + e, y) - f(x - e, y)) / (2 * e), gy = (f(x, y + e) - f(x, y - e)) / (2 * e);
      let n: V3 = [x + gx * 0.18, y + gy * 0.18, z];
      const nl = Math.hypot(...n); n = [n[0] / nl, n[1] / nl, n[2] / nl];
      const diff = clamp01(n[0] * Ln[0] + n[1] * Ln[1] + n[2] * Ln[2]);
      const spec = Math.pow(clamp01(n[0] * Hh[0] + n[1] * Hh[1] + n[2] * Hh[2]), 40);
      let v = (0.12 + 0.8 * Math.pow(diff, 1.2)) * (1 - groove * 0.75);
      let col = rampDither(pink, v, i, j);
      if (spec > 0.6 && groove < 0.3) col = pink[7];
      // Veins over the surface: dark red; glowing green where it's being "wired".
      const vein = 1 - Math.abs(2 * fbm3(P[0] * 2 + 30, P[1] * 2, P[2] * 2, 3, 63) - 1);
      if (vein > (rage ? 0.93 : 0.955)) col = mix(col, hex(rage ? '#ff2a2a' : '#5a0812'), 0.7);
      // Rim darkening.
      if (r2 > 0.93) col = pink[0];
      put(img.data, W, i, j, col);
    }
  }
  // Cables plugged into the brain (steel jacks with glow).
  for (const [jx, jy] of [[cx - 40, cy - 50], [cx + 10, cy - 62], [cx + 55, cy - 40], [cx - 70, cy - 10]]) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const r = Math.hypot(dx, dy);
      if (r <= 3.2) put(img.data, W, Math.round(jx + dx), Math.round(jy + dy), r < 1.5 ? GLOW[4] : hex('#5d6778'));
    }
  }
  ctx.putImageData(img, 0, 0);
  // The great eye under the brain, looking left.
  return eye(base, W / 2 + BRAIN_EYE.x, H / 2 - BRAIN_EYE.y, 18, -1, 0.1,
    (rage ? ['#3a0404', '#7a0a0a', '#c41616', '#ff4a3a', '#ffb0a0'] : ['#0a2010', '#16501f', '#2f8a3c', '#62c95e', '#b4f59a']).map(hex));
}

/** Eye stalk (30x30): an eyeball on a stub of muscle, iris toward +x (it turns to watch you). */
export function drawEyeStalk(): HTMLCanvasElement {
  const s: Shape[] = [ellipse(-9, 0, 7, 5, 'flesh', 3), circle(2, 0, 10, 'eye', 5)];
  return eye(paint(30, 30, s, opts(361)), 15 + 2, 15, 9, 1, 0, ['#3a0404', '#7a0a0a', '#c41616', '#ff4a3a', '#ffb0a0'].map(hex));
}

/** Lightning column (40x512): a jagged green-white bolt on a soft glow (additive). */
export function drawLightning(seed = 1): HTMLCanvasElement {
  const W = 40, H = 512;
  const { canvas, ctx, img } = newCanvas(W, H);
  let x = W / 2;
  const path: number[] = [];
  for (let j = 0; j < H; j++) {
    if (j % 6 === 0) x = W / 2 + (fbm3(j * 0.05, seed, 0, 3, 77) - 0.5) * 26 + (Math.sin(j * 0.9 + seed) * 2);
    path.push(x);
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const d = Math.abs(i + 0.5 - path[j]);
      let a = 0, c: RGB = hex('#62c95e');
      if (d < 1.5) { a = 255; c = hex('#f0fff0'); }
      else if (d < 3.5) { a = 230; c = hex('#b4f59a'); }
      else if (d < 14) { const q = Math.floor((1 - d / 14) ** 2 * 5 + bayer(i, j)) / 5; a = Math.round(q * 150); }
      if (a > 0) put(img.data, W, i, j, c, a);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

void FLESH;

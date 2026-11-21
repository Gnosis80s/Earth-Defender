/**
 * Stage 4 (lunar surface) props: the factory hatch set into the regolith,
 * the ground missile launchers, and the Void Leviathan, a bio-mechanical
 * worm that guards the way into the Moon.
 *
 * Sun from the upper left, matching the lunar terrain. Uses the shared
 * shape painter from Stage3Art.
 */
import { paint, rect, circle, ellipse, Shape } from './Stage3Art';
import { clamp01, fbm3, bayer, RGB, hex, mix, rampDither, newCanvas, put } from './PixelArt';

/** Stage 4's sun: low, upper-left (matches the lunar terrain in Stage4Art). */
const SUN4: [number, number, number] = [-0.7, 0.45, 0.45];

// ---------------------------------------------------------------------------
// The Void Leviathan
// ---------------------------------------------------------------------------

export const WORM_HEAD = { w: 76, h: 60 };
export const WORM_SEG = 46;
export const WORM_TAIL = 36;

/** Head, facing +x: armoured skull, split mandibles, glowing eyes and maw. */
export function drawWormHead(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(-24, 0, 13, 21, 'steel', 4),            // neck collar
    ellipse(-28, 0, 6, 17, 'dark', 2),
    ellipse(-6, 15, 7, 9, 'chitin', 4),             // dorsal spines
    ellipse(-16, 17, 6, 8, 'chitin', 4),
    ellipse(-6, -15, 7, 9, 'chitin', 4),
    ellipse(-16, -17, 6, 8, 'chitin', 4),
    ellipse(2, 0, 27, 20, 'chitin', 7),             // skull
    ellipse(-2, 9, 18, 6, 'chitin', 3),             // brow plates
    ellipse(-2, -9, 18, 6, 'chitin', 3),
    ellipse(25, 8, 12, 5, 'steel', 3),              // mandibles
    ellipse(25, -8, 12, 5, 'steel', 3),
    ellipse(29, 0, 8, 3.2, 'glow', 2),              // maw
    circle(11, 9, 3.6, 'glow', 2),                  // eyes
    circle(11, -9, 3.6, 'glow', 2),
  ];
  return paint(WORM_HEAD.w, WORM_HEAD.h, s, { seed: 71, sun: SUN4 });
}

/** Body segment: carapace ring with a steel band, side spikes and vents. */
export function drawWormSegment(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(0, 20, 4.5, 6, 'steel', 2),
    ellipse(0, -20, 4.5, 6, 'steel', 2),
    circle(0, 0, 18.5, 'chitin', 8),
    rect(3, 0, 3.5, 18, 'steel', 2),
    circle(-8, 8, 2.4, 'glow', 1),
    circle(-8, -8, 2.4, 'glow', 1),
  ];
  return paint(WORM_SEG, WORM_SEG, s, { seed: 73, sun: SUN4 });
}

/** Tail: a tapering carapace with a steel stinger trailing (-x). */
export function drawWormTail(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(-10, 0, 9, 3.5, 'steel', 2),
    ellipse(3, 0, 13, 11, 'chitin', 5),
    rect(8, 0, 2.5, 10, 'steel', 1),
  ];
  return paint(WORM_TAIL, WORM_TAIL, s, { seed: 75, sun: SUN4 });
}

// ---------------------------------------------------------------------------
// Ground missile launcher
// ---------------------------------------------------------------------------

/** Launcher base (52x52, pivot at centre): a half-buried bunker dome. */
export function drawLauncherBase(): HTMLCanvasElement {
  const s: Shape[] = [
    ellipse(0, -21, 25, 6, 'regolith', 3),
    ellipse(0, -10, 21, 13, 'steel', 6),
    rect(0, -10, 11, 1.6, 'glow', 1),
    ellipse(-15, -16, 6, 4, 'chitin', 3),
    ellipse(14, -18, 5, 3.5, 'chitin', 3),
    circle(0, 0, 8, 'dark', 2),
  ];
  return paint(52, 52, s, { seed: 81, sun: SUN4 });
}

/** Launcher pod (52x52, pivot at centre), pointing +x: twin tubes with live rockets. */
export function drawLauncherPod(): HTMLCanvasElement {
  const s: Shape[] = [
    rect(12, 5, 13, 3.6, 'steel', 2),
    rect(12, -5, 13, 3.6, 'steel', 2),
    circle(0, 0, 9, 'chitin', 5),
    circle(-2, 0, 3, 'glow', 1),
  ];
  const c = paint(52, 52, s, { seed: 83, sun: SUN4 });
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, 52, 52);
  // Red rocket tips peeking out of the tubes.
  for (const ty of [26 - 5, 26 + 5]) {
    for (let dy = -1; dy <= 1; dy++) {
      put(img.data, 52, 26 + 25, ty + dy, hex(dy === -1 ? '#ff8a7a' : '#c4161f'));
      put(img.data, 52, 26 + 24, ty + dy, hex('#7a0a12'));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// The factory hatch (BlastDoor 'horizontal')
// ---------------------------------------------------------------------------

/** Hatch rim (360x80): regolith berms, armoured posts with glow slits, a sill. Opening left clear. */
export function drawHatchFrame(): HTMLCanvasElement {
  const s: Shape[] = [];
  for (const sx of [-1, 1]) {
    s.push(ellipse(sx * 174, -16, 28, 30, 'regolith', 8));
    s.push(rect(sx * 157, 2, 9, 35, 'steel', 3));
    s.push(rect(sx * 157, 4, 1.8, 24, 'glow', 1));
    s.push(ellipse(sx * 166, 28, 13, 8, 'chitin', 4));
    s.push(ellipse(sx * 148, -30, 11, 6, 'chitin', 3));
  }
  s.push(rect(0, -36, 168, 4, 'steel', 2));
  return paint(360, 80, s, { seed: 91, sun: SUN4 });
}

/**
 * One hatch leaf (150x60), the left one; the right is a mirror. Heavy
 * plate with a hazard-striped seam, alien growth creeping over it and a
 * green glow leaking from the seam (the factory beneath).
 */
export function drawHatchPanel(): HTMLCanvasElement {
  const s: Shape[] = [
    rect(0, 0, 75, 30, 'steel', 5),
    rect(-38, 0, 1.5, 26, 'dark', 1),
    rect(10, 0, 1.5, 26, 'dark', 1),
    ellipse(-50, 18, 16, 8, 'chitin', 4),
    ellipse(-28, -22, 20, 7, 'chitin', 4),
    ellipse(-60, -12, 9, 10, 'chitin', 4),
  ];
  const c = paint(150, 60, s, { seed: 93, sun: SUN4 });
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, 150, 60);
  for (let j = 2; j < 58; j++) {
    for (let i = 128; i < 149; i++) {
      // Hazard chevrons along the seam edge, glow leaking at the very edge.
      if (i >= 146) { put(img.data, 150, i, j, rampDither(['#0d3a1a', '#1f8a3a', '#7ae07a'].map(hex), 0.4 + 0.6 * bayer(i, j), i, j)); continue; }
      if (Math.floor((i + j) / 5) % 2 === 0) {
        const o = (j * 150 + i) * 4;
        const lum = (img.data[o] + img.data[o + 1] + img.data[o + 2]) / 765;
        put(img.data, 150, i, j, mix(hex('#3a2606'), hex('#e0a92a'), clamp01(lum * 1.6)));
      }
    }
  }
  // Rivets
  for (let k = 0; k < 6; k++) {
    for (const y of [5, 54]) put(img.data, 150, 12 + k * 22, y, hex('#a6b0c2'));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * The shaft below the hatch (300x160; row 0 is just under the doors):
 * ribbed organic walls dropping away to the factory's green glow.
 */
export function drawHatchShaft(): HTMLCanvasElement {
  const W = 300, H = 160;
  const { canvas, ctx, img } = newCanvas(W, H);
  const wall: RGB[] = ['#040508', '#0a0a12', '#120f1e', '#1c1530', '#2a1f44'].map(hex);
  const glow: RGB[] = ['#08140c', '#0f2e18', '#1a5a2a', '#2f8f42', '#6fd46f', '#c8ffbe'].map(hex);
  for (let j = 0; j < H; j++) {
    const depth = j / (H - 1);
    for (let i = 0; i < W; i++) {
      const x = (i - W / 2) / (W / 2);
      // Walls converge with depth (perspective); ribs every few rows.
      const half = 1 - depth * 0.45;
      if (Math.abs(x) > half) {
        const rib = Math.sin(j * 0.55 + fbm3(i * 0.05, j * 0.05, 1, 2, 3) * 4) * 0.5 + 0.5;
        const side = x < 0 ? 0.55 : 0.3; // left wall catches a little light
        put(img.data, W, i, j, rampDither(wall, side * (0.4 + 0.6 * rib) * (1 - depth * 0.4), i, j));
        continue;
      }
      const centre = 1 - Math.abs(x) / half;
      const v = Math.pow(depth, 1.6) * (0.55 + 0.45 * centre) + fbm3(i * 0.04, j * 0.04, 5, 3, 7) * 0.12 * depth;
      put(img.data, W, i, j, rampDither(glow, v, i, j));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Round status lamp (12x12, white; tinted red/green by the material). */
export function drawLamp(): HTMLCanvasElement {
  const S = 12;
  const { canvas, ctx, img } = newCanvas(S, S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const r = Math.hypot(i + 0.5 - S / 2, j + 0.5 - S / 2);
      if (r > 5.5) continue;
      const c: RGB = r > 4.6 ? [30, 30, 36] : r < 1.6 ? [255, 255, 255] : [200, 200, 200];
      put(img.data, S, i, j, c);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

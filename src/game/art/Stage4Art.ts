/**
 * Procedural art for Stage 4 (lunar surface): the Earth hanging in the sky
 * and two parallax layers of lunar terrain.
 *
 * Everything is rendered pixel-by-pixel into ImageData so lighting is
 * physically consistent: one low sun from the upper-left lights the Earth,
 * the mountains and the craters alike. Shading is quantised into a small
 * palette with 4x4 Bayer dithering to match the game's 16-bit pixel style.
 *
 * Landscape layers are 800x400 (1 texel per world unit, matching sprites)
 * and tile seamlessly horizontally: all noise is periodic in x and craters
 * wrap around the edges.
 */

import {
  hash, smooth, lerp, clamp01, fbm3, fbm2p, ridged2p, bayer, RGB, hex, mix, scale, rampDither, newCanvas, put,
} from './PixelArt';

// ---------------------------------------------------------------------------
// Earth
// ---------------------------------------------------------------------------

/**
 * The Earth as seen from the Moon: a lit sphere with continents, ice caps,
 * clouds, a day/night terminator with city lights, ocean sun-glint and an
 * atmospheric rim. `size` is the texture (and on-screen) size in texels.
 */
export function drawEarth(size = 192, opts: { yaw?: number; seaLevel?: number } = {}): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(size, size);
  const d = img.data;
  const c = size / 2;
  const R = size / 2 - 9; // leave room for the atmospheric halo

  // Sun: upper-left and toward the viewer -> a gibbous Earth with a night crescent on the right.
  const L = normalize3([-0.62, 0.38, 0.69]);
  const H = normalize3([L[0], L[1], L[2] + 1]); // Blinn half-vector (viewer at +z)

  const tilt = 0.41; // axial tilt, radians
  const yaw = opts.yaw ?? 3.3; // which longitude faces us (chosen for a good land/ocean mix)
  const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);

  const deepOcean = hex('#0b1f4d'), midOcean = hex('#123a7a'), shallow = hex('#1d6fa8'), reef = hex('#2bb3c9');
  const forest = hex('#1f5f2b'), grass = hex('#4b8a32'), savanna = hex('#a39a4a'), desert = hex('#d2a65a');
  const rock = hex('#7a6248'), snow = hex('#f1f5f9'), ice = hex('#e6f0f7');
  const cloud = hex('#f8fafc'), night = hex('#050a18'), cityGold = hex('#ffd66b');
  const atmo = hex('#7cc4ff'), dusk = hex('#ff9a4d');

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5 - c) / R;
      const y = -(j + 0.5 - c) / R;
      const r2 = x * x + y * y;

      if (r2 > 1) {
        // Atmospheric halo outside the disc, brighter on the sunlit side.
        const r = Math.sqrt(r2);
        const t = (r - 1) * R; // texels outside the limb
        if (t < 8) {
          const sunSide = clamp01(0.35 + 0.9 * ((x / r) * L[0] + (y / r) * L[1]));
          const a = Math.pow(1 - t / 8, 2.2) * sunSide;
          const q = Math.floor(a * 4 + bayer(i, j) - 0.25) / 4; // pixel-art alpha steps
          if (q > 0) put(d, size, i, j, atmo, Math.round(q * 200));
        }
        continue;
      }

      const z = Math.sqrt(1 - r2);
      // Rotate the view-space normal into planet space (tilt about z, then spin about y).
      const tx = x * ct + y * st, ty = -x * st + y * ct, tz = z;
      const px = tx * cy + tz * sy, py = ty, pz = -tx * sy + tz * cy;
      const lat = Math.asin(py);

      // Continents: domain-warped fBm on the sphere (no seams, no pole pinching).
      const wx = fbm3(px * 2.1 + 11, py * 2.1, pz * 2.1, 3, 7) - 0.5;
      const wy = fbm3(px * 2.1, py * 2.1 + 23, pz * 2.1, 3, 9) - 0.5;
      const e = fbm3(px * 1.7 + wx * 0.9, py * 1.7 + wy * 0.9, pz * 1.7, 6, 1);
      const sea = opts.seaLevel ?? 0.53;
      const isLand = e > sea;
      const moist = fbm3(px * 3.1 + 40, py * 3.1, pz * 3.1, 4, 3);

      let col: RGB;
      if (isLand) {
        const alt = (e - sea) / (1 - sea);
        const absLat = Math.abs(lat);
        if (alt > 0.42) col = snow;
        else if (alt > 0.28) col = rock;
        else if (absLat > 0.18 && absLat < 0.62 && moist < 0.47) col = moist < 0.42 ? desert : savanna;
        else col = moist > 0.55 ? forest : grass;
      } else {
        const depth = (sea - e) / sea;
        col = depth < 0.025 ? reef : depth < 0.07 ? shallow : depth < 0.16 ? midOcean : deepOcean;
      }

      // Polar ice with a ragged edge.
      const iceEdge = 1.12 - 0.18 * fbm3(px * 6, py * 6, pz * 6, 3, 5);
      if (Math.abs(lat) > iceEdge) col = ice;

      // Clouds: banded and swirled, stretched along latitude.
      const cw = fbm3(px * 2.5 + 5, py * 2.5, pz * 2.5, 3, 13) - 0.5;
      const cl = fbm3(px * 3.4 + cw * 1.6, py * 6.5 + cw * 1.2, pz * 3.4, 5, 21);
      const cloudA = clamp01((cl - 0.53) / 0.12);
      const cloudy = cloudA > bayer(i, j) * 0.9 + 0.05;

      // Lighting
      const ndl = x * L[0] + y * L[1] + z * L[2];
      const day = clamp01(ndl);
      const bands = 6;
      const lit = Math.floor((0.1 + 0.9 * Math.pow(day, 0.75)) * bands + bayer(i, j)) / bands;

      let out: RGB = scale(cloudy ? cloud : col, Math.min(1, lit + 0.05));

      // Warm terminator band.
      if (ndl > -0.08 && ndl < 0.16) {
        out = mix(out, dusk, 0.22 * (1 - Math.abs(ndl - 0.04) / 0.12));
      }

      // Night side: near-black with city lights on habitable land.
      if (ndl < 0) {
        out = mix(out, night, clamp01(-ndl * 6));
        if (isLand && !cloudy && col !== ice && col !== desert && col !== snow && ndl < -0.04) {
          const city = hash(Math.floor(px * 70), Math.floor(py * 70), Math.floor(pz * 70), 99);
          if (city > 0.86 + (1 - moist) * 0.08) out = city > 0.95 ? cityGold : mix(night, cityGold, 0.55);
        }
      }

      // Sun-glint on open ocean.
      if (!isLand && !cloudy && ndl > 0) {
        const spec = Math.pow(clamp01(x * H[0] + y * H[1] + z * H[2]), 120);
        if (spec > 0.2 + bayer(i, j) * 0.7) out = mix(out, [220, 236, 255], 0.45 * spec + 0.15);
      }

      // Atmosphere thickens toward the limb (Fresnel), mostly on the day side.
      const rim = Math.pow(1 - z, 2.4);
      out = mix(out, atmo, clamp01(rim * 0.85 * (0.2 + day)));

      put(d, size, i, j, out);
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------------
// Lunar landscape layers (800x400, texture row 0 = world y +70)
// ---------------------------------------------------------------------------

export const LUNAR_W = 800;
export const LUNAR_H = 400;

/** Sun for the landscape: low in the sky, from the left. tan(elevation) for shadow casting. */
const SUN_TAN = 0.32;

/** Grey-brown regolith ramp, shadow to highlight. */
const NEAR_RAMP: RGB[] = ['#06080c', '#11151c', '#1d222b', '#2c323c', '#3f4651', '#565d68', '#717884', '#8f96a1', '#b2b8c0', '#d6dade', '#f1f3f5'].map(hex);
/** Distant highlands: cooler, lower contrast. */
const FAR_RAMP: RGB[] = ['#0a0d14', '#111622', '#18202f', '#212b3d', '#2c384d', '#38465e', '#475672', '#596986', '#6d7e9b'].map(hex);

/**
 * Shade a side-on mountain range given its top row per column.
 *
 * The rock face is treated as a 2D bump map (ridged noise, stretched so
 * gullies run downhill) lit by the low sun from the upper-left, so faces
 * pick up facets in both directions instead of vertical "curtains". The
 * silhouette's own slope only affects the area near the crest, which gets a
 * rim highlight; columns behind taller peaks to the left fall into shadow.
 */
function shadeRange(
  d: Uint8ClampedArray, top: Float32Array, bottomRow: number, ramp: RGB[],
  base: number, contrast: number, texSeed: number, featureCells = 34,
) {
  const W = LUNAR_W;
  // Cast shadows from the left: walk two periods so the wrap is seamless.
  const shadowLine = new Float32Array(W);
  let s = -Infinity; // highest shadow height so far (height = -row)
  for (let k = 0; k < W * 2; k++) {
    const x = k % W;
    s = Math.max(s - SUN_TAN, -top[x]);
    if (k >= W) shadowLine[x] = s;
  }

  // Light in (x right, y down, z toward viewer) space: from the left, a little above, mostly grazing.
  const Lx = -0.78, Ly = -0.32, Lz = 0.54;
  // Bump height grid, computed once (one noise sample per texel).
  let minTop = bottomRow;
  for (let x = 0; x < W; x++) minTop = Math.min(minTop, Math.max(0, Math.round(top[x])));
  const r0 = Math.max(0, minTop - 1);
  const rows = bottomRow - r0;
  const bump = new Float32Array(W * rows);
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < W; x++) bump[r * W + x] = ridged2p(x, (r + r0) * 0.55, W, featureCells, 4, texSeed);
  }
  const bumpH = (x: number, row: number) => bump[(row - r0) * W + x];

  for (let x = 0; x < W; x++) {
    const t = Math.round(top[x]);
    const slope = (top[(x + W - 2) % W] - top[(x + 2) % W]) / 4; // >0 where the ridge rises to the right (faces the sun)
    const inShadow = -top[x] < shadowLine[x] - 0.5;
    for (let row = Math.max(0, t); row < bottomRow; row++) {
      const depth = row - t;
      const crest = Math.exp(-depth / 14);

      // Bump-mapped facet lighting.
      const h = bumpH(x, row);
      const dhx = (h - bumpH((x + W - 1) % W, row)) * 9;
      const dhy = (h - bumpH(x, row - 1)) * 9;
      const nl = (-dhx * Lx - dhy * Ly + Lz) / Math.hypot(dhx, dhy, 1);

      let v = base + (nl - 0.45) * 0.75 + slope * contrast * crest - Math.min(depth / 160, 0.3);
      if (depth < 2 && slope > -0.15) v += 0.3; // sunlit crest line
      // Crest hidden behind a taller peak to the left: in cast shadow,
      // fading out further down the face where it's lit side-on again.
      if (inShadow) v *= 0.55 + 0.45 * clamp01(depth / 90);
      put(d, W, x, row, rampDither(ramp, v, x, row));
    }
  }
}

/** Far layer: rounded lunar highlands on the horizon (parallax ~0.3). */
export function drawLunarFar(): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(LUNAR_W, LUNAR_H);
  const top = new Float32Array(LUNAR_W);
  for (let x = 0; x < LUNAR_W; x++) {
    // Broad massifs with gentle secondary peaks (lunar mountains are eroded, rounded domes).
    const broad = fbm2p(x, 0, LUNAR_W, 3, 2, 301);
    const detail = fbm2p(x, 50, LUNAR_W, 12, 3, 307);
    // Contrast-boosted so massifs stand apart from low saddles between them.
    top[x] = 250 - Math.pow(broad, 1.7) * 230 - detail * 28; // peaks up to ~row 80 (world y ≈ -10)
  }
  shadeRange(img.data, top, LUNAR_H, FAR_RAMP, 0.46, 1.2, 311, 26);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

interface Crater { cx: number; cy: number; rx: number; ry: number; }

/**
 * Near layer: foothills on the horizon and the cratered regolith plain the
 * player flies over (parallax ~0.6). The plain's horizon sits at world
 * y ≈ -192 so turrets (y = -230) and the floor blast door (y = -210) sit on it.
 */
export function drawLunarNear(): HTMLCanvasElement {
  const W = LUNAR_W, Hh = LUNAR_H;
  const { canvas, ctx, img } = newCanvas(W, Hh);
  const d = img.data;
  const horizon = 262; // texture row of the plain's far edge

  // 1. Foothills: a ragged nearer ridge that meets the plain.
  const top = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const n = fbm2p(x, 400, W, 9, 4, 401);
    // Mostly low rubble, rising into a few distinct hills.
    const hill = clamp01((fbm2p(x, 900, W, 5, 2, 409) - 0.42) / 0.3);
    top[x] = horizon - 6 - n * 22 - smooth(hill) * 70;
  }
  shadeRange(d, top, horizon, NEAR_RAMP, 0.44, 1.6, 419, 40);

  // 2. Craters on the plain, sized and flattened by perspective.
  const craters: Crater[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 60; k++) {
    const t = Math.pow(rnd(), 0.8);                 // 0 = horizon, 1 = bottom
    const cy = horizon + 4 + t * (Hh - horizon - 4);
    const persp = 0.35 + t * 0.9;                   // nearer = bigger
    const rx = (5 + rnd() * rnd() * 46) * persp;
    craters.push({ cx: rnd() * W, cy, rx, ry: rx * (0.22 + t * 0.16) });
  }
  // Draw far craters first so near ones overlap them.
  craters.sort((a, b) => a.cy - b.cy);

  // Base regolith brightness for every plain texel.
  const plainH = Hh - horizon;
  const val = new Float32Array(W * plainH);
  for (let row = horizon; row < Hh; row++) {
    const t = (row - horizon) / plainH;
    const sx = 1 / (0.25 + t); // perspective: grain stretches out toward the viewer
    for (let x = 0; x < W; x++) {
      const grain = fbm2p(x * sx * 0.6, row * 2.2, W * sx * 0.6, 24, 4, 433) - 0.5;
      const pebble = hash(x, row, 7, 439) > 0.985 ? 0.25 : 0;
      val[(row - horizon) * W + x] = 0.5 - t * 0.12 + grain * 0.3 + pebble;
    }
  }

  // Craters, far to near, each only over its own bounding box (wrapping in x).
  for (const cr of craters) {
    const ext = Math.sqrt(2.2);
    const y0 = Math.max(horizon, Math.floor(cr.cy - cr.ry * ext));
    const y1 = Math.min(Hh - 1, Math.ceil(cr.cy + cr.ry * ext));
    const x0 = Math.floor(cr.cx - cr.rx * ext), x1 = Math.ceil(cr.cx + cr.rx * ext);
    for (let row = y0; row <= y1; row++) {
      const w = (row - cr.cy) / cr.ry;
      for (let xx = x0; xx <= x1; xx++) {
        const u = (xx - cr.cx) / cr.rx;
        const dd = u * u + w * w;
        if (dd > 2.2) continue;
        const k = (row - horizon) * W + ((xx % W) + W) % W;
        const dist = Math.sqrt(dd);
        if (dist < 0.8) {
          // Bowl: the left inner wall faces away from the low left sun -> deep shadow.
          const shadowEdge = -0.15 + 0.55 * (dist / 0.8);
          val[k] = u < -shadowEdge * Math.sqrt(Math.max(0, 1 - (w / 0.8) ** 2)) ? 0.08 : 0.38 + u * 0.35;
        } else if (dist < 1.0) {
          val[k] = u < 0.2 ? 0.92 : 0.6; // raised rim, sunlit on the left crest
        } else if (u > 0.3 && Math.abs(w) < 0.9) {
          val[k] *= 0.55;                // rim casts a short shadow to the right
        } else if (dist < 1.25) {
          val[k] += 0.08;                // bright ejecta apron
        }
      }
    }
  }

  for (let row = horizon; row < Hh; row++) {
    for (let x = 0; x < W; x++) {
      put(d, W, x, row, rampDither(NEAR_RAMP, val[(row - horizon) * W + x], x, row));
    }
  }

  // 3. Boulders: lit on the left, shadow trailing right. Nearer = larger.
  for (let k = 0; k < 70; k++) {
    const t = rnd();
    const by = Math.floor(horizon + 6 + t * (Hh - horizon - 10));
    const bx = Math.floor(rnd() * W);
    const sz = 1 + Math.floor(t * 4 * rnd());
    for (let yy = -sz; yy <= 0; yy++) {
      for (let xx = -sz; xx <= sz * 3; xx++) {
        const x = (bx + xx + W) % W, y = by + yy;
        if (y < horizon || y >= Hh) continue;
        if (xx <= sz && xx * xx + yy * yy * 2 <= sz * sz + 1) {
          put(d, W, x, y, NEAR_RAMP[xx < 0 ? 9 : 5]);
        } else if (xx > 0 && yy === 0) {
          put(d, W, x, y, NEAR_RAMP[1]); // cast shadow on the ground
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

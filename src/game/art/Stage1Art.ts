/**
 * Procedural art for Stage 1 (Earth City, night).
 *
 * Lighting: a full moon at the upper-right is the key light (cool rim
 * highlights on right-facing edges); the city below casts a warm sodium/violet
 * glow into the haze near the horizon. Layers, back to front:
 *
 *   sky (camera-anchored gradient)  ->  thin clouds (0.06x)  ->  mountains (0.1x)
 *   ->  far skyline (0.25x)  ->  searchlights  ->  near skyline (0.5x)
 *
 * Tile layers are 800x400, 1 texel per world unit, transparent skies, and
 * wrap seamlessly in x. Texture row 0 = world y +100 (planes sit at y = -100).
 *
 * Window lights are deliberately small and dim: nothing in the background
 * may compete with enemy bullets for attention.
 */
import {
  hash, smooth, lerp, clamp01, fbm2p, ridged2p, bayer, RGB, hex, mix, rampDither, newCanvas, put,
} from './PixelArt';

export const CITY_W = 800;
export const CITY_H = 400;

/** Haze colour the far layers fade into near the horizon (city glow). */
const HAZE: RGB = hex('#2a1f4a');
const GLOW: RGB = hex('#5a3350');
const AMBER: RGB = hex('#8a4b3a');

/** Seeded PRNG so every run draws the same city. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Dithered channel quantisation: removes gradient banding while keeping a pixel-art feel. */
function ditherRGB(c: RGB, x: number, y: number, step = 6): RGB {
  const b = bayer(x, y) - 0.5;
  return [
    Math.round(c[0] / step + b) * step,
    Math.round(c[1] / step + b) * step,
    Math.round(c[2] / step + b) * step,
  ];
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

/** 800x600 night-sky gradient, anchored to the camera (no parallax). */
export function drawNightSky(): HTMLCanvasElement {
  const W = 800, H = 600;
  const { canvas, ctx, img } = newCanvas(W, H);
  const stops: [number, RGB][] = [
    [0.0, hex('#02030a')],
    [0.4, hex('#060a1d')],
    [0.62, hex('#0d1233')],
    [0.78, hex('#1b1a45')],
    [0.9, HAZE],
    [0.97, GLOW],
    [1.0, AMBER],
  ];
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
    const c = mix(c0, c1, smooth(clamp01((t - t0) / (t1 - t0))));
    for (let x = 0; x < W; x++) put(img.data, W, x, y, ditherRGB(c, x, y));
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Soft dithered halo for the moon (drawn additively behind it). */
export function drawMoonHalo(size = 160): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(size, size);
  const c = size / 2;
  const tint = hex('#9fb4e8');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (r >= 1) continue;
      const a = Math.pow(1 - r, 2.2);
      const q = Math.floor(a * 6 + bayer(x, y)) / 6; // stepped falloff
      if (q > 0) put(img.data, size, x, y, tint, Math.round(q * 120));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Thin moonlit cloud streaks (800x200 tile, transparent), drifting slowly. */
export function drawNightClouds(): HTMLCanvasElement {
  const W = 800, H = 200;
  const { canvas, ctx, img } = newCanvas(W, H);
  const body = hex('#161c3a'), lit = hex('#4a5786'), rim = hex('#7d8cc0');
  for (let y = 0; y < H; y++) {
    // Clouds concentrate in two loose bands.
    const band = Math.max(Math.exp(-(((y - 60) / 26) ** 2)), 0.8 * Math.exp(-(((y - 140) / 22) ** 2)));
    for (let x = 0; x < W; x++) {
      // Stretched horizontally: long wispy streaks.
      const n = fbm2p(x, y * 4.5, W, 5, 5, 701);
      const dens = clamp01((n - 0.52 - (1 - band) * 0.3) / 0.12);
      if (dens <= bayer(x, y) * 0.85) continue;
      // Moonlight from the upper-right: brighter on the top edge of each streak.
      const above = fbm2p(x + 3, (y - 3) * 4.5, W, 5, 5, 701);
      const edge = clamp01((n - above) * 9);
      const c = edge > 0.5 ? (edge > 0.85 ? rim : lit) : body;
      put(img.data, W, x, y, c, Math.round(150 + dens * 70));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Mountains
// ---------------------------------------------------------------------------

/** Distant moonlit mountain range fading into the city haze (0.1x parallax). */
export function drawNightMountains(): HTMLCanvasElement {
  const W = CITY_W, H = CITY_H;
  const { canvas, ctx, img } = newCanvas(W, H);
  const ramp: RGB[] = ['#070a16', '#0b1022', '#10162e', '#161e3c', '#1f294d', '#2c3862', '#3d4b7a'].map(hex);
  const top = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const broad = fbm2p(x, 0, W, 3, 2, 501);
    const peaks = ridged2p(x, 40, W, 9, 3, 509);
    top[x] = 245 - Math.pow(broad, 1.3) * 120 - peaks * 40; // ridges ~rows 85-245
  }
  for (let x = 0; x < W; x++) {
    const t = Math.round(top[x]);
    // Moon is upper-right: slopes that fall away to the right catch the light.
    const slope = (top[(x + 2) % W] - top[(x + W - 2) % W]) / 4;
    for (let y = Math.max(0, t); y < H; y++) {
      const depth = y - t;
      const crest = Math.exp(-depth / 10);
      const grain = ridged2p(x, y * 0.6, W, 30, 3, 517) - 0.5;
      let v = 0.32 + slope * 1.4 * crest + grain * 0.25;
      if (depth < 2 && slope > 0) v += 0.35; // moonlit ridge line
      let c = rampDither(ramp, v, x, y);
      // Aerial perspective: valleys sink into the warm city haze.
      const fog = clamp01((y - 200) / 160);
      c = mix(c, HAZE, fog * 0.85);
      put(img.data, W, x, y, ditherRGB(c, x, y, 4));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Skylines
// ---------------------------------------------------------------------------

/** Lay out building widths that exactly fill one tile so it wraps seamlessly. */
function layoutBuildings(rand: () => number, minW: number, maxW: number): { x: number; w: number }[] {
  const out: { x: number; w: number }[] = [];
  let x = 0;
  while (x < CITY_W) {
    let w = Math.floor(minW + rand() * (maxW - minW));
    if (CITY_W - (x + w) < minW) w = CITY_W - x; // last one absorbs the remainder
    out.push({ x, w });
    x += w + (rand() < 0.3 ? Math.floor(rand() * 4) : 0);
  }
  return out;
}

/** Write a pixel with horizontal wrap-around (for seamless tiles). */
function putW(d: Uint8ClampedArray, x: number, y: number, c: RGB, a = 255) {
  if (y < 0 || y >= CITY_H) return;
  put(d, CITY_W, ((x % CITY_W) + CITY_W) % CITY_W, y, c, a);
}

/** Dense distant skyline: silhouettes, pinprick windows, red beacons (0.25x). */
export function drawCitySkylineFar(): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(CITY_W, CITY_H);
  const d = img.data;
  const rand = rng(1234);
  const warm = hex('#b98c4e'), cool = hex('#7d9cc4'), beacon = hex('#ff3b3b');

  for (const b of layoutBuildings(rand, 6, 26)) {
    const h = 30 + Math.floor(Math.pow(rand(), 1.8) * 110);
    const top = 330 - h;
    const base = mix(hex('#0a0d1c'), hex('#111530'), rand());
    for (let y = top; y < CITY_H; y++) {
      const fog = clamp01((y - 250) / 150);
      for (let x = b.x; x < b.x + b.w; x++) {
        let c = mix(base, HAZE, fog * 0.6);
        if (x === b.x + b.w - 1) c = mix(c, hex('#2a3460'), 0.6); // moonlit right edge
        // Pinprick windows on a 2px grid.
        if (y > top + 2 && (x - b.x) % 2 === 1 && (y - top) % 3 === 1 && x < b.x + b.w - 1) {
          const r = hash(x, y, 3, 1301);
          if (r > 0.82) c = mix(r > 0.93 ? cool : warm, c, 0.35 + fog * 0.4);
        }
        putW(d, x, y, ditherRGB(c, x, y, 4));
      }
    }
    // Occasional antenna mast with a red beacon.
    if (h > 90 && rand() < 0.5) {
      const mx = b.x + Math.floor(b.w / 2);
      const mh = 6 + Math.floor(rand() * 10);
      for (let y = top - mh; y < top; y++) putW(d, mx, y, hex('#1a2040'));
      putW(d, mx, top - mh - 1, beacon);
    }
  }

  // Street-level glow rising through the base of the skyline.
  for (let y = 300; y < CITY_H; y++) {
    const g = clamp01((y - 300) / 100);
    for (let x = 0; x < CITY_W; x++) {
      const o = (y * CITY_W + x) * 4;
      if (d[o + 3] === 0) continue;
      const c = mix([d[o], d[o + 1], d[o + 2]], AMBER, g * 0.55);
      put(d, CITY_W, x, y, ditherRGB(c, x, y, 4));
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

type Roof = 'flat' | 'setback' | 'stepped' | 'spire' | 'slant' | 'dome';

/** Detailed near skyline: varied towers, lit windows, rooftop props, neon (0.5x). */
export function drawCitySkylineNear(): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(CITY_W, CITY_H);
  const d = img.data;
  const rand = rng(98765);

  const facades: RGB[] = ['#121729', '#151b30', '#181e36', '#1b2033', '#141a2e'].map(hex);
  const rimLight = hex('#3c4a74'), rimBright = hex('#5d6fa6'), shadowEdge = hex('#090c17');
  const winOff = hex('#0d111f');
  const winWarm = hex('#e8b764'), winWarmDim = hex('#9c7541'), winCool = hex('#9fd0f2'), winTV = hex('#5fd6ff');
  const neonColors: RGB[] = ['#ff4fa3', '#3ff0ff', '#ffd23f', '#9b5cff'].map(hex);
  const beacon = hex('#ff3030');

  const buildings = layoutBuildings(rand, 30, 74);
  // Taller buildings drawn first so shorter ones in front overlap their bases.
  const specs = buildings.map((b) => {
    const tall = rand() < 0.22;
    // Heights kept below the middle of the screen so the skyline never crowds the action.
    const h = tall ? 95 + Math.floor(rand() * 35) : 40 + Math.floor(Math.pow(rand(), 1.4) * 70);
    const roofs: Roof[] = ['flat', 'setback', 'stepped', 'spire', 'slant', 'dome'];
    const roof = tall ? (rand() < 0.5 ? 'spire' : 'stepped') : roofs[Math.floor(rand() * roofs.length)];
    return { ...b, h, roof, facade: facades[Math.floor(rand() * facades.length)], lit: 0.1 + rand() * 0.22, cool: rand() < 0.35 };
  });

  for (const s of specs) {
    const top = 360 - s.h;
    // Silhouette profile per column: rows where the building starts.
    const colTop = (x: number): number => {
      const u = (x - s.x) / s.w; // 0..1 across
      switch (s.roof) {
        case 'setback': return u > 0.18 && u < 0.82 ? top - 14 : top;
        case 'stepped': {
          if (u > 0.3 && u < 0.7) return top - 30;
          if (u > 0.15 && u < 0.85) return top - 15;
          return top;
        }
        case 'slant': return top - Math.round((1 - u) * 14);
        case 'dome': {
          const v = (u - 0.5) * 2;
          return Math.abs(v) < 0.6 ? top - Math.round(Math.sqrt(1 - (v / 0.6) ** 2) * 10) : top;
        }
        default: return top;
      }
    };

    for (let x = s.x; x < s.x + s.w; x++) {
      const ct = colTop(x);
      const fromRight = s.x + s.w - 1 - x;
      for (let y = ct; y < CITY_H; y++) {
        let c: RGB = s.facade;
        // Moonlight: right edge lit, left edge in shade, faint vertical falloff.
        if (fromRight === 0) c = rimBright;
        else if (fromRight === 1) c = rimLight;
        else if (x === s.x) c = shadowEdge;
        else c = mix(c, hex('#0a0d18'), clamp01((y - ct) / 300) * 0.4);
        // Roof cap line catches the moon.
        if (y === ct && fromRight > 0) c = mix(c, rimLight, 0.7);

        // Windows: 2x3 panes on a 4x5 grid, lit in clustered floors.
        const wx = (x - s.x - 3) % 4, wy = (y - ct - 4) % 5;
        if (x > s.x + 2 && fromRight > 2 && y > ct + 4 && wx >= 0 && wx < 2 && wy >= 0 && wy < 3) {
          const floor = Math.floor((y - ct - 4) / 5);
          const col = Math.floor((x - s.x - 3) / 4);
          const floorLit = hash(s.x, floor, 0, 2203) < s.lit * 1.6;
          const on = floorLit && hash(s.x + col, floor, 1, 2207) < 0.7;
          if (on) {
            const r = hash(s.x + col, floor, 2, 2209);
            c = r < 0.05 ? winTV : s.cool ? (r < 0.6 ? winCool : winWarmDim) : r < 0.7 ? winWarm : winWarmDim;
            // Dimmed toward the facade so windows never rival enemy bullets for attention.
            c = mix(c, s.facade, wy === 2 ? 0.6 : 0.35);
          } else {
            c = winOff;
          }
        }
        putW(d, x, y, ditherRGB(c, x, y, 4));
      }
    }

    // Rooftop props.
    const cx = s.x + Math.floor(s.w / 2);
    if (s.roof === 'spire') {
      const sh = 24 + Math.floor(rand() * 26);
      for (let y = top - sh; y < top; y++) {
        const half = Math.floor(((y - (top - sh)) / sh) * 3);
        for (let dx = -half; dx <= half; dx++) putW(d, cx + dx, y, dx === half ? rimLight : hex('#171d33'));
      }
      putW(d, cx, top - sh - 1, beacon);
      putW(d, cx, top - sh - 2, mix(beacon, [0, 0, 0], 0.5));
    } else if (s.roof === 'flat' || s.roof === 'setback') {
      const r = rand();
      const roofY = colTop(cx);
      if (r < 0.35) {
        // Water tower on stilts.
        const tx = s.x + 6 + Math.floor(rand() * Math.max(1, s.w - 18));
        for (let y = roofY - 6; y < roofY; y++) { putW(d, tx + 1, y, hex('#1d2338')); putW(d, tx + 6, y, hex('#1d2338')); }
        for (let y = roofY - 13; y < roofY - 6; y++) for (let x = tx; x < tx + 8; x++) putW(d, x, y, x === tx + 7 ? rimLight : hex('#2b2430'));
        for (let x = tx + 1; x < tx + 7; x++) putW(d, x, roofY - 14, hex('#3a2f3a'));
      } else if (r < 0.6) {
        // Antenna mast with beacon.
        const mh = 10 + Math.floor(rand() * 14);
        for (let y = roofY - mh; y < roofY; y++) putW(d, cx, y, hex('#2a3150'));
        putW(d, cx - 1, roofY - Math.floor(mh * 0.6), hex('#2a3150'));
        putW(d, cx + 1, roofY - Math.floor(mh * 0.6), hex('#2a3150'));
        putW(d, cx, roofY - mh - 1, beacon);
      } else if (r < 0.8 && s.w > 40) {
        // Neon billboard on the roof.
        const bw = Math.min(s.w - 10, 22 + Math.floor(rand() * 10)), bh = 9;
        const bx = s.x + Math.floor((s.w - bw) / 2), by = roofY - bh - 3;
        const neon = neonColors[Math.floor(rand() * neonColors.length)];
        for (let y = by + bh; y < roofY; y++) { putW(d, bx + 2, y, hex('#1d2338')); putW(d, bx + bw - 3, y, hex('#1d2338')); }
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const border = y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1;
            const glyph = !border && y > by + 2 && y < by + bh - 3 && hash(x, Math.floor((x - bx) / 3), 5, 2221) > 0.45;
            putW(d, x, y, border ? neon : glyph ? mix(neon, [255, 255, 255], 0.25) : hex('#0b0d18'));
          }
        }
      } else {
        // HVAC boxes.
        for (let k = 0; k < 2; k++) {
          const hx = s.x + 4 + Math.floor(rand() * Math.max(1, s.w - 12));
          for (let y = roofY - 4; y < roofY; y++) for (let x = hx; x < hx + 6; x++) putW(d, x, y, x === hx + 5 ? rimLight : hex('#1b2135'));
        }
      }
    } else if (s.roof === 'stepped' && rand() < 0.6) {
      putW(d, cx, top - 31, beacon);
    }
  }

  // Warm street glow at the base, so the skyline sits in a lit city.
  for (let y = 330; y < CITY_H; y++) {
    const g = clamp01((y - 330) / 70);
    for (let x = 0; x < CITY_W; x++) {
      const o = (y * CITY_W + x) * 4;
      if (d[o + 3] === 0) continue;
      const c = mix([d[o], d[o + 1], d[o + 2]], AMBER, smooth(g) * 0.5);
      put(d, CITY_W, x, y, ditherRGB(c, x, y, 4));
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Searchlight beam: narrow at the base, widening and fading upward. Additive. */
export function drawSearchlightBeam(w = 64, h = 256): HTMLCanvasElement {
  const { canvas, ctx, img } = newCanvas(w, h);
  const tint = hex('#cfe0ff');
  for (let y = 0; y < h; y++) {
    const t = 1 - y / (h - 1);        // 0 at base (bottom), 1 at the far end
    const half = lerp(1.5, w / 2, t);  // cone
    const fade = Math.pow(1 - t, 1.6);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x + 0.5 - w / 2) / half;
      if (u >= 1) continue;
      const a = fade * (1 - u * u) * 0.55;
      const q = Math.floor(a * 8 + bayer(x, y)) / 8;
      if (q > 0) put(img.data, w, x, y, tint, Math.round(q * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

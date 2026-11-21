/**
 * Arcade-style lettering rendered from the bitmap font into a canvas.
 *
 * Press Start 2P is drawn at its native 8px-grid size, thresholded to a crisp
 * 1-bit mask, then coloured row-by-row (chrome, fire, gold, ...), given a
 * hard dark outline and a stepped drop shadow, and optionally sheared for an
 * italic "speed" slant. The result is shown scaled up with
 * `image-rendering: pixelated`, so every texel stays a sharp square.
 */
import { useEffect, useState } from 'react';

export type PixelStyle = 'chrome' | 'fire' | 'gold' | 'red' | 'cyan' | 'white';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Colour bands from top to bottom of the glyph, as [fraction, colour]. */
const STYLES: Record<PixelStyle, [number, string][]> = {
  // Classic 80s chrome: sky above the horizon line, dark ground below, bright rim at the bottom.
  chrome: [[0, '#ffffff'], [0.2, '#d8f3ff'], [0.42, '#7cc7f2'], [0.5, '#1d2f6b'], [0.58, '#3b4f9a'], [0.8, '#8fa8e8'], [1, '#e9f1ff']],
  fire: [[0, '#fff6b0'], [0.3, '#ffd23d'], [0.6, '#ff8a1f'], [1, '#d8341c']],
  gold: [[0, '#fffbe0'], [0.3, '#ffe27a'], [0.55, '#e3a428'], [0.56, '#a8661a'], [1, '#ffd25a']],
  red: [[0, '#ffd2cc'], [0.35, '#ff5a4a'], [0.7, '#c81e2a'], [1, '#7a0f1e']],
  cyan: [[0, '#e8fdff'], [0.4, '#6ee7ff'], [1, '#1f8fd1']],
  white: [[0, '#ffffff'], [1, '#c9d3ea']],
};

const OUTLINE: RGB = [8, 8, 20];
const SHADOW: RGB = [34, 18, 70];
const FONT = '"Press Start 2P"';

export interface PixelTextOptions {
  style?: PixelStyle;
  /** Integer texel scale applied to the 8px font before colouring. */
  scale?: number;
  /** Italic shear: shift 1 texel right every N rows from the bottom (0 = none). */
  shear?: number;
  /** Shadow offset in texels. */
  shadow?: number;
}

const cache = new Map<string, string>();

function bandColour(stops: [number, string][], t: number): RGB {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t <= t1) {
      // Hard bands, not smooth gradients: snap to the nearer stop within 4 levels.
      const k = Math.round(((t - t0) / Math.max(1e-6, t1 - t0)) * 3) / 3;
      const a = hex(c0), b = hex(c1);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return hex(stops[stops.length - 1][1]);
}

/** Render `text` and return a PNG data URL (cached). Requires the font to be loaded. */
export function renderPixelText(text: string, opts: PixelTextOptions = {}): string {
  const { style = 'chrome', scale = 1, shear = 0, shadow = 1 } = opts;
  const key = `${text}|${style}|${scale}|${shear}|${shadow}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // 1. Rasterise at the font's native 8px size and threshold to a mask.
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `8px ${FONT}`;
  const w0 = Math.ceil(probe.measureText(text).width);
  const h0 = 8;
  const m = document.createElement('canvas');
  m.width = Math.max(1, w0);
  m.height = h0;
  const mc = m.getContext('2d')!;
  mc.font = `8px ${FONT}`;
  mc.textBaseline = 'top';
  mc.fillStyle = '#fff';
  mc.fillText(text, 0, 0);
  const src = mc.getImageData(0, 0, m.width, h0).data;

  // 2. Scale up (nearest) and apply shear, leaving room for outline + shadow.
  const gw = m.width * scale, gh = h0 * scale;
  const slant = shear > 0 ? Math.ceil(gh / shear) : 0;
  const pad = 1;
  const W = gw + slant + pad * 2 + shadow, H = gh + pad * 2 + shadow;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < gh; y++) {
    const off = shear > 0 ? Math.floor((gh - 1 - y) / shear) : 0;
    for (let x = 0; x < gw; x++) {
      if (src[((Math.floor(y / scale) * m.width + Math.floor(x / scale)) * 4) + 3] >= 128) {
        mask[(y + pad) * W + x + off + pad] = 1;
      }
    }
  }

  // 3. Paint: shadow, outline, then banded fill.
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const oc = out.getContext('2d')!;
  const img = oc.createImageData(W, H);
  const d = img.data;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? mask[y * W + x] : 0);
  const set = (x: number, y: number, c: RGB) => {
    const o = (y * W + x) * 4;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  };
  const stops = STYLES[style];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (at(x, y)) {
        const t = (y - pad) / Math.max(1, gh - 1);
        let c = bandColour(stops, Math.min(1, Math.max(0, t)));
        if (!at(x, y - 1)) c = [Math.min(255, c[0] + 40), Math.min(255, c[1] + 40), Math.min(255, c[2] + 40)]; // top-edge glint
        set(x, y, c);
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
        set(x, y, OUTLINE);
      } else if (shadow > 0 && (at(x - shadow, y - shadow) || at(x - shadow + 1, y - shadow) || at(x - shadow, y - shadow + 1))) {
        set(x, y, SHADOW);
      }
    }
  }
  oc.putImageData(img, 0, 0);
  const url = out.toDataURL();
  cache.set(key, url);
  return url;
}

let fontReady: Promise<unknown> | null = null;
function whenFontReady() {
  if (!fontReady) {
    fontReady = typeof document !== 'undefined' && document.fonts
      ? document.fonts.load(`8px ${FONT}`).catch(() => undefined)
      : Promise.resolve();
  }
  return fontReady;
}

/** React hook: rendered data URL once the font is loaded (null until then). */
export function usePixelText(text: string, opts: PixelTextOptions = {}): string | null {
  const key = `${text}|${opts.style}|${opts.scale}|${opts.shear}|${opts.shadow}`;
  const [url, setUrl] = useState<string | null>(() => cache.get(key) ?? null);
  useEffect(() => {
    let live = true;
    whenFontReady().then(() => { if (live) setUrl(renderPixelText(text, opts)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

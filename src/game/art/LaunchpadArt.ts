/**
 * Procedural art for the Stage 1 launch complex, at night.
 *
 * Lights: the full moon (upper-right, cool) is the key light, so right-hand
 * edges catch a blue-white rim; warm sodium floodlights pool on the deck; red
 * aviation beacons mark the tops of structures. Everything is 1 texel per
 * world unit and drawn with crisp pixel primitives plus dithered ramps, to
 * match the Stage 1 backdrop (art/Stage1Art.ts).
 *
 * Texture sizes and anchor points match the meshes in entities/Launchpad.ts
 * exactly, because the takeoff animation is choreographed around them: the
 * ship docks at world (-220, -210) and the deck surface is at world y -230.
 */
import { hash, clamp01, bayer, RGB, hex, mix, rampDither, newCanvas, put } from './PixelArt';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const STEEL: RGB[] = ['#090b12', '#11151f', '#191f2d', '#232a3c', '#2f384e', '#3e4962', '#525e7a', '#6b7894', '#8b97b1', '#aeb8cd'].map(hex);
const CONCRETE: RGB[] = ['#0b0d12', '#13161d', '#1b1f28', '#252a34', '#313742', '#3e4551', '#4f5662', '#646b77'].map(hex);
const RED_STEEL: RGB[] = ['#150909', '#250e0c', '#3a1511', '#531d16', '#6e271c', '#8c3524', '#a84a33'].map(hex);
const TANK_WHITE: RGB[] = ['#11141d', '#1b2030', '#283047', '#38425e', '#4c5876', '#66728f', '#8590ab', '#a7b0c6', '#c9d0de', '#e6eaf2'].map(hex);

const SODIUM = hex('#ffb56b');
const LAMP = hex('#ffe6b0');
const WINDOW_WARM = hex('#f0c27a');
const SCREEN = hex('#6fd8ff');
const BEACON = hex('#ff3434');
const EDGE_BLUE = hex('#7fd0ff');
const HAZARD_Y = hex('#8f7424');
const HAZARD_K = hex('#14151a');
const VOID = hex('#050609');

// ---------------------------------------------------------------------------
// Tiny pixel canvas
// ---------------------------------------------------------------------------

class Pix {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  constructor(readonly w: number, readonly h: number) {
    const c = newCanvas(w, h);
    this.canvas = c.canvas;
    this.ctx = c.ctx;
    this.img = c.img;
  }
  get data() { return this.img.data; }

  px(x: number, y: number, c: RGB, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    put(this.img.data, this.w, x, y, c, a);
  }
  /** Read back a pixel (null if transparent). */
  get(x: number, y: number): RGB | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const o = (y * this.w + x) * 4;
    return this.img.data[o + 3] === 0 ? null : [this.img.data[o], this.img.data[o + 1], this.img.data[o + 2]];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c, a);
  }
  /** Rectangle shaded by a function of (u, v) in 0..1 → ramp brightness. */
  shade(x: number, y: number, w: number, h: number, ramp: RGB[], f: (u: number, v: number, px: number, py: number) => number) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const u = w > 1 ? (i - x) / (w - 1) : 0, v = h > 1 ? (j - y) / (h - 1) : 0;
        this.px(i, j, rampDither(ramp, f(u, v, i, j), i, j));
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Lighten existing pixels toward `c` by a radial falloff (light pools, glows). */
  glow(cx: number, cy: number, rx: number, ry: number, c: RGB, strength: number) {
    for (let j = Math.floor(cy - ry); j <= cy + ry; j++) {
      for (let i = Math.floor(cx - rx); i <= cx + rx; i++) {
        const d = ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2;
        if (d >= 1) continue;
        const base = this.get(i, j);
        if (!base) continue;
        const k = (1 - d) * (1 - d) * strength;
        const q = Math.floor(k * 6 + bayer(i, j)) / 6;
        if (q > 0) this.px(i, j, mix(base, c, Math.min(0.85, q)));
      }
    }
  }
  /** Red aviation beacon with a two-pixel halo. */
  beacon(x: number, y: number) {
    this.px(x, y, BEACON);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const b = this.get(x + dx, y + dy);
      this.px(x + dx, y + dy, b ? mix(b, BEACON, 0.5) : mix(VOID, BEACON, 0.6), b ? 255 : 160);
    }
  }
  done(): HTMLCanvasElement {
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

/**
 * Lattice truss between x0..x1 (inclusive), rows y0..y1: two chords, struts
 * every `bay` rows, X-bracing in each bay. Right chord is moonlit.
 */
function lattice(p: Pix, x0: number, x1: number, y0: number, y1: number, ramp: RGB[], bay = 12, litRight = true) {
  const dark = ramp[2], mid = ramp[4], lit = ramp[Math.min(ramp.length - 1, 6)];
  for (let y = y0; y <= y1; y++) {
    p.px(x0, y, litRight ? mid : lit);
    p.px(x0 + 1, y, dark);
    p.px(x1 - 1, y, dark);
    p.px(x1, y, litRight ? lit : mid);
  }
  for (let y = y0; y + bay <= y1; y += bay) {
    for (let x = x0; x <= x1; x++) p.px(x, y, mid);
    p.line(x0 + 1, y + 1, x1 - 1, y + bay - 1, dark);
    p.line(x1 - 1, y + 1, x0 + 1, y + bay - 1, dark);
  }
  for (let x = x0; x <= x1; x++) p.px(x, y1, mid);
}

// ---------------------------------------------------------------------------
// Pad deck (800x160; row 0 = world y -140, deck surface at row 90 = y -230)
// ---------------------------------------------------------------------------

/** Deck texture width; the mesh spans world x -612..288 (centre -162). */
export const DECK_W = 900;
/** Texture x of the ship's launch position (world x -220). */
const PAD_X = 392;
const DECK = 90;

export function drawPadDeck(): HTMLCanvasElement {
  const W = DECK_W, H = 160;
  const p = new Pix(W, H);

  // Front face of the raised concrete platform.
  p.shade(0, DECK + 10, W, H - DECK - 10, CONCRETE, (_u, v, x, y) => {
    const grain = hash(x >> 1, y >> 1, 1, 801) - 0.5;
    let b = 0.42 - v * 0.25 + grain * 0.12;
    if ((y - DECK - 10) % 22 === 0) b -= 0.22;      // horizontal panel seam
    if ((y - DECK - 10) % 22 === 1) b += 0.1;       // lit lip under seam
    if (x % 64 === 0) b -= 0.2;                     // vertical expansion joint
    return b;
  });

  // Moonlit deck lip and hazard band.
  for (let x = 0; x < W; x++) {
    p.px(x, DECK, STEEL[8]);
    p.px(x, DECK + 1, STEEL[6]);
    for (let y = DECK + 2; y < DECK + 10; y++) {
      const stripe = Math.floor((x + (y - DECK)) / 7) % 2 === 0;
      p.px(x, y, y === DECK + 9 ? HAZARD_K : stripe ? HAZARD_Y : HAZARD_K);
    }
  }

  // Flame trench under the launch position: grated opening with ember glow.
  const tx0 = PAD_X - 42, tx1 = PAD_X + 42;
  for (let y = DECK; y < H; y++) {
    for (let x = tx0; x <= tx1; x++) {
      const v = (y - DECK) / (H - DECK);
      const edge = Math.min(x - tx0, tx1 - x);
      let c: RGB = edge < 3 ? (x - tx0 < 3 ? STEEL[2] : STEEL[5]) : mix(VOID, hex('#3a1608'), clamp01(v * 1.3) * 0.9);
      if (edge >= 3 && v > 0.72 && hash(x, y, 2, 811) > 0.965) c = hex('#ff7a2a'); // embers
      p.px(x, y, c);
    }
  }
  for (let x = tx0 + 3; x <= tx1 - 3; x += 5) for (let y = DECK; y < DECK + 6; y++) p.px(x, y, STEEL[5]);
  for (let x = tx0; x <= tx1; x++) { p.px(x, DECK, STEEL[8]); p.px(x, DECK + 5, STEEL[4]); }

  // Launch cradle: two shock-absorber pylons under the ship's ends.
  for (const cx of [PAD_X - 26, PAD_X + 22]) {
    p.shade(cx - 3, DECK - 9, 7, 9, STEEL, (u) => 0.35 + u * 0.4);
    p.rect(cx - 4, DECK - 10, 9, 1, STEEL[8]);
  }

  // Edge lights along the deck lip.
  for (let x = 8; x < W; x += 24) p.px(x, DECK + 1, (x / 24) % 2 < 1 ? EDGE_BLUE : hex('#e8f4ff'));

  // Floodlight poles with sodium pools on the deck.
  for (const fx of [170, 570, 790]) {
    for (let y = 18; y < DECK; y++) { p.px(fx, y, STEEL[3]); p.px(fx + 1, y, STEEL[6]); }
    p.rect(fx - 4, 16, 10, 2, STEEL[5]);
    p.rect(fx - 3, 18, 8, 2, LAMP);
    p.glow(fx + 1, DECK + 6, 70, 22, SODIUM, 0.55);
  }
  // Steam/vent plume hint beside the trench and the trench's own ember glow.
  p.glow(PAD_X, DECK + 40, 46, 30, hex('#ff8a3a'), 0.25);

  return p.done();
}

// ---------------------------------------------------------------------------
// Service arms (56x140 each; row 0 = world y -85; ship centre at row ~125)
// ---------------------------------------------------------------------------

/** One service arm. `mirror` draws the right-hand arm (moonlight stays on the right). */
export function drawServiceArm(mirror = false): HTMLCanvasElement {
  const W = 56, H = 140;
  const p = new Pix(W, H);
  const mx = (x: number) => (mirror ? W - 1 - x : x);
  const pxm = (x: number, y: number, c: RGB) => p.px(mx(x), y, c);

  // Truss column (drawn in left-arm space, mirrored as needed).
  const x0 = 6, x1 = 26;
  for (let y = 10; y < H; y++) {
    const litChord = mirror ? x0 : x1;
    for (const x of [x0, x1]) pxm(x, y, x === litChord ? RED_STEEL[6] : RED_STEEL[4]);
    pxm(x0 + 1, y, RED_STEEL[2]);
    pxm(x1 - 1, y, RED_STEEL[2]);
  }
  for (let y = 10; y + 12 < H; y += 12) {
    for (let x = x0; x <= x1; x++) pxm(x, y, RED_STEEL[5]);
    for (let k = 1; k < 12; k++) {
      pxm(Math.round(x0 + 1 + (k / 12) * (x1 - x0 - 2)), y + k, RED_STEEL[3]);
      pxm(Math.round(x1 - 1 - (k / 12) * (x1 - x0 - 2)), y + k, RED_STEEL[3]);
    }
  }
  // Cap, lamp and beacon.
  for (let x = x0 - 2; x <= x1 + 2; x++) { pxm(x, 8, STEEL[6]); pxm(x, 9, STEEL[3]); }
  p.beacon(mx(16), 6);

  // Swing arm reaching toward the ship, with a clamp jaw.
  const armY = 112;
  for (let x = x1; x < W - 3; x++) {
    pxm(x, armY, RED_STEEL[6]);
    pxm(x, armY + 1, RED_STEEL[4]);
    pxm(x, armY + 5, RED_STEEL[3]);
    if ((x - x1) % 6 === 0) for (let y = armY; y <= armY + 5; y++) pxm(x, y, RED_STEEL[4]);
  }
  for (let y = armY - 6; y <= armY + 11; y++) {
    pxm(W - 4, y, STEEL[7]);
    pxm(W - 3, y, STEEL[5]);
    pxm(W - 2, y, STEEL[3]);
  }
  // Umbilical hoses drooping from the arm.
  for (let x = x1 + 2; x < W - 5; x++) {
    const sag = Math.round(Math.sin(((x - x1 - 2) / (W - 7 - x1)) * Math.PI) * 5);
    pxm(x, armY + 8 + sag, hex('#1a1c24'));
  }
  // A work lamp on the arm lights the ship's flank.
  pxm(x1 + 4, armY - 2, LAMP);
  pxm(x1 + 5, armY - 2, LAMP);

  return p.done();
}

// ---------------------------------------------------------------------------
// Control tower (240x360; row 0 = world y +100; texture x 0 = world x -450)
// ---------------------------------------------------------------------------

/** Searchlight lamp position on the tower texture (for anchoring the beam). */
export const TOWER_LAMP = { x: 104, y: 16 };

export function drawControlTower(): HTMLCanvasElement {
  const W = 240, H = 360;
  const p = new Pix(W, H);

  // Bunker / operations block at the base.
  const bx = 8, by = 250, bw = 132, bh = 110;
  p.shade(bx, by, bw, bh, CONCRETE, (u, v, x, y) => 0.38 + u * 0.22 - v * 0.1 + (hash(x >> 1, y >> 1, 3, 901) - 0.5) * 0.1);
  for (let y = by; y < by + bh; y++) { p.px(bx + bw - 1, y, CONCRETE[7]); p.px(bx, y, CONCRETE[1]); }
  for (let x = bx - 2; x < bx + bw + 2; x++) { p.px(x, by - 1, CONCRETE[6]); p.px(x, by - 2, CONCRETE[3]); }
  // Slit windows, some lit.
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 7; k++) {
      const wx = bx + 8 + k * 17, wy = by + 12 + row * 18;
      const on = hash(k, row, 0, 911) > 0.35;
      p.rect(wx, wy, 11, 3, on ? WINDOW_WARM : hex('#0c0f16'));
      if (on) p.rect(wx, wy + 2, 11, 1, mix(WINDOW_WARM, CONCRETE[3], 0.5));
    }
  }
  // Blast door with a lit sign above it.
  p.shade(bx + 54, by + 74, 26, 36, STEEL, (u) => 0.25 + u * 0.25);
  for (let y = by + 74; y < by + 110; y += 4) for (let x = bx + 54; x < bx + 80; x++) p.px(x, y, STEEL[2]);
  p.rect(bx + 58, by + 69, 18, 3, SCREEN);
  p.glow(bx + 67, by + 80, 30, 26, SCREEN, 0.25);
  // Earth Defense emblem: a small globe roundel.
  for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) {
    const d = i * i + j * j;
    if (d > 36) continue;
    const land = hash(i + 7, j + 7, 5, 921) > 0.55;
    p.px(bx + 24 + i, by + 88 + j, d > 25 ? STEEL[7] : land ? hex('#3c8a4a') : hex('#2a5fa8'));
  }
  // Rooftop mast with antennas.
  for (let y = 180; y < by - 2; y++) p.px(30, y, STEEL[5]);
  for (const [y, w] of [[196, 6], [214, 9], [232, 5]] as const) for (let x = 30 - w; x <= 30 + w; x++) p.px(x, y, STEEL[4]);
  p.beacon(30, 178);

  // Lattice service tower beside the pad.
  const lx0 = 128, lx1 = 196;
  lattice(p, lx0, lx1, 64, by + bh - 1, STEEL, 16);
  // Work platforms with lamps.
  for (let y = 110; y < by + bh - 10; y += 48) {
    for (let x = lx0 - 6; x <= lx1 + 10; x++) { p.px(x, y, STEEL[7]); p.px(x, y + 1, STEEL[3]); }
    for (let x = lx0 - 6; x <= lx1 + 10; x += 4) p.px(x, y - 3, STEEL[4]); // railing posts
    for (let x = lx0 - 6; x <= lx1 + 10; x++) p.px(x, y - 4, STEEL[5]);
    p.rect(lx1 + 4, y + 2, 3, 2, LAMP);
    p.glow(lx1 + 5, y + 10, 18, 14, SODIUM, 0.4);
  }
  // Elevator cage running up the tower.
  for (let y = 70; y < by + bh - 1; y++) { p.px(lx0 + 30, y, STEEL[6]); p.px(lx0 + 38, y, STEEL[6]); }
  p.shade(lx0 + 31, 180, 7, 12, STEEL, () => 0.5);
  p.rect(lx0 + 32, 183, 5, 3, WINDOW_WARM);

  // Glass control cab on top.
  const cx0 = 92, cx1 = 214, cy0 = 28, cy1 = 64;
  p.shade(cx0, cy0, cx1 - cx0, 6, STEEL, (u) => 0.45 + u * 0.4);              // roof
  p.shade(cx0 + 4, cy1 - 6, cx1 - cx0 - 8, 8, STEEL, (u) => 0.3 + u * 0.3);   // floor slab
  for (let y = cy0 + 6; y < cy1 - 6; y++) {
    for (let x = cx0 + 2; x < cx1 - 2; x++) {
      const slant = Math.round((y - cy0 - 6) * 0.15); // windows lean outward like a tower cab
      if (x < cx0 + 2 + slant || x > cx1 - 3 - slant) continue;
      const mullion = (x - cx0) % 16 === 0;
      let c: RGB = mullion ? STEEL[5] : mix(hex('#3a2a1c'), WINDOW_WARM, 0.55 + (y - cy0) / 80);
      // Operators and consoles in silhouette.
      if (!mullion && y > cy1 - 16 && hash(x >> 2, 0, 9, 931) > 0.55 && y > cy1 - 16 + (hash(x >> 2, 1, 9, 937) * 6 | 0)) c = hex('#16110f');
      if (!mullion && y > cy1 - 10 && (x >> 3) % 3 === 0) c = mix(SCREEN, c, 0.3);
      p.px(x, y, c);
    }
  }
  p.glow((cx0 + cx1) / 2, cy1 + 6, 70, 16, WINDOW_WARM, 0.35);
  // Radar dish on a mast and the searchlight housing on the roof.
  for (let y = 6; y < cy0; y++) p.px(176, y, STEEL[6]);
  for (let i = -9; i <= 9; i++) {
    const y = 6 + Math.round((i * i) / 14);
    p.px(176 + i, y, STEEL[i > 0 ? 8 : 5]);
    p.px(176 + i, y + 1, STEEL[3]);
  }
  p.beacon(176, 3);
  p.shade(TOWER_LAMP.x - 7, TOWER_LAMP.y + 2, 15, cy0 - TOWER_LAMP.y - 2, STEEL, (u) => 0.3 + u * 0.4);
  p.rect(TOWER_LAMP.x - 5, TOWER_LAMP.y, 11, 3, LAMP);
  p.beacon(cx1 - 2, cy0 - 2);

  return p.done();
}

// ---------------------------------------------------------------------------
// Fuel compound (240x280; row 0 = world y +30; deck at row 260)
// ---------------------------------------------------------------------------

/** Lit sphere into a ramp: moon from upper-right, sodium bounce from lower-left. */
function sphere(p: Pix, cx: number, cy: number, r: number, ramp: RGB[]) {
  const L = [0.55, -0.55, 0.63]; // x right, y down, z toward viewer
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      const d2 = (i * i + j * j) / (r * r);
      if (d2 > 1) continue;
      const nx = i / r, ny = j / r, nz = Math.sqrt(1 - d2);
      const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const bounce = Math.max(0, -nx * 0.6 + ny * 0.7) * 0.18;
      let v = 0.08 + lam * 0.6 + bounce;
      if (Math.abs(j) <= 1 && d2 < 0.96) v -= 0.18;                       // equator weld band
      if (d2 > 0.86 && nx > 0.2 && ny < 0.2) v += 0.15;                  // moon rim
      let c = rampDither(ramp, v, cx + i, cy + j);
      if (bounce > 0.05) c = mix(c, SODIUM, bounce * 0.6);
      p.px(cx + i, cy + j, c);
    }
  }
}

export function drawFuelCompound(): HTMLCanvasElement {
  const W = 240, H = 280;
  const p = new Pix(W, H);
  const GROUND = 260;

  // Pipe rack behind everything.
  for (const [y, c] of [[238, 6], [246, 5], [252, 4]] as const) {
    for (let x = 0; x < 200; x++) { p.px(x, y, STEEL[c]); p.px(x, y + 1, STEEL[c - 2]); }
    for (let x = 6; x < 200; x += 28) { p.rect(x, y - 1, 3, 4, STEEL[7]); }
  }
  for (let x = 4; x < 200; x += 36) for (let y = 236; y < GROUND; y++) p.px(x, y, STEEL[3]);

  // Spherical propellant tanks on legs.
  const tanks = [{ x: 74, y: 178, r: 44 }, { x: 166, y: 196, r: 34 }];
  for (const t of tanks) {
    for (const lx of [-0.8, -0.3, 0.3, 0.8]) {
      const x = Math.round(t.x + lx * t.r);
      for (let y = t.y + Math.round(t.r * 0.5); y < GROUND; y++) { p.px(x, y, STEEL[3]); p.px(x + 1, y, STEEL[lx > 0 ? 6 : 4]); }
    }
    for (let x = t.x - t.r; x <= t.x + t.r; x++) p.px(x, t.y + Math.round(t.r * 0.72), STEEL[4]); // girth ring
    sphere(p, t.x, t.y, t.r, TANK_WHITE);
    p.beacon(t.x, t.y - t.r - 1);
  }
  // Stencilled band on the big tank.
  for (let x = tanks[0].x - 18; x <= tanks[0].x + 18; x++) for (let y = tanks[0].y + 10; y < tanks[0].y + 14; y++) {
    const base = p.get(x, y);
    if (base) p.px(x, y, mix(base, hex('#8c3524'), 0.6));
  }

  // Vertical storage tank with ladder.
  p.shade(8, 150, 30, GROUND - 150, TANK_WHITE, (u, v) => 0.15 + Math.sin(u * Math.PI) * 0.25 + u * 0.25 - v * 0.15);
  for (let x = 8; x < 38; x++) { p.px(x, 149, TANK_WHITE[7]); p.px(x, 148, TANK_WHITE[5]); }
  for (let y = 152; y < GROUND; y++) { p.px(40, y, STEEL[5]); p.px(44, y, STEEL[5]); if (y % 4 === 0) for (let x = 40; x <= 44; x++) p.px(x, y, STEEL[4]); }
  p.beacon(23, 146);

  // Radome on a lattice mast at the right edge.
  lattice(p, 206, 226, 92, GROUND - 1, STEEL, 14);
  for (let j = -18; j <= 0; j++) for (let i = -18; i <= 18; i++) {
    if (i * i + j * j > 18 * 18) continue;
    const nx = i / 18, ny = j / 18, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const v = 0.2 + Math.max(0, nx * 0.55 - ny * 0.55 + nz * 0.63) * 0.75;
    let c = rampDither(TANK_WHITE, v, 216 + i, 90 + j);
    if (((i + 30) % 7 === 0 || (j + 30) % 6 === 0) && i * i + j * j < 16 * 16) c = mix(c, TANK_WHITE[3], 0.4); // panel seams
    p.px(216 + i, 90 + j, c);
  }
  for (let x = 196; x <= 236; x++) { p.px(x, 91, STEEL[7]); p.px(x, 92, STEEL[3]); }
  p.beacon(216, 70);

  // Floodlight washing the tanks from the lower left.
  for (let y = 196; y < GROUND; y++) p.px(120, y, STEEL[4]);
  p.rect(116, 194, 8, 2, LAMP);
  p.glow(110, 225, 60, 40, SODIUM, 0.3);

  return p.done();
}

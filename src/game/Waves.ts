/**
 * Authored enemy formations and per-stage wave scripts.
 *
 * A *formation* is a reusable shape (V-wing, snake, pincer...) that expands
 * into individual enemy spawns. A *stage script* is the hand-ordered list of
 * formations that stage plays, each with a `gap` (seconds of game time before
 * the next one may launch). The WaveDirector in Level walks the script, loops
 * it if the stage runs long, and holds back when too many ships are alive.
 *
 * Coordinates: world units, screen is 800x600 centred on the camera.
 * `dx` is added to the spawn line just past the right edge; `dy`/`y` are
 * absolute screen-space heights (+ is up).
 */

export interface SpawnSpec {
  type: string;
  pattern: string;
  /** Extra distance to the right of the spawn line. */
  dx: number;
  /** Vertical position (absolute, screen space). */
  y: number;
  /** Seconds after the formation launches before this ship appears. */
  delay: number;
  /** Pattern-specific: destination height for 'pincer'. */
  targetY?: number;
  /** Pattern-specific: +1 peel upward, -1 peel downward for 'peel'. */
  dir?: number;
  /** Override for where along the screen it spawns (default: right edge). */
  screenX?: number;
}

export interface WaveEntry {
  formation: FormationName;
  /** Centre height for the formation (ignored by edge-entry formations). */
  y: number;
  /** Seconds before the next entry may launch. */
  gap: number;
  /** Ship type override (defaults to the formation's natural type for the stage). */
  type?: string;
}

type FormationFn = (y: number, type: string) => SpawnSpec[];

/** Classic V: leader in front, wings trailing behind above and below. */
function vee(y: number, type: string, n = 5): SpawnSpec[] {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => ({
    type, pattern: 'straight', dx: Math.abs(i - mid) * 38, y: y + (i - mid) * 36, delay: 0,
  }));
}

/** Single-file sine snake: every ship follows the exact same path. */
function snake(y: number, type: string, n = 6): SpawnSpec[] {
  return Array.from({ length: n }, (_, i) => ({ type, pattern: 'wave', dx: 0, y, delay: i * 0.22 }));
}

/** Vertical wall: forces the player to break through or go around. */
function wall(y: number, type: string, n = 4): SpawnSpec[] {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => ({ type, pattern: 'straight', dx: 0, y: y + (i - mid) * 72, delay: 0 }));
}

/** Two columns dropping in from top and bottom, converging toward the middle. */
function pincer(_y: number, type: string, n = 3): SpawnSpec[] {
  const out: SpawnSpec[] = [];
  for (let i = 0; i < n; i++) {
    const delay = i * 0.35;
    const screenX = 260 + i * 40;
    out.push({ type, pattern: 'pincer', dx: 0, screenX, y: 330, targetY: 40 + i * 50, delay });
    out.push({ type, pattern: 'pincer', dx: 0, screenX, y: -330, targetY: -(40 + i * 50), delay });
  }
  return out;
}

/** Echelon line that flies in, then peels off alternately up and down. */
function peel(y: number, type: string, n = 4): SpawnSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    type, pattern: 'peel', dx: i * 44, y, delay: 0, dir: i % 2 === 0 ? 1 : -1,
  }));
}

/** A heavy gunship that parks on screen, with two fighters screening it. */
function heavyEscort(y: number, _type: string): SpawnSpec[] {
  return [
    { type: 'heavy', pattern: 'heavy', dx: 40, y, delay: 0 },
    { type: 'scout', pattern: 'straight', dx: 0, y: y + 64, delay: 0 },
    { type: 'scout', pattern: 'straight', dx: 0, y: y - 64, delay: 0 },
  ];
}

/** Snipers above and below: crossfire you have to deal with first. */
function sniperPair(y: number, _type: string): SpawnSpec[] {
  return [
    { type: 'sniper', pattern: 'zigzag', dx: 0, y: y + 110, delay: 0 },
    { type: 'sniper', pattern: 'zigzag', dx: 0, y: y - 110, delay: 0.5 },
  ];
}

/** Interceptors streaming in at staggered heights, each homing on your row. */
function interceptorStream(y: number, _type: string): SpawnSpec[] {
  return [
    { type: 'interceptor', pattern: 'swoop', dx: 0, y, delay: 0 },
    { type: 'interceptor', pattern: 'swoop', dx: 0, y: y + 130, delay: 0.5 },
    { type: 'interceptor', pattern: 'swoop', dx: 0, y: y - 130, delay: 1.0 },
  ];
}

/** Stage 5: bio-drone spiral snake. */
function bioSnake(y: number, _type: string, n = 5): SpawnSpec[] {
  return Array.from({ length: n }, (_, i) => ({ type: 'bioDrone', pattern: 'bio_spiral', dx: 0, y, delay: i * 0.25 }));
}

/** Stage 5: a pair of hunters that lock onto your height. */
function bioHunters(y: number, _type: string): SpawnSpec[] {
  return [
    { type: 'bioStalker', pattern: 'bio_hunt', dx: 0, y: y + 70, delay: 0 },
    { type: 'bioStalker', pattern: 'bio_hunt', dx: 0, y: y - 70, delay: 0.4 },
  ];
}

/** Stage 5: behemoth with a drone screen. */
function bioBehemoth(y: number, _type: string): SpawnSpec[] {
  return [
    { type: 'bioBehemoth', pattern: 'bio_heavy', dx: 40, y, delay: 0 },
    { type: 'bioDrone', pattern: 'bio_spiral', dx: 0, y: y + 60, delay: 0.2 },
    { type: 'bioDrone', pattern: 'bio_spiral', dx: 0, y: y - 60, delay: 0.2 },
  ];
}

export const FORMATIONS = {
  vee, snake, wall, pincer, peel, heavyEscort, sniperPair, interceptorStream, bioSnake, bioHunters, bioBehemoth,
} satisfies Record<string, FormationFn>;

export type FormationName = keyof typeof FORMATIONS;

export function expandFormation(entry: WaveEntry): SpawnSpec[] {
  const fn: FormationFn = FORMATIONS[entry.formation];
  return fn(entry.y, entry.type ?? 'scout');
}

/**
 * Hand-ordered wave scripts. Each stage starts gentle, introduces its new
 * enemy types one at a time, then mixes them. Scripts loop if a stage runs
 * long (e.g. when the player hangs back), so the last entries should flow
 * back into the first.
 */
export const STAGE_WAVES: Record<number, WaveEntry[]> = {
  // Earth City: scouts and heavies only. Teach shapes first.
  1: [
    { formation: 'snake', y: 120, gap: 3.0 },
    { formation: 'snake', y: -120, gap: 3.5 },
    { formation: 'vee', y: 0, gap: 4.0 },
    { formation: 'wall', y: 0, gap: 3.5 },
    { formation: 'peel', y: 140, gap: 3.0 },
    { formation: 'peel', y: -140, gap: 3.5 },
    { formation: 'heavyEscort', y: -40, gap: 4.5 },
    { formation: 'pincer', y: 0, gap: 4.0 },
    { formation: 'vee', y: 110, gap: 2.5 },
    { formation: 'vee', y: -110, gap: 3.5 },
    { formation: 'heavyEscort', y: 90, gap: 3.0 },
    { formation: 'snake', y: 0, gap: 4.0 },
  ],
  // Deep space: interceptors and snipers arrive (waves run before/after the asteroid field).
  2: [
    { formation: 'interceptorStream', y: 60, gap: 3.5 },
    { formation: 'vee', y: -80, gap: 3.0 },
    { formation: 'sniperPair', y: 0, gap: 4.0 },
    { formation: 'snake', y: 150, gap: 2.5 },
    { formation: 'snake', y: -150, gap: 3.5 },
    { formation: 'heavyEscort', y: 0, gap: 4.0 },
    { formation: 'interceptorStream', y: -60, gap: 3.0 },
    { formation: 'pincer', y: 0, gap: 4.0 },
  ],
  // Lunar approach: denser mixes.
  3: [
    { formation: 'vee', y: 100, gap: 2.5 },
    { formation: 'vee', y: -100, gap: 3.0 },
    { formation: 'sniperPair', y: 0, gap: 3.0 },
    { formation: 'interceptorStream', y: 0, gap: 3.0 },
    { formation: 'peel', y: 160, gap: 2.0 },
    { formation: 'peel', y: -160, gap: 3.0 },
    { formation: 'heavyEscort', y: 100, gap: 2.5 },
    { formation: 'heavyEscort', y: -100, gap: 4.0 },
    { formation: 'pincer', y: 0, gap: 3.0 },
    { formation: 'wall', y: 0, gap: 3.5, type: 'interceptor' },
  ],
  // Lunar surface: ground turrets carry the middle section; waves keep pressure up.
  4: [
    { formation: 'interceptorStream', y: 80, gap: 3.0 },
    { formation: 'sniperPair', y: 60, gap: 3.5 },
    { formation: 'vee', y: 140, gap: 3.0 },
    { formation: 'heavyEscort', y: 60, gap: 4.0 },
    { formation: 'peel', y: 180, gap: 3.0 },
    { formation: 'snake', y: 120, gap: 3.0 },
  ],
  // Moon core cavern: tight vertical space (about ±150), bio fleet.
  5: [
    { formation: 'bioSnake', y: 60, gap: 2.5 },
    { formation: 'bioSnake', y: -60, gap: 3.0 },
    { formation: 'bioHunters', y: 0, gap: 3.0 },
    { formation: 'bioBehemoth', y: 0, gap: 4.0 },
    { formation: 'bioSnake', y: 0, gap: 2.0 },
    { formation: 'bioHunters', y: 40, gap: 3.0 },
    { formation: 'bioBehemoth', y: -30, gap: 3.5 },
  ],
};

/** Max regular ships alive before the director waits (asteroids/turrets/sub-bosses excluded). */
export const STAGE_SHIP_CAP: Record<number, number> = { 1: 9, 2: 8, 3: 10, 4: 7, 5: 10 };

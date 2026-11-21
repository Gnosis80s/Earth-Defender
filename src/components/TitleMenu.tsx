/**
 * Title screen: pixel-art logo over a rising, lit Earth; start/story/awards
 * on the left, loadout (ship, beam, hardcore) and stage select on the right.
 * Uses the game's real sprites for ship, beam and power-up previews.
 */
import { useEffect, useMemo, useState } from 'react';
import { Frame, PixelWord, PxButton } from './ui/Pixel';
import { AssetManager } from '../game/AssetManager';
import { Powerup, PowerupType } from '../game/entities/Powerup';
import { drawEarth } from '../game/art/Stage4Art';
import { STAGES, stageNo } from '../game/stages';
import { hash, bayer } from '../game/art/PixelArt';

export interface Unlocks {
  stealth: boolean; dreadnought: boolean; goldenShip: boolean;
  laserGreen: boolean; laserPurple: boolean; laserRed: boolean; hardcore: boolean;
}

interface Props {
  highScore: number;
  unlocks: Unlocks;
  selectedShip: string;
  selectedLaser: string;
  hardcoreMode: boolean;
  onSelectShip: (id: string) => void;
  onSelectLaser: (id: string) => void;
  onToggleHardcore: () => void;
  onStart: (stage: number) => void;
  onStory: () => void;
  onAwards: () => void;
}

const SHIPS = [
  { id: 'player', name: 'BASE FIGHTER', desc: 'BALANCED INTERCEPTOR', unlock: null as keyof Unlocks | null, hint: '' },
  { id: 'player_gold', name: 'GOLD FIGHTER', desc: 'PRISMATIC ALLOY', unlock: 'goldenShip' as const, hint: 'DESTROY A GOLDEN ASTEROID' },
  { id: 'player_stealth', name: 'STEALTH', desc: 'RADAR EVASION', unlock: 'stealth' as const, hint: 'CLEAR A STAGE UNHIT' },
  { id: 'player_dreadnought', name: 'DREADNOUGHT', desc: 'HEAVY ARMOUR', unlock: 'dreadnought' as const, hint: 'DEFEAT 10 BOSSES' },
];

const BEAMS = [
  { id: 'bulletPlayer', name: 'CYAN ION', unlock: null as keyof Unlocks | null, hint: '' },
  { id: 'bulletPlayer_green', name: 'PLASMA GREEN', unlock: 'laserGreen' as const, hint: 'DESTROY 1,000 ENEMIES' },
  { id: 'bulletPlayer_purple', name: 'ANTIMATTER', unlock: 'laserPurple' as const, hint: 'SCORE 500,000' },
  { id: 'bulletPlayer_red', name: 'CRIMSON', unlock: 'laserRed' as const, hint: 'DEFEAT A BOSS' },
];

const POWERUPS: { type: PowerupType; name: string }[] = [
  { type: 'P', name: 'PLASMA' }, { type: 'S', name: 'SHIELD' }, { type: 'D', name: 'DRONE' },
  { type: 'M', name: '+MISSILE' }, { type: 'U', name: 'WARHEAD' },
];

/** Canvas texture -> data URL (sprites are canvases under the hood). */
function spriteUrl(name: string): string | null {
  try {
    const img = AssetManager.getTexture(name)?.image as HTMLCanvasElement | undefined;
    return img?.toDataURL ? img.toDataURL() : null;
  } catch { return null; }
}

/** Static dithered starfield for the title backdrop. */
function drawStars(w = 480, h = 300): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      // Deep-space gradient with a faint violet band, dithered.
      const t = y / h;
      const g = 6 + t * 10 + (bayer(x, y) - 0.5) * 4;
      img.data[o] = g * 0.8; img.data[o + 1] = g * 0.75; img.data[o + 2] = g * 2.2; img.data[o + 3] = 255;
      const r = hash(x, y, 1, 4242);
      if (r > 0.9965) {
        const b = r > 0.9993 ? 255 : 150;
        img.data[o] = b; img.data[o + 1] = b; img.data[o + 2] = Math.min(255, b + 30);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

export function TitleMenu(p: Props) {
  const [stage, setStage] = useState(1);
  const [earth, setEarth] = useState<string | null>(null);
  const stars = useMemo(() => drawStars(), []);

  // Sprite previews (cheap; textures are cached by AssetManager).
  const sprites = useMemo(() => {
    const ship: Record<string, string | null> = {};
    for (const s of SHIPS) ship[s.id] = spriteUrl(s.id);
    const beam: Record<string, string | null> = {};
    for (const b of BEAMS) beam[b.id] = spriteUrl(b.id);
    const pu: Record<string, string> = {};
    for (const x of POWERUPS) pu[x.type] = (Powerup.generateTexture(x.type).image as HTMLCanvasElement).toDataURL();
    return { ship, beam, pu };
  }, []);

  // The big Earth is ~0.3s of work: do it when the browser is idle.
  useEffect(() => {
    const run = () => setEarth(drawEarth(320, { yaw: 3.3 }).toDataURL());
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 300 }) : setTimeout(run, 50);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  // Enter starts the selected stage, like pressing START on a cabinet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') p.onStart(stage); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, p]);

  const locked = (u: keyof Unlocks | null) => (u ? !p.unlocks[u] : false);

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto overflow-x-hidden bg-[#03040b] font-pixel text-white">
      {/* Backdrop: stars, rising Earth, vignette */}
      <img src={stars} alt="" className="px-img absolute inset-0 w-full h-full object-cover pointer-events-none" />
      {earth && (
        <img
          src={earth}
          alt=""
          className="px-img absolute left-1/2 pointer-events-none"
          style={{ width: 'min(150vh, 1300px)', bottom: 'calc(min(150vh, 1300px) * -0.8)', opacity: 0.9, animation: 'px-float 9s ease-in-out infinite' }}
        />
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(0,0,0,0.65) 100%)' }} />

      <div className="relative min-h-full flex flex-col items-center px-4 py-6 sm:py-8 gap-5">
        {/* Logo */}
        {/* Both words share one texel size (--t): EARTH at 3x the font grid, DEFENDER at 2x. */}
        <div className="flex flex-col items-center select-none" style={{ ['--t' as string]: 'clamp(2px, 0.85vh, 4px)' }}>
          <PixelWord text="EARTH" style="chrome" scale={3} shear={5} shadow={2} height="calc(28 * var(--t))" />
          <PixelWord text="DEFENDER" style="fire" scale={2} shadow={2} height="calc(20 * var(--t))" className="mt-[calc(1*var(--t))]" />
          <div className="mt-3 text-[10px] sm:text-xs text-cyan-300 tracking-[0.25em]">★ THE LAST STAND ★</div>
        </div>

        <div className="w-full max-w-[940px] grid md:grid-cols-[1fr_1.15fr] gap-4">
          {/* Left: start + info */}
          <div className="flex flex-col gap-4">
            <PxButton tone="amber" onClick={() => p.onStart(stage)} className="w-full py-5 text-base sm:text-lg text-amber-200">
              <span className="block">START MISSION</span>
              <span className="block mt-2 text-[9px] text-amber-400/90 px-blink">PRESS ENTER · STAGE {stageNo(stage)}</span>
            </PxButton>
            <div className="grid grid-cols-2 gap-3">
              <PxButton onClick={p.onStory} className="py-3 text-[10px] text-sky-200">STORY</PxButton>
              <PxButton onClick={p.onAwards} className="py-3 text-[10px] text-sky-200">AWARDS</PxButton>
            </div>

            <Frame tone="dim" className="px-4 py-3 flex items-center justify-between">
              <span className="text-[9px] text-amber-400">HI-SCORE</span>
              <span className="text-sm text-amber-200">{p.highScore.toString().padStart(9, '0')}</span>
            </Frame>

            <Frame tone="dim" className="px-4 py-3">
              <div className="text-[9px] text-cyan-400 mb-2">CONTROLS</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[9px] leading-relaxed">
                <span className="text-white">MOVE</span><span className="text-slate-400">WASD / ARROWS / STICK</span>
                <span className="text-white">FIRE</span><span className="text-slate-400">SPACE / A</span>
                <span className="text-white">MISSILES</span><span className="text-slate-400">CTRL / B</span>
                <span className="text-white">PAUSE</span><span className="text-slate-400">ESC / P / START</span>
              </div>
            </Frame>

            <Frame tone="dim" className="px-4 py-3">
              <div className="text-[9px] text-cyan-400 mb-2">POWER-UPS</div>
              <div className="grid grid-cols-5 gap-1">
                {POWERUPS.map((x) => (
                  <div key={x.type} className="flex flex-col items-center gap-1">
                    <img src={sprites.pu[x.type]} alt="" className="px-img w-8 h-8" />
                    <span className="text-[7px] text-slate-300">{x.name}</span>
                  </div>
                ))}
              </div>
            </Frame>
          </div>

          {/* Right: loadout + stage select */}
          <div className="flex flex-col gap-4">
            <Frame className="p-3">
              <div className="text-[9px] text-cyan-400 mb-2 px-1">SELECT SHIP</div>
              <div className="grid grid-cols-2 gap-2">
                {SHIPS.map((s) => {
                  const isLocked = locked(s.unlock);
                  return (
                    <PxButton
                      key={s.id}
                      selected={!isLocked && p.selectedShip === s.id}
                      disabled={isLocked}
                      title={isLocked ? `UNLOCK: ${s.hint}` : s.desc}
                      onClick={() => p.onSelectShip(s.id)}
                      className="pl-5 pr-2 py-2 flex items-center gap-2 text-left"
                    >
                      {sprites.ship[s.id] && !isLocked
                        ? <img src={sprites.ship[s.id]!} alt="" className="px-img w-9 h-9 shrink-0" />
                        : <span className="w-9 h-9 shrink-0 flex items-center justify-center text-slate-600 text-[10px]">??</span>}
                      <span className="flex flex-col gap-1 min-w-0">
                        <span className={`text-[8px] ${isLocked ? 'text-slate-500' : 'text-white'}`}>{s.name}</span>
                        <span className={`text-[6px] leading-snug ${isLocked ? 'text-slate-600' : 'text-cyan-300/80'}`}>{isLocked ? s.hint : s.desc}</span>
                      </span>
                    </PxButton>
                  );
                })}
              </div>

              <div className="text-[9px] text-cyan-400 mt-4 mb-2 px-1">BEAM</div>
              <div className="grid grid-cols-4 gap-2">
                {BEAMS.map((b) => {
                  const isLocked = locked(b.unlock);
                  return (
                    <PxButton
                      key={b.id}
                      selected={!isLocked && p.selectedLaser === b.id}
                      disabled={isLocked}
                      title={isLocked ? `UNLOCK: ${b.hint}` : b.name}
                      onClick={() => p.onSelectLaser(b.id)}
                      className="py-2 flex flex-col items-center gap-1"
                    >
                      {sprites.beam[b.id] && !isLocked
                        ? <img src={sprites.beam[b.id]!} alt="" className="px-img h-5" />
                        : <span className="h-5 flex items-center text-slate-600 text-[8px]">??</span>}
                      <span className={`text-[6px] ${isLocked ? 'text-slate-600' : 'text-slate-200'}`}>{isLocked ? 'LOCKED' : b.name}</span>
                    </PxButton>
                  );
                })}
              </div>

              {p.unlocks.hardcore && (
                <PxButton tone={p.hardcoreMode ? 'red' : 'dim'} onClick={p.onToggleHardcore} className="w-full mt-4 py-2.5 text-[8px] flex items-center justify-between px-4">
                  <span className={p.hardcoreMode ? 'text-red-300' : 'text-slate-400'}>HARDCORE · 1 LIFE · MORE ENEMIES</span>
                  <span className={p.hardcoreMode ? 'text-red-200 px-blink' : 'text-slate-500'}>{p.hardcoreMode ? 'ON' : 'OFF'}</span>
                </PxButton>
              )}
            </Frame>

            <Frame className="p-3">
              <div className="text-[9px] text-cyan-400 mb-2 px-1">STAGE SELECT</div>
              <div className="flex flex-col gap-1.5">
                {STAGES.map((s) => (
                  <PxButton
                    key={s.id}
                    selected={stage === s.id}
                    onClick={() => setStage(s.id)}
                    className="pl-6 pr-3 py-2 flex items-center gap-3 text-left text-[9px]"
                  >
                    <span style={{ color: s.accent }}>{stageNo(s.id)}</span>
                    <span className={stage === s.id ? 'text-white' : 'text-slate-300'}>{s.name}</span>
                  </PxButton>
                ))}
              </div>
            </Frame>
          </div>
        </div>
      </div>
    </div>
  );
}

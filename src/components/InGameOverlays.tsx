/**
 * In-playfield arcade overlays: the READY card, the boss health bar and the
 * stage-clear card. All sizes are in `em` so they scale with the playfield
 * (1em = 16px at 800x600).
 */
import { useEffect, useState } from 'react';
import { Frame, PixelWord } from './ui/Pixel';
import { stageName, stageNo } from '../game/stages';

/** "STAGE 01 · EARTH CITY / READY" card. Light dim only: the scene stays visible. */
export function ReadyCard({ stage }: { stage: number }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none bg-black/25">
      <div className="w-full flex flex-col items-center">
        <div className="px-wipe w-full h-[0.25em] bg-cyan-300/80" />
        <div className="px-wipe w-full bg-[#050a1c]/85 py-[1.1em] flex flex-col items-center gap-[0.6em]">
          <div className="font-pixel text-[0.7em] text-cyan-300 tracking-[0.2em]">
            STAGE {stageNo(stage)} · {stageName(stage)}
          </div>
          <div className="px-drop">
            <PixelWord text="READY" style="chrome" scale={2} shear={4} height="4em" />
          </div>
        </div>
        <div className="px-wipe w-full h-[0.25em] bg-cyan-300/80" />
      </div>
    </div>
  );
}

export interface BossData {
  active: boolean; hp: number; maxHp: number; name: string; isExploding: boolean;
}

/**
 * Segmented boss health bar with a trailing "damage ghost": the pale bar
 * lags behind the real one, so each hit visibly chips a chunk off.
 */
export function BossBar({ boss }: { boss: BossData }) {
  const pct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
  const low = pct <= 25;
  const fill = boss.isExploding
    ? '#ffffff'
    : pct > 50 ? 'linear-gradient(#ffe27a 0 30%, #ff9a1f 30% 75%, #c8461a 75%)'
    : pct > 25 ? 'linear-gradient(#ffc06b 0 30%, #ff6a1f 30% 75%, #b52a14 75%)'
    : 'linear-gradient(#ff9a9a 0 30%, #ff2a3a 30% 75%, #8a0f1e 75%)';
  return (
    <div className="absolute top-[3em] left-1/2 -translate-x-1/2 w-[64%] z-30 pointer-events-none font-pixel">
      <div className="flex justify-between items-end mb-[0.35em] text-[0.55em]">
        <span className={`text-red-400 ${boss.isExploding ? '' : 'px-blink'}`}>{boss.isExploding ? 'CORE MELTDOWN' : '▲ WARNING ▲'}</span>
        <span className="text-white truncate ml-[1em]">{boss.name.toUpperCase()}</span>
      </div>
      <Frame tone="red" className="p-[0.3em]">
        <div className="relative h-[0.85em] bg-[#12040a] overflow-hidden">
          {/* Damage ghost (lags) */}
          <div className="absolute inset-y-0 left-0 bg-[#ffe9c9]" style={{ width: `${pct}%`, transition: 'width 0.55s steps(10) 0.25s' }} />
          {/* Real health */}
          <div
            className={`absolute inset-y-0 left-0 ${low && !boss.isExploding ? 'px-blink-fast' : ''}`}
            style={{ width: `${pct}%`, background: fill, transition: 'width 80ms steps(2)' }}
          />
          {/* Segment notches */}
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(90deg, transparent 0 calc(2.5% - 2px), rgba(0,0,0,0.55) calc(2.5% - 2px) 2.5%)' }} />
        </div>
      </Frame>
    </div>
  );
}

/** Counts a number up over `ms` (stepped, like an arcade tally). */
function useCountUp(target: number, ms = 1100, delay = 350) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(Math.round((Math.floor(k * 20) / 20) * target));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

/** Stage-clear card: slides in, tallies the bonus, announces the next stage. */
export function StageClearCard({ stage, bonus }: { stage: number; bonus: number }) {
  const shown = useCountUp(bonus);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/35">
      <div className="px-slide-in w-[66%]">
        <Frame tone="amber" className="px-[1.6em] py-[1.4em] flex flex-col items-center gap-[0.9em]">
          <div className="font-pixel text-[0.7em] text-amber-300 tracking-[0.2em]">STAGE {stageNo(stage)} · {stageName(stage)}</div>
          <PixelWord text="CLEAR!" style="gold" scale={2} shear={4} height="3.2em" />
          <div className="w-full h-[0.2em] bg-amber-400/40" />
          <div className="w-full flex justify-between font-pixel text-[0.7em]">
            <span className="text-slate-300">CLEAR BONUS</span>
            <span className="text-amber-200">+{shown.toLocaleString()}</span>
          </div>
          <div className="w-full flex justify-between font-pixel text-[0.6em]">
            <span className="text-slate-400">NEXT</span>
            <span className="text-cyan-300"><span className="px-blink">▶</span> {stageNo(stage + 1)} {stageName(stage + 1)}</span>
          </div>
        </Frame>
      </div>
    </div>
  );
}

/**
 * Hazard warning strip (asteroid field, meteor storm, missile defence):
 * hazard-striped bars, a blinking headline and a steady sub-line.
 */
export function WarningBanner({ title, sub, tone, low = false }: {
  title: string; sub: string; tone: 'amber' | 'red'; low?: boolean;
}) {
  const c = tone === 'amber'
    ? { stripe: '#f59e0b', text: 'text-amber-300', subText: 'text-amber-100/90' }
    : { stripe: '#ef4444', text: 'text-red-400', subText: 'text-red-100/90' };
  const stripes = { background: `repeating-linear-gradient(135deg, ${c.stripe} 0 0.5em, #0a0606 0.5em 1em)` };
  return (
    <div className={`absolute ${low ? 'top-[7em]' : 'top-[3.4em]'} left-1/2 -translate-x-1/2 w-[70%] z-30 pointer-events-none px-wipe`}>
      <div className="h-[0.5em]" style={stripes} />
      <div className="bg-[#0a0606]/90 py-[0.7em] flex flex-col items-center gap-[0.45em] font-pixel">
        <div className={`text-[0.8em] tracking-[0.15em] ${c.text} px-blink`}>▲ {title} ▲</div>
        <div className={`text-[0.5em] tracking-[0.1em] ${c.subText}`}>{sub}</div>
      </div>
      <div className="h-[0.5em]" style={stripes} />
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { AssetManager } from './game/AssetManager';
import { InputManager } from './game/InputManager';
import { AchievementManager, Achievement } from './game/AchievementManager';
import { SoundManager } from './game/SoundManager';
import { StoryModal } from './components/StoryModal';
import { TitleMenu } from './components/TitleMenu';
import { ReadyCard, BossBar, StageClearCard, WarningBanner } from './components/InGameOverlays';
import { Frame, PxButton, PixelWord } from './components/ui/Pixel';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  
  // High-frequency direct DOM refs for zero-re-render 60fps performance
  const scoreTextRef = useRef<HTMLSpanElement>(null);
  const highScoreTextRef = useRef<HTMLSpanElement>(null);
  const currentScoreVal = useRef(0);
  const currentHighScoreVal = useRef(0);
  const missileBarRef = useRef<HTMLDivElement>(null);
  const missileLabelRef = useRef<HTMLSpanElement>(null);

  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover' | 'victory'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [stage, setStage] = useState(1);
  const [clearedStageNotice, setClearedStageNotice] = useState<number | null>(null);
  const [bossData, setBossData] = useState<{ active: boolean; hp: number; maxHp: number; name: string; isExploding: boolean } | null>(null);
  const [asteroidWarning, setAsteroidWarning] = useState<'field' | 'storm' | null>(null);
  const [missileWarning, setMissileWarning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [paused, setPaused] = useState(false);
  // CSS size of the 4:3 playfield, fitted inside the window.
  const [playfield, setPlayfield] = useState({ w: 800, h: 600 });
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  // Customization Options
  const [selectedShip, setSelectedShip] = useState('player');
  const [selectedLaser, setSelectedLaser] = useState('bulletPlayer');
  const [hardcoreMode, setHardcoreMode] = useState(false);

  // Achievements and Story modals
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  
  // Unlocks checking
  const [unlocks, setUnlocks] = useState({
    stealth: false,
    dreadnought: false,
    goldenShip: false,
    laserGreen: false,
    laserPurple: false,
    laserRed: false,
    hardcore: false,
  });

  const checkUnlocks = () => {
    const achs = AchievementManager.achievements;
    setUnlocks({
      stealth: achs.perfect_stage?.unlocked || false,
      dreadnought: achs.boss_master?.unlocked || false,
      goldenShip: achs.golden_prospector?.unlocked || false,
      laserGreen: achs.enemy_1000?.unlocked || false,
      laserPurple: achs.score_500k?.unlocked || false,
      laserRed: achs.boss_slayer?.unlocked || false,
      hardcore: achs.boss_slayer?.unlocked || false,
    });
  };

  useEffect(() => {
    // Build the big procedural backdrops while the player is on the menu.
    AssetManager.prewarmInIdle();
    if (import.meta.env.DEV) (window as any).__assets = AssetManager; // dev-only, for profiling/tests
    AchievementManager.init((achievement) => {
      setToasts((prev) => [...prev, achievement]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== achievement.id));
      }, 4500);
      checkUnlocks();
    });
    setHighScore(AchievementManager.stats.highestScore);
    checkUnlocks();
  }, []);

  // Multi-touch Joystick Tracking
  const joyTouchIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joyPos, setJoyPos] = useState({ x: 0, y: 0 });


  useEffect(() => {
    const checkTouch = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /Mobi|Android|iPad|iPhone|iPod/i.test(navigator.userAgent) || window.innerWidth < 1024;
      setIsMobile(hasTouch);
    };

    checkTouch();

    const handleResize = () => checkTouch();
    window.addEventListener('resize', handleResize);

    // Fit the 4:3 playfield to whatever space the container has. Observing the
    // container (not the window) also catches the menu bar showing/hiding.
    const fitPlayfield = () => {
      const container = gameContainerRef.current;
      if (!container) return;
      const aspect = 800 / 600;
      let w = container.clientWidth;
      let h = container.clientHeight;
      if (w / h > aspect) {
        w = h * aspect;
      } else {
        h = w / aspect;
      }
      w = Math.floor(w);
      h = Math.floor(h);
      setPlayfield((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      gameRef.current?.resize(w, h);
    };
    const observer = new ResizeObserver(fitPlayfield);
    if (gameContainerRef.current) observer.observe(gameContainerRef.current);
    fitPlayfield();

    // Prevent multi-touch browser gestures, pinch-to-zoom, double-tap zoom, and panning
    const preventDefaultTouch = (e: Event) => {
      e.preventDefault();
    };

    const preventMultiTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('gesturestart', preventDefaultTouch, { passive: false });
    window.addEventListener('gesturechange', preventDefaultTouch, { passive: false });
    window.addEventListener('gestureend', preventDefaultTouch, { passive: false });
    document.addEventListener('touchmove', preventMultiTouchMove, { passive: false });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('gesturestart', preventDefaultTouch);
      window.removeEventListener('gesturechange', preventDefaultTouch);
      window.removeEventListener('gestureend', preventDefaultTouch);
      document.removeEventListener('touchmove', preventMultiTouchMove);
    };
  }, []);

  // Joystick pointer event handlers
  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyTouchIdRef.current !== null) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);

    joyTouchIdRef.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joyCenterRef.current = { x: centerX, y: centerY };

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const maxRadius = rect.width / 2;

    const nx = Math.max(-1, Math.min(1, dx / maxRadius));
    const ny = Math.max(-1, Math.min(1, dy / maxRadius));

    InputManager.virtualJoy = { x: nx, y: ny };
    setJoyPos({ x: nx, y: ny });
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyTouchIdRef.current !== e.pointerId) return;

    const centerX = joyCenterRef.current.x;
    const centerY = joyCenterRef.current.y;
    const rect = e.currentTarget.getBoundingClientRect();
    const maxRadius = rect.width / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    const nx = Math.max(-1, Math.min(1, dx / maxRadius));
    const ny = Math.max(-1, Math.min(1, dy / maxRadius));

    InputManager.virtualJoy = { x: nx, y: ny };
    setJoyPos({ x: nx, y: ny });
  };

  const handleJoyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyTouchIdRef.current === e.pointerId) {
      joyTouchIdRef.current = null;
      InputManager.virtualJoy = { x: 0, y: 0 };
      setJoyPos({ x: 0, y: 0 });
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const pauseIfPlaying = () => {
    if (gameState === 'playing') gameRef.current?.setPaused(true);
  };

  const quitToMenu = () => {
    SoundManager.playBloop();
    gameRef.current?.stop();
    setBossData(null);
    setAsteroidWarning(null);
    setMissileWarning(false);
    setClearedStageNotice(null);
    setGameState('menu');
  };

  const startGame = (stageParam?: number | React.SyntheticEvent) => {
    SoundManager.init();
    SoundManager.playBloop();

    const startStageNum = (typeof stageParam === 'number' && stageParam >= 1 && stageParam <= 5)
      ? stageParam 
      : (typeof stage === 'number' && stage >= 1 && stage <= 5 ? stage : 1);

    setGameState('playing');
    currentScoreVal.current = 0;
    currentHighScoreVal.current = Math.max(currentHighScoreVal.current, highScore);
    if (scoreTextRef.current) scoreTextRef.current.textContent = '0'.padStart(9, '0');
    setLives(hardcoreMode ? 1 : 3);
    setStage(startStageNum);
    setClearedStageNotice(null);
    setBossData(null);
    
    if (!gameRef.current && canvasRef.current) {
      gameRef.current = new Game();
      gameRef.current.init(canvasRef.current);
      // Dev-only handle for automated play-testing / debugging from the console.
      if (import.meta.env.DEV) (window as any).__game = gameRef.current;
      gameRef.current.resize(playfield.w, playfield.h);
    }
    
    if (gameRef.current) {
      // Callbacks
      gameRef.current.onScoreUpdate = (newScore) => {
        currentScoreVal.current = newScore;
        if (scoreTextRef.current) {
          scoreTextRef.current.textContent = newScore.toString().padStart(9, '0');
        }
        if (newScore > currentHighScoreVal.current) {
          currentHighScoreVal.current = newScore;
          if (highScoreTextRef.current) {
            highScoreTextRef.current.textContent = newScore.toString().padStart(9, '0');
          }
        }
      };
      gameRef.current.onLivesUpdate = setLives;
      gameRef.current.onMissileCooldownUpdate = (cooldown, maxCooldown) => {
        if (missileBarRef.current) {
          const pct = Math.min(100, Math.max(0, ((maxCooldown - cooldown) / maxCooldown) * 100));
          missileBarRef.current.style.width = `${pct}%`;
          if (cooldown > 0) {
            missileBarRef.current.className = 'h-full bg-gradient-to-r from-red-800 to-orange-500 shadow-[0_0_8px_#ff4400]';
          } else {
            missileBarRef.current.className = 'h-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_12px_#00ffcc] animate-pulse';
          }
        }
        if (missileLabelRef.current) {
          if (cooldown > 0) {
            missileLabelRef.current.textContent = `RELOADING (${cooldown.toFixed(1)}s)`;
            missileLabelRef.current.className = 'text-red-400';
          } else {
            missileLabelRef.current.textContent = 'READY [CTRL]';
            missileLabelRef.current.className = 'text-green-400';
          }
        }
      };
      gameRef.current.onWeaponLevelUpdate = setWeaponLevel;
      gameRef.current.onStageUpdate = setStage;
      // The game owns the READY phase timing (in game time, so it respects pause).
      gameRef.current.onReadyChange = (showing) => {
        setShowReady(showing);
        if (showing) SoundManager.playLaunchMission();
      };
      gameRef.current.onPauseChange = setPaused;
      gameRef.current.onBossHpUpdate = setBossData;
      gameRef.current.onAsteroidWarningUpdate = setAsteroidWarning;
      gameRef.current.onMissileWarningUpdate = setMissileWarning;
      gameRef.current.onStageClear = (cleared) => {
        setClearedStageNotice(cleared);
        setTimeout(() => setClearedStageNotice(null), 2400);
      };
      gameRef.current.onGameOver = (victory) => {
        setScore(currentScoreVal.current);
        setHighScore(AchievementManager.stats.highestScore);
        setGameState(victory ? 'victory' : 'gameover');
      };
      
      gameRef.current.reset(hardcoreMode, selectedShip, selectedLaser, startStageNum);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center overflow-hidden font-mono text-white select-none">
      
      <div className="w-full h-full bg-[#050505] overflow-hidden flex flex-col relative">
        {/* Scanlines / CRT effect */}
        <div className="absolute inset-0 pointer-events-none z-50" style={{ background: 'repeating-linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), repeating-linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%' }}></div>
        <div className="absolute inset-0 z-40 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] pointer-events-none"></div>

        {/* Game Canvas Container */}
        <div id="game-container" ref={gameContainerRef} className="flex-1 relative overflow-hidden bg-black flex items-center justify-center z-10">
          {/* 4:3 playfield. HUD sizes are in em; 1em = 16px at 800x600. */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
            style={{ width: playfield.w, height: playfield.h, fontSize: `${(playfield.w / 800) * 16}px` }}
          >
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="block w-full h-full relative z-10"
          />

          {/* In-game arcade HUD */}
          {gameState === 'playing' && (
            <div className="absolute inset-0 z-20 pointer-events-none font-pixel" style={{ textShadow: '0.12em 0.12em 0 #000' }}>
              <div className="absolute top-0 inset-x-0 flex items-start justify-between px-[0.9em] pt-[0.5em]">
                <div className="flex flex-col leading-none">
                  <span className="text-[0.6em] text-red-400">1P</span>
                  <span ref={scoreTextRef} className="text-[0.95em] text-white">
                    {currentScoreVal.current.toString().padStart(9, '0')}
                  </span>
                </div>
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[0.6em] text-amber-400">HI-SCORE</span>
                  <span ref={highScoreTextRef} className="text-[0.95em] text-amber-300">
                    {Math.max(highScore, currentHighScoreVal.current).toString().padStart(9, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-[0.6em]">
                  <div className="flex flex-col items-end leading-none gap-[0.25em]">
                    <span className="text-[0.6em] text-cyan-300">STAGE {stage}</span>
                    <div className="flex gap-[0.25em]">
                      {[...Array(Math.max(lives, 0))].map((_, i) => (
                        <span key={`life-${i}`} className="text-[0.85em] text-emerald-400 leading-none">▶</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => gameRef.current?.togglePause()}
                    className="pointer-events-auto text-[0.75em] px-[0.6em] py-[0.3em] bg-black/50 hover:bg-white/15 border border-white/30 rounded text-white cursor-pointer"
                    title="Pause (Esc / P)"
                  >
                    {paused ? '▶' : '❚❚'}
                  </button>
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 flex items-end justify-between px-[0.9em] pb-[0.6em]">
                <div className="flex flex-col leading-none gap-[0.3em]">
                  <span className="text-[0.6em] text-sky-300">PLASMA LV{weaponLevel}{weaponLevel === 3 ? ' MAX' : ''}</span>
                  <div className="flex gap-[0.2em]">
                    {[1, 2, 3].map((n) => (
                      <span key={`wpn-${n}`} className={`block w-[1.4em] h-[0.4em] rounded-[0.1em] ${n <= weaponLevel ? 'bg-sky-400 shadow-[0_0_0.4em_#38bdf8]' : 'bg-white/15'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end leading-none gap-[0.3em] w-[16em] whitespace-nowrap">
                  <div className="flex justify-between w-full text-[0.6em] ">
                    <span className="text-amber-400">MSL x{gameRef.current?.player?.missileCount || 4}{(gameRef.current?.player?.missileLevel ?? 1) >= 2 ? ' SUPER' : ''}</span>
                    <span ref={missileLabelRef} className="text-green-400">READY [CTRL]</span>
                  </div>
                  <div className="h-[0.45em] w-full bg-black/60 border border-white/20 rounded-[0.1em] overflow-hidden">
                    <div ref={missileBarRef} className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* READY card */}
          {gameState === 'playing' && showReady && <ReadyCard stage={stage} />}

          {gameState === 'playing' && bossData && bossData.active && <BossBar boss={bossData} />}

          {/* Asteroid Warning Overlay */}
          {gameState === 'playing' && asteroidWarning === 'field' && (
            <WarningBanner tone="amber" title="ASTEROID FIELD" sub="HEAVY ROCK AHEAD - SHOOT OR DODGE" />
          )}
          {gameState === 'playing' && asteroidWarning === 'storm' && (
            <WarningBanner tone="amber" title="METEOR STORM" sub="ROCKS INCOMING FROM ABOVE" low />
          )}

          {/* Missile Defence Warning Overlay */}
          {gameState === 'playing' && missileWarning && (
            <WarningBanner tone="red" title="MISSILE DEFENCE" sub="SURFACE LAUNCHERS DETECTED - EVADE" />
          )}

          {/* Stage clear card */}
          {clearedStageNotice && <StageClearCard stage={clearedStageNotice} bonus={clearedStageNotice * 5000} />}
          </div>

          {/* Title menu */}
          {gameState === 'menu' && (
            <TitleMenu
              highScore={highScore}
              unlocks={unlocks}
              selectedShip={selectedShip}
              selectedLaser={selectedLaser}
              hardcoreMode={hardcoreMode}
              onSelectShip={(id) => { SoundManager.init(); SoundManager.playBloop(); setSelectedShip(id); }}
              onSelectLaser={(id) => { SoundManager.init(); SoundManager.playBloop(); setSelectedLaser(id); }}
              onToggleHardcore={() => { SoundManager.init(); SoundManager.playBloop(); setHardcoreMode(!hardcoreMode); }}
              onStart={(n) => startGame(n)}
              onStory={() => { SoundManager.init(); SoundManager.playBloop(); setShowStoryModal(true); }}
              onAwards={() => { SoundManager.init(); SoundManager.playBloop(); setShowAchievementsModal(true); }}
            />
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-[#12030a]/80 flex items-center justify-center z-20 p-6 font-pixel">
              <Frame tone="red" className="w-full max-w-md px-8 py-8 flex flex-col items-center gap-6">
                <PixelWord text="GAME OVER" style="red" shear={3} height="clamp(36px, 7vh, 64px)" />
                <div className="w-full flex flex-col gap-3 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">SCORE</span><span className="text-white">{score.toString().padStart(9, '0')}</span></div>
                  <div className="flex justify-between"><span className="text-amber-400">HI-SCORE</span><span className="text-amber-200">{highScore.toString().padStart(9, '0')}</span></div>
                </div>
                <div className="w-full grid grid-cols-2 gap-3">
                  <PxButton tone="red" onClick={() => startGame(stage)} className="py-3 text-[9px] text-red-100">CONTINUE</PxButton>
                  <PxButton onClick={() => { SoundManager.playBloop(); setGameState('menu'); }} className="py-3 text-[9px] text-slate-200">TITLE</PxButton>
                </div>
              </Frame>
            </div>
          )}

          {gameState === 'playing' && paused && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-[60] p-6 font-pixel">
              <Frame tone="cyan" className="w-full max-w-sm px-8 py-8 flex flex-col items-center gap-6">
                <PixelWord text="PAUSED" style="chrome" shear={3} height="clamp(32px, 6vh, 56px)" />
                <div className="text-[8px] text-cyan-300/80 px-blink">ESC / P / START TO RESUME</div>
                <div className="w-full flex flex-col gap-3">
                  <PxButton tone="cyan" onClick={() => gameRef.current?.setPaused(false)} className="py-3 text-[10px] text-cyan-100">RESUME</PxButton>
                  <PxButton onClick={quitToMenu} className="py-3 text-[10px] text-slate-200">QUIT TO TITLE</PxButton>
                </div>
              </Frame>
            </div>
          )}

          {gameState === 'victory' && (
            <div className="absolute inset-0 bg-[#020818]/80 flex items-center justify-center z-20 p-6 font-pixel">
              <Frame tone="amber" className="w-full max-w-md px-8 py-8 flex flex-col items-center gap-6">
                <PixelWord text="EARTH SAVED" style="gold" shear={3} height="clamp(30px, 6vh, 56px)" />
                <div className="text-[8px] text-cyan-300">THE MOON CORE IS DESTROYED</div>
                <div className="w-full flex flex-col gap-3 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-400">SCORE</span><span className="text-amber-200">{score.toString().padStart(9, '0')}</span></div>
                  <div className="flex justify-between"><span className="text-amber-400">HI-SCORE</span><span className="text-amber-200">{highScore.toString().padStart(9, '0')}</span></div>
                </div>
                <div className="w-full grid grid-cols-2 gap-3">
                  <PxButton tone="amber" onClick={() => startGame(1)} className="py-3 text-[9px] text-amber-100">PLAY AGAIN</PxButton>
                  <PxButton onClick={() => { SoundManager.playBloop(); setGameState('menu'); }} className="py-3 text-[9px] text-slate-200">TITLE</PxButton>
                </div>
              </Frame>
            </div>
          )}

          {/* Achievements Toasts Container */}
          <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 pointer-events-none max-w-[320px] w-full">
            {toasts.map((toast) => (
              <div key={toast.id} className="px-slide-in">
                <Frame tone="amber" className="px-3 py-2.5 flex items-center gap-3 font-pixel">
                  <div className="text-2xl shrink-0">{toast.icon}</div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-[7px] text-amber-400 px-blink">ACHIEVEMENT UNLOCKED</div>
                    <div className="text-[9px] text-white truncate">{toast.title.toUpperCase()}</div>
                    <div className="text-[7px] text-amber-100/70 truncate leading-snug">{toast.description}</div>
                  </div>
                </Frame>
              </div>
            ))}
          </div>

          {/* Achievements Modal Overlay */}
          {showAchievementsModal && (
            <div className="absolute inset-0 bg-black/90 z-50 flex flex-col p-4 sm:p-6 backdrop-blur-md animate-fade-in">
              {/* Header */}
              <div className="flex justify-between items-center border-b-2 border-amber-500/40 pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <h2 className="text-2xl font-black text-amber-400 tracking-wider">PILOT ACHIEVEMENTS</h2>
                    <p className="text-xs text-gray-400">
                      UNLOCKED: {Object.values(AchievementManager.achievements).filter(a => a.unlocked).length} / {Object.keys(AchievementManager.achievements).length}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { SoundManager.init(); SoundManager.playBloop(); setShowAchievementsModal(false); }}
                  className="px-4 py-1.5 bg-red-900/60 hover:bg-red-800 border border-red-500 text-white font-bold text-sm rounded transition-all cursor-pointer"
                >
                  ✕ CLOSE
                </button>
              </div>

              {/* Progress Summary */}
              <div className="mb-4 bg-amber-950/30 border border-amber-500/30 p-3 rounded-lg flex items-center gap-4 shrink-0">
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-bold text-amber-300 mb-1">
                    <span>OVERALL COMPLETION</span>
                    <span>
                      {Math.round((Object.values(AchievementManager.achievements).filter(a => a.unlocked).length / Object.keys(AchievementManager.achievements).length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-black/60 border border-amber-500/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300 shadow-[0_0_10px_#f59e0b] transition-all duration-300"
                      style={{
                        width: `${(Object.values(AchievementManager.achievements).filter(a => a.unlocked).length / Object.keys(AchievementManager.achievements).length) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Grid List of Achievements */}
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-3 custom-scrollbar">
                {Object.values(AchievementManager.achievements).map((ach) => (
                  <div 
                    key={ach.id}
                    className={`p-3 rounded-lg border flex items-center gap-3.5 transition-all ${
                      ach.unlocked 
                        ? 'bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-black border-amber-400/70 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : 'bg-black/60 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className={`text-3xl p-2 rounded-full border shrink-0 ${ach.unlocked ? 'bg-amber-400/20 border-amber-400/60' : 'bg-gray-900 border-gray-800 grayscale'}`}>
                      {ach.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${ach.unlocked ? 'text-amber-300' : 'text-gray-400'}`}>
                          {ach.title}
                        </span>
                        {ach.unlocked && (
                          <span className="text-[10px] text-amber-400/90 font-mono bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                            UNLOCKED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 mt-0.5 leading-snug">{ach.description}</p>
                      
                      {!ach.unlocked && ach.maxProgress && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                            <span>PROGRESS</span>
                            <span>{(ach.progress || 0)} / {ach.maxProgress}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                            <div 
                              className="h-full bg-cyan-500"
                              style={{ width: `${Math.min(100, Math.max(0, ((ach.progress || 0) / ach.maxProgress) * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Story Modal Overlay */}
          {showStoryModal && (
            <StoryModal 
              onClose={() => setShowStoryModal(false)} 
              onStartGame={() => {
                setShowStoryModal(false);
                startGame(1);
              }} 
            />
          )}

          {/* Virtual Joypad for Mobile & Touch */}
          {gameState === 'playing' && isMobile && (
            <>
              <div 
                className="absolute bottom-6 left-6 w-36 h-36 bg-white/10 rounded-full border-2 border-white/30 z-30 touch-none select-none before:content-[''] before:absolute before:-inset-8 before:rounded-full"
                onPointerDown={handleJoyPointerDown}
                onPointerMove={handleJoyPointerMove}
                onPointerUp={handleJoyPointerUp}
                onPointerCancel={handleJoyPointerUp}
              >
                <div 
                  className="absolute w-14 h-14 bg-cyan-400/60 border-2 border-cyan-200 rounded-full shadow-[0_0_15px_rgba(0,255,255,0.6)] pointer-events-none transition-transform duration-75"
                  style={{
                    left: '50%', top: '50%',
                    transform: `translate(calc(-50% + ${joyPos.x * 45}px), calc(-50% + ${joyPos.y * 45}px))`
                  }}
                />
              </div>
              
              <div className="absolute bottom-8 right-8 flex flex-col gap-4 z-30 touch-none select-none">
                <button 
                  className="w-16 h-16 bg-amber-500/50 rounded-full border-4 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 active:bg-amber-400/80 touch-none select-none"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualBomb = true; }}
                  onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualBomb = false; }}
                  onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualBomb = false; }}
                  onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualBomb = false; }}
                >
                  <span className="font-bold text-[10px] tracking-tighter pointer-events-none select-none">MISSILE</span>
                </button>
                
                <button 
                  className="w-24 h-24 bg-red-500/50 rounded-full border-4 border-red-300 shadow-[0_0_20px_rgba(255,0,0,0.5)] active:scale-95 active:bg-red-400/80 touch-none select-none"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualFire = true; }}
                  onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualFire = false; }}
                  onPointerCancel={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualFire = false; }}
                  onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); InputManager.virtualFire = false; }}
                >
                  <span className="font-bold text-xl pointer-events-none select-none">FIRE</span>
                </button>
              </div>
            </>
          )}
        </div>


      </div>
    </div>
  );
}

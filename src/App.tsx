import React, { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { InputManager } from './game/InputManager';
import { AchievementManager, Achievement } from './game/AchievementManager';
import { SoundManager } from './game/SoundManager';
import { StoryModal } from './components/StoryModal';
import { CppArchitectureModal } from './components/CppArchitectureModal';

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
  const [missileState, setMissileState] = useState({ cooldown: 0, maxCooldown: 5.0 });
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [stage, setStage] = useState(1);
  const [clearedStageNotice, setClearedStageNotice] = useState<number | null>(null);
  const [bossData, setBossData] = useState<{ active: boolean; hp: number; maxHp: number; name: string; isExploding: boolean } | null>(null);
  const [asteroidWarning, setAsteroidWarning] = useState(false);
  const [missileWarning, setMissileWarning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showReady, setShowReady] = useState(false);
  
  // Customization Options
  const [selectedShip, setSelectedShip] = useState('player');
  const [selectedLaser, setSelectedLaser] = useState('bulletPlayer');
  const [hardcoreMode, setHardcoreMode] = useState(false);

  // Achievements, Story, and C++ WASM Architecture Modals
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showCppModal, setShowCppModal] = useState(false);
  
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

  const stageNames: Record<number, string> = {
    1: 'Stage 01: Earth City',
    2: 'Stage 02: Space',
    3: 'Stage 03: Lunar Base',
    4: 'Stage 04: Moon Core (Mother Brain)'
  };

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /Mobi|Android|iPad|iPhone|iPod/i.test(navigator.userAgent) || window.innerWidth < 1024;
      setIsMobile(hasTouch);
    };

    checkTouch();

    const handleResize = () => {
      checkTouch();
      const container = document.getElementById('game-container');
      const canvas = canvasRef.current;
      if (container && canvas) {
        const aspect = 800 / 600;
        let w = container.clientWidth;
        let h = container.clientHeight;
        
        if (w / h > aspect) {
          w = h * aspect;
        } else {
          h = w / aspect;
        }
        
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

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

  const startGame = (stageParam?: number | React.SyntheticEvent) => {
    SoundManager.init();
    SoundManager.playBloop();

    const startStageNum = (typeof stageParam === 'number' && stageParam >= 1 && stageParam <= 5)
      ? stageParam 
      : (typeof stage === 'number' && stage >= 1 && stage <= 5 ? stage : 1);

    setGameState('playing');
    currentScoreVal.current = 0;
    if (scoreTextRef.current) scoreTextRef.current.textContent = '0'.padStart(9, '0');
    setLives(hardcoreMode ? 1 : 3);
    setStage(startStageNum);
    setClearedStageNotice(null);
    setBossData(null);
    
    if (!gameRef.current && canvasRef.current) {
      gameRef.current = new Game();
      gameRef.current.init(canvasRef.current);
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
            missileLabelRef.current.className = 'text-red-400 animate-pulse font-black';
          } else {
            missileLabelRef.current.textContent = 'READY [CTRL]';
            missileLabelRef.current.className = 'text-green-400 font-black animate-pulse tracking-widest';
          }
        }
      };
      gameRef.current.onWeaponLevelUpdate = setWeaponLevel;
      gameRef.current.onStageUpdate = (s) => {
        setStage(s);
        setShowReady(true);
        SoundManager.playLaunchMission();
        if (gameRef.current) gameRef.current.isReadyPhase = true;
        setTimeout(() => {
          setShowReady(false);
          if (gameRef.current) gameRef.current.isReadyPhase = false;
        }, 2000);
      };
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
      
      <div className="w-full max-w-[1024px] h-full max-h-[768px] bg-[#050505] overflow-hidden flex flex-col relative shadow-2xl">
        {/* Scanlines / CRT effect */}
        <div className="absolute inset-0 pointer-events-none z-50" style={{ background: 'repeating-linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), repeating-linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%' }}></div>
        <div className="absolute inset-0 z-40 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] pointer-events-none"></div>

        {/* Top HUD */}
        <div className="h-14 bg-black/95 border-b-2 border-cyan-500/30 flex items-center justify-between px-4 sm:px-6 z-30 shrink-0 backdrop-blur-md">
          <div className="flex gap-4 sm:gap-8 items-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-red-400 font-bold tracking-widest leading-none uppercase">1P SCORE</span>
              <span ref={scoreTextRef} className="text-xl sm:text-2xl font-black tracking-widest text-white italic drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                {score.toString().padStart(9, '0')}
              </span>
            </div>
            <div className="hidden sm:flex flex-col border-l border-white/10 pl-6">
              <span className="text-[10px] text-amber-400 font-bold tracking-widest leading-none uppercase">HIGH SCORE</span>
              <span ref={highScoreTextRef} className="text-xl sm:text-2xl font-black tracking-widest text-amber-300 italic drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                {highScore.toString().padStart(9, '0')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 sm:gap-4">
            <button 
              onClick={() => { SoundManager.init(); SoundManager.playBloop(); setShowCppModal(true); }}
              className="px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-400/80 rounded-md text-cyan-300 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Inspect C++ / WASM Engine Core"
            >
              <span className="text-cyan-400 animate-pulse text-sm">⚡</span>
              <span className="hidden sm:inline uppercase tracking-wider">C++ / WASM</span>
            </button>
            <button 
              onClick={() => { SoundManager.init(); SoundManager.playBloop(); setShowAchievementsModal(true); }}
              className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-400/80 rounded-md text-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(251,191,36,0.3)] transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <span className="text-sm">🏆</span>
              <span className="hidden sm:inline uppercase tracking-wider">Awards</span>
            </button>
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
              <span className="text-[10px] text-emerald-400 font-black mr-1 hidden sm:inline tracking-wider">SHIPS</span>
              {[...Array(3)].map((_, i) => (
                <div 
                  key={`life-ui-${i}`} 
                  className={`w-3.5 h-4.5 rounded-xs transition-all duration-300 ${
                    i < lives 
                      ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_8px_#10b981] border border-emerald-300' 
                      : 'bg-gray-800/80 border border-gray-700 opacity-40'
                  }`}
                ></div>
              ))}
            </div>
            <div className="hidden md:flex px-3.5 py-1 bg-cyan-950/40 border border-cyan-500/40 rounded-md items-center">
              <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                {stageNames[stage] || `Stage 0${stage}`}
              </span>
            </div>
          </div>
        </div>

        {/* Game Canvas Container */}
        <div id="game-container" className="flex-1 relative overflow-hidden bg-black flex items-center justify-center z-10">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="block relative z-10"
            style={{ 
              imageRendering: 'pixelated'
            }}
          />

          {/* Ready Overlay */}
          {gameState === 'playing' && (
            <div 
              className={`absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none transition-all duration-1000 ${showReady ? 'opacity-100 bg-black/80 backdrop-blur-sm' : 'opacity-0 bg-transparent backdrop-blur-none'}`}
            >
              {showReady && <h1 className="text-8xl sm:text-9xl font-black italic text-cyan-400 tracking-[0.2em] drop-shadow-[0_0_30px_rgba(0,255,255,1)] animate-pulse">READY</h1>}
            </div>
          )}

          {gameState === 'playing' && bossData && bossData.active && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[88%] max-w-[500px] z-30 bg-black/85 border-2 border-red-600/90 p-2.5 rounded shadow-[0_0_25px_rgba(255,0,0,0.6)] backdrop-blur-xs">
              <div className="flex justify-between items-center mb-1 text-xs font-black tracking-widest">
                <span className="text-red-400 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  WARNING: {bossData.name}
                </span>
                <span className="text-yellow-400 font-mono">
                  {Math.ceil((bossData.hp / bossData.maxHp) * 100)}%
                </span>
              </div>
              <div className="h-4 w-full bg-[#1e0505] border border-red-900 rounded overflow-hidden relative shadow-inner">
                <div 
                  className={`h-full transition-all duration-100 ${
                    bossData.isExploding 
                      ? 'bg-amber-400 animate-pulse' 
                      : 'bg-gradient-to-r from-red-700 via-orange-500 to-yellow-400 shadow-[0_0_12px_#ff4400]'
                  }`}
                  style={{ width: `${Math.max(0, (bossData.hp / bossData.maxHp) * 100)}%` }}
                ></div>
                {bossData.isExploding && (
                  <div className="absolute inset-0 flex items-center justify-center font-black text-[10px] text-white uppercase tracking-widest bg-red-600/70 animate-bounce">
                    CRITICAL CORE EXPLOSION
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Asteroid Warning Overlay */}
          {gameState === 'playing' && asteroidWarning && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-[520px] bg-amber-950/95 border-2 border-amber-500 p-3 rounded-lg shadow-[0_0_35px_rgba(245,158,11,0.8)] text-center animate-pulse backdrop-blur-xs">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-black text-xs sm:text-sm tracking-widest uppercase">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>⚠️ WARNING: ASTEROID FIELD AHEAD ⚠️</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
              </div>
              <div className="text-amber-100 text-[11px] font-bold tracking-wider mt-1">
                HEAVILY ARMORED ASTEROIDS — DANGER OF COLLISION!
              </div>
            </div>
          )}

          {/* Missile Defence Warning Overlay */}
          {gameState === 'playing' && missileWarning && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-[520px] bg-red-950/95 border-2 border-red-500 p-3 rounded-lg shadow-[0_0_35px_rgba(239,68,68,0.9)] text-center animate-pulse backdrop-blur-xs">
              <div className="flex items-center justify-center gap-2 text-red-400 font-black text-xs sm:text-sm tracking-widest uppercase">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping"></span>
                <span>⚠️ WARNING: MISSILE DEFENCE AHEAD ⚠️</span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping"></span>
              </div>
              <div className="text-red-100 text-[11px] font-bold tracking-wider mt-1">
                SURFACE ROCKET LAUNCHERS DETECTED — EVASIVE ACTION ADVISED!
              </div>
            </div>
          )}

          {/* Stage Cleared Notice Overlay */}
          {clearedStageNotice && (
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-30 backdrop-blur-xs animate-fade-in">
              <div className="border-4 border-yellow-400 bg-black/90 px-8 py-6 rounded-lg text-center shadow-[0_0_40px_rgba(234,179,8,0.5)]">
                <h2 className="text-4xl sm:text-5xl font-black text-yellow-400 tracking-widest mb-2 animate-bounce">
                  STAGE 0{clearedStageNotice} CLEARED!
                </h2>
                <p className="text-cyan-300 text-lg font-bold tracking-wider mb-2">
                  CLEAR BONUS: +{(clearedStageNotice * 5000).toLocaleString()} PTS
                </p>
                <div className="w-full h-1 bg-yellow-400/50 my-2"></div>
                <p className="text-gray-300 text-xs tracking-widest animate-pulse uppercase">
                  WARPING TO STAGE 0{clearedStageNotice + 1}...
                </p>
              </div>
            </div>
          )}

          {/* Menus */}
          {gameState === 'menu' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-start sm:justify-center z-20 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              
              {/* Epic Title Graphic & Orbit Projection */}
              <div className="relative mb-6 w-full max-w-xl flex flex-col items-center mt-4 sm:mt-0 flex-shrink-0">
                {/* Holographic Earth Projection Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-br from-cyan-500/20 via-blue-900/40 to-black border border-cyan-500/30 opacity-70 shadow-[inset_-15px_-15px_50px_rgba(0,0,0,0.9),_0_0_60px_rgba(6,182,212,0.25)] pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-cyan-400/20 pointer-events-none animate-spin" style={{ animationDuration: '60s' }}></div>
                
                {/* Title */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="text-[11px] sm:text-xs font-black tracking-[0.4em] text-cyan-400 uppercase mb-1 drop-shadow-[0_0_8px_#06b6d4]">
                    TACTICAL ARCADE SPACE DEFENSE
                  </div>
                  <h1 className="text-6xl sm:text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-400 tracking-tighter drop-shadow-[0_6px_20px_rgba(6,182,212,0.6)] italic pr-2" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.6)' }}>
                    EARTH
                  </h1>
                  <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-t from-red-600 via-amber-500 to-yellow-300 tracking-widest drop-shadow-[0_0_25px_rgba(245,158,11,0.8)] -mt-2 sm:-mt-4" style={{ WebkitTextStroke: '2px rgba(180,0,0,0.8)' }}>
                    DEFENDER
                  </h1>
                </div>

                {/* Subtitle Badge */}
                <div className="relative z-10 mt-3 px-5 py-1 bg-black/80 border border-cyan-400/60 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.4)] backdrop-blur-md">
                  <span className="text-cyan-300 font-bold tracking-[0.3em] text-xs sm:text-sm">THE LAST STAND</span>
                </div>
              </div>

              {/* Controls Callout Bar */}
              <div className="mb-5 px-4 py-1.5 bg-black/60 border border-white/10 rounded-full text-gray-300 text-center text-xs tracking-wider flex-shrink-0 flex items-center gap-2 sm:gap-4">
                <span className="text-cyan-400 font-bold">CONTROLS:</span>
                <span>WASD / Arrows to Move</span>
                <span className="text-gray-600">|</span>
                <span>Space to Shoot</span>
                <span className="text-gray-600">|</span>
                <span>Ctrl / K for Missiles</span>
              </div>
              
              {/* Tactical Powerup Matrix */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-5 p-3 rounded-xl bg-black/60 border border-cyan-500/20 w-full max-w-2xl flex-shrink-0 backdrop-blur-sm">
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-fuchsia-950/20 border border-fuchsia-500/30">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-400 to-fuchsia-700 flex items-center justify-center font-black text-xs text-white shadow-[0_0_8px_#d946ef] border border-fuchsia-300 mb-1">
                    P
                  </div>
                  <span className="text-fuchsia-300 text-[10px] font-bold uppercase tracking-wider">Plasma</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/30">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black text-xs text-white shadow-[0_0_8px_#06b6d4] border border-cyan-300 mb-1">
                    S
                  </div>
                  <span className="text-cyan-300 text-[10px] font-bold uppercase tracking-wider">Shield</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center font-black text-xs text-white shadow-[0_0_8px_#10b981] border border-emerald-300 mb-1">
                    D
                  </div>
                  <span className="text-emerald-300 text-[10px] font-bold uppercase tracking-wider">Drone</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-amber-950/20 border border-amber-500/30">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center font-black text-xs text-white shadow-[0_0_8px_#f59e0b] border border-amber-300 mb-1">
                    M
                  </div>
                  <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">+Missile</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-rose-950/20 border border-rose-500/30">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-rose-700 flex items-center justify-center font-black text-xs text-white shadow-[0_0_8px_#f43f5e] border border-rose-300 mb-1">
                    U
                  </div>
                  <span className="text-rose-300 text-[10px] font-bold uppercase tracking-wider">Warhead</span>
                </div>
              </div>

              {/* Loadout Selection Section */}
              <div className="bg-black/70 border border-cyan-500/30 p-4 rounded-xl mb-6 w-full max-w-2xl flex flex-col gap-4 flex-shrink-0 backdrop-blur-sm shadow-[0_0_20px_rgba(0,0,0,0.6)]">
                <div className="flex flex-col sm:flex-row gap-5 items-stretch sm:items-center justify-between">
                  {/* Ship Class Selection */}
                  <div className="flex-1 flex flex-col gap-2">
                    <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
                      <span>🚀</span> <span>CHASSIS CLASS</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedShip('player'); }} 
                        className={`px-2.5 py-2 border rounded-lg text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                          selectedShip === 'player' 
                            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)]' 
                            : 'bg-black/60 border-gray-800 text-gray-400 hover:border-cyan-500/50 hover:text-gray-200'
                        }`}
                      >
                        <span className="font-black text-[11px] text-white">BASE FIGHTER</span>
                        <span className="text-[9px] text-cyan-400/80">Balanced Interceptor</span>
                      </button>
                      
                      {unlocks.goldenShip ? (
                        <button 
                          onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedShip('player_gold'); }} 
                          className={`px-2.5 py-2 border rounded-lg text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                            selectedShip === 'player_gold' 
                              ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                              : 'bg-black/60 border-amber-600/40 text-amber-400/80 hover:border-amber-400'
                          }`}
                        >
                          <span className="font-black text-[11px] text-amber-300">✨ GOLD FIGHTER</span>
                          <span className="text-[9px] text-amber-400/80">Prismatic Alloy</span>
                        </button>
                      ) : (
                        <div className="px-2.5 py-2 border rounded-lg text-xs font-bold bg-black/40 border-gray-900 text-gray-600 cursor-not-allowed flex flex-col" title="Unlock by destroying the Golden Asteroid in Space">
                          <span className="text-[11px] font-black flex items-center gap-1"><span>🔒</span> GOLD FIGHTER</span>
                          <span className="text-[9px] text-gray-600">Golden Asteroid Award</span>
                        </div>
                      )}

                      {unlocks.stealth ? (
                        <button 
                          onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedShip('player_stealth'); }} 
                          className={`px-2.5 py-2 border rounded-lg text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                            selectedShip === 'player_stealth' 
                              ? 'bg-purple-950/80 border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]' 
                              : 'bg-black/60 border-gray-800 text-gray-400 hover:border-purple-500/50 hover:text-gray-200'
                          }`}
                        >
                          <span className="font-black text-[11px] text-purple-300">STEALTH PHANTOM</span>
                          <span className="text-[9px] text-purple-400/80">Radar Evasion</span>
                        </button>
                      ) : (
                        <div className="px-2.5 py-2 border rounded-lg text-xs font-bold bg-black/40 border-gray-900 text-gray-600 cursor-not-allowed flex flex-col" title="Unlock by clearing any stage with 0 damage">
                          <span className="text-[11px] font-black flex items-center gap-1"><span>🔒</span> STEALTH</span>
                          <span className="text-[9px] text-gray-600">Perfect Stage Award</span>
                        </div>
                      )}

                      {unlocks.dreadnought ? (
                        <button 
                          onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedShip('player_dreadnought'); }} 
                          className={`px-2.5 py-2 border rounded-lg text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                            selectedShip === 'player_dreadnought' 
                              ? 'bg-orange-950/80 border-orange-400 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.4)]' 
                              : 'bg-black/60 border-gray-800 text-gray-400 hover:border-orange-500/50 hover:text-gray-200'
                          }`}
                        >
                          <span className="font-black text-[11px] text-orange-300">DREADNOUGHT</span>
                          <span className="text-[9px] text-orange-400/80">Heavy Armor Plating</span>
                        </button>
                      ) : (
                        <div className="px-2.5 py-2 border rounded-lg text-xs font-bold bg-black/40 border-gray-900 text-gray-600 cursor-not-allowed flex flex-col" title="Unlock by defeating 10 Bosses">
                          <span className="text-[11px] font-black flex items-center gap-1"><span>🔒</span> DREADNOUGHT</span>
                          <span className="text-[9px] text-gray-600">Fleet Commander Award</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Beam Emitter Tuning */}
                  <div className="sm:w-48 flex flex-col gap-2">
                    <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
                      <span>⚡</span> <span>ION FREQUENCY</span>
                    </span>
                    <div className="flex gap-2.5 items-center">
                      <button 
                        onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedLaser('bulletPlayer'); }} 
                        className={`w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer ${
                          selectedLaser === 'bulletPlayer' 
                            ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_12px_#06b6d4]' 
                            : 'border-gray-700 bg-cyan-950/20 hover:border-cyan-500'
                        }`}
                        title="Cyan Ion Beam"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-400"></div>
                      </button>
                      
                      {unlocks.laserGreen ? (
                        <button 
                          onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedLaser('bulletPlayer_green'); }} 
                          className={`w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer ${
                            selectedLaser === 'bulletPlayer_green' 
                              ? 'border-emerald-400 bg-emerald-500/40 shadow-[0_0_12px_#10b981]' 
                              : 'border-gray-700 bg-emerald-950/20 hover:border-emerald-500'
                          }`}
                          title="Plasma Green Beam"
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-400"></div>
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-lg border border-gray-800 bg-black/60 flex items-center justify-center text-[10px] text-gray-700 cursor-not-allowed" title="Unlock: 1,000 Enemies Destroyed">🔒</div>
                      )}
                      
                      {unlocks.laserPurple ? (
                        <button 
                          onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedLaser('bulletPlayer_purple'); }} 
                          className={`w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer ${
                            selectedLaser === 'bulletPlayer_purple' 
                              ? 'border-purple-400 bg-purple-500/40 shadow-[0_0_12px_#a855f7]' 
                              : 'border-gray-700 bg-purple-950/20 hover:border-purple-500'
                          }`}
                          title="Antimatter Violet Beam"
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-purple-400"></div>
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-lg border border-gray-800 bg-black/60 flex items-center justify-center text-[10px] text-gray-700 cursor-not-allowed" title="Unlock: 500,000 Pts Score">🔒</div>
                      )}

                      {unlocks.laserRed ? (
                        <button 
                          onClick={() => { SoundManager.init(); SoundManager.playBloop(); setSelectedLaser('bulletPlayer_red'); }} 
                          className={`w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer ${
                            selectedLaser === 'bulletPlayer_red' 
                              ? 'border-rose-400 bg-rose-500/40 shadow-[0_0_12px_#f43f5e]' 
                              : 'border-gray-700 bg-rose-950/20 hover:border-rose-500'
                          }`}
                          title="Crimson Super-Laser"
                        >
                          <div className="w-3.5 h-3.5 rounded-full bg-rose-400"></div>
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded-lg border border-gray-800 bg-black/60 flex items-center justify-center text-[10px] text-gray-700 cursor-not-allowed" title="Unlock: Defeat 1 Boss">🔒</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hardcore Mode Option */}
                {unlocks.hardcore && (
                  <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-red-400 font-black text-xs tracking-wider block flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        HARDCORE SIMULATION PROTOCOL
                      </span>
                      <span className="text-[10px] text-gray-400">Single Hull (1 Life), Accelerated Swarm Spawns</span>
                    </div>
                    <button 
                      onClick={() => { SoundManager.init(); SoundManager.playBloop(); setHardcoreMode(!hardcoreMode); }}
                      className={`px-4 py-1.5 rounded-md font-black text-xs transition-all border cursor-pointer ${
                        hardcoreMode 
                          ? 'bg-red-950/90 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse' 
                          : 'bg-black/60 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {hardcoreMode ? 'PROTOCOL ACTIVE' : 'DISABLED'}
                    </button>
                  </div>
                )}
              </div>

              {/* Main Command Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-2xl mb-5 flex-shrink-0">
                <button 
                  onClick={() => startGame(1)}
                  className="w-full sm:flex-1 py-3.5 px-8 bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xl border-2 border-cyan-300 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all transform hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>🚀</span>
                  <span>LAUNCH MISSION</span>
                </button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => { SoundManager.init(); SoundManager.playBloop(); setShowCppModal(true); }}
                    className="flex-1 sm:flex-none px-4 py-3.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 font-bold text-xs sm:text-sm border border-cyan-400/80 rounded-xl shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105"
                  >
                    <span className="text-cyan-400">⚡</span>
                    <span>C++ / WASM</span>
                  </button>
                  <button 
                    onClick={() => { SoundManager.init(); SoundManager.playBloop(); setShowStoryModal(true); }}
                    className="flex-1 sm:flex-none px-4 py-3.5 bg-yellow-950/80 hover:bg-yellow-900 text-yellow-300 font-bold text-xs sm:text-sm border border-yellow-400/80 rounded-xl shadow-[0_0_12px_rgba(234,179,8,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105"
                  >
                    <span>📼</span>
                    <span>STORY</span>
                  </button>
                  <button 
                    onClick={() => { SoundManager.init(); SoundManager.playBloop(); setShowAchievementsModal(true); }}
                    className="flex-1 sm:flex-none px-4 py-3.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 font-bold text-xs sm:text-sm border border-amber-400/80 rounded-xl shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-105"
                  >
                    <span>🏆</span>
                    <span>AWARDS</span>
                  </button>
                </div>
              </div>

              {/* Tactical Deployment Sector Selection */}
              <div className="flex flex-col items-center gap-2 mb-6 bg-black/60 border border-cyan-500/20 p-3 px-4 rounded-xl w-full max-w-2xl flex-shrink-0">
                <div className="w-full flex justify-between items-center text-[10px] text-cyan-400 font-bold tracking-widest uppercase">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>DEPLOYMENT SECTOR SELECTION</span>
                  </span>
                  <span className="text-gray-500">DIRECT WARP INGRESS</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full">
                  <button
                    onClick={() => startGame(1)}
                    className="px-2 py-2 bg-blue-950/50 hover:bg-blue-800 border border-blue-400/60 text-blue-100 font-bold text-xs rounded-lg transition-all cursor-pointer hover:scale-102 flex flex-col items-center"
                  >
                    <span className="text-[9px] text-blue-300">SECTOR 01</span>
                    <span className="truncate">Earth Orbit</span>
                  </button>
                  <button
                    onClick={() => startGame(2)}
                    className="px-2 py-2 bg-indigo-950/50 hover:bg-indigo-800 border border-indigo-400/60 text-indigo-100 font-bold text-xs rounded-lg transition-all cursor-pointer hover:scale-102 flex flex-col items-center"
                  >
                    <span className="text-[9px] text-indigo-300">SECTOR 02</span>
                    <span className="truncate">Asteroid Belt</span>
                  </button>
                  <button
                    onClick={() => startGame(3)}
                    className="px-2 py-2 bg-amber-950/50 hover:bg-amber-800 border border-amber-400/60 text-amber-100 font-bold text-xs rounded-lg transition-all cursor-pointer hover:scale-102 flex flex-col items-center"
                  >
                    <span className="text-[9px] text-amber-300">SECTOR 03</span>
                    <span className="truncate">Lunar Orbit</span>
                  </button>
                  <button
                    onClick={() => startGame(4)}
                    className="px-2 py-2 bg-purple-950/50 hover:bg-purple-800 border border-purple-400/60 text-purple-100 font-bold text-xs rounded-lg transition-all cursor-pointer hover:scale-102 flex flex-col items-center"
                  >
                    <span className="text-[9px] text-purple-300">SECTOR 04</span>
                    <span className="truncate">Moon Surface</span>
                  </button>
                  <button
                    onClick={() => startGame(5)}
                    className="col-span-2 sm:col-span-1 px-2 py-2 bg-rose-950/50 hover:bg-rose-800 border border-rose-400/60 text-rose-100 font-bold text-xs rounded-lg transition-all cursor-pointer hover:scale-102 flex flex-col items-center"
                  >
                    <span className="text-[9px] text-rose-300">SECTOR 05</span>
                    <span className="truncate">Moon Core</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center z-20 backdrop-blur-md p-6">
              <div className="border-2 border-red-500/80 bg-black/85 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.6)] flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-3xl mb-3 animate-pulse">
                  💥
                </div>
                <h1 className="text-5xl font-black text-red-500 mb-2 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] tracking-tight">
                  HULL DESTROYED
                </h1>
                <p className="text-red-300/80 text-xs uppercase tracking-widest mb-6">MISSION TERMINATION RECORD</p>
                
                <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 w-full mb-6 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>FINAL SCORE:</span>
                    <span className="font-black text-white">{score.toLocaleString()} PTS</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-300">
                    <span>ALL-TIME RECORD:</span>
                    <span className="font-black">{highScore.toLocaleString()} PTS</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => startGame(stage)}
                    className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm border border-red-300 rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                  >
                    RELAUNCH SECTOR
                  </button>
                  <button 
                    onClick={() => { SoundManager.playBloop(); setGameState('menu'); }}
                    className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-gray-200 font-black text-sm border border-gray-700 rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState === 'victory' && (
            <div className="absolute inset-0 bg-cyan-950/90 flex flex-col items-center justify-center z-20 backdrop-blur-md p-6">
              <div className="border-2 border-yellow-400/80 bg-black/85 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_50px_rgba(234,179,8,0.5)] flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-yellow-400/20 border-2 border-yellow-400 flex items-center justify-center text-3xl mb-3 animate-bounce">
                  🏆
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-yellow-400 mb-2 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] tracking-tight">
                  EARTH SAVED
                </h1>
                <p className="text-cyan-300 text-xs uppercase tracking-widest mb-6">MOTHER BRAIN DESTROYED</p>
                
                <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-4 w-full mb-6 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-cyan-200">
                    <span>VICTORY SCORE:</span>
                    <span className="font-black text-yellow-300">{score.toLocaleString()} PTS</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-300">
                    <span>RECORD:</span>
                    <span className="font-black">{highScore.toLocaleString()} PTS</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => startGame(1)}
                    className="flex-1 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm border border-cyan-300 rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                  >
                    PLAY AGAIN
                  </button>
                  <button 
                    onClick={() => { SoundManager.playBloop(); setGameState('menu'); }}
                    className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-gray-200 font-black text-sm border border-gray-700 rounded-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Achievements Toasts Container */}
          <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 pointer-events-none max-w-[320px] w-full">
            {toasts.map((toast) => (
              <div 
                key={toast.id}
                className="bg-gradient-to-r from-amber-950/95 via-purple-950/95 to-black/95 border-2 border-amber-400 p-3 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.6)] text-white flex items-center gap-3 animate-bounce backdrop-blur-md"
              >
                <div className="text-3xl shrink-0 p-1.5 bg-amber-400/20 rounded-full border border-amber-400/50">
                  {toast.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-amber-300 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    ACHIEVEMENT UNLOCKED!
                  </div>
                  <div className="text-sm font-bold text-white truncate">{toast.title}</div>
                  <div className="text-[11px] text-amber-100/80 truncate leading-tight">{toast.description}</div>
                </div>
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

          {/* C++ & WebAssembly Architecture Modal */}
          {showCppModal && (
            <CppArchitectureModal 
              onClose={() => setShowCppModal(false)} 
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

        {/* Bottom HUD */}
        <div className="h-20 bg-black border-t-2 border-[#333] flex items-center px-6 z-30 gap-6 shrink-0">
          <div className="hidden sm:flex flex-col w-44">
            <div className="flex justify-between text-[10px] text-[#00d4ff] mb-1 font-bold">
              <span>WEAPON: PLASMA BEAM</span>
              <span>LV. 0{weaponLevel} {weaponLevel === 3 ? '(MAX)' : ''}</span>
            </div>
            <div className="h-3 w-full bg-[#111] border border-[#333] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#0055ff] to-[#00d4ff] shadow-[0_0_10px_#00d4ff] transition-all duration-300"
                style={{ width: `${(weaponLevel / 3) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {/* Missile Status Bar in HUD */}
          <div className="flex-1 max-w-[280px] flex flex-col">
            <div className="flex justify-between text-[10px] font-bold mb-1">
              <span className="text-amber-400 tracking-wider">
                MISSILES (x{gameRef.current?.player?.missileCount || 4}){gameRef.current?.player?.missileLevel && gameRef.current.player.missileLevel >= 2 ? ' [SUPER]' : ''}
              </span>
              <span ref={missileLabelRef} className={missileState.cooldown > 0 ? "text-red-400 animate-pulse font-black" : "text-green-400 font-black animate-pulse tracking-widest"}>
                {missileState.cooldown > 0 ? `RELOADING (${missileState.cooldown.toFixed(1)}s)` : 'READY [CTRL]'}
              </span>
            </div>
            <div className="h-3.5 w-full bg-[#111] border border-[#444] rounded overflow-hidden relative shadow-inner">
              <div 
                ref={missileBarRef}
                className={`h-full ${
                  missileState.cooldown > 0
                    ? 'bg-gradient-to-r from-red-800 to-orange-500 shadow-[0_0_8px_#ff4400]'
                    : 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_12px_#00ffcc] animate-pulse'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(0, ((missileState.maxCooldown - missileState.cooldown) / missileState.maxCooldown) * 100))}%`
                }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 ml-auto">
            <div className="hidden md:flex flex-col items-end text-[11px] text-gray-400">
              <span className="font-bold text-cyan-400">STARFIGHTER OS v2.4</span>
              <span>SYSTEMS NOMINAL</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

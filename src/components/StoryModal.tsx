import React, { useState, useEffect } from 'react';
import { SoundManager } from '../game/SoundManager';

interface StoryModalProps {
  onClose: () => void;
  onStartGame: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({ onClose, onStartGame }) => {
  const [fastForward, setFastForward] = useState(false);

  useEffect(() => {
    SoundManager.init();
    SoundManager.playBloop();
  }, []);

  return (
    <div className="absolute inset-0 bg-black/95 z-50 flex flex-col overflow-hidden text-yellow-400 font-mono backdrop-blur-md">
      {/* Background Starfield effect */}
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950 via-black to-black pointer-events-none"></div>

      {/* Header Controls */}
      <div className="relative z-20 flex justify-between items-center p-4 sm:p-6 bg-gradient-to-b from-black via-black/80 to-transparent shrink-0 border-b border-yellow-500/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">📼</span>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-yellow-400 tracking-widest drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">
              MISSION BRIEFING
            </h2>
            <p className="text-[10px] sm:text-xs text-yellow-200/70 tracking-wider">
              TOP SECRET // ULTRA CLEARANCE REQUIRED
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              SoundManager.init();
              SoundManager.playBloop();
              onStartGame();
            }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm border-2 border-cyan-300 rounded shadow-[0_0_15px_rgba(0,255,255,0.6)] transition-all cursor-pointer hover:scale-105 flex items-center gap-1.5"
          >
            <span>🚀</span>
            <span>LAUNCH MISSION</span>
          </button>
          
          <button
            onClick={() => {
              SoundManager.init();
              SoundManager.playBloop();
              onClose();
            }}
            className="px-3.5 py-2 bg-red-950/80 hover:bg-red-800 border border-red-500 text-red-200 font-bold text-xs sm:text-sm rounded transition-all cursor-pointer"
          >
            ✕ CLOSE
          </button>
        </div>
      </div>

      {/* Star Wars Crawl Window */}
      <div 
        className="relative flex-1 overflow-hidden flex justify-center cursor-pointer select-none"
        style={{ perspective: '550px', perspectiveOrigin: '50% 100%' }}
        onMouseDown={() => setFastForward(true)}
        onMouseUp={() => setFastForward(false)}
        onTouchStart={() => setFastForward(true)}
        onTouchEnd={() => setFastForward(false)}
      >
        {/* Fade gradient top/bottom for cinematic horizon exit */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black via-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />

        {/* 3D Angled Text Plane */}
        <div 
          className="w-full max-w-2xl px-6 text-center transform-gpu"
          style={{
            transform: 'rotateX(12deg)',
            transformOrigin: '50% 100%'
          }}
        >
          <div 
            className={`crawl-content ${fastForward ? 'crawl-fast' : 'crawl-normal'}`}
          >
            <div className="text-center font-black tracking-widest mb-12 uppercase text-yellow-300 text-lg sm:text-2xl drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">
              EARTH DEFENDER : THE LAST STAND 
            </div>

            <p className="text-xl sm:text-3xl font-extrabold text-amber-300 tracking-wider mb-8 leading-snug drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]">
              EARTH IS UNDER SIEGE!
            </p>

            <p className="text-base sm:text-xl font-bold leading-relaxed text-yellow-200 mb-8 tracking-wide">
              FROM THE DARK, UNMAPPED CAVERNS OF THE MOON&apos;S CORE, AN ANCIENT BIOMECHANICAL ALIEN HIVE HAS AWAKENED FROM EONS OF SLUMBER!
            </p>

            <p className="text-base sm:text-xl font-bold leading-relaxed text-yellow-200 mb-8 tracking-wide">
              WITHOUT WARNING, A NIGHTMARISH FLEET OF ALIEN FIGHTERS AND HEAVY ARMORED CRUISERS BURST FROM THE CRATERS, RAINING PLASMA FIRE UPON EARTH&apos;S MEGAPOLIS CITIES.
            </p>

            <p className="text-base sm:text-xl font-bold leading-relaxed text-yellow-100 mb-8 tracking-wide">
              PLANETARY DEFENSES WERE PULVERIZED IN MINUTES. BLUE SQUADRON HAS BEEN DESTROYED. WORLD GOVERNMENTS ARE IN TOTAL PARALYSIS.
            </p>

            <p className="text-lg sm:text-2xl font-black text-amber-400 mb-10 tracking-widest drop-shadow-[0_0_12px_rgba(251,191,36,0.8)] uppercase">
              YOU ARE HUMANITY&apos;S LAST HOPE.
            </p>

            <p className="text-base sm:text-xl font-bold leading-relaxed text-yellow-200 mb-8 tracking-wide">
              AS CHIEF TEST PILOT OF THE PROTOTYPE <span className="text-cyan-300 font-extrabold">MK-IV STARFIGHTER</span>, YOU MUST SINGLE-HANDEDLY STEM THE TIDE OF DESTRUCTION.
            </p>

            <div className="border-t-2 border-b-2 border-yellow-500/50 py-6 my-8 bg-yellow-950/20 rounded-xl">
              <h3 className="text-lg sm:text-xl font-black text-amber-300 tracking-widest mb-4 uppercase">
                ⚡ PRIMARY DIRECTIVES ⚡
              </h3>
              
              <div className="text-left max-w-lg mx-auto space-y-4 text-sm sm:text-base font-bold text-yellow-100">
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">01.</span>
                  <span><strong className="text-cyan-300">CLEANSING THE ATMOSPHERE:</strong> Blast through hostile interceptor waves above Earth&apos;s burning skyline.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">02.</span>
                  <span><strong className="text-cyan-300">DEEP SPACE OFFENSIVE:</strong> Annihilate dense asteroid storms and hunt rare golden asteroids.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">03.</span>
                  <span><strong className="text-amber-300">LUNAR APPROACH:</strong> Infiltrate high lunar orbit, engage elite defender squadrons against the looming moon, and defeat the Orbital Overlord.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">04.</span>
                  <span><strong className="text-cyan-300">LUNAR SURFACE:</strong> Dodge heavy surface missile launchers and locate the subterranean blast doors into the moon.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">05.</span>
                  <span><strong className="text-pink-400">BIOMECHANICAL CORE:</strong> Navigate subterranean caverns, infiltrate the alien factory, and destroy the Mother Brain Organism!</span>
                </p>
              </div>
            </div>

            <p className="text-xl sm:text-2xl font-black text-red-400 tracking-widest mt-12 mb-16 uppercase drop-shadow-[0_0_15px_rgba(248,113,113,0.9)] animate-pulse">
              LOCK AND LOAD, PILOT! THE FATE OF EARTH RESTS ON YOU
            </p>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="p-3 bg-black/90 border-t border-yellow-500/20 text-center text-[11px] text-yellow-400/70 font-mono shrink-0">
        💡 <span className="text-yellow-200">HOLD CLICK / TOUCH</span> TO FAST FORWARD TEXT
      </div>
    </div>
  );
};

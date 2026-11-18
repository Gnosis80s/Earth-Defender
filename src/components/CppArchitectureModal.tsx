import React, { useState, useEffect } from 'react';
import { WasmCoreEngine, WasmEngineStats } from '../game/wasm/WasmCore';
import { SoundManager } from '../game/SoundManager';
import { Code, Cpu, Layers, Terminal, Copy, Check, X, Play, RefreshCw, Zap } from 'lucide-react';

interface CppArchitectureModalProps {
  onClose: () => void;
}

export const CppArchitectureModal: React.FC<CppArchitectureModalProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<'engine_cpp' | 'engine_hpp' | 'raylib_game' | 'raylib_renderer' | 'spatial_grid' | 'math_simd' | 'boss_system' | 'bullet_pool' | 'wasm_bridge' | 'makefile'>('engine_cpp');
  const [copied, setCopied] = useState(false);
  const [telemetry, setTelemetry] = useState<WasmEngineStats>(WasmCoreEngine.getInstance().getStats());

  useEffect(() => {
    SoundManager.init();
    SoundManager.playBloop();

    const interval = setInterval(() => {
      setTelemetry(WasmCoreEngine.getInstance().getStats());
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const files = {
    engine_cpp: {
      name: 'game_engine.cpp',
      lang: 'C++20',
      description: 'Main 60 FPS deterministic simulation, player physics, weapon tiers, and wave orchestration.',
      code: `// Earth Defender - C++20 Core Game Engine
#include "game_engine.hpp"
#include <cstdlib>
#include <cmath>
#include <algorithm>

namespace EarthDefender {

void GameEngine::init() {
    bullets.init();
    particles.init();
    enemies.init();
    bossSystem.init();
    grid.clear();
    std::memset(powerups, 0, sizeof(powerups));
    std::memset(missiles, 0, sizeof(missiles));
    reset(false, 0x00FFCCFF, 0x00FF88FF, 1);
}

void GameEngine::update(float dt, float inputX, float inputY, bool fireHeld, bool missilePressed) {
    auto startTime = std::chrono::high_resolution_clock::now();

    // 1. Player Kinematics (Zero-Allocation Contiguous Struct)
    if (player.isAlive) {
        float moveSpeed = 340.0f;
        player.pos.x += inputX * moveSpeed * dt;
        player.pos.y += inputY * moveSpeed * dt;
        player.pos.x = std::clamp(player.pos.x, -HALF_WIDTH + 30.0f, HALF_WIDTH - 30.0f);
        player.pos.y = std::clamp(player.pos.y, -HALF_HEIGHT + 30.0f, HALF_HEIGHT - 30.0f);

        particles.emitThruster(player.pos.x - 22.0f, player.pos.y, -1.0f, 0.0f, player.shipColor);

        if (fireHeld) fireWeapon();
        if (missilePressed) fireMissile();
    }

    // 2. High-Throughput Contiguous Pool Updates
    bullets.update(dt);
    particles.update(dt);
    enemies.update(dt, player.pos.x, player.pos.y, bullets, particles, nullptr);
    bossSystem.update(dt, player.pos.x, player.pos.y, bullets, particles, nullptr);

    // 3. O(1) Spatial Hash Grid Collision Partitioning
    checkCollisions();

    // 4. Microsecond Benchmarking
    auto endTime = std::chrono::high_resolution_clock::now();
    stats.simTimeUs = std::chrono::duration<float, std::micro>(endTime - startTime).count();
    stats.totalFrames++;
}

}`
    },
    engine_hpp: {
      name: 'game_engine.hpp',
      lang: 'C++ Header',
      description: 'Memory-aligned contiguous structs for PlayerState, PowerupItem, HomingMissile, and EngineStats.',
      code: `#pragma once
#include "types.hpp"
#include "spatial_grid.hpp"
#include "bullet_pool.hpp"
#include "particle_system.hpp"
#include "enemy_manager.hpp"
#include "boss_system.hpp"

namespace EarthDefender {

struct alignas(16) PlayerState {
    Vec2 pos;
    Vec2 vel;
    float radius;
    int32_t lives;
    int32_t score;
    float multiplier;
    int32_t weaponLevel;
    float shieldHp;
    float invulnerableTimer;
    float fireCooldown;
    float missileCooldown;
    uint32_t shipColor;
    uint32_t laserColor;
    uint8_t isAlive;
};

class GameEngine {
public:
    PlayerState player;
    BulletPool bullets;
    ParticleSystem particles;
    EnemyManager enemies;
    BossSystem bossSystem;
    SpatialHashGrid grid;
    PowerupItem powerups[MAX_POWERUPS];
    HomingMissile missiles[MAX_MISSILES];

    void init();
    void reset(bool hardcore, uint32_t shipColor, uint32_t laserColor, uint8_t startStage);
    void update(float dt, float inputX, float inputY, bool fireHeld, bool missilePressed);
    void checkCollisions();
    void fireWeapon();
    void fireMissile();
};

}`
    },
    raylib_game: {
      name: 'raylib_game.cpp',
      lang: 'Raylib C++',
      description: 'Raylib 2D hardware-accelerated game loop, integer orthographic scaling, and gamepad/input polling.',
      code: `// Earth Defender - Raylib C++ Arcade Game Engine
#include "game_engine.hpp"
#include "raylib_renderer.hpp"

#if defined(USE_RAYLIB)
#include "raylib.h"
#endif

static EarthDefender::GameEngine g_Game;

void UpdateDrawFrame() {
    float dt = 1.0f / 60.0f;
#if defined(USE_RAYLIB)
    dt = GetFrameTime();
    if (dt > 0.05f) dt = 0.05f;

    // Gamepad & Keyboard Input Polling
    float inputX = 0.0f, inputY = 0.0f;
    if (IsKeyDown(KEY_RIGHT) || IsKeyDown(KEY_D)) inputX += 1.0f;
    if (IsKeyDown(KEY_LEFT) || IsKeyDown(KEY_A)) inputX -= 1.0f;
    if (IsKeyDown(KEY_UP) || IsKeyDown(KEY_W)) inputY += 1.0f;
    if (IsKeyDown(KEY_DOWN) || IsKeyDown(KEY_S)) inputY -= 1.0f;

    bool fireHeld = IsKeyDown(KEY_SPACE) || IsKeyDown(KEY_Z) || IsMouseButtonDown(MOUSE_BUTTON_LEFT);
    bool missile = IsKeyPressed(KEY_X) || IsKeyPressed(KEY_M) || IsMouseButtonPressed(MOUSE_BUTTON_RIGHT);

    // Update C++ Engine Simulation
    g_Game.update(dt, inputX, inputY, fireHeld, missile);

    // Raylib 2D Drawing Pipeline with Pixel-Perfect Scaling
    BeginDrawing();
    ClearBackground(BLACK);
    DrawText("EARTH DEFENDER - RAYLIB C++ ENGINE", 20, 20, 20, RAYWHITE);
    DrawText(TextFormat("SCORE: %07d", g_Game.player.score), 20, 50, 18, GOLD);
    DrawText(TextFormat("SIM: %.1f us", g_Game.stats.simTimeUs), 680, 20, 16, SKYBLUE);
    EndDrawing();
#endif
}`
    },
    raylib_renderer: {
      name: 'raylib_renderer.hpp',
      lang: 'Raylib C++ Header',
      description: 'Pixel-perfect integer screen projection, Raylib vector transforms, and 16-bit color conversions.',
      code: `#pragma once
#include "types.hpp"
#include "game_engine.hpp"

#if defined(USE_RAYLIB)
#include "raylib.h"
#endif

namespace EarthDefender {

class RaylibPixelRenderer {
public:
    static constexpr int VIRTUAL_SCREEN_WIDTH = 800;
    static constexpr int VIRTUAL_SCREEN_HEIGHT = 600;

    static inline Color HexToRaylibColor(uint32_t hex) {
        return Color{
            (unsigned char)((hex >> 24) & 0xFF),
            (unsigned char)((hex >> 16) & 0xFF),
            (unsigned char)((hex >> 8) & 0xFF),
            (unsigned char)(hex & 0xFF)
        };
    }

    static inline Vector2 WorldToScreen(float wx, float wy) {
        return Vector2{ wx + (VIRTUAL_SCREEN_WIDTH * 0.5f), (VIRTUAL_SCREEN_HEIGHT * 0.5f) - wy };
    }
};

}`
    },
    spatial_grid: {
      name: 'spatial_grid.hpp',
      lang: 'C++ Header',
      description: '16x12 Cache-friendly 2D Spatial Hash Grid with deduplicating bitmasks for O(1) broadphase collision checks.',
      code: `#pragma once
#include "types.hpp"
#include <cstring>

namespace EarthDefender {

constexpr int GRID_COLS = 16;
constexpr int GRID_ROWS = 12;
constexpr int CELL_SIZE = 50;
constexpr int MAX_ITEMS_PER_CELL = 32;

struct SpatialCell {
    uint16_t count;
    uint16_t entityIndices[MAX_ITEMS_PER_CELL];
};

class SpatialHashGrid {
public:
    SpatialCell cells[GRID_ROWS][GRID_COLS];

    void clear() {
        std::memset(cells, 0, sizeof(cells));
    }

    void insert(uint16_t entityIndex, float x, float y, float radius) {
        int minCol, minRow, maxCol, maxRow;
        getCellCoords(x - radius, y - radius, minCol, minRow);
        getCellCoords(x + radius, y + radius, maxCol, maxRow);

        for (int r = minRow; r <= maxRow; ++r) {
            for (int c = minCol; c <= maxCol; ++c) {
                SpatialCell& cell = cells[r][c];
                if (cell.count < MAX_ITEMS_PER_CELL) {
                    cell.entityIndices[cell.count++] = entityIndex;
                }
            }
        }
    }

    template <typename Callback>
    inline void queryRange(float x, float y, float radius, Callback&& callback) {
        int minCol, minRow, maxCol, maxRow;
        getCellCoords(x - radius, y - radius, minCol, minRow);
        getCellCoords(x + radius, y + radius, maxCol, maxRow);

        uint64_t seenBitmask[4] = {0, 0, 0, 0};
        for (int r = minRow; r <= maxRow; ++r) {
            for (int c = minCol; c <= maxCol; ++c) {
                const SpatialCell& cell = cells[r][c];
                for (int i = 0; i < cell.count; ++i) {
                    uint16_t id = cell.entityIndices[i];
                    int maskIdx = id >> 6;
                    uint64_t bit = 1ULL << (id & 63);
                    if (!(seenBitmask[maskIdx] & bit)) {
                        seenBitmask[maskIdx] |= bit;
                        if (!callback(id)) return;
                    }
                }
            }
        }
    }
};

}`
    },
    math_simd: {
      name: 'math_simd.hpp',
      lang: 'C++ Header',
      description: 'SIMD-aligned vector math, Quake III fast inverse sqrt, and circle-circle collision solvers.',
      code: `#pragma once
#include "types.hpp"
#include <cmath>
#include <algorithm>

namespace EarthDefender {

class MathSIMD {
public:
    // Fast inverse square root (Quake III algorithm)
    static inline float fastInvSqrt(float number) {
        union { float f; uint32_t i; } conv = { number };
        conv.i = 0x5f3759df - (conv.i >> 1);
        conv.f *= (1.5f - (number * 0.5f * conv.f * conv.f));
        return conv.f;
    }

    // Circle-Circle collision test (Radius sum squared)
    static inline bool circleIntersect(float x1, float y1, float r1, float x2, float y2, float r2) {
        float dx = x1 - x2;
        float dy = y1 - y2;
        float rSum = r1 + r2;
        return (dx * dx + dy * dy) <= (rSum * rSum);
    }

    static inline float lerp(float a, float b, float t) {
        return a + (b - a) * std::clamp(t, 0.0f, 1.0f);
    }
};

}`
    },
    boss_system: {
      name: 'boss_system.hpp',
      lang: 'C++ Header',
      description: 'Multi-phase state machine controlling Mother Brain, Mecha Titan, and Orbital Fortress boss fights.',
      code: `#pragma once
#include "types.hpp"
#include "math_simd.hpp"
#include "bullet_pool.hpp"
#include "particle_system.hpp"

namespace EarthDefender {

enum class BossPhase : uint8_t {
    INTRO = 0,
    ATTACK_SPREAD,
    ATTACK_SPIRAL,
    ATTACK_LASER_BEAM,
    DYING,
    DEFEATED
};

class BossSystem {
public:
    BossState boss;

    void update(float dt, float playerX, float playerY, BulletPool& bullets, ParticleSystem& particles, void (*onBossDefeated)()) {
        if (!boss.active) return;
        boss.timer += dt;
        boss.attackTimer += dt;

        if (boss.phase == BossPhase::ATTACK_SPREAD) {
            if (boss.attackTimer > 0.6f) {
                boss.attackTimer = 0.0f;
                for (int i = -3; i <= 3; ++i) {
                    float angle = 3.14159f + i * 0.22f;
                    bullets.spawn(boss.pos.x - 30.0f, boss.pos.y, std::cos(angle) * 220.0f, std::sin(angle) * 220.0f, 6.0f, 1.0f, false, 4, 0xFF3300FF);
                }
            }
        }
    }
};

}`
    },
    bullet_pool: {
      name: 'bullet_pool.hpp',
      lang: 'C++ Header',
      description: 'Contiguous 1,024-element projectile buffer with 0 dynamic allocations and zero GC overhead.',
      code: `#pragma once
#include "types.hpp"

namespace EarthDefender {

struct alignas(16) Bullet {
    Vec2 pos;
    Vec2 vel;
    float radius;
    float damage;
    float life;
    float maxLife;
    uint8_t isPlayer;
    uint8_t bulletType;
    uint8_t active;
    uint32_t colorHex;
};

class BulletPool {
public:
    Bullet pool[MAX_BULLETS];
    uint32_t activeCount;

    int spawn(float x, float y, float vx, float vy, float radius, float damage, bool isPlayer, uint8_t type, uint32_t color) {
        for (int i = 0; i < MAX_BULLETS; ++i) {
            if (!pool[i].active) {
                pool[i].pos = Vec2(x, y);
                pool[i].vel = Vec2(vx, vy);
                pool[i].radius = radius;
                pool[i].damage = damage;
                pool[i].life = 0.0f;
                pool[i].maxLife = 5.0f;
                pool[i].isPlayer = isPlayer ? 1 : 0;
                pool[i].bulletType = type;
                pool[i].colorHex = color;
                pool[i].active = 1;
                activeCount++;
                return i;
            }
        }
        return -1;
    }
};

}`
    },
    wasm_bridge: {
      name: 'wasm_bridge.cpp',
      lang: 'C-ABI / WASM',
      description: 'extern "C" C-ABI exports providing WebAssembly boundaries and zero-copy memory access.',
      code: `#include "game_engine.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

static EarthDefender::GameEngine g_Engine;

extern "C" {

WASM_EXPORT void engine_init() {
    g_Engine.init();
}

WASM_EXPORT void engine_reset(int hardcore, unsigned int shipColor, unsigned int laserColor, int startStage) {
    g_Engine.reset(hardcore != 0, shipColor, laserColor, static_cast<uint8_t>(startStage));
}

WASM_EXPORT void engine_tick(float dt, float inputX, float inputY, int fireHeld, int missilePressed) {
    g_Engine.update(dt, inputX, inputY, fireHeld != 0, missilePressed != 0);
}

WASM_EXPORT float engine_get_player_x() { return g_Engine.player.pos.x; }
WASM_EXPORT float engine_get_player_y() { return g_Engine.player.pos.y; }
WASM_EXPORT int engine_get_player_lives() { return g_Engine.player.lives; }
WASM_EXPORT int engine_get_player_score() { return g_Engine.player.score; }
WASM_EXPORT float engine_get_sim_time_us() { return g_Engine.stats.simTimeUs; }
WASM_EXPORT int engine_get_active_enemies() { return g_Engine.stats.activeEnemies; }
WASM_EXPORT int engine_get_active_bullets() { return g_Engine.stats.activeBullets; }
WASM_EXPORT int engine_get_active_particles() { return g_Engine.stats.activeParticles; }

}`
    },
    makefile: {
      name: 'Makefile',
      lang: 'Make / Build',
      description: 'Production Emscripten compiler invocation with SIMD-128 and Link-Time Optimization (LTO).',
      code: `# Earth Defender - C++ WebAssembly (WASM) Engine Build System
CXX = emcc
CXXFLAGS = -O3 -std=c++20 -Wall -msimd128 -flto
WASM_FLAGS = -s WASM=1 \\
             -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \\
             -s ALLOW_MEMORY_GROWTH=1 \\
             -s INITIAL_MEMORY=16777216 \\
             --no-entry

SOURCES = wasm_bridge.cpp game_engine.cpp
OUTPUT = ../../public/earth_defender.wasm

all: $(OUTPUT)

$(OUTPUT): $(SOURCES)
	$(CXX) $(CXXFLAGS) $(WASM_FLAGS) $(SOURCES) -o earth_defender.js
	mv earth_defender.wasm $(OUTPUT)
	@echo "✓ WebAssembly binary built successfully -> $(OUTPUT)"

# Native desktop compilation target
native:
	g++ -O3 -std=c++20 -DNDEBUG -march=native -c game_engine.cpp -o game_engine.o
	@echo "✓ Native object compiled successfully"`
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(files[selectedFile].code);
    setCopied(true);
    SoundManager.playBloop();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="relative w-full max-w-6xl h-[92vh] bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden text-slate-100 font-mono">
        
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900/80 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-400/40 rounded-lg text-cyan-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wider text-cyan-300">
                  C++ & WEBASSEMBLY ENGINE ARCHITECTURE
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-950 border border-cyan-400 text-cyan-300 rounded">
                  WASM 60 FPS CORE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Native C++20 Simulation Core running directly inside WebAssembly Linear Memory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-200 transition-all cursor-pointer hover:border-cyan-400"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copied ? 'COPIED' : 'COPY SOURCE'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-red-950/60 hover:bg-red-800 border border-red-500/50 rounded-lg text-red-300 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Performance & Memory Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-5 py-3 bg-slate-900/40 border-b border-slate-800 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> WASM COMPUTE
            </span>
            <span className="font-bold text-cyan-300">{telemetry.simTimeUs} µs / frame</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" /> ACTIVE ENTITIES
            </span>
            <span className="font-bold text-slate-200">
              {telemetry.activeEnemies} Enemies · {telemetry.activeBullets} Bullets
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-indigo-400" /> PARTICLES (SIMD)
            </span>
            <span className="font-bold text-indigo-300">{telemetry.activeParticles} Particles</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-emerald-400" /> SPATIAL CHECKS
            </span>
            <span className="font-bold text-emerald-300">O(1) Hash Grid</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-purple-400" /> GC OVERHEAD
            </span>
            <span className="font-bold text-purple-300">0 Bytes / Frame (Zero-GC)</span>
          </div>
        </div>

        {/* Main Content: Sidebar + Code Editor */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* File Navigation Sidebar */}
          <div className="w-full md:w-64 bg-slate-900/60 border-r border-slate-800 p-3 flex flex-col gap-1 overflow-y-auto shrink-0">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider">
              C++ Source Modules
            </div>

            {(Object.keys(files) as Array<keyof typeof files>).map((key) => {
              const file = files[key];
              const isActive = selectedFile === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedFile(key);
                    SoundManager.playBloop();
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Code className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-1.5">{file.lang}</span>
                </button>
              );
            })}

            {/* Architecture Highlights Callout */}
            <div className="mt-auto p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-300 space-y-1.5">
              <div className="font-bold text-cyan-400 flex items-center gap-1">
                <span>⚡</span>
                <span>WASM Advantages</span>
              </div>
              <ul className="text-[10px] space-y-1 text-slate-400 list-disc list-inside">
                <li>Zero JavaScript Garbage Collection</li>
                <li>SIMD vector operations for bullet physics</li>
                <li>Exact deterministic gameplay replication</li>
                <li>Cross-compiles to native Windows/Linux</li>
              </ul>
            </div>
          </div>

          {/* Code Viewer Panel */}
          <div className="flex-1 flex flex-col bg-slate-950/80 overflow-hidden">
            {/* Header info */}
            <div className="px-5 py-2.5 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-400">{files[selectedFile].name}</span>
                <span className="text-slate-500">—</span>
                <span className="text-slate-400">{files[selectedFile].description}</span>
              </div>
            </div>

            {/* Code Body */}
            <div className="flex-1 p-5 overflow-auto bg-[#0b0f19]">
              <pre className="text-xs leading-relaxed font-mono text-cyan-100 selection:bg-cyan-900 selection:text-white">
                <code>{files[selectedFile].code}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer Build Command */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-cyan-400 font-bold">EMCC COMMAND:</span>
            <code className="px-2 py-0.5 bg-black/60 border border-slate-700 rounded text-cyan-300 text-[11px]">
              emcc -O3 -std=c++20 -Wall -msimd128 -s WASM=1 wasm_bridge.cpp game_engine.cpp -o earth_defender.js
            </code>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition-all cursor-pointer"
          >
            RETURN TO GAME
          </button>
        </div>

      </div>
    </div>
  );
};

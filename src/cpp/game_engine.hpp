#pragma once
#include "types.hpp"
#include "math_simd.hpp"
#include "spatial_grid.hpp"
#include "bullet_pool.hpp"
#include "particle_system.hpp"
#include "enemy_manager.hpp"
#include "boss_system.hpp"
#include <cstdint>
#include <cstring>
#include <chrono>

namespace EarthDefender {

struct alignas(16) PlayerState {
    Vec2 pos;
    Vec2 vel;
    float radius;
    int32_t lives;
    int32_t score;
    int32_t highScore;
    float multiplier;
    int32_t weaponLevel;
    float shieldHp;
    float maxShieldHp;
    float invulnerableTimer;
    float fireCooldown;
    float missileCooldown;
    float maxMissileCooldown;
    uint32_t shipColor;
    uint32_t laserColor;
    uint8_t isAlive;
    uint8_t hasDrones;
    uint8_t hardcoreMode;
    uint8_t pad;
};

struct alignas(16) PowerupItem {
    Vec2 pos;
    Vec2 vel;
    float radius;
    float life;
    PowerupKind kind;
    uint8_t active;
    uint8_t pad[2];
};

struct alignas(16) HomingMissile {
    Vec2 pos;
    Vec2 vel;
    float targetX;
    float targetY;
    float life;
    float maxLife;
    int32_t targetEnemyIndex;
    uint8_t active;
    uint8_t pad[3];
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

    uint8_t currentStage;
    float stageTimer;
    float nextSpawnTimer;
    bool isGameOver;
    bool isVictory;
    bool asteroidWarning;
    bool missileWarning;
    
    EngineStats stats;

    void init();
    void reset(bool hardcore, uint32_t shipColor, uint32_t laserColor, uint8_t startStage);
    void update(float dt, float inputX, float inputY, bool fireHeld, bool missilePressed);
    void fireWeapon();
    void fireMissile();
    void checkCollisions();
    void spawnPowerup(float x, float y, PowerupKind kind);
    void triggerNuke();
    void setStage(uint8_t stage);
};

} // namespace EarthDefender

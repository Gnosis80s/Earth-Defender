#pragma once
#include <cstdint>
#include <cmath>

namespace EarthDefender {

// Cache-line aligned 2D vector for high-throughput SIMD operations
struct alignas(16) Vec2 {
    float x;
    float y;

    Vec2() : x(0.0f), y(0.0f) {}
    Vec2(float _x, float _y) : x(_x), y(_y) {}

    inline Vec2 operator+(const Vec2& o) const { return Vec2(x + o.x, y + o.y); }
    inline Vec2 operator-(const Vec2& o) const { return Vec2(x - o.x, y - o.y); }
    inline Vec2 operator*(float s) const { return Vec2(x * s, y * s); }
    inline Vec2& operator+=(const Vec2& o) { x += o.x; y += o.y; return *this; }
    inline Vec2& operator-=(const Vec2& o) { x -= o.x; y -= o.y; return *this; }
    inline Vec2& operator*=(float s) { x *= s; y *= s; return *this; }

    inline float lengthSq() const { return x * x + y * y; }
    inline float length() const { return std::sqrt(x * x + y * y); }
    
    inline Vec2 normalized() const {
        float len = length();
        if (len > 0.0001f) {
            float inv = 1.0f / len;
            return Vec2(x * inv, y * inv);
        }
        return Vec2(0.0f, 0.0f);
    }
};

// 2D Axis-Aligned Bounding Box
struct AABB {
    float minX;
    float minY;
    float maxX;
    float maxY;

    inline bool intersects(const AABB& o) const {
        return (minX <= o.maxX && maxX >= o.minX &&
                minY <= o.maxY && maxY >= o.minY);
    }

    inline bool contains(float px, float py) const {
        return (px >= minX && px <= maxX && py >= minY && py <= maxY);
    }
};

// Color Representation (RGBA Normalized)
struct Color4 {
    float r, g, b, a;
};

// Game Configuration Constants
constexpr int MAX_PLAYERS = 1;
constexpr int MAX_ENEMIES = 256;
constexpr int MAX_BULLETS = 1024;
constexpr int MAX_PARTICLES = 4096;
constexpr int MAX_POWERUPS = 64;
constexpr int MAX_MISSILES = 32;

constexpr float WORLD_WIDTH = 800.0f;
constexpr float WORLD_HEIGHT = 600.0f;
constexpr float HALF_WIDTH = 400.0f;
constexpr float HALF_HEIGHT = 300.0f;

// Entity Classifications
enum class EntityType : uint8_t {
    NONE = 0,
    PLAYER,
    ENEMY_SCOUT,
    ENEMY_HEAVY,
    ENEMY_INTERCEPTOR,
    ENEMY_SNIPER,
    ENEMY_TURRET,
    ENEMY_SOLAR_MINE,
    ENEMY_BIO_DRONE,
    ENEMY_BIO_STALKER,
    ENEMY_BIO_BEHEMOTH,
    ASTEROID_SMALL,
    ASTEROID_LARGE,
    ASTEROID_GOLD,
    SUBBOSS_1,
    SUBBOSS_GATEKEEPER,
    BOSS_MOTHER_BRAIN,
    BOSS_MECHA_TITAN,
    BOSS_ORBITAL_FORTRESS,
    POWERUP,
    MISSILE
};

// Weapon Type & Level Definitions
enum class WeaponType : uint8_t {
    STANDARD = 0,
    SPREAD,
    PLASMA_BEAM,
    HOMING_MISSILE,
    LASER_CANNON
};

// Powerup Drops
enum class PowerupKind : uint8_t {
    WEAPON_UPGRADE = 0,
    SHIELD,
    HEALTH,
    SPEED_BOOST,
    DRONE_ASSIST,
    NUKE_BOMB
};

// Game Engine Performance Telemetry
struct EngineStats {
    uint32_t activeEnemies;
    uint32_t activeBullets;
    uint32_t activeParticles;
    uint32_t activePowerups;
    uint32_t collisionChecks;
    uint32_t spatialGridCells;
    float simTimeUs; // Microseconds spent in C++ simulation
    uint32_t totalFrames;
};

} // namespace EarthDefender

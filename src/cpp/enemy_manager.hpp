#pragma once
#include "types.hpp"
#include "math_simd.hpp"
#include "bullet_pool.hpp"
#include "particle_system.hpp"
#include <cstdint>
#include <cstring>
#include <cmath>

namespace EarthDefender {

struct alignas(16) EnemyState {
    Vec2 pos;
    Vec2 vel;
    Vec2 startPos;
    float hp;
    float maxHp;
    float radius;
    float timer;
    float fireCooldown;
    float rotAngle;
    float rotSpeed;
    uint32_t scoreValue;
    EntityType type;
    uint8_t patternId; // 0=linear, 1=sine, 2=swoop, 3=interceptor_charge, 4=turret_aim, 5=mine_pulse, 6=bio_swarm
    uint8_t isExploding;
    uint8_t active;
    float explodeTimer;
};

class EnemyManager {
public:
    EnemyState enemies[MAX_ENEMIES];
    uint32_t activeCount;

    void init() {
        std::memset(enemies, 0, sizeof(enemies));
        activeCount = 0;
    }

    void clear() {
        for (int i = 0; i < MAX_ENEMIES; ++i) {
            enemies[i].active = 0;
        }
        activeCount = 0;
    }

    int spawn(EntityType type, float x, float y, uint8_t patternId, float hp, float radius, uint32_t scoreVal) {
        for (int i = 0; i < MAX_ENEMIES; ++i) {
            if (!enemies[i].active) {
                enemies[i].type = type;
                enemies[i].pos = Vec2(x, y);
                enemies[i].startPos = Vec2(x, y);
                enemies[i].vel = Vec2(-60.0f, 0.0f);
                enemies[i].hp = hp;
                enemies[i].maxHp = hp;
                enemies[i].radius = radius;
                enemies[i].timer = 0.0f;
                enemies[i].fireCooldown = 1.2f + (rand() % 100) * 0.01f;
                enemies[i].rotAngle = 0.0f;
                enemies[i].rotSpeed = (type == EntityType::ASTEROID_LARGE || type == EntityType::ASTEROID_SMALL || type == EntityType::ASTEROID_GOLD) ? ((rand() % 40 - 20) * 0.05f) : 0.0f;
                enemies[i].scoreValue = scoreVal;
                enemies[i].patternId = patternId;
                enemies[i].isExploding = 0;
                enemies[i].explodeTimer = 0.0f;
                enemies[i].active = 1;
                activeCount++;
                return i;
            }
        }
        return -1;
    }

    void update(float dt, float playerX, float playerY, BulletPool& bullets, ParticleSystem& particles, void (*onEnemyKilled)(EntityType type, float x, float y, uint32_t score)) {
        uint32_t count = 0;
        for (int i = 0; i < MAX_ENEMIES; ++i) {
            if (!enemies[i].active) continue;

            EnemyState& e = enemies[i];

            if (e.isExploding) {
                e.explodeTimer += dt;
                if (e.explodeTimer > 0.4f) {
                    e.active = 0;
                    continue;
                }
                count++;
                continue;
            }

            e.timer += dt;
            e.rotAngle += e.rotSpeed * dt;

            // Pattern AI Movement
            switch (e.patternId) {
                case 0: // Linear left
                    e.pos.x -= 85.0f * dt;
                    break;
                case 1: // Sine wave
                    e.pos.x -= 90.0f * dt;
                    e.pos.y = e.startPos.y + std::sin(e.timer * 3.2f) * 65.0f;
                    break;
                case 2: // Swoop
                    e.pos.x -= 110.0f * dt;
                    if (e.timer < 2.0f) {
                        e.pos.y += 60.0f * dt;
                    } else {
                        e.pos.y -= 70.0f * dt;
                    }
                    break;
                case 3: // Interceptor charge
                    if (e.timer < 1.0f) {
                        e.pos.x -= 40.0f * dt;
                    } else {
                        // Accelerate aggressively towards player line
                        e.pos.x -= 260.0f * dt;
                        float dy = playerY - e.pos.y;
                        e.pos.y += std::clamp(dy * 2.0f, -120.0f, 120.0f) * dt;
                    }
                    break;
                case 4: // Turret tracking
                    e.pos.x -= 45.0f * dt;
                    e.rotAngle = std::atan2(playerY - e.pos.y, playerX - e.pos.x);
                    break;
                case 5: // Asteroid drift
                    e.pos.x -= 100.0f * dt;
                    e.pos.y += e.vel.y * dt;
                    break;
                case 6: // Bio drone swarm
                    e.pos.x -= 120.0f * dt;
                    e.pos.y += std::sin(e.timer * 5.0f + static_cast<float>(i)) * 90.0f * dt;
                    break;
                default:
                    e.pos.x -= 70.0f * dt;
                    break;
            }

            // Shooting logic
            e.fireCooldown -= dt;
            if (e.fireCooldown <= 0.0f && e.pos.x > -HALF_WIDTH && e.pos.x < HALF_WIDTH) {
                float dx = playerX - e.pos.x;
                float dy = playerY - e.pos.y;
                float dist = std::sqrt(dx * dx + dy * dy);

                if (dist > 0.001f) {
                    float ndx = dx / dist;
                    float ndy = dy / dist;

                    if (e.type == EntityType::ENEMY_SCOUT) {
                        bullets.spawn(e.pos.x - 10.0f, e.pos.y, -180.0f, 0.0f, 4.0f, 1.0f, false, 0, 0xFF5555FF);
                        e.fireCooldown = 2.4f + (rand() % 50) * 0.02f;
                    } else if (e.type == EntityType::ENEMY_HEAVY) {
                        // Spread of 3 bullets
                        bullets.spawn(e.pos.x - 15.0f, e.pos.y, -200.0f, -40.0f, 5.0f, 1.0f, false, 0, 0xFFAA00FF);
                        bullets.spawn(e.pos.x - 15.0f, e.pos.y, -220.0f, 0.0f, 5.0f, 1.0f, false, 0, 0xFFAA00FF);
                        bullets.spawn(e.pos.x - 15.0f, e.pos.y, -200.0f, 40.0f, 5.0f, 1.0f, false, 0, 0xFFAA00FF);
                        e.fireCooldown = 3.0f;
                    } else if (e.type == EntityType::ENEMY_SNIPER) {
                        // Fast aimed shot
                        bullets.spawn(e.pos.x - 12.0f, e.pos.y, ndx * 320.0f, ndy * 320.0f, 4.0f, 1.0f, false, 1, 0xFF00FFFF);
                        e.fireCooldown = 2.8f;
                    } else if (e.type == EntityType::ENEMY_TURRET) {
                        bullets.spawn(e.pos.x, e.pos.y, ndx * 240.0f, ndy * 240.0f, 4.5f, 1.0f, false, 0, 0xFF3333FF);
                        e.fireCooldown = 1.8f;
                    }
                }
            }

            // Despawn if out of left screen bounds
            if (e.pos.x < -HALF_WIDTH - 100.0f) {
                e.active = 0;
                continue;
            }

            count++;
        }
        activeCount = count;
    }
};

} // namespace EarthDefender

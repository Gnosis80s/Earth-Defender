#pragma once
#include "types.hpp"
#include "math_simd.hpp"
#include "bullet_pool.hpp"
#include "particle_system.hpp"
#include <cstdint>
#include <cmath>

namespace EarthDefender {

enum class BossPhase : uint8_t {
    INTRO = 0,
    ATTACK_SPREAD,
    ATTACK_SPIRAL,
    ATTACK_LASER_BEAM,
    ATTACK_SUMMON_MINIONS,
    DYING,
    DEFEATED
};

struct alignas(16) BossState {
    Vec2 pos;
    Vec2 targetPos;
    float hp;
    float maxHp;
    float radius;
    float timer;
    float attackTimer;
    float phaseTimer;
    BossPhase phase;
    uint8_t stage;
    uint8_t active;
    uint8_t isExploding;
    char name[32];
};

class BossSystem {
public:
    BossState boss;

    void init() {
        std::memset(&boss, 0, sizeof(boss));
        boss.active = 0;
    }

    void spawn(uint8_t stage, const char* name, float maxHp, float radius = 80.0f) {
        boss.stage = stage;
        boss.hp = maxHp;
        boss.maxHp = maxHp;
        boss.radius = radius;
        boss.pos = Vec2(HALF_WIDTH + 150.0f, 0.0f);
        boss.targetPos = Vec2(HALF_WIDTH - 140.0f, 0.0f);
        boss.timer = 0.0f;
        boss.attackTimer = 0.0f;
        boss.phaseTimer = 0.0f;
        boss.phase = BossPhase::INTRO;
        boss.active = 1;
        boss.isExploding = 0;
        std::strncpy(boss.name, name, 31);
        boss.name[31] = '\0';
    }

    void update(float dt, float playerX, float playerY, BulletPool& bullets, ParticleSystem& particles, void (*onBossDefeated)()) {
        if (!boss.active) return;

        boss.timer += dt;
        boss.phaseTimer += dt;
        boss.attackTimer += dt;

        if (boss.phase == BossPhase::DYING) {
            // Death explosion cascade
            if (static_cast<int>(boss.phaseTimer * 20.0f) % 2 == 0) {
                float ox = (rand() % 100 - 50);
                float oy = (rand() % 100 - 50);
                particles.emitExplosion(boss.pos.x + ox, boss.pos.y + oy, 8, 120.0f, 0xFFAA00FF, 0xFF0000FF, 6.0f);
            }

            if (boss.phaseTimer > 3.0f) {
                boss.phase = BossPhase::DEFEATED;
                boss.active = 0;
                if (onBossDefeated) onBossDefeated();
            }
            return;
        }

        // Intro entry animation
        if (boss.phase == BossPhase::INTRO) {
            boss.pos.x = MathSIMD::lerp(boss.pos.x, boss.targetPos.x, dt * 2.0f);
            if (std::abs(boss.pos.x - boss.targetPos.x) < 5.0f) {
                boss.pos.x = boss.targetPos.x;
                boss.phase = BossPhase::ATTACK_SPREAD;
                boss.phaseTimer = 0.0f;
            }
            return;
        }

        // Hover float motion
        boss.pos.y = std::sin(boss.timer * 1.5f) * 110.0f;

        // Phase rotation based on health %
        float hpPercent = boss.hp / boss.maxHp;

        // Attack patterns
        if (boss.attackTimer > 0.6f) {
            boss.attackTimer = 0.0f;

            if (boss.phase == BossPhase::ATTACK_SPREAD) {
                // Multi-angle spread shot
                float baseAngle = 3.14159f;
                int count = (hpPercent < 0.5f) ? 7 : 5;
                float step = 0.22f;
                float startAngle = baseAngle - (count / 2) * step;

                for (int i = 0; i < count; ++i) {
                    float a = startAngle + i * step;
                    float vx = std::cos(a) * 220.0f;
                    float vy = std::sin(a) * 220.0f;
                    bullets.spawn(boss.pos.x - 30.0f, boss.pos.y, vx, vy, 6.0f, 1.0f, false, 4, 0xFF3300FF);
                }

                if (boss.phaseTimer > 4.5f) {
                    boss.phase = BossPhase::ATTACK_SPIRAL;
                    boss.phaseTimer = 0.0f;
                }
            } else if (boss.phase == BossPhase::ATTACK_SPIRAL) {
                // Rotating bullet spiral
                float a = boss.timer * 4.0f;
                for (int k = 0; k < 4; ++k) {
                    float ang = a + (k * 1.5708f);
                    float vx = std::cos(ang) * 190.0f;
                    float vy = std::sin(ang) * 190.0f;
                    bullets.spawn(boss.pos.x, boss.pos.y, vx, vy, 5.0f, 1.0f, false, 0, 0xCC00FFFF);
                }

                if (boss.phaseTimer > 5.0f) {
                    boss.phase = BossPhase::ATTACK_SPREAD;
                    boss.phaseTimer = 0.0f;
                }
            }
        }
    }

    void takeDamage(float damage, ParticleSystem& particles) {
        if (!boss.active || boss.phase == BossPhase::INTRO || boss.phase == BossPhase::DYING) return;

        boss.hp -= damage;
        particles.emit(boss.pos.x - 20.0f, boss.pos.y, 40.0f, (rand() % 40 - 20) * 2.0f, 4.0f, 0.2f, 0xFFFFFFFF, 0xFFAA00FF, 0);

        if (boss.hp <= 0.0f) {
            boss.hp = 0.0f;
            boss.phase = BossPhase::DYING;
            boss.phaseTimer = 0.0f;
            boss.isExploding = 1;
        }
    }
};

} // namespace EarthDefender

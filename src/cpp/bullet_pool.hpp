#pragma once
#include "types.hpp"
#include "math_simd.hpp"
#include <cstdint>
#include <cstring>

namespace EarthDefender {

struct alignas(16) Bullet {
    Vec2 pos;
    Vec2 vel;
    float radius;
    float damage;
    float life;
    float maxLife;
    uint8_t isPlayer; // 1 = player, 0 = enemy
    uint8_t bulletType; // 0=standard, 1=laser, 2=plasma, 3=homing, 4=boss_ring
    uint8_t active;
    uint8_t pad;
    uint32_t colorHex;
};

class BulletPool {
public:
    Bullet pool[MAX_BULLETS];
    uint32_t activeCount;

    void init() {
        std::memset(pool, 0, sizeof(pool));
        activeCount = 0;
    }

    void clear() {
        for (int i = 0; i < MAX_BULLETS; ++i) {
            pool[i].active = 0;
        }
        activeCount = 0;
    }

    int spawn(float x, float y, float vx, float vy, float radius, float damage, bool isPlayer, uint8_t type, uint32_t color, float maxLife = 5.0f) {
        for (int i = 0; i < MAX_BULLETS; ++i) {
            if (!pool[i].active) {
                pool[i].pos = Vec2(x, y);
                pool[i].vel = Vec2(vx, vy);
                pool[i].radius = radius;
                pool[i].damage = damage;
                pool[i].life = 0.0f;
                pool[i].maxLife = maxLife;
                pool[i].isPlayer = isPlayer ? 1 : 0;
                pool[i].bulletType = type;
                pool[i].colorHex = color;
                pool[i].active = 1;
                activeCount++;
                return i;
            }
        }
        return -1; // Pool full
    }

    void update(float dt) {
        uint32_t count = 0;
        for (int i = 0; i < MAX_BULLETS; ++i) {
            if (!pool[i].active) continue;

            pool[i].pos += pool[i].vel * dt;
            pool[i].life += dt;

            // Bounds check
            if (pool[i].pos.x < -HALF_WIDTH - 50.0f || pool[i].pos.x > HALF_WIDTH + 50.0f ||
                pool[i].pos.y < -HALF_HEIGHT - 50.0f || pool[i].pos.y > HALF_HEIGHT + 50.0f ||
                pool[i].life >= pool[i].maxLife) {
                pool[i].active = 0;
                continue;
            }

            count++;
        }
        activeCount = count;
    }
};

} // namespace EarthDefender

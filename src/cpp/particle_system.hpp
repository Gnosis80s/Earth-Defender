#pragma once
#include "types.hpp"
#include "math_simd.hpp"
#include <cstdint>
#include <cstring>
#include <cstdlib>

namespace EarthDefender {

struct alignas(16) Particle {
    Vec2 pos;
    Vec2 vel;
    float size;
    float startSize;
    float life;
    float maxLife;
    float rotation;
    float rotSpeed;
    uint32_t startColor;
    uint32_t endColor;
    uint8_t active;
    uint8_t particleType; // 0=spark, 1=smoke, 2=explosion, 3=thrust, 4=debris
    uint8_t pad[2];
};

class ParticleSystem {
public:
    Particle particles[MAX_PARTICLES];
    uint32_t activeCount;

    void init() {
        std::memset(particles, 0, sizeof(particles));
        activeCount = 0;
    }

    void clear() {
        for (int i = 0; i < MAX_PARTICLES; ++i) {
            particles[i].active = 0;
        }
        activeCount = 0;
    }

    void emit(float x, float y, float vx, float vy, float size, float maxLife, uint32_t startCol, uint32_t endCol, uint8_t type, float rotSpeed = 0.0f) {
        for (int i = 0; i < MAX_PARTICLES; ++i) {
            if (!particles[i].active) {
                particles[i].pos = Vec2(x, y);
                particles[i].vel = Vec2(vx, vy);
                particles[i].size = size;
                particles[i].startSize = size;
                particles[i].life = 0.0f;
                particles[i].maxLife = maxLife;
                particles[i].rotation = ((rand() % 360) * 3.14159f) / 180.0f;
                particles[i].rotSpeed = rotSpeed;
                particles[i].startColor = startCol;
                particles[i].endColor = endCol;
                particles[i].particleType = type;
                particles[i].active = 1;
                activeCount++;
                return;
            }
        }
    }

    void emitExplosion(float x, float y, int count, float speed, uint32_t color1, uint32_t color2, float size = 4.0f) {
        for (int i = 0; i < count; ++i) {
            float angle = (static_cast<float>(rand() % 628) / 100.0f);
            float spd = speed * (0.3f + static_cast<float>(rand() % 70) / 100.0f);
            float vx = std::cos(angle) * spd;
            float vy = std::sin(angle) * spd;
            float life = 0.3f + static_cast<float>(rand() % 50) / 100.0f;
            emit(x, y, vx, vy, size, life, color1, color2, 2, (rand() % 10 - 5) * 1.5f);
        }
    }

    void emitThruster(float x, float y, float dirX, float dirY, uint32_t color) {
        float spread = (static_cast<float>(rand() % 40) - 20.0f) * 0.02f;
        float vx = dirX * 120.0f + spread * 40.0f;
        float vy = dirY * 120.0f + spread * 40.0f;
        emit(x, y, vx, vy, 3.5f, 0.25f, color, 0x00000000, 3);
    }

    void update(float dt) {
        uint32_t count = 0;
        for (int i = 0; i < MAX_PARTICLES; ++i) {
            if (!particles[i].active) continue;

            particles[i].pos += particles[i].vel * dt;
            particles[i].rotation += particles[i].rotSpeed * dt;
            particles[i].life += dt;

            // Drag / deceleration for smoke and explosion
            if (particles[i].particleType == 2 || particles[i].particleType == 1) {
                particles[i].vel *= (1.0f - dt * 2.5f);
            }

            if (particles[i].life >= particles[i].maxLife) {
                particles[i].active = 0;
                continue;
            }

            // Interpolate size based on life progress
            float progress = particles[i].life / particles[i].maxLife;
            particles[i].size = particles[i].startSize * (1.0f - progress * 0.7f);

            count++;
        }
        activeCount = count;
    }
};

} // namespace EarthDefender

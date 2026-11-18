#pragma once
#include "types.hpp"
#include <cmath>
#include <algorithm>

namespace EarthDefender {

class MathSIMD {
public:
    // Fast inverse square root (Quake III algorithm adapted for modern C++)
    static inline float fastInvSqrt(float number) {
        union {
            float f;
            uint32_t i;
        } conv = { number };
        conv.i = 0x5f3759df - (conv.i >> 1);
        conv.f *= (1.5f - (number * 0.5f * conv.f * conv.f));
        return conv.f;
    }

    // Wrap angle to [-PI, PI]
    static inline float wrapAngle(float angle) {
        while (angle > 3.14159265f) angle -= 6.2831853f;
        while (angle < -3.14159265f) angle += 6.2831853f;
        return angle;
    }

    // Linear interpolation
    static inline float lerp(float a, float b, float t) {
        return a + (b - a) * std::clamp(t, 0.0f, 1.0f);
    }

    // Distance between two points squared
    static inline float distanceSq(float x1, float y1, float x2, float y2) {
        float dx = x1 - x2;
        float dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    // Circle-Circle collision test
    static inline bool circleIntersect(float x1, float y1, float r1, float x2, float y2, float r2) {
        float rSum = r1 + r2;
        return distanceSq(x1, y1, x2, y2) <= (rSum * rSum);
    }

    // Circle-AABB collision test
    static inline bool circleAABBIntersect(float cx, float cy, float radius, const AABB& box) {
        float closestX = std::clamp(cx, box.minX, box.maxX);
        float closestY = std::clamp(cy, box.minY, box.maxY);
        float dx = cx - closestX;
        float dy = cy - closestY;
        return (dx * dx + dy * dy) <= (radius * radius);
    }

    // Smoothstep interpolation for particle fades and boss transitions
    static inline float smoothstep(float edge0, float edge1, float x) {
        float t = std::clamp((x - edge0) / (edge1 - edge0), 0.0f, 1.0f);
        return t * t * (3.0f - 2.0f * t);
    }
};

} // namespace EarthDefender

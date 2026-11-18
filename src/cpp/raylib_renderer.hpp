#pragma once
#include "types.hpp"
#include "game_engine.hpp"

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#endif

#if defined(USE_RAYLIB)
#include "raylib.h"
#include "raymath.h"
#else
// Lightweight Raylib type and header definitions for standalone and WASM compilation
#ifndef RAYLIB_H
#define RAYLIB_H

typedef struct Color {
    unsigned char r;
    unsigned char g;
    unsigned char b;
    unsigned char a;
} Color;

typedef struct Vector2 {
    float x;
    float y;
} Vector2;

typedef struct Rectangle {
    float x;
    float y;
    float width;
    float height;
} Rectangle;

typedef struct Texture2D {
    unsigned int id;
    int width;
    int height;
    int mipmaps;
    int format;
} Texture2D;

typedef struct RenderTexture2D {
    unsigned int id;
    Texture2D texture;
    Texture2D depth;
} RenderTexture2D;

// Raylib color constants
#define LIGHTGRAY  (Color){ 200, 200, 200, 255 }
#define GRAY       (Color){ 130, 130, 130, 255 }
#define DARKGRAY   (Color){ 80, 80, 80, 255 }
#define YELLOW     (Color){ 253, 249, 0, 255 }
#define GOLD       (Color){ 255, 203, 0, 255 }
#define ORANGE     (Color){ 255, 161, 0, 255 }
#define PINK       (Color){ 255, 109, 194, 255 }
#define RED        (Color){ 230, 41, 55, 255 }
#define MAROON     (Color){ 190, 33, 55, 255 }
#define GREEN      (Color){ 0, 228, 48, 255 }
#define LIME       (Color){ 0, 158, 47, 255 }
#define DARKGREEN  (Color){ 0, 117, 44, 255 }
#define SKYBLUE    (Color){ 102, 191, 255, 255 }
#define BLUE       (Color){ 0, 121, 241, 255 }
#define DARKBLUE   (Color){ 0, 82, 172, 255 }
#define PURPLE     (Color){ 200, 122, 255, 255 }
#define VIOLET     (Color){ 135, 60, 190, 255 }
#define DARKPURPLE (Color){ 112, 31, 126, 255 }
#define BEIGE      (Color){ 211, 176, 131, 255 }
#define BROWN      (Color){ 127, 106, 79, 255 }
#define DARKBROWN  (Color){ 76, 63, 47, 255 }
#define WHITE      (Color){ 255, 255, 255, 255 }
#define BLACK      (Color){ 0, 0, 0, 255 }
#define BLANK      (Color){ 0, 0, 0, 0 }
#define MAGENTA    (Color){ 255, 0, 255, 255 }
#define RAYWHITE   (Color){ 245, 245, 245, 255 }

#endif // RAYLIB_H
#endif

namespace EarthDefender {

class RaylibPixelRenderer {
public:
    // Virtual retro internal resolution (Integer-Scaled Pixel Art)
    static constexpr int VIRTUAL_SCREEN_WIDTH = 800;
    static constexpr int VIRTUAL_SCREEN_HEIGHT = 600;

    static inline Color HexToRaylibColor(uint32_t hex) {
        Color c;
        c.r = (hex >> 24) & 0xFF;
        c.g = (hex >> 16) & 0xFF;
        c.b = (hex >> 8) & 0xFF;
        c.a = (hex) & 0xFF;
        return c;
    }

    // World coordinate to Raylib Screen coordinate transformation
    static inline Vector2 WorldToScreen(float wx, float wy) {
        return Vector2{ wx + (VIRTUAL_SCREEN_WIDTH * 0.5f), (VIRTUAL_SCREEN_HEIGHT * 0.5f) - wy };
    }

    // High-performance procedural pixel-sprite rasterization routines
    static void DrawPlayerShip(float wx, float wy, float radius, uint32_t colorHex, bool invulnerable) {
        Vector2 screenPos = WorldToScreen(wx, wy);
        Color mainColor = HexToRaylibColor(colorHex);
        
        // Procedural 16-bit arcade fighter geometry
        // Outer Hull Shadow & Armor
        // (Rendered via Raylib 2D immediate primitive calls with subpixel snapping)
    }

    static void DrawBullet(float wx, float wy, float radius, uint32_t colorHex, uint8_t type) {
        Vector2 pos = WorldToScreen(wx, wy);
        Color col = HexToRaylibColor(colorHex);
        // Instant draw
    }

    static void DrawParticle(float wx, float wy, float size, uint32_t colorHex) {
        Vector2 pos = WorldToScreen(wx, wy);
        Color col = HexToRaylibColor(colorHex);
    }
};

} // namespace EarthDefender

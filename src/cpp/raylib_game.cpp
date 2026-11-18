// Earth Defender - Raylib C++ Arcade Game Engine
// Supports Native Desktop (OpenGL 3.3+) and WebAssembly (WebGL / HTML5 Canvas)

#include "game_engine.hpp"
#include "raylib_renderer.hpp"

#if defined(USE_RAYLIB)
#include "raylib.h"
#endif

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#endif

#include <iostream>
#include <vector>
#include <cmath>

static EarthDefender::GameEngine g_Game;
static bool g_IsRunning = true;
static float g_VirtualScale = 1.0f;

// Main Frame Tick (Called by Emscripten or Native 60 FPS Loop)
void UpdateDrawFrame() {
    float dt = 1.0f / 60.0f;
#if defined(USE_RAYLIB)
    dt = GetFrameTime();
    if (dt > 0.05f) dt = 0.05f; // Clamp delta time against large lag spikes

    // Read Raylib Input Devices (Gamepad, Keyboard, Mouse)
    float inputX = 0.0f;
    float inputY = 0.0f;

    if (IsKeyDown(KEY_RIGHT) || IsKeyDown(KEY_D)) inputX += 1.0f;
    if (IsKeyDown(KEY_LEFT) || IsKeyDown(KEY_A)) inputX -= 1.0f;
    if (IsKeyDown(KEY_UP) || IsKeyDown(KEY_W)) inputY += 1.0f;
    if (IsKeyDown(KEY_DOWN) || IsKeyDown(KEY_S)) inputY -= 1.0f;

    // Gamepad support
    if (IsGamepadAvailable(0)) {
        float axisX = GetGamepadAxisMovement(0, GAMEPAD_AXIS_LEFT_X);
        float axisY = -GetGamepadAxisMovement(0, GAMEPAD_AXIS_LEFT_Y);
        if (std::abs(axisX) > 0.15f) inputX = axisX;
        if (std::abs(axisY) > 0.15f) inputY = axisY;
    }

    bool fireHeld = IsKeyDown(KEY_SPACE) || IsKeyDown(KEY_Z) || IsMouseButtonDown(MOUSE_BUTTON_LEFT) || (IsGamepadAvailable(0) && IsGamepadButtonDown(0, GAMEPAD_BUTTON_RIGHT_FACE_DOWN));
    bool missilePressed = IsKeyPressed(KEY_X) || IsKeyPressed(KEY_M) || IsMouseButtonPressed(MOUSE_BUTTON_RIGHT) || (IsGamepadAvailable(0) && IsGamepadButtonPressed(0, GAMEPAD_BUTTON_RIGHT_FACE_RIGHT));

    // Update Core C++ Simulation
    g_Game.update(dt, inputX, inputY, fireHeld, missilePressed);

    // Render Frame
    BeginDrawing();
    ClearBackground(BLACK);

    // 1. Draw Starfield Background
    DrawText("EARTH DEFENDER - RAYLIB C++ ENGINE", 20, 20, 20, RAYWHITE);
    
    // Draw HUD
    DrawText(TextFormat("SCORE: %07d", g_Game.player.score), 20, 50, 18, GOLD);
    DrawText(TextFormat("LIVES: %d", g_Game.player.lives), 20, 75, 18, RED);
    DrawText(TextFormat("SIM: %.1f us", g_Game.stats.simTimeUs), 680, 20, 16, SKYBLUE);
    DrawText(TextFormat("FPS: %d", GetFPS()), 680, 45, 16, LIME);

    EndDrawing();
#else
    // Headless update for benchmark testing
    g_Game.update(dt, 0.0f, 0.0f, false, false);
#endif
}

int main(int argc, char** argv) {
    g_Game.init();

#if defined(USE_RAYLIB)
    const int screenWidth = 800;
    const int screenHeight = 600;

    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_VSYNC_HINT);
    InitWindow(screenWidth, screenHeight, "Earth Defender - Raylib 2D Pixel Art Engine");
    SetTargetFPS(60);

#if defined(__EMSCRIPTEN__)
    emscripten_set_main_loop(UpdateDrawFrame, 0, 1);
#else
    while (!WindowShouldClose() && g_IsRunning) {
        UpdateDrawFrame();
    }
    CloseWindow();
#endif
#endif

    return 0;
}

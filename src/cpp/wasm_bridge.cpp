#include "game_engine.hpp"

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
WASM_EXPORT int engine_get_player_weapon_level() { return g_Engine.player.weaponLevel; }
WASM_EXPORT float engine_get_player_shield() { return g_Engine.player.shieldHp; }
WASM_EXPORT float engine_get_player_missile_cooldown() { return g_Engine.player.missileCooldown; }
WASM_EXPORT int engine_is_game_over() { return g_Engine.isGameOver ? 1 : 0; }
WASM_EXPORT int engine_is_victory() { return g_Engine.isVictory ? 1 : 0; }

WASM_EXPORT int engine_get_active_enemies() { return g_Engine.stats.activeEnemies; }
WASM_EXPORT int engine_get_active_bullets() { return g_Engine.stats.activeBullets; }
WASM_EXPORT int engine_get_active_particles() { return g_Engine.stats.activeParticles; }
WASM_EXPORT float engine_get_sim_time_us() { return g_Engine.stats.simTimeUs; }
WASM_EXPORT int engine_get_collision_checks() { return g_Engine.stats.collisionChecks; }

WASM_EXPORT void engine_nuke() {
    g_Engine.triggerNuke();
}

WASM_EXPORT int engine_is_boss_active() {
    return g_Engine.bossSystem.boss.active ? 1 : 0;
}

WASM_EXPORT float engine_get_boss_hp() {
    return g_Engine.bossSystem.boss.hp;
}

WASM_EXPORT float engine_get_boss_max_hp() {
    return g_Engine.bossSystem.boss.maxHp;
}

WASM_EXPORT float engine_get_boss_x() {
    return g_Engine.bossSystem.boss.pos.x;
}

WASM_EXPORT float engine_get_boss_y() {
    return g_Engine.bossSystem.boss.pos.y;
}

WASM_EXPORT int engine_get_boss_is_exploding() {
    return g_Engine.bossSystem.boss.isExploding ? 1 : 0;
}

} // extern "C"

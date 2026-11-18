# Earth Defender - C++ WebAssembly & Raylib Engine Build System
# Build targets for WebAssembly (Emscripten), Raylib, and Native Desktop

CXX = emcc
CXXFLAGS = -O3 -std=c++20 -Wall -msimd128 -flto
WASM_FLAGS = -s WASM=1 \
             -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
             -s EXPORTED_FUNCTIONS='["_engine_init","_engine_reset","_engine_tick","_engine_get_player_x","_engine_get_player_y","_engine_get_player_lives","_engine_get_player_score","_engine_get_player_weapon_level","_engine_get_player_shield","_engine_get_player_missile_cooldown","_engine_is_game_over","_engine_is_victory","_engine_get_active_enemies","_engine_get_active_bullets","_engine_get_active_particles","_engine_get_sim_time_us","_engine_get_collision_checks","_engine_nuke","_engine_is_boss_active","_engine_get_boss_hp","_engine_get_boss_max_hp","_engine_get_boss_x","_engine_get_boss_y","_engine_get_boss_is_exploding"]' \
             -s ALLOW_MEMORY_GROWTH=1 \
             -s INITIAL_MEMORY=16777216 \
             --no-entry

SOURCES = wasm_bridge.cpp game_engine.cpp
OUTPUT = ../../public/earth_defender.wasm

all: $(OUTPUT)

$(OUTPUT): $(SOURCES)
	$(CXX) $(CXXFLAGS) $(WASM_FLAGS) $(SOURCES) -o earth_defender.js
	mv earth_defender.wasm $(OUTPUT)
	@echo "✓ WebAssembly binary built successfully -> $(OUTPUT)"

# Raylib WebAssembly Compilation Target
raylib-wasm:
	$(CXX) -O3 -std=c++20 -DUSE_RAYLIB raylib_game.cpp game_engine.cpp -o ../../public/raylib_defender.html \
	-s USE_GLFW=3 -s ASYNCIFY -s ALLOW_MEMORY_GROWTH=1 -lraylib

# Native desktop compilation target with Raylib
raylib-native:
	g++ -O3 -std=c++20 -DUSE_RAYLIB raylib_game.cpp game_engine.cpp -o earth_defender_raylib -lraylib -lGL -lm -lpthread -ldl -lrt -lX11
	@echo "✓ Native Raylib binary built successfully -> ./earth_defender_raylib"

clean:
	rm -f earth_defender.js earth_defender.wasm $(OUTPUT) earth_defender_raylib

.PHONY: all clean raylib-wasm raylib-native

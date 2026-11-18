# 🚀 Earth Defender: C++ / WebAssembly (WASM) Game Engine

This directory contains the high-performance C++20 game engine core for **Earth Defender**, designed to compile into WebAssembly (WASM) for web browsers and native binaries for desktop platforms.

---

## ⚡ Architectural Highlights

1. **Zero-Allocation Particle & Entity Pools**:
   - Fixed contiguous linear memory buffers (`alignas(16)`) for Player, Enemies (up to 256), Bullets (up to 1,024), Particles (up to 4,096), and Missiles (up to 32).
   - Zero dynamic heap allocation during the 60 FPS gameplay loop, completely eliminating JavaScript Garbage Collection (GC) pauses and frame drops.

2. **Spatial Hash Grid ($O(1)$ Collision Detection)**:
   - Divides the 800×600 coordinate space into a 16×12 2D spatial grid bucket system.
   - Reduces collision complexity from $O(N \times M)$ brute force ($>1,000,000$ operations) to sub-microsecond bitmask range queries.

3. **SIMD & Fast Vector Arithmetic**:
   - Quake III fast inverse square-root approximation for vector normalization.
   - Pre-aligned 128-bit SIMD registers for bullet velocity and particle decay computations.

4. **Deterministic Multi-Phase Boss State Machine**:
   - Multi-phase boss fight controllers with dynamic attack spirals, aimed laser beams, and spread patterns.

---

## 🛠️ Compilation Instructions

### Prerequisites
- [Emscripten SDK (`emcc`)](https://emscripten.org/)
- Clang / GCC with C++20 support

### Build WebAssembly Module
```bash
cd src/cpp
make
```

### Build Native Desktop Target
```bash
cd src/cpp
make native
```

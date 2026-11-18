#include "game_engine.hpp"
#include <cstdlib>
#include <cmath>
#include <algorithm>

namespace EarthDefender {

void GameEngine::init() {
    bullets.init();
    particles.init();
    enemies.init();
    bossSystem.init();
    grid.clear();
    std::memset(powerups, 0, sizeof(powerups));
    std::memset(missiles, 0, sizeof(missiles));
    std::memset(&stats, 0, sizeof(stats));

    reset(false, 0x00FFCCFF, 0x00FF88FF, 1);
}

void GameEngine::reset(bool hardcore, uint32_t shipColor, uint32_t laserColor, uint8_t startStage) {
    player.pos = Vec2(-250.0f, 0.0f);
    player.vel = Vec2(0.0f, 0.0f);
    player.radius = 18.0f;
    player.lives = hardcore ? 1 : 3;
    player.score = 0;
    player.multiplier = 1.0f;
    player.weaponLevel = 1;
    player.shieldHp = 0.0f;
    player.maxShieldHp = 3.0f;
    player.invulnerableTimer = 2.0f;
    player.fireCooldown = 0.0f;
    player.missileCooldown = 0.0f;
    player.maxMissileCooldown = 5.0f;
    player.shipColor = shipColor;
    player.laserColor = laserColor;
    player.isAlive = 1;
    player.hasDrones = 0;
    player.hardcoreMode = hardcore ? 1 : 0;

    bullets.clear();
    particles.clear();
    enemies.clear();
    bossSystem.init();
    grid.clear();

    for (int i = 0; i < MAX_POWERUPS; ++i) powerups[i].active = 0;
    for (int i = 0; i < MAX_MISSILES; ++i) missiles[i].active = 0;

    currentStage = startStage;
    stageTimer = 0.0f;
    nextSpawnTimer = 1.0f;
    isGameOver = false;
    isVictory = false;
    asteroidWarning = false;
    missileWarning = false;
}

void GameEngine::fireWeapon() {
    if (player.fireCooldown > 0.0f || !player.isAlive) return;

    float px = player.pos.x + 20.0f;
    float py = player.pos.y;
    float speed = 650.0f;

    switch (player.weaponLevel) {
        case 1:
            // Single forward laser
            bullets.spawn(px, py, speed, 0.0f, 5.0f, 1.0f, true, 0, player.laserColor);
            player.fireCooldown = 0.14f;
            break;
        case 2:
            // Dual parallel lasers
            bullets.spawn(px, py + 8.0f, speed, 0.0f, 5.0f, 1.0f, true, 0, player.laserColor);
            bullets.spawn(px, py - 8.0f, speed, 0.0f, 5.0f, 1.0f, true, 0, player.laserColor);
            player.fireCooldown = 0.13f;
            break;
        case 3:
            // 3-way spread
            bullets.spawn(px, py, speed, 0.0f, 5.0f, 1.0f, true, 0, player.laserColor);
            bullets.spawn(px - 5.0f, py + 10.0f, speed * 0.96f, 120.0f, 4.5f, 1.0f, true, 0, player.laserColor);
            bullets.spawn(px - 5.0f, py - 10.0f, speed * 0.96f, -120.0f, 4.5f, 1.0f, true, 0, player.laserColor);
            player.fireCooldown = 0.12f;
            break;
        case 4:
        case 5:
        default:
            // 5-way heavy plasma barrage
            bullets.spawn(px, py, speed * 1.1f, 0.0f, 6.0f, 1.5f, true, 1, player.laserColor);
            bullets.spawn(px - 5.0f, py + 12.0f, speed, 140.0f, 5.0f, 1.2f, true, 0, player.laserColor);
            bullets.spawn(px - 5.0f, py - 12.0f, speed, -140.0f, 5.0f, 1.2f, true, 0, player.laserColor);
            bullets.spawn(px - 10.0f, py + 22.0f, speed * 0.9f, 260.0f, 4.5f, 1.0f, true, 0, player.laserColor);
            bullets.spawn(px - 10.0f, py - 22.0f, speed * 0.9f, -260.0f, 4.5f, 1.0f, true, 0, player.laserColor);
            player.fireCooldown = 0.10f;
            break;
    }
}

void GameEngine::fireMissile() {
    if (player.missileCooldown > 0.0f || !player.isAlive) return;

    for (int i = 0; i < MAX_MISSILES; ++i) {
        if (!missiles[i].active) {
            missiles[i].pos = Vec2(player.pos.x, player.pos.y);
            missiles[i].vel = Vec2(180.0f, (rand() % 40 - 20) * 4.0f);
            missiles[i].life = 0.0f;
            missiles[i].maxLife = 4.0f;
            missiles[i].targetEnemyIndex = -1;
            missiles[i].active = 1;
            player.missileCooldown = player.maxMissileCooldown;
            break;
        }
    }
}

void GameEngine::spawnPowerup(float x, float y, PowerupKind kind) {
    for (int i = 0; i < MAX_POWERUPS; ++i) {
        if (!powerups[i].active) {
            powerups[i].pos = Vec2(x, y);
            powerups[i].vel = Vec2(-45.0f, 0.0f);
            powerups[i].radius = 14.0f;
            powerups[i].life = 0.0f;
            powerups[i].kind = kind;
            powerups[i].active = 1;
            break;
        }
    }
}

void GameEngine::triggerNuke() {
    // Annihilate all non-boss enemies and enemy bullets
    for (int i = 0; i < MAX_ENEMIES; ++i) {
        if (enemies.enemies[i].active && !enemies.enemies[i].isExploding) {
            enemies.enemies[i].isExploding = 1;
            enemies.enemies[i].explodeTimer = 0.0f;
            player.score += enemies.enemies[i].scoreValue;
            particles.emitExplosion(enemies.enemies[i].pos.x, enemies.enemies[i].pos.y, 16, 160.0f, 0xFFFF55FF, 0xFF3300FF, 6.0f);
        }
    }

    for (int i = 0; i < MAX_BULLETS; ++i) {
        if (bullets.pool[i].active && !bullets.pool[i].isPlayer) {
            bullets.pool[i].active = 0;
            particles.emit(bullets.pool[i].pos.x, bullets.pool[i].pos.y, 0.0f, 0.0f, 4.0f, 0.2f, 0xFFFFFFFF, 0x00000000, 0);
        }
    }

    if (bossSystem.boss.active) {
        bossSystem.takeDamage(150.0f, particles);
    }
}

void GameEngine::checkCollisions() {
    // 1. Build Spatial Grid with active enemies
    grid.clear();
    for (int i = 0; i < MAX_ENEMIES; ++i) {
        if (enemies.enemies[i].active && !enemies.enemies[i].isExploding) {
            grid.insert(static_cast<uint16_t>(i), enemies.enemies[i].pos.x, enemies.enemies[i].pos.y, enemies.enemies[i].radius);
        }
    }

    // 2. Player Bullets vs Enemies / Boss
    for (int b = 0; b < MAX_BULLETS; ++b) {
        Bullet& bullet = bullets.pool[b];
        if (!bullet.active || !bullet.isPlayer) continue;

        // Query spatial grid around bullet
        grid.queryRange(bullet.pos.x, bullet.pos.y, bullet.radius + 30.0f, [&](uint16_t enemyIdx) {
            EnemyState& enemy = enemies.enemies[enemyIdx];
            if (!enemy.active || enemy.isExploding) return true;

            if (MathSIMD::circleIntersect(bullet.pos.x, bullet.pos.y, bullet.radius, enemy.pos.x, enemy.pos.y, enemy.radius)) {
                // Hit enemy!
                enemy.hp -= bullet.damage;
                bullet.active = 0;
                particles.emit(bullet.pos.x, bullet.pos.y, 40.0f, (rand() % 40 - 20) * 2.0f, 3.5f, 0.15f, 0xFFFFFFFF, player.laserColor, 0);

                if (enemy.hp <= 0.0f) {
                    enemy.isExploding = 1;
                    enemy.explodeTimer = 0.0f;
                    player.score += static_cast<int32_t>(enemy.scoreValue * player.multiplier);

                    particles.emitExplosion(enemy.pos.x, enemy.pos.y, 14, 150.0f, 0xFFAA00FF, 0xFF3300FF, 5.0f);

                    // Chance to drop powerup
                    if (rand() % 100 < 15) {
                        PowerupKind kind = static_cast<PowerupKind>(rand() % 6);
                        spawnPowerup(enemy.pos.x, enemy.pos.y, kind);
                    }
                }
                return false; // Stop checking other enemies for this single bullet
            }
            return true;
        });

        // Check Boss
        if (bullet.active && bossSystem.boss.active && bossSystem.boss.phase != BossPhase::INTRO) {
            if (MathSIMD::circleIntersect(bullet.pos.x, bullet.pos.y, bullet.radius, bossSystem.boss.pos.x, bossSystem.boss.pos.y, bossSystem.boss.radius)) {
                bossSystem.takeDamage(bullet.damage, particles);
                bullet.active = 0;
            }
        }
    }

    // 3. Enemy Bullets vs Player
    if (player.isAlive && player.invulnerableTimer <= 0.0f) {
        for (int b = 0; b < MAX_BULLETS; ++b) {
            Bullet& bullet = bullets.pool[b];
            if (!bullet.active || bullet.isPlayer) continue;

            if (MathSIMD::circleIntersect(bullet.pos.x, bullet.pos.y, bullet.radius, player.pos.x, player.pos.y, player.radius)) {
                bullet.active = 0;
                
                // Shield absorption
                if (player.shieldHp > 0.0f) {
                    player.shieldHp -= 1.0f;
                    particles.emitExplosion(player.pos.x, player.pos.y, 8, 80.0f, 0x00FFFFFF, 0x0044FFFF, 4.0f);
                } else {
                    // Player hit
                    player.lives--;
                    player.invulnerableTimer = 2.5f;
                    particles.emitExplosion(player.pos.x, player.pos.y, 24, 200.0f, 0xFF5500FF, 0xFFFF00FF, 6.0f);

                    if (player.lives <= 0) {
                        player.isAlive = 0;
                        isGameOver = true;
                    }
                }
                break;
            }
        }
    }

    // 4. Powerups vs Player
    if (player.isAlive) {
        for (int p = 0; p < MAX_POWERUPS; ++p) {
            PowerupItem& item = powerups[p];
            if (!item.active) continue;

            if (MathSIMD::circleIntersect(item.pos.x, item.pos.y, item.radius, player.pos.x, player.pos.y, player.radius + 10.0f)) {
                item.active = 0;
                player.score += 250;

                switch (item.kind) {
                    case PowerupKind::WEAPON_UPGRADE:
                        if (player.weaponLevel < 5) player.weaponLevel++;
                        break;
                    case PowerupKind::SHIELD:
                        player.shieldHp = player.maxShieldHp;
                        break;
                    case PowerupKind::HEALTH:
                        if (player.lives < 5) player.lives++;
                        break;
                    case PowerupKind::NUKE_BOMB:
                        triggerNuke();
                        break;
                    default:
                        break;
                }

                particles.emitExplosion(player.pos.x, player.pos.y, 16, 120.0f, 0x00FF88FF, 0xFFFFFFFF, 4.0f);
            }
        }
    }
}

void GameEngine::update(float dt, float inputX, float inputY, bool fireHeld, bool missilePressed) {
    auto startTime = std::chrono::high_resolution_clock::now();

    // 1. Player Physics & Input
    if (player.isAlive) {
        float moveSpeed = 340.0f;
        player.pos.x += inputX * moveSpeed * dt;
        player.pos.y += inputY * moveSpeed * dt;

        // Screen Clamp
        player.pos.x = std::clamp(player.pos.x, -HALF_WIDTH + 30.0f, HALF_WIDTH - 30.0f);
        player.pos.y = std::clamp(player.pos.y, -HALF_HEIGHT + 30.0f, HALF_HEIGHT - 30.0f);

        // Engine exhaust particles
        particles.emitThruster(player.pos.x - 22.0f, player.pos.y, -1.0f, 0.0f, player.shipColor);

        // Cooldowns
        if (player.fireCooldown > 0.0f) player.fireCooldown -= dt;
        if (player.missileCooldown > 0.0f) player.missileCooldown -= dt;
        if (player.invulnerableTimer > 0.0f) player.invulnerableTimer -= dt;

        if (fireHeld) fireWeapon();
        if (missilePressed) fireMissile();
    }

    // 2. Stage wave spawner logic
    stageTimer += dt;
    nextSpawnTimer -= dt;
    if (nextSpawnTimer <= 0.0f && !bossSystem.boss.active) {
        float spawnY = (rand() % 460) - 230.0f;
        int enemyRoll = rand() % 100;

        if (enemyRoll < 40) {
            enemies.spawn(EntityType::ENEMY_SCOUT, HALF_WIDTH + 40.0f, spawnY, rand() % 3, 2.0f, 16.0f, 100);
            nextSpawnTimer = 0.8f;
        } else if (enemyRoll < 70) {
            enemies.spawn(EntityType::ENEMY_HEAVY, HALF_WIDTH + 40.0f, spawnY, 0, 10.0f, 30.0f, 350);
            nextSpawnTimer = 1.4f;
        } else if (enemyRoll < 90) {
            enemies.spawn(EntityType::ASTEROID_LARGE, HALF_WIDTH + 50.0f, spawnY, 5, 25.0f, 32.0f, 200);
            nextSpawnTimer = 1.0f;
        } else {
            enemies.spawn(EntityType::ENEMY_INTERCEPTOR, HALF_WIDTH + 40.0f, spawnY, 3, 4.0f, 18.0f, 250);
            nextSpawnTimer = 1.8f;
        }

        // Spawn Boss when stage reaches 45 seconds
        if (stageTimer > 45.0f && !bossSystem.boss.active) {
            bossSystem.spawn(currentStage, "MOTHER BRAIN TITAN", 350.0f * currentStage, 75.0f);
        }
    }

    // 3. Update Systems
    bullets.update(dt);
    particles.update(dt);
    enemies.update(dt, player.pos.x, player.pos.y, bullets, particles, nullptr);
    bossSystem.update(dt, player.pos.x, player.pos.y, bullets, particles, nullptr);

    // 4. Powerups movement
    for (int p = 0; p < MAX_POWERUPS; ++p) {
        if (!powerups[p].active) continue;
        powerups[p].pos += powerups[p].vel * dt;
        powerups[p].life += dt;
        if (powerups[p].pos.x < -HALF_WIDTH - 50.0f || powerups[p].life > 20.0f) {
            powerups[p].active = 0;
        }
    }

    // 5. Collision checks
    checkCollisions();

    // Telemetry Benchmarks
    auto endTime = std::chrono::high_resolution_clock::now();
    stats.simTimeUs = std::chrono::duration<float, std::micro>(endTime - startTime).count();
    stats.activeEnemies = enemies.activeCount;
    stats.activeBullets = bullets.activeCount;
    stats.activeParticles = particles.activeCount;
    stats.collisionChecks = grid.totalQueries;
    stats.totalFrames++;
}

} // namespace EarthDefender

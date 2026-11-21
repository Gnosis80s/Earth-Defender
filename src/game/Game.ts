import * as THREE from 'three';
import { AssetManager } from './AssetManager';
import { InputManager } from './InputManager';
import { Player } from './entities/Player';
import { BulletManager, Bullet } from './BulletManager';
import { ParticleManager } from './ParticleManager';
import { Level } from './Level';
import { Enemy } from './entities/Enemy';
import { Boss } from './entities/Boss';
import { Powerup, PowerupType } from './entities/Powerup';
import { Missile } from './entities/Missile';
import { AchievementManager } from './AchievementManager';
import { SoundManager } from './SoundManager';
import { Scheduler } from './Scheduler';

/** Visual parameters for a projectile hitting a boss turret or hull. */
interface BossImpactFx {
  turretColor: number;
  turretCount: number;
  bodyColor: number;
  bodyCount: number;
}

const BULLET_BOSS_FX: BossImpactFx = { turretColor: 0xe879f9, turretCount: 8, bodyColor: 0xffaa00, bodyCount: 10 };
const MISSILE_BOSS_FX: BossImpactFx = { turretColor: 0xff5500, turretCount: 18, bodyColor: 0xff5500, bodyCount: 22 };
const MISSILE2_BOSS_FX: BossImpactFx = { turretColor: 0x00ffff, turretCount: 28, bodyColor: 0x00ffff, bodyCount: 32 };

/** Score values for kills (bosses and stage clears are scored elsewhere). */
const SCORE_BULLET_KILL = 100;
const SCORE_MISSILE_KILL = 150;
const SCORE_GOLD_ASTEROID = 2000;

export class Game {
  /**
   * The simulation runs at a fixed 60 Hz regardless of display refresh rate.
   * All existing tuning (speeds, per-frame spawn chances, cooldowns) was
   * authored against ~60 fps, so 60 Hz keeps the original balance while
   * making it identical on 60/120/144/240 Hz screens. Rendering interpolates
   * between the last two simulation states so motion stays smooth.
   */
  static readonly STEP = 1 / 60;
  /** Max sim steps per rendered frame; beyond this we drop time instead of spiralling. */
  private static readonly MAX_STEPS_PER_FRAME = 8;
  /** Per-step movement above this is treated as a teleport and not interpolated. */
  private static readonly TELEPORT_THRESHOLD = 120;

  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.OrthographicCamera;

  player!: Player;
  bullets!: BulletManager;
  particles!: ParticleManager;
  level!: Level;
  powerups: Powerup[] = [];
  missiles: Missile[] = [];

  clock = new THREE.Clock();
  score = 0;
  lives = 3;
  currentStage = 1;
  maxStages = 5;
  gameOver = false;
  victory = false;
  weaponUpgradeCooldown = 0;
  isReadyPhase = false;

  /** True while the pause menu is up (sim, timers and audio frozen). */
  paused = false;
  /** True when the player quit to the menu; the loop idles until the next reset(). */
  stopped = true;

  /** Game-time event queue; replaces setTimeout for anything gameplay-related. */
  readonly scheduler = new Scheduler();
  /** Seconds of simulation time elapsed (passed to entities as `time`). */
  simTime = 0;
  private accumulator = 0;
  private stepIndex = 0;
  private prevCameraX = 0;
  /** Scratch list of objects whose transforms were swapped for interpolation this frame. */
  private interpolated: THREE.Object3D[] = [];

  onScoreUpdate: (score: number) => void = () => {};
  onLivesUpdate: (lives: number) => void = () => {};
  onMissileCooldownUpdate: (cooldown: number, maxCooldown: number) => void = () => {};
  onWeaponLevelUpdate: (level: number) => void = () => {};
  onStageUpdate: (stage: number) => void = () => {};
  onStageClear: (clearedStage: number) => void = () => {};
  onBossHpUpdate: (bossData: { active: boolean; hp: number; maxHp: number; name: string; isExploding: boolean } | null) => void = () => {};
  onAsteroidWarningUpdate: (warning: 'field' | 'storm' | 'mines' | null) => void = () => {};
  onMissileWarningUpdate: (active: boolean) => void = () => {};
  onGameOver: (victory: boolean) => void = () => {};
  onReadyChange: (showing: boolean) => void = () => {};
  onPauseChange: (paused: boolean) => void = () => {};

  reset(hardcoreMode = false, shipType = 'player', laserColor = 'bulletPlayer', startStage = 1) {
    InputManager.reset();
    // Kill anything queued by a previous run (stage transitions, death sequence...).
    this.scheduler.clear();
    this.clock.getDelta();
    this.accumulator = 0;
    this.simTime = 0;
    this.hitStopTimer = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
    this.lastBossHp = -1;
    this.lastBossExploding = false;
    this.stopped = false;
    this.setPaused(false);

    this.score = 0;
    this.lives = hardcoreMode ? 1 : 3;
    this.currentStage = startStage;
    this.gameOver = false;
    this.victory = false;
    this.weaponUpgradeCooldown = 0;

    this.level.hardcoreMode = hardcoreMode;

    // Clear bullets
    for (const b of this.bullets.bullets) {
      b.active = false;
      b.mesh.visible = false;
      this.bullets['pool'].release(b);
    }
    this.bullets.bullets = [];

    // Clear particles
    this.particles.clear();

    // Clear missiles
    for (const m of this.missiles) {
      m.destroy(this.scene);
    }
    this.missiles = [];

    // Clear enemies
    for (const e of this.level.enemies) {
      e.destroy(this.scene);
    }
    this.level.enemies = [];

    // Clear powerups
    for (const p of this.powerups) {
      p.destroy(this.scene);
    }
    this.powerups = [];

    if (this.level.boss) {
      this.level.boss.destroy(this.scene);
      this.level.boss = null;
    }

    this.level.setStage(startStage);
    AchievementManager.resetStageHits();
    this.camera.position.x = 0;
    this.prevCameraX = 0;

    this.player.resetState();
    this.player.setShipStyle(shipType, laserColor);
    this.player.addShield();
    this.player.active = true;
    this.player.mesh.visible = true;
    if (startStage === 5) {
      this.player.startStage4Entry(-180);
    } else if (startStage === 1) {
      this.player.startStage1Takeoff(-220);
    } else {
      this.player.mesh.position.set(-250, 0, 0);
    }
    this.player.hp = 1;
    this.player.missileCooldown = 0;

    this.onMissileCooldownUpdate(0, 5.0);
    this.onWeaponLevelUpdate(1);
    this.onScoreUpdate(0);
    this.onLivesUpdate(this.lives);
    this.onStageUpdate(startStage);
    this.startReadyPhase();
    this.onBossHpUpdate(null);
    this.player.invulnTimer = 2.0;
  }

  /** Quit to menu: stop simulating and drop any pending events. */
  stop() {
    this.scheduler.clear();
    this.setPaused(false);
    this.stopped = true;
    this.isReadyPhase = false;
    this.onReadyChange(false);
  }

  /**
   * Size the drawing buffer for a playfield shown at cssW x cssH CSS pixels.
   *
   * "Sharp bilinear" scaling: render the fixed 800x600 world at the smallest
   * *integer* multiple that covers the display, and let the browser scale that
   * down smoothly. Nearest-filtered pixel art stays evenly crisp at any window
   * size, without the uneven pixel widths of direct non-integer upscaling.
   */
  resize(cssW: number, cssH: number) {
    if (!this.renderer || cssW <= 0 || cssH <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(cssW / 800, cssH / 600) * dpr;
    const k = Math.min(4, Math.max(1, Math.ceil(scale - 0.01)));
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== 800 * k || size.y !== 600 * k) {
      this.renderer.setSize(800 * k, 600 * k, false);
      // Resizing clears the canvas; redraw so a paused frame doesn't vanish.
      if (this.scene && !this.stopped) this.render(1, 0);
    }
  }

  setPaused(paused: boolean) {
    if (paused && (this.stopped || this.gameOver || this.victory)) return;
    if (this.paused === paused) return;
    this.paused = paused;
    SoundManager.setSuspended(paused);
    // Keys released while paused/unfocused never send keyup; start clean.
    InputManager.reset();
    this.onPauseChange(paused);
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  /** Freeze gameplay for the "READY" card at the start of every stage. */
  private startReadyPhase() {
    this.isReadyPhase = true;
    this.onReadyChange(true);
    this.scheduler.after(2.0, () => {
      this.isReadyPhase = false;
      this.onReadyChange(false);
    });
  }

  init(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    // Drawing-buffer size is managed by resize(); CSS size by the page layout.
    this.renderer.setSize(800, 600, false);
    this.renderer.setClearColor(0x050510);
    this.renderer.localClippingEnabled = true; // the stage 4 worm is clipped at the lunar ground line

    this.scene = new THREE.Scene();

    const aspect = 800 / 600;
    const viewSize = 600;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2, viewSize * aspect / 2,
      viewSize / 2, -viewSize / 2,
      0.1, 1000
    );
    this.camera.position.z = 100;

    AssetManager.init();
    AssetManager.isBusy = () => !this.stopped && !this.paused && !this.isReadyPhase && !this.gameOver && !this.victory;
    InputManager.init();

    this.bullets = new BulletManager(this.scene);
    this.particles = new ParticleManager(this.scene);
    this.level = new Level(this.scene, this.camera);
    this.level.moon.ensureMap(this.renderer); // one-time GPU bake of the Moon's surface
    this.level.onAsteroidWarningUpdate = (active, kind = 'field') => this.onAsteroidWarningUpdate(active ? kind : null);
    this.level.onMissileWarningUpdate = (active) => this.onMissileWarningUpdate(active);
    this.player = new Player(this.scene);

    // Auto-pause when the player tabs away or the window loses focus.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true);
    });
    window.addEventListener('blur', () => this.setPaused(true));

    this.animate();
  }

  shakeMagnitude = 0;
  shakeDuration = 0;
  hitStopTimer = 0;

  private static readonly _turretPoint = new THREE.Vector3();
  private lastBossHp = -1;
  private lastBossExploding = false;

  addScreenShake(magnitude: number, duration: number) {
    this.shakeMagnitude = magnitude;
    this.shakeDuration = duration;
  }

  triggerHitStop(duration: number = 0.045) {
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  animate = () => {
    requestAnimationFrame(this.animate);

    // Always consume the clock so resuming never produces one giant frame.
    const frameDt = Math.min(this.clock.getDelta(), 0.25);

    if (this.stopped || this.gameOver || this.victory) return;

    if (InputManager.consumePauseToggle()) this.togglePause();
    if (this.paused) return; // last rendered frame stays on screen

    // Hit-stop (micro-freeze) for impact weight: sim frozen, effects keep moving.
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= frameDt;
      this.particles.update(frameDt);
      this.render(1, frameDt);
      return;
    }

    this.accumulator += frameDt;
    let steps = 0;
    let interrupted = false;
    while (this.accumulator >= Game.STEP) {
      this.snapshotTransforms();
      this.step(Game.STEP);
      this.accumulator -= Game.STEP;
      steps++;

      // A kill triggered hit-stop or the run ended: stop stepping and show
      // the exact frame it happened on.
      if (this.hitStopTimer > 0 || this.gameOver || this.victory || this.stopped) {
        this.accumulator = 0;
        interrupted = true;
        break;
      }
      if (steps >= Game.MAX_STEPS_PER_FRAME) {
        this.accumulator = 0; // too far behind (tab stall, slow device): drop time
        break;
      }
    }

    // Cosmetic systems run at render rate for smoothness.
    this.particles.update(frameDt);
    this.level.updateStarfield(this.isReadyPhase ? 0 : frameDt);

    const alpha = interrupted ? 1 : this.accumulator / Game.STEP;
    this.render(alpha, frameDt);
  }

  /** Advance the whole simulation by exactly one fixed step. */
  private step(dt: number) {
    this.stepIndex++;
    this.simTime += dt;
    this.scheduler.update(dt);

    const time = this.simTime;
    const activeDt = this.isReadyPhase ? 0 : dt;

    if (this.weaponUpgradeCooldown > 0) {
      this.weaponUpgradeCooldown -= activeDt;
    }

    this.level.update(activeDt, this.particles, this.player);
    this.player.update(activeDt, time, this.camera.position.x, this.bullets, this.particles, this);
    this.bullets.update(activeDt, this.camera.position.x, this.player.mesh.position);

    // Update missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.update(activeDt, time, this.camera.position.x, this.level.enemies, this.level.boss, this.particles);
      if (!m.active) {
        m.destroy(this.scene);
        const last = this.missiles.pop();
        if (last && i < this.missiles.length) {
          this.missiles[i] = last;
        }
      }
    }

    // Update enemies
    for (let i = this.level.enemies.length - 1; i >= 0; i--) {
      const e = this.level.enemies[i];
      e.update(activeDt, time, this.camera.position.x, this.bullets, this.player.mesh.position, this.particles, this);
      if (!e.active) {
        e.destroy(this.scene);
        const last = this.level.enemies.pop();
        if (last && i < this.level.enemies.length) {
          this.level.enemies[i] = last;
        }
      }
    }

    // Update powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.update(activeDt, time, this.camera.position.x);
      if (!p.active) {
        p.destroy(this.scene);
        const last = this.powerups.pop();
        if (last && i < this.powerups.length) {
          this.powerups[i] = last;
        }
      }
    }

    this.updateBoss(activeDt, time);
    this.checkCollisions();
  }

  private updateBoss(activeDt: number, time: number) {
    const boss = this.level.boss;
    if (boss && boss.active) {
      boss.update(activeDt, time, this.camera.position.x, this.bullets, this.particles, this, this.player.mesh.position);

      // Clear enemy bullets when boss is exploding so player can safely watch
      if (boss.isExploding) {
        this.clearEnemyBullets();
      }

      const currentHp = Math.max(0, boss.hp);
      if (currentHp !== this.lastBossHp || boss.isExploding !== this.lastBossExploding) {
        this.lastBossHp = currentHp;
        this.lastBossExploding = boss.isExploding;
        this.onBossHpUpdate({
          active: true,
          hp: currentHp,
          maxHp: boss.maxHp,
          name: boss.name,
          isExploding: boss.isExploding
        });
      }
    } else if (boss && !boss.active && this.level.bossActive) {
      this.onBossDefeated(boss);
    }
  }

  /** Boss finished its full explosion sequence: score, exit animation, next stage. */
  private onBossDefeated(boss: Boss) {
    this.level.bossActive = false;
    this.level.bossDefeated = true;
    this.lastBossHp = -1;
    this.lastBossExploding = false;
    AchievementManager.recordBossKill();
    this.onBossHpUpdate(null);
    boss.destroy(this.scene);
    this.level.boss = null;

    if (this.currentStage === 4) {
      if (this.level.blastDoor) {
        this.level.blastDoor.open();
      }
      const doorX = this.level.blastDoor ? this.level.blastDoor.x : this.camera.position.x + 100;
      this.player.startStage3Exit(doorX);
    } else {
      this.player.isHyperspaceJump = true;
      this.player.hyperspaceTimer = 0;
    }

    if (this.currentStage < this.maxStages) {
      const clearedStage = this.currentStage;
      this.addScore(5000 * clearedStage);

      this.scheduler.after(2.5, () => this.onStageClear(clearedStage));
      this.scheduler.after(5.0, () => this.advanceStage());
    } else if (!this.victory) {
      this.scheduler.after(2.5, () => {
        this.addScore(20000);
        this.victory = true;
        this.onGameOver(true);
      });
    }
  }

  private advanceStage() {
    this.currentStage++;
    this.level.setStage(this.currentStage);
    AchievementManager.resetStageHits();
    this.onStageUpdate(this.currentStage);
    this.level.boss = null;
    this.player.isHyperspaceJump = false;
    this.player.hyperspaceTimer = 0;
    this.player.isStage3Exit = false;
    this.player.mesh.rotation.z = 0;
    this.camera.position.x = this.level.distance;

    if (this.currentStage === 5) {
      this.player.startStage4Entry(this.camera.position.x - 180);
    } else if (this.currentStage === 1) {
      this.player.startStage1Takeoff(this.camera.position.x - 220);
    } else {
      this.player.mesh.position.set(this.camera.position.x - 250, 0, 0);
    }

    this.clearEnemyBullets();
    this.startReadyPhase();
  }

  private clearEnemyBullets() {
    for (const b of this.bullets.bullets) {
      if (!b.isPlayer) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering with interpolation
  // ---------------------------------------------------------------------------

  /** Record each top-level object's transform before a sim step. */
  private snapshotTransforms() {
    this.prevCameraX = this.camera.position.x;
    const stamp = this.stepIndex + 1; // the step about to run
    const children = this.scene.children;
    for (let i = 0; i < children.length; i++) {
      const o = children[i];
      const ud = o.userData;
      ud.ipx = o.position.x;
      ud.ipy = o.position.y;
      ud.ipr = o.rotation.z;
      ud.istep = stamp;
    }
  }

  /**
   * Draw the scene `alpha` of the way between the previous and current sim
   * states, then restore the true (current) transforms so the simulation
   * never sees interpolated or shaken values.
   */
  private render(alpha: number, frameDt: number) {
    const lerpOn = alpha < 1;
    const interpolated = this.interpolated;
    interpolated.length = 0;

    const children = this.scene.children;
    const limit = Game.TELEPORT_THRESHOLD;
    for (let i = 0; i < children.length; i++) {
      const o = children[i];
      if (!o.visible) continue;
      const ud = o.userData;
      const offsetY: number = ud.renderOffsetY || 0;

      let x = o.position.x;
      let y = o.position.y;
      let r = o.rotation.z;
      let changed = offsetY !== 0;

      // ud.istep !== stepIndex means it spawned during the last step: no history.
      if (lerpOn && ud.istep === this.stepIndex) {
        const dx = x - ud.ipx;
        const dy = y - ud.ipy;
        // Large jumps are wraps/teleports: snap instead of smearing across the screen.
        if (dx <= limit && dx >= -limit && dy <= limit && dy >= -limit) {
          let dr = r - ud.ipr;
          if (dr > Math.PI || dr < -Math.PI) dr = 0;
          x = ud.ipx + dx * alpha;
          y = ud.ipy + dy * alpha;
          r = ud.ipr + dr * alpha;
          changed = true;
        }
      }

      if (!changed) continue;
      ud.icx = o.position.x;
      ud.icy = o.position.y;
      ud.icr = o.rotation.z;
      o.position.x = x;
      o.position.y = y + offsetY; // cosmetic offsets (e.g. hover bob) never touch the sim
      o.rotation.z = r;
      interpolated.push(o);
    }

    // Camera: interpolate the scroll, then add shake on top (render-only).
    const camX = this.camera.position.x;
    const camY = this.camera.position.y;
    const camDx = camX - this.prevCameraX;
    const camLerp = lerpOn && Math.abs(camDx) <= Game.TELEPORT_THRESHOLD;
    let renderCamX = camLerp ? this.prevCameraX + camDx * alpha : camX;
    let renderCamY = camY;
    if (this.shakeDuration > 0) {
      this.shakeDuration -= frameDt;
      renderCamX += (Math.random() - 0.5) * this.shakeMagnitude;
      renderCamY += (Math.random() - 0.5) * this.shakeMagnitude;
    }
    this.camera.position.x = renderCamX;
    this.camera.position.y = renderCamY;

    this.renderer.render(this.scene, this.camera);

    this.camera.position.x = camX;
    this.camera.position.y = camY;
    for (let i = 0; i < interpolated.length; i++) {
      const o = interpolated[i];
      const ud = o.userData;
      o.position.x = ud.icx;
      o.position.y = ud.icy;
      o.rotation.z = ud.icr;
    }
  }

  // ---------------------------------------------------------------------------
  // Spawning helpers
  // ---------------------------------------------------------------------------

  launchMissiles() {
    // No screen shake on firing missiles as requested
    const px = this.player.mesh.position.x + 16;
    const py = this.player.mesh.position.y;
    const count = this.player.missileCount;
    const level = this.player.missileLevel;

    SoundManager.playMissile();

    // Spread calculation for dynamic missile count (4, 5, 6, etc.)
    const spreadSpan = Math.min(64, (count - 1) * 14);
    const vySpan = Math.min(440, (count - 1) * 100);

    for (let i = 0; i < count; i++) {
      const fraction = count > 1 ? (i / (count - 1)) - 0.5 : 0;
      const offsetY = fraction * spreadSpan;
      const vy = fraction * vySpan;

      const m = new Missile(this.scene, px, py + offsetY, vy, level);
      this.missiles.push(m);
      this.particles.spawnExplosion(px - 10, py + offsetY, level >= 2 ? 0x00ffff : 0xffaa00, level >= 2 ? 6 : 4);
    }
  }

  tryDropPowerup(x: number, y: number, isHeavy: boolean, forceTypes?: PowerupType[]) {
    if (forceTypes) {
      forceTypes.forEach((type, index) => {
        const offsetY = (index - (forceTypes.length - 1) / 2) * 32;
        const p = new Powerup(this.scene, type, x + (index % 2) * 15, y + offsetY);
        this.powerups.push(p);
      });
      return;
    }

    const dropChance = isHeavy ? 0.35 : 0.12;
    if (Math.random() < dropChance) {
      const candidates: PowerupType[] = [];

      // Shield ('S'): Do NOT drop if player already has a shield
      if (!this.player.hasShield) {
        candidates.push('S');
      }

      // Drone ('D'): Do NOT drop if player already has 2 drones
      if (this.player.drones.length < 2) {
        candidates.push('D');
      }

      // Weapon upgrades ('P', 'M', 'U'): Only if NOT on 10s weaponUpgradeCooldown
      if (this.weaponUpgradeCooldown <= 0) {
        if (this.player.weaponLevel < 3) {
          candidates.push('P');
          candidates.push('P'); // weighted
        }
        if (this.player.missileCount < 6) {
          candidates.push('M');
        }
        if (this.player.missileLevel < 2) {
          candidates.push('U');
        }
      }

      if (candidates.length > 0) {
        const selectedType = candidates[Math.floor(Math.random() * candidates.length)];
        const p = new Powerup(this.scene, selectedType, x, y);
        this.powerups.push(p);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Scoring & damage — the single place each outcome is handled
  // ---------------------------------------------------------------------------

  addScore(points: number) {
    this.score += points;
    AchievementManager.recordScore(this.score);
    this.onScoreUpdate(this.score);
  }

  private static isLargeExplosionType(type: string) {
    return type === 'heavy' || type === 'subboss1' || type === 'subboss_gatekeeper' ||
      type.startsWith('asteroid_large') || type === 'asteroid_gold';
  }

  /**
   * Damage an enemy and grant kill rewards if this hit destroyed it.
   * Sub-bosses don't die here: they enter a multi-second explosion sequence
   * and Enemy.update awards their score and drops when it finishes.
   */
  private damageEnemy(e: Enemy, amount: number, killScore: number) {
    const wasActive = e.active;
    e.takeDamage(amount);
    if (wasActive && !e.active) {
      this.onEnemyKilled(e, killScore);
    }
  }

  private onEnemyKilled(e: Enemy, killScore: number) {
    const x = e.mesh.position.x;
    const y = e.mesh.position.y;
    const isGold = e.type === 'asteroid_gold';

    if (isGold) {
      AchievementManager.recordGoldenAsteroidDestroyed();
      this.particles.spawnExplosion(x, y, 0xffd700, 60);
      this.particles.spawnExplosion(x, y, 0xffffff, 40);
      this.addScore(SCORE_GOLD_ASTEROID);
    } else {
      this.addScore(killScore);
    }
    AchievementManager.recordEnemyKill();

    if (e.type.startsWith('asteroid')) {
      // Rock dust rather than a fireball.
      this.particles.spawnExplosion(x, y, isGold ? 0xffd700 : 0xb89a7a, e.type === 'asteroid_chunk' ? 10 : 18);
      this.particles.spawnExplosion(x, y, 0x6b5a50, e.type === 'asteroid_large' ? 16 : 8);
      if (e.type === 'asteroid_large') this.splitAsteroid(e);
    } else {
      this.particles.spawnExplosion(x, y, 0xff4400, 20);
    }
    SoundManager.playExplosion(Game.isLargeExplosionType(e.type) ? 'large' : 'small', 0.8 + Math.random() * 0.4);

    if (isGold) {
      this.tryDropPowerup(x, y, true, ['P', 'M', 'S']);
    } else {
      this.tryDropPowerup(x, y, e.type === 'heavy');
    }
  }

  /** A destroyed large asteroid breaks into three fragments that fly apart. */
  private splitAsteroid(e: Enemy) {
    const base = Math.random() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const a = base + (k / 3) * Math.PI * 2;
      const chunk = new Enemy(this.scene, 'asteroid_chunk', e.mesh.position.x + Math.cos(a) * 12, e.mesh.position.y + Math.sin(a) * 12, 'straight');
      chunk.launch(e.driftVx + Math.cos(a) * 85, e.driftVy + Math.sin(a) * 85);
      this.level.enemies.push(chunk);
    }
  }

  /** Shoot down the first enemy turret-missile overlapping (pos, radius). */
  private interceptTurretMissile(turretMissiles: Bullet[], pos: THREE.Vector3, radius: number, fxCount: number): boolean {
    for (const eb of turretMissiles) {
      if (!eb.active) continue;
      if (this.circleIntersect(pos, radius, eb.mesh.position, 12)) {
        eb.active = false;
        eb.mesh.visible = false;
        this.particles.spawnExplosion(eb.mesh.position.x, eb.mesh.position.y, 0xff5500, fxCount);
        SoundManager.playExplosion('small', 0.8 + Math.random() * 0.4);
        this.addScore(50);
        return true;
      }
    }
    return false;
  }

  /** First live, on-screen enemy overlapping (pos, radius), or null. */
  private findEnemyHit(pos: THREE.Vector3, radius: number, minX: number, maxX: number): Enemy | null {
    for (const e of this.level.enemies) {
      if (!e.active || e.isExploding) continue;
      const ex = e.mesh.position.x;
      if (ex < minX || ex > maxX) continue;
      if (this.circleIntersect(pos, radius, e.mesh.position, e.radius)) return e;
    }
    return null;
  }

  /**
   * Resolve a player projectile against the boss: turrets first, then hull.
   * Returns true if the projectile was consumed.
   */
  private hitBoss(pos: THREE.Vector3, radius: number, damage: number, fx: BossImpactFx): boolean {
    const boss = this.level.boss;
    if (!boss || !boss.active || boss.isExploding) return false;

    for (const t of boss.turrets) {
      if (!t.active) continue;
      const tx = boss.mesh.position.x + t.offsetX;
      const ty = boss.mesh.position.y + t.offsetY;
      Game._turretPoint.set(tx, ty, 0);
      if (!this.circleIntersect(pos, radius, Game._turretPoint, 16)) continue;

      t.hp -= damage;
      this.particles.spawnExplosion(pos.x, pos.y, fx.turretColor, fx.turretCount);
      if (t.hp <= 0) {
        t.active = false;
        t.mesh.visible = false;
        this.particles.spawnExplosion(tx, ty, 0xd946ef, 35);
        this.particles.spawnExplosion(tx, ty, 0xffff00, 25);
        SoundManager.playExplosion('large', 0.8 + Math.random() * 0.4);
        this.addScreenShake(8, 0.2);
        this.triggerHitStop(0.05);
        AchievementManager.recordTurretDestroyed();
        this.addScore(500);
        boss.takeDamage(40);
      }
      return true;
    }

    if (boss.hullHit(pos, radius)) {
      const k = boss.weakSpotScale(pos);
      if (k > 0) boss.takeDamage(damage * k);
      if (k > 1) {
        // Weak spot: hot pink burst.
        this.particles.spawnExplosion(pos.x, pos.y, 0xff3a5a, fx.bodyCount + 6);
      } else if (k < 1) {
        // Armour: sparks glance off.
        this.particles.spawnSparks(pos.x, pos.y, Math.PI * (0.75 + Math.random() * 0.5), 0xcfd8e6, 3);
      } else {
        this.particles.spawnExplosion(pos.x, pos.y, fx.bodyColor, fx.bodyCount);
      }
      if (boss.hp <= 0) {
        this.triggerHitStop(0.09);
      }
      return true;
    }
    return false;
  }

  checkCollisions() {
    const camX = this.camera.position.x;
    const minScreenX = camX - 440;
    const maxScreenX = camX + 440;

    // Pre-filter active turret missiles once to avoid O(B^2) nested bullet iteration
    const turretMissiles: Bullet[] = [];
    for (const b of this.bullets.bullets) {
      if (b.active && !b.isPlayer && b.isTurretMissile) {
        turretMissiles.push(b);
      }
    }

    // Player missiles
    for (const m of this.missiles) {
      if (!m.active) continue;
      const pos = m.mesh.position;

      if (turretMissiles.length > 0 && this.interceptTurretMissile(turretMissiles, pos, m.radius, 20)) {
        m.active = false;
        continue;
      }

      const e = this.findEnemyHit(pos, m.radius, minScreenX, maxScreenX);
      if (e) {
        m.active = false;
        const lvl2 = m.missileLevel >= 2;
        this.particles.spawnExplosion(pos.x, pos.y, lvl2 ? 0x00ffff : 0xff4400, lvl2 ? 28 : 18);
        this.damageEnemy(e, m.damage, SCORE_MISSILE_KILL);
        continue;
      }

      if (this.hitBoss(pos, m.radius, m.damage, m.missileLevel >= 2 ? MISSILE2_BOSS_FX : MISSILE_BOSS_FX)) {
        m.active = false;
      }
    }

    // Bullets
    for (const b of this.bullets.bullets) {
      if (!b.active) continue;
      const pos = b.mesh.position;
      if (pos.x < minScreenX || pos.x > maxScreenX) continue;

      if (b.isPlayer) {
        if (turretMissiles.length > 0 && this.interceptTurretMissile(turretMissiles, pos, 6, 16)) {
          this.deactivateBullet(b);
          continue;
        }

        const e = this.findEnemyHit(pos, 4, minScreenX, maxScreenX);
        if (e) {
          this.deactivateBullet(b);
          this.particles.spawnExplosion(pos.x, pos.y, 0xffffff, 5);
          this.damageEnemy(e, b.damage, SCORE_BULLET_KILL);
          continue;
        }

        if (this.hitBoss(pos, 4, b.damage, BULLET_BOSS_FX)) {
          this.deactivateBullet(b);
        }
      } else if (this.player.active && this.player.invulnTimer <= 0) {
        // Enemy bullet vs Player
        if (this.circleIntersect(pos, 4, this.player.mesh.position, 8)) {
          this.takePlayerDamage();
          this.deactivateBullet(b);
        }
      }
    }

    // Player vs Powerups
    if (this.player.active) {
      for (const p of this.powerups) {
        if (!p.active) continue;
        if (this.circleIntersect(this.player.mesh.position, 16, p.mesh.position, p.radius)) {
          this.collectPowerup(p);
        }
      }
    }

    // Player vs Enemies (ramming destroys regular enemies but costs a life/shield)
    if (this.player.active && this.player.invulnTimer <= 0) {
      for (const e of this.level.enemies) {
        if (!e.active) continue;
        if (this.circleIntersect(this.player.mesh.position, 12, e.mesh.position, e.radius)) {
          this.takePlayerDamage();
          if (!e.isExploding) {
            this.particles.spawnExplosion(e.mesh.position.x, e.mesh.position.y, 0xff4400, 20);
            this.damageEnemy(e, 100, SCORE_BULLET_KILL);
          }
        }
      }

      const boss = this.level.boss;
      if (boss && boss.active && !boss.isExploding &&
          (boss.hullHit(this.player.mesh.position, 12) || boss.hazardHit(this.player.mesh.position, 6))) {
         this.takePlayerDamage();
      }
    }
  }

  private deactivateBullet(b: Bullet) {
    b.active = false;
    b.mesh.visible = false;
  }

  private collectPowerup(p: Powerup) {
    p.active = false;
    AchievementManager.recordPowerupCollected(p.type === 'S' ? 'shield' : p.type);
    this.addScore(200);
    this.particles.spawnExplosion(p.mesh.position.x, p.mesh.position.y, 0x00ffcc, 15);
    SoundManager.playPowerup();

    if (p.type === 'P') {
      this.player.upgradeWeapon();
      this.onWeaponLevelUpdate(this.player.weaponLevel);
      this.weaponUpgradeCooldown = 10.0; // Wait 10 seconds before another weapon upgrade can drop
    } else if (p.type === 'S') {
      this.player.addShield();
    } else if (p.type === 'D') {
      this.player.addDrone();
    } else if (p.type === 'M') {
      this.player.addMissileCapacity();
      this.onMissileCooldownUpdate(this.player.missileCooldown, this.player.maxMissileCooldown);
      this.weaponUpgradeCooldown = 10.0;
    } else if (p.type === 'U') {
      this.player.upgradeMissiles();
      this.onMissileCooldownUpdate(this.player.missileCooldown, this.player.maxMissileCooldown);
      this.weaponUpgradeCooldown = 10.0;
    }

    AchievementManager.recordWeaponLevels(this.player.weaponLevel, this.player.missileLevel);
  }

  takePlayerDamage() {
    if (!this.player.active || this.player.invulnTimer > 0) return;

    AchievementManager.recordHitTaken();

    if (this.player.hasShield) {
      this.player.hasShield = false;
      if (this.player.shieldMesh) this.player.shieldMesh.visible = false;
      this.player.invulnTimer = 1.2;
      const px = this.player.mesh.position.x;
      const py = this.player.mesh.position.y;
      this.particles.spawnExplosion(px, py, 0x00d4ff, 40);
      this.particles.spawnExplosion(px, py, 0xffffff, 20);
      this.addScreenShake(6, 0.15);
      this.triggerHitStop(0.06);
      SoundManager.playShieldHit();
      return;
    }

    this.triggerHitStop(0.08);
    this.playerHit();
  }

  playerHit() {
    this.addScreenShake(10, 0.2); // Shake on hit
    const px = this.player.mesh.position.x;
    const py = this.player.mesh.position.y;
    this.particles.spawnExplosion(px, py, 0x00aaff, 30);

    // Drop equipped powerups before resetting state
    const droppedTypes: PowerupType[] = [];
    for (let i = 1; i < this.player.weaponLevel; i++) {
      droppedTypes.push('P');
    }
    for (let i = 0; i < this.player.drones.length; i++) {
      droppedTypes.push('D');
    }
    for (let i = 4; i < this.player.missileCount; i++) {
      droppedTypes.push('M');
    }
    if (this.player.missileLevel > 1) {
      droppedTypes.push('U');
    }

    if (droppedTypes.length > 0) {
      droppedTypes.forEach((type, index) => {
        const count = droppedTypes.length;
        const angle = (index / count) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
        const distance = 25 + Math.random() * 20;
        const spawnX = px + Math.cos(angle) * distance;
        const spawnY = Math.max(-250, Math.min(250, py + Math.sin(angle) * distance));
        const p = new Powerup(this.scene, type, spawnX, spawnY);
        this.powerups.push(p);
      });
    }

    // Lose powerups on death
    this.player.resetState();
    this.onWeaponLevelUpdate(1);

    this.lives--;
    this.onLivesUpdate(this.lives);

    if (this.lives <= 0) {
      this.playDeathSequence(px, py);
    } else {
      this.player.hp = 1;
      this.player.active = true;
      this.player.addShield();
      this.player.invulnTimer = 3.0;
      this.camera.position.x = this.level.distance;
      this.player.mesh.position.set(this.camera.position.x - 250, 0, 0);
    }
  }

  /** Final death: 2.5 s of cascading explosions, then Game Over. All in game time. */
  private playDeathSequence(px: number, py: number) {
    this.player.active = false;

    // Freeze scrolling during player death sequence so explosion stays centered in view
    this.level.scrollSpeed = 0;

    // Keep ship visible for a split second during initial impact blast
    this.scheduler.after(0.15, () => {
      this.player.mesh.visible = false;
    });

    // Primary explosion
    this.addScreenShake(18, 0.5);
    this.particles.spawnExplosion(px, py, 0xff0055, 70);
    this.particles.spawnExplosion(px, py, 0x00ffff, 60);
    this.particles.spawnExplosion(px, py, 0xffaa00, 60);
    SoundManager.playPlayerExplosion();

    // Cascading secondary explosions over 1.5 seconds
    for (let i = 1; i <= 5; i++) {
      this.scheduler.after(i * 0.28, () => {
        const offsetX = (Math.random() - 0.5) * 50;
        const offsetY = (Math.random() - 0.5) * 50;
        this.addScreenShake(10, 0.2);
        this.particles.spawnExplosion(px + offsetX, py + offsetY, Math.random() > 0.5 ? 0xff0044 : 0xffbb00, 40);
      });
    }

    // Final massive core explosion
    this.scheduler.after(1.6, () => {
      this.addScreenShake(22, 0.6);
      this.particles.spawnExplosion(px, py, 0xffffff, 90);
      this.particles.spawnExplosion(px, py, 0x00ffff, 70);
    });

    // Game Over screen only after the full explosion animation finishes
    this.scheduler.after(2.5, () => {
      this.gameOver = true;
      this.onGameOver(false);
    });
  }

  circleIntersect(p1: THREE.Vector3, r1: number, p2: THREE.Vector3, r2: number) {
    const dx = p1.x - p2.x;
    const rSum = r1 + r2;
    if (dx > rSum || dx < -rSum) return false;
    const dy = p1.y - p2.y;
    if (dy > rSum || dy < -rSum) return false;
    return (dx * dx + dy * dy) < (rSum * rSum);
  }
}

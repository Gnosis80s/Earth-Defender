import * as THREE from 'three';
import { Entity, addFlashUniform } from './Entity';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { SoundManager } from '../SoundManager';
import { ROCK_FRAMES, RockKind, rockVariantCount } from '../art/Stage2Art';

export class Enemy extends Entity {
  type: string;
  pattern: string;
  timer: number = 0;
  fireCooldown: number = 0;
  startX: number = 0;
  startY: number = 0;
  rotSpeed: number = 0;
  maxHp: number = 1;
  damageFlashTimer: number = 0;
  /** 'pincer' pattern: height to converge on after entering from a screen edge. */
  targetY: number = 0;
  /** 'peel' pattern: +1 breaks upward, -1 breaks downward. */
  peelDir: number = 1;

  isExploding: boolean = false;
  explodeTimer: number = 0;
  explodeTickTimer: number = 0;

  turretLauncherMesh: THREE.Mesh | null = null;
  private turretFlash: { value: number } | null = null;
  currentTurretAngle: number = Math.PI;

  // Asteroids: tumble frames (lighting stays fixed) and drift velocity.
  private rockKind: RockKind | null = null;
  private rockVariant = 0;
  private spinPhase = 0;
  private rockFrame = -1;
  driftVx = 0;
  driftVy = 0;

  // Proximity mines: arm when the player comes close, then burst.
  private mineArmed = false;
  private mineFuse = 0;
  static readonly MINE_TRIGGER = 88;
  targetTurretAngle: number = Math.PI;

  constructor(scene: THREE.Scene, type: string, x: number, y: number, pattern: string) {
    let texName = 'enemyScout';
    let size = 32;
    let hp = 2;

    if (type === 'heavy') {
      texName = 'enemyHeavy';
      size = 64;
      hp = 12;
    } else if (type === 'subboss1') {
      texName = 'subboss1';
      size = 96;
      hp = 120;
    } else if (type === 'subboss_gatekeeper') {
      texName = 'subboss_gatekeeper';
      size = 110;
      hp = 150;
    } else if (type === 'interceptor') {
      texName = 'enemyInterceptor';
      size = 40;
      hp = 4;
    } else if (type === 'sniper') {
      texName = 'enemySniper';
      size = 48;
      hp = 6;
    } else if (type === 'asteroid_large') {
      texName = 'asteroid_large';
      size = 72;
      hp = 45;
    } else if (type === 'asteroid_small') {
      texName = 'asteroid_small';
      size = 44;
      hp = 22;
    } else if (type === 'asteroid_gold') {
      texName = 'asteroid_gold';
      size = 56;
      hp = 35;
    } else if (type === 'asteroid_chunk') {
      texName = 'asteroid_chunk';
      size = 28;
      hp = 5;
    } else if (type === 'turret') {
      texName = 'turret_base';
      size = 52;
      hp = 18;
    } else if (type === 'solar_mine') {
      texName = 'solar_mine';
      size = 36;
      hp = 3;
    } else if (type === 'bioDrone') {
      texName = 'enemyBioDrone';
      size = 36;
      hp = 5;
    } else if (type === 'bioStalker') {
      texName = 'enemyBioStalker';
      size = 48;
      hp = 9;
    } else if (type === 'bioBehemoth') {
      texName = 'enemyBioBehemoth';
      size = 72;
      hp = 25;
    }

    super(scene, AssetManager.getTexture(texName), size, size);
    this.type = type;
    this.pattern = pattern;
    this.mesh.position.set(x, y, 0);
    this.startX = x;
    this.startY = y;
    this.hp = hp;
    this.maxHp = hp;
    this.radius = size / 2;
    if (type.startsWith('asteroid')) {
      const kind = type.slice('asteroid_'.length) as RockKind;
      this.rockKind = kind;
      this.rockVariant = Math.floor(Math.random() * rockVariantCount(kind));
      this.spinPhase = Math.random() * Math.PI * 2;
      // Smaller rocks tumble faster; direction is random.
      const spin = kind === 'large' ? 1.0 : kind === 'chunk' ? 2.6 : 1.6;
      this.rotSpeed = (Math.random() < 0.5 ? -1 : 1) * spin * (0.7 + Math.random() * 0.6);
      // The sprite is an irregular rock, not a disc: a slightly smaller hitbox is fairer.
      this.radius = size * 0.42;
      const base = kind === 'large' ? 120 : kind === 'chunk' ? 150 : kind === 'gold' ? 130 : 140;
      this.driftVx = -(base + Math.random() * 50);
      this.driftVy = (Math.random() - 0.5) * 30;
      this.updateRockFrame();
    }
    if (type === 'solar_mine') {
      this.radius = 13;
      this.driftVx = -(60 + Math.random() * 40);
      this.driftVy = 0;
    }

    if (type === 'turret') {
      const launcherGeo = new THREE.PlaneGeometry(size, size);
      const launcherMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('turret_launcher'),
        transparent: true,
        alphaTest: 0.05,
        depthWrite: false
      });
      this.turretFlash = addFlashUniform(launcherMat);
      this.turretLauncherMesh = new THREE.Mesh(launcherGeo, launcherMat);
      this.turretLauncherMesh.renderOrder = 11;
      this.turretLauncherMesh.position.set(0, 0, 0.1);
      this.turretLauncherMesh.rotation.z = Math.PI; // Face incoming player to the left
      this.mesh.add(this.turretLauncherMesh);
    }
  }

  /** Throw/redirect an asteroid (boss volleys, meteor storms, fragments). */
  launch(vx: number, vy: number) {
    this.driftVx = vx;
    this.driftVy = vy;
  }

  private updateRockFrame() {
    if (!this.rockKind) return;
    const tau = Math.PI * 2;
    const f = Math.floor((((this.spinPhase % tau) + tau) % tau) / tau * ROCK_FRAMES) % ROCK_FRAMES;
    if (f === this.rockFrame) return;
    this.rockFrame = f;
    (this.mesh.material as THREE.MeshBasicMaterial).map =
      AssetManager.getTexture(`rock_${this.rockKind}_${this.rockVariant}_${f}`);
  }

  takeDamage(amount: number) {
    if (this.isExploding) return;
    this.hp -= amount;
    this.damageFlashTimer = 0.08;
    if (this.hp <= 0) {
      if (this.type === 'subboss_gatekeeper' || this.type === 'subboss1') {
        this.hp = 0;
        this.isExploding = true;
        this.explodeTimer = 2.2;
        this.explodeTickTimer = 0;
      } else {
        this.active = false;
      }
    }
  }

  update(dt: number, time: number, cameraX: number, bullets?: BulletManager, playerPos?: THREE.Vector3, particles?: ParticleManager, game?: any) {
    if (!this.active) return;

    // Handle damage flash and critical <10% health flashing
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
    }

    const isCritical = this.hp > 0 && (this.hp / this.maxHp) <= 0.10;
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    const turretMat = this.turretLauncherMesh ? (this.turretLauncherMesh.material as THREE.MeshBasicMaterial) : null;

    if (isCritical) {
      // Flashes intensely at 28Hz when below 10% health to signal imminent destruction
      const flashRed = Math.floor(time * 28) % 2 === 0;
      if (mat) mat.color.set(flashRed ? 0xff2222 : 0xffffff);
      if (turretMat) turretMat.color.set(flashRed ? 0xff2222 : 0xffffff);
    } else {
      if (mat && mat.color.getHex() !== 0xffffff) mat.color.set(0xffffff);
      if (turretMat && turretMat.color.getHex() !== 0xffffff) turretMat.color.set(0xffffff);
    }

    // White hit-flash. Strobes between strong and faint so an enemy under
    // sustained fire stays readable instead of turning into a white blob.
    const flash = this.damageFlashTimer > 0 ? (Math.floor(time * 30) % 2 === 0 ? 0.9 : 0.3) : 0;
    this.setFlash(flash);
    if (this.turretFlash) this.turretFlash.value = flash;

    if (this.isExploding) {
      this.explodeTimer -= dt;
      this.explodeTickTimer += dt;

      // Pulse & shake mesh visually
      this.mesh.scale.setScalar(1.0 + Math.sin(time * 35) * 0.15);
      this.mesh.position.x += (Math.random() - 0.5) * 5;
      this.mesh.position.y += (Math.random() - 0.5) * 5;

      if (this.explodeTickTimer >= 0.08) {
        this.explodeTickTimer = 0;
        const offsetX = (Math.random() - 0.5) * (this.radius * 1.4);
        const offsetY = (Math.random() - 0.5) * (this.radius * 1.4);
        if (particles) {
          particles.spawnExplosion(
            this.mesh.position.x + offsetX,
            this.mesh.position.y + offsetY,
            Math.random() > 0.5 ? 0xff4400 : 0xffff00,
            28
          );
        }
        SoundManager.playExplosion('small', 0.8 + Math.random() * 0.4);
        if (game && game.addScreenShake) {
          game.addScreenShake(6, 0.1);
        }
      }

      if (this.explodeTimer <= 0) {
        if (particles) {
          particles.spawnExplosion(this.mesh.position.x, this.mesh.position.y, 0xff0055, 120);
          particles.spawnExplosion(this.mesh.position.x, this.mesh.position.y, 0x00ffff, 90);
          particles.spawnExplosion(this.mesh.position.x, this.mesh.position.y, 0xffff00, 70);
        }
        SoundManager.playExplosion('large', 0.9 + Math.random() * 0.2);
        if (game && game.addScreenShake) {
          game.addScreenShake(18, 0.45);
        }
        if (game && game.tryDropPowerup) {
          game.addScore(this.type === 'subboss_gatekeeper' ? 1000 : 800);
          game.tryDropPowerup(this.mesh.position.x, this.mesh.position.y - 20, true, ['P', 'M', 'S']);
        }
        this.mesh.visible = false;
        this.active = false;
      }
      return;
    }

    this.timer += dt;

    if (this.type === 'solar_mine') {
      this.vx = this.driftVx;
      this.vy = this.driftVy + Math.sin(this.timer * 1.5) * 25;
      const pos = this.mesh.position;
      if (!this.mineArmed && playerPos && Math.hypot(playerPos.x - pos.x, playerPos.y - pos.y) < Enemy.MINE_TRIGGER) {
        this.mineArmed = true;
        this.mineFuse = 0.6;
        SoundManager.playBloop(1.8);
      }
      if (this.mineArmed) {
        this.mineFuse -= dt;
        this.vx *= 0.3; this.vy *= 0.3; // brakes while the fuse burns
        const blink = Math.floor(this.mineFuse * 14) % 2 === 0;
        (this.mesh.material as THREE.MeshBasicMaterial).map = AssetManager.getTexture(blink ? 'solar_mine_armed' : 'solar_mine');
        if (this.mineFuse <= 0) {
          // Ring burst: 8 slow shots, rotated randomly so it can't be memorised.
          const a0 = Math.random() * Math.PI;
          for (let k = 0; k < 8; k++) {
            const a = a0 + (k / 8) * Math.PI * 2;
            bullets?.spawn(pos.x, pos.y, Math.cos(a) * 135, Math.sin(a) * 135, false);
          }
          particles?.spawnExplosion(pos.x, pos.y, 0xff5a4a, 22);
          particles?.spawnExplosion(pos.x, pos.y, 0x7ae07a, 10);
          SoundManager.playExplosion('small', 1.2);
          this.active = false;
          this.mesh.visible = false;
          return;
        }
      }
    } else if (this.type.startsWith('asteroid')) {
      this.spinPhase += this.rotSpeed * dt;
      this.updateRockFrame();
      this.vx = this.driftVx;
      this.vy = this.driftVy + Math.sin(this.timer * 0.8) * 8;
      if (this.type === 'asteroid_gold' && particles && Math.random() < 0.45) {
        particles.spawnExplosion(
          this.mesh.position.x + (Math.random() - 0.5) * 24,
          this.mesh.position.y + (Math.random() - 0.5) * 24,
          Math.random() > 0.3 ? 0xffd700 : 0xffffff,
          2
        );
      }
    } else if (this.pattern === 'wave') {
      this.vx = -150;
      this.vy = Math.cos(this.timer * 3) * 100;
    } else if (this.pattern === 'straight') {
      this.vx = -200;
      this.vy = 0;
    } else if (this.pattern === 'pincer') {
      // Drop in from the top/bottom edge, ease onto targetY, then fly across.
      this.vx = -150;
      this.vy = (this.targetY - this.mesh.position.y) * 2.2;
    } else if (this.pattern === 'peel') {
      // Fly in level, then break away in a widening arc once a third of the
      // way across the screen.
      const peelLine = cameraX + 130;
      if (this.mesh.position.x > peelLine && this.timer < 6) {
        this.vx = -230;
        this.vy = 0;
      } else {
        this.vx = -230;
        this.vy = Math.min(this.vy * this.peelDir + 420 * dt, 240) * this.peelDir;
      }
    } else if (this.pattern === 'heavy') {
      if (this.mesh.position.x > cameraX + 200) {
        this.vx = -100;
      } else {
        this.vx = 0;
        this.vy = Math.sin(this.timer * 2) * 50;
      }
    } else if (this.pattern === 'swoop') {
      // Fast swoop towards player Y then exit
      this.vx = -260;
      if (playerPos) {
        const targetY = playerPos.y;
        this.vy = (targetY - this.mesh.position.y) * 2;
      } else {
        this.vy = Math.sin(this.timer * 4) * 120;
      }
    } else if (this.pattern === 'zigzag') {
      // Sharp diagonal zigzag pattern
      this.vx = -170;
      this.vy = Math.sin(this.timer * 6) * 180;
    } else if (this.pattern === 'subboss') {
      if (this.mesh.position.x > cameraX + 150) {
        this.vx = -120; // Move into screen
        this.vy = 0;
      } else {
        this.vx = (cameraX + 150 - this.mesh.position.x) * 2; // hold position roughly
        this.vy = Math.sin(this.timer * 1.5) * 120; // Move up and down
      }
    } else if (this.pattern === 'subboss_gatekeeper') {
      if (this.mesh.position.x > cameraX + 200) {
        this.vx = -220; // Enter arena briskly in front of blast door
        this.vy = 0;
      } else {
        this.vx = (cameraX + 200 - this.mesh.position.x) * 2; // Hold position in front of door
        this.vy = Math.sin(this.timer * 2.2) * 140; // Smooth vertical movement
      }
    } else if (this.pattern === 'turret') {
      this.vx = 0;
      this.vy = 0;
    } else if (this.pattern === 'bio_spiral') {
      this.vx = -180;
      this.vy = Math.sin(this.timer * 5 + this.startX * 0.01) * 140;
    } else if (this.pattern === 'bio_hunt') {
      this.vx = -210;
      if (playerPos) {
        this.vy = (playerPos.y - this.mesh.position.y) * 1.8;
      } else {
        this.vy = Math.sin(this.timer * 3) * 80;
      }
    } else if (this.pattern === 'bio_heavy') {
      if (this.mesh.position.x > cameraX + 180) {
        this.vx = -120;
      } else {
        this.vx = 0;
        this.vy = Math.cos(this.timer * 1.8) * 70;
      }
    }

    this.mesh.position.x += this.vx * dt;
    this.mesh.position.y += this.vy * dt;

    // Turret Launcher Dynamic Tracking & Aiming Rotation
    if (this.turretLauncherMesh) {
      if (!this.active || this.isExploding) {
        this.turretLauncherMesh.visible = this.active && !this.isExploding;
      } else if (playerPos) {
        const dx = playerPos.x - this.mesh.position.x;
        const dy = playerPos.y - this.mesh.position.y;
        this.targetTurretAngle = Math.atan2(dy, dx);

        // Smooth mechanical turret rotation towards target angle
        let diff = this.targetTurretAngle - this.currentTurretAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const trackSpeed = 6.0;
        this.currentTurretAngle += diff * Math.min(1.0, dt * trackSpeed);
        this.turretLauncherMesh.rotation.z = this.currentTurretAngle;
      }
    }

    if (this.type.startsWith('bio') || this.pattern.startsWith('bio')) {
      const maxY = 150 - this.radius;
      if (this.mesh.position.y > maxY) this.mesh.position.y = maxY;
      if (this.mesh.position.y < -maxY) this.mesh.position.y = -maxY;
    }

    // Firing
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.fireCooldown <= 0 && bullets && this.mesh.position.x < cameraX + 400 && this.mesh.position.x > cameraX - 400 && !this.type.startsWith('asteroid') && this.type !== 'solar_mine') {
      SoundManager.playEnemyFire(0.9 + Math.random() * 0.2);
      if (this.type === 'bioDrone') {
        bullets.spawn(this.mesh.position.x - 18, this.mesh.position.y, -260, 0, false);
        this.fireCooldown = 1.4;
      } else if (this.type === 'bioStalker') {
        if (playerPos) {
          const dx = playerPos.x - this.mesh.position.x;
          const dy = playerPos.y - this.mesh.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            bullets.spawn(this.mesh.position.x - 24, this.mesh.position.y, (dx / dist) * 320, (dy / dist) * 320, false);
          }
        } else {
          bullets.spawn(this.mesh.position.x - 24, this.mesh.position.y, -300, 0, false);
        }
        this.fireCooldown = 1.6;
      } else if (this.type === 'bioBehemoth') {
        bullets.spawn(this.mesh.position.x - 36, this.mesh.position.y + 12, -280, 40, false);
        bullets.spawn(this.mesh.position.x - 36, this.mesh.position.y, -320, 0, false);
        bullets.spawn(this.mesh.position.x - 36, this.mesh.position.y - 12, -280, -40, false);
        this.fireCooldown = 1.8;
      } else if (this.type === 'heavy') {
        bullets.spawn(this.mesh.position.x - 32, this.mesh.position.y, -300, 0, false);
        bullets.spawn(this.mesh.position.x - 32, this.mesh.position.y + 16, -300, 50, false);
        bullets.spawn(this.mesh.position.x - 32, this.mesh.position.y - 16, -300, -50, false);
        this.fireCooldown = 1.5;
      } else if (this.type === 'subboss1') {
        // High density spread
        bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y, -350, 0, false);
        bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y + 20, -320, 80, false);
        bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y - 20, -320, -80, false);
        bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y + 40, -300, 160, false);
        bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y - 40, -300, -160, false);
        
        // Sometimes fire targeted shots
        if (Math.random() > 0.5 && playerPos) {
           const dx = playerPos.x - this.mesh.position.x;
           const dy = playerPos.y - this.mesh.position.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           if (dist > 0) {
             bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y, (dx / dist) * 400, (dy / dist) * 400, false);
           }
        }
        
        this.fireCooldown = 2.0;
      } else if (this.type === 'subboss_gatekeeper') {
        // Heavy triple spread + targeted missile
        bullets.spawn(this.mesh.position.x - 52, this.mesh.position.y, -380, 0, false);
        bullets.spawn(this.mesh.position.x - 52, this.mesh.position.y + 24, -340, 100, false);
        bullets.spawn(this.mesh.position.x - 52, this.mesh.position.y - 24, -340, -100, false);
        
        if (playerPos) {
          const dx = playerPos.x - this.mesh.position.x;
          const dy = playerPos.y - this.mesh.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            bullets.spawn(
              this.mesh.position.x - 40,
              this.mesh.position.y,
              (dx / dist) * 320,
              (dy / dist) * 320,
              false,
              2,
              false,
              'bulletPlayer',
              false,
              true,
              0.18
            );
          }
        }
        this.fireCooldown = 1.5;
      } else if (this.type === 'turret') {
        const angle = this.currentTurretAngle;
        const muzzleDist = 20;
        const spawnX = this.mesh.position.x + Math.cos(angle) * muzzleDist;
        const spawnY = this.mesh.position.y + Math.sin(angle) * muzzleDist;
        const missileSpeed = 300;
        const dirX = Math.cos(angle) * missileSpeed;
        const dirY = Math.sin(angle) * missileSpeed;

        if (particles) {
          particles.spawnExplosion(spawnX, spawnY, 0xffaa00, 10);
        }

        // Launch homing missile fired directly from the rotating launcher pod
        bullets.spawn(
          spawnX,
          spawnY,
          dirX,
          dirY,
          false, // isPlayer
          2, // damage
          false, // isTurretLaser
          'bulletPlayer',
          false, // isIonLaser
          true, // isTurretMissile
          0.22 // 22% homing effect
        );
        this.fireCooldown = 1.25;
      } else if (this.type === 'interceptor') {
        // Fast dual shot towards player
        let dirX = -380;
        let dirY = 0;
        if (playerPos) {
          const dx = playerPos.x - this.mesh.position.x;
          const dy = playerPos.y - this.mesh.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            dirX = (dx / dist) * 380;
            dirY = (dy / dist) * 380;
          }
        }
        bullets.spawn(this.mesh.position.x - 16, this.mesh.position.y - 6, dirX, dirY, false);
        bullets.spawn(this.mesh.position.x - 16, this.mesh.position.y + 6, dirX, dirY, false);
        this.fireCooldown = 1.4;
      } else if (this.type === 'sniper') {
        // High speed single beam
        let dirX = -450;
        let dirY = 0;
        if (playerPos) {
          const dx = playerPos.x - this.mesh.position.x;
          const dy = playerPos.y - this.mesh.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            dirX = (dx / dist) * 450;
            dirY = (dy / dist) * 450;
          }
        }
        bullets.spawn(this.mesh.position.x - 20, this.mesh.position.y, dirX, dirY, false, 1.3);
        this.fireCooldown = 1.6;
      } else {
        if (Math.random() > 0.5) {
          bullets.spawn(this.mesh.position.x - 16, this.mesh.position.y, -400, 0, false);
          this.fireCooldown = 2.0;
        }
      }
    }

    // Offscreen cleanup (rocks can also leave through the top or bottom)
    if (this.mesh.position.x < cameraX - 500 || this.mesh.position.y < -420 || this.mesh.position.y > 420) {
      this.active = false;
    }
  }

  destroy(scene: THREE.Scene) {
    if (this.turretLauncherMesh) {
      this.mesh.remove(this.turretLauncherMesh);
      this.turretLauncherMesh.geometry.dispose();
      (this.turretLauncherMesh.material as THREE.Material).dispose();
      this.turretLauncherMesh = null;
    }
    super.destroy(scene);
  }
}

import * as THREE from 'three';
import { Entity } from './Entity';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { SoundManager } from '../SoundManager';

export interface BossTurret {
  id: number;
  offsetX: number;
  offsetY: number;
  hp: number;
  maxHp: number;
  active: boolean;
  fireTimer: number;
  fireInterval: number;
  mesh: THREE.Mesh;
}

export class Boss extends Entity {
  timer: number = 0;
  phase: number = 1;
  fireCooldown: number = 0;
  targetY: number = 0;
  stage: number;
  name: string;
  maxHp: number;
  damageFlashTimer: number = 0;

  isExploding: boolean = false;
  explodeTimer: number = 0;
  explodeTickTimer: number = 0;

  turrets: BossTurret[] = [];

  // Special attack & telegraphing states
  isChargingBeam: boolean = false;
  chargeTimer: number = 0;
  chargeMaxTime: number = 1.2;
  isFiringBeam: boolean = false;
  beamTimer: number = 0;
  specialAttackCooldown: number = 5.0;
  phase2Triggered: boolean = false;
  targetBeamY: number = 0;

  telegraphMesh: THREE.Mesh;
  beamMesh: THREE.Mesh;
  chargeCoreMesh: THREE.Mesh;

  constructor(scene: THREE.Scene, x: number, y: number, stage: number = 1) {
    const texName = `boss${Math.min(5, Math.max(1, stage))}`;
    super(scene, AssetManager.getTexture(texName), 128, 128);
    this.mesh.position.set(x, y, 0);
    this.stage = stage;

    if (stage === 1) {
      this.name = 'MECHA DREADNOUGHT';
      this.maxHp = 600;
    } else if (stage === 2) {
      this.name = 'CYBER CORE DESTROYER';
      this.maxHp = 1000;
    } else if (stage === 3) {
      this.name = 'SOLAR DOCK OVERLORD';
      this.maxHp = 1350;
    } else if (stage === 4) {
      this.name = 'VOID LEVIATHAN';
      this.maxHp = 1700;
    } else {
      this.name = 'MOTHER BRAIN OVERLORD';
      this.maxHp = 2250;
    }
    
    this.hp = this.maxHp;
    this.radius = 48;

    // Create telegraph warning line (thin red guide)
    const telGeo = new THREE.PlaneGeometry(800, 4);
    const telMat = new THREE.MeshBasicMaterial({ 
      color: 0xff0044, 
      transparent: true, 
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending 
    });
    this.telegraphMesh = new THREE.Mesh(telGeo, telMat);
    this.telegraphMesh.renderOrder = 14;
    this.telegraphMesh.visible = false;
    scene.add(this.telegraphMesh);

    // Create beam mesh
    const beamGeo = new THREE.PlaneGeometry(800, 36);
    const beamMat = new THREE.MeshBasicMaterial({ 
      color: stage === 3 ? 0x00ffff : (stage === 4 ? 0xcc00ff : 0xff3300), 
      transparent: true, 
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending 
    });
    this.beamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.beamMesh.renderOrder = 14;
    this.beamMesh.visible = false;
    scene.add(this.beamMesh);

    // Charging core ring
    const chargeGeo = new THREE.RingGeometry(4, 28, 16);
    const chargeMat = new THREE.MeshBasicMaterial({ 
      color: stage === 3 ? 0x00ffff : (stage === 4 ? 0xcc00ff : 0xffaa00), 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending 
    });
    this.chargeCoreMesh = new THREE.Mesh(chargeGeo, chargeMat);
    this.chargeCoreMesh.renderOrder = 15;
    this.chargeCoreMesh.visible = false;
    scene.add(this.chargeCoreMesh);

    this.createTurrets(scene, stage);
  }

  private createTurrets(scene: THREE.Scene, stage: number) {
    const turretConfigs = stage === 1 ? [
      { offsetX: -10, offsetY: 45, hp: 75, interval: 2.3 },
      { offsetX: -10, offsetY: -45, hp: 75, interval: 2.3 }
    ] : stage === 2 ? [
      { offsetX: -5, offsetY: 52, hp: 95, interval: 2.0 },
      { offsetX: -30, offsetY: 0, hp: 110, interval: 2.5 },
      { offsetX: -5, offsetY: -52, hp: 95, interval: 2.0 }
    ] : stage === 3 ? [
      { offsetX: -20, offsetY: 48, hp: 100, interval: 1.8 },
      { offsetX: 10, offsetY: 24, hp: 110, interval: 2.0 },
      { offsetX: 10, offsetY: -24, hp: 110, interval: 2.0 },
      { offsetX: -20, offsetY: -48, hp: 100, interval: 1.8 }
    ] : stage === 4 ? [
      { offsetX: -10, offsetY: 56, hp: 120, interval: 1.8 },
      { offsetX: 15, offsetY: 28, hp: 120, interval: 2.2 },
      { offsetX: 15, offsetY: -28, hp: 120, interval: 2.2 },
      { offsetX: -10, offsetY: -56, hp: 120, interval: 1.8 }
    ] : [
      { offsetX: -25, offsetY: 62, hp: 150, interval: 1.5 },
      { offsetX: 10, offsetY: 32, hp: 150, interval: 1.8 },
      { offsetX: 10, offsetY: -32, hp: 150, interval: 1.8 },
      { offsetX: -25, offsetY: -62, hp: 150, interval: 1.5 }
    ];

    const turretGeo = new THREE.PlaneGeometry(28, 28);
    const turretTex = AssetManager.getTexture('turret');

    turretConfigs.forEach((cfg, idx) => {
      const mat = new THREE.MeshBasicMaterial({ 
        map: turretTex, 
        transparent: true,
        alphaTest: 0.05,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(turretGeo, mat);
      mesh.renderOrder = 11;
      mesh.position.set(this.mesh.position.x + cfg.offsetX, this.mesh.position.y + cfg.offsetY, 2);
      scene.add(mesh);

      this.turrets.push({
        id: idx,
        offsetX: cfg.offsetX,
        offsetY: cfg.offsetY,
        hp: cfg.hp,
        maxHp: cfg.hp,
        active: true,
        fireTimer: Math.random() * 0.8 + 0.5,
        fireInterval: cfg.interval,
        mesh
      });
    });
  }

  takeDamage(amount: number) {
    if (this.isExploding) return;
    this.hp -= amount;
    this.damageFlashTimer = 0.06;
    if (this.hp <= 0 && !this.isExploding) {
      this.hp = 0;
      this.isExploding = true;
      this.explodeTimer = 3.2;
      this.explodeTickTimer = 0;
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.mesh);
    scene.remove(this.telegraphMesh);
    scene.remove(this.beamMesh);
    scene.remove(this.chargeCoreMesh);
    for (const t of this.turrets) {
      scene.remove(t.mesh);
    }
  }

  update(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    if (!this.active) return;

    // Handle damage flash and critical <10% health flashing for boss hull and turrets
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
    }

    if (!this.isExploding) {
      const isCritical = this.hp > 0 && (this.hp / this.maxHp) <= 0.10;
      const mat = this.mesh.material as THREE.MeshBasicMaterial;

      if (isCritical) {
        // Red alert flash strobe when under 10% health
        const flashPhase = Math.floor(time * 26) % 2 === 0;
        if (mat) mat.color.set(flashPhase ? 0xff1133 : 0xffffff);
      } else if (this.damageFlashTimer > 0) {
        if (mat) mat.color.set(0xffffff);
      } else {
        if (mat && mat.color.getHex() !== 0xffffff) mat.color.set(0xffffff);
      }

      // Check turrets for <10% health flashing
      for (const t of this.turrets) {
        if (!t.active) continue;
        const tMat = t.mesh.material as THREE.MeshBasicMaterial;
        if (t.hp > 0 && (t.hp / t.maxHp) <= 0.10) {
          const tFlash = Math.floor(time * 26) % 2 === 0;
          if (tMat) tMat.color.set(tFlash ? 0xff3300 : 0xffffff);
        } else {
          if (tMat && tMat.color.getHex() !== 0xffffff) tMat.color.set(0xffffff);
        }
      }
    }

    // Handle dramatic explosion sequence
    if (this.isExploding) {
      this.explodeTimer -= dt;
      this.explodeTickTimer += dt;

      this.telegraphMesh.visible = false;
      this.beamMesh.visible = false;
      this.chargeCoreMesh.visible = false;

      // Pulse & shake mesh visually
      this.mesh.scale.setScalar(1.0 + Math.sin(time * 30) * 0.15);
      
      for (const t of this.turrets) {
        t.mesh.visible = false;
      }

      if (this.explodeTickTimer >= 0.08 && particles) {
        this.explodeTickTimer = 0;
        const offsetX = (Math.random() - 0.5) * 80;
        const offsetY = (Math.random() - 0.5) * 80;
        particles.spawnExplosion(
          this.mesh.position.x + offsetX,
          this.mesh.position.y + offsetY,
          Math.random() > 0.5 ? 0xff4400 : 0xffff00,
          25
        );
        SoundManager.playExplosion('small', 0.8 + Math.random() * 0.4);
        if (game && game.addScreenShake) {
          game.addScreenShake(6, 0.1);
        }
      }

      if (this.explodeTimer <= 0) {
        if (particles) {
          particles.spawnExplosion(this.mesh.position.x, this.mesh.position.y, 0xff0055, 150);
          particles.spawnExplosion(this.mesh.position.x, this.mesh.position.y, 0x00ffff, 100);
        }
        SoundManager.playExplosion('large', 0.8 + Math.random() * 0.4);
        if (game && game.addScreenShake) {
          game.addScreenShake(20, 0.5);
        }
        this.mesh.visible = false;
        this.active = false;
      }
      return;
    }

    this.timer += dt;

    // Phase 2 Rage Transition Check (at 50% HP)
    const hpPercent = this.hp / this.maxHp;
    if (hpPercent <= 0.5 && !this.phase2Triggered) {
      this.phase2Triggered = true;
      SoundManager.playExplosion('medium', 0.7 + Math.random() * 0.4);
      if (game && game.addScreenShake) {
        game.addScreenShake(15, 0.4);
      }
      if (particles) {
        particles.spawnExplosion(this.mesh.position.x, this.mesh.position.y, 0xff0055, 80);
      }
    }

    // Movement pattern
    const enterTargetX = cameraX + 220;
    if (this.mesh.position.x > enterTargetX) {
      this.mesh.position.x -= 120 * dt;
    } else {
      if (Math.random() < 0.03 && !this.isChargingBeam && !this.isFiringBeam) {
        const rangeY = this.stage === 4 ? 200 : 380;
        this.targetY = (Math.random() - 0.5) * rangeY;
      }
      const speed = this.stage === 3 ? 3.5 : 2.0;
      this.mesh.position.y += (this.targetY - this.mesh.position.y) * speed * dt;

      if (this.stage === 4) {
        if (this.mesh.position.y > 110) this.mesh.position.y = 110;
        if (this.mesh.position.y < -110) this.mesh.position.y = -110;
      }
    }

    // Hover
    this.mesh.position.x += Math.sin(time * 3) * 0.5;

    // Damaged Boss Smoke & Spark Trails (when HP <= 50%)
    if (hpPercent <= 0.5 && particles && Math.random() < 0.35) {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 60;
      particles.spawnSmoke(this.mesh.position.x + offsetX, this.mesh.position.y + offsetY);
      if (Math.random() < 0.3) {
        particles.spawnFire(this.mesh.position.x + offsetX, this.mesh.position.y + offsetY);
        particles.spawnSparks(this.mesh.position.x + offsetX, this.mesh.position.y + offsetY, Math.random() * Math.PI * 2, 0xffa500, 4);
      }
    }

    // --- Special Beam Attack & Telegraph Logic ---
    if (this.mesh.position.x <= enterTargetX + 20) {
      if (!this.isChargingBeam && !this.isFiringBeam) {
        this.specialAttackCooldown -= dt;
        if (this.specialAttackCooldown <= 0) {
          this.isChargingBeam = true;
          this.chargeTimer = this.chargeMaxTime;
          this.targetBeamY = playerPos ? playerPos.y : this.mesh.position.y;
          SoundManager.playTurretFire(0.7 + Math.random() * 0.3);
        }
      }
    }

    if (this.isChargingBeam) {
      this.chargeTimer -= dt;

      // Telegraph red laser warning
      this.telegraphMesh.visible = true;
      this.telegraphMesh.position.set(this.mesh.position.x - 400, this.targetBeamY, 1);
      const telMat = this.telegraphMesh.material as THREE.MeshBasicMaterial;
      telMat.opacity = 0.3 + 0.6 * Math.abs(Math.sin(time * 30));

      // Charge core energy buildup
      this.chargeCoreMesh.visible = true;
      this.chargeCoreMesh.position.set(this.mesh.position.x - 40, this.mesh.position.y, 2);
      this.chargeCoreMesh.rotation.z = time * 10;
      const chargeMat = this.chargeCoreMesh.material as THREE.MeshBasicMaterial;
      const chargeProgress = 1 - (this.chargeTimer / this.chargeMaxTime);
      chargeMat.opacity = 0.4 + chargeProgress * 0.6;
      this.chargeCoreMesh.scale.setScalar(0.4 + chargeProgress * 0.8);

      if (particles && Math.random() < 0.6) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        const px = (this.mesh.position.x - 40) + Math.cos(angle) * dist;
        const py = this.mesh.position.y + Math.sin(angle) * dist;
        particles.spawnExplosion(px, py, this.stage === 4 ? 0xcc00ff : (this.stage === 3 ? 0x00ffff : 0xffaa00), 2);
      }

      if (this.chargeTimer <= 0) {
        this.isChargingBeam = false;
        this.isFiringBeam = true;
        this.beamTimer = 0.8;
        this.telegraphMesh.visible = false;
        this.chargeCoreMesh.visible = false;
        SoundManager.playExplosion('medium', 0.6 + Math.random() * 0.4);
        if (game && game.addScreenShake) {
          game.addScreenShake(12, 0.3);
        }
      }
    } else {
      this.telegraphMesh.visible = false;
      this.chargeCoreMesh.visible = false;
    }

    if (this.isFiringBeam) {
      this.beamTimer -= dt;

      this.beamMesh.visible = true;
      this.beamMesh.position.set(this.mesh.position.x - 400, this.targetBeamY, 2);
      const beamMat = this.beamMesh.material as THREE.MeshBasicMaterial;
      beamMat.opacity = 0.7 + 0.3 * Math.sin(time * 40);
      this.beamMesh.scale.set(1, 0.8 + 0.4 * Math.sin(time * 50), 1);

      if (game && game.addScreenShake) {
        game.addScreenShake(4, 0.05);
      }

      // Spawn dense energy stream bullets along the beam path
      if (bullets && Math.random() < 0.7) {
        bullets.spawn(
          this.mesh.position.x - 50, 
          this.targetBeamY + (Math.random() - 0.5) * 16, 
          -450, 
          (Math.random() - 0.5) * 20, 
          false
        );
      }

      if (particles) {
        particles.spawnExplosion(this.mesh.position.x - 50, this.targetBeamY, 0xffaa00, 3);
      }

      if (this.beamTimer <= 0) {
        this.isFiringBeam = false;
        this.beamMesh.visible = false;
        this.specialAttackCooldown = 5.0 + Math.random() * 3.0;
      }
    } else {
      this.beamMesh.visible = false;
    }

    // Turrets update & slow laser firing
    for (const t of this.turrets) {
      if (!t.active) {
        t.mesh.visible = false;
        continue;
      }

      t.mesh.visible = this.active && !this.isExploding;
      const tx = this.mesh.position.x + t.offsetX;
      const ty = this.mesh.position.y + t.offsetY;
      t.mesh.position.set(tx, ty, 2);

      if (playerPos) {
        const dx = playerPos.x - tx;
        const dy = playerPos.y - ty;
        t.mesh.rotation.z = Math.atan2(dy, dx);
      }

      if (this.isExploding || !this.active) continue;

      t.fireTimer -= dt;
      if (t.fireTimer <= 0 && bullets && this.mesh.position.x <= enterTargetX + 20) {
        t.fireTimer = t.fireInterval + (Math.random() * 0.4 - 0.2);
        SoundManager.playTurretFire();

        // Aim laser at player at slow rate
        let dirX = -1;
        let dirY = 0;
        if (playerPos) {
          const dx = playerPos.x - tx;
          const dy = playerPos.y - ty;
          const dist = Math.hypot(dx, dy) || 1;
          dirX = dx / dist;
          dirY = dy / dist;
        }

        const laserSpeed = 250;
        bullets.spawn(tx, ty, dirX * laserSpeed, dirY * laserSpeed, false, 1, true);
      }
    }

    // Main Boss Firing logic based on stage & phase
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    
    if (this.fireCooldown <= 0 && bullets && this.mesh.position.x <= enterTargetX + 20 && !this.isChargingBeam && !this.isFiringBeam) {
      SoundManager.playEnemyFire(0.7 + Math.random() * 0.4);

      if (this.stage === 1) {
        if (hpPercent > 0.5) {
          // Spread shot
          for (let i = -2; i <= 2; i++) {
            bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y, -280, i * 40, false);
          }
          this.fireCooldown = 1.0;
        } else {
          // Bullet hell circle
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.timer * 2;
            bullets.spawn(
              this.mesh.position.x, 
              this.mesh.position.y, 
              Math.cos(angle) * 220, 
              Math.sin(angle) * 220, 
              false
            );
          }
          this.fireCooldown = 0.5;
        }
      } else if (this.stage === 2) {
        if (hpPercent > 0.6) {
          // Double wave burst (easier than triple)
          for (let i = -1; i <= 1; i++) {
            bullets.spawn(this.mesh.position.x - 48, this.mesh.position.y, -260, i * 40, false);
          }
          this.fireCooldown = 1.0;
        } else {
          // Less rapid laser barrage
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + this.timer * 2;
            bullets.spawn(this.mesh.position.x, this.mesh.position.y, Math.cos(angle) * 200, Math.sin(angle) * 200, false);
          }
          this.fireCooldown = 0.8;
        }
      } else if (this.stage === 3) {
        // Stage 3 Boss: Ultimate Void Leviathan
        if (hpPercent > 0.6) {
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.sin(this.timer * 4);
            bullets.spawn(this.mesh.position.x, this.mesh.position.y, Math.cos(angle) * 260, Math.sin(angle) * 260, false);
          }
          this.fireCooldown = 0.45;
        } else {
          // 360 Double Ring Bullet Hell
          for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + this.timer * 4;
            bullets.spawn(this.mesh.position.x, this.mesh.position.y, Math.cos(angle) * 280, Math.sin(angle) * 280, false);
          }
          this.fireCooldown = 0.35;
        }
      } else {
        // Stage 4 Boss: Mother Brain Overlord
        if (hpPercent > 0.5) {
          // Synaptic Spiral Pulses
          for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2 + Math.cos(this.timer * 3);
            bullets.spawn(this.mesh.position.x - 20, this.mesh.position.y, Math.cos(angle) * 270, Math.sin(angle) * 270, false);
          }
          this.fireCooldown = 0.4;
        } else {
          // Enraged Bio-Nova Bullet Hell
          for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 + this.timer * 5;
            bullets.spawn(this.mesh.position.x, this.mesh.position.y, Math.cos(angle) * 310, Math.sin(angle) * 310, false);
          }
          this.fireCooldown = 0.3;
        }
      }
    }

    if (this.hp <= 0 && !this.isExploding) {
      this.isExploding = true;
      this.explodeTimer = 2.8;
      this.explodeTickTimer = 0;
    }
  }
}


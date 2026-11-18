import * as THREE from 'three';
import { Entity } from './Entity';
import { AssetManager } from '../AssetManager';
import { ParticleManager } from '../ParticleManager';
import { Enemy } from './Enemy';
import { Boss } from './Boss';

export class Missile extends Entity {
  target: Entity | null = null;
  speed: number = 550;
  timer: number = 0;
  damage: number = 8;
  trailTimer: number = 0;
  missileLevel: number = 1;

  constructor(scene: THREE.Scene, x: number, y: number, initialVy: number, missileLevel: number = 1) {
    const isUpgraded = missileLevel >= 2;
    const texture = AssetManager.getTexture(isUpgraded ? 'missile_upgraded' : 'missile');
    const width = isUpgraded ? 36 : 24;
    const height = isUpgraded ? 18 : 12;

    super(scene, texture, width, height);
    this.missileLevel = missileLevel;
    this.mesh.position.set(x, y, 0);
    this.vx = isUpgraded ? 350 : 250;
    this.vy = initialVy;
    this.radius = isUpgraded ? 14 : 10;
    this.speed = isUpgraded ? 750 : 550;
    this.damage = isUpgraded ? 18 : 8;
  }

  update(dt: number, time: number, cameraX: number, enemies?: Enemy[], boss?: Boss | null, particles?: ParticleManager) {
    if (!this.active) return;
    this.timer += dt;
    this.trailTimer += dt;

    // Find nearest target if none or current target inactive
    if (!this.target || !this.target.active) {
      let closestDist = Infinity;
      let closestEntity: Entity | null = null;

      if (boss && boss.active && !boss.isExploding) {
        const dx = boss.mesh.position.x - this.mesh.position.x;
        const dy = boss.mesh.position.y - this.mesh.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        closestDist = dist;
        closestEntity = boss;
      }

      if (enemies) {
        for (const e of enemies) {
          if (!e.active || e.isExploding || e.mesh.position.x < cameraX - 300) continue;
          const dx = e.mesh.position.x - this.mesh.position.x;
          const dy = e.mesh.position.y - this.mesh.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestEntity = e;
          }
        }
      }

      this.target = closestEntity;
    }

    // Homing Steering Logic
    if (this.target && this.target.active) {
      const targetX = this.target.mesh.position.x;
      const targetY = this.target.mesh.position.y;
      const dx = targetX - this.mesh.position.x;
      const dy = targetY - this.mesh.position.y;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len > 0) {
        const desiredVx = (dx / len) * this.speed;
        const desiredVy = (dy / len) * this.speed;
        
        // Smoothly steer velocity (faster steering for upgraded missiles)
        const steerStrength = Math.min(1.0, dt * (this.missileLevel >= 2 ? 10 : 6));
        this.vx += (desiredVx - this.vx) * steerStrength;
        this.vy += (desiredVy - this.vy) * steerStrength;
      }
    } else {
      // Accelerate forward if no target
      this.vx = Math.min(this.missileLevel >= 2 ? 850 : 650, this.vx + dt * 500);
    }

    // Orient mesh toward velocity direction
    const angle = Math.atan2(this.vy, this.vx);
    this.mesh.rotation.z = angle;

    // Move
    this.mesh.position.x += this.vx * dt;
    this.mesh.position.y += this.vy * dt;

    // Trail particles
    if (this.trailTimer > 0.025 && particles) {
      this.trailTimer = 0;
      const trailOffset = this.missileLevel >= 2 ? 18 : 12;
      particles.spawnExhaust(
        this.mesh.position.x - Math.cos(angle) * trailOffset,
        this.mesh.position.y - Math.sin(angle) * trailOffset
      );
      if (this.missileLevel >= 2) {
        // Dual engine energy trail for upgraded missile
        particles.spawnExplosion(
          this.mesh.position.x - Math.cos(angle) * trailOffset,
          this.mesh.position.y - Math.sin(angle) * trailOffset,
          0x00ffff,
          2
        );
      }
    }

    // Despawn if offscreen or expired after 4 seconds
    if (
      this.timer > 4.0 ||
      this.mesh.position.x > cameraX + 700 ||
      this.mesh.position.x < cameraX - 500 ||
      this.mesh.position.y > 450 ||
      this.mesh.position.y < -450
    ) {
      this.active = false;
    }
  }
}

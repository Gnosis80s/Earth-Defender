import * as THREE from 'three';
import { Pool } from './Pool';
import { AssetManager } from './AssetManager';

export interface Bullet {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  active: boolean;
  isPlayer: boolean;
  isTurretLaser?: boolean;
  isTurretMissile?: boolean;
  damage: number;
  homingFactor?: number;
}

export class BulletManager {
  private pool: Pool<Bullet>;
  public bullets: Bullet[] = [];
  private scene: THREE.Scene;

  private materialPlayer: THREE.MeshBasicMaterial;
  private materialEnemy: THREE.MeshBasicMaterial;
  private materialTurretLaser: THREE.MeshBasicMaterial;
  private materialIonLaser: THREE.MeshBasicMaterial;
  private materialTurretMissile: THREE.MeshBasicMaterial;
  private playerMaterials: Record<string, THREE.MeshBasicMaterial> = {};

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const geometry = new THREE.PlaneGeometry(16, 8);
    this.materialPlayer = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture('bulletPlayer'), 
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending 
    });
    this.playerMaterials['bulletPlayer'] = this.materialPlayer;
    this.playerMaterials['bulletPlayer_green'] = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture('bulletPlayer_green'), 
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending 
    });
    this.playerMaterials['bulletPlayer_purple'] = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture('bulletPlayer_purple'), 
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending 
    });
    this.playerMaterials['bulletPlayer_red'] = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture('bulletPlayer_red'), 
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending 
    });
    
    this.materialEnemy = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture('bulletEnemy'), 
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending 
    });
    this.materialTurretLaser = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('bulletTurretLaser'),
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending
    });
    this.materialIonLaser = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('bulletIonLaser'),
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      blending: THREE.AdditiveBlending
    });
    this.materialTurretMissile = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('missile'),
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05
    });

    this.pool = new Pool<Bullet>(() => {
      const mesh = new THREE.Mesh(geometry, this.materialPlayer);
      mesh.renderOrder = 12;
      mesh.visible = false;
      this.scene.add(mesh);
      return { mesh, vx: 0, vy: 0, active: false, isPlayer: true, damage: 1 };
    }, 200);
  }

  spawn(
    x: number, 
    y: number, 
    vx: number, 
    vy: number, 
    isPlayer: boolean, 
    damage: number = 1, 
    isTurretLaser: boolean = false, 
    playerLaserColor: string = 'bulletPlayer', 
    isIonLaser: boolean = false,
    isTurretMissile: boolean = false,
    homingFactor: number = 0
  ) {
    const b = this.pool.get();
    b.mesh.position.set(x, y, 0);
    b.vx = vx;
    b.vy = vy;
    b.active = true;
    b.isPlayer = isPlayer;
    b.isTurretLaser = isTurretLaser;
    b.isTurretMissile = isTurretMissile;
    b.damage = damage;
    b.homingFactor = homingFactor;
    b.mesh.visible = true;

    if (isTurretMissile) {
      b.mesh.material = this.materialTurretMissile;
      b.mesh.rotation.z = Math.atan2(vy, vx);
      b.mesh.scale.set(1.4, 1.4, 1);
    } else if (isIonLaser) {
      b.mesh.material = this.materialIonLaser;
      b.mesh.rotation.z = Math.atan2(vy, vx);
      b.mesh.scale.set(1.5, 1.3, 1);
    } else if (isTurretLaser) {
      b.mesh.material = this.materialTurretLaser;
      b.mesh.rotation.z = Math.atan2(vy, vx);
      b.mesh.scale.set(1.4, 1.2, 1);
    } else if (isPlayer) {
      b.mesh.material = this.playerMaterials[playerLaserColor] || this.materialPlayer;
      b.mesh.rotation.z = 0;
      b.mesh.scale.set(1, 1, 1);
    } else {
      b.mesh.material = this.materialEnemy;
      b.mesh.rotation.z = 0;
      b.mesh.scale.set(1, 1, 1);
    }
    this.bullets.push(b);
  }

  update(dt: number, cameraX: number, playerPos?: THREE.Vector3) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (!b.active) continue;

      // Homing logic for enemy missiles (e.g. 20% steering effect)
      if (!b.isPlayer && b.homingFactor && b.homingFactor > 0 && playerPos) {
        const dx = playerPos.x - b.mesh.position.x;
        const dy = playerPos.y - b.mesh.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const currentSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          const desiredVx = (dx / dist) * currentSpeed;
          const desiredVy = (dy / dist) * currentSpeed;

          // 20% homing steer rate
          const steerRate = Math.min(1.0, b.homingFactor * 10 * dt);
          b.vx += (desiredVx - b.vx) * steerRate;
          b.vy += (desiredVy - b.vy) * steerRate;

          const newSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (newSpeed > 0) {
            b.vx = (b.vx / newSpeed) * currentSpeed;
            b.vy = (b.vy / newSpeed) * currentSpeed;
          }
        }
        b.mesh.rotation.z = Math.atan2(b.vy, b.vx);
      }

      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;

      // Offscreen culling
      if (
        b.mesh.position.x > cameraX + 800 || 
        b.mesh.position.x < cameraX - 800 ||
        b.mesh.position.y > 600 || 
        b.mesh.position.y < -600
      ) {
        this.destroy(i);
      }
    }
  }

  destroy(index: number) {
    const b = this.bullets[index];
    if (!b) return;
    b.active = false;
    b.mesh.visible = false;
    this.pool.release(b);
    const last = this.bullets.pop();
    if (last && index < this.bullets.length) {
      this.bullets[index] = last;
    }
  }
}

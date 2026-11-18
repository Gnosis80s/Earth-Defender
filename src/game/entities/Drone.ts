import * as THREE from 'three';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';

export class Drone {
  mesh: THREE.Mesh;
  offsetY: number;
  fireTimer: number = 0;
  fireInterval: number = 0.38; // Slower rate than main player weapon (~0.12s)

  constructor(scene: THREE.Scene, offsetY: number) {
    this.offsetY = offsetY;
    const geo = new THREE.PlaneGeometry(16, 16);
    const mat = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture('drone'), 
      transparent: true 
    });
    this.mesh = new THREE.Mesh(geo, mat);
    scene.add(this.mesh);
  }

  update(dt: number, time: number, playerX: number, playerY: number, bullets?: BulletManager, isFiring?: boolean) {
    // Smoothly follow player with offset
    const targetX = playerX - 20;
    const targetY = playerY + this.offsetY + Math.sin(time * 6 + this.offsetY) * 5;

    this.mesh.position.x += (targetX - this.mesh.position.x) * 10 * dt;
    this.mesh.position.y += (targetY - this.mesh.position.y) * 10 * dt;

    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }

    if (isFiring && bullets && this.fireTimer <= 0) {
      this.fireTimer = this.fireInterval;
      // Top drone (offsetY > 0) fires 0 to +20 deg (top-right), bottom drone (offsetY < 0) fires 0 to -20 deg (bottom-right)
      let angle = 0;
      const maxAngleRad = (20 * Math.PI) / 180;
      if (this.offsetY > 0) {
        angle = Math.random() * maxAngleRad;
      } else if (this.offsetY < 0) {
        angle = -Math.random() * maxAngleRad;
      } else {
        angle = (Math.random() - 0.5) * maxAngleRad;
      }

      const speed = 750;
      const vx = speed * Math.cos(angle);
      const vy = speed * Math.sin(angle);
      
      // Ion laser projectile: slower velocity, higher damage, custom cyan/blue ion laser texture
      bullets.spawn(this.mesh.position.x + 8, this.mesh.position.y, vx, vy, true, 2.5, false, 'bulletPlayer', true);
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

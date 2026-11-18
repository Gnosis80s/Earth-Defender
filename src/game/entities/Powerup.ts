import * as THREE from 'three';
import { Entity } from './Entity';

export type PowerupType = 'P' | 'S' | 'D' | 'M' | 'U';

export class Powerup extends Entity {
  type: PowerupType;
  timer: number = 0;

  constructor(scene: THREE.Scene, type: PowerupType, x: number, y: number) {
    const texture = Powerup.generateTexture(type);
    super(scene, texture, 28, 28);
    this.type = type;
    this.mesh.position.set(x, y, 0);
    this.radius = 14;
  }

  static generateTexture(type: PowerupType): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    let mainColor = '#f0abfc'; // P = Plasma Weapon
    let glowColor = '#c084fc';
    if (type === 'S') { // S = Shield
      mainColor = '#38bdf8';
      glowColor = '#0284c7';
    } else if (type === 'D') { // D = Drone
      mainColor = '#4ade80';
      glowColor = '#16a34a';
    } else if (type === 'M') { // M = Extra Missile Capacity (+1)
      mainColor = '#f59e0b';
      glowColor = '#d97706';
    } else if (type === 'U') { // U = Missile Warhead Upgrade
      mainColor = '#ef4444';
      glowColor = '#b91c1c';
    }

    // Outer Glow Ring
    const grad = ctx.createRadialGradient(16, 16, 8, 16, 16, 16);
    grad.addColorStop(0, mainColor);
    grad.addColorStop(0.7, glowColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();

    // Solid Inner Circle
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
    ctx.fill();

    // Shiny Specular Highlight Arc
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(14, 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // Border Ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Letter Text
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.font = '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type, 16, 17);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  update(dt: number, time: number, cameraX: number) {
    if (!this.active) return;
    this.timer += dt;

    // Gentle float left and bobbing
    this.mesh.position.x -= 40 * dt;
    this.mesh.position.y += Math.sin(this.timer * 4) * 15 * dt;

    // Pulse & gentle rotation animation
    const scale = 1.0 + Math.sin(this.timer * 6) * 0.1;
    this.mesh.scale.set(scale, scale, 1);
    this.mesh.rotation.z = Math.sin(this.timer * 3) * 0.2;

    // Despawn offscreen
    if (this.mesh.position.x < cameraX - 500) {
      this.active = false;
    }
  }
}

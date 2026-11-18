import * as THREE from 'three';
import { AssetManager } from './AssetManager';

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
  isSmoke?: boolean;
  initialScale?: number;
  r: number;
  g: number;
  b: number;
  mesh?: THREE.Mesh; // dummy for backward compatibility
}

export class ParticleManager {
  public particles: Particle[] = [];
  private scene: THREE.Scene;
  
  private maxAdditive = 600;
  private maxSmoke = 150;
  private additiveMesh: THREE.InstancedMesh;
  private smokeMesh: THREE.InstancedMesh;

  private dummy = new THREE.Object3D();
  private tempColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.PlaneGeometry(8, 8);

    const additiveMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('particle'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const smokeMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('particle'),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.additiveMesh = new THREE.InstancedMesh(geometry, additiveMat, this.maxAdditive);
    this.additiveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.additiveMesh.renderOrder = 15;
    this.additiveMesh.count = 0;
    this.additiveMesh.frustumCulled = false;
    this.scene.add(this.additiveMesh);

    this.smokeMesh = new THREE.InstancedMesh(geometry, smokeMat, this.maxSmoke);
    this.smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.smokeMesh.renderOrder = 14;
    this.smokeMesh.count = 0;
    this.smokeMesh.frustumCulled = false;
    this.scene.add(this.smokeMesh);

    // Pre-allocate zero-GC particle pool
    const totalCap = this.maxAdditive + this.maxSmoke;
    for (let i = 0; i < totalCap; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        active: false,
        isSmoke: false,
        initialScale: 1,
        r: 1,
        g: 1,
        b: 1,
      });
    }
  }

  private allocParticle(): Particle | null {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    return null;
  }

  public clear() {
    for (const p of this.particles) {
      p.active = false;
    }
    this.additiveMesh.count = 0;
    this.smokeMesh.count = 0;
  }

  spawnExplosion(x: number, y: number, color: THREE.ColorRepresentation, count: number = 20) {
    const col = this.tempColor.set(color);
    const cr = col.r;
    const cg = col.g;
    const cb = col.b;

    // 1. High-velocity white-hot core flash
    const coreCount = Math.min(8, Math.ceil(count * 0.3));
    for (let i = 0; i < coreCount; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.x = x;
      p.y = y;
      p.z = 1;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 260 + 100;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = Math.random() * 0.2 + 0.1;
      p.maxLife = p.life;
      p.active = true;
      p.isSmoke = false;
      p.initialScale = Math.random() * 1.2 + 0.8;
      p.r = 1;
      p.g = 1;
      p.b = 1;
    }

    // 2. Colored main fireball burst
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.x = x;
      p.y = y;
      p.z = 0;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 40;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = Math.random() * 0.5 + 0.25;
      p.maxLife = p.life;
      p.active = true;
      p.isSmoke = false;
      p.initialScale = Math.random() * 1.0 + 0.5;
      p.r = cr;
      p.g = cg;
      p.b = cb;
    }
  }

  spawnSparks(x: number, y: number, dirAngle: number = 0, color: THREE.ColorRepresentation = 0xfff066, count: number = 8) {
    const col = this.tempColor.set(color);
    const cr = col.r;
    const cg = col.g;
    const cb = col.b;

    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      if (!p) break;
      p.x = x;
      p.y = y;
      p.z = 1;
      const angle = dirAngle + (Math.random() - 0.5) * 1.4;
      const speed = Math.random() * 220 + 80;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = Math.random() * 0.22 + 0.08;
      p.maxLife = p.life;
      p.active = true;
      p.isSmoke = false;
      p.initialScale = Math.random() * 0.8 + 0.4;
      p.r = cr;
      p.g = cg;
      p.b = cb;
    }
  }

  spawnExhaust(x: number, y: number) {
    const p = this.allocParticle();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.z = 0;
    const angle = Math.PI + (Math.random() - 0.5) * 0.4;
    const speed = Math.random() * 60 + 60;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = Math.random() * 0.25 + 0.12;
    p.maxLife = p.life;
    p.active = true;
    p.isSmoke = false;
    p.initialScale = Math.random() * 0.7 + 0.6;
    
    // Multi-shade plasma exhaust (cyan / amber / orange)
    const rand = Math.random();
    if (rand > 0.6) {
      p.r = 0.0; p.g = 0.94; p.b = 1.0;
    } else if (rand > 0.3) {
      p.r = 0.96; p.g = 0.62; p.b = 0.04;
    } else {
      p.r = 1.0; p.g = 0.27; p.b = 0.0;
    }
  }

  spawnSmoke(x: number, y: number) {
    const p = this.allocParticle();
    if (!p) return;
    p.x = x + (Math.random() - 0.5) * 10;
    p.y = y;
    p.z = -2;
    p.vx = (Math.random() - 0.5) * 12;
    p.vy = Math.random() * 35 + 25; // rises into sky
    p.life = Math.random() * 1.5 + 1.0;
    p.maxLife = p.life;
    p.active = true;
    p.isSmoke = true;
    p.initialScale = Math.random() * 0.8 + 0.8;
    const shade = (Math.random() * 30 + 35) / 255;
    p.r = shade;
    p.g = shade;
    p.b = shade + 10 / 255;
  }

  spawnFire(x: number, y: number) {
    const p = this.allocParticle();
    if (!p) return;
    p.x = x + (Math.random() - 0.5) * 8;
    p.y = y;
    p.z = -1;
    p.vx = (Math.random() - 0.5) * 10;
    p.vy = Math.random() * 30 + 15;
    p.life = Math.random() * 0.4 + 0.2;
    p.maxLife = p.life;
    p.active = true;
    p.isSmoke = false;
    p.initialScale = Math.random() * 0.7 + 0.5;
    if (Math.random() > 0.4) {
      p.r = 1.0; p.g = 0.4; p.b = 0.0;
    } else {
      p.r = 1.0; p.g = 0.8; p.b = 0.0;
    }
  }

  update(dt: number) {
    let additiveIdx = 0;
    let smokeIdx = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95; // drag
      p.vy *= 0.95;

      const progress = p.life / p.maxLife;

      if (p.isSmoke) {
        if (smokeIdx < this.maxSmoke) {
          const age = 1 - progress; // 0 to 1
          const scale = (p.initialScale || 1) * (1 + age * 2.8);
          this.dummy.position.set(p.x, p.y, p.z);
          this.dummy.scale.set(scale, scale, 1);
          this.dummy.updateMatrix();
          this.smokeMesh.setMatrixAt(smokeIdx, this.dummy.matrix);

          const alpha = progress * 0.6;
          this.tempColor.setRGB(p.r * alpha, p.g * alpha, p.b * alpha);
          this.smokeMesh.setColorAt(smokeIdx, this.tempColor);
          smokeIdx++;
        }
      } else {
        if (additiveIdx < this.maxAdditive) {
          const scale = progress * (p.initialScale || 1);
          this.dummy.position.set(p.x, p.y, p.z);
          this.dummy.scale.set(scale, scale, 1);
          this.dummy.updateMatrix();
          this.additiveMesh.setMatrixAt(additiveIdx, this.dummy.matrix);

          this.tempColor.setRGB(p.r * progress, p.g * progress, p.b * progress);
          this.additiveMesh.setColorAt(additiveIdx, this.tempColor);
          additiveIdx++;
        }
      }
    }

    this.additiveMesh.count = additiveIdx;
    this.additiveMesh.instanceMatrix.needsUpdate = true;
    if (this.additiveMesh.instanceColor) {
      this.additiveMesh.instanceColor.needsUpdate = true;
    }

    this.smokeMesh.count = smokeIdx;
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) {
      this.smokeMesh.instanceColor.needsUpdate = true;
    }
  }
}

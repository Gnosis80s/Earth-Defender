import * as THREE from 'three';

export abstract class Entity {
  mesh: THREE.Mesh;
  vx: number = 0;
  vy: number = 0;
  hp: number = 1;
  active: boolean = true;
  radius: number = 16;

  constructor(scene: THREE.Scene, texture: THREE.Texture, width: number, height: number) {
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  abstract update(dt: number, time: number, cameraX: number): void;

  takeDamage(amount: number) {
    this.hp -= amount;
    // Flashing effect could be added here
    if (this.hp <= 0) {
      this.active = false;
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

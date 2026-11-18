import * as THREE from 'three';
import { AssetManager } from '../AssetManager';
import { SoundManager } from '../SoundManager';

export class BlastDoor {
  group: THREE.Group;
  topDoor: THREE.Mesh; // left door in horizontal mode
  bottomDoor: THREE.Mesh; // right door in horizontal mode
  frameMesh: THREE.Mesh;
  topLockLight: THREE.Mesh; // left light in horizontal mode
  bottomLockLight: THREE.Mesh; // right light in horizontal mode
  shaftMesh?: THREE.Mesh;

  x: number;
  orientation: 'vertical' | 'horizontal';
  openProgress = 0; // 0 = fully closed, 1 = fully open
  isOpen = false;
  isOpening = false;
  isClosing = false;
  lightTimer = 0;

  constructor(scene: THREE.Scene, x: number, orientation: 'vertical' | 'horizontal' = 'vertical', y: number = -210) {
    this.x = x;
    this.orientation = orientation;
    this.group = new THREE.Group();

    if (orientation === 'horizontal') {
      const isCeiling = y > 0;
      // Subterranean shaft background behind doors
      const shaftGeo = new THREE.PlaneGeometry(300, 160);
      const shaftMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_horizontal_shaft'),
        transparent: true,
        depthWrite: false
      });
      this.shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
      this.shaftMesh.position.set(0, isCeiling ? 50 : -50, -1);
      if (isCeiling) {
        this.shaftMesh.scale.y = -1;
      }
      this.shaftMesh.renderOrder = 3;
      this.group.add(this.shaftMesh);

      // Left door panel (150 wide x 60 tall)
      const doorGeo = new THREE.PlaneGeometry(150, 60);
      const leftMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_horizontal_panel'),
        transparent: true,
        depthWrite: false
      });
      this.topDoor = new THREE.Mesh(doorGeo, leftMat);
      this.topDoor.position.set(-75, 0, 0); // initial closed position
      this.topDoor.renderOrder = 4;

      // Right door panel (150 wide x 60 tall, flipped horizontally)
      const rightMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_horizontal_panel'),
        transparent: true,
        depthWrite: false
      });
      this.bottomDoor = new THREE.Mesh(doorGeo, rightMat);
      this.bottomDoor.scale.x = -1;
      this.bottomDoor.position.set(75, 0, 0); // initial closed position
      this.bottomDoor.renderOrder = 4;

      // Outer silo floor frame (360 wide x 80 tall)
      const frameGeo = new THREE.PlaneGeometry(360, 80);
      const frameMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_horizontal_frame'),
        transparent: true,
        depthWrite: false
      });
      this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
      this.frameMesh.position.set(0, 0, 1);
      if (isCeiling) {
        this.frameMesh.scale.y = -1;
      }
      this.frameMesh.renderOrder = 6;

      // Status lock LEDs (left & right)
      const lightGeo = new THREE.PlaneGeometry(16, 16);
      const redLightMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true
      });
      this.topLockLight = new THREE.Mesh(lightGeo, redLightMat);
      this.topLockLight.position.set(-150, isCeiling ? -20 : 20, 2);
      this.topLockLight.renderOrder = 7;

      this.bottomLockLight = new THREE.Mesh(lightGeo, redLightMat.clone());
      this.bottomLockLight.position.set(150, isCeiling ? -20 : 20, 2);
      this.bottomLockLight.renderOrder = 7;

      this.group.add(this.topDoor);
      this.group.add(this.bottomDoor);
      this.group.add(this.frameMesh);
      this.group.add(this.topLockLight);
      this.group.add(this.bottomLockLight);

      this.group.position.set(x, y, -2);
    } else {
      // Top door panel (120 wide x 300 tall)
      const doorGeo = new THREE.PlaneGeometry(120, 300);
      const topMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_top'),
        transparent: true,
        depthWrite: false
      });
      this.topDoor = new THREE.Mesh(doorGeo, topMat);
      this.topDoor.position.set(0, 150, 0); // initial closed position
      this.topDoor.renderOrder = 5;

      // Bottom door panel (120 wide x 300 tall)
      const bottomMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_bottom'),
        transparent: true,
        depthWrite: false
      });
      this.bottomDoor = new THREE.Mesh(doorGeo, bottomMat);
      this.bottomDoor.position.set(0, -150, 0); // initial closed position
      this.bottomDoor.renderOrder = 5;

      // Outer door frame / archway
      const frameGeo = new THREE.PlaneGeometry(160, 600);
      const frameMat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('blast_door_frame'),
        transparent: true,
        depthWrite: false
      });
      this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
      this.frameMesh.position.set(0, 0, 1);
      this.frameMesh.renderOrder = 6;

      // Status lock LED indicators
      const lightGeo = new THREE.PlaneGeometry(20, 20);
      const redLightMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true
      });
      this.topLockLight = new THREE.Mesh(lightGeo, redLightMat);
      this.topLockLight.position.set(-65, 230, 2);
      this.topLockLight.renderOrder = 7;

      this.bottomLockLight = new THREE.Mesh(lightGeo, redLightMat.clone());
      this.bottomLockLight.position.set(-65, -230, 2);
      this.bottomLockLight.renderOrder = 7;

      this.group.add(this.topDoor);
      this.group.add(this.bottomDoor);
      this.group.add(this.frameMesh);
      this.group.add(this.topLockLight);
      this.group.add(this.bottomLockLight);

      this.group.position.set(x, 0, -2);
    }
    scene.add(this.group);
  }

  open() {
    if (this.isOpen && !this.isClosing) return;
    this.isOpening = true;
    this.isClosing = false;
    SoundManager.playExplosion('large'); // Pneumatic opening thump
  }

  close() {
    if (!this.isOpen && !this.isOpening) return;
    this.isClosing = true;
    this.isOpening = false;
    SoundManager.playExplosion('large'); // Heavy locking thump
  }

  update(dt: number) {
    this.lightTimer += dt * 8;

    if (this.isOpening) {
      this.openProgress += dt * 0.75; // Takes ~1.3 seconds to open
      if (this.openProgress >= 1.0) {
        this.openProgress = 1.0;
        this.isOpen = true;
        this.isOpening = false;
      }

      if (this.orientation === 'horizontal') {
        // Slide left panel LEFT and right panel RIGHT
        this.topDoor.position.x = -75 - this.openProgress * 130;
        this.bottomDoor.position.x = 75 + this.openProgress * 130;
      } else {
        // Slide top panel UP and bottom panel DOWN
        this.topDoor.position.y = 150 + this.openProgress * 260;
        this.bottomDoor.position.y = -150 - this.openProgress * 260;
      }
    } else if (this.isClosing) {
      this.openProgress -= dt * 0.75;
      if (this.openProgress <= 0) {
        this.openProgress = 0;
        this.isOpen = false;
        this.isClosing = false;
      }

      if (this.orientation === 'horizontal') {
        this.topDoor.position.x = -75 - this.openProgress * 130;
        this.bottomDoor.position.x = 75 + this.openProgress * 130;
      } else {
        this.topDoor.position.y = 150 + this.openProgress * 260;
        this.bottomDoor.position.y = -150 - this.openProgress * 260;
      }
    }

    // Flash lights (Red pulsing when locked, Green flashing when opening/open)
    if (this.isOpen || this.isOpening) {
      const greenColor = new THREE.Color(0x00ff66);
      (this.topLockLight.material as THREE.MeshBasicMaterial).color = greenColor;
      (this.bottomLockLight.material as THREE.MeshBasicMaterial).color = greenColor;
      this.topLockLight.visible = Math.sin(this.lightTimer * 2) > 0;
      this.bottomLockLight.visible = Math.sin(this.lightTimer * 2) > 0;
    } else {
      const redColor = new THREE.Color(0xff0033);
      (this.topLockLight.material as THREE.MeshBasicMaterial).color = redColor;
      (this.bottomLockLight.material as THREE.MeshBasicMaterial).color = redColor;
      this.topLockLight.visible = Math.sin(this.lightTimer) > -0.2;
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}

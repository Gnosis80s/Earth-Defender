import * as THREE from 'three';
import { AssetManager } from '../AssetManager';
import { TOWER_LAMP, DECK_W } from '../art/LaunchpadArt';

export class Launchpad {
  group: THREE.Group;
  tarmacMesh: THREE.Mesh;
  leftGantryMesh: THREE.Mesh;
  rightGantryMesh: THREE.Mesh;
  towerMesh: THREE.Mesh;
  siloMesh: THREE.Mesh;
  searchlightMesh: THREE.Mesh;
  
  gantryOpenProgress: number = 0; // 0 = clamped on ship, 1 = retracted open
  isRetracting: boolean = false;
  time: number = 0;
  x: number;
  y: number;

  constructor(scene: THREE.Scene, x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
    this.group = new THREE.Group();

    // 1. Pad deck (DECK_W x 160) along the bottom edge (y = -300 to -140); deck surface at y -230
    const tarmacGeo = new THREE.PlaneGeometry(DECK_W, 160);
    const tarmacMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('launchpad_deck'),
      transparent: true,
      depthWrite: false
    });
    this.tarmacMesh = new THREE.Mesh(tarmacGeo, tarmacMat);
    this.tarmacMesh.position.set(288 - DECK_W / 2, -220, 0); // right edge stays at world x 288
    this.tarmacMesh.renderOrder = 7;
    this.group.add(this.tarmacMesh);

    // 2. Left Gantry Clamp Arm (at ship launch pad x = -220)
    const gantryGeo = new THREE.PlaneGeometry(56, 140);
    gantryGeo.translate(0, 70, 0); // pivot at the foot, so the arms hinge open from the deck
    const leftGantryMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('launchpad_arm_left'),
      transparent: true,
      depthWrite: false
    });
    this.leftGantryMesh = new THREE.Mesh(gantryGeo, leftGantryMat);
    this.leftGantryMesh.position.set(-258, -225, 1);
    this.leftGantryMesh.renderOrder = 8;
    this.group.add(this.leftGantryMesh);

    // 3. Right Gantry Clamp Arm (its own mirrored texture, so moonlight stays on the right)
    const rightGantryMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('launchpad_arm_right'),
      transparent: true,
      depthWrite: false
    });
    this.rightGantryMesh = new THREE.Mesh(gantryGeo, rightGantryMat);
    this.rightGantryMesh.position.set(-182, -225, 1);
    this.rightGantryMesh.renderOrder = 8;
    this.group.add(this.rightGantryMesh);

    // 4. Command Control Tower (240 wide x 360 tall)
    const towerGeo = new THREE.PlaneGeometry(240, 360);
    const towerMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('launchpad_tower'),
      transparent: true,
      depthWrite: false
    });
    this.towerMesh = new THREE.Mesh(towerGeo, towerMat);
    this.towerMesh.position.set(-330, -80, -1);
    this.towerMesh.renderOrder = 6;
    this.group.add(this.towerMesh);

    // 5. Fuel Silo & Defense Radar Compound (240 wide x 280 tall)
    const siloGeo = new THREE.PlaneGeometry(240, 280);
    const siloMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('launchpad_fuel'),
      transparent: true,
      depthWrite: false
    });
    this.siloMesh = new THREE.Mesh(siloGeo, siloMat);
    this.siloMesh.position.set(100, -110, -1); // Brought way in from 240
    this.siloMesh.renderOrder = 6;
    this.group.add(this.siloMesh);

    // 6. Command Signboard Banner (Removed)
    
    // 7. Searchlight beam, pivoting from the lamp on the control cab roof.
    const lightGeo = new THREE.PlaneGeometry(150, 460);
    lightGeo.translate(0, 230, 0); // pivot at the beam's base
    const lightMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('searchlight_beam'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.7,
    });
    this.searchlightMesh = new THREE.Mesh(lightGeo, lightMat);
    // Tower texture (x, row) -> group space: mesh centre (-330, -80), size 240x360.
    this.searchlightMesh.position.set(-330 - 120 + TOWER_LAMP.x, -80 + 180 - TOWER_LAMP.y, -2);
    this.searchlightMesh.renderOrder = 5;
    this.group.add(this.searchlightMesh);

    this.group.position.set(x, y, -2);
    scene.add(this.group);
  }

  retractGantry() {
    this.isRetracting = true;
  }

  reset() {
    this.gantryOpenProgress = 0;
    this.isRetracting = false;
    this.leftGantryMesh.position.x = -258;
    this.leftGantryMesh.rotation.z = 0;
    this.rightGantryMesh.position.x = -182;
    this.rightGantryMesh.rotation.z = 0;
  }

  update(dt: number) {
    this.time += dt;

    // Sweep searchlight angle back and forth across the sky
    if (this.searchlightMesh) {
      this.searchlightMesh.rotation.z = Math.sin(this.time * 0.8) * 0.25 - 0.1;
    }

    if (this.isRetracting && this.gantryOpenProgress < 1) {
      this.gantryOpenProgress = Math.min(1, this.gantryOpenProgress + dt * 1.5);
      const ease = this.gantryOpenProgress * this.gantryOpenProgress * (3 - 2 * this.gantryOpenProgress);
      
      // Pivot gantry arms outwards away from ship launch path
      // Hinge the arms outward from their feet, clear of the ship's climb.
      this.leftGantryMesh.position.x = -258 - ease * 14;
      this.leftGantryMesh.rotation.z = ease * 0.42;

      this.rightGantryMesh.position.x = -182 + ease * 14;
      this.rightGantryMesh.rotation.z = -ease * 0.42;
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}

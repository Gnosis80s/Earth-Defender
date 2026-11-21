import * as THREE from 'three';
import { AssetManager } from '../AssetManager';

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

    // 1. Tarmac Armor Base (800 wide x 160 tall) - Sitting right along bottom edge (y = -300 to -140)
    const tarmacGeo = new THREE.PlaneGeometry(800, 160);
    const tarmacMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('uk_launchpad_tarmac'),
      transparent: true,
      depthWrite: false
    });
    this.tarmacMesh = new THREE.Mesh(tarmacGeo, tarmacMat);
    this.tarmacMesh.position.set(-112, -220, 0); // shift left slightly to keep launchpad aligned
    this.tarmacMesh.renderOrder = 7;
    this.group.add(this.tarmacMesh);

    // 2. Left Gantry Clamp Arm (at ship launch pad x = -220)
    const gantryGeo = new THREE.PlaneGeometry(56, 140);
    const leftGantryMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('uk_launchpad_gantry'),
      transparent: true,
      depthWrite: false
    });
    this.leftGantryMesh = new THREE.Mesh(gantryGeo, leftGantryMat);
    this.leftGantryMesh.position.set(-258, -155, 1);
    this.leftGantryMesh.renderOrder = 8;
    this.group.add(this.leftGantryMesh);

    // 3. Right Gantry Clamp Arm (Flipped X)
    const rightGantryMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('uk_launchpad_gantry'),
      transparent: true,
      depthWrite: false
    });
    this.rightGantryMesh = new THREE.Mesh(gantryGeo, rightGantryMat);
    this.rightGantryMesh.scale.x = -1;
    this.rightGantryMesh.position.set(-182, -155, 1);
    this.rightGantryMesh.renderOrder = 8;
    this.group.add(this.rightGantryMesh);

    // 4. Command Control Tower (240 wide x 360 tall)
    const towerGeo = new THREE.PlaneGeometry(240, 360);
    const towerMat = new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('uk_launchpad_tower'),
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
      map: AssetManager.getTexture('uk_launchpad_silo'),
      transparent: true,
      depthWrite: false
    });
    this.siloMesh = new THREE.Mesh(siloGeo, siloMat);
    this.siloMesh.position.set(100, -110, -1); // Brought way in from 240
    this.siloMesh.renderOrder = 6;
    this.group.add(this.siloMesh);

    // 6. Command Signboard Banner (Removed)
    
    // 7. Upward Searchlight Beam (Sky Scanner)
    const lightGeo = new THREE.PlaneGeometry(160, 450);
    // Draw glowing light cone gradient texture dynamically
    const lightCanvas = document.createElement('canvas');
    lightCanvas.width = 128;
    lightCanvas.height = 256;
    const lctx = lightCanvas.getContext('2d')!;
    const grad = lctx.createLinearGradient(64, 256, 64, 0);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.15)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.moveTo(48, 256);
    lctx.lineTo(80, 256);
    lctx.lineTo(128, 0);
    lctx.lineTo(0, 0);
    lctx.closePath();
    lctx.fill();

    const lightTex = new THREE.CanvasTexture(lightCanvas);
    const lightMat = new THREE.MeshBasicMaterial({
      map: lightTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.searchlightMesh = new THREE.Mesh(lightGeo, lightMat);
    this.searchlightMesh.position.set(-330, 150, -2);
    this.searchlightMesh.renderOrder = 5;
    this.group.add(this.searchlightMesh);

    // Night grade: these textures are painted in daylight colours, but the pad
    // sits in the moonlit Stage 1 scene. A cool, dim multiply ties it in.
    for (const m of [this.tarmacMesh, this.leftGantryMesh, this.rightGantryMesh, this.towerMesh, this.siloMesh]) {
      (m.material as THREE.MeshBasicMaterial).color.setHex(0x8f9ac4);
    }

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
      this.leftGantryMesh.position.x = -258 - ease * 50;
      this.leftGantryMesh.rotation.z = ease * 0.38; // tilts left

      this.rightGantryMesh.position.x = -182 + ease * 50;
      this.rightGantryMesh.rotation.z = -ease * 0.38; // tilts right
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}

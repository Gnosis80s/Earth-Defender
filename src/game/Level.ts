import * as THREE from 'three';
import { AssetManager } from './AssetManager';
import { Enemy } from './entities/Enemy';
import { Boss } from './entities/Boss';
import { ParticleManager } from './ParticleManager';
import { BlastDoor } from './entities/BlastDoor';
import { Launchpad } from './entities/Launchpad';

export class Level {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  bgMountains1!: THREE.Mesh;
  bgMountains2!: THREE.Mesh;
  bgCity1!: THREE.Mesh;
  bgCity2!: THREE.Mesh;
  bgMoon!: THREE.Mesh;
  bgEarth!: THREE.Mesh;
  bgLunar1!: THREE.Mesh;
  bgLunar2!: THREE.Mesh;
  bgCavernFar1!: THREE.Mesh;
  bgCavernFar2!: THREE.Mesh;
  bgCavern1!: THREE.Mesh;
  bgCavern2!: THREE.Mesh;
  bgSolarDock1!: THREE.Mesh;
  bgSolarDock2!: THREE.Mesh;
  
  matMtn!: THREE.MeshBasicMaterial;
  matCity!: THREE.MeshBasicMaterial;
  matLunar!: THREE.MeshBasicMaterial;
  matSolarDock!: THREE.MeshBasicMaterial;
  matCavernFar1!: THREE.MeshBasicMaterial;
  matCavernFar2!: THREE.MeshBasicMaterial;
  matCavern1!: THREE.MeshBasicMaterial;
  matCavern2!: THREE.MeshBasicMaterial;

  starsPoints!: THREE.Points;
  starPositions!: Float32Array;

  enemies: Enemy[] = [];
  boss: Boss | null = null;
  scrollSpeed = 100;
  distance = 0;
  bossDistance = 4500;
  bossActive = false;
  bossDefeated = false;
  currentStage = 1;
  hardcoreMode = false;

  asteroidWarning = false;
  asteroidFieldActive = false;
  asteroidSpawnTimer = 0;
  missileWarning = false;
  lunarTurretSectionActive = false;
  turretSpawnTimer = 0;
  enemySpawnDelay = 0;
  subbossSpawned = false;

  blastDoor: BlastDoor | null = null;
  blastDoorActive = false;
  blastDoorCleared = false;
  stage4SubbossSpawned = false;
  stage4Subboss: Enemy | null = null;

  launchpad: Launchpad | null = null;

  onAsteroidWarningUpdate: (active: boolean) => void = () => {};
  onMissileWarningUpdate: (active: boolean) => void = () => {};

  constructor(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
    this.scene = scene;
    this.camera = camera;
    this.initBackgrounds();
    this.initStarfield();
  }

  initStarfield() {
    const starCount = 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 900;
      positions[i * 3 + 1] = 40 + Math.random() * 240;
      positions[i * 3 + 2] = -20;

      const isCyan = Math.random() > 0.4;
      colors[i * 3] = isCyan ? 0.3 : 1.0;
      colors[i * 3 + 1] = isCyan ? 0.9 : 0.5;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });

    this.starsPoints = new THREE.Points(geometry, material);
    this.starsPoints.frustumCulled = false; // Prevent frustum culling
    this.starsPoints.renderOrder = 0;
    this.starPositions = positions;
    this.scene.add(this.starsPoints);
  }

  initBackgrounds() {
    const geo = new THREE.PlaneGeometry(800, 400);
    this.matMtn = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_mountains'), transparent: true, depthWrite: false });
    this.bgMountains1 = new THREE.Mesh(geo, this.matMtn);
    this.bgMountains1.position.set(0, -140, -10);
    this.bgMountains1.renderOrder = 1;
    this.bgMountains2 = new THREE.Mesh(geo, this.matMtn);
    this.bgMountains2.position.set(800, -140, -10);
    this.bgMountains2.renderOrder = 1;
    
    this.scene.add(this.bgMountains1);
    this.scene.add(this.bgMountains2);

    this.matCity = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_city'), transparent: true, depthWrite: false });
    this.bgCity1 = new THREE.Mesh(geo, this.matCity);
    this.bgCity1.position.set(0, -130, -5);
    this.bgCity1.renderOrder = 2;
    this.bgCity2 = new THREE.Mesh(geo, this.matCity);
    this.bgCity2.position.set(800, -130, -5);
    this.bgCity2.renderOrder = 2;

    this.scene.add(this.bgCity1);
    this.scene.add(this.bgCity2);

    const moonGeo = new THREE.PlaneGeometry(128, 128);
    const moonMat = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('moon'), transparent: true, depthWrite: false });
    this.bgMoon = new THREE.Mesh(moonGeo, moonMat);
    // Position moon statically in the background. We'll update it based on camX so it parallax scrolls slowly.
    // It sits in front of the star field (z: -15 to -5 range).
    this.bgMoon.position.set(300, 100, -15);
    this.bgMoon.renderOrder = 1;
    this.scene.add(this.bgMoon);

    const earthGeo = new THREE.PlaneGeometry(160, 160);
    const earthMat = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('earth'), transparent: true, depthWrite: false });
    this.bgEarth = new THREE.Mesh(earthGeo, earthMat);
    this.bgEarth.position.set(300, 125, -14);
    this.bgEarth.renderOrder = 1;
    this.bgEarth.visible = false;
    this.scene.add(this.bgEarth);

    this.matLunar = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_lunar'), transparent: true, depthWrite: false });
    this.bgLunar1 = new THREE.Mesh(geo, this.matLunar);
    this.bgLunar1.position.set(0, -130, -5);
    this.bgLunar1.renderOrder = 2;
    this.bgLunar2 = new THREE.Mesh(geo, this.matLunar);
    this.bgLunar2.position.set(800, -130, -5);
    this.bgLunar2.renderOrder = 2;
    
    this.scene.add(this.bgLunar1);
    this.scene.add(this.bgLunar2);

    this.matSolarDock = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_solar_dock'), transparent: true, depthWrite: false });
    this.bgSolarDock1 = new THREE.Mesh(geo, this.matSolarDock);
    this.bgSolarDock1.position.set(0, 0, -10);
    this.bgSolarDock1.renderOrder = 2;
    this.bgSolarDock1.visible = false;
    this.bgSolarDock2 = new THREE.Mesh(geo, this.matSolarDock);
    this.bgSolarDock2.position.set(800, 0, -10);
    this.bgSolarDock2.renderOrder = 2;
    this.bgSolarDock2.visible = false;

    this.scene.add(this.bgSolarDock1);
    this.scene.add(this.bgSolarDock2);

    const geoCavern = new THREE.PlaneGeometry(800, 600);
    this.matCavernFar1 = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_cavern_far'), transparent: false, depthWrite: false });
    this.matCavernFar2 = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_cavern_far'), transparent: false, depthWrite: false });
    this.bgCavernFar1 = new THREE.Mesh(geoCavern, this.matCavernFar1);
    this.bgCavernFar1.position.set(0, 0, -8);
    this.bgCavernFar1.renderOrder = 2;
    this.bgCavernFar2 = new THREE.Mesh(geoCavern, this.matCavernFar2);
    this.bgCavernFar2.position.set(800, 0, -8);
    this.bgCavernFar2.renderOrder = 2;

    this.scene.add(this.bgCavernFar1);
    this.scene.add(this.bgCavernFar2);

    this.matCavern1 = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_cavern'), transparent: true, depthWrite: false });
    this.matCavern2 = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture('bg_cavern'), transparent: true, depthWrite: false });
    this.bgCavern1 = new THREE.Mesh(geoCavern, this.matCavern1);
    this.bgCavern1.position.set(0, 0, -4);
    this.bgCavern1.renderOrder = 4;
    this.bgCavern2 = new THREE.Mesh(geoCavern, this.matCavern2);
    this.bgCavern2.position.set(800, 0, -4);
    this.bgCavern2.renderOrder = 4;

    this.scene.add(this.bgCavern1);
    this.scene.add(this.bgCavern2);
  }

  setStage(stage: number) {
    this.currentStage = stage;
    this.distance = 0;
    this.bossActive = false;
    this.bossDefeated = false;
    this.scrollSpeed = 100 + (stage - 1) * 20;

    this.asteroidWarning = false;
    this.asteroidFieldActive = false;
    this.asteroidSpawnTimer = 0;
    this.lunarTurretSectionActive = false;
    this.turretSpawnTimer = 0;
    this.enemySpawnDelay = 2.0;
    this.subbossSpawned = false;
    this.blastDoorActive = false;
    this.blastDoorCleared = false;
    this.stage4SubbossSpawned = false;
    if (this.blastDoor) {
      this.blastDoor.destroy(this.scene);
      this.blastDoor = null;
    }
    this.stage4Subboss = null;
    this.asteroidWarning = false;
    this.missileWarning = false;
    this.onAsteroidWarningUpdate(false);
    this.onMissileWarningUpdate(false);

    if (stage === 1) {
      this.bossDistance = 4500;
    } else if (stage === 2) {
      this.bossDistance = 7500;
    } else if (stage === 3) {
      this.bossDistance = 8000;
    } else if (stage === 4) {
      this.bossDistance = 8500;
    } else {
      this.bossDistance = 8000; // 60% cavern = 4800, 40% factory = 3200
    }

    if (this.boss) {
      this.boss.destroy(this.scene);
      this.boss = null;
    }

    if (this.launchpad) {
      this.launchpad.destroy(this.scene);
      this.launchpad = null;
    }

    if (stage === 1) {
      this.matMtn.map = AssetManager.getTexture('bg_mountains');
      this.matCity.map = AssetManager.getTexture('bg_city');
      this.bgMountains1.visible = true;
      this.bgMountains2.visible = true;
      this.bgCity1.visible = true;
      this.bgCity2.visible = true;
      this.bgLunar1.visible = false;
      this.bgLunar2.visible = false;
      this.bgEarth.visible = false;
      this.bgSolarDock1.visible = false;
      this.bgSolarDock2.visible = false;
      this.bgCavernFar1.visible = false;
      this.bgCavernFar2.visible = false;
      this.bgCavern1.visible = false;
      this.bgCavern2.visible = false;
      this.bgMoon.visible = true;
      this.bgMoon.scale.set(0.5, 0.5, 1);
      this.bgMoon.position.y = 220;

      // Create UK Military Base Launchpad at Stage 1 start
      this.launchpad = new Launchpad(this.scene, 0, 0);
    } else {
      // Level 2 and onwards: Remove city/mountain background and replace completely with deep space starfield!
      this.bgMountains1.visible = false;
      this.bgMountains2.visible = false;
      this.bgCity1.visible = false;
      this.bgCity2.visible = false;
      this.bgLunar1.visible = (stage === 4);
      this.bgLunar2.visible = (stage === 4);
      this.bgEarth.visible = (stage === 4);
      this.bgSolarDock1.visible = false;
      this.bgSolarDock2.visible = false;
      this.bgCavernFar1.visible = (stage === 5);
      this.bgCavernFar2.visible = (stage === 5);
      this.bgCavern1.visible = (stage === 5);
      this.bgCavern2.visible = (stage === 5);
      this.bgMoon.visible = (stage === 1 || stage === 2 || stage === 3);
      
      if (stage === 2) {
        this.bgMoon.scale.set(1.4, 1.4, 1);
        this.bgMoon.position.y = 180;
      } else if (stage === 3) {
        this.bgMoon.scale.set(3.2, 3.2, 1); // Looming massive pixel art moon in high lunar orbit
        this.bgMoon.position.y = 80;
      }

      if (stage === 5) {
        this.matCavernFar1.map = AssetManager.getTexture('bg_cavern_far');
        this.matCavernFar1.needsUpdate = true;
        this.matCavernFar2.map = AssetManager.getTexture('bg_cavern_far');
        this.matCavernFar2.needsUpdate = true;
        this.matCavern1.map = AssetManager.getTexture('bg_cavern_entry');
        this.matCavern1.needsUpdate = true;
        this.matCavern2.map = AssetManager.getTexture('bg_cavern');
        this.matCavern2.needsUpdate = true;

        // Cavern Ceiling Blast Door Entrance at Stage 5 start (starts closed)
        this.blastDoor = new BlastDoor(this.scene, -180, 'horizontal', 210);
      }
    }
    this.matMtn.needsUpdate = true;
    this.matCity.needsUpdate = true;

    // Reposition stars relative to camera local bounds
    const starCount = 300;
    const posAttr = this.starsPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < starCount; i++) {
      this.starPositions[i * 3] = (Math.random() - 0.5) * 900;
      if (stage === 1) {
        this.starPositions[i * 3 + 1] = 40 + Math.random() * 240;
      } else if (stage === 4) {
        this.starPositions[i * 3 + 1] = -10 + Math.random() * 280;
      } else {
        this.starPositions[i * 3 + 1] = (Math.random() - 0.5) * 560;
      }
    }
    posAttr.needsUpdate = true;
    this.starsPoints.visible = (stage !== 5);
  }

  isCameraScrolling(player?: any): boolean {
    if (player && (player.isStage4Entry || player.isStage1Takeoff)) {
      return false;
    }
    return !this.bossActive && !(this.blastDoorActive && !this.blastDoorCleared);
  }

  /**
   * Scrolls the starfield's per-star offsets. Purely cosmetic, so it runs at
   * render rate (outside the fixed simulation step) to stay smooth on
   * high-refresh displays; vertex buffers can't be interpolated generically.
   */
  updateStarfield(dt: number) {
    if (!this.starsPoints.visible || dt <= 0) return;
    const posAttr = this.starsPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 300; i++) {
      this.starPositions[i * 3] -= (40 + (i % 5) * 25) * dt;
      if (this.starPositions[i * 3] < -450) {
        this.starPositions[i * 3] += 900;
        if (this.currentStage === 1) {
          this.starPositions[i * 3 + 1] = 40 + Math.random() * 240;
        } else if (this.currentStage === 4) {
          this.starPositions[i * 3 + 1] = -10 + Math.random() * 280;
        } else {
          this.starPositions[i * 3 + 1] = (Math.random() - 0.5) * 560;
        }
      }
    }
    posAttr.needsUpdate = true;
  }

  update(dt: number, particles?: ParticleManager, player?: any) {
    if (this.launchpad) {
      this.launchpad.update(dt);
      if (this.distance >= 1200) {
        this.launchpad.destroy(this.scene);
        this.launchpad = null;
      }
    }

    if (this.isCameraScrolling(player)) {
      this.distance += this.scrollSpeed * dt;
      this.camera.position.x = this.distance;
    }

    // Parallax scrolling
    const camX = this.camera.position.x;
    
    // Starfield anchored to camera (per-star scrolling happens in updateStarfield)
    this.starsPoints.visible = (this.currentStage !== 5);
    this.starsPoints.position.x = camX;

    // Background layer 1
    const mtnX = camX * 0.2;
    this.bgMountains1.position.x = camX - (mtnX % 800);
    this.bgMountains2.position.x = this.bgMountains1.position.x + 800;

    // Background layer 2 (City skyline) - Starts offscreen to the right of launchpad, scrolling into view as player flies forward
    if (this.currentStage === 1) {
      const cityStartWorld = 450 + camX * 0.5;
      const tileIndex = Math.max(0, Math.floor((camX - 400 - cityStartWorld) / 800));
      const tile0Left = cityStartWorld + tileIndex * 800;
      this.bgCity1.position.x = tile0Left + 400;
      this.bgCity2.position.x = tile0Left + 800 + 400;
    } else {
      const cityX = camX * 0.5;
      this.bgCity1.position.x = camX - (cityX % 800);
      this.bgCity2.position.x = this.bgCity1.position.x + 800;
    }

    // Lunar layer
    const lunarX = camX * 0.6;
    this.bgLunar1.position.x = camX - (lunarX % 800);
    this.bgLunar2.position.x = this.bgLunar1.position.x + 800;

    // Solar Dock layer
    if (this.bgSolarDock1.visible) {
      const dockX = camX * 0.35;
      this.bgSolarDock1.position.x = camX - (dockX % 800);
      this.bgSolarDock2.position.x = this.bgSolarDock1.position.x + 800;
    }

    // Stage 5 Cavern / Factory Layer (Multi-Layer Parallax)
    if (this.currentStage === 5) {
      const tileWidth = 800;

      // 1. Far Background Layer (Scrolling at 0.4 speed relative to camera)
      const farX = camX * 0.4;
      const farTile1X = camX - (farX % tileWidth);
      const farTile2X = farTile1X + tileWidth;

      this.bgCavernFar1.position.x = farTile1X;
      this.bgCavernFar2.position.x = farTile2X;

      const getFarTexForTile = (tileX: number) => {
        const tileIdx = Math.floor(tileX / tileWidth);
        if (tileIdx < 6) {
          return AssetManager.getTexture('bg_cavern_far');
        } else if (tileIdx === 6) {
          return AssetManager.getTexture('bg_cavern_to_factory_far');
        } else {
          return AssetManager.getTexture('bg_factory_far');
        }
      };

      const farTex1 = getFarTexForTile(farTile1X);
      if (this.matCavernFar1.map !== farTex1) {
        this.matCavernFar1.map = farTex1;
        this.matCavernFar1.needsUpdate = true;
      }
      const farTex2 = getFarTexForTile(farTile2X);
      if (this.matCavernFar2.map !== farTex2) {
        this.matCavernFar2.map = farTex2;
        this.matCavernFar2.needsUpdate = true;
      }

      // 2. Near Foreground Layer (Scrolling at 0.8 speed relative to camera)
      const nearX = camX * 0.8;
      const nearTile1X = camX - (nearX % tileWidth);
      const nearTile2X = nearTile1X + tileWidth;

      this.bgCavern1.position.x = nearTile1X;
      this.bgCavern2.position.x = nearTile2X;

      const getNearTexForTile = (tileX: number) => {
        const tileIdx = Math.floor(tileX / tileWidth);
        if (tileIdx <= 0) {
          return AssetManager.getTexture('bg_cavern_entry');
        } else if (tileIdx < 6) {
          return AssetManager.getTexture('bg_cavern');
        } else if (tileIdx === 6) {
          return AssetManager.getTexture('bg_cavern_to_factory');
        } else {
          return AssetManager.getTexture('bg_factory');
        }
      };

      const nearTex1 = getNearTexForTile(nearTile1X);
      if (this.matCavern1.map !== nearTex1) {
        this.matCavern1.map = nearTex1;
        this.matCavern1.needsUpdate = true;
      }

      const nearTex2 = getNearTexForTile(nearTile2X);
      if (this.matCavern2.map !== nearTex2) {
        this.matCavern2.map = nearTex2;
        this.matCavern2.needsUpdate = true;
      }
    }

    // Moon & Earth Parallax
    if (this.currentStage === 4) {
      // Non-repeating realistic Earth hangs majestically in the lunar sky
      this.bgEarth.position.x = camX + 240 - (camX * 0.025);
      this.bgEarth.position.y = 125;
    } else if (this.currentStage === 3) {
      this.bgMoon.position.x = camX + 180 - (camX * 0.04); // Massive looming moon in high orbit
      this.bgMoon.position.y = 80;
    } else if (this.currentStage === 2) {
      this.bgMoon.position.x = camX + 260 - (camX * 0.03); // Deep space view
      this.bgMoon.position.y = 180;
    } else if (this.currentStage === 1) {
      this.bgMoon.position.x = camX + 300 - (camX * 0.01); // Small distant moon
      this.bgMoon.position.y = 210;
    }

    // Level 2 Asteroid Field State Management
    if (this.currentStage === 2 && !this.bossActive && !this.bossDefeated) {
      if (this.distance >= 2500 && this.distance < 3000) {
        if (!this.asteroidWarning) {
          this.asteroidWarning = true;
          this.onAsteroidWarningUpdate(true);
        }
      } else if (this.distance >= 3000 && this.distance < 6000) {
        if (this.asteroidWarning) {
          this.asteroidWarning = false;
          this.onAsteroidWarningUpdate(false);
        }
        this.asteroidFieldActive = true;
      } else if (this.distance >= 6000) {
        if (this.asteroidFieldActive) {
          this.asteroidFieldActive = false;
        }
      }
    }

    // Level 4 Lunar Surface Turret State Management & Missile Defence Warning
    if (this.currentStage === 4 && !this.bossActive && !this.bossDefeated) {
      if (this.distance >= 3700 && this.distance < 4500) {
        if (!this.missileWarning) {
          this.missileWarning = true;
          this.onMissileWarningUpdate(true);
        }
      } else if (this.distance >= 4500 && this.distance < 6800) {
        if (this.missileWarning) {
          this.missileWarning = false;
          this.onMissileWarningUpdate(false);
        }
        this.lunarTurretSectionActive = true;
      } else {
        if (this.missileWarning) {
          this.missileWarning = false;
          this.onMissileWarningUpdate(false);
        }
        this.lunarTurretSectionActive = false;
      }
    }

    // Stage 4 Lunar Surface Floor Blast Door
    if (this.currentStage === 4 && !this.bossDefeated) {
      if (!this.blastDoor && this.distance >= 6800) {
        this.blastDoor = new BlastDoor(this.scene, 8600, 'horizontal');
      }
    }

    // Stage 5 Blast Door & Gatekeeper Sub-boss Trigger
    if (this.currentStage === 5 && !this.bossActive && !this.bossDefeated) {
      // Clean up ceiling entrance blast door once camera has scrolled past
      if (this.blastDoor && this.distance >= 1000 && this.blastDoor.x < 0) {
        this.blastDoor.destroy(this.scene);
        this.blastDoor = null;
      }

      // Pre-instantiate BlastDoor in world space at X = 5080 so it scrolls smoothly into view
      if (!this.blastDoor && this.distance >= 3000) {
        this.blastDoor = new BlastDoor(this.scene, 5080);
      }

      // Trigger subboss fight when camera reaches distance 4800
      if (this.distance >= 4800 && !this.stage4SubbossSpawned) {
        this.stage4SubbossSpawned = true;
        this.blastDoorActive = true;
        this.blastDoorCleared = false;

        // Spawn subboss off-screen right (camX + 550) so it flies into the arena smoothly
        this.stage4Subboss = new Enemy(this.scene, 'subboss_gatekeeper', camX + 550, 0, 'subboss_gatekeeper');
        this.enemies.push(this.stage4Subboss);
      }
    }

    if (this.blastDoor) {
      this.blastDoor.update(dt);

      if (this.blastDoorActive) {
        // Check if subboss defeated
        if (this.stage4Subboss && !this.stage4Subboss.active && !this.blastDoor.isOpening && !this.blastDoor.isOpen) {
          this.blastDoor.open();
        }

        if (this.blastDoor.isOpen && !this.blastDoorCleared) {
          this.blastDoorCleared = true;
        }
      }
    }

    // Spawning logic
    if (!this.isCameraScrolling(player)) {
      // Pause enemy spawn delay countdown and spawning during takeoff/cutscenes
    } else if (this.enemySpawnDelay > 0) {
      this.enemySpawnDelay -= dt;
    } else {
      if (!this.bossActive && !this.bossDefeated && !(this.blastDoorActive && !this.blastDoorCleared) && this.distance < this.bossDistance) {
        if (this.currentStage === 1 && this.distance >= 2250 && !this.subbossSpawned) {
          this.subbossSpawned = true;
          const subboss = new Enemy(this.scene, 'subboss1', camX + 500, 0, 'subboss');
          this.enemies.push(subboss);
        }

        if (this.asteroidFieldActive) {
          // Asteroid field active: NO regular enemies spawn, only asteroids!
          this.asteroidSpawnTimer += dt;
          if (this.asteroidSpawnTimer > 0.15) {
            this.asteroidSpawnTimer = 0;

            const hasGoldenAsteroid = this.enemies.some(e => e.active && e.type === 'asteroid_gold');
            let type = 'asteroid_small';

            // Always ensure a golden asteroid randomly spawns during the asteroid field
            if (!hasGoldenAsteroid && Math.random() < 0.25) {
              type = 'asteroid_gold';
            } else {
              const isLarge = Math.random() < 0.45;
              type = isLarge ? 'asteroid_large' : 'asteroid_small';
            }

            const y = (Math.random() - 0.5) * 520;
            const asteroid = new Enemy(this.scene, type, camX + 500, y, 'straight');
            this.enemies.push(asteroid);
          }
        } else if (this.lunarTurretSectionActive) {
          // Lunar Turret Section
          this.turretSpawnTimer += dt;
          if (this.turretSpawnTimer > 1.2) {
            this.turretSpawnTimer = 0;
            // Spawn turret at bottom of screen on the lunar surface
            // The lunar surface is visually around y=-240
            const y = -230 + (Math.random() * 10 - 5);
            const turret = new Enemy(this.scene, 'turret', camX + 500, y, 'turret');
            this.enemies.push(turret);
          }
          
          // Also spawn occasional regular enemies, but fewer
          let activeShips = this.enemies.filter(e => !e.type.startsWith('asteroid') && e.type !== 'turret').length;
          let maxShips = 3;
          let spawnRate = 0.008;

          if (this.hardcoreMode) {
            maxShips += 2;
            spawnRate *= 2;
          }

          if (activeShips < maxShips && Math.random() < spawnRate) {
            this.spawnWave(camX);
          }
        } else {
          // Regular enemy spawning (tuned for balanced difficulty)
          const subbossActive = this.enemies.some(e => e.active && e.type === 'subboss1');
          
          let activeShips = this.enemies.filter(e => !e.type.startsWith('asteroid')).length;
          let maxShips = this.currentStage === 2 ? 4 : (this.currentStage === 3 ? 5 : (this.currentStage === 5 ? 8 : 7));
          let spawnRate = this.currentStage === 2 ? 0.012 : (this.currentStage === 3 ? 0.018 : (this.currentStage === 5 ? 0.025 : 0.02));

          if (subbossActive) {
            maxShips = 1;
            spawnRate = 0.002;
          }

          if (this.hardcoreMode) {
            maxShips += 5;
            spawnRate *= 2;
          }

          if (activeShips < maxShips && Math.random() < spawnRate) {
            this.spawnWave(camX);
          }
        }
      } else if (!this.bossActive && !this.bossDefeated && this.distance >= this.bossDistance) {
        if (this.asteroidWarning) {
          this.asteroidWarning = false;
          this.onAsteroidWarningUpdate(false);
        }
        if (this.missileWarning) {
          this.missileWarning = false;
          this.onMissileWarningUpdate(false);
        }
        this.asteroidFieldActive = false;
        this.lunarTurretSectionActive = false;
        this.spawnBoss(camX);
        this.bossActive = true;
      }
    }
  }

  spawnWave(camX: number) {
    const y = this.currentStage === 5 ? (Math.random() - 0.5) * 260 : (Math.random() - 0.5) * 520;

    let type = 'scout';
    let pattern = 'straight';

    if (this.currentStage === 1) {
      const heavyChance = 0.2;
      type = Math.random() < heavyChance ? 'heavy' : 'scout';
      pattern = type === 'heavy' ? 'heavy' : (Math.random() > 0.5 ? 'wave' : 'straight');
    } else if (this.currentStage === 2) {
      // Level 2 includes new Interceptors and Snipers!
      const rand = Math.random();
      if (rand < 0.35) {
        type = 'interceptor';
        pattern = 'swoop';
      } else if (rand < 0.65) {
        type = 'sniper';
        pattern = 'zigzag';
      } else if (rand < 0.85) {
        type = 'heavy';
        pattern = 'heavy';
      } else {
        type = 'scout';
        pattern = 'wave';
      }
    } else if (this.currentStage === 3) {
      // Level 3 Lunar Approach: High-orbit interceptors, snipers, & heavy alien destroyers
      const rand = Math.random();
      if (rand < 0.35) {
        type = 'interceptor';
        pattern = 'swoop';
      } else if (rand < 0.65) {
        type = 'sniper';
        pattern = 'zigzag';
      } else if (rand < 0.85) {
        type = 'heavy';
        pattern = 'heavy';
      } else {
        type = 'scout';
        pattern = 'wave';
      }
    } else if (this.currentStage === 4) {
      // Level 4 Lunar Surface: Heavy lunar surface interceptors & snipers
      const rand = Math.random();
      if (rand < 0.3) {
        type = 'interceptor';
        pattern = 'swoop';
      } else if (rand < 0.6) {
        type = 'sniper';
        pattern = 'zigzag';
      } else if (rand < 0.85) {
        type = 'heavy';
        pattern = 'heavy';
      } else {
        type = 'scout';
        pattern = Math.random() > 0.5 ? 'wave' : 'straight';
      }
    } else {
      // Stage 5: Moon Core Biomechanical Menace (Organic Alien Fleet)
      const rand = Math.random();
      if (rand < 0.4) {
        type = 'bioDrone';
        pattern = 'bio_spiral';
      } else if (rand < 0.75) {
        type = 'bioStalker';
        pattern = 'bio_hunt';
      } else {
        type = 'bioBehemoth';
        pattern = 'bio_heavy';
      }
    }
    
    const enemy = new Enemy(this.scene, type, camX + 450, y, pattern);
    this.enemies.push(enemy);
  }

  spawnBoss(camX: number) {
    this.boss = new Boss(this.scene, camX + 500, 0, this.currentStage);
  }
}


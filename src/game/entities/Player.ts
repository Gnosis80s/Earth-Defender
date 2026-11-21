import * as THREE from 'three';
import { Entity } from './Entity';
import { AssetManager } from '../AssetManager';
import { InputManager } from '../InputManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { Drone } from './Drone';
import { SoundManager } from '../SoundManager';

export class Player extends Entity {
  speed: number = 300;
  fireCooldown: number = 0;
  fireRate: number = 0.1;
  invulnTimer: number = 0;

  weaponLevel: number = 1;
  hasShield: boolean = false;
  shieldMesh: THREE.Mesh | null = null;
  drones: Drone[] = [];
  scene: THREE.Scene;

  missileCooldown: number = 0;
  maxMissileCooldown: number = 5.0;
  missileCount: number = 4;
  missileLevel: number = 1;
  laserColor: string = 'bulletPlayer';
  isHyperspaceJump: boolean = false;
  hyperspaceTimer: number = 0;
  isStage3Exit: boolean = false;
  stage3ExitTimer: number = 0;
  targetExitX: number = 0;
  isStage4Entry: boolean = false;
  stage4EntryTimer: number = 0;
  targetEntryX: number = 0;
  isStage1Takeoff: boolean = false;
  stage1TakeoffTimer: number = 0;

  constructor(scene: THREE.Scene) {
    super(scene, AssetManager.getTexture('player'), 32, 32);
    this.scene = scene;
    this.mesh.position.set(-200, 0, 0);

    // Shield mesh
    const shieldGeo = new THREE.RingGeometry(20, 24, 16);
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.renderOrder = 11;
    this.shieldMesh.visible = false;
    scene.add(this.shieldMesh);
  }

  setShipStyle(shipType: string, laserColor: string) {
    this.mesh.material = new THREE.MeshBasicMaterial({ 
      map: AssetManager.getTexture(shipType), 
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    this.laserColor = laserColor;
    
    // Adjust size slightly if dreadnought
    if (shipType === 'player_dreadnought') {
      this.mesh.scale.set(1.5, 1.5, 1);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }
  }

  upgradeWeapon() {
    if (this.weaponLevel < 3) {
      this.weaponLevel++;
    }
  }

  addShield() {
    this.hasShield = true;
    if (this.shieldMesh) this.shieldMesh.visible = true;
  }

  addDrone() {
    if (this.drones.length < 2) {
      const offsetY = this.drones.length === 0 ? 30 : -30;
      const drone = new Drone(this.scene, offsetY);
      this.drones.push(drone);
    }
  }

  addMissileCapacity() {
    if (this.missileCount < 6) {
      this.missileCount++;
    }
  }

  upgradeMissiles() {
    if (this.missileLevel < 2) {
      this.missileLevel = 2;
    }
  }

  startStage3Exit(targetX: number) {
    this.isStage3Exit = true;
    this.stage3ExitTimer = 0;
    this.targetExitX = targetX;
  }

  startStage4Entry(targetX: number) {
    this.isStage4Entry = true;
    this.stage4EntryTimer = 0;
    this.targetEntryX = targetX;
    this.mesh.position.set(targetX, 320, 0);
    this.mesh.rotation.z = -Math.PI / 2;
  }

  startStage1Takeoff(targetX: number = -220) {
    this.isStage1Takeoff = true;
    this.stage1TakeoffTimer = 0;
    this.targetEntryX = targetX;
    this.mesh.position.set(targetX, -210, 0);
    this.mesh.rotation.z = Math.PI / 12; // Slight upward tilt on pad
  }

  resetState() {
    this.weaponLevel = 1;
    this.missileCount = 4;
    this.missileLevel = 1;
    this.hasShield = false;
    this.isHyperspaceJump = false;
    this.hyperspaceTimer = 0;
    this.isStage3Exit = false;
    this.stage3ExitTimer = 0;
    this.isStage4Entry = false;
    this.stage4EntryTimer = 0;
    this.isStage1Takeoff = false;
    this.stage1TakeoffTimer = 0;
    this.mesh.rotation.z = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    for (const d of this.drones) {
      d.destroy(this.scene);
    }
    this.drones = [];
  }

  update(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any) {
    if (!this.active) return;

    if (this.isStage3Exit) {
      this.stage3ExitTimer += dt;
      const t = this.stage3ExitTimer;

      if (t < 1.0) {
        // Phase 1: Smoothly reposition over floor door & rotate pitch downward (-Math.PI / 2)
        const prog = Math.min(1, t / 1.0);
        const easeProg = prog * prog * (3 - 2 * prog);
        
        this.mesh.position.x += (this.targetExitX - this.mesh.position.x) * (0.08 + easeProg * 0.08);
        this.mesh.position.y += (-50 - this.mesh.position.y) * (0.08 + easeProg * 0.08);

        this.mesh.rotation.z = THREE.MathUtils.lerp(0, -Math.PI / 2, easeProg);
        if (particles) particles.spawnExhaust(this.mesh.position.x, this.mesh.position.y + 16);
      } else {
        // Phase 2: Fire thrusters & accelerate straight down into the floor blast door
        this.mesh.rotation.z = -Math.PI / 2;
        this.mesh.position.x += (this.targetExitX - this.mesh.position.x) * 0.05;
        
        const speed = 350 + (t - 1.0) * 600;
        this.mesh.position.y -= speed * dt;

        if (particles) {
          particles.spawnExhaust(this.mesh.position.x, this.mesh.position.y + 16);
        }
      }

      if (this.shieldMesh) {
        this.shieldMesh.position.copy(this.mesh.position);
        this.shieldMesh.rotation.z += dt * 3;
        this.shieldMesh.visible = this.hasShield;
      }
      for (const drone of this.drones) {
        drone.update(dt, time, this.mesh.position.x, this.mesh.position.y, bullets, false);
      }
      return;
    }

    if (this.isStage4Entry) {
      const prevT = this.stage4EntryTimer;
      this.stage4EntryTimer += dt;
      const t = this.stage4EntryTimer;
      const duration = 5.0;

      // Trigger blast door opening on ceiling as ship approaches shaft opening
      if (prevT < 0.3 && t >= 0.3) {
        if (game?.level?.blastDoor) {
          game.level.blastDoor.open();
        }
      }

      // Trigger blast door closing behind ship after it has entered cavern
      if (prevT < 3.8 && t >= 3.8) {
        if (game?.level?.blastDoor) {
          game.level.blastDoor.close();
        }
      }

      if (t < 1.4) {
        // Phase 1: Wait above opening shaft while ceiling blast doors slide open
        const prog = Math.min(1, t / 1.4);
        const easeProg = prog * prog * (3 - 2 * prog);

        this.mesh.position.x = this.targetEntryX;
        this.mesh.position.y = THREE.MathUtils.lerp(320, 250, easeProg);
        this.mesh.rotation.z = -Math.PI / 2; // Facing downward

        if (particles && Math.random() < 0.5) {
          particles.spawnExhaust(this.mesh.position.x, this.mesh.position.y + 16);
        }
      } else if (t < 3.2) {
        // Phase 2: Smooth, cinematic descent straight down through open blast door into cavern
        const prog = Math.min(1, (t - 1.4) / (3.2 - 1.4));
        const easeProg = prog * prog * (3 - 2 * prog);

        this.mesh.position.x = this.targetEntryX;
        this.mesh.position.y = THREE.MathUtils.lerp(250, 20, easeProg);
        this.mesh.rotation.z = -Math.PI / 2;

        if (particles) {
          particles.spawnExhaust(this.mesh.position.x, this.mesh.position.y + 16);
        }
      } else if (t < duration) {
        // Phase 3: Swoop up & rotate pitch smoothly to level off into standard flight stance
        const prog = Math.min(1, (t - 3.2) / (duration - 3.2));
        const easeProg = prog * prog * (3 - 2 * prog);

        this.mesh.position.x = THREE.MathUtils.lerp(this.targetEntryX, cameraX - 250, easeProg);
        this.mesh.position.y = THREE.MathUtils.lerp(20, 0, easeProg);
        this.mesh.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, 0, easeProg);

        if (particles) {
          particles.spawnExhaust(
            this.mesh.position.x - Math.cos(this.mesh.rotation.z) * 16,
            this.mesh.position.y - Math.sin(this.mesh.rotation.z) * 16
          );
        }
      } else {
        // Entry animation complete - hand control back to player
        this.isStage4Entry = false;
        this.mesh.position.set(cameraX - 250, 0, 0);
        this.mesh.rotation.z = 0;
      }

      if (this.shieldMesh) {
        this.shieldMesh.position.copy(this.mesh.position);
        this.shieldMesh.rotation.z += dt * 3;
        this.shieldMesh.visible = this.hasShield;
      }
      for (const drone of this.drones) {
        drone.update(dt, time, this.mesh.position.x, this.mesh.position.y, bullets, false);
      }
      return;
    }

    if (this.isStage1Takeoff) {
      const prevT = this.stage1TakeoffTimer;
      this.stage1TakeoffTimer += dt;
      const t = this.stage1TakeoffTimer;
      const duration = 5.0;

      // Trigger gantry clamp release on launchpad at t = 0.5s
      if (prevT < 0.5 && t >= 0.5) {
        if (game?.level?.launchpad) {
          game.level.launchpad.retractGantry();
        }
        SoundManager.playExplosion('small', 0.5);
      }

      // Camera initial focus during launchpad sequence
      if (game && game.camera) {
        const camTargetX = THREE.MathUtils.lerp(game.camera.position.x, this.mesh.position.x + 100, 0.08);
        game.camera.position.x = camTargetX;
      }

      if (t < 1.2) {
        // Phase 1: Docked on UK RAF Base Launchpad - Gantry unclamp, steam vent bursts, engine idle warmup
        this.mesh.position.set(this.targetEntryX, -210, 0);
        this.mesh.rotation.z = Math.PI / 12;

        if (particles && Math.random() < 0.6) {
          particles.spawnExhaust(this.mesh.position.x - 18, this.mesh.position.y - 4);
        }
      } else if (t < 2.8) {
        // Phase 2: Thruster ignition & vertical lift-off straight up from launchpad
        const prog = Math.min(1, (t - 1.2) / (2.8 - 1.2));
        const easeProg = prog * prog; // accelerate upward

        this.mesh.position.x = this.targetEntryX + prog * 20; // slight forward drift
        this.mesh.position.y = THREE.MathUtils.lerp(-210, 30, easeProg);
        this.mesh.rotation.z = THREE.MathUtils.lerp(Math.PI / 12, Math.PI / 6, easeProg);

        if (particles) {
          particles.spawnExhaust(this.mesh.position.x - 20, this.mesh.position.y - 12);
          if (t < 2.0 && Math.random() < 0.7) {
            particles.spawnExplosion(this.mesh.position.x - 20 + (Math.random() - 0.5) * 30, -220, 0xffaa00, 8);
          }
        }

        if (game && prevT < 1.3 && t >= 1.3) {
          SoundManager.playExplosion('large', 1.1);
          if (game.addScreenShake) game.addScreenShake(8, 0.4);
        }
      } else if (t < duration) {
        // Phase 3: Main Afterburners Engage - Level off and surge forward into standard combat stance
        const prog = Math.min(1, (t - 2.8) / (duration - 2.8));
        const easeProg = prog * prog * (3 - 2 * prog);

        const destX = cameraX - 250;
        this.mesh.position.x = THREE.MathUtils.lerp(this.targetEntryX + 20, destX, easeProg);
        this.mesh.position.y = THREE.MathUtils.lerp(30, 0, easeProg);
        this.mesh.rotation.z = THREE.MathUtils.lerp(Math.PI / 6, 0, easeProg);

        if (particles) {
          particles.spawnExhaust(
            this.mesh.position.x - Math.cos(this.mesh.rotation.z) * 18,
            this.mesh.position.y - Math.sin(this.mesh.rotation.z) * 18
          );
          if (prevT < 2.9 && t >= 2.9) {
            particles.spawnExplosion(this.mesh.position.x - 25, this.mesh.position.y, 0x00ffff, 60);
            if (game.addScreenShake) game.addScreenShake(12, 0.25);
          }
        }
      } else {
        // Sequence complete - hand control back to player
        this.isStage1Takeoff = false;
        this.mesh.position.set(cameraX - 250, 0, 0);
        this.mesh.rotation.z = 0;
      }

      if (this.shieldMesh) {
        this.shieldMesh.position.copy(this.mesh.position);
        this.shieldMesh.rotation.z += dt * 3;
        this.shieldMesh.visible = this.hasShield;
      }
      for (const drone of this.drones) {
        drone.update(dt, time, this.mesh.position.x, this.mesh.position.y, bullets, false);
      }
      return;
    }

    if (this.isHyperspaceJump) {
      const prevTimer = this.hyperspaceTimer;
      this.hyperspaceTimer += dt;
      if (prevTimer <= 2.0 && this.hyperspaceTimer > 2.0) {
        SoundManager.playHyperspace();
      }

      const launchAngle = Math.PI / 6; // 30 degrees towards top right

      if (this.hyperspaceTimer > 2.0) {
        const speed = 2200;
        this.mesh.rotation.z = launchAngle;
        this.mesh.position.x += Math.cos(launchAngle) * speed * dt;
        this.mesh.position.y += Math.sin(launchAngle) * speed * dt;

        if (particles) {
          particles.spawnExhaust(
            this.mesh.position.x - Math.cos(launchAngle) * 18,
            this.mesh.position.y - Math.sin(launchAngle) * 18
          );
        }
      } else {
        // Charging phase: pitch upward smoothly towards top-right during hyperdrive spool up
        const tiltProg = Math.max(0, Math.min(1, (this.hyperspaceTimer - 1.0) / 1.0));
        const easeTilt = tiltProg * tiltProg;
        this.mesh.rotation.z = THREE.MathUtils.lerp(0, launchAngle, easeTilt);

        this.mesh.position.x += (Math.random() - 0.5) * 8;
        this.mesh.position.y += (Math.random() - 0.5) * 8;

        if (particles) {
          particles.spawnExhaust(
            this.mesh.position.x - Math.cos(this.mesh.rotation.z) * 16,
            this.mesh.position.y - Math.sin(this.mesh.rotation.z) * 16
          );
        }
      }
      
      if (this.shieldMesh) {
        this.shieldMesh.position.copy(this.mesh.position);
        this.shieldMesh.rotation.z += dt * 3;
        this.shieldMesh.visible = this.hasShield;
      }
      for (const drone of this.drones) {
        drone.update(dt, time, this.mesh.position.x, this.mesh.position.y, bullets, false);
      }
      return;
    }

    let dx = 0;
    let dy = 0;

    if (InputManager.keys['ArrowUp'] || InputManager.keys['KeyW']) dy += 1;
    if (InputManager.keys['ArrowDown'] || InputManager.keys['KeyS']) dy -= 1;
    if (InputManager.keys['ArrowLeft'] || InputManager.keys['KeyA']) dx -= 1;
    if (InputManager.keys['ArrowRight'] || InputManager.keys['KeyD']) dx += 1;

    // Apply analog joystick or gamepad
    const analog = InputManager.getAnalogMovement();
    if (analog.dx !== 0 || analog.dy !== 0) {
      dx = analog.dx;
      dy = analog.dy;
    }

    // Normalize diagonal for keyboard (if no analog is active)
    if (dx !== 0 && dy !== 0 && analog.dx === 0 && analog.dy === 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    // Clamp analog length to max 1
    const currentLen = Math.sqrt(dx * dx + dy * dy);
    if (currentLen > 1) {
        dx /= currentLen;
        dy /= currentLen;
    }

    const isScrolling = game && game.level ? game.level.isCameraScrolling() : true;
    this.vx = dx * this.speed + (isScrolling ? game.level.scrollSpeed : 0);
    this.vy = dy * this.speed;

    this.mesh.position.x += this.vx * dt;
    this.mesh.position.y += this.vy * dt;

    // Constrain to screen (left third roughly)
    const isCavernStage = game && game.level && game.level.currentStage === 5;
    const paddingX = 35;
    const minX = cameraX - 400 + paddingX;
    const maxX = cameraX + 100 - paddingX;
    const minY = isCavernStage ? -154 : -300 + 35;
    const maxY = isCavernStage ? 154 : 300 - 35;

    if (this.mesh.position.x < minX) this.mesh.position.x = minX;
    if (this.mesh.position.x > maxX) this.mesh.position.x = maxX;
    if (this.mesh.position.y < minY) this.mesh.position.y = minY;
    if (this.mesh.position.y > maxY) this.mesh.position.y = maxY;

    // Hover bob is cosmetic only: Game.render applies `renderOffsetY` while
    // drawing and removes it afterwards, so the hitbox never drifts. (It used
    // to be added to position.y every frame, moving the real hitbox ~±6px.)
    const bob = Math.sin(time * 2.5) * 3;
    this.mesh.userData.renderOffsetY = bob;
    if (this.shieldMesh) this.shieldMesh.userData.renderOffsetY = bob;

    // Shield positioning
    if (this.shieldMesh) {
      this.shieldMesh.position.copy(this.mesh.position);
      this.shieldMesh.rotation.z += dt * 3;
      this.shieldMesh.visible = this.hasShield;
    }

    // Exhaust
    if (particles) {
      particles.spawnExhaust(this.mesh.position.x - 16, this.mesh.position.y);
    }

    // Firing
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    const isFiring = InputManager.isActionPressed('fire');

    if (isFiring && this.fireCooldown <= 0 && bullets) {
      SoundManager.playPlayerFire(0.9 + Math.random() * 0.2);
      const x = this.mesh.position.x + 16;
      const y = this.mesh.position.y;

      if (this.weaponLevel === 1) {
        // Dual Cannon
        bullets.spawn(x, y - 6, 800, 0, true, 1, false, this.laserColor);
        bullets.spawn(x, y + 6, 800, 0, true, 1, false, this.laserColor);
      } else if (this.weaponLevel === 2) {
        // Triple Spread Shot
        bullets.spawn(x, y, 850, 0, true, 1.2, false, this.laserColor);
        bullets.spawn(x, y + 6, 800, 150, true, 1.2, false, this.laserColor);
        bullets.spawn(x, y - 6, 800, -150, true, 1.2, false, this.laserColor);
      } else {
        // Plasma Quad Beam + Angled Spread
        bullets.spawn(x, y + 10, 900, 0, true, 1.5, false, this.laserColor);
        bullets.spawn(x, y + 4, 900, 0, true, 1.5, false, this.laserColor);
        bullets.spawn(x, y - 4, 900, 0, true, 1.5, false, this.laserColor);
        bullets.spawn(x, y - 10, 900, 0, true, 1.5, false, this.laserColor);
        bullets.spawn(x, y + 8, 800, 200, true, 1, false, this.laserColor);
        bullets.spawn(x, y - 8, 800, -200, true, 1, false, this.laserColor);
      }

      this.fireCooldown = this.fireRate;
    }

    // Update Drones
    for (const drone of this.drones) {
      drone.update(dt, time, this.mesh.position.x, this.mesh.position.y, bullets, isFiring);
    }

    // Missile Firing
    if (this.missileCooldown > 0) {
      const prevCooldown = this.missileCooldown;
      this.missileCooldown -= dt;
      if (this.missileCooldown < 0) this.missileCooldown = 0;
      if (game && game.onMissileCooldownUpdate) {
        if (Math.floor(prevCooldown * 10) !== Math.floor(this.missileCooldown * 10) || this.missileCooldown === 0) {
          game.onMissileCooldownUpdate(this.missileCooldown, this.maxMissileCooldown);
        }
      }
    }

    if (InputManager.isActionPressed('bomb') && this.missileCooldown <= 0 && game) {
      this.missileCooldown = this.maxMissileCooldown;
      if (game.onMissileCooldownUpdate) {
        game.onMissileCooldownUpdate(this.missileCooldown, this.maxMissileCooldown);
      }
      game.launchMissiles();
    }

    // Invulnerability flashing
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.mesh.visible = Math.floor(time * 20) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }
  }

  takeDamage(amount: number) {
    if (this.invulnTimer > 0) return;

    if (this.hasShield) {
      this.hasShield = false;
      if (this.shieldMesh) this.shieldMesh.visible = false;
      this.invulnTimer = 1.0;
      return;
    }

    super.takeDamage(amount);
    if (this.hp > 0) {
      this.invulnTimer = 1.0; // 1 second invulnerability
    }
  }
}


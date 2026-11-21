import * as THREE from 'three';
import { Boss } from './Boss';
import { Enemy } from './Enemy';
import { addFlashUniform } from './Entity';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { SoundManager } from '../SoundManager';
import { FORTRESS_W, FORTRESS_H, FORTRESS_CORE } from '../art/Stage2Art';

type State =
  | 'enter' | 'rest'
  | 'volleyOpen' | 'volleyHold' | 'volleyClose'
  | 'spiral'
  | 'stormWarn' | 'storm';

/** Core position relative to the boss centre (world units, y up). */
const CORE_X = FORTRESS_CORE.x - FORTRESS_W / 2;
const CORE_Y = FORTRESS_H / 2 - FORTRESS_CORE.y;

/**
 * Stage 2 boss: a hollowed-out asteroid turned into a fortress, with a mass
 * driver (and its reactor core) facing the player.
 *
 * Phase 1 (100-60%): the core is behind an armoured shutter. The shutter
 *   opens to hurl a volley of rocks, and stays open briefly afterwards: that
 *   is the window to hit the core (x1.6). Hits on the closed shutter do half
 *   damage.
 * Phase 2 (60-30%): the shutter is blown off and the core stays exposed. It
 *   alternates bigger rock volleys with a rotating bullet spiral.
 * Phase 3 (<30%): the hull cracks open. Adds a meteor storm (rocks raining
 *   in from the top-right after a warning), and everything speeds up.
 *
 * Turrets fire aimed shots throughout; destroying them reduces the pressure.
 * Every attack is telegraphed and followed by a short rest.
 */
export class AsteroidFortress extends Boss {
  private core: THREE.Mesh;
  private coreGlow: THREE.Mesh;
  private shutterTop: THREE.Mesh;
  private shutterBottom: THREE.Mesh;
  private overlayFlash: { value: number }[] = [];

  private state: State = 'enter';
  private stateT = 0;
  private attackIdx = 0;
  private shutterOpen = 0; // 0 closed .. 1 open
  private shutterBlown = false;
  private debrisT = 0;
  private cracked = false;
  private bobT = 0;
  private spiralAngle = 0;
  private tick = 0;
  private stormLeft = 0;
  private game: any = null;

  constructor(scene: THREE.Scene, x: number, y: number) {
    super(scene, x, y, 2, FORTRESS_W, FORTRESS_H);
    this.radius = 60; // only used by generic code paths; hullHit below is an ellipse

    const sprite = (tex: string, w: number, h: number, order: number, additive = false) => {
      const mat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture(tex), transparent: true, depthWrite: false,
        alphaTest: additive ? 0 : 0.05, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      if (!additive) this.overlayFlash.push(addFlashUniform(mat));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.renderOrder = order;
      scene.add(m);
      return m;
    };
    this.core = sprite('boss2_core', 34, 34, 11);
    this.coreGlow = sprite('boss2_core_glow', 64, 64, 13, true);
    this.shutterTop = sprite('boss2_shutter_top', 36, 18, 12);
    this.shutterBottom = sprite('boss2_shutter_bottom', 36, 18, 12);
    this.syncOverlays(0);
  }

  // -------------------------------------------------------------------------
  // Hit model
  // -------------------------------------------------------------------------

  /** Elliptical hull (the sprite is a wide rock, not a circle). */
  hullHit(pos: THREE.Vector3, r: number): boolean {
    const dx = (pos.x - (this.mesh.position.x + 2)) / (80 + r);
    const dy = (pos.y - this.mesh.position.y) / (56 + r);
    return dx * dx + dy * dy <= 1;
  }

  /** The core is the weak spot when exposed; the closed shutter is armour. */
  weakSpotScale(pos: THREE.Vector3): number {
    const dx = pos.x - (this.mesh.position.x + CORE_X);
    const dy = pos.y - (this.mesh.position.y + CORE_Y);
    if (dx * dx + dy * dy > 24 * 24) return 1;
    if (this.shutterBlown || this.shutterOpen > 0.6) return 1.6;
    return 0.5;
  }

  /** True while the core is exposed (Game uses it to pick hit effects). */
  get coreExposed() {
    return this.shutterBlown || this.shutterOpen > 0.6;
  }

  setFlash(amount: number) {
    super.setFlash(amount);
    for (const u of this.overlayFlash) u.value = amount;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    const wasExploding = this.isExploding;
    super.update(dt, time, cameraX, bullets, particles, game, playerPos);
    if (this.isExploding && !wasExploding) this.onDeathStart(particles, game);
    this.syncOverlays(time);
  }

  protected behave(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    this.game = game;
    const hpPct = this.hp / this.maxHp;
    const phase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
    const pos = this.mesh.position;
    const holdX = cameraX + 232;

    // Phase transitions
    if (phase >= 2 && !this.shutterBlown) this.blowShutter(particles, game);
    if (phase >= 3 && !this.cracked) this.crackHull(particles, game);

    // Movement: slow, predictable bob; faster when cracked.
    if (this.state === 'enter') {
      pos.x -= 110 * dt;
      pos.y += (0 - pos.y) * 2 * dt;
      if (pos.x <= holdX) {
        pos.x = holdX;
        this.setState('rest', 1.2);
      }
    } else {
      this.bobT += dt * (phase === 3 ? 0.75 : 0.5);
      const ty = Math.sin(this.bobT) * (phase === 1 ? 110 : 130);
      // Hold steadier while aiming a volley.
      const k = this.state === 'volleyOpen' ? 0.8 : 2.2;
      pos.y += (ty - pos.y) * k * dt;
      pos.x = holdX + Math.sin(time * 0.9) * 6;
    }

    // Shutter animation
    const wantOpen = this.state === 'volleyOpen' || this.state === 'volleyHold';
    if (!this.shutterBlown) {
      this.shutterOpen += ((wantOpen ? 1 : 0) - this.shutterOpen) * Math.min(1, dt * (wantOpen ? 7 : 9));
    }

    // Damage trails
    if (particles && phase >= 2 && Math.random() < (phase === 3 ? 0.45 : 0.2)) {
      const ox = (Math.random() - 0.5) * 140, oy = (Math.random() - 0.5) * 90;
      particles.spawnSmoke(pos.x + ox, pos.y + oy);
      if (phase === 3 && Math.random() < 0.35) particles.spawnFire(pos.x + ox, pos.y + oy);
    }

    // Turrets: hold fire while entering, ease off during the meteor storm.
    const stormy = this.state === 'storm' || this.state === 'stormWarn';
    this.updateTurrets(dt, bullets, playerPos, this.state !== 'enter', stormy ? 1.5 : phase === 3 ? 0.8 : 1);

    this.runAttacks(dt, time, phase, bullets, particles, game, playerPos);
  }

  private setState(s: State, t: number) {
    this.state = s;
    this.stateT = t;
    this.tick = 0;
  }

  private runAttacks(dt: number, time: number, phase: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    if (this.state === 'enter') return;
    this.stateT -= dt;
    const cx = this.mesh.position.x + CORE_X, cy = this.mesh.position.y + CORE_Y;

    switch (this.state) {
      case 'rest': {
        if (this.stateT > 0) return;
        const cycle: State[] = phase === 1 ? ['volleyOpen']
          : phase === 2 ? ['volleyOpen', 'spiral']
          : ['stormWarn', 'spiral', 'volleyOpen'];
        const next = cycle[this.attackIdx++ % cycle.length];
        if (next === 'volleyOpen') {
          this.setState('volleyOpen', phase === 1 ? 0.75 : 0.6);
          SoundManager.playTurretFire(0.5);
        } else if (next === 'spiral') {
          this.setState('spiral', phase === 3 ? 2.6 : 2.4);
          this.spiralAngle = Math.random() * Math.PI * 2;
        } else {
          this.setState('stormWarn', 1.4);
          game?.level?.onAsteroidWarningUpdate?.(true, 'storm');
        }
        return;
      }

      case 'volleyOpen': {
        // Telegraph: core charges, sparks are drawn into the mass driver.
        if (particles && Math.random() < 0.7) {
          const a = Math.random() * Math.PI * 2, d = 34 + Math.random() * 16;
          particles.spawnSparks(cx + Math.cos(a) * d, cy + Math.sin(a) * d, a + Math.PI, 0xff6a5a, 2);
        }
        if (this.stateT <= 0) {
          this.fireVolley(phase, playerPos, particles, game);
          this.setState('volleyHold', phase === 1 ? 1.1 : 0.5);
        }
        return;
      }

      case 'volleyHold':
        if (this.stateT <= 0) this.setState('volleyClose', 0.35);
        return;

      case 'volleyClose':
        if (this.stateT <= 0) this.setState('rest', phase === 1 ? 1.4 : 1.0);
        return;

      case 'spiral': {
        this.tick -= dt;
        if (this.tick <= 0 && bullets) {
          this.tick = phase === 3 ? 0.15 : 0.13;
          const arms = phase === 3 ? 3 : 2;
          const speed = phase === 3 ? 170 : 155;
          for (let k = 0; k < arms; k++) {
            const a = this.spiralAngle + (k / arms) * Math.PI * 2;
            bullets.spawn(cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, false);
          }
          this.spiralAngle += 0.3;
          if (Math.floor(time * 8) % 2 === 0) SoundManager.playEnemyFire(0.6);
        }
        if (this.stateT <= 0) this.setState('rest', 1.1);
        return;
      }

      case 'stormWarn': {
        if (game?.addScreenShake && Math.random() < 0.3) game.addScreenShake(2, 0.1);
        if (this.stateT <= 0) {
          game?.level?.onAsteroidWarningUpdate?.(false, 'storm');
          this.setState('storm', 3.6);
        }
        return;
      }

      case 'storm': {
        this.tick -= dt;
        if (this.tick <= 0 && game?.level) {
          this.tick = 0.24 + Math.random() * 0.08;
          const camX = game.camera?.position?.x ?? this.mesh.position.x - 232;
          const type = Math.random() < 0.6 ? 'asteroid_chunk' : 'asteroid_small';
          const rock = new Enemy(this.scene, type, camX - 220 + Math.random() * 620, 330, 'straight');
          rock.launch(-(70 + Math.random() * 60), -(170 + Math.random() * 60));
          game.level.enemies.push(rock);
        }
        if (this.stateT <= 0) this.setState('rest', 1.2);
        return;
      }
    }
  }

  private fireVolley(phase: number, playerPos: THREE.Vector3 | undefined, particles?: ParticleManager, game?: any) {
    if (!game?.level) return;
    const cx = this.mesh.position.x + CORE_X - 14, cy = this.mesh.position.y + CORE_Y;
    const aim = playerPos ? Math.atan2(playerPos.y - cy, playerPos.x - cx) : Math.PI;
    const spread = phase === 1 ? [-0.24, 0, 0.24] : [-0.44, -0.22, 0, 0.22, 0.44];
    spread.forEach((off, k) => {
      const big = phase >= 2 && k === (spread.length >> 1);
      const rock = new Enemy(this.scene, big ? 'asteroid_small' : 'asteroid_chunk', cx, cy, 'straight');
      const v = big ? 135 : 165;
      rock.launch(Math.cos(aim + off) * v, Math.sin(aim + off) * v);
      game.level.enemies.push(rock);
    });
    particles?.spawnExplosion(cx, cy, 0xffb08a, 16);
    SoundManager.playExplosion('medium', 0.9);
    game.addScreenShake?.(5, 0.12);
  }

  private blowShutter(particles?: ParticleManager, game?: any) {
    this.shutterBlown = true;
    this.shutterOpen = 1;
    this.debrisT = 0.9;
    const cx = this.mesh.position.x + CORE_X, cy = this.mesh.position.y + CORE_Y;
    particles?.spawnExplosion(cx, cy, 0xffffff, 40);
    particles?.spawnExplosion(cx, cy, 0xff4a5e, 50);
    particles?.spawnSparks(cx, cy, Math.PI * 0.5, 0xffd27a, 14);
    particles?.spawnSparks(cx, cy, -Math.PI * 0.5, 0xffd27a, 14);
    SoundManager.playExplosion('large', 0.9);
    game?.addScreenShake?.(14, 0.4);
    game?.triggerHitStop?.(0.08);
    // Interrupt whatever was running so the reveal gets a beat to land.
    this.setState('rest', 1.4);
  }

  private crackHull(particles?: ParticleManager, game?: any) {
    this.cracked = true;
    (this.mesh.material as THREE.MeshBasicMaterial).map = AssetManager.getTexture('boss2_damaged');
    const p = this.mesh.position;
    for (let k = 0; k < 4; k++) {
      particles?.spawnExplosion(p.x + (Math.random() - 0.5) * 120, p.y + (Math.random() - 0.5) * 80, 0xff7a2a, 30);
    }
    SoundManager.playExplosion('large', 0.8);
    game?.addScreenShake?.(16, 0.45);
    game?.triggerHitStop?.(0.08);
    this.setState('rest', 1.4);
  }

  /** On death: stop any warning and shatter the rocks it threw. */
  private onDeathStart(particles?: ParticleManager, game?: any) {
    game?.level?.onAsteroidWarningUpdate?.(false, 'storm');
    if (!game?.level) return;
    for (const e of game.level.enemies as Enemy[]) {
      if (e.active && e.type.startsWith('asteroid')) {
        particles?.spawnExplosion(e.mesh.position.x, e.mesh.position.y, 0xb89a7a, 10);
        e.active = false;
        e.mesh.visible = false;
      }
    }
  }

  private syncOverlays(time: number) {
    const p = this.mesh.position;
    const cx = p.x + CORE_X, cy = p.y + CORE_Y;
    const alive = this.active && !this.isExploding;

    this.core.visible = alive;
    this.core.position.set(cx, cy, 0.5);
    this.core.rotation.z = time * 0.6;

    // Glow: dim while shut, flares while charging a volley, steady pulse when exposed.
    const charging = this.state === 'volleyOpen';
    const base = this.coreExposed ? 0.55 : 0.15 + this.shutterOpen * 0.4;
    const glowMat = this.coreGlow.material as THREE.MeshBasicMaterial;
    glowMat.opacity = Math.min(1, base + (charging ? 0.35 : 0) + 0.15 * Math.sin(time * (charging ? 24 : 5)));
    this.coreGlow.visible = alive;
    this.coreGlow.position.set(cx, cy, 0.7);
    this.coreGlow.scale.setScalar(charging ? 1.15 + 0.1 * Math.sin(time * 30) : 1);

    if (this.shutterBlown) {
      // Blown-off shutter halves tumble away and vanish.
      if (this.debrisT > 0) {
        this.debrisT -= 1 / 60;
        const t = 0.9 - this.debrisT;
        this.shutterTop.position.set(cx - 30 * t, cy + 9 + 160 * t, 0.8);
        this.shutterBottom.position.set(cx - 40 * t, cy - 9 - 150 * t, 0.8);
        this.shutterTop.rotation.z = t * 5;
        this.shutterBottom.rotation.z = -t * 6;
        this.shutterTop.visible = this.shutterBottom.visible = this.debrisT > 0 && alive;
      } else {
        this.shutterTop.visible = this.shutterBottom.visible = false;
      }
    } else {
      const slide = this.shutterOpen * 15;
      this.shutterTop.position.set(cx, cy + 9 + slide, 0.8);
      this.shutterBottom.position.set(cx, cy - 9 - slide, 0.8);
      this.shutterTop.visible = this.shutterBottom.visible = alive;
    }
  }

  destroy(scene: THREE.Scene) {
    super.destroy(scene);
    for (const m of [this.core, this.coreGlow, this.shutterTop, this.shutterBottom]) {
      scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

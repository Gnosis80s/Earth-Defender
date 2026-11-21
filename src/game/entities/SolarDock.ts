import * as THREE from 'three';
import { Boss } from './Boss';
import { Enemy } from './Enemy';
import { addFlashUniform } from './Entity';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { SoundManager } from '../SoundManager';
import { DOCK_HUB_W, DOCK_HUB_H, DOCK_LENS, DOCK_WING_W, DOCK_WING_H } from '../art/Stage3Art';

type State = 'enter' | 'rest' | 'beamTele' | 'beamFire' | 'wingVolley' | 'mines';

/** Wing centre offset from the hub (world units) once deployed. */
const WING_X = 12, WING_Y = 96;
/** Photovoltaic panel rectangle relative to the hub, for the top wing (mirror for bottom). */
const PANEL = { x0: WING_X - 54, x1: WING_X + 54, y0: 70, y1: 150 };
/** Node (turret) indices of the wings' power nodes in `turrets`. */
const NODE_TOP = 2, NODE_BOTTOM = 3;

interface Wing {
  mesh: THREE.Mesh;
  sign: 1 | -1;
  attached: boolean;
  vx: number; vy: number; spin: number; fade: number;
}

interface Beam {
  tele: THREE.Mesh;
  outer: THREE.Mesh;
  inner: THREE.Mesh;
  angle: number;
}

/**
 * Stage 3 boss: the Solar Dock, an orbital station the aliens have grown
 * into, guarding the approach to the Moon. Its solar wings feed a lens
 * cannon facing the player.
 *
 * - Solar panels are armour: shots that hit them do nothing. The hub and
 *   lens are reachable through the gap between the wings.
 * - Each wing hangs off a power node. Destroy a node and its wing tears
 *   free, which also removes a beam from the prism fan and that wing's
 *   volleys.
 * - Phase 1 (100-65%): single aimed lens beam; wing volleys.
 * - Phase 2 (65-30%): prism fan of 3 + (wings attached) beams.
 * - Phase 3 (<30%): adds proximity-mine releases; turrets speed up.
 * - Beams always telegraph (thin flickering guide lines) for about a second,
 *   and the lens takes x1.6 damage while it charges and fires.
 */
export class SolarDock extends Boss {
  private wings: Wing[] = [];
  private lensGlow: THREE.Mesh;
  private beams: Beam[] = [];
  private activeBeams = 0;
  private overlayFlash: { value: number }[] = [];

  private state: State = 'enter';
  private stateT = 0;
  private attackIdx = 0;
  private deploy = 0;
  private bobT = 0;
  private tick = 0;
  private pulses = 0;
  private overloaded = false;
  private damagedLook = false;

  constructor(scene: THREE.Scene, x: number, y: number) {
    super(scene, x, y, 3, DOCK_HUB_W, DOCK_HUB_H);
    this.radius = 46;

    for (const sign of [1, -1] as const) {
      const mat = new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture(sign > 0 ? 'boss3_wing_top' : 'boss3_wing_bottom'),
        transparent: true, alphaTest: 0.05, depthWrite: false,
      });
      this.overlayFlash.push(addFlashUniform(mat));
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(DOCK_WING_W, DOCK_WING_H), mat);
      mesh.renderOrder = 9; // behind the hub
      scene.add(mesh);
      this.wings.push({ mesh, sign, attached: true, vx: 0, vy: 0, spin: 0, fade: 1 });
    }

    this.lensGlow = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshBasicMaterial({
      map: AssetManager.getTexture('boss3_lens_glow'), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0x5ae8ff, opacity: 0.3,
    }));
    this.lensGlow.renderOrder = 13;
    scene.add(this.lensGlow);

    // Beam pool: up to 5 at once. Geometry starts at the lens and runs along +x.
    const plane = (w: number) => { const g = new THREE.PlaneGeometry(1000, w); g.translate(500, 0, 0); return g; };
    const mat = (color: number, opacity: number) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    for (let k = 0; k < 5; k++) {
      const b: Beam = {
        tele: new THREE.Mesh(plane(2), mat(0x7ae0ff, 0.6)),
        outer: new THREE.Mesh(plane(20), mat(0x2ad0ff, 0.55)),
        inner: new THREE.Mesh(plane(7), mat(0xffffff, 0.95)),
        angle: Math.PI,
      };
      b.tele.renderOrder = 14; b.outer.renderOrder = 14; b.inner.renderOrder = 15;
      for (const m of [b.tele, b.outer, b.inner]) { m.visible = false; scene.add(m); }
      this.beams.push(b);
    }
    this.syncOverlays(0);
  }

  // -------------------------------------------------------------------------
  // Hit model
  // -------------------------------------------------------------------------

  private inPanel(pos: THREE.Vector3, r: number): boolean {
    const dx = pos.x - this.mesh.position.x, dy = pos.y - this.mesh.position.y;
    for (const w of this.wings) {
      if (!w.attached) continue;
      const y = dy * w.sign;
      const ext = this.deploy; // panels slide out while deploying
      const y0 = PANEL.y0 - 40 * (1 - ext), y1 = PANEL.y1 - 40 * (1 - ext);
      if (dx > PANEL.x0 - r && dx < PANEL.x1 + r && y > y0 - r && y < y1 + r) return true;
    }
    return false;
  }

  hullHit(pos: THREE.Vector3, r: number): boolean {
    const dx = pos.x - this.mesh.position.x, dy = pos.y - this.mesh.position.y;
    const hub = (dx / (48 + r)) ** 2 + (dy / (42 + r)) ** 2 <= 1;
    const lx = dx - DOCK_LENS.x, ly = dy - DOCK_LENS.y;
    const lens = lx * lx + ly * ly <= (19 + r) ** 2;
    return hub || lens || this.inPanel(pos, r);
  }

  weakSpotScale(pos: THREE.Vector3): number {
    if (this.inPanel(pos, 0)) return 0; // panels soak shots
    const lx = pos.x - (this.mesh.position.x + DOCK_LENS.x), ly = pos.y - (this.mesh.position.y + DOCK_LENS.y);
    const charging = this.state === 'beamTele' || this.state === 'beamFire';
    if (charging && lx * lx + ly * ly < 18 * 18) return 1.6;
    return 1;
  }

  /** Firing beams hurt; telegraphs don't. */
  hazardHit(pos: THREE.Vector3, r: number): boolean {
    if (this.state !== 'beamFire') return false;
    const ox = this.mesh.position.x + DOCK_LENS.x, oy = this.mesh.position.y + DOCK_LENS.y;
    for (let k = 0; k < this.activeBeams; k++) {
      const a = this.beams[k].angle;
      const dx = pos.x - ox, dy = pos.y - oy;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      if (along < 0) continue;
      const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
      if (across < 8 + r) return true;
    }
    return false;
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
    this.updateWings(dt, particles, game);
    this.syncOverlays(time);
  }

  protected behave(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    const hpPct = this.hp / this.maxHp;
    const phase = hpPct > 0.65 ? 1 : hpPct > 0.3 ? 2 : 3;
    const pos = this.mesh.position;
    const holdX = cameraX + 215;

    if (phase >= 2 && !this.overloaded) {
      this.overloaded = true;
      particles?.spawnExplosion(pos.x + DOCK_LENS.x, pos.y, 0x5ae8ff, 40);
      SoundManager.playExplosion('large', 0.9);
      game?.addScreenShake?.(12, 0.35);
      this.cancelBeams();
      this.setState('rest', 1.2);
    }
    if (phase >= 3 && !this.damagedLook) {
      this.damagedLook = true;
      (this.mesh.material as THREE.MeshBasicMaterial).map = AssetManager.getTexture('boss3_damaged');
      for (let k = 0; k < 4; k++) particles?.spawnExplosion(pos.x + (Math.random() - 0.5) * 90, pos.y + (Math.random() - 0.5) * 70, 0xff7a2a, 28);
      SoundManager.playExplosion('large', 0.8);
      game?.addScreenShake?.(16, 0.45);
      game?.triggerHitStop?.(0.08);
      this.cancelBeams();
      this.setState('rest', 1.3);
    }

    // Movement: glide in while the wings deploy, then a slow bob; hold still to aim.
    if (this.state === 'enter') {
      pos.x -= 100 * dt;
      pos.y += (0 - pos.y) * 2 * dt;
      this.deploy = Math.min(1, this.deploy + dt * 0.5);
      if (pos.x <= holdX) {
        pos.x = holdX;
        this.deploy = 1;
        this.setState('rest', 1.0);
      }
    } else {
      this.bobT += dt * (phase === 3 ? 0.6 : 0.45);
      const aiming = this.state === 'beamTele' || this.state === 'beamFire';
      pos.y += (Math.sin(this.bobT) * 70 - pos.y) * (aiming ? 0.25 : 1.8) * dt;
      pos.x = holdX + Math.sin(time * 0.7) * 5;
    }

    if (particles && phase === 3 && Math.random() < 0.3) {
      particles.spawnSmoke(pos.x + (Math.random() - 0.5) * 80, pos.y + (Math.random() - 0.5) * 60);
    }

    this.updateTurrets(dt, bullets, playerPos, this.state !== 'enter', phase === 3 ? 0.75 : 1);
    this.runAttacks(dt, phase, bullets, particles, game, playerPos);
  }

  private setState(s: State, t: number) {
    this.state = s;
    this.stateT = t;
    this.tick = 0;
  }

  private wingsAttached() {
    return this.wings.filter((w) => w.attached).length;
  }

  private runAttacks(dt: number, phase: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    if (this.state === 'enter') return;
    this.stateT -= dt;
    const ox = this.mesh.position.x + DOCK_LENS.x, oy = this.mesh.position.y + DOCK_LENS.y;

    switch (this.state) {
      case 'rest': {
        if (this.stateT > 0) return;
        const cycle: State[] = phase === 1 ? ['beamTele', 'wingVolley']
          : phase === 2 ? ['beamTele', 'wingVolley']
          : ['beamTele', 'mines', 'wingVolley'];
        let next = cycle[this.attackIdx++ % cycle.length];
        if (next === 'wingVolley' && this.wingsAttached() === 0) next = 'beamTele';
        if (next === 'beamTele') this.startBeams(phase, playerPos);
        else if (next === 'wingVolley') { this.setState('wingVolley', 0.9); this.pulses = 0; }
        else this.setState('mines', 0.6);
        return;
      }

      case 'beamTele': {
        // Guide lines flicker; the lens draws in light.
        if (particles && Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 14;
          particles.spawnSparks(ox + Math.cos(a) * d, oy + Math.sin(a) * d, a + Math.PI, 0x7ae0ff, 2);
        }
        if (this.stateT <= 0) {
          this.setState('beamFire', 0.55);
          SoundManager.playExplosion('medium', 1.4);
          game?.addScreenShake?.(6, 0.2);
        }
        return;
      }

      case 'beamFire':
        if (this.stateT <= 0) {
          this.activeBeams = 0;
          this.setState('rest', phase === 1 ? 1.3 : 1.0);
        }
        return;

      case 'wingVolley': {
        this.tick -= dt;
        if (this.tick <= 0 && this.pulses < 2 && bullets) {
          this.tick = 0.35;
          this.pulses++;
          for (const w of this.wings) {
            if (!w.attached) continue;
            const wx = this.mesh.position.x + WING_X - 50, wy = this.mesh.position.y + w.sign * 110;
            const aim = playerPos ? Math.atan2(playerPos.y - wy, playerPos.x - wx) : Math.PI;
            for (let k = -2; k <= 2; k++) {
              const a = aim + k * 0.14;
              bullets.spawn(wx, wy, Math.cos(a) * 190, Math.sin(a) * 190, false);
            }
          }
          SoundManager.playEnemyFire(0.8);
        }
        if (this.stateT <= 0) this.setState('rest', 1.0);
        return;
      }

      case 'mines': {
        if (this.tick === 0 && game?.level) {
          this.tick = 1;
          for (let k = 0; k < 4; k++) {
            const sy = k < 2 ? 1 : -1;
            const m = new Enemy(this.scene, 'solar_mine', this.mesh.position.x - 10, this.mesh.position.y + sy * 30, 'straight');
            m.launch(-(55 + k % 2 * 35), sy * (35 + Math.random() * 30));
            game.level.enemies.push(m);
          }
          SoundManager.playBloop(0.7);
        }
        if (this.stateT <= 0) this.setState('rest', 1.1);
        return;
      }
    }
  }

  /** Aim and show the telegraph lines for the next beam attack. */
  private startBeams(phase: number, playerPos?: THREE.Vector3) {
    const ox = this.mesh.position.x + DOCK_LENS.x, oy = this.mesh.position.y + DOCK_LENS.y;
    const aim = playerPos ? Math.atan2(playerPos.y - oy, playerPos.x - ox) : Math.PI;
    if (phase === 1) {
      this.activeBeams = 1;
      this.beams[0].angle = aim;
    } else {
      const n = Math.min(5, 3 + this.wingsAttached());
      const spacing = 0.3;
      // Offset so the player's current spot isn't automatically a gap or a line.
      const centre = aim + (Math.random() - 0.5) * spacing;
      for (let k = 0; k < n; k++) this.beams[k].angle = centre + (k - (n - 1) / 2) * spacing;
      this.activeBeams = n;
    }
    this.setState('beamTele', phase === 1 ? 0.9 : 1.05);
    SoundManager.playTurretFire(0.5);
  }

  private cancelBeams() {
    this.activeBeams = 0;
    for (const b of this.beams) b.tele.visible = b.outer.visible = b.inner.visible = false;
  }

  private updateWings(dt: number, particles?: ParticleManager, game?: any) {
    const nodes = [NODE_TOP, NODE_BOTTOM];
    this.wings.forEach((w, i) => {
      if (w.attached && this.turrets[nodes[i]] && !this.turrets[nodes[i]].active && !this.isExploding) {
        // Node destroyed: the wing tears free and tumbles away.
        w.attached = false;
        w.vx = 40 + Math.random() * 30;
        w.vy = w.sign * (70 + Math.random() * 30);
        w.spin = w.sign * (0.8 + Math.random() * 0.6);
        const p = w.mesh.position;
        for (let k = 0; k < 5; k++) particles?.spawnExplosion(p.x + (Math.random() - 0.5) * 100, p.y + (Math.random() - 0.5) * 70, k % 2 ? 0x5a8ae0 : 0xffd27a, 14);
        SoundManager.playExplosion('large', 1.1);
        game?.addScreenShake?.(10, 0.3);
      }
      if (!w.attached && w.fade > 0) {
        w.mesh.position.x += w.vx * dt;
        w.mesh.position.y += w.vy * dt;
        w.mesh.rotation.z += w.spin * dt;
        w.fade -= dt / 1.6;
        (w.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, w.fade);
        if (particles && Math.random() < 0.3) particles.spawnSparks(w.mesh.position.x, w.mesh.position.y, Math.random() * 6.28, 0xffd27a, 2);
      }
    });
  }

  private syncOverlays(time: number) {
    const p = this.mesh.position;
    const alive = this.active && !this.isExploding;

    for (const w of this.wings) {
      if (w.attached) {
        w.mesh.position.set(p.x + WING_X, p.y + w.sign * (WING_Y - 40 * (1 - this.deploy)), -0.5);
        w.mesh.scale.y = 0.35 + 0.65 * this.deploy;
        w.mesh.visible = alive;
      } else {
        w.mesh.visible = alive && w.fade > 0;
      }
    }

    const ox = p.x + DOCK_LENS.x, oy = p.y + DOCK_LENS.y;
    const charging = this.state === 'beamTele', firing = this.state === 'beamFire';
    const gm = this.lensGlow.material as THREE.MeshBasicMaterial;
    gm.opacity = firing ? 0.95 : charging ? 0.45 + 0.4 * Math.abs(Math.sin(time * 20)) : 0.28 + 0.08 * Math.sin(time * 3);
    gm.color.set(this.overloaded ? 0xffc25a : 0x5ae8ff);
    this.lensGlow.scale.setScalar(firing ? 1.4 : charging ? 0.9 + (1 - this.stateT) * 0.5 : 0.8);
    this.lensGlow.position.set(ox, oy, 0.6);
    this.lensGlow.visible = alive;

    for (let k = 0; k < this.beams.length; k++) {
      const b = this.beams[k];
      const on = alive && k < this.activeBeams;
      b.tele.visible = on && charging;
      b.outer.visible = b.inner.visible = on && firing;
      for (const m of [b.tele, b.outer, b.inner]) {
        m.position.set(ox, oy, 0.7);
        m.rotation.z = b.angle;
      }
      if (b.tele.visible) (b.tele.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.55 * (Math.floor(time * 16) % 2);
      if (b.outer.visible) b.outer.scale.y = 0.85 + 0.3 * Math.sin(time * 50 + k);
    }
  }

  private onDeathStart(particles?: ParticleManager, game?: any) {
    this.cancelBeams();
    if (!game?.level) return;
    for (const e of game.level.enemies as Enemy[]) {
      if (e.active && e.type === 'solar_mine') {
        particles?.spawnExplosion(e.mesh.position.x, e.mesh.position.y, 0x7ae07a, 10);
        e.active = false;
        e.mesh.visible = false;
      }
    }
  }

  destroy(scene: THREE.Scene) {
    super.destroy(scene);
    const extra = [this.lensGlow, ...this.wings.map((w) => w.mesh), ...this.beams.flatMap((b) => [b.tele, b.outer, b.inner])];
    for (const m of extra) {
      scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

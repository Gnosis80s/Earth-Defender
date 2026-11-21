import * as THREE from 'three';
import { Boss } from './Boss';
import { Enemy } from './Enemy';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { SoundManager } from '../SoundManager';
import { BRAIN_W, BRAIN_H, BRAIN_EYE } from '../art/Stage5Creatures';

type State = 'enter' | 'rest' | 'pulseTele' | 'pulse' | 'larvae' | 'boltTele' | 'bolt' | 'spiral';

/** Brain mass ellipse relative to the sprite centre (world units). */
const BRAIN = { x: 6, y: 14, rx: 88, ry: 62 };
const CORRIDOR = 190;

interface Bolt { tele: THREE.Mesh; bolt: THREE.Mesh; x: number; }

/**
 * Final boss: the Mother Brain, the mind behind the invasion, wired into the
 * heart of the factory.
 *
 * - Three eye stalks project a psychic shield: while any of them lives, the
 *   brain takes half damage. The great eye beneath is always the weak point
 *   (x1.5).
 * - Phase 1 (100-65%): neural pulses (rings of shots, each with a gap you
 *   must move into) and broods of larvae.
 * - Phase 2 (65-30%): adds lightning that strikes down whole columns of the
 *   corridor after a flickering warning.
 * - Phase 3 (<30%): enraged (it turns blood-red and the factory's heartbeat
 *   races): more rings, more bolts, and a spiral from the great eye.
 */
export class MotherBrain extends Boss {
  private shield: THREE.Mesh;
  private eyeGlow: THREE.Mesh;
  private bolts: Bolt[] = [];
  private activeBolts = 0;
  private state: State = 'enter';
  private stateT = 0;
  private attackIdx = 0;
  private rings = 0;
  private tick = 0;
  private spiralA = 0;
  private enraged = false;
  private game: any = null;

  constructor(scene: THREE.Scene, x: number, y: number) {
    super(scene, x, y, 5, BRAIN_W, BRAIN_H);
    this.radius = 70;

    const glowTex = AssetManager.getTexture('boss3_lens_glow');
    const additive = (color: number, opacity: number) => new THREE.MeshBasicMaterial({
      map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.shield = new THREE.Mesh(new THREE.PlaneGeometry(BRAIN.rx * 2.5, BRAIN.ry * 2.6), additive(0x62c95e, 0.2));
    this.shield.renderOrder = 12;
    scene.add(this.shield);
    this.eyeGlow = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), additive(0xff3a3a, 0));
    this.eyeGlow.renderOrder = 13;
    scene.add(this.eyeGlow);

    for (let k = 0; k < 4; k++) {
      const tele = new THREE.Mesh(new THREE.PlaneGeometry(2, CORRIDOR * 2), new THREE.MeshBasicMaterial({
        color: 0x9af58a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      const bolt = new THREE.Mesh(new THREE.PlaneGeometry(40, CORRIDOR * 2), new THREE.MeshBasicMaterial({
        map: AssetManager.getTexture('lightning_0'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      tele.renderOrder = 14; bolt.renderOrder = 16;
      tele.visible = bolt.visible = false;
      scene.add(tele); scene.add(bolt);
      this.bolts.push({ tele, bolt, x: 0 });
    }
  }

  // -------------------------------------------------------------------------
  // Hit model
  // -------------------------------------------------------------------------

  private get shielded() {
    return this.turrets.some((t) => t.active);
  }

  private nearEye(pos: THREE.Vector3, r = 0) {
    const ex = this.mesh.position.x + BRAIN_EYE.x, ey = this.mesh.position.y + BRAIN_EYE.y;
    return (pos.x - ex) ** 2 + (pos.y - ey) ** 2 <= (22 + r) ** 2;
  }

  hullHit(pos: THREE.Vector3, r: number): boolean {
    const dx = (pos.x - (this.mesh.position.x + BRAIN.x)) / (BRAIN.rx + r);
    const dy = (pos.y - (this.mesh.position.y + BRAIN.y)) / (BRAIN.ry + r);
    return dx * dx + dy * dy <= 1 || this.nearEye(pos, r);
  }

  weakSpotScale(pos: THREE.Vector3): number {
    if (this.nearEye(pos)) return 1.5;
    return this.shielded ? 0.5 : 1;
  }

  hazardHit(pos: THREE.Vector3, r: number): boolean {
    if (this.state !== 'bolt') return false;
    for (let k = 0; k < this.activeBolts; k++) if (Math.abs(pos.x - this.bolts[k].x) < 12 + r) return true;
    return false;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    super.update(dt, time, cameraX, bullets, particles, game, playerPos);
    this.syncOverlays(time);
  }

  /** 0..1 how close to death (the level speeds its heartbeat with this). */
  get dread() {
    return 1 - this.hp / this.maxHp;
  }

  protected behave(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    this.game = game;
    const pct = this.hp / this.maxHp;
    const phase = pct > 0.65 ? 1 : pct > 0.3 ? 2 : 3;
    const pos = this.mesh.position;
    const holdX = cameraX + 250;

    if (phase === 3 && !this.enraged) {
      this.enraged = true;
      (this.mesh.material as THREE.MeshBasicMaterial).map = AssetManager.getTexture('boss5_rage');
      for (let k = 0; k < 6; k++) particles?.spawnExplosion(pos.x + (Math.random() - 0.5) * 160, pos.y + (Math.random() - 0.5) * 110, k % 2 ? 0xff2a2a : 0x62c95e, 26);
      SoundManager.playExplosion('large', 0.6);
      game?.addScreenShake?.(18, 0.6);
      game?.triggerHitStop?.(0.1);
      this.stopBolts();
      this.setState('rest', 1.4);
    }

    if (this.state === 'enter') {
      pos.x -= 70 * dt;
      if (pos.x <= holdX) { pos.x = holdX; this.setState('rest', 1.2); }
    } else {
      // A slow, heavy throb rather than flight.
      pos.x = holdX + Math.sin(time * 0.6) * 6;
      pos.y = Math.sin(time * 0.45) * 22;
    }

    if (particles && phase >= 2 && Math.random() < (phase === 3 ? 0.35 : 0.12)) {
      // Fluid and sparks leaking from the wounds.
      const a = Math.random() * Math.PI * 2;
      particles.spawnSparks(pos.x + BRAIN.x + Math.cos(a) * BRAIN.rx * 0.8, pos.y + BRAIN.y + Math.sin(a) * BRAIN.ry * 0.8, a, phase === 3 ? 0xff3a3a : 0x62c95e, 2);
    }

    this.updateTurrets(dt, bullets, playerPos, this.state !== 'enter', phase === 3 ? 0.75 : 1);
    this.runAttacks(dt, phase, cameraX, bullets, particles, game, playerPos);
  }

  private setState(s: State, t: number) {
    this.state = s;
    this.stateT = t;
    this.tick = 0;
  }

  private runAttacks(dt: number, phase: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    if (this.state === 'enter') return;
    this.stateT -= dt;
    const cx = this.mesh.position.x + BRAIN.x, cy = this.mesh.position.y + BRAIN.y;
    const ex = this.mesh.position.x + BRAIN_EYE.x, ey = this.mesh.position.y + BRAIN_EYE.y;

    switch (this.state) {
      case 'rest': {
        if (this.stateT > 0) return;
        const cycle: State[] = phase === 1 ? ['pulseTele', 'larvae', 'pulseTele']
          : phase === 2 ? ['boltTele', 'pulseTele', 'larvae', 'boltTele']
          : ['boltTele', 'spiral', 'pulseTele', 'larvae'];
        const next = cycle[this.attackIdx++ % cycle.length];
        if (next === 'pulseTele') { this.setState('pulseTele', 0.7); this.rings = 0; SoundManager.playBloop(0.5); }
        else if (next === 'boltTele') this.startBolts(phase, cameraX, playerPos);
        else if (next === 'spiral') { this.setState('spiral', 2.6); this.spiralA = Math.random() * 6.28; SoundManager.playTurretFire(0.4); }
        else this.setState('larvae', 0.8);
        return;
      }

      case 'pulseTele':
        if (particles && Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          particles.spawnSparks(cx + Math.cos(a) * 110, cy + Math.sin(a) * 80, a + Math.PI, 0x9af58a, 2);
        }
        if (this.stateT <= 0) this.setState('pulse', 9);
        return;

      case 'pulse': {
        this.tick -= dt;
        const total = phase === 3 ? 3 : 2;
        if (this.tick <= 0 && bullets) {
          this.tick = 0.55;
          // A ring with a 3-shot gap; the gap is placed off your current line so you have to move.
          const n = 22, aim = playerPos ? Math.atan2(playerPos.y - cy, playerPos.x - cx) : Math.PI;
          const gapCentre = aim + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.25);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            let dA = Math.abs(((a - gapCentre + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (dA < (1.6 / n) * Math.PI) continue;
            bullets.spawn(cx, cy, Math.cos(a) * 125, Math.sin(a) * 125, false);
          }
          SoundManager.playEnemyFire(0.5);
          game?.addScreenShake?.(3, 0.1);
          this.rings++;
        }
        if (this.rings >= total && this.tick <= 0.2) this.setState('rest', 1.0);
        return;
      }

      case 'larvae': {
        if (this.tick === 0 && game?.level) {
          this.tick = 1;
          const n = phase === 3 ? 4 : 3;
          for (let k = 0; k < n; k++) {
            const larva = new Enemy(this.scene, 'bioDrone', cx - 60, cy + (k - (n - 1) / 2) * 40, 'bio_spiral');
            game.level.enemies.push(larva);
          }
          particles?.spawnExplosion(cx - 60, cy, 0x862636, 30);
          SoundManager.playBloop(0.6);
        }
        if (this.stateT <= 0) this.setState('rest', 0.9);
        return;
      }

      case 'boltTele': {
        if (particles && Math.random() < 0.6) {
          const b = this.bolts[Math.floor(Math.random() * this.activeBolts)];
          particles.spawnSparks(b.x, Math.random() < 0.5 ? CORRIDOR - 4 : -CORRIDOR + 4, Math.random() * 6.28, 0x9af58a, 2);
        }
        if (this.stateT <= 0) {
          this.setState('bolt', 0.45);
          SoundManager.playExplosion('medium', 1.5);
          game?.addScreenShake?.(8, 0.25);
        }
        return;
      }

      case 'bolt':
        if (this.stateT <= 0) { this.stopBolts(); this.setState('rest', 0.9); }
        return;

      case 'spiral': {
        this.tick -= dt;
        if (this.tick <= 0 && bullets) {
          this.tick = 0.12;
          for (let k = 0; k < 2; k++) {
            const a = this.spiralA + k * Math.PI;
            bullets.spawn(ex, ey, Math.cos(a) * 165, Math.sin(a) * 165, false);
          }
          this.spiralA += 0.28;
        }
        if (this.stateT <= 0) this.setState('rest', 1.0);
        return;
      }
    }
  }

  /** Choose lightning columns across the player's side of the corridor and show their warnings. */
  private startBolts(phase: number, cameraX: number, playerPos?: THREE.Vector3) {
    const n = phase === 3 ? 4 : 3;
    const xs: number[] = [];
    // One column always lands near the player so standing still never works.
    if (playerPos) xs.push(playerPos.x + (Math.random() - 0.5) * 30);
    let guard = 0;
    while (xs.length < n && guard++ < 60) {
      const x = cameraX - 340 + Math.random() * 420;
      if (xs.every((o) => Math.abs(o - x) > 120)) xs.push(x);
    }
    this.activeBolts = xs.length;
    xs.forEach((x, k) => { this.bolts[k].x = x; });
    this.setState('boltTele', phase === 3 ? 0.85 : 1.0);
    SoundManager.playTurretFire(0.35);
  }

  private stopBolts() {
    this.activeBolts = 0;
    for (const b of this.bolts) b.tele.visible = b.bolt.visible = false;
  }

  private syncOverlays(time: number) {
    const p = this.mesh.position;
    const alive = this.active && !this.isExploding;

    this.shield.visible = alive && this.shielded;
    this.shield.position.set(p.x + BRAIN.x, p.y + BRAIN.y, 0.5);
    (this.shield.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(time * 3);

    const charging = this.state === 'spiral' || this.state === 'pulseTele';
    this.eyeGlow.visible = alive;
    this.eyeGlow.position.set(p.x + BRAIN_EYE.x, p.y + BRAIN_EYE.y, 0.6);
    (this.eyeGlow.material as THREE.MeshBasicMaterial).opacity = charging ? 0.55 + 0.3 * Math.sin(time * 18) : 0.12;

    const teling = this.state === 'boltTele', striking = this.state === 'bolt';
    for (let k = 0; k < this.bolts.length; k++) {
      const b = this.bolts[k];
      const on = alive && k < this.activeBolts;
      b.tele.visible = on && teling;
      b.bolt.visible = on && striking;
      b.tele.position.set(b.x, 0, 0.8);
      b.bolt.position.set(b.x, 0, 0.9);
      if (b.tele.visible) (b.tele.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.6 * (Math.floor(time * 14 + k) % 2);
      if (b.bolt.visible) {
        const mat = b.bolt.material as THREE.MeshBasicMaterial;
        const tex = AssetManager.getTexture(`lightning_${Math.floor(time * 20 + k) % 3}`);
        if (mat.map !== tex) mat.map = tex;
        b.bolt.scale.x = 0.8 + 0.4 * Math.random();
      }
    }
    if (!alive) this.stopBolts();
  }

  destroy(scene: THREE.Scene) {
    super.destroy(scene);
    for (const m of [this.shield, this.eyeGlow, ...this.bolts.flatMap((b) => [b.tele, b.bolt])]) {
      scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

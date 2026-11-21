import * as THREE from 'three';
import { Boss } from './Boss';
import { Enemy } from './Enemy';
import { addFlashUniform } from './Entity';
import { AssetManager } from '../AssetManager';
import { BulletManager } from '../BulletManager';
import { ParticleManager } from '../ParticleManager';
import { SoundManager } from '../SoundManager';
import { WORM_HEAD, WORM_SEG, WORM_TAIL } from '../art/Stage4Props';

type State = 'hidden' | 'arcTele' | 'arc' | 'rearRise' | 'rearSway' | 'rearDive';

/** The lunar ground line: anything below is clipped (inside the regolith). */
const GROUND_Y = -205;
const SEGS = 12;
const SPACING = 26;
const GRAVITY = 440;

/**
 * Stage 4 boss: the Void Leviathan, a bio-mechanical worm that guards the
 * way into the Moon. It lives in the regolith: everything below the ground
 * line is clipped away, so it really does burrow.
 *
 * - Arc: dust boils up and the ground shakes where it will breach (about a
 *   second of warning), then it bursts out and arcs across the sky and dives
 *   back in. It spits a spread at the top of the arc.
 * - Rear (phase 2+): the factory hatch grinds open and it rises out of it,
 *   swaying like a cobra and spraying aimed fans, then sinks back.
 * - Phase 3 (<30%): breaches hurl rocks up that fall back to the surface,
 *   and the body spits shots as it flies.
 *
 * The head is the weak point; the armoured body takes 30% damage. The body
 * hurts on contact. Destroyed, it bursts apart segment by segment.
 */
export class VoidLeviathan extends Boss {
  private segs: THREE.Mesh[] = [];
  private tail: THREE.Mesh;
  private segFlash: { value: number }[] = [];
  private clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)];

  /** Head positions, newest first, roughly 2 units apart (the body follows them). */
  private trail: { x: number; y: number }[] = [];
  /** 'column' = body hangs from the ground to the head on a curve (when rearing). */
  private bodyMode: 'trail' | 'column' = 'trail';
  private columnBase = new THREE.Vector2();

  private state: State = 'hidden';
  private stateT = 1.6;
  private attackIdx = 0;
  private arcVx = 0; private arcVy = 0;
  private dir = -1;
  private x0 = 0; private x1 = 0;
  private fired = false;
  private tick = 0;
  private swayT = 0;
  private rearX = 0;
  private popIdx = 0;
  private popT = 0;
  private game: any = null;

  constructor(scene: THREE.Scene, x: number, y: number) {
    super(scene, x, GROUND_Y - 200, 4, WORM_HEAD.w, WORM_HEAD.h);
    (this.mesh.material as THREE.MeshBasicMaterial).map = AssetManager.getTexture('boss4_head');
    (this.mesh.material as THREE.MeshBasicMaterial).clippingPlanes = this.clip;
    this.maxHp = this.hp = 1300; // the head is only exposed part of the time
    this.radius = 26;

    // No turrets: the generic stage 4 layout doesn't apply to a worm.
    for (const t of this.turrets) scene.remove(t.mesh);
    this.turrets = [];

    const mk = (tex: string, size: number, order: number) => {
      const mat = new THREE.MeshBasicMaterial({ map: AssetManager.getTexture(tex), transparent: true, alphaTest: 0.05, depthWrite: false });
      mat.clippingPlanes = this.clip;
      this.segFlash.push(addFlashUniform(mat));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      m.renderOrder = order;
      scene.add(m);
      return m;
    };
    for (let k = 0; k < SEGS; k++) this.segs.push(mk('boss4_segment', WORM_SEG, 9));
    this.tail = mk('boss4_tail', WORM_TAIL, 8);
    this.reseedTrail(x, GROUND_Y - 200);
    this.placeBody();
  }

  // -------------------------------------------------------------------------
  // Hit model
  // -------------------------------------------------------------------------

  private headVisible() {
    return this.mesh.position.y > GROUND_Y - 18;
  }

  hullHit(pos: THREE.Vector3, r: number): boolean {
    if (pos.y < GROUND_Y - 4) return false; // nothing to hit inside the ground
    const h = this.mesh.position;
    if (this.headVisible() && (pos.x - h.x) ** 2 + (pos.y - h.y) ** 2 <= (24 + r) ** 2) return true;
    for (const s of this.segs) {
      if (s.position.y < GROUND_Y) continue;
      if ((pos.x - s.position.x) ** 2 + (pos.y - s.position.y) ** 2 <= (18 + r) ** 2) return true;
    }
    return false;
  }

  weakSpotScale(pos: THREE.Vector3): number {
    const h = this.mesh.position;
    return (pos.x - h.x) ** 2 + (pos.y - h.y) ** 2 <= 28 * 28 ? 1 : 0.3;
  }

  setFlash(amount: number) {
    super.setFlash(amount);
    for (const u of this.segFlash) u.value = amount * 0.6;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    this.game = game;
    super.update(dt, time, cameraX, bullets, particles, game, playerPos);
    if (this.isExploding) this.burstApart(dt, particles, game);
    else this.placeBody();
  }

  protected behave(dt: number, time: number, cameraX: number, bullets?: BulletManager, particles?: ParticleManager, game?: any, playerPos?: THREE.Vector3) {
    const hpPct = this.hp / this.maxHp;
    const phase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
    const h = this.mesh.position;
    this.stateT -= dt;

    switch (this.state) {
      case 'hidden': {
        if (this.stateT > 0) return;
        const cycle = phase === 1 ? ['arc'] : phase === 2 ? ['arc', 'rear'] : ['arc', 'rear', 'arc'];
        const next = cycle[this.attackIdx++ % cycle.length];
        if (next === 'arc') this.startArcTele(cameraX, playerPos);
        else this.startRear(cameraX, game);
        return;
      }

      case 'arcTele': {
        // Dust boils up where it will breach; the ground trembles.
        if (particles && Math.random() < 0.7) {
          particles.spawnSmoke(this.x0 + (Math.random() - 0.5) * 50, GROUND_Y + 4 + Math.random() * 8);
          if (Math.random() < 0.3) particles.spawnSparks(this.x0 + (Math.random() - 0.5) * 30, GROUND_Y + 4, Math.PI / 2, 0x8f96a1, 3);
        }
        if (Math.random() < 0.35) game?.addScreenShake?.(2.5, 0.1);
        if (this.stateT <= 0) this.launchArc(phase, particles, game);
        return;
      }

      case 'arc': {
        this.arcVy -= GRAVITY * dt;
        h.x += this.arcVx * dt;
        h.y += this.arcVy * dt;
        this.pushTrail();
        // Spit a spread at the top of the arc.
        if (!this.fired && this.arcVy <= 0) {
          this.fired = true;
          this.fireFan(bullets, playerPos, phase === 1 ? 3 : 5, 0.2, 200);
        }
        // Phase 3: the body spits too.
        if (phase === 3 && bullets) {
          this.tick -= dt;
          if (this.tick <= 0) {
            this.tick = 0.3;
            const s = this.segs[Math.floor(Math.random() * SEGS)];
            if (s.position.y > GROUND_Y + 20 && playerPos) {
              const a = Math.atan2(playerPos.y - s.position.y, playerPos.x - s.position.x);
              bullets.spawn(s.position.x, s.position.y, Math.cos(a) * 150, Math.sin(a) * 150, false);
            }
          }
        }
        // Splashdown
        if (this.arcVy < 0 && h.y < GROUND_Y && !this.landed) {
          this.landed = true;
          this.dust(h.x, particles, game, 0.7);
        }
        const tailPt = this.trailAt((SEGS + 1) * SPACING);
        if (this.arcVy < 0 && tailPt.y < GROUND_Y - 30) {
          this.setState('hidden', phase === 3 ? 0.6 : 1.0);
        }
        return;
      }

      case 'rearRise': {
        h.y += 230 * dt;
        h.x = this.rearX + Math.sin(this.swayT) * 10;
        if (h.y >= 40) { h.y = 40; this.setState('rearSway', phase === 3 ? 5.0 : 4.2); this.tick = 0.4; }
        return;
      }

      case 'rearSway': {
        this.swayT += dt * 1.6;
        h.x = this.rearX + Math.sin(this.swayT) * 60;
        h.y = 40 + Math.sin(this.swayT * 1.45) * 40;
        this.tick -= dt;
        if (this.tick <= 0 && bullets) {
          this.tick = phase === 3 ? 0.7 : 0.9;
          this.fireFan(bullets, playerPos, 5, 0.22, 210);
        }
        if (phase === 3 && Math.abs(this.stateT - 2.5) < dt && bullets) {
          // A slow ring once per rear in the last phase.
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            bullets.spawn(h.x, h.y, Math.cos(a) * 120, Math.sin(a) * 120, false);
          }
          SoundManager.playEnemyFire(0.6);
        }
        if (this.stateT <= 0) this.setState('rearDive', 9);
        return;
      }

      case 'rearDive': {
        h.y -= 260 * dt;
        h.x += (this.rearX - h.x) * 3 * dt;
        if (h.y < GROUND_Y - 120) {
          game?.level?.blastDoor?.close?.();
          this.bodyMode = 'trail';
          this.reseedTrail(h.x, h.y);
          this.setState('hidden', 1.0);
        }
        return;
      }
    }
  }

  private landed = false;

  private setState(s: State, t: number) {
    this.state = s;
    this.stateT = t;
  }

  private startArcTele(cameraX: number, playerPos?: THREE.Vector3) {
    // Alternate direction; breach on the far side from the player.
    this.dir = -this.dir;
    const px = playerPos ? playerPos.x - cameraX : -200;
    const fromRight = this.dir < 0 ? true : px > 100 ? true : false;
    this.dir = fromRight ? -1 : 1;
    this.x0 = cameraX + (fromRight ? 300 : -300) + (Math.random() - 0.5) * 60;
    this.x1 = this.x0 + this.dir * (520 + Math.random() * 80);
    this.setState('arcTele', 1.0);
    SoundManager.playExplosion('small', 0.4);
  }

  private launchArc(phase: number, particles?: ParticleManager, game?: any) {
    const startY = GROUND_Y - 40;
    const apex = phase === 3 ? 170 : 130;
    this.arcVy = Math.sqrt(2 * GRAVITY * (apex - startY));
    const T = (2 * this.arcVy) / GRAVITY;
    this.arcVx = (this.x1 - this.x0) / T;
    this.mesh.position.set(this.x0, startY, 0);
    this.bodyMode = 'trail';
    this.reseedTrail(this.x0, startY);
    this.fired = false;
    this.landed = false;
    this.tick = 0.4;
    this.setState('arc', 99);
    this.dust(this.x0, particles, game, 1);
    SoundManager.playExplosion('large', 0.6);
    if (phase === 3 && game?.level) {
      // Rocks flung up by the breach fall back onto the surface.
      for (let k = 0; k < 4; k++) {
        const rock = new Enemy(this.scene, 'asteroid_chunk', this.x0 + (Math.random() - 0.5) * 40, GROUND_Y + 10, 'straight');
        rock.launch((Math.random() - 0.5) * 220, 300 + Math.random() * 120);
        rock.gravity = 300;
        game.level.enemies.push(rock);
      }
    }
  }

  private startRear(cameraX: number, game?: any) {
    const door = game?.level?.blastDoor;
    // Rise out of the factory hatch when it's on screen; otherwise burst from the ground.
    this.rearX = door && Math.abs(door.x - (cameraX + 150)) < 260 ? door.x : cameraX + 260;
    if (door && this.rearX === door.x) door.open?.();
    this.mesh.position.set(this.rearX, GROUND_Y - 60, 0);
    this.bodyMode = 'column';
    this.columnBase.set(this.rearX, GROUND_Y - 40);
    this.swayT = 0;
    this.setState('rearRise', 99);
    this.dust(this.rearX, undefined, game, 0.8);
    game?.addScreenShake?.(6, 0.3);
    SoundManager.playExplosion('large', 0.5);
  }

  private fireFan(bullets: BulletManager | undefined, playerPos: THREE.Vector3 | undefined, n: number, spacing: number, speed: number) {
    if (!bullets) return;
    const h = this.mesh.position;
    const fx = Math.cos(this.mesh.rotation.z) * 26, fy = Math.sin(this.mesh.rotation.z) * 26 * Math.sign(this.mesh.scale.y || 1);
    const ox = h.x + fx, oy = h.y + fy;
    const aim = playerPos ? Math.atan2(playerPos.y - oy, playerPos.x - ox) : Math.PI;
    for (let k = 0; k < n; k++) {
      const a = aim + (k - (n - 1) / 2) * spacing;
      bullets.spawn(ox, oy, Math.cos(a) * speed, Math.sin(a) * speed, false);
    }
    SoundManager.playEnemyFire(0.7);
  }

  private dust(x: number, particles: ParticleManager | undefined, game: any, strength: number) {
    const p = particles ?? game?.particles;
    for (let k = 0; k < 6; k++) p?.spawnSmoke(x + (Math.random() - 0.5) * 70, GROUND_Y + Math.random() * 14);
    p?.spawnExplosion(x, GROUND_Y + 6, 0x8f96a1, Math.round(30 * strength));
    p?.spawnSparks(x, GROUND_Y + 6, Math.PI / 2, 0xb2b8c0, Math.round(10 * strength));
    game?.addScreenShake?.(8 * strength, 0.3);
  }

  // -------------------------------------------------------------------------
  // Body
  // -------------------------------------------------------------------------

  private reseedTrail(x: number, y: number) {
    // A vertical run of points going down into the ground beneath (x, y).
    this.trail = [];
    for (let i = 0; i < ((SEGS + 2) * SPACING) / 2 + 4; i++) this.trail.push({ x, y: y - i * 2 });
  }

  private pushTrail() {
    const h = this.mesh.position;
    const last = this.trail[0];
    const d = Math.hypot(h.x - last.x, h.y - last.y);
    if (d < 2) return;
    // Insert evenly spaced points so fast moves don't stretch the body.
    const n = Math.floor(d / 2);
    for (let i = n; i >= 1; i--) {
      const t = i / n;
      this.trail.unshift({ x: last.x + (h.x - last.x) * t, y: last.y + (h.y - last.y) * t });
    }
    this.trail.length = Math.min(this.trail.length, ((SEGS + 2) * SPACING) / 2 + 4);
  }

  private trailAt(dist: number) {
    const i = Math.min(this.trail.length - 1, Math.round(dist / 2));
    return this.trail[i];
  }

  /** Place head orientation, segments and tail along the trail (or the rearing column). */
  private placeBody() {
    const h = this.mesh.position;
    const pts: { x: number; y: number }[] = [];
    if (this.bodyMode === 'trail') {
      for (let k = 1; k <= SEGS + 1; k++) pts.push(this.trailAt(k * SPACING));
    } else {
      // Quadratic curve from below the ground up to the head, bowed against the sway.
      const b = this.columnBase;
      const cx = b.x - (h.x - b.x) * 0.7, cy = (b.y + h.y) / 2;
      for (let k = 1; k <= SEGS + 1; k++) {
        const t = 1 - k / (SEGS + 1.5);
        const u = 1 - t;
        pts.push({ x: u * u * b.x + 2 * u * t * cx + t * t * h.x, y: u * u * b.y + 2 * u * t * cy + t * t * h.y });
      }
    }
    // Head faces along its motion; flip vertically when heading left so the dorsal side stays up.
    const ahead = pts[0];
    const ang = Math.atan2(h.y - ahead.y, h.x - ahead.x);
    this.mesh.rotation.z = ang;
    if (!this.isExploding) this.mesh.scale.set(1, Math.cos(ang) < 0 ? -1 : 1, 1);

    const meshes = [...this.segs, this.tail];
    for (let k = 0; k < meshes.length; k++) {
      const p = pts[k];
      const prev = k === 0 ? { x: h.x, y: h.y } : pts[k - 1];
      const a = Math.atan2(prev.y - p.y, prev.x - p.x);
      meshes[k].position.set(p.x, p.y, -0.2 - k * 0.01);
      meshes[k].rotation.z = a;
      meshes[k].scale.y = Math.cos(a) < 0 ? -1 : 1;
      meshes[k].visible = this.active && meshes[k].userData.popped !== true;
    }
  }

  /** Death: the body bursts apart from head to tail while the head explodes. */
  private burstApart(dt: number, particles?: ParticleManager, game?: any) {
    const meshes = [...this.segs, this.tail];
    this.popT -= dt;
    if (this.popT <= 0 && this.popIdx < meshes.length) {
      this.popT = 0.16;
      const m = meshes[this.popIdx++];
      if (m.position.y > GROUND_Y) {
        particles?.spawnExplosion(m.position.x, m.position.y, this.popIdx % 2 ? 0x7ae07a : 0xa874bf, 22);
        SoundManager.playExplosion('small', 0.9 + Math.random() * 0.3);
        game?.addScreenShake?.(4, 0.1);
      }
      m.userData.popped = true;
      m.visible = false;
    }
    if (!this.active) for (const m of meshes) m.visible = false;
  }

  destroy(scene: THREE.Scene) {
    super.destroy(scene);
    for (const m of [...this.segs, this.tail]) {
      scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}

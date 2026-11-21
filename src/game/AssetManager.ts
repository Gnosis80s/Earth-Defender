import * as THREE from 'three';
import { drawEarth, drawLunarFar, drawLunarNear } from './art/Stage4Art';
import {
  drawNightSky, drawNightClouds, drawNightMountains, drawCitySkylineFar, drawCitySkylineNear, drawMoonHalo, drawSearchlightBeam,
} from './art/Stage1Art';
import { drawPadDeck, drawServiceArm, drawControlTower, drawFuelCompound } from './art/LaunchpadArt';

export class AssetManager {
  static textures: Record<string, THREE.Texture> = {};
  static generators: Record<string, () => THREE.Texture> = {};

  private static registered = false;

  /**
   * Generate the heaviest procedural backdrops during browser idle time
   * (e.g. while the main menu is up), one texture per idle slice, so pressing
   * Launch doesn't stall on them. Anything not ready by then is simply
   * generated on demand as before.
   */
  static prewarmInIdle(names: string[] = [
    'night_sky', 'bg_mountains', 'bg_city_far', 'bg_city', 'night_clouds', 'moon_halo', 'searchlight_beam',
    'launchpad_deck', 'launchpad_tower', 'launchpad_fuel', 'launchpad_arm_left', 'launchpad_arm_right',
    'bg_lunar_far', 'bg_lunar', 'earth',
  ]) {
    this.ensureRegistered();
    const queue = names.filter((n) => !this.textures[n]);
    const idle: (cb: () => void) => void = (window as any).requestIdleCallback
      ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 120 })
      : (cb) => setTimeout(cb, 50);
    const next = () => {
      const name = queue.shift();
      if (!name) return;
      this.getTexture(name);
      idle(next);
    };
    idle(next);
  }

  private static ensureRegistered() {
    if (this.registered) return;
    this.registerGenerators();
    this.registered = true;
  }

  static init() {
    this.ensureRegistered();
    // Pre-warm immediate core assets for menu and stage 1 start
    this.getTexture('player');
    this.getTexture('player_gold');
    this.getTexture('player_stealth');
    this.getTexture('player_dreadnought');
    this.getTexture('bulletPlayer');
    this.getTexture('bulletEnemy');
    this.getTexture('particle');
    this.getTexture('star');
  }

  static getTexture(name: string): THREE.Texture {
    if (!this.textures[name]) {
      if (this.generators[name]) {
        this.textures[name] = this.generators[name]();
      } else {
        console.warn(`[AssetManager] Unknown texture requested: ${name}`);
      }
    }
    return this.textures[name];
  }

  static registerGenerators() {
    this.generators['player'] = () => this.generatePlayerTexture();
    this.generators['player_gold'] = () => this.generatePlayerGoldTexture();
    this.generators['player_stealth'] = () => this.generatePlayerStealthTexture();
    this.generators['player_dreadnought'] = () => this.generatePlayerDreadnoughtTexture();
    this.generators['enemyScout'] = () => this.generateEnemyScoutTexture();
    this.generators['enemyHeavy'] = () => this.generateEnemyHeavyTexture();
    this.generators['enemyInterceptor'] = () => this.generateEnemyInterceptorTexture();
    this.generators['enemySniper'] = () => this.generateEnemySniperTexture();
    this.generators['subboss1'] = () => this.generateSubBossTexture();
    this.generators['boss1'] = () => this.generateBossTexture(1);
    this.generators['boss2'] = () => this.generateBossTexture(2);
    this.generators['boss3'] = () => this.generateBossTexture(3);
    this.generators['boss4'] = () => this.generateBossTexture(4);
    this.generators['boss5'] = () => this.generateBossTexture(5);
    this.generators['enemyBioDrone'] = () => this.generateEnemyBioDroneTexture();
    this.generators['enemyBioStalker'] = () => this.generateEnemyBioStalkerTexture();
    this.generators['enemyBioBehemoth'] = () => this.generateEnemyBioBehemothTexture();
    this.generators['bulletPlayer'] = () => this.generateBullet(0x00ffff);
    this.generators['bulletPlayer_green'] = () => this.generateBullet(0x00ff00);
    this.generators['bulletPlayer_purple'] = () => this.generateBullet(0xff00ff);
    this.generators['bulletPlayer_red'] = () => this.generateBullet(0xff0044);
    this.generators['bulletEnemy'] = () => this.generateEnemyBullet();
    this.generators['bulletBio'] = () => this.generateBioBullet();
    this.generators['particle'] = () => this.generateParticle();
    this.generators['missile'] = () => this.generateMissileTexture();
    this.generators['missile_upgraded'] = () => this.generateMissileUpgradedTexture();
    this.generators['star'] = () => this.generateStar();
    this.generators['moon'] = () => this.generateMoon();
    this.generators['earth'] = () => this.createTextureFromCanvas(drawEarth(192));
    this.generators['bg_lunar'] = () => this.createTextureFromCanvas(drawLunarNear());
    this.generators['bg_lunar_far'] = () => this.createTextureFromCanvas(drawLunarFar());
    this.generators['bg_solar_dock'] = () => this.generateSolarDockBackground();
    this.generators['solar_mine'] = () => this.generateSolarMineTexture();
    this.generators['bg_cavern_far'] = () => this.generateCavernFarLandscape();
    this.generators['bg_cavern'] = () => this.generateCavernLandscape();
    this.generators['bg_cavern_entry'] = () => this.generateCavernEntryLandscape();
    this.generators['bg_cavern_to_factory_far'] = () => this.generateCavernToFactoryFarLandscape();
    this.generators['bg_cavern_to_factory'] = () => this.generateCavernToFactoryLandscape();
    this.generators['bg_factory_far'] = () => this.generateFactoryFarLandscape();
    this.generators['bg_factory'] = () => this.generateFactoryLandscape();
    this.generators['bg_factory_to_superstructure_far'] = () => this.generateFactoryToSuperstructureFarLandscape();
    this.generators['bg_factory_to_superstructure'] = () => this.generateFactoryToSuperstructureLandscape();
    this.generators['bg_superstructure_far'] = () => this.generateSuperstructureFarLandscape();
    this.generators['bg_superstructure'] = () => this.generateSuperstructureLandscape();
    this.generators['bg_mountains'] = () => this.createTextureFromCanvas(drawNightMountains());
    this.generators['bg_city'] = () => this.createTextureFromCanvas(drawCitySkylineNear());
    this.generators['bg_city_far'] = () => this.createTextureFromCanvas(drawCitySkylineFar());
    this.generators['night_sky'] = () => this.createTextureFromCanvas(drawNightSky());
    this.generators['night_clouds'] = () => this.createTextureFromCanvas(drawNightClouds());
    this.generators['moon_halo'] = () => this.createTextureFromCanvas(drawMoonHalo());
    this.generators['searchlight_beam'] = () => this.createTextureFromCanvas(drawSearchlightBeam());
    this.generators['drone'] = () => this.generateDrone();
    this.generators['powerup'] = () => this.generatePowerup();
    this.generators['asteroid_large'] = () => this.generateAsteroid(72);
    this.generators['asteroid_small'] = () => this.generateAsteroid(44);
    this.generators['asteroid_gold'] = () => this.generateGoldenAsteroid(56);
    this.generators['turret'] = () => this.generateTurretTexture();
    this.generators['turret_base'] = () => this.generateTurretBaseTexture();
    this.generators['turret_launcher'] = () => this.generateTurretLauncherTexture();
    this.generators['bulletTurretLaser'] = () => this.generateTurretLaser();
    this.generators['bulletIonLaser'] = () => this.generateIonLaser();
    this.generators['blast_door_top'] = () => this.generateBlastDoorTop();
    this.generators['blast_door_bottom'] = () => this.generateBlastDoorBottom();
    this.generators['blast_door_frame'] = () => this.generateBlastDoorFrame();
    this.generators['blast_door_horizontal_panel'] = () => this.generateBlastDoorHorizontalPanel();
    this.generators['blast_door_horizontal_frame'] = () => this.generateBlastDoorHorizontalFrame();
    this.generators['blast_door_horizontal_shaft'] = () => this.generateBlastDoorHorizontalShaft();
    this.generators['subboss_gatekeeper'] = () => this.generateSubbossGatekeeperTexture();
    this.generators['launchpad_deck'] = () => this.createTextureFromCanvas(drawPadDeck());
    this.generators['launchpad_arm_left'] = () => this.createTextureFromCanvas(drawServiceArm(false));
    this.generators['launchpad_arm_right'] = () => this.createTextureFromCanvas(drawServiceArm(true));
    this.generators['launchpad_tower'] = () => this.createTextureFromCanvas(drawControlTower());
    this.generators['launchpad_fuel'] = () => this.createTextureFromCanvas(drawFuelCompound());
  }

  private static createTextureFromCanvas(canvas: HTMLCanvasElement): THREE.Texture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private static generatePlayerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Flagship Arcade Interceptor (Viper / R-9 Class)
    // 1. Dark Shadow Silhouette Base
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(35, 18); // Nose needle
    ctx.lineTo(22, 11);
    ctx.lineTo(8, 2);   // Top wingtip
    ctx.lineTo(4, 8);
    ctx.lineTo(10, 13);
    ctx.lineTo(2, 13);  // Top engine
    ctx.lineTo(2, 23);  // Bottom engine
    ctx.lineTo(10, 23);
    ctx.lineTo(4, 28);
    ctx.lineTo(8, 34);  // Bottom wingtip
    ctx.lineTo(22, 25);
    ctx.closePath();
    ctx.fill();

    // 2. Swept Delta Wings (Lower Layer - Navy Slate)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(20, 18);
    ctx.lineTo(8, 4);
    ctx.lineTo(5, 8);
    ctx.lineTo(12, 14);
    ctx.lineTo(5, 28);
    ctx.lineTo(8, 32);
    ctx.lineTo(20, 18);
    ctx.fill();

    // Wing Primary Armor (Titanium White / Silver)
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.lineTo(10, 5);
    ctx.lineTo(7, 9);
    ctx.lineTo(14, 15);
    ctx.lineTo(7, 27);
    ctx.lineTo(10, 31);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.lineTo(12, 7);
    ctx.lineTo(10, 10);
    ctx.lineTo(15, 16);
    ctx.lineTo(10, 26);
    ctx.lineTo(12, 29);
    ctx.closePath();
    ctx.fill();

    // Blue Wing Decal Stripes
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(11, 8, 4, 3);
    ctx.fillRect(11, 25, 4, 3);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(12, 9, 2, 2);
    ctx.fillRect(12, 25, 2, 2);

    // Wingtip Nav Lights
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(7, 3, 2, 3);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(7, 30, 2, 3);

    // 3. Central Fuselage Body (Aerodynamic Needle)
    const hullGrad = ctx.createLinearGradient(0, 11, 0, 25);
    hullGrad.addColorStop(0, '#f8fafc');
    hullGrad.addColorStop(0.35, '#cbd5e1');
    hullGrad.addColorStop(0.7, '#64748b');
    hullGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(34, 18);
    ctx.lineTo(16, 12);
    ctx.lineTo(4, 13);
    ctx.lineTo(4, 23);
    ctx.lineTo(16, 24);
    ctx.closePath();
    ctx.fill();

    // Upper Fuselage Highlight Ridge
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(33, 18);
    ctx.lineTo(16, 13);
    ctx.lineTo(6, 14);
    ctx.lineTo(16, 15);
    ctx.closePath();
    ctx.fill();

    // Dark Panel Inset Seam
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 14); ctx.lineTo(18, 22);
    ctx.moveTo(10, 14); ctx.lineTo(10, 22);
    ctx.stroke();

    // 4. Aero Glass Cockpit Canopy (Crystalline Cyan with internal HUD reflection)
    const glassGrad = ctx.createLinearGradient(18, 14, 28, 20);
    glassGrad.addColorStop(0, '#38bdf8');
    glassGrad.addColorStop(0.4, '#0284c7');
    glassGrad.addColorStop(0.8, '#0369a1');
    glassGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(27, 18);
    ctx.lineTo(21, 14);
    ctx.lineTo(15, 14);
    ctx.lineTo(15, 22);
    ctx.lineTo(21, 22);
    ctx.closePath();
    ctx.fill();

    // Specular Canopy Glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(19, 15, 5, 2);
    ctx.fillRect(23, 16, 2, 2);

    // Cockpit HUD cross-glint
    ctx.fillStyle = '#a5f3fc';
    ctx.fillRect(17, 18, 3, 1);

    // 5. Twin Articulated Plasma Cannons (Mounted on Wing Roots)
    ctx.fillStyle = '#334155';
    ctx.fillRect(20, 8, 8, 3);
    ctx.fillRect(20, 25, 8, 3);

    // Silver Gun Barrels
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(24, 9, 8, 1.5);
    ctx.fillRect(24, 25.5, 8, 1.5);

    // Red Hot Muzzle Tips
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(31, 8.5, 2, 2);
    ctx.fillRect(31, 25.5, 2, 2);

    // 6. Dual Rocket Thruster Engine Bells (Rear)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, 13, 3, 4);
    ctx.fillRect(2, 19, 3, 4);

    ctx.fillStyle = '#f97316';
    ctx.fillRect(1, 14, 2, 2);
    ctx.fillRect(1, 20, 2, 2);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(0, 14.5, 1.5, 1);
    ctx.fillRect(0, 20.5, 1.5, 1);

    return this.createTextureFromCanvas(canvas);
  }

  private static generatePlayerGoldTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Golden Ace Royal Interceptor
    // Dark Bronze Outline Base
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(35, 18);
    ctx.lineTo(22, 11);
    ctx.lineTo(8, 2);
    ctx.lineTo(4, 8);
    ctx.lineTo(10, 13);
    ctx.lineTo(2, 13);
    ctx.lineTo(2, 23);
    ctx.lineTo(10, 23);
    ctx.lineTo(4, 28);
    ctx.lineTo(8, 34);
    ctx.lineTo(22, 25);
    ctx.closePath();
    ctx.fill();

    // Polished Gold Wings
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(20, 18);
    ctx.lineTo(8, 4);
    ctx.lineTo(5, 8);
    ctx.lineTo(12, 14);
    ctx.lineTo(5, 28);
    ctx.lineTo(8, 32);
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.lineTo(10, 5);
    ctx.lineTo(7, 9);
    ctx.lineTo(14, 15);
    ctx.lineTo(7, 27);
    ctx.lineTo(10, 31);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.lineTo(12, 7);
    ctx.lineTo(10, 10);
    ctx.lineTo(15, 16);
    ctx.lineTo(10, 26);
    ctx.lineTo(12, 29);
    ctx.fill();

    // Radiant Gold Specular Leading Edge
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(12, 6, 6, 2);
    ctx.fillRect(12, 28, 6, 2);

    // Fuselage (Radiant Gold Alloy)
    const goldGrad = ctx.createLinearGradient(0, 11, 0, 25);
    goldGrad.addColorStop(0, '#fef9c3');
    goldGrad.addColorStop(0.3, '#fde047');
    goldGrad.addColorStop(0.7, '#d97706');
    goldGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.moveTo(34, 18);
    ctx.lineTo(16, 12);
    ctx.lineTo(4, 13);
    ctx.lineTo(4, 23);
    ctx.lineTo(16, 24);
    ctx.closePath();
    ctx.fill();

    // Specular Crown Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(33, 18);
    ctx.lineTo(16, 13);
    ctx.lineTo(6, 14);
    ctx.lineTo(16, 15);
    ctx.closePath();
    ctx.fill();

    // Diamond Cyan Cockpit
    const cyanGrad = ctx.createLinearGradient(18, 14, 28, 20);
    cyanGrad.addColorStop(0, '#67e8f9');
    cyanGrad.addColorStop(0.5, '#06b6d4');
    cyanGrad.addColorStop(1, '#0e7490');
    ctx.fillStyle = cyanGrad;
    ctx.beginPath();
    ctx.moveTo(27, 18);
    ctx.lineTo(21, 14);
    ctx.lineTo(15, 14);
    ctx.lineTo(15, 22);
    ctx.lineTo(21, 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(19, 15, 5, 2);
    ctx.fillRect(23, 16, 2, 2);

    // Ruby Cannons & Chrome Coils
    ctx.fillStyle = '#b45309';
    ctx.fillRect(20, 8, 8, 3);
    ctx.fillRect(20, 25, 8, 3);

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(24, 9, 8, 1.5);
    ctx.fillRect(24, 25.5, 8, 1.5);

    ctx.fillStyle = '#e11d48';
    ctx.fillRect(31, 8.5, 2, 2);
    ctx.fillRect(31, 25.5, 2, 2);

    // Radiant Gold Thrusters
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(1, 14, 3, 2);
    ctx.fillRect(1, 20, 3, 2);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(0, 14.5, 2, 1);
    ctx.fillRect(0, 20.5, 2, 1);

    return this.createTextureFromCanvas(canvas);
  }

  private static generatePlayerStealthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Nightshade Stealth Interceptor (Matte Carbon & Neon Violet)
    // Dark Void Base
    ctx.fillStyle = '#050508';
    ctx.beginPath();
    ctx.moveTo(35, 18);
    ctx.lineTo(18, 5);
    ctx.lineTo(4, 2);
    ctx.lineTo(8, 14);
    ctx.lineTo(2, 14);
    ctx.lineTo(2, 22);
    ctx.lineTo(8, 22);
    ctx.lineTo(4, 34);
    ctx.lineTo(18, 31);
    ctx.closePath();
    ctx.fill();

    // Carbon Fiber Wing Panels
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(17, 7);
    ctx.lineTo(6, 4);
    ctx.lineTo(9, 15);
    ctx.lineTo(6, 32);
    ctx.lineTo(17, 29);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.moveTo(30, 18);
    ctx.lineTo(17, 9);
    ctx.lineTo(8, 6);
    ctx.lineTo(12, 16);
    ctx.lineTo(8, 30);
    ctx.lineTo(17, 27);
    ctx.closePath();
    ctx.fill();

    // Violet Energized Hull Inset Conduits
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 18); ctx.lineTo(14, 8);
    ctx.moveTo(30, 18); ctx.lineTo(14, 28);
    ctx.stroke();

    // Fuselage (Faceted Stealth Diamond)
    const stealthGrad = ctx.createLinearGradient(0, 12, 0, 24);
    stealthGrad.addColorStop(0, '#3f3f46');
    stealthGrad.addColorStop(0.5, '#18181b');
    stealthGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = stealthGrad;
    ctx.beginPath();
    ctx.moveTo(34, 18);
    ctx.lineTo(18, 12);
    ctx.lineTo(4, 14);
    ctx.lineTo(4, 22);
    ctx.lineTo(18, 24);
    ctx.closePath();
    ctx.fill();

    // Violet Smoked Visor Canopy
    const visorGrad = ctx.createLinearGradient(16, 14, 26, 20);
    visorGrad.addColorStop(0, '#e879f9');
    visorGrad.addColorStop(0.4, '#a855f7');
    visorGrad.addColorStop(1, '#3b0764');
    ctx.fillStyle = visorGrad;
    ctx.beginPath();
    ctx.moveTo(26, 18);
    ctx.lineTo(20, 14);
    ctx.lineTo(14, 14);
    ctx.lineTo(14, 22);
    ctx.lineTo(20, 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f5d0fe';
    ctx.fillRect(18, 15, 4, 1.5);

    // Concealed Twin Pulse Cannons
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(26, 10, 6, 2);
    ctx.fillRect(26, 24, 6, 2);
    ctx.fillStyle = '#f0abfc';
    ctx.fillRect(30, 10.5, 2, 1);
    ctx.fillRect(30, 24.5, 2, 1);

    // Antimatter Violet Thrusters
    ctx.fillStyle = '#a21caf';
    ctx.fillRect(1, 15, 3, 2);
    ctx.fillRect(1, 19, 3, 2);
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(0, 15.5, 2, 1);
    ctx.fillRect(0, 19.5, 2, 1);

    return this.createTextureFromCanvas(canvas);
  }

  private static generatePlayerDreadnoughtTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Heavy Dreadnought Battlecruiser (Titanium Armor & Tri-Beam Battery)
    // Dark Silhouette Base
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(46, 24);
    ctx.lineTo(32, 8);
    ctx.lineTo(12, 4);
    ctx.lineTo(4, 10);
    ctx.lineTo(2, 20);
    ctx.lineTo(2, 28);
    ctx.lineTo(4, 38);
    ctx.lineTo(12, 44);
    ctx.lineTo(32, 40);
    ctx.closePath();
    ctx.fill();

    // Heavy Plating (Dark Steel Chassis)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(6, 8, 32, 32);

    ctx.fillStyle = '#334155';
    ctx.fillRect(8, 10, 28, 28);

    // Top & Bottom Heavy Wing Armor
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(34, 10);
    ctx.lineTo(14, 6);
    ctx.lineTo(8, 12);
    ctx.lineTo(30, 16);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(34, 38);
    ctx.lineTo(14, 42);
    ctx.lineTo(8, 36);
    ctx.lineTo(30, 32);
    ctx.closePath();
    ctx.fill();

    // Hazard Stripes on Armor Flanks
    ctx.fillStyle = '#eab308';
    ctx.fillRect(12, 11, 4, 3);
    ctx.fillRect(20, 11, 4, 3);
    ctx.fillRect(12, 34, 4, 3);
    ctx.fillRect(20, 34, 4, 3);

    // Center Heavy Hull Core
    const coreGrad = ctx.createLinearGradient(0, 16, 0, 32);
    coreGrad.addColorStop(0, '#94a3b8');
    coreGrad.addColorStop(0.5, '#475569');
    coreGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(44, 24);
    ctx.lineTo(34, 16);
    ctx.lineTo(10, 16);
    ctx.lineTo(10, 32);
    ctx.lineTo(34, 32);
    ctx.closePath();
    ctx.fill();

    // Rivets & Armor Seams
    ctx.fillStyle = '#cbd5e1';
    for (let x = 14; x <= 30; x += 6) {
      ctx.fillRect(x, 17, 2, 2);
      ctx.fillRect(x, 29, 2, 2);
    }

    // Heavy Command Bridge Canopies (Dual Amber Optic Glass)
    const bridgeGrad = ctx.createLinearGradient(24, 20, 34, 26);
    bridgeGrad.addColorStop(0, '#fef08a');
    bridgeGrad.addColorStop(0.4, '#f59e0b');
    bridgeGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = bridgeGrad;
    ctx.fillRect(26, 21, 10, 6);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, 22, 4, 2);

    // Tri-Beam Heavy Cannons (Top, Center, Bottom)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(32, 6, 12, 4);
    ctx.fillRect(36, 22, 10, 4);
    ctx.fillRect(32, 38, 12, 4);

    // Glowing Green Emitter Nodes
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(42, 7, 3, 2);
    ctx.fillRect(44, 23, 3, 2);
    ctx.fillRect(42, 39, 3, 2);
    ctx.fillStyle = '#86efac';
    ctx.fillRect(43, 7.5, 1.5, 1);
    ctx.fillRect(45, 23.5, 1.5, 1);
    ctx.fillRect(43, 39.5, 1.5, 1);

    // Quad Heavy Thrust Engines (Rear)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, 11, 4, 5);
    ctx.fillRect(2, 18, 4, 5);
    ctx.fillRect(2, 25, 4, 5);
    ctx.fillRect(2, 32, 4, 5);

    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, 12, 3, 3);
    ctx.fillRect(0, 19, 3, 3);
    ctx.fillRect(0, 26, 3, 3);
    ctx.fillRect(0, 33, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 13, 1.5, 1);
    ctx.fillRect(0, 20, 1.5, 1);
    ctx.fillRect(0, 27, 1.5, 1);
    ctx.fillRect(0, 34, 1.5, 1);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyScoutTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;

    // 16-bit NeoGeo / Late 80s Arcade Red Fighter
    // Dark outline
    ctx.fillStyle = '#1a0307';
    ctx.beginPath();
    ctx.moveTo(34, 18);
    ctx.lineTo(8, 2);
    ctx.lineTo(2, 8);
    ctx.lineTo(12, 18);
    ctx.lineTo(2, 28);
    ctx.lineTo(8, 34);
    ctx.closePath();
    ctx.fill();

    // Deep Shadow Base
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(9, 4);
    ctx.lineTo(4, 9);
    ctx.lineTo(12, 18);
    ctx.lineTo(4, 27);
    ctx.lineTo(9, 32);
    ctx.closePath();
    ctx.fill();

    // Main Crimson Hull
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(32, 18);
    ctx.lineTo(11, 6);
    ctx.lineTo(6, 11);
    ctx.lineTo(14, 18);
    ctx.lineTo(6, 25);
    ctx.lineTo(11, 30);
    ctx.closePath();
    ctx.fill();

    // Bright Scarlet Upper Armor Plates
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(30, 18);
    ctx.lineTo(14, 8);
    ctx.lineTo(18, 14);
    ctx.lineTo(26, 18);
    ctx.lineTo(18, 22);
    ctx.lineTo(14, 28);
    ctx.closePath();
    ctx.fill();

    // Specular Highlight Ridge
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(16, 10, 10, 2);
    ctx.fillRect(16, 24, 10, 2);
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(22, 17, 6, 2);

    // Dithered panel shading on lower wing
    ctx.fillStyle = '#7f1d1d';
    for (let x = 8; x <= 20; x += 4) {
      ctx.fillRect(x, 24, 2, 2);
    }

    // Canopy (Golden Amber with Glass Glint)
    ctx.fillStyle = '#d97706';
    ctx.fillRect(18, 16, 8, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(20, 17, 5, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(23, 17, 2, 1);

    // Wingtip Gun Pods (Slate & Muzzle Tip)
    ctx.fillStyle = '#334155';
    ctx.fillRect(2, 6, 12, 3);
    ctx.fillRect(2, 27, 12, 3);
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(0, 7, 3, 1);
    ctx.fillRect(0, 28, 3, 1);

    // Rear Thrusters with Blue Jet Glow
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, 13, 4, 10);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, 15, 2, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 17, 1, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyHeavyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 68;
    canvas.height = 68;
    const ctx = canvas.getContext('2d')!;

    // NeoGeo Powerhouse Gunship
    // Dark silhouette outline
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(10, 34); // Nose
    ctx.lineTo(34, 6);   // Top wing tip
    ctx.lineTo(58, 6);   // Top back
    ctx.lineTo(48, 34);  // Center back
    ctx.lineTo(58, 62);  // Bottom back
    ctx.lineTo(34, 62);  // Bottom wing tip
    ctx.closePath();
    ctx.fill();

    // Dark Steel Inner Body
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(12, 34);
    ctx.lineTo(34, 8);
    ctx.lineTo(56, 8);
    ctx.lineTo(46, 34);
    ctx.lineTo(56, 60);
    ctx.lineTo(34, 60);
    ctx.closePath();
    ctx.fill();

    // Armor Plates (Slate Grey / Steel)
    ctx.fillStyle = '#334155';
    ctx.fillRect(20, 12, 28, 16);
    ctx.fillRect(20, 40, 28, 16);

    // Deep Crimson Heavy Armor Plating
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(22, 34);
    ctx.lineTo(38, 14);
    ctx.lineTo(48, 14);
    ctx.lineTo(40, 34);
    ctx.lineTo(48, 54);
    ctx.lineTo(38, 54);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(24, 34);
    ctx.lineTo(38, 18);
    ctx.lineTo(44, 18);
    ctx.lineTo(38, 34);
    ctx.lineTo(44, 50);
    ctx.lineTo(38, 50);
    ctx.closePath();
    ctx.fill();

    // Crimson Highlight
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(30, 20, 10, 2);
    ctx.fillRect(30, 46, 10, 2);

    // Dithered shading along bottom wings
    ctx.fillStyle = '#0f172a';
    for (let x = 24; x <= 50; x += 4) {
      ctx.fillRect(x, 52, 2, 2);
    }

    // Hazard Stripes on Rear Armor
    ctx.fillStyle = '#18181b';
    ctx.fillRect(44, 22, 10, 24);
    ctx.fillStyle = '#f59e0b';
    for (let y = 24; y < 44; y += 6) {
      ctx.fillRect(44, y, 10, 3);
    }

    // Quad Heavy Guns (Top 2, Bottom 2) with Silver Barrels & Heat Vents
    ctx.fillStyle = '#475569';
    ctx.fillRect(4, 12, 24, 6);
    ctx.fillRect(4, 50, 24, 6);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(4, 13, 22, 2);
    ctx.fillRect(4, 51, 22, 2);

    // Glowing Laser Barrels
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(0, 13, 5, 4);
    ctx.fillRect(0, 51, 5, 4);
    ctx.fillStyle = '#ff9999';
    ctx.fillRect(0, 14, 3, 2);
    ctx.fillRect(0, 52, 3, 2);

    // Central Reactor Core (Glowing Cyan Energy Matrix)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(32, 34, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(32, 34, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(30, 32, 4, 4);

    // Engine Thruster Exhaust Plumes (Dual Blue & White)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(48, 34);
    ctx.lineTo(66, 24);
    ctx.lineTo(60, 34);
    ctx.lineTo(66, 44);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(48, 34);
    ctx.lineTo(58, 28);
    ctx.lineTo(54, 34);
    ctx.lineTo(58, 40);
    ctx.closePath();
    ctx.fill();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyInterceptorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 44;
    canvas.height = 44;
    const ctx = canvas.getContext('2d')!;

    // Sleek 16-bit Cyber Interceptor
    // Dark Navy Outline
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.moveTo(42, 22);
    ctx.lineTo(4, 2);
    ctx.lineTo(10, 12);
    ctx.lineTo(2, 22);
    ctx.lineTo(10, 32);
    ctx.lineTo(4, 42);
    ctx.closePath();
    ctx.fill();

    // Base Cobalt Body
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(40, 22);
    ctx.lineTo(6, 4);
    ctx.lineTo(12, 14);
    ctx.lineTo(4, 22);
    ctx.lineTo(12, 30);
    ctx.lineTo(6, 40);
    ctx.closePath();
    ctx.fill();

    // Upper Cyan Wings & Plates
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(38, 22);
    ctx.lineTo(10, 8);
    ctx.lineTo(16, 16);
    ctx.lineTo(28, 22);
    ctx.lineTo(16, 28);
    ctx.lineTo(10, 36);
    ctx.closePath();
    ctx.fill();

    // Electric Cyan Highlights
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(18, 10, 12, 3);
    ctx.fillRect(18, 31, 12, 3);
    ctx.fillStyle = '#a5f3fc';
    ctx.fillRect(24, 11, 8, 1);
    ctx.fillRect(24, 32, 8, 1);

    // Dithered 16-bit shading on bottom wing
    ctx.fillStyle = '#0f172a';
    for (let x = 12; x <= 26; x += 4) {
      ctx.fillRect(x, 34, 2, 2);
    }

    // Amber/Gold Visor Cockpit
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(20, 20, 12, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(24, 21, 6, 2);

    // Engine Intakes with Heat Grid
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(10, 18, 4, 8);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(10, 21, 2, 2);

    // Plasma Emitter Nose Tip
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(38, 21, 4, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemySniperTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    // Stealth Purple Railgun Sniper Craft
    // Obsidian Outline
    ctx.fillStyle = '#090514';
    ctx.beginPath();
    ctx.moveTo(46, 24);
    ctx.lineTo(24, 2);
    ctx.lineTo(2, 24);
    ctx.lineTo(24, 46);
    ctx.closePath();
    ctx.fill();

    // Deep Purple Shadow Base
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.moveTo(44, 24);
    ctx.lineTo(24, 4);
    ctx.lineTo(4, 24);
    ctx.lineTo(24, 44);
    ctx.closePath();
    ctx.fill();

    // Royal Purple Armor
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.moveTo(42, 24);
    ctx.lineTo(24, 8);
    ctx.lineTo(8, 24);
    ctx.lineTo(24, 40);
    ctx.closePath();
    ctx.fill();

    // Bright Violet Facet
    ctx.fillStyle = '#9333ea';
    ctx.beginPath();
    ctx.moveTo(40, 24);
    ctx.lineTo(24, 12);
    ctx.lineTo(16, 24);
    ctx.closePath();
    ctx.fill();

    // Specular Highlight
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(26, 14, 10, 2);

    // Dithered shading on lower facet
    ctx.fillStyle = '#1e1b4b';
    for (let x = 12; x <= 32; x += 4) {
      ctx.fillRect(x, 32, 2, 2);
    }

    // Central Extended Railgun Barrel & Magnetic Rings
    ctx.fillStyle = '#475569';
    ctx.fillRect(18, 22, 28, 4);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(18, 23, 28, 2);

    // Gold Accelerator Rings
    ctx.fillStyle = '#eab308';
    ctx.fillRect(26, 20, 3, 8);
    ctx.fillRect(34, 20, 3, 8);
    ctx.fillRect(42, 20, 3, 8);

    // Large Targeting Optic Sensor Eye
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(20, 24, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(20, 24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(19, 23, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, 22, 2, 2);

    // Red Target Reticle Crosshair
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 16); ctx.lineTo(20, 32);
    ctx.moveTo(12, 24); ctx.lineTo(28, 24);
    ctx.stroke();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateSubBossTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit NeoGeo Heavy Command Gunship Sub-Boss
    // Dark Steel Outline
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(14, 48); // Nose
    ctx.lineTo(48, 12); // Top wing tip
    ctx.lineTo(84, 12); // Top rear
    ctx.lineTo(68, 48); // Center rear
    ctx.lineTo(84, 84); // Bottom rear
    ctx.lineTo(48, 84); // Bottom wing tip
    ctx.closePath();
    ctx.fill();

    // Main Steel Hull
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(16, 48);
    ctx.lineTo(48, 14);
    ctx.lineTo(82, 14);
    ctx.lineTo(66, 48);
    ctx.lineTo(82, 82);
    ctx.lineTo(48, 82);
    ctx.closePath();
    ctx.fill();

    // Medium Steel Armor Plates
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(26, 48);
    ctx.lineTo(50, 22);
    ctx.lineTo(76, 22);
    ctx.lineTo(58, 48);
    ctx.lineTo(76, 74);
    ctx.lineTo(50, 74);
    ctx.closePath();
    ctx.fill();

    // Light Steel Panels & Rivets
    ctx.fillStyle = '#475569';
    ctx.fillRect(36, 28, 32, 12);
    ctx.fillRect(36, 56, 32, 12);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(38, 30, 28, 2);
    ctx.fillRect(38, 58, 28, 2);

    // Rivets
    ctx.fillStyle = '#cbd5e1';
    for (let x = 40; x <= 64; x += 8) {
      ctx.fillRect(x, 34, 2, 2);
      ctx.fillRect(x, 62, 2, 2);
    }

    // Dithered Shading on Lower Wings
    ctx.fillStyle = '#0f172a';
    for (let x = 30; x <= 70; x += 4) {
      for (let y = 68; y <= 78; y += 4) {
        if ((x + y) % 8 === 0) ctx.fillRect(x, y, 2, 2);
      }
    }

    // Triple Heavy Cannon Barrels (Top, Center, Bottom)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(6, 18, 36, 8);
    ctx.fillRect(6, 70, 36, 8);
    ctx.fillRect(2, 44, 28, 8);

    ctx.fillStyle = '#64748b';
    ctx.fillRect(6, 20, 34, 4);
    ctx.fillRect(6, 72, 34, 4);
    ctx.fillRect(2, 46, 26, 4);

    // Laser Muzzle Glow
    ctx.fillStyle = '#ff0033';
    ctx.fillRect(0, 19, 6, 6);
    ctx.fillRect(0, 71, 6, 6);
    ctx.fillRect(0, 45, 4, 6);

    // Hyper-Reactor Matrix (Glowing Cyan Core)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(58, 48, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(58, 48, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(56, 46, 4, 0, Math.PI * 2);
    ctx.fill();

    // Thruster Flames
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(66, 48);
    ctx.lineTo(92, 34);
    ctx.lineTo(82, 48);
    ctx.lineTo(92, 62);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(66, 48);
    ctx.lineTo(84, 38);
    ctx.lineTo(76, 48);
    ctx.lineTo(84, 58);
    ctx.closePath();
    ctx.fill();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBossTexture(type: number = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    if (type === 1) {
      // Stage 1 Boss: MECHA DREADNOUGHT (Heavy Armored Assault Fortress)
      // 1. Dark Base Silhouette
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.moveTo(12, 64);   // Front ram prow
      ctx.lineTo(36, 16);   // Top diagonal
      ctx.lineTo(96, 12);   // Top back
      ctx.lineTo(120, 36);  // Top thruster
      ctx.lineTo(108, 64);  // Rear center
      ctx.lineTo(120, 92);  // Bottom thruster
      ctx.lineTo(96, 116);  // Bottom back
      ctx.lineTo(36, 112);  // Bottom diagonal
      ctx.closePath();
      ctx.fill();

      // 2. Heavy Gunmetal Hull Frame
      const hullGrad = ctx.createLinearGradient(0, 20, 0, 108);
      hullGrad.addColorStop(0, '#475569');
      hullGrad.addColorStop(0.5, '#1e293b');
      hullGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.moveTo(16, 64);
      ctx.lineTo(38, 20);
      ctx.lineTo(92, 16);
      ctx.lineTo(114, 40);
      ctx.lineTo(102, 64);
      ctx.lineTo(114, 88);
      ctx.lineTo(92, 112);
      ctx.lineTo(38, 108);
      ctx.closePath();
      ctx.fill();

      // 3. Top & Bottom Heavy Reinforced Blast Armor
      ctx.fillStyle = '#334155';
      ctx.fillRect(36, 24, 56, 20);
      ctx.fillRect(36, 84, 56, 20);

      ctx.fillStyle = '#64748b';
      ctx.fillRect(40, 26, 48, 6);
      ctx.fillRect(40, 96, 48, 6);

      // Hazard Caution Stripes on Armor Flanks
      ctx.fillStyle = '#eab308';
      for (let x = 44; x <= 80; x += 12) {
        ctx.fillRect(x, 34, 5, 8);
        ctx.fillRect(x, 86, 5, 8);
      }

      // 4. Exposed Hydraulic Pipes & Power Cables
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(30, 48); ctx.lineTo(60, 44); ctx.lineTo(90, 48);
      ctx.moveTo(30, 80); ctx.lineTo(60, 84); ctx.lineTo(90, 80);
      ctx.stroke();

      // 5. Heavy Twin Kinetic Cannon Batteries (Top & Bottom Fore)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(4, 38, 30, 8);
      ctx.fillRect(4, 82, 30, 8);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(2, 40, 26, 4);
      ctx.fillRect(2, 84, 26, 4);

      // Red Hot Cannon Muzzles
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, 39, 4, 6);
      ctx.fillRect(0, 83, 4, 6);

      // 6. Central Heavy Cyclops Hyper-Reactor Core
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(60, 64, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 64, 22, 0, Math.PI * 2);
      ctx.stroke();

      // Crimson Energy Core
      const coreGrad = ctx.createRadialGradient(58, 62, 2, 60, 64, 18);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#fef08a');
      coreGrad.addColorStop(0.6, '#ef4444');
      coreGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(60, 64, 18, 0, Math.PI * 2);
      ctx.fill();

      // 7. Quad Heavy Thrust Engines (Rear)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(106, 28, 16, 14);
      ctx.fillRect(106, 86, 16, 14);

      ctx.fillStyle = '#f97316';
      ctx.fillRect(116, 31, 8, 8);
      ctx.fillRect(116, 89, 8, 8);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(118, 33, 4, 4);
      ctx.fillRect(118, 91, 4, 4);
    } else if (type === 2) {
      // Stage 2 Boss: CYBER CORE (Assault Command Fortress)
      // 1. Dark Silhouette Outline
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.moveTo(14, 64);   // Front nose ram
      ctx.lineTo(46, 20);   // Top forward fin
      ctx.lineTo(92, 14);   // Top deck
      ctx.lineTo(118, 38);  // Top thruster pod
      ctx.lineTo(104, 64);  // Rear center
      ctx.lineTo(118, 90);  // Bottom thruster pod
      ctx.lineTo(92, 114);  // Bottom deck
      ctx.lineTo(46, 108);  // Bottom forward fin
      ctx.closePath();
      ctx.fill();

      // 2. Heavy Gunmetal Hull Frame
      const hullGrad = ctx.createLinearGradient(0, 18, 0, 110);
      hullGrad.addColorStop(0, '#334155');
      hullGrad.addColorStop(0.5, '#1e293b');
      hullGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.moveTo(18, 64);
      ctx.lineTo(48, 24);
      ctx.lineTo(88, 18);
      ctx.lineTo(112, 40);
      ctx.lineTo(100, 64);
      ctx.lineTo(112, 88);
      ctx.lineTo(88, 110);
      ctx.lineTo(48, 104);
      ctx.closePath();
      ctx.fill();

      // 3. Reinforced Cobalt Armor Plates & Hazard Striping
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(36, 28, 48, 18);
      ctx.fillRect(36, 82, 48, 18);

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(38, 30, 44, 4);
      ctx.fillRect(38, 94, 44, 4);

      // Hazard Stripes
      ctx.fillStyle = '#eab308';
      for (let x = 44; x <= 74; x += 10) {
        ctx.fillRect(x, 36, 4, 8);
        ctx.fillRect(x, 84, 4, 8);
      }

      // 4. Quad Kinetic Railguns & Heavy Gun Barrels
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 46, 28, 6);
      ctx.fillRect(6, 76, 28, 6);
      ctx.fillRect(20, 20, 24, 6);
      ctx.fillRect(20, 102, 24, 6);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(4, 47, 26, 4);
      ctx.fillRect(4, 77, 26, 4);
      ctx.fillRect(18, 21, 22, 4);
      ctx.fillRect(18, 103, 22, 4);

      // Glowing Cyan Rail Muzzle Tips
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(0, 46, 4, 6);
      ctx.fillRect(0, 76, 4, 6);
      ctx.fillRect(14, 20, 4, 6);
      ctx.fillRect(14, 102, 4, 6);

      // 5. Central Cyber Core Matrix (Multi-Ring Pulsing Energy Reactor)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(62, 64, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(62, 64, 20, 0, Math.PI * 2);
      ctx.stroke();

      const coreGrad = ctx.createRadialGradient(60, 62, 2, 62, 64, 16);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#67e8f9');
      coreGrad.addColorStop(0.7, '#06b6d4');
      coreGrad.addColorStop(1, '#083344');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(62, 64, 16, 0, Math.PI * 2);
      ctx.fill();

      // Specular Glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(58, 60, 4, 0, Math.PI * 2);
      ctx.fill();

      // 6. Dual Plasma Thrust Engines (Rear)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(104, 32, 18, 14);
      ctx.fillRect(104, 82, 18, 14);

      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(116, 35, 8, 8);
      ctx.fillRect(116, 85, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(118, 37, 4, 4);
      ctx.fillRect(118, 87, 4, 4);
    } else if (type === 3) {
      // Stage 3 Boss: SOLAR DOCK OVERLORD (Orbital Solar Docking Array Fort)
      // 1. Dark Base Frame
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.moveTo(10, 64);
      ctx.lineTo(40, 24);
      ctx.lineTo(104, 24);
      ctx.lineTo(122, 64);
      ctx.lineTo(104, 104);
      ctx.lineTo(40, 104);
      ctx.closePath();
      ctx.fill();

      // 2. High-Efficiency Photovoltaic Solar Wings (Top & Bottom Arrays)
      ctx.fillStyle = '#075985';
      ctx.fillRect(16, 6, 96, 18);
      ctx.fillRect(16, 104, 96, 18);

      // Gold Framework Grid
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 6, 96, 18);
      ctx.strokeRect(16, 104, 96, 18);

      for (let x = 28; x < 108; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x, 24);
        ctx.moveTo(x, 104);
        ctx.lineTo(x, 122);
        ctx.stroke();
      }

      // 3. Central Fortress Hull (Reinforced Gold & Slate Armor)
      const fortGrad = ctx.createLinearGradient(0, 26, 0, 102);
      fortGrad.addColorStop(0, '#475569');
      fortGrad.addColorStop(0.5, '#1e293b');
      fortGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = fortGrad;
      ctx.beginPath();
      ctx.moveTo(14, 64);
      ctx.lineTo(42, 28);
      ctx.lineTo(100, 28);
      ctx.lineTo(116, 64);
      ctx.lineTo(100, 100);
      ctx.lineTo(42, 100);
      ctx.closePath();
      ctx.fill();

      // Gold Trim Bulkheads
      ctx.fillStyle = '#b45309';
      ctx.fillRect(36, 34, 56, 10);
      ctx.fillRect(36, 84, 56, 10);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(38, 36, 52, 4);
      ctx.fillRect(38, 88, 52, 4);

      // 4. Central Solar Siphon Core (Glowing Amber / Gold Star Core)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(64, 64, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 64, 22, 0, Math.PI * 2);
      ctx.stroke();

      const sunGrad = ctx.createRadialGradient(62, 62, 2, 64, 64, 18);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.3, '#fef08a');
      sunGrad.addColorStop(0.6, '#f59e0b');
      sunGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(64, 64, 18, 0, Math.PI * 2);
      ctx.fill();

      // 5. Heavy Twin Solar-Charged Cannons
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 48, 32, 8);
      ctx.fillRect(6, 72, 32, 8);

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(4, 50, 30, 4);
      ctx.fillRect(4, 74, 30, 4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 49, 4, 6);
      ctx.fillRect(0, 73, 4, 6);
    } else if (type === 4) {
      // Stage 4 Boss: VOID LEVIATHAN (16-Bit Biomechanical Dread Beast)
      // 1. Dark Chitin Silhouette
      ctx.fillStyle = '#0f051d';
      ctx.beginPath();
      ctx.moveTo(8, 64);    // Front mandible mouth
      ctx.lineTo(28, 18);   // Top blade wing
      ctx.lineTo(54, 8);
      ctx.lineTo(116, 24);  // Top tentacle
      ctx.lineTo(92, 64);   // Core tail
      ctx.lineTo(116, 104); // Bottom tentacle
      ctx.lineTo(54, 120);
      ctx.lineTo(28, 110);
      ctx.closePath();
      ctx.fill();

      // 2. Chitin Carapace Plates (Deep Void Purple & Obsidian)
      const voidGrad = ctx.createLinearGradient(0, 14, 0, 114);
      voidGrad.addColorStop(0, '#7e22ce');
      voidGrad.addColorStop(0.5, '#3b0764');
      voidGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = voidGrad;
      ctx.beginPath();
      ctx.moveTo(14, 64);
      ctx.lineTo(32, 24);
      ctx.lineTo(56, 14);
      ctx.lineTo(108, 30);
      ctx.lineTo(86, 64);
      ctx.lineTo(108, 98);
      ctx.lineTo(56, 114);
      ctx.lineTo(32, 104);
      ctx.closePath();
      ctx.fill();

      // 3. Chitinous Armor Ridges & Spikes
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(40, 28); ctx.lineTo(20, 10); ctx.lineTo(50, 20); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(70, 24); ctx.lineTo(50, 4);  ctx.lineTo(80, 18); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(40, 100); ctx.lineTo(20, 118); ctx.lineTo(50, 108); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(70, 104); ctx.lineTo(50, 124); ctx.lineTo(80, 110); ctx.fill();

      // 4. Exposed Bio-Vascular Muscle Core (Crimson / Violet)
      ctx.fillStyle = '#9d174d';
      ctx.beginPath();
      ctx.ellipse(54, 64, 22, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.ellipse(50, 64, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // 5. Menacing Alien Mandibles (Front)
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(8, 48); ctx.lineTo(26, 56); ctx.lineTo(22, 44); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, 80); ctx.lineTo(26, 72); ctx.lineTo(22, 84); ctx.closePath(); ctx.fill();

      // 6. Multi-Cluster Bioluminescent Optic Eyes (Bright Yellow & Crimson)
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(36, 52, 6, 0, Math.PI * 2);
      ctx.arc(36, 76, 6, 0, Math.PI * 2);
      ctx.arc(48, 64, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(34, 50, 2.5, 0, Math.PI * 2);
      ctx.arc(34, 74, 2.5, 0, Math.PI * 2);
      ctx.arc(46, 62, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 7. Acidic Bio-Plasma Siphon Vents (Top & Bottom)
      ctx.fillStyle = '#10b981';
      ctx.fillRect(80, 36, 12, 4);
      ctx.fillRect(80, 88, 12, 4);
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(82, 37, 8, 2);
      ctx.fillRect(82, 89, 8, 2);
    } else {
      // Stage 5 Final Boss: MOTHER BRAIN OVERLORD (Biomechanical Cyber-Neural Core)
      // 1. Heavy Armored Containment Chassis (Octagonal Cage)
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fill();

      // Titanium Structural Cage Ribs
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, 100, 100);

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Glass Bio-Containment Cylinder (Glint & Fluid)
      const fluidGrad = ctx.createRadialGradient(64, 64, 10, 64, 64, 48);
      fluidGrad.addColorStop(0, '#be185d');
      fluidGrad.addColorStop(0.6, '#831843');
      fluidGrad.addColorStop(1, '#500724');
      ctx.fillStyle = fluidGrad;
      ctx.beginPath();
      ctx.arc(64, 64, 46, 0, Math.PI * 2);
      ctx.fill();

      // 3. Convoluted Cerebral Gyri (16-Bit Detailed Brain Folds)
      const brainLobes = [
        { x: 50, y: 48, r: 16 }, { x: 78, y: 48, r: 16 },
        { x: 44, y: 64, r: 15 }, { x: 84, y: 64, r: 15 },
        { x: 52, y: 80, r: 16 }, { x: 76, y: 80, r: 16 },
        { x: 64, y: 64, r: 18 }
      ];

      ctx.fillStyle = '#f43f5e';
      for (const lobe of brainLobes) {
        ctx.beginPath();
        ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#fda4af';
      for (const lobe of brainLobes) {
        ctx.beginPath();
        ctx.arc(lobe.x - 2, lobe.y - 2, lobe.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brain Synaptic Sulci / Wrinkles
      ctx.strokeStyle = '#881337';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8);
        ctx.lineTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36);
        ctx.stroke();
      }

      // 4. Central Cybernetic Master Optic Eye (Bionic Emerald Core)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(58, 64, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(58, 64, 16, 0, Math.PI * 2);
      ctx.stroke();

      const eyeGrad = ctx.createRadialGradient(56, 62, 2, 58, 64, 14);
      eyeGrad.addColorStop(0, '#ffffff');
      eyeGrad.addColorStop(0.3, '#34d399');
      eyeGrad.addColorStop(0.7, '#059669');
      eyeGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = eyeGrad;
      ctx.beginPath();
      ctx.arc(58, 64, 13, 0, Math.PI * 2);
      ctx.fill();

      // Specular Eye Reflection
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(54, 60, 4, 0, Math.PI * 2);
      ctx.fill();

      // 5. Heavy Neural Interlink Conduits & High-Voltage Cables
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.39;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
        ctx.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60);
        ctx.stroke();
      }

      // Glass specular reflection highlight across dome
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 64, 44, Math.PI * 1.05, Math.PI * 1.45);
      ctx.stroke();
    }

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyBioDroneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d')!;

    // Biomechanical Alien Parasite / Drone (R-Type / Gradius style)
    // Dark Chitin Outline
    ctx.fillStyle = '#022c22';
    ctx.beginPath();
    ctx.ellipse(18, 18, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep Emerald Bio-Shell
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.ellipse(18, 18, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jade Chitin Plates
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.ellipse(16, 16, 12, 8, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Vibrant Lime Ridge Highlights
    ctx.fillStyle = '#10b981';
    ctx.fillRect(8, 12, 12, 2);
    ctx.fillRect(8, 20, 10, 2);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(10, 13, 6, 1);

    // Dithered organic shading on lower sac
    ctx.fillStyle = '#022c22';
    for (let x = 12; x <= 24; x += 4) {
      ctx.fillRect(x, 22, 2, 2);
    }

    // Glowing Multi-Optic Alien Eyes (Amber / Green)
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(10, 13, 3, 0, Math.PI * 2);
    ctx.arc(10, 21, 3, 0, Math.PI * 2);
    ctx.arc(14, 17, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(9, 12, 1.5, 0, Math.PI * 2);
    ctx.arc(9, 20, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Acidic Tail / Tendril Fins with Glowing Tips
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 8);
    ctx.lineTo(35, 3);
    ctx.moveTo(30, 28);
    ctx.lineTo(35, 33);
    ctx.stroke();

    ctx.fillStyle = '#a3e635';
    ctx.fillRect(34, 2, 2, 2);
    ctx.fillRect(34, 32, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyBioStalkerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    // Organic Crimson & Purple Mantis Hunter
    // Dark Outline
    ctx.fillStyle = '#2e0219';
    ctx.beginPath();
    ctx.moveTo(6, 24);
    ctx.lineTo(38, 4);
    ctx.lineTo(46, 24);
    ctx.lineTo(38, 44);
    ctx.closePath();
    ctx.fill();

    // Deep Plum Shell Base
    ctx.fillStyle = '#701a75';
    ctx.beginPath();
    ctx.moveTo(8, 24);
    ctx.lineTo(36, 6);
    ctx.lineTo(44, 24);
    ctx.lineTo(36, 42);
    ctx.closePath();
    ctx.fill();

    // Crimson Carapace Plates
    ctx.fillStyle = '#9f1239';
    ctx.beginPath();
    ctx.moveTo(12, 24);
    ctx.lineTo(34, 10);
    ctx.lineTo(40, 24);
    ctx.lineTo(34, 38);
    ctx.closePath();
    ctx.fill();

    // Vibrant Magenta Highlight Ridge
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(20, 14, 12, 3);
    ctx.fillRect(20, 31, 12, 3);
    ctx.fillStyle = '#fda4af';
    ctx.fillRect(24, 15, 6, 1);

    // Dithered Shading on Lower Mantis Wing
    ctx.fillStyle = '#4c0519';
    for (let x = 18; x <= 34; x += 4) {
      ctx.fillRect(x, 34, 2, 2);
    }

    // Razor Pincer Blades (Bio-Metallic Sheen)
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 24); ctx.lineTo(2, 10);
    ctx.moveTo(10, 24); ctx.lineTo(2, 38);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 23); ctx.lineTo(3, 11);
    ctx.stroke();

    // Central Bioluminescent Optic Core
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(22, 24, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(20, 24, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(19, 23, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyBioBehemothTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 72;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    // Biomechanical Heavy Fortress (16-bit R-Type / Metroid style)
    // Dark Exoskeleton Silhouette
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(36, 36, 34, 0, Math.PI * 2);
    ctx.fill();

    // Deep Violet Carapace
    ctx.fillStyle = '#3b0764';
    ctx.beginPath();
    ctx.arc(36, 36, 31, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Bio Armor Plates
    ctx.fillStyle = '#6b21a8';
    ctx.fillRect(16, 12, 40, 48);

    // Exposed Muscular Core Tissue (Crimson / Magenta)
    ctx.fillStyle = '#9d174d';
    ctx.beginPath();
    ctx.ellipse(30, 36, 12, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.ellipse(28, 36, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bioluminescent Emerald Acid Chambers (Top and Bottom)
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.arc(26, 22, 9, 0, Math.PI * 2);
    ctx.arc(26, 50, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(26, 22, 6, 0, Math.PI * 2);
    ctx.arc(26, 50, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(24, 20, 3, 3);
    ctx.fillRect(24, 48, 3, 3);

    // Dithered 16-bit Shading
    ctx.fillStyle = '#1e1b4b';
    for (let x = 20; x <= 50; x += 4) {
      for (let y = 46; y <= 58; y += 4) {
        if ((x + y) % 8 === 0) ctx.fillRect(x, y, 2, 2);
      }
    }

    // Biomechanical Reinforcement Struts & Ribs
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 14, 32, 44);

    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 28); ctx.lineTo(52, 28);
    ctx.moveTo(20, 44); ctx.lineTo(52, 44);
    ctx.stroke();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBioBullet() {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Biomechanical Corrosive Plasma Orb
    // Outer acid corona
    const acidGrad = ctx.createRadialGradient(10, 10, 1, 10, 10, 10);
    acidGrad.addColorStop(0, '#fef08a');
    acidGrad.addColorStop(0.3, '#a3e635');
    acidGrad.addColorStop(0.7, '#10b981');
    acidGrad.addColorStop(1, 'rgba(6, 78, 59, 0)');
    ctx.fillStyle = acidGrad;
    ctx.beginPath();
    ctx.arc(10, 10, 10, 0, Math.PI * 2);
    ctx.fill();

    // Dense Bio Nucleus
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(10, 10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hot Specular White Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8.5, 8.5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting bio-plasma sparks
    ctx.fillStyle = '#a3e635';
    ctx.fillRect(3, 9, 2, 2);
    ctx.fillRect(15, 9, 2, 2);
    ctx.fillRect(9, 3, 2, 2);
    ctx.fillRect(9, 15, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateCavernFarLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // 1. Deep Moon Basalt Rock Wall Background (Authentic 16-bit Slate & Charcoal Tones)
    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, 800, 600);

    // Subtle dithered moon rock texture layers (#0f1522, #182234)
    ctx.fillStyle = '#0f1522';
    for (let x = 0; x < 800; x += 8) {
      for (let y = 0; y < 600; y += 8) {
        if ((x / 8 + y / 8) % 2 === 0) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }

    // Horizontal rock strata fault lines
    ctx.fillStyle = '#030508';
    for (let y = 60; y < 600; y += 80) {
      ctx.fillRect(0, y, 800, 4);
    }

    // 2. Deep Background Moon Wall Craters (Authentic 16-bit Pixel Shading)
    const craters = [
      { x: 140, y: 190, r: 45 },
      { x: 390, y: 310, r: 60 },
      { x: 670, y: 230, r: 50 },
      { x: 260, y: 440, r: 35 },
      { x: 530, y: 150, r: 40 },
      { x: 740, y: 470, r: 55 }
    ];

    for (const c of craters) {
      ctx.fillStyle = '#020407';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r + 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#162030';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#080c14';
      ctx.beginPath();
      ctx.arc(c.x - c.r * 0.2, c.y - c.r * 0.2, c.r * 0.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3b4c68';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r - 2, Math.PI * 0.75, Math.PI * 1.75);
      ctx.stroke();
    }

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateCavernLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Transparent background so Far layer shows through
    ctx.clearRect(0, 0, 800, 600);

    // Jagged Foreground Moon Rock Ceilings & Floors (Solid Basalt Rock Formations - Perfect Tile Match)
    const drawMoonRockFormations = (isCeiling: boolean) => {
      const baseY = isCeiling ? 0 : 600;
      const numPoints = 33; // 25px step
      const step = 800 / (numPoints - 1);
      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < numPoints; i++) {
        const x = i * step;
        const angle = (i / (numPoints - 1)) * Math.PI * 2 * 3;
        let h = 80 + Math.sin(angle) * 20 + Math.cos(angle * 2) * 10;
        if (i === 0 || i === numPoints - 1) h = 85; // Seamless tile match
        const y = isCeiling ? h : 600 - h;
        points.push({ x, y });
      }

      // Base darkest rock layer
      ctx.fillStyle = '#080b12';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      // Main Basalt Rock body
      ctx.fillStyle = '#16202e';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) {
        const offset = isCeiling ? -12 : 12;
        ctx.lineTo(p.x, p.y + offset);
      }
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      // Midtone Moon Rock
      ctx.fillStyle = '#283850';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) {
        const offset = isCeiling ? -24 : 24;
        ctx.lineTo(p.x, p.y + offset);
      }
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      // Highlighted Ridge Lines along Peaks (NeoGeo Style Sharp Chisel Lines)
      ctx.strokeStyle = '#546888';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < points.length - 1; i++) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
      }
      ctx.stroke();

      // Pixel highlights on rock peaks
      ctx.fillStyle = '#849cb8';
      for (let i = 0; i < points.length; i++) {
        if (i % 2 === 0) {
          const p = points[i];
          const py = p.y + (isCeiling ? 6 : -6);
          ctx.fillRect(p.x - 3, py - 3, 6, 6);
        }
      }
    };

    drawMoonRockFormations(true);  // Ceiling
    drawMoonRockFormations(false); // Floor

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateCavernEntryLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 800, 600);

    // 1. Draw Floor (isCeiling = false) - standard cavern floor
    const drawMoonRockFloor = () => {
      const baseY = 600;
      const numPoints = 33; // 25px step
      const step = 800 / (numPoints - 1);
      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < numPoints; i++) {
        const x = i * step;
        const angle = (i / (numPoints - 1)) * Math.PI * 2 * 3;
        let h = 80 + Math.sin(angle) * 20 + Math.cos(angle * 2) * 10;
        if (i === 0 || i === numPoints - 1) h = 85; // Seamless tile match
        const y = 600 - h;
        points.push({ x, y });
      }

      ctx.fillStyle = '#080b12';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#16202e';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) {
        ctx.lineTo(p.x, p.y + 12);
      }
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#283850';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) {
        ctx.lineTo(p.x, p.y + 24);
      }
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#546888';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < points.length - 1; i++) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
      }
      ctx.stroke();

      ctx.fillStyle = '#849cb8';
      for (let i = 0; i < points.length; i++) {
        if (i % 2 === 0) {
          const p = points[i];
          ctx.fillRect(p.x - 3, p.y - 9, 6, 6);
        }
      }
    };

    drawMoonRockFloor();

    // 2. Draw Ceiling (isCeiling = true) WITH ENTRY GAP from x = 110 to 330 for ceiling blast door
    const drawMoonRockCeilingWithGap = () => {
      const leftPoints: { x: number; y: number }[] = [
        { x: 0, y: 85 },
        { x: 25, y: 80 },
        { x: 50, y: 90 },
        { x: 75, y: 82 },
        { x: 100, y: 95 },
        { x: 110, y: 110 }
      ];

      const rightPoints: { x: number; y: number }[] = [
        { x: 330, y: 110 },
        { x: 340, y: 95 },
        { x: 375, y: 82 },
        { x: 400, y: 90 },
        { x: 425, y: 78 }
      ];

      const step = 800 / 32;
      for (let i = 18; i <= 32; i++) {
        const x = i * step;
        const angle = (i / 32) * Math.PI * 2 * 3;
        let h = 80 + Math.sin(angle) * 20 + Math.cos(angle * 2) * 10;
        if (i === 32) h = 85;
        rightPoints.push({ x, y: h });
      }

      const drawBlock = (points: { x: number; y: number }[], isLeft: boolean) => {
        ctx.fillStyle = '#080b12';
        ctx.beginPath();
        if (isLeft) {
          ctx.moveTo(0, 0);
          for (const p of points) ctx.lineTo(p.x, p.y);
          ctx.lineTo(110, 0);
        } else {
          ctx.moveTo(330, 0);
          for (const p of points) ctx.lineTo(p.x, p.y);
          ctx.lineTo(800, 0);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#16202e';
        ctx.beginPath();
        if (isLeft) {
          ctx.moveTo(0, 0);
          for (const p of points) ctx.lineTo(p.x, p.y - 10);
          ctx.lineTo(102, 0);
        } else {
          ctx.moveTo(338, 0);
          for (const p of points) ctx.lineTo(p.x, p.y - 10);
          ctx.lineTo(800, 0);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#283850';
        ctx.beginPath();
        if (isLeft) {
          ctx.moveTo(0, 0);
          for (const p of points) ctx.lineTo(p.x, p.y - 20);
          ctx.lineTo(94, 0);
        } else {
          ctx.moveTo(346, 0);
          for (const p of points) ctx.lineTo(p.x, p.y - 20);
          ctx.lineTo(800, 0);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#546888';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < points.length - 1; i++) {
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[i + 1].x, points[i + 1].y);
        }
        ctx.stroke();

        ctx.beginPath();
        if (isLeft) {
          ctx.moveTo(110, 0);
          ctx.lineTo(110, 110);
        } else {
          ctx.moveTo(330, 0);
          ctx.lineTo(330, 110);
        }
        ctx.stroke();

        ctx.fillStyle = '#849cb8';
        for (let i = 0; i < points.length; i++) {
          if (i % 2 === 0) {
            const p = points[i];
            ctx.fillRect(p.x - 3, p.y + 3, 6, 6);
          }
        }
      };

      drawBlock(leftPoints, true);
      drawBlock(rightPoints, false);
    };

    drawMoonRockCeilingWithGap();

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateCavernToFactoryFarLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // 1. Far Background Wall Transition: Moon Basalt Rock (left) -> Steel Industrial Vault (right)
    const bgGrad = ctx.createLinearGradient(0, 0, 800, 0);
    bgGrad.addColorStop(0, '#060910');
    bgGrad.addColorStop(0.35, '#0b111e');
    bgGrad.addColorStop(1, '#0e1626');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 600);

    // Industrial Steel Plates & Rivets appearing on right half (X > 320)
    ctx.fillStyle = '#1c293d';
    for (let x = 320; x < 800; x += 100) {
      ctx.fillRect(x, 0, 92, 600);
    }
    ctx.strokeStyle = '#32445e';
    ctx.lineWidth = 3;
    for (let x = 320; x <= 800; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();

      ctx.fillStyle = '#526685';
      for (let y = 20; y < 600; y += 40) {
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }

    // Distant background ventilation fan on right side
    const cx = 600, cy = 300, cr = 65;
    ctx.fillStyle = '#060a12';
    ctx.beginPath();
    ctx.arc(cx, cy, cr + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#131d2b';
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();

    // Fan blades
    ctx.fillStyle = '#2d3e58';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, cr - 6, a, a + 0.4);
      ctx.closePath();
      ctx.fill();
    }

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateCavernToFactoryLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Transparent background
    ctx.clearRect(0, 0, 800, 600);

    // Hazard Warning Stripes Girders entering from right
    ctx.fillStyle = '#2d3e58';
    ctx.fillRect(320, 80, 480, 24);
    ctx.fillRect(320, 496, 480, 24);

    ctx.fillStyle = '#eab308';
    for (let x = 330; x < 800; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x + 12, 80);
      ctx.lineTo(x + 6, 104);
      ctx.lineTo(x - 6, 104);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, 496);
      ctx.lineTo(x + 12, 496);
      ctx.lineTo(x + 6, 520);
      ctx.lineTo(x - 6, 520);
      ctx.closePath();
      ctx.fill();
    }

    // Cavern Rock Mouth Widening Arch
    // Left side (X=0): Ceiling height = 85px, Floor height = 85px (Y=515)
    // Right side (X=800): Ceiling height = 40px, Floor height = 40px (Y=560)
    const drawWideningArch = (isCeiling: boolean) => {
      const baseY = isCeiling ? 0 : 600;
      const numPoints = 33;
      const step = 800 / (numPoints - 1);
      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < numPoints; i++) {
        const x = i * step;
        const progress = i / (numPoints - 1);
        const baseH = (1 - progress) * 85 + progress * 40;
        const jagged = Math.sin(progress * Math.PI * 4) * 8 * (1 - progress * 0.7);
        const h = baseH + jagged;
        const y = isCeiling ? h : 600 - h;
        points.push({ x, y });
      }

      ctx.fillStyle = '#080b12';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#16202e';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) {
        const offset = isCeiling ? -10 : 10;
        ctx.lineTo(p.x, p.y + offset);
      }
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#283850';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (const p of points) {
        const offset = isCeiling ? -20 : 20;
        ctx.lineTo(p.x, p.y + offset);
      }
      ctx.lineTo(800, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#546888';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < points.length - 1; i++) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
      }
      ctx.stroke();
    };

    drawWideningArch(true);
    drawWideningArch(false);

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateFactoryFarLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Distant Industrial Steel Vault Background
    ctx.fillStyle = '#0e1626';
    ctx.fillRect(0, 0, 800, 600);

    // Steel Plate Grid with Double Rivets
    ctx.fillStyle = '#1c293d';
    for (let x = 0; x < 800; x += 100) {
      ctx.fillRect(x, 0, 92, 600);
    }

    ctx.strokeStyle = '#32445e';
    ctx.lineWidth = 4;
    for (let x = 0; x <= 800; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();

      ctx.fillStyle = '#526685';
      for (let y = 20; y < 600; y += 40) {
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }

    // Industrial Ventilation Fans (X = 200, 600)
    const fans = [200, 600];
    for (const fx of fans) {
      const fy = 300, fr = 70;
      ctx.fillStyle = '#060a12';
      ctx.beginPath();
      ctx.arc(fx, fy, fr + 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#131d2b';
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2d3e58';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.arc(fx, fy, fr - 8, a, a + 0.35);
        ctx.closePath();
        ctx.fill();
      }

      // Fan hub & wire mesh
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(fx, fy, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Horizontal Pressurized Steam Pipes
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 180, 800, 16);
    ctx.fillRect(0, 400, 800, 16);

    ctx.fillStyle = '#f59e0b';
    for (let x = 50; x < 800; x += 200) {
      ctx.fillRect(x, 176, 12, 24);
      ctx.fillRect(x, 396, 12, 24);
    }

    // Glowing 16-bit LED Status Panels
    const leds = ['#ef4444', '#22c55e', '#f59e0b', '#38bdf8'];
    for (let x = 100; x < 800; x += 200) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(x - 20, 240, 40, 20);

      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = leds[i];
        ctx.fillRect(x - 16 + i * 8, 246, 6, 8);
      }
    }

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateFactoryLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    // Transparent background so Far layer shows through
    ctx.clearRect(0, 0, 800, 600);

    // Top and Bottom Heavy Industrial Girders (40px height)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 800, 40);
    ctx.fillRect(0, 560, 800, 40);

    // Hazard Stripes on top and bottom girders
    ctx.fillStyle = '#eab308';
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 8, 40);
      ctx.lineTo(x - 8, 40);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, 560);
      ctx.lineTo(x + 16, 560);
      ctx.lineTo(x + 8, 600);
      ctx.lineTo(x - 8, 600);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 800, 40);
    ctx.strokeRect(0, 560, 800, 40);

    // Alien Vessel Assembly Pods / Glass Incubation Chambers (X = 140, 380, 620)
    for (const x of [140, 380, 620]) {
      // Chrome Hydraulic Pistons
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x - 6, 40, 12, 140);
      ctx.fillRect(x - 6, 420, 12, 140);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x - 2, 40, 4, 140);
      ctx.fillRect(x - 2, 420, 4, 140);

      // Pod Frame
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x - 28, 180, 56, 240);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 22, 186, 44, 228);

      // Bioluminescent Plasma Fluid
      ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
      ctx.fillRect(x - 18, 192, 36, 216);

      // Unfinished Alien Bio-Ship Hull in Pod
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.ellipse(x, 300, 14, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing alien core eye
      ctx.fillStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.arc(x, 290, 5, 0, Math.PI * 2);
      ctx.fill();

      // Glass shine highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(x - 16, 192, 5, 216);
    }

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateFactoryToSuperstructureFarLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    const bgGrad = ctx.createLinearGradient(0, 0, 800, 0);
    bgGrad.addColorStop(0, '#0e1626');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#2e1065');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateFactoryToSuperstructureLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 800, 600);

    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, 800, 40);
    ctx.fillRect(0, 560, 800, 40);

    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 800, 40);
    ctx.strokeRect(0, 560, 800, 40);

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateSuperstructureFarLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(400, 300, 50, 400, 300, 500);
    grad.addColorStop(0, '#2e1065');
    grad.addColorStop(0.6, '#1e1b4b');
    grad.addColorStop(1, '#090514');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y <= 600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#f43f5e';
    for (let x = 80; x < 800; x += 160) {
      for (let y = 80; y < 600; y += 160) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fecdd3';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f43f5e';
      }
    }

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateSuperstructureLandscape() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 800, 600);

    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, 800, 40);
    ctx.fillRect(0, 560, 800, 40);

    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x < 800; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, 40);
      ctx.lineTo(x + 80, 0);

      ctx.moveTo(x, 600);
      ctx.lineTo(x + 40, 560);
      ctx.lineTo(x + 80, 600);
    }
    ctx.stroke();

    const tex = this.createTextureFromCanvas(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private static generateBullet(color: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 14;
    const ctx = canvas.getContext('2d')!;
    
    const hex = '#' + color.toString(16).padStart(6, '0');

    // 1. High-Contrast Outer Silhouette Shadow (Guarantees visibility over light backgrounds)
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(27, 7);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(8, 14);
    ctx.closePath();
    ctx.fill();

    // 2. Tapered Plasma Energy Aura
    const grad = ctx.createLinearGradient(0, 7, 26, 7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.25, hex);
    grad.addColorStop(0.75, '#ffffff');
    grad.addColorStop(1, hex);

    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.moveTo(26, 7);
    ctx.lineTo(9, 1.5);
    ctx.lineTo(2, 7);
    ctx.lineTo(9, 12.5);
    ctx.closePath();
    ctx.fill();

    // 3. High-Energy Beam Spindle
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(25, 7);
    ctx.lineTo(11, 3);
    ctx.lineTo(4, 7);
    ctx.lineTo(11, 11);
    ctx.closePath();
    ctx.fill();

    // 4. White-Hot Piercing Spine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(24, 7);
    ctx.lineTo(13, 4.5);
    ctx.lineTo(7, 7);
    ctx.lineTo(13, 9.5);
    ctx.closePath();
    ctx.fill();

    // Specular Diamond Glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(19, 6, 5, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateEnemyBullet() {
    const canvas = document.createElement('canvas');
    canvas.width = 26;
    canvas.height = 18;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit High-Contrast Arcade Enemy Orb / Needle (Cave / Raiden style)
    // 1. Deep Silhouette Outer Edge (High Contrast against stars, explosions & dust)
    ctx.fillStyle = '#050209';
    ctx.beginPath();
    ctx.ellipse(13, 9, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. High-Voltage Warning Aura (Neon Crimson / Hot Pink)
    const auraGrad = ctx.createRadialGradient(13, 9, 2, 13, 9, 10.5);
    auraGrad.addColorStop(0, '#ffffff');
    auraGrad.addColorStop(0.2, '#fde047'); // Radiant Electric Yellow
    auraGrad.addColorStop(0.5, '#f97316'); // Blazing Amber Orange
    auraGrad.addColorStop(0.85, '#e11d48'); // Neon Rose Red
    auraGrad.addColorStop(1, '#881337'); // Dark Crimson Contour
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(13, 9, 10.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Dense Inner Kinetic Core
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(13, 9, 6.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. White-Hot Intense Specular Spark
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(12.5, 8.5, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Directional Energy Tip
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 8, 3, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateParticle() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    // 16-bit arcade radiant spark with multi-tier diamond facets
    // Outer energy corona
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(16, 8);
    ctx.lineTo(8, 16);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();

    // Mid diamond beam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(14, 8);
    ctx.lineTo(8, 14);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();

    // Secondary cross flares
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(7, 1, 2, 14);
    ctx.fillRect(1, 7, 14, 2);

    // Specular pure white core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 6, 4, 4);
    ctx.fillRect(7, 5, 2, 6);
    ctx.fillRect(5, 7, 6, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateStar() {
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 12;
    const ctx = canvas.getContext('2d')!;
    
    // 16-bit twinkling space diamond star
    // Distant twinkle halo
    ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.fillRect(5, 1, 2, 10);
    ctx.fillRect(1, 5, 10, 2);

    // Mid cross beams
    ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.fillRect(5, 3, 2, 6);
    ctx.fillRect(3, 5, 6, 2);

    // Diamond core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 4, 4, 4);
    ctx.fillRect(5, 3, 2, 6);
    ctx.fillRect(3, 5, 6, 2);

    // Pure specular center glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 5, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateDrone() {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Gradius-Style Option Support Drone
    // Dark Outer Chassis Silhouette
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(12, 12, 11, 0, Math.PI * 2);
    ctx.fill();

    // Gunmetal Armored Hull Ring
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(12, 12, 9.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(12, 12, 8, 0, Math.PI * 2);
    ctx.fill();

    // Cyan High-Energy Plasma Containment Ring
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(12, 12, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(12, 12, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Hyper-Luminescent White Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(10.5, 10.5, 2, 0, Math.PI * 2);
    ctx.fill();

    // 4 Symmetrical Vector Thrust Winglets with Micro Emitters
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 10, 4, 4);
    ctx.fillRect(20, 10, 4, 4);
    ctx.fillRect(10, 0, 4, 4);
    ctx.fillRect(10, 20, 4, 4);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(1, 11, 2, 2);
    ctx.fillRect(21, 11, 2, 2);
    ctx.fillRect(11, 1, 2, 2);
    ctx.fillRect(11, 21, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generatePowerup() {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Radiant Powerup Crystal Capsule (Faceted Arcade Prism)
    // Dark Outer Silhouette
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(14, 1);
    ctx.lineTo(27, 14);
    ctx.lineTo(14, 27);
    ctx.lineTo(1, 14);
    ctx.closePath();
    ctx.fill();

    // Magenta & Violet Radiant Aura
    const auraGrad = ctx.createRadialGradient(14, 14, 2, 14, 14, 13);
    auraGrad.addColorStop(0, '#ffffff');
    auraGrad.addColorStop(0.3, '#f5d0fe');
    auraGrad.addColorStop(0.6, '#d946ef');
    auraGrad.addColorStop(0.9, '#a21caf');
    auraGrad.addColorStop(1, '#4c0519');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.moveTo(14, 3);
    ctx.lineTo(25, 14);
    ctx.lineTo(14, 25);
    ctx.lineTo(3, 14);
    ctx.closePath();
    ctx.fill();

    // Prismatic Diamond Inner Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 22);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();

    // Faceted Shading Bands
    ctx.fillStyle = '#f0abfc';
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#c026d3';
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.lineTo(14, 22);
    ctx.lineTo(14, 14);
    ctx.closePath();
    ctx.fill();

    // High-Contrast 'P' Symbol
    ctx.fillStyle = '#701a75';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 14, 14.5);

    // Specular Glint Stars
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 13, 3, 2);
    ctx.fillRect(13, 4, 2, 3);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateMissileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Heavy Micro-Missile Fuselage
    // Dark Silhouette
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(31, 8);
    ctx.lineTo(24, 2);
    ctx.lineTo(6, 2);
    ctx.lineTo(2, 6);
    ctx.lineTo(2, 10);
    ctx.lineTo(6, 14);
    ctx.lineTo(24, 14);
    ctx.closePath();
    ctx.fill();

    // Missile Body (Crimson & Slate)
    const bodyGrad = ctx.createLinearGradient(0, 3, 0, 13);
    bodyGrad.addColorStop(0, '#f87171');
    bodyGrad.addColorStop(0.4, '#dc2626');
    bodyGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(8, 3, 16, 10);

    // Rear Stabilizer Fins
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(10, 3); ctx.lineTo(4, 0); ctx.lineTo(6, 3); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 13); ctx.lineTo(4, 16); ctx.lineTo(6, 13); ctx.fill();

    // Glowing Amber Warhead Tip
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(30, 8);
    ctx.lineTo(24, 3);
    ctx.lineTo(24, 13);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(26, 7, 3, 2);

    // Specular Highlight Streak
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 5, 12, 2);

    // Rear Thruster Ignition
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 6, 3, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(0, 7, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateMissileUpgradedTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 44;
    canvas.height = 22;
    const ctx = canvas.getContext('2d')!;

    // Outer plasma energy aura
    const grad = ctx.createLinearGradient(0, 11, 44, 11);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
    grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.9)');
    grad.addColorStop(1, 'rgba(239, 68, 68, 1)');

    // Main heavy fuselage
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(40, 11);
    ctx.lineTo(12, 2);
    ctx.lineTo(4, 11);
    ctx.lineTo(12, 20);
    ctx.closePath();
    ctx.fill();

    // Energy core body
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(42, 11);
    ctx.lineTo(18, 5);
    ctx.lineTo(12, 11);
    ctx.lineTo(18, 17);
    ctx.closePath();
    ctx.fill();

    // Dual cyan wings
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(24, 0);
    ctx.lineTo(22, 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, 20);
    ctx.lineTo(24, 22);
    ctx.lineTo(22, 17);
    ctx.closePath();
    ctx.fill();

    // Dual Thrusters
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 5, 5, 4);
    ctx.fillRect(0, 13, 5, 4);

    // Glowing warhead tip & highlight stripe
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(38, 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(16, 10, 14, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateAsteroid(size: number) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const radius = size / 2 - 4;

    // Outer jagged rock shape
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    const numPoints = 9;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = radius * (0.8 + (Math.sin(i * 3 + size) * 0.2));
      const px = center + Math.cos(angle) * r;
      const py = center + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Inner highlight / texture details
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(center - size * 0.1, center - size * 0.1, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Craters
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(center + size * 0.15, center + size * 0.1, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center - size * 0.2, center + size * 0.15, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center + size * 0.05, center - size * 0.2, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Rim highlight
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.85, Math.PI * 0.8, Math.PI * 1.4);
    ctx.stroke();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateGoldenAsteroid(size: number = 56) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const radius = size / 2 - 4;

    // Outer radial gold shine
    const radGrad = ctx.createRadialGradient(center, center, 4, center, center, radius + 2);
    radGrad.addColorStop(0, '#fef08a'); // sparkling center
    radGrad.addColorStop(0.4, '#f59e0b'); // amber gold
    radGrad.addColorStop(0.8, '#b45309'); // rich bronze-gold
    radGrad.addColorStop(1, '#78350f'); // dark gold outline

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    const numPoints = 10;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = radius * (0.8 + (Math.sin(i * 3 + size) * 0.2));
      const px = center + Math.cos(angle) * r;
      const py = center + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Inner metallic golden facets
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(center - size * 0.1, center - size * 0.1, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Craters / Gem facets
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(center + size * 0.15, center + size * 0.1, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center - size * 0.2, center + size * 0.15, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Bright sparkling highlight cross
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center - size * 0.15, center - size * 0.15, radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Metallic rim stroke
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateTurretBaseTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 52;
    canvas.height = 52;
    const ctx = canvas.getContext('2d')!;

    // Swivel pivot centered at (26, 26)
    // 1. Heavy Base Dark Silhouette
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.moveTo(4, 50);
    ctx.lineTo(48, 50);
    ctx.lineTo(42, 28);
    ctx.lineTo(10, 28);
    ctx.closePath();
    ctx.fill();

    // 2. Heavy Outrigger Stabilizer Feet (Anchored into Lunar Regolith)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, 44, 10, 6);
    ctx.fillRect(40, 44, 10, 6);
    ctx.fillStyle = '#475569';
    ctx.fillRect(4, 42, 6, 3);
    ctx.fillRect(42, 42, 6, 3);

    // Chrome Hydraulic Piston Struts
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(5, 34, 4, 8);
    ctx.fillRect(43, 34, 4, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 34, 1, 8);
    ctx.fillRect(44, 34, 1, 8);

    // 3. Reinforced Trapezoidal Armor Chassis (Gunmetal Slate)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(8, 48);
    ctx.lineTo(44, 48);
    ctx.lineTo(40, 30);
    ctx.lineTo(12, 30);
    ctx.closePath();
    ctx.fill();

    // Military Camouflage Armor Plate
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(11, 46);
    ctx.lineTo(41, 46);
    ctx.lineTo(38, 32);
    ctx.lineTo(14, 32);
    ctx.closePath();
    ctx.fill();

    // 4. Yellow & Black Hazard Caution Stripes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, 38, 24, 7);
    ctx.fillStyle = '#eab308';
    for (let x = 14; x < 38; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 45);
      ctx.lineTo(x + 3, 45);
      ctx.lineTo(x + 5, 38);
      ctx.lineTo(x + 2, 38);
      ctx.closePath();
      ctx.fill();
    }

    // 5. Heavy Steel Bolts & Fastener Rivets
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(10, 46, 2, 2);
    ctx.fillRect(40, 46, 2, 2);
    ctx.fillRect(14, 33, 2, 2);
    ctx.fillRect(36, 33, 2, 2);

    // 6. Turret Swivel Ring Collar Assembly at (26, 26)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(26, 26, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(26, 26, 11, 0, Math.PI * 2);
    ctx.fill();

    // Steel Ball Bearing Track
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(26, 26, 8, 0, Math.PI * 2);
    ctx.fill();

    // Center Swivel Axle Socket
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(26, 26, 5, 0, Math.PI * 2);
    ctx.fill();

    // Power & Diagnostic LED Status Indicators
    ctx.fillStyle = '#22c55e'; // Ready Green
    ctx.fillRect(16, 46, 2, 2);
    ctx.fillStyle = '#ef4444'; // Armed Red
    ctx.fillRect(34, 46, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateTurretLauncherTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 52;
    canvas.height = 52;
    const ctx = canvas.getContext('2d')!;

    // Centered around (26, 26), oriented pointing directly along +X axis (right, angle = 0)
    // 1. Dark Shadow Silhouette of Missile Pod
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.roundRect(10, 14, 38, 24, 4);
    ctx.fill();

    // 2. Rear Heavy Exhaust Blast Shield Deflector (left side, x = 10..18)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 16, 8, 20);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(8, 18, 4, 16);
    // Rear high-voltage conduit cables
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(10, 20, 5, 2);
    ctx.fillRect(10, 30, 5, 2);

    // 3. Main Armored Missile Pod Housing (x = 16..42, y = 15..37)
    ctx.fillStyle = '#334155'; // Military Gunmetal Slate
    ctx.beginPath();
    ctx.roundRect(16, 15, 26, 22, 3);
    ctx.fill();

    // Top & Bottom Armor Bevel Plates
    ctx.fillStyle = '#475569';
    ctx.fillRect(17, 16, 24, 4);
    ctx.fillRect(17, 32, 24, 4);

    // Specular Light Highlight Edge along top
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(18, 16, 22, 1);

    // Heat Dissipation Cooling Louvers on Top/Bottom
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 18, 3, 2);
    ctx.fillRect(25, 18, 3, 2);
    ctx.fillRect(30, 18, 3, 2);

    // 4. Quad Missile Launch Tubes (Front Facing, extending from x = 38 to 48)
    // Tube 1 (Top Upper)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(38, 17, 8, 4);
    // Tube 2 (Top Lower)
    ctx.fillRect(38, 22, 8, 4);
    // Tube 3 (Bottom Upper)
    ctx.fillRect(38, 27, 8, 4);
    // Tube 4 (Bottom Lower)
    ctx.fillRect(38, 32, 8, 4);

    // Metallic Tube Rims
    ctx.fillStyle = '#64748b';
    ctx.fillRect(44, 16, 2, 6);
    ctx.fillRect(44, 21, 2, 6);
    ctx.fillRect(44, 26, 2, 6);
    ctx.fillRect(44, 31, 2, 6);

    // Armed Red & Amber Missile Warhead Tips (Protruding from tubes)
    const drawWarhead = (y: number) => {
      ctx.fillStyle = '#dc2626'; // Red Body
      ctx.fillRect(42, y, 4, 3);
      ctx.fillStyle = '#f59e0b'; // Amber Seeker Cone
      ctx.beginPath();
      ctx.moveTo(46, y);
      ctx.lineTo(49, y + 1.5);
      ctx.lineTo(46, y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a'; // Specular needle tip
      ctx.fillRect(48, y + 1, 1, 1);
    };
    drawWarhead(17.5);
    drawWarhead(22.5);
    drawWarhead(27.5);
    drawWarhead(32.5);

    // 5. Central Laser Guidance & Target Acquisition Optic Eye at (26, 26)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(26, 26, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(26, 26, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Ruby Laser Sensor Lens
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(26, 26, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Laser Glint & Reticle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(25, 25, 2, 2);

    // Outer Target Laser Emitter Pointer (Front Sensor)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(42, 25.5, 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(44, 26, 1, 1);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateTurretTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 52;
    canvas.height = 52;
    const ctx = canvas.getContext('2d')!;

    // Composite Turret Base + Launcher
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = 52;
    baseCanvas.height = 52;
    const launcherCanvas = document.createElement('canvas');
    launcherCanvas.width = 52;
    launcherCanvas.height = 52;

    const baseTex = this.generateTurretBaseTexture();
    const launcherTex = this.generateTurretLauncherTexture();

    ctx.drawImage(baseTex.image as CanvasImageSource, 0, 0);
    ctx.drawImage(launcherTex.image as CanvasImageSource, 0, 0);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateTurretLaser() {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 12;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Heavy Plasma Beam Spindle (Magenta / Crimson)
    // Outer Plasma Corona
    const corona = ctx.createLinearGradient(0, 6, 28, 6);
    corona.addColorStop(0, 'rgba(168, 85, 247, 0)');
    corona.addColorStop(0.3, '#d946ef');
    corona.addColorStop(0.8, '#f43f5e');
    corona.addColorStop(1, '#ffffff');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.moveTo(27, 6);
    ctx.lineTo(8, 1);
    ctx.lineTo(0, 6);
    ctx.lineTo(8, 11);
    ctx.closePath();
    ctx.fill();

    // Dense High-Energy Core
    ctx.fillStyle = '#fae8ff';
    ctx.fillRect(8, 3, 16, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 4, 14, 4);

    // Tip Specular Diamond
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 5, 3, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateIonLaser() {
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 12;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Supercharged Ion Beam (Cyan / Azure)
    const corona = ctx.createLinearGradient(0, 6, 28, 6);
    corona.addColorStop(0, 'rgba(6, 182, 212, 0)');
    corona.addColorStop(0.3, '#06b6d4');
    corona.addColorStop(0.8, '#38bdf8');
    corona.addColorStop(1, '#ffffff');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.moveTo(27, 6);
    ctx.lineTo(8, 1);
    ctx.lineTo(0, 6);
    ctx.lineTo(8, 11);
    ctx.closePath();
    ctx.fill();

    // Dense Ion Core
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(8, 3, 16, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 4, 14, 4);

    // Tip Specular Diamond
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 5, 3, 2);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateMoon() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    const size = 256;
    const center = 128;
    const radius = 118;
    const px = 2; // 2px pixel blocks for high-detail 16-bit arcade pixel art

    // Major Craters List [cx, cy, r, hasRaySystem, hasCentralPeak, isDarkFloor]
    const majorCraters = [
      { cx: 24, cy: 56, r: 20, ray: true, peak: true, darkFloor: false },    // Tycho (South)
      { cx: -52, cy: -18, r: 24, ray: true, peak: true, darkFloor: false },  // Copernicus (West)
      { cx: -78, cy: -28, r: 14, ray: true, peak: false, darkFloor: false }, // Kepler
      { cx: -18, cy: -72, r: 18, ray: false, peak: false, darkFloor: true }, // Plato (Dark Basalt Floor)
      { cx: -62, cy: -46, r: 12, ray: true, peak: true, darkFloor: false },  // Aristarchus (Hotspot)
      { cx: 68, cy: -22, r: 22, ray: false, peak: false, darkFloor: true },  // Mare Crisium (Isolated)
      { cx: 38, cy: 12, r: 16, ray: false, peak: true, darkFloor: false },   // Theophilus
      { cx: -28, cy: 22, r: 18, ray: false, peak: false, darkFloor: false },  // Ptolemaeus
      { cx: 72, cy: 42, r: 15, ray: false, peak: false, darkFloor: false },   // Petavius
      { cx: -90, cy: 18, r: 16, ray: false, peak: false, darkFloor: true },   // Grimaldi
    ];

    // Minor Craters
    const minorCraters = [
      { cx: -35, cy: -55, r: 9 }, { cx: 10, cy: -40, r: 10 }, { cx: 45, cy: -50, r: 8 },
      { cx: -10, cy: -15, r: 11 }, { cx: 5, cy: 20, r: 9 }, { cx: -45, cy: 45, r: 12 },
      { cx: -15, cy: 75, r: 14 }, { cx: 40, cy: 65, r: 10 }, { cx: 80, cy: 10, r: 9 },
      { cx: -70, cy: 50, r: 11 }, { cx: 15, cy: -85, r: 8 }, { cx: -55, cy: -75, r: 10 },
      { cx: 55, cy: -70, r: 9 }, { cx: -85, cy: -55, r: 7 }, { cx: 85, cy: -45, r: 8 }
    ];

    // Color Palette Bands (Lightest to Darkest)
    const palette = [
      '#ffffff', // 0: Pure Highlight (Peaks & Rims)
      '#f1f5f9', // 1: Lit Ice Silver
      '#e2e8f0', // 2: Light Highland Slate
      '#cbd5e1', // 3: Mid Highland Gray
      '#94a3b8', // 4: Deep Highland / Light Mare
      '#64748b', // 5: Mare Transition Slate
      '#475569', // 6: Mare Basalt Gray
      '#334155', // 7: Dark Mare Basalt
      '#1e293b', // 8: Deep Shadow Basalt
      '#0f172a', // 9: Nightside Terminator Shadow
      '#030712'  // 10: Pure Nightside Black
    ];

    // Light source vector (top-left, slightly front)
    const lx = -0.55;
    const ly = -0.55;
    const lz = 0.62;

    for (let y = 0; y < size; y += px) {
      for (let x = 0; x < size; x += px) {
        const dx = (x + px/2) - center;
        const dy = (y + px/2) - center;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= radius) {
          // 3D Sphere Normal
          const z = Math.sqrt(radius * radius - dx * dx - dy * dy);
          const nx = dx / radius;
          const ny = dy / radius;
          const nz = z / radius;

          // Lambertian Illumination Dot Product
          const NdotL = nx * lx + ny * ly + nz * lz;

          // Base surface noise for Lunar Maria & Highlands
          const n1 = Math.sin(dx * 0.035) * Math.cos(dy * 0.035);
          const n2 = Math.sin((dx * 0.07 + 1.2) * (dy * 0.05 - 0.8));
          const n3 = Math.cos(dx * 0.12 - dy * 0.09);
          const noise = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;

          // Maria Probability Distribution
          let isMare = false;
          let mareIntensity = 0;

          // Oceanus Procellarum & Mare Imbrium (Left / Upper-Left)
          const distProcellarum = Math.sqrt((dx + 45)*(dx + 45) + (dy + 15)*(dy + 15));
          if (distProcellarum < 75) {
            isMare = true;
            mareIntensity = Math.max(mareIntensity, (1 - distProcellarum / 75) * 0.8);
          }

          // Mare Tranquillitatis & Serenitatis (Top Right)
          const distTranquil = Math.sqrt((dx - 35)*(dx - 35) + (dy + 35)*(dy + 35));
          if (distTranquil < 55) {
            isMare = true;
            mareIntensity = Math.max(mareIntensity, (1 - distTranquil / 55) * 0.75);
          }

          // Mare Nubium (Lower Center-Left)
          const distNubium = Math.sqrt((dx + 15)*(dx + 15) + (dy - 35)*(dy - 35));
          if (distNubium < 45) {
            isMare = true;
            mareIntensity = Math.max(mareIntensity, (1 - distNubium / 45) * 0.7);
          }

          // Mare Crisium (Isolated East)
          const distCrisium = Math.sqrt((dx - 68)*(dx - 68) + (dy + 22)*(dy + 22));
          if (distCrisium < 22) {
            isMare = true;
            mareIntensity = Math.max(mareIntensity, (1 - distCrisium / 22) * 0.9);
          }

          if (noise > 0.25) {
            isMare = true;
            mareIntensity = Math.max(mareIntensity, (noise - 0.25) * 0.6);
          }

          // Tycho & Copernicus Ejecta Ray System
          let rayHighlight = 0;
          // Tycho Rays
          const tychoDx = dx - 24;
          const tychoDy = dy - 56;
          const tychoDist = Math.sqrt(tychoDx*tychoDx + tychoDy*tychoDy);
          if (tychoDist > 20 && tychoDist < 110) {
            const angle = Math.atan2(tychoDy, tychoDx);
            const rayPattern = Math.abs(Math.sin(angle * 8));
            if (rayPattern > 0.88) {
              rayHighlight += (rayPattern - 0.88) * 6 * (1 - tychoDist / 110);
            }
          }

          // Copernicus Rays
          const copDx = dx + 52;
          const copDy = dy + 18;
          const copDist = Math.sqrt(copDx*copDx + copDy*copDy);
          if (copDist > 24 && copDist < 80) {
            const angle = Math.atan2(copDy, copDx);
            const rayPattern = Math.abs(Math.sin(angle * 6 + 0.4));
            if (rayPattern > 0.85) {
              rayHighlight += (rayPattern - 0.85) * 5 * (1 - copDist / 80);
            }
          }

          // Calculate Shading Level (0 to 10)
          let val = NdotL * 0.5 + 0.5; // 0 to 1

          if (isMare) {
            val -= mareIntensity * 0.32;
          } else {
            val += 0.08; // Highlands are brighter
          }

          val += rayHighlight * 0.15;

          // Crater Modifications
          let craterOffset = 0;

          // Check Major Craters
          for (const crater of majorCraters) {
            const cdx = dx - crater.cx;
            const cdy = dy - crater.cy;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (cdist <= crater.r) {
              if (cdist >= crater.r - 3) {
                // Rim Wall
                const rimAngle = cdx * lx + cdy * ly;
                if (rimAngle < 0) {
                  craterOffset += 0.35; // Lit rim wall
                } else {
                  craterOffset -= 0.30; // Shadowed rim wall
                }
              } else {
                // Interior Floor
                if (crater.darkFloor) {
                  craterOffset -= 0.35;
                } else {
                  const intAngle = cdx * lx + cdy * ly;
                  if (intAngle > 0) {
                    craterOffset -= 0.22; // Interior rim shadow
                  } else {
                    craterOffset += 0.05;
                  }
                  if (crater.peak && cdist < 3) {
                    craterOffset += 0.40; // Central peak highlight
                  }
                }
              }
            }
          }

          // Check Minor Craters
          for (const crater of minorCraters) {
            const cdx = dx - crater.cx;
            const cdy = dy - crater.cy;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (cdist <= crater.r) {
              if (cdist >= crater.r - 2) {
                const rimAngle = cdx * lx + cdy * ly;
                craterOffset += (rimAngle < 0) ? 0.22 : -0.20;
              } else {
                craterOffset -= 0.15;
              }
            }
          }

          val += craterOffset;

          // Map val (range ~ -0.3 to 1.3) into discrete palette index 0 to 10
          let paletteIndex = Math.floor((1 - val) * 9);
          paletteIndex = Math.max(0, Math.min(10, paletteIndex));

          // Apply 2x2 Checkerboard Dithering on index transitions for retro 16-bit aesthetic
          const fraction = ((1 - val) * 9) - paletteIndex;
          const dither = ((x / px + y / px) % 2 === 0);
          if (fraction > 0.65 && dither && paletteIndex < 10) {
            paletteIndex += 1;
          }

          // Edge Limb Atmosphere Glow (Lit edge)
          if (dist >= radius - 3 && NdotL > 0.1) {
            ctx.fillStyle = '#e0f2fe'; // Crisp atmospheric rim
          } else {
            ctx.fillStyle = palette[paletteIndex];
          }

          ctx.fillRect(x, y, px, px);
        }
      }
    }

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBlastDoorTop() {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;

    // Heavy Industrial Steel Vault Shutter (Top Half)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 120, 300);

    // Steel armor panels with rivets
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(8, 8, 104, 284);

    ctx.fillStyle = '#334155';
    ctx.fillRect(16, 16, 88, 268);

    // Diagonal Hazard Stripes along bottom seam (y = 260 to 300)
    ctx.fillStyle = '#eab308';
    for (let x = -20; x < 140; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 260);
      ctx.lineTo(x + 20, 260);
      ctx.lineTo(x + 5, 300);
      ctx.lineTo(x - 15, 300);
      ctx.closePath();
      ctx.fill();
    }

    // Heavy steel seam border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 112, 292);

    // Rivets
    ctx.fillStyle = '#94a3b8';
    for (let y = 20; y < 280; y += 40) {
      ctx.fillRect(12, y, 6, 6);
      ctx.fillRect(102, y, 6, 6);
    }

    // Glowing cyan hydraulic core line
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(56, 20, 8, 240);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBlastDoorBottom() {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;

    // Heavy Industrial Steel Vault Shutter (Bottom Half)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 120, 300);

    // Steel armor panels
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(8, 8, 104, 284);

    ctx.fillStyle = '#334155';
    ctx.fillRect(16, 16, 88, 268);

    // Diagonal Hazard Stripes along top seam (y = 0 to 40)
    ctx.fillStyle = '#eab308';
    for (let x = -20; x < 140; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 5, 40);
      ctx.lineTo(x - 15, 40);
      ctx.closePath();
      ctx.fill();
    }

    // Steel seam border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 112, 292);

    // Rivets
    ctx.fillStyle = '#94a3b8';
    for (let y = 20; y < 280; y += 40) {
      ctx.fillRect(12, y, 6, 6);
      ctx.fillRect(102, y, 6, 6);
    }

    // Glowing cyan hydraulic core line
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(56, 40, 8, 240);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBlastDoorFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 160, 600);

    // Left Frame Pillar (X = 0 to 30)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 30, 600);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(4, 0, 22, 600);

    // Right Frame Pillar (X = 130 to 160)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(130, 0, 30, 600);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(134, 0, 22, 600);

    // Top Header Arch (Y = 0 to 40)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 160, 40);
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, 8, 140, 24);

    // Bottom Threshold Arch (Y = 560 to 600)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 560, 160, 40);
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, 568, 140, 24);

    // Hazard warning bands on pillars
    ctx.fillStyle = '#eab308';
    for (let y = 60; y < 540; y += 120) {
      ctx.fillRect(2, y, 26, 20);
      ctx.fillRect(132, y, 26, 20);
    }

    // Steel borders
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 26, 596);
    ctx.strokeRect(132, 2, 26, 596);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateSubbossGatekeeperTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 110;
    canvas.height = 110;
    const ctx = canvas.getContext('2d')!;

    // 16-bit Titan Gatekeeper Mech Armor (Dark Charcoal & Crimson Details)
    ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
    ctx.shadowBlur = 12;

    // Main Chassis
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(10, 55);    // Front nose shield
    ctx.lineTo(40, 15);    // Top shoulder pod
    ctx.lineTo(85, 10);    // Top back
    ctx.lineTo(105, 30);   // Back top fin
    ctx.lineTo(95, 55);    // Back center thruster
    ctx.lineTo(105, 80);   // Back bottom fin
    ctx.lineTo(85, 100);   // Bottom back
    ctx.lineTo(40, 95);    // Bottom shoulder pod
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Heavy Plating (Dark Steel)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(25, 55);
    ctx.lineTo(50, 25);
    ctx.lineTo(80, 25);
    ctx.lineTo(75, 55);
    ctx.lineTo(80, 85);
    ctx.lineTo(50, 85);
    ctx.closePath();
    ctx.fill();

    // Crimson Command Armor Accents
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(45, 18, 30, 8);
    ctx.fillRect(45, 84, 30, 8);

    // Twin Heavy Plasma Cannons (Top & Bottom)
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 28, 35, 12);
    ctx.fillRect(0, 70, 35, 12);

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(2, 32, 8, 4);
    ctx.fillRect(2, 74, 8, 4);

    // Glowing Cyber Sensor Visor
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(35, 55, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(30, 55, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin Booster Thruster Flames
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(95, 45);
    ctx.lineTo(110, 55);
    ctx.lineTo(95, 65);
    ctx.closePath();
    ctx.fill();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBlastDoorHorizontalPanel() {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 60;
    const ctx = canvas.getContext('2d')!;

    // Dark industrial lunar floor panel
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 150, 60);

    // Steel armor plate body
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(4, 4, 142, 52);

    ctx.fillStyle = '#334155';
    ctx.fillRect(8, 8, 134, 44);

    // Diagonal Yellow Hazard Warning Stripes along right meeting edge (x = 110 to 150)
    ctx.fillStyle = '#eab308';
    for (let y = -20; y < 80; y += 20) {
      ctx.beginPath();
      ctx.moveTo(110, y);
      ctx.lineTo(125, y);
      ctx.lineTo(150, y + 25);
      ctx.lineTo(135, y + 25);
      ctx.closePath();
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 146, 56);

    // Rivets
    ctx.fillStyle = '#94a3b8';
    for (let x = 15; x < 135; x += 30) {
      ctx.fillRect(x, 6, 4, 4);
      ctx.fillRect(x, 50, 4, 4);
    }

    // Glowing cyan hydraulic pressure pipe
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(10, 28, 130, 4);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBlastDoorHorizontalFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 360, 80);

    // Lunar Silo Outer Girder Frame
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 50, 80); // Left housing
    ctx.fillRect(310, 0, 50, 80); // Right housing
    ctx.fillRect(0, 0, 360, 20); // Top lip girder

    // Yellow Hazard Stripes along top lip
    ctx.fillStyle = '#eab308';
    for (let x = 0; x < 360; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x + 6, 20);
      ctx.lineTo(x - 6, 20);
      ctx.closePath();
      ctx.fill();
    }

    // Chrome hydraulic cylinders on housing
    ctx.fillStyle = '#64748b';
    ctx.fillRect(50, 25, 40, 12);
    ctx.fillRect(270, 25, 40, 12);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(50, 28, 40, 4);
    ctx.fillRect(270, 28, 40, 4);

    // Border highlights
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 50, 80);
    ctx.strokeRect(310, 0, 50, 80);
    ctx.strokeRect(0, 0, 360, 20);

    return this.createTextureFromCanvas(canvas);
  }

  private static generateBlastDoorHorizontalShaft() {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Deep subterranean abyss gradient (dark fading to cavern darkness)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 160);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.4, '#090d16');
    bgGrad.addColorStop(1, '#020408');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 300, 160);

    // Steel vertical elevator guide rails on left and right walls
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 0, 20, 160);
    ctx.fillRect(270, 0, 20, 160);

    // Glowing cyan status indicator lights along guide rails going down into the moon
    ctx.fillStyle = '#00f0ff';
    for (let y = 10; y < 160; y += 30) {
      ctx.fillRect(16, y, 8, 12);
      ctx.fillRect(276, y, 8, 12);
    }

    // Red warning lights deeper down
    ctx.fillStyle = '#ef4444';
    for (let y = 25; y < 160; y += 30) {
      ctx.fillRect(16, y, 8, 4);
      ctx.fillRect(276, y, 8, 4);
    }

    return this.createTextureFromCanvas(canvas);
  }

  private static generateSolarDockBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 800, 400);

    // Subtle cosmic nebula ambient glow
    const grad1 = ctx.createRadialGradient(250, 150, 20, 250, 150, 260);
    grad1.addColorStop(0, 'rgba(6, 182, 212, 0.18)');
    grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, 800, 400);

    const grad2 = ctx.createRadialGradient(620, 280, 20, 620, 280, 220);
    grad2.addColorStop(0, 'rgba(245, 158, 11, 0.15)');
    grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, 800, 400);

    // Orbital Docking Truss Structural Lattice (Girders across upper & lower backdrop)
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 4;

    // Top Truss Beam
    ctx.beginPath();
    ctx.moveTo(0, 50); ctx.lineTo(800, 50);
    ctx.moveTo(0, 80); ctx.lineTo(800, 80);
    for (let x = 0; x < 800; x += 60) {
      ctx.moveTo(x, 50); ctx.lineTo(x + 30, 80);
      ctx.moveTo(x + 30, 80); ctx.lineTo(x + 60, 50);
    }
    ctx.stroke();

    // Bottom Truss Beam
    ctx.beginPath();
    ctx.moveTo(0, 320); ctx.lineTo(800, 320);
    ctx.moveTo(0, 350); ctx.lineTo(800, 350);
    for (let x = 0; x < 800; x += 60) {
      ctx.moveTo(x, 320); ctx.lineTo(x + 30, 350);
      ctx.moveTo(x + 30, 350); ctx.lineTo(x + 60, 320);
    }
    ctx.stroke();

    // High Orbit Solar Panel Arrays (Floating Array 1: X=120 to 280)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(120, 20, 160, 24);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 20, 160, 24);
    for (let x = 140; x < 280; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 44); ctx.stroke();
    }

    // Solar Panel Array 2: X=520 to 680 (Bottom)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(520, 356, 160, 24);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(520, 356, 160, 24);
    for (let x = 540; x < 680; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 356); ctx.lineTo(x, 380); ctx.stroke();
    }

    // Glowing Cyan Beacon Lights along trusses
    ctx.fillStyle = '#00f0ff';
    for (let x = 30; x < 800; x += 120) {
      ctx.beginPath(); ctx.arc(x, 50, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 60, 350, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Space Relay Satellite Silhouette at X = 380, Y = 180
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fillRect(380, 160, 40, 40);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(320, 172, 50, 16);
    ctx.fillRect(430, 172, 50, 16);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    ctx.strokeRect(320, 172, 50, 16);
    ctx.strokeRect(430, 172, 50, 16);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath(); ctx.arc(400, 180, 8, 0, Math.PI * 2); ctx.fill();

    return this.createTextureFromCanvas(canvas);
  }

  private static generateSolarMineTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    // 16-Bit Proximity Space Navigational Mine
    // 1. Dark Silhouette & Hazard Spikes
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(24, 24, 16, 0, Math.PI * 2);
    ctx.fill();

    // 8 Faceted Proximity Sensor Spikes
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const xTip = 24 + Math.cos(a) * 23;
      const yTip = 24 + Math.sin(a) * 23;
      const xL = 24 + Math.cos(a - 0.25) * 14;
      const yL = 24 + Math.sin(a - 0.25) * 14;
      const xR = 24 + Math.cos(a + 0.25) * 14;
      const yR = 24 + Math.sin(a + 0.25) * 14;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(xTip, yTip);
      ctx.lineTo(xL, yL);
      ctx.lineTo(xR, yR);
      ctx.closePath();
      ctx.fill();

      // Spike core energy needle
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24 + Math.cos(a) * 12, 24 + Math.sin(a) * 12);
      ctx.lineTo(xTip, yTip);
      ctx.stroke();

      // Glowing tip diode
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(xTip - 1.5, yTip - 1.5, 3, 3);
    }

    // 2. Heavy Armored Spherical Hull (Gunmetal Steel)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(24, 24, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(22, 22, 12, 0, Math.PI * 2);
    ctx.fill();

    // 3. Glowing Amber Warning Ring
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(24, 24, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(24, 24, 7, 0, Math.PI * 2);
    ctx.fill();

    // 4. Central Optical Sensor Lens
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(24, 24, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(23, 23, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22, 22, 2, 2);

    return this.createTextureFromCanvas(canvas);
  }
}

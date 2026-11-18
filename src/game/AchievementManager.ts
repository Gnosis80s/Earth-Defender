export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Emoji or visual icon representation
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
  unlockedAt?: string;
}

export interface AchievementStats {
  totalKills: number;
  bossesKilled: number;
  turretsDestroyed: number;
  powerupsCollected: number;
  shieldPowerupsCollected: number;
  stageHitsTaken: number;
  highestScore: number;
}

export class AchievementManager {
  private static STORAGE_KEY = 'starfighter_achievements_v1';
  private static STATS_KEY = 'starfighter_stats_v1';

  public static achievements: Record<string, Achievement> = {
    first_blood: {
      id: 'first_blood',
      title: 'First Blood',
      description: 'Destroy your first hostile starfighter',
      icon: '💥',
      unlocked: false
    },
    enemy_500: {
      id: 'enemy_500',
      title: 'Space Cadet',
      description: 'Destroy 500 enemy ships',
      icon: '🎯',
      unlocked: false,
      progress: 0,
      maxProgress: 500
    },
    enemy_1000: {
      id: 'enemy_1000',
      title: 'Veteran Pilot',
      description: 'Destroy 1,000 enemy ships',
      icon: '⭐',
      unlocked: false,
      progress: 0,
      maxProgress: 1000
    },
    enemy_5000: {
      id: 'enemy_5000',
      title: 'Dreadnought Ace',
      description: 'Destroy 5,000 enemy ships',
      icon: '👑',
      unlocked: false,
      progress: 0,
      maxProgress: 5000
    },
    boss_slayer: {
      id: 'boss_slayer',
      title: 'Boss Slayer',
      description: 'Defeat a massive flagship Boss',
      icon: '☠️',
      unlocked: false
    },
    boss_master: {
      id: 'boss_master',
      title: 'Fleet Commander',
      description: 'Defeat 10 Bosses across stages',
      icon: '🎖️',
      unlocked: false,
      progress: 0,
      maxProgress: 10
    },
    turret_buster: {
      id: 'turret_buster',
      title: 'Demolition Expert',
      description: 'Destroy 50 breakable Boss Turrets',
      icon: '💣',
      unlocked: false,
      progress: 0,
      maxProgress: 50
    },
    perfect_stage: {
      id: 'perfect_stage',
      title: 'Perfect Stage',
      description: 'Complete any stage without taking a single hit',
      icon: '🛡️',
      unlocked: false
    },
    shield_master: {
      id: 'shield_master',
      title: 'Iron Fortress',
      description: 'Collect 50 Deflector Shield powerups',
      icon: '💠',
      unlocked: false,
      progress: 0,
      maxProgress: 50
    },
    max_weapon: {
      id: 'max_weapon',
      title: 'Overclocked Lasers',
      description: 'Upgrade primary weapon to Maximum Level 3',
      icon: '⚡',
      unlocked: false
    },
    max_missile: {
      id: 'max_missile',
      title: 'Missile Mayhem',
      description: 'Upgrade homing missiles to Maximum Level 3',
      icon: '🚀',
      unlocked: false
    },
    powerup_collector: {
      id: 'powerup_collector',
      title: 'Supply Hoarder',
      description: 'Collect 150 total powerups',
      icon: '🎁',
      unlocked: false,
      progress: 0,
      maxProgress: 150
    },
    score_100k: {
      id: 'score_100k',
      title: 'Starfighter Prodigy',
      description: 'Score 100,000 points in a single run',
      icon: '🏆',
      unlocked: false
    },
    score_500k: {
      id: 'score_500k',
      title: 'Galactic Legend',
      description: 'Score 500,000 points in a single run',
      icon: '🌟',
      unlocked: false
    },
    golden_prospector: {
      id: 'golden_prospector',
      title: 'Golden Prospector',
      description: 'Locate and destroy the rare Golden Asteroid in deep space',
      icon: '✨',
      unlocked: false
    }
  };

  public static stats: AchievementStats = {
    totalKills: 0,
    bossesKilled: 0,
    turretsDestroyed: 0,
    powerupsCollected: 0,
    shieldPowerupsCollected: 0,
    stageHitsTaken: 0,
    highestScore: 0
  };

  private static onUnlockCallback?: (achievement: Achievement) => void;

  public static init(onUnlock?: (achievement: Achievement) => void) {
    this.onUnlockCallback = onUnlock;
    this.load();
  }

  public static load() {
    try {
      const savedAcc = localStorage.getItem(this.STORAGE_KEY);
      if (savedAcc) {
        const parsed: Record<string, Partial<Achievement>> = JSON.parse(savedAcc);
        for (const key in parsed) {
          if (this.achievements[key]) {
            this.achievements[key].unlocked = !!parsed[key].unlocked;
            if (parsed[key].unlockedAt) {
              this.achievements[key].unlockedAt = parsed[key].unlockedAt;
            }
          }
        }
      }

      const savedStats = localStorage.getItem(this.STATS_KEY);
      if (savedStats) {
        this.stats = { ...this.stats, ...JSON.parse(savedStats) };
        this.updateProgresses();
      }
    } catch (e) {
      console.warn('Failed to load achievements from storage', e);
    }
  }

  public static save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.achievements));
      localStorage.setItem(this.STATS_KEY, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Failed to save achievements to storage', e);
    }
  }

  public static resetProgress() {
    this.stats = {
      totalKills: 0,
      bossesKilled: 0,
      turretsDestroyed: 0,
      powerupsCollected: 0,
      shieldPowerupsCollected: 0,
      stageHitsTaken: 0,
      highestScore: 0
    };
    for (const key in this.achievements) {
      this.achievements[key].unlocked = false;
      if (this.achievements[key].maxProgress) {
        this.achievements[key].progress = 0;
      }
    }
    this.save();
  }

  private static updateProgresses() {
    if (this.achievements.enemy_500) this.achievements.enemy_500.progress = Math.min(500, this.stats.totalKills);
    if (this.achievements.enemy_1000) this.achievements.enemy_1000.progress = Math.min(1000, this.stats.totalKills);
    if (this.achievements.enemy_5000) this.achievements.enemy_5000.progress = Math.min(5000, this.stats.totalKills);
    if (this.achievements.boss_master) this.achievements.boss_master.progress = Math.min(10, this.stats.bossesKilled);
    if (this.achievements.turret_buster) this.achievements.turret_buster.progress = Math.min(50, this.stats.turretsDestroyed);
    if (this.achievements.shield_master) this.achievements.shield_master.progress = Math.min(50, this.stats.shieldPowerupsCollected);
    if (this.achievements.powerup_collector) this.achievements.powerup_collector.progress = Math.min(150, this.stats.powerupsCollected);
  }

  public static unlock(id: string) {
    const ach = this.achievements[id];
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.save();
      if (this.onUnlockCallback) {
        this.onUnlockCallback(ach);
      }
    }
  }

  public static resetStageHits() {
    this.stats.stageHitsTaken = 0;
  }

  public static recordEnemyKill() {
    this.stats.totalKills++;
    this.updateProgresses();

    if (this.stats.totalKills >= 1) this.unlock('first_blood');
    if (this.stats.totalKills >= 500) this.unlock('enemy_500');
    if (this.stats.totalKills >= 1000) this.unlock('enemy_1000');
    if (this.stats.totalKills >= 5000) this.unlock('enemy_5000');

    this.save();
  }

  public static recordBossKill() {
    this.stats.bossesKilled++;
    this.updateProgresses();

    this.unlock('boss_slayer');
    if (this.stats.bossesKilled >= 10) this.unlock('boss_master');

    if (this.stats.stageHitsTaken === 0) {
      this.unlock('perfect_stage');
    }

    this.save();
  }

  public static recordTurretDestroyed() {
    this.stats.turretsDestroyed++;
    this.updateProgresses();

    if (this.stats.turretsDestroyed >= 50) this.unlock('turret_buster');

    this.save();
  }

  public static recordPowerupCollected(type: string) {
    this.stats.powerupsCollected++;
    if (type === 'shield') {
      this.stats.shieldPowerupsCollected++;
    }
    this.updateProgresses();

    if (this.stats.powerupsCollected >= 150) this.unlock('powerup_collector');
    if (this.stats.shieldPowerupsCollected >= 50) this.unlock('shield_master');

    this.save();
  }

  public static recordWeaponLevels(weaponLevel: number, missileLevel: number) {
    if (weaponLevel >= 3) this.unlock('max_weapon');
    if (missileLevel >= 3) this.unlock('max_missile');
  }

  public static recordScore(score: number) {
    if (score > this.stats.highestScore) {
      this.stats.highestScore = score;
    }
    if (score >= 100000) this.unlock('score_100k');
    if (score >= 500000) this.unlock('score_500k');

    this.save();
  }

  public static recordHitTaken() {
    this.stats.stageHitsTaken++;
  }

  public static recordGoldenAsteroidDestroyed() {
    this.unlock('golden_prospector');
    this.save();
  }
}

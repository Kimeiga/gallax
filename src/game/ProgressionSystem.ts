// Player progression and leveling system
export interface PlayerStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalCoins: number;
  totalResourcesCollected: number;
  totalBuildingsPlaced: number;
  totalMissionsCompleted: number;
  totalDistanceTraveled: number;
}

export class ProgressionSystem {
  private stats: PlayerStats = {
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    totalCoins: 0,
    totalResourcesCollected: 0,
    totalBuildingsPlaced: 0,
    totalMissionsCompleted: 0,
    totalDistanceTraveled: 0,
  };

  private readonly XP_MULTIPLIER = 1.5;
  private readonly BASE_XP = 100;

  constructor() {
    this.loadStats();
  }

  private loadStats(): void {
    const saved = localStorage.getItem('gallax_player_stats');
    if (saved) {
      this.stats = JSON.parse(saved);
    }
  }

  private saveStats(): void {
    localStorage.setItem('gallax_player_stats', JSON.stringify(this.stats));
  }

  getStats(): PlayerStats {
    return { ...this.stats };
  }

  addXP(amount: number): { leveledUp: boolean; newLevel?: number } {
    this.stats.xp += amount;
    
    let leveledUp = false;
    let newLevel = this.stats.level;

    while (this.stats.xp >= this.stats.xpToNextLevel) {
      this.stats.xp -= this.stats.xpToNextLevel;
      this.stats.level++;
      newLevel = this.stats.level;
      leveledUp = true;
      this.stats.xpToNextLevel = Math.floor(this.BASE_XP * Math.pow(this.XP_MULTIPLIER, this.stats.level - 1));
    }

    this.saveStats();
    return { leveledUp, newLevel: leveledUp ? newLevel : undefined };
  }

  addCoins(amount: number): void {
    this.stats.totalCoins += amount;
    this.saveStats();
  }

  incrementResourcesCollected(): void {
    this.stats.totalResourcesCollected++;
    this.addXP(5); // 5 XP per resource
    this.saveStats();
  }

  incrementBuildingsPlaced(): void {
    this.stats.totalBuildingsPlaced++;
    this.addXP(25); // 25 XP per building
    this.saveStats();
  }

  incrementMissionsCompleted(): void {
    this.stats.totalMissionsCompleted++;
    this.addXP(50); // 50 XP per mission
    this.saveStats();
  }

  addDistanceTraveled(meters: number): void {
    this.stats.totalDistanceTraveled += meters;
    // 1 XP per 10 meters traveled
    if (this.stats.totalDistanceTraveled % 10 < meters % 10) {
      this.addXP(1);
    }
    this.saveStats();
  }

  // Check if player has unlocked a feature
  hasUnlocked(feature: string): boolean {
    const unlocks: Record<string, number> = {
      'farm': 2,
      'shop': 3,
      'dock': 5,
      'tower': 7,
      'advanced_missions': 5,
      'building_upgrades': 10,
    };
    return this.stats.level >= (unlocks[feature] || 1);
  }

  getUnlockLevel(feature: string): number {
    const unlocks: Record<string, number> = {
      'farm': 2,
      'shop': 3,
      'dock': 5,
      'tower': 7,
      'advanced_missions': 5,
      'building_upgrades': 10,
    };
    return unlocks[feature] || 1;
  }
}


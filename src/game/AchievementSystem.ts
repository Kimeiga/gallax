// Achievement system for tracking player milestones
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  coinReward: number;
  xpReward: number;
  requirement: {
    type: 'resources' | 'buildings' | 'missions' | 'level' | 'distance' | 'coins';
    count: number;
  };
  unlocked: boolean;
  unlockedAt?: string;
}

export class AchievementSystem {
  private achievements: Map<string, Achievement> = new Map();
  private unlockedAchievements: Set<string> = new Set();

  constructor() {
    this.initializeAchievements();
    this.loadProgress();
  }

  private initializeAchievements(): void {
    const achievementDefs: Achievement[] = [
      // Resource Collection
      { id: 'first_resource', name: 'First Steps', description: 'Collect your first resource', icon: '🌱', coinReward: 10, xpReward: 10, requirement: { type: 'resources', count: 1 }, unlocked: false },
      { id: 'resource_10', name: 'Gatherer', description: 'Collect 10 resources', icon: '🌿', coinReward: 25, xpReward: 25, requirement: { type: 'resources', count: 10 }, unlocked: false },
      { id: 'resource_50', name: 'Collector', description: 'Collect 50 resources', icon: '🌳', coinReward: 50, xpReward: 50, requirement: { type: 'resources', count: 50 }, unlocked: false },
      { id: 'resource_100', name: 'Hoarder', description: 'Collect 100 resources', icon: '🏔️', coinReward: 100, xpReward: 100, requirement: { type: 'resources', count: 100 }, unlocked: false },
      
      // Building Placement
      { id: 'first_building', name: 'Architect', description: 'Place your first building', icon: '🏗️', coinReward: 20, xpReward: 20, requirement: { type: 'buildings', count: 1 }, unlocked: false },
      { id: 'building_5', name: 'Builder', description: 'Place 5 buildings', icon: '🏘️', coinReward: 50, xpReward: 50, requirement: { type: 'buildings', count: 5 }, unlocked: false },
      { id: 'building_10', name: 'City Planner', description: 'Place 10 buildings', icon: '🏙️', coinReward: 100, xpReward: 100, requirement: { type: 'buildings', count: 10 }, unlocked: false },
      
      // Missions
      { id: 'first_mission', name: 'Quest Starter', description: 'Complete your first mission', icon: '🎯', coinReward: 30, xpReward: 30, requirement: { type: 'missions', count: 1 }, unlocked: false },
      { id: 'mission_5', name: 'Adventurer', description: 'Complete 5 missions', icon: '⚔️', coinReward: 75, xpReward: 75, requirement: { type: 'missions', count: 5 }, unlocked: false },
      { id: 'mission_10', name: 'Hero', description: 'Complete 10 missions', icon: '🏆', coinReward: 150, xpReward: 150, requirement: { type: 'missions', count: 10 }, unlocked: false },
      
      // Level Milestones
      { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐', coinReward: 100, xpReward: 0, requirement: { type: 'level', count: 5 }, unlocked: false },
      { id: 'level_10', name: 'Veteran', description: 'Reach level 10', icon: '🌟', coinReward: 250, xpReward: 0, requirement: { type: 'level', count: 10 }, unlocked: false },
      { id: 'level_20', name: 'Master', description: 'Reach level 20', icon: '💫', coinReward: 500, xpReward: 0, requirement: { type: 'level', count: 20 }, unlocked: false },
      
      // Distance Traveled
      { id: 'distance_1km', name: 'Explorer', description: 'Travel 1 kilometer', icon: '🚶', coinReward: 50, xpReward: 50, requirement: { type: 'distance', count: 1000 }, unlocked: false },
      { id: 'distance_5km', name: 'Wanderer', description: 'Travel 5 kilometers', icon: '🏃', coinReward: 150, xpReward: 150, requirement: { type: 'distance', count: 5000 }, unlocked: false },
      
      // Wealth
      { id: 'coins_100', name: 'Penny Pincher', description: 'Earn 100 coins', icon: '💰', coinReward: 50, xpReward: 50, requirement: { type: 'coins', count: 100 }, unlocked: false },
      { id: 'coins_500', name: 'Wealthy', description: 'Earn 500 coins', icon: '💎', coinReward: 100, xpReward: 100, requirement: { type: 'coins', count: 500 }, unlocked: false },
      { id: 'coins_1000', name: 'Tycoon', description: 'Earn 1000 coins', icon: '👑', coinReward: 250, xpReward: 250, requirement: { type: 'coins', count: 1000 }, unlocked: false },
    ];

    achievementDefs.forEach(ach => this.achievements.set(ach.id, ach));
  }

  private loadProgress(): void {
    const saved = localStorage.getItem('gallax_achievements');
    if (saved) {
      const data = JSON.parse(saved);
      this.unlockedAchievements = new Set(data.unlocked || []);
      
      // Update achievement objects
      this.unlockedAchievements.forEach(id => {
        const ach = this.achievements.get(id);
        if (ach) {
          ach.unlocked = true;
          ach.unlockedAt = data.timestamps?.[id];
        }
      });
    }
  }

  private saveProgress(): void {
    const timestamps: Record<string, string> = {};
    this.achievements.forEach((ach, id) => {
      if (ach.unlockedAt) {
        timestamps[id] = ach.unlockedAt;
      }
    });

    localStorage.setItem('gallax_achievements', JSON.stringify({
      unlocked: Array.from(this.unlockedAchievements),
      timestamps,
    }));
  }

  checkAchievements(stats: {
    resources: number;
    buildings: number;
    missions: number;
    level: number;
    distance: number;
    coins: number;
  }): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    this.achievements.forEach((ach, id) => {
      if (ach.unlocked) return;

      let currentValue = 0;
      switch (ach.requirement.type) {
        case 'resources': currentValue = stats.resources; break;
        case 'buildings': currentValue = stats.buildings; break;
        case 'missions': currentValue = stats.missions; break;
        case 'level': currentValue = stats.level; break;
        case 'distance': currentValue = stats.distance; break;
        case 'coins': currentValue = stats.coins; break;
      }

      if (currentValue >= ach.requirement.count) {
        ach.unlocked = true;
        ach.unlockedAt = new Date().toISOString();
        this.unlockedAchievements.add(id);
        newlyUnlocked.push(ach);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.saveProgress();
    }

    return newlyUnlocked;
  }

  getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  getUnlockedCount(): number {
    return this.unlockedAchievements.size;
  }

  getTotalCount(): number {
    return this.achievements.size;
  }

  getProgress(): number {
    return (this.getUnlockedCount() / this.getTotalCount()) * 100;
  }
}


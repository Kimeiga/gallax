// NPC Mission tracking system (client-side)

export interface NPCMission {
  id: string;
  type: 'collect';
  resource: string; // 'wood', 'stone', etc.
  amount: number;
  rewardXP: number;
  rewardCoins: number;
  progress: number; // Current amount collected
  active: boolean;
}

export class NPCMissionSystem {
  private missions: Map<string, NPCMission> = new Map();
  private readonly STORAGE_KEY = 'gallax_npc_missions';

  constructor() {
    this.loadMissions();
  }

  private loadMissions(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.missions = new Map(Object.entries(data));
      } catch (e) {
        console.error('Failed to load NPC missions:', e);
      }
    }
  }

  private saveMissions(): void {
    const data = Object.fromEntries(this.missions);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Accept a new mission
  acceptMission(missionId: string): void {
    // Parse mission ID to get details (e.g., "collect_wood_5")
    const parts = missionId.split('_');
    if (parts[0] !== 'collect' || parts.length < 3) {
      console.error('Invalid mission ID format:', missionId);
      return;
    }

    const resource = parts[1];
    const amount = parseInt(parts[2]);

    const mission: NPCMission = {
      id: missionId,
      type: 'collect',
      resource,
      amount,
      rewardXP: amount * 10, // 10 XP per item
      rewardCoins: amount * 5, // 5 coins per item
      progress: 0,
      active: true
    };

    this.missions.set(missionId, mission);
    this.saveMissions();
    console.log(`✅ Accepted mission: ${missionId}`);
  }

  // Update mission progress based on inventory
  updateProgress(inventory: Record<string, number>): void {
    let updated = false;
    
    for (const mission of this.missions.values()) {
      if (!mission.active) continue;
      
      const currentAmount = inventory[mission.resource] || 0;
      if (currentAmount !== mission.progress) {
        mission.progress = Math.min(currentAmount, mission.amount);
        updated = true;
      }
    }

    if (updated) {
      this.saveMissions();
    }
  }

  // Check if mission is complete
  isMissionComplete(missionId: string): boolean {
    const mission = this.missions.get(missionId);
    return mission ? mission.progress >= mission.amount : false;
  }

  // Check if player has an active mission
  hasMission(missionId: string): boolean {
    const mission = this.missions.get(missionId);
    return mission ? mission.active : false;
  }

  // Complete a mission (consume resources and give rewards)
  completeMission(missionId: string, inventory: any, progression: any): { success: boolean; xp: number; coins: number } {
    const mission = this.missions.get(missionId);
    
    if (!mission || !mission.active) {
      return { success: false, xp: 0, coins: 0 };
    }

    if (mission.progress < mission.amount) {
      return { success: false, xp: 0, coins: 0 };
    }

    // Consume resources from inventory
    inventory.remove(mission.resource, mission.amount);

    // Award rewards
    const xpResult = progression.addXP(mission.rewardXP);
    progression.addCoins(mission.rewardCoins);
    progression.incrementMissionsCompleted();

    // Mark mission as complete
    mission.active = false;
    this.saveMissions();

    console.log(`🎉 Completed mission: ${missionId} (+${mission.rewardXP} XP, +${mission.rewardCoins} coins)`);

    return {
      success: true,
      xp: mission.rewardXP,
      coins: mission.rewardCoins
    };
  }

  // Get all active missions
  getActiveMissions(): NPCMission[] {
    return Array.from(this.missions.values()).filter(m => m.active);
  }

  // Get mission by ID
  getMission(missionId: string): NPCMission | undefined {
    return this.missions.get(missionId);
  }
}


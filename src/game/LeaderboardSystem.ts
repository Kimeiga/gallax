// Leaderboard system for global rankings
export interface LeaderboardEntry {
  userId: string;
  username: string;
  level: number;
  xp: number;
  totalCoins: number;
  totalResourcesCollected: number;
  totalBuildingsPlaced: number;
  totalMissionsCompleted: number;
  rank?: number;
}

export type LeaderboardType = 'level' | 'coins' | 'resources' | 'buildings' | 'missions';

export class LeaderboardSystem {
  private cache: Map<LeaderboardType, LeaderboardEntry[]> = new Map();
  private lastFetch: Map<LeaderboardType, number> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute

  async getLeaderboard(type: LeaderboardType = 'level', limit: number = 10): Promise<LeaderboardEntry[]> {
    // Check cache
    const cached = this.cache.get(type);
    const lastFetch = this.lastFetch.get(type) || 0;
    
    if (cached && Date.now() - lastFetch < this.CACHE_DURATION) {
      return cached;
    }

    // Fetch from API
    try {
      const res = await fetch(`/api/leaderboard?type=${type}&limit=${limit}`);
      if (!res.ok) {
        console.error('Failed to fetch leaderboard');
        return cached || [];
      }
      
      const data = await res.json();
      const entries = data.leaderboard || [];
      
      // Add ranks
      entries.forEach((entry: LeaderboardEntry, index: number) => {
        entry.rank = index + 1;
      });
      
      this.cache.set(type, entries);
      this.lastFetch.set(type, Date.now());
      
      return entries;
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      return cached || [];
    }
  }

  async getPlayerRank(type: LeaderboardType = 'level'): Promise<number | null> {
    try {
      const res = await fetch(`/api/leaderboard/rank?type=${type}`);
      if (!res.ok) return null;
      
      const data = await res.json();
      return data.rank || null;
    } catch (err) {
      console.error('Error fetching player rank:', err);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.lastFetch.clear();
  }
}

export const leaderboardSystem = new LeaderboardSystem();


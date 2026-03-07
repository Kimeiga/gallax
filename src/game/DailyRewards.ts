// Daily login reward system
export interface DailyReward {
  day: number;
  coins: number;
  xp: number;
  bonus?: string;
}

export class DailyRewardSystem {
  private currentStreak: number = 0;
  private lastLoginDate: string | null = null;
  private totalLogins: number = 0;

  constructor() {
    this.loadProgress();
  }

  private loadProgress(): void {
    const saved = localStorage.getItem('gallax_daily_rewards');
    if (saved) {
      const data = JSON.parse(saved);
      this.currentStreak = data.streak || 0;
      this.lastLoginDate = data.lastLogin || null;
      this.totalLogins = data.totalLogins || 0;
    }
  }

  private saveProgress(): void {
    localStorage.setItem('gallax_daily_rewards', JSON.stringify({
      streak: this.currentStreak,
      lastLogin: this.lastLoginDate,
      totalLogins: this.totalLogins,
    }));
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getYesterday(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  canClaimToday(): boolean {
    const today = this.getToday();
    return this.lastLoginDate !== today;
  }

  claimDailyReward(): DailyReward | null {
    if (!this.canClaimToday()) {
      return null;
    }

    const today = this.getToday();
    const yesterday = this.getYesterday();

    // Check if streak continues
    if (this.lastLoginDate === yesterday) {
      this.currentStreak++;
    } else if (this.lastLoginDate !== today) {
      // Streak broken, reset to 1
      this.currentStreak = 1;
    }

    this.lastLoginDate = today;
    this.totalLogins++;
    this.saveProgress();

    return this.getRewardForDay(this.currentStreak);
  }

  private getRewardForDay(day: number): DailyReward {
    // Rewards scale with streak
    const baseCoins = 50;
    const baseXP = 25;
    
    // Every 7 days is a bonus
    const weekBonus = Math.floor((day - 1) / 7);
    const dayInWeek = ((day - 1) % 7) + 1;

    let coins = baseCoins + (dayInWeek * 10) + (weekBonus * 50);
    let xp = baseXP + (dayInWeek * 5) + (weekBonus * 25);
    let bonus: string | undefined;

    // Special bonuses
    if (day % 7 === 0) {
      coins *= 2;
      xp *= 2;
      bonus = '🎁 Weekly Bonus! Double rewards!';
    } else if (day % 30 === 0) {
      coins *= 3;
      xp *= 3;
      bonus = '🎉 Monthly Bonus! Triple rewards!';
    }

    return { day, coins, xp, bonus };
  }

  getCurrentStreak(): number {
    return this.currentStreak;
  }

  getTotalLogins(): number {
    return this.totalLogins;
  }

  getNextReward(): DailyReward {
    const nextDay = this.canClaimToday() ? this.currentStreak + 1 : this.currentStreak;
    return this.getRewardForDay(nextDay);
  }
}


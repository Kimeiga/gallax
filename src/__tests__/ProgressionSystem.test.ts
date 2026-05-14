// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionSystem } from '../game/ProgressionSystem';

// jsdom environment provides localStorage; clear it before each test
beforeEach(() => localStorage.clear());

function make() {
  return new ProgressionSystem();
}

// ─── initial state ─────────────────────────────────────────────────────────────

describe('ProgressionSystem initial state', () => {
  it('starts at level 1 with 0 XP', () => {
    const p = make();
    const s = p.getStats();
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.xpToNextLevel).toBeGreaterThan(0);
  });

  it('starts with all counters at 0', () => {
    const s = make().getStats();
    expect(s.totalCoins).toBe(0);
    expect(s.totalResourcesCollected).toBe(0);
    expect(s.totalBuildingsPlaced).toBe(0);
    expect(s.totalMissionsCompleted).toBe(0);
    expect(s.totalDistanceTraveled).toBe(0);
  });
});

// ─── addXP ─────────────────────────────────────────────────────────────────────

describe('ProgressionSystem.addXP', () => {
  it('accumulates XP without leveling', () => {
    const p = make();
    const result = p.addXP(50);
    expect(result.leveledUp).toBe(false);
    expect(p.getStats().xp).toBe(50);
    expect(p.getStats().level).toBe(1);
  });

  it('levels up when XP threshold is reached', () => {
    const p = make();
    const { xpToNextLevel } = p.getStats();
    const result = p.addXP(xpToNextLevel);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(p.getStats().level).toBe(2);
  });

  it('carries over excess XP after level-up', () => {
    const p = make();
    const { xpToNextLevel } = p.getStats();
    p.addXP(xpToNextLevel + 10);
    expect(p.getStats().xp).toBe(10);
  });

  it('can level up multiple times from a single XP grant', () => {
    const p = make();
    // Grant a huge amount to force multi-level jump
    const result = p.addXP(10000);
    expect(result.leveledUp).toBe(true);
    expect(p.getStats().level).toBeGreaterThan(2);
  });

  it('xpToNextLevel grows with each level', () => {
    const p = make();
    const xp1 = p.getStats().xpToNextLevel;
    p.addXP(xp1);
    const xp2 = p.getStats().xpToNextLevel;
    expect(xp2).toBeGreaterThan(xp1);
  });

  it('persists to localStorage', () => {
    const p = make();
    p.addXP(42);
    const p2 = make(); // new instance reads same localStorage
    expect(p2.getStats().xp).toBe(42);
  });
});

// ─── addCoins ──────────────────────────────────────────────────────────────────

describe('ProgressionSystem.addCoins', () => {
  it('increments totalCoins', () => {
    const p = make();
    p.addCoins(100);
    p.addCoins(50);
    expect(p.getStats().totalCoins).toBe(150);
  });
});

// ─── incrementResourcesCollected ───────────────────────────────────────────────

describe('ProgressionSystem.incrementResourcesCollected', () => {
  it('increments counter and awards 5 XP', () => {
    const p = make();
    p.incrementResourcesCollected();
    const s = p.getStats();
    expect(s.totalResourcesCollected).toBe(1);
    expect(s.xp).toBe(5);
  });
});

// ─── incrementBuildingsPlaced ──────────────────────────────────────────────────

describe('ProgressionSystem.incrementBuildingsPlaced', () => {
  it('increments counter and awards 25 XP', () => {
    const p = make();
    p.incrementBuildingsPlaced();
    const s = p.getStats();
    expect(s.totalBuildingsPlaced).toBe(1);
    expect(s.xp).toBe(25);
  });
});

// ─── incrementMissionsCompleted ────────────────────────────────────────────────

describe('ProgressionSystem.incrementMissionsCompleted', () => {
  it('increments counter and awards 50 XP', () => {
    const p = make();
    p.incrementMissionsCompleted();
    const s = p.getStats();
    expect(s.totalMissionsCompleted).toBe(1);
    expect(s.xp).toBe(50);
  });
});

// ─── hasUnlocked / getUnlockLevel ─────────────────────────────────────────────

describe('ProgressionSystem.hasUnlocked', () => {
  it('unknown features are unlocked at level 1', () => {
    const p = make();
    expect(p.hasUnlocked('some_unknown_feature')).toBe(true);
  });

  it('locked at lower level', () => {
    const p = make(); // level 1
    expect(p.hasUnlocked('farm')).toBe(false); // requires level 2
  });

  it('unlocked after reaching required level', () => {
    const p = make();
    // Level up to 2 by adding enough XP
    while (p.getStats().level < 2) {
      p.addXP(p.getStats().xpToNextLevel);
    }
    expect(p.hasUnlocked('farm')).toBe(true);
  });

  it('getUnlockLevel returns correct threshold', () => {
    const p = make();
    expect(p.getUnlockLevel('farm')).toBe(2);
    expect(p.getUnlockLevel('shop')).toBe(3);
    expect(p.getUnlockLevel('dock')).toBe(5);
    expect(p.getUnlockLevel('building_upgrades')).toBe(10);
  });
});

// ─── getStats returns a copy ───────────────────────────────────────────────────

describe('ProgressionSystem.getStats immutability', () => {
  it('mutating the returned object does not affect internal state', () => {
    const p = make();
    const s = p.getStats();
    s.level = 999;
    expect(p.getStats().level).toBe(1);
  });
});

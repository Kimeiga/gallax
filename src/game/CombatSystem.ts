import { Inventory } from './Inventory';
import { ProgressionSystem } from './ProgressionSystem';

// --- Interfaces ---

export interface CombatStats {
  maxHp: number;
  currentHp: number;
  baseDamage: number;
  baseDefense: number;
  attackSpeed: number; // attacks per second (1.0 = 1 attack/sec)
}

export interface CombatMob {
  id: string;
  type: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  defense: number;
  speed: number; // attacks per second
  xpReward: number;
}

export interface EquipmentBonuses {
  damage: number;
  defense: number;
  maxHp: number;
  attackSpeed: number;
}

export type CombatState = 'IDLE' | 'IN_COMBAT' | 'VICTORY' | 'DEFEAT';

export interface CombatCallbacks {
  onDamageDealt?: (target: 'player' | 'mob', amount: number, isCrit: boolean) => void;
  onCombatEnd?: (result: 'victory' | 'defeat') => void;
  onAbilityUsed?: (slot: number) => void;
}

// --- Ability definitions ---

interface Ability {
  name: string;
  emoji: string;
  cooldown: number; // seconds
  currentCooldown: number; // seconds remaining
}

const ABILITY_POWER_STRIKE = 0;
const ABILITY_BLOCK = 1;
const ABILITY_HEAL = 2;

// --- Combat System ---

export class CombatSystem {
  private state: CombatState = 'IDLE';
  private playerStats: CombatStats;
  private mob: CombatMob | null = null;
  private equipmentBonuses: EquipmentBonuses = { damage: 0, defense: 0, maxHp: 0, attackSpeed: 0 };

  // Tick timers (seconds accumulated since last attack)
  private playerAttackTimer = 0;
  private mobAttackTimer = 0;

  // Ability state
  private abilities: Ability[] = [
    { name: 'Power Strike', emoji: '⚔️', cooldown: 5, currentCooldown: 0 },
    { name: 'Block', emoji: '🛡️', cooldown: 8, currentCooldown: 0 },
    { name: 'Heal', emoji: '✨', cooldown: 15, currentCooldown: 0 },
  ];
  private powerStrikeActive = false;
  private blockActive = false;

  // Invulnerability after defeat
  private invulnerableTimer = 0;

  // External references
  private inventory: Inventory;
  private progression: ProgressionSystem;
  private callbacks: CombatCallbacks = {};

  constructor(inventory: Inventory, progression: ProgressionSystem) {
    this.inventory = inventory;
    this.progression = progression;

    // Initialize player stats from current level
    this.playerStats = this.computeBaseStats();
  }

  // --- Public API ---

  getState(): CombatState {
    return this.state;
  }

  getPlayerStats(): CombatStats {
    return { ...this.playerStats };
  }

  getMob(): CombatMob | null {
    return this.mob ? { ...this.mob } : null;
  }

  getAbilities(): { name: string; emoji: string; cooldown: number; currentCooldown: number }[] {
    return this.abilities.map(a => ({ ...a }));
  }

  isInvulnerable(): boolean {
    return this.invulnerableTimer > 0;
  }

  setCallbacks(callbacks: CombatCallbacks): void {
    this.callbacks = callbacks;
  }

  setEquipmentBonuses(bonuses: EquipmentBonuses): void {
    this.equipmentBonuses = { ...bonuses };
    this.refreshPlayerStats();
  }

  /** Start combat with a mob. Returns false if already in combat or invulnerable. */
  startCombat(mob: CombatMob): boolean {
    if (this.state === 'IN_COMBAT') return false;
    if (this.invulnerableTimer > 0) return false;

    this.mob = { ...mob };
    this.state = 'IN_COMBAT';
    this.playerAttackTimer = 0;
    this.mobAttackTimer = 0;
    this.powerStrikeActive = false;
    this.blockActive = false;

    // Refresh player stats (level may have changed)
    this.refreshPlayerStats();

    // Heal player to full on combat start
    this.playerStats.currentHp = this.playerStats.maxHp;

    return true;
  }

  /** Flee from combat. Resets state to IDLE. */
  flee(): void {
    if (this.state !== 'IN_COMBAT') return;
    this.mob = null;
    this.state = 'IDLE';
  }

  /** Use an ability by slot index (0, 1, 2). Returns true if used successfully. */
  useAbility(slot: number): boolean {
    if (this.state !== 'IN_COMBAT') return false;
    if (slot < 0 || slot >= this.abilities.length) return false;

    const ability = this.abilities[slot];
    if (ability.currentCooldown > 0) return false;

    switch (slot) {
      case ABILITY_POWER_STRIKE:
        this.powerStrikeActive = true;
        ability.currentCooldown = ability.cooldown;
        break;

      case ABILITY_BLOCK:
        this.blockActive = true;
        ability.currentCooldown = ability.cooldown;
        break;

      case ABILITY_HEAL:
        if (!this.inventory.has('herb', 1)) return false;
        this.inventory.remove('herb', 1);
        const healAmount = Math.floor(this.playerStats.maxHp * 0.3);
        this.playerStats.currentHp = Math.min(
          this.playerStats.maxHp,
          this.playerStats.currentHp + healAmount,
        );
        ability.currentCooldown = ability.cooldown;
        break;

      default:
        return false;
    }

    this.callbacks.onAbilityUsed?.(slot);
    return true;
  }

  /** Main tick, called from Game.update(). deltaTime is in seconds. */
  update(deltaTime: number): void {
    // Tick invulnerability
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - deltaTime);
    }

    // Tick ability cooldowns (even outside combat)
    for (const ability of this.abilities) {
      if (ability.currentCooldown > 0) {
        ability.currentCooldown = Math.max(0, ability.currentCooldown - deltaTime);
      }
    }

    if (this.state !== 'IN_COMBAT' || !this.mob) return;

    // Accumulate attack timers
    const playerSpeed = this.getEffectiveAttackSpeed();
    const mobSpeed = this.mob.speed;

    this.playerAttackTimer += deltaTime;
    this.mobAttackTimer += deltaTime;

    // Player attacks
    const playerInterval = 1 / playerSpeed;
    if (this.playerAttackTimer >= playerInterval) {
      this.playerAttackTimer -= playerInterval;
      this.performPlayerAttack();
    }

    // Check mob death before mob attacks back
    if (this.mob.hp <= 0) {
      this.endCombat('victory');
      return;
    }

    // Mob attacks
    const mobInterval = 1 / mobSpeed;
    if (this.mobAttackTimer >= mobInterval) {
      this.mobAttackTimer -= mobInterval;
      this.performMobAttack();
    }

    // Check player death
    if (this.playerStats.currentHp <= 0) {
      this.endCombat('defeat');
    }
  }

  // --- Internal methods ---

  private computeBaseStats(): CombatStats {
    const level = this.progression.getStats().level;
    const maxHp = 30 + level * 8;
    return {
      maxHp,
      currentHp: maxHp,
      baseDamage: 3 + level * 2,
      baseDefense: 1 + level,
      attackSpeed: 1.0,
    };
  }

  private refreshPlayerStats(): void {
    const base = this.computeBaseStats();
    this.playerStats.maxHp = base.maxHp + this.equipmentBonuses.maxHp;
    this.playerStats.baseDamage = base.baseDamage + this.equipmentBonuses.damage;
    this.playerStats.baseDefense = base.baseDefense + this.equipmentBonuses.defense;
    this.playerStats.attackSpeed = base.attackSpeed + this.equipmentBonuses.attackSpeed;

    // Clamp current HP to new max
    this.playerStats.currentHp = Math.min(this.playerStats.currentHp, this.playerStats.maxHp);
  }

  private getEffectiveAttackSpeed(): number {
    return Math.max(0.1, this.playerStats.attackSpeed);
  }

  private calculateDamage(attackerDamage: number, defenderDefense: number): number {
    let actual = Math.max(1, attackerDamage - defenderDefense * 0.4);
    // 10% variance
    actual *= 0.9 + Math.random() * 0.2;
    return Math.round(actual);
  }

  private performPlayerAttack(): void {
    if (!this.mob) return;

    let damage = this.playerStats.baseDamage;
    let isCrit = false;

    // Power Strike: 2.5x damage
    if (this.powerStrikeActive) {
      damage *= 2.5;
      isCrit = true;
      this.powerStrikeActive = false;
    }

    const actual = this.calculateDamage(damage, this.mob.defense);
    this.mob.hp = Math.max(0, this.mob.hp - actual);

    this.callbacks.onDamageDealt?.('mob', actual, isCrit);
  }

  private performMobAttack(): void {
    if (!this.mob) return;

    let incomingDamage = this.calculateDamage(this.mob.damage, this.playerStats.baseDefense);

    // Block: reduce by 80%
    if (this.blockActive) {
      incomingDamage = Math.max(1, Math.round(incomingDamage * 0.2));
      this.blockActive = false;
    }

    this.playerStats.currentHp = Math.max(0, this.playerStats.currentHp - incomingDamage);

    this.callbacks.onDamageDealt?.('player', incomingDamage, false);
  }

  private endCombat(result: 'victory' | 'defeat'): void {
    this.state = result === 'victory' ? 'VICTORY' : 'DEFEAT';

    if (result === 'defeat') {
      this.applyDeathPenalty();
      this.invulnerableTimer = 10;
    }

    this.callbacks.onCombatEnd?.(result);

    // Reset to idle after notifying
    this.mob = null;
    this.state = 'IDLE';
    this.powerStrikeActive = false;
    this.blockActive = false;
  }

  private applyDeathPenalty(): void {
    const allItems = this.inventory.getAll();
    for (const [type, count] of allItems) {
      if (count > 0) {
        const loss = Math.floor(count * 0.2);
        if (loss > 0) {
          this.inventory.remove(type, loss);
        }
      }
    }
  }
}

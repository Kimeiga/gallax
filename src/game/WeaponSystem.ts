import { Inventory, ResourceType } from './Inventory';

// --- Types ---

export type EquipmentSlot = 'weapon' | 'armor' | 'shield';

export type GearTier = 1 | 2 | 3 | 4 | 5;

export interface GearStats {
  damage: number;
  defense: number;
  speed: number; // Attack speed multiplier (1.0 = normal)
}

export interface SpecialAbility {
  name: string;
  description: string;
}

export interface GearDef {
  id: string;
  emoji: string;
  name: string;
  slot: EquipmentSlot;
  tier: GearTier;
  levelRequired: number;
  cost: Partial<Record<ResourceType, number>>;
  stats: GearStats;
  ability: SpecialAbility;
}

export interface EquippedGear {
  weapon: string | null;  // gear id
  armor: string | null;
  shield: string | null;
}

export interface CraftedItem {
  gearId: string;
  craftedAt: number; // timestamp
}

// --- Gear Definitions ---

export const GEAR_DEFS: Record<string, GearDef> = {
  // ── Tier 1 (Level 1) ──────────────────────────────────────────────
  wooden_sword: {
    id: 'wooden_sword',
    emoji: '🗡️',
    name: 'Wooden Sword',
    slot: 'weapon',
    tier: 1,
    levelRequired: 1,
    cost: { wood: 3 },
    stats: { damage: 5, defense: 0, speed: 1.0 },
    ability: {
      name: 'Splinter Strike',
      description: 'A quick slash that has a chance to leave wood splinters, dealing minor damage over time.',
    },
  },
  wooden_shield: {
    id: 'wooden_shield',
    emoji: '🛡️',
    name: 'Wooden Shield',
    slot: 'shield',
    tier: 1,
    levelRequired: 1,
    cost: { wood: 4 },
    stats: { damage: 0, defense: 4, speed: 0.95 },
    ability: {
      name: 'Bark Guard',
      description: 'Brace with the shield to absorb the next incoming hit completely.',
    },
  },
  leaf_armor: {
    id: 'leaf_armor',
    emoji: '🍃',
    name: 'Leaf Armor',
    slot: 'armor',
    tier: 1,
    levelRequired: 1,
    cost: { herb: 3, wood: 1 },
    stats: { damage: 0, defense: 3, speed: 1.05 },
    ability: {
      name: 'Nature\'s Camouflage',
      description: 'Blend into foliage, reducing enemy detection range for a short time.',
    },
  },

  // ── Tier 2 (Level 3) ──────────────────────────────────────────────
  stone_axe: {
    id: 'stone_axe',
    emoji: '🪓',
    name: 'Stone Axe',
    slot: 'weapon',
    tier: 2,
    levelRequired: 3,
    cost: { stone: 4, wood: 3 },
    stats: { damage: 10, defense: 0, speed: 0.85 },
    ability: {
      name: 'Cleave',
      description: 'A wide sweeping attack that hits all enemies in a short arc in front of you.',
    },
  },
  fishing_spear: {
    id: 'fishing_spear',
    emoji: '🎣',
    name: 'Fishing Spear',
    slot: 'weapon',
    tier: 2,
    levelRequired: 3,
    cost: { wood: 3, fish: 4 },
    stats: { damage: 8, defense: 1, speed: 1.1 },
    ability: {
      name: 'Harpoon Throw',
      description: 'Hurl the spear at a distant target, pulling them toward you on hit.',
    },
  },
  herb_cloak: {
    id: 'herb_cloak',
    emoji: '🧥',
    name: 'Herb Cloak',
    slot: 'armor',
    tier: 2,
    levelRequired: 3,
    cost: { herb: 5, wood: 2 },
    stats: { damage: 0, defense: 7, speed: 1.0 },
    ability: {
      name: 'Healing Aura',
      description: 'Passively regenerates a small amount of health every few seconds while worn.',
    },
  },

  // ── Tier 3 (Level 5) ──────────────────────────────────────────────
  trident: {
    id: 'trident',
    emoji: '🔱',
    name: 'Trident',
    slot: 'weapon',
    tier: 3,
    levelRequired: 5,
    cost: { stone: 5, fish: 5, shell: 3 },
    stats: { damage: 16, defense: 2, speed: 0.95 },
    ability: {
      name: 'Tidal Surge',
      description: 'Summon a wave that pushes all nearby enemies back and deals water damage.',
    },
  },
  shell_shield: {
    id: 'shell_shield',
    emoji: '🐚',
    name: 'Shell Shield',
    slot: 'shield',
    tier: 3,
    levelRequired: 5,
    cost: { shell: 6, stone: 4 },
    stats: { damage: 0, defense: 12, speed: 0.9 },
    ability: {
      name: 'Pearl Barrier',
      description: 'Create an iridescent barrier that reflects a portion of incoming damage back at attackers.',
    },
  },
  bone_bow: {
    id: 'bone_bow',
    emoji: '🏹',
    name: 'Bone Bow',
    slot: 'weapon',
    tier: 3,
    levelRequired: 5,
    cost: { wood: 4, fish: 4, stone: 3 },
    stats: { damage: 14, defense: 0, speed: 1.15 },
    ability: {
      name: 'Piercing Shot',
      description: 'Fire an arrow that passes through the first enemy to hit a second target behind them.',
    },
  },

  // ── Tier 4 (Level 8) ──────────────────────────────────────────────
  gem_staff: {
    id: 'gem_staff',
    emoji: '🪄',
    name: 'Gem Staff',
    slot: 'weapon',
    tier: 4,
    levelRequired: 8,
    cost: { gem: 6, wood: 5, stone: 3 },
    stats: { damage: 22, defense: 3, speed: 0.9 },
    ability: {
      name: 'Prismatic Blast',
      description: 'Channel the gems to unleash a beam of prismatic energy that deals heavy damage in a line.',
    },
  },
  crystal_armor: {
    id: 'crystal_armor',
    emoji: '💎',
    name: 'Crystal Armor',
    slot: 'armor',
    tier: 4,
    levelRequired: 8,
    cost: { gem: 8, stone: 6 },
    stats: { damage: 3, defense: 18, speed: 0.85 },
    ability: {
      name: 'Diamond Skin',
      description: 'Temporarily harden your armor to become immune to damage for a brief moment.',
    },
  },
  fire_sword: {
    id: 'fire_sword',
    emoji: '🔥',
    name: 'Fire Sword',
    slot: 'weapon',
    tier: 4,
    levelRequired: 8,
    cost: { gem: 5, stone: 5, wood: 4 },
    stats: { damage: 25, defense: 0, speed: 1.0 },
    ability: {
      name: 'Inferno Slash',
      description: 'Ignite your blade and strike, setting the target ablaze for sustained burn damage.',
    },
  },

  // ── Tier 5 (Level 12) ─────────────────────────────────────────────
  dragon_slayer: {
    id: 'dragon_slayer',
    emoji: '⚔️',
    name: 'Dragon Slayer',
    slot: 'weapon',
    tier: 5,
    levelRequired: 12,
    cost: { gem: 10, stone: 8, wood: 6, fish: 4 },
    stats: { damage: 35, defense: 5, speed: 0.95 },
    ability: {
      name: 'Dragon\'s Wrath',
      description: 'Unleash a devastating combo of strikes imbued with draconic energy, dealing massive area damage.',
    },
  },
  obsidian_shield: {
    id: 'obsidian_shield',
    emoji: '🌑',
    name: 'Obsidian Shield',
    slot: 'shield',
    tier: 5,
    levelRequired: 12,
    cost: { gem: 8, stone: 10, shell: 5 },
    stats: { damage: 4, defense: 25, speed: 0.85 },
    ability: {
      name: 'Void Absorption',
      description: 'The shield absorbs incoming damage and converts it into a burst of shadow energy released on your next attack.',
    },
  },
  legendary_armor: {
    id: 'legendary_armor',
    emoji: '👑',
    name: 'Legendary Armor',
    slot: 'armor',
    tier: 5,
    levelRequired: 12,
    cost: { gem: 12, stone: 8, herb: 6, shell: 4 },
    stats: { damage: 5, defense: 30, speed: 0.9 },
    ability: {
      name: 'Sovereign\'s Aura',
      description: 'Emanate a regal presence that boosts nearby allies\' damage and defense while reducing enemy morale.',
    },
  },
};

// --- Helpers ---

/** Get all gear definitions for a given slot. */
export function getGearBySlot(slot: EquipmentSlot): GearDef[] {
  return Object.values(GEAR_DEFS).filter((g) => g.slot === slot);
}

/** Get all gear definitions for a given tier. */
export function getGearByTier(tier: GearTier): GearDef[] {
  return Object.values(GEAR_DEFS).filter((g) => g.tier === tier);
}

/** Get gear definitions available at or below a given player level. */
export function getGearForLevel(level: number): GearDef[] {
  return Object.values(GEAR_DEFS).filter((g) => g.levelRequired <= level);
}

// --- Storage Keys ---

const STORAGE_KEY_EQUIPMENT = 'gallax_equipped_gear';
const STORAGE_KEY_CRAFTED = 'gallax_crafted_items';

// --- Weapon System ---

export class WeaponSystem {
  private inventory: Inventory;
  private equipped: EquippedGear;
  private craftedItems: Map<string, CraftedItem>; // gearId -> CraftedItem
  private playerLevel: number;
  private onChangeCallbacks: (() => void)[] = [];

  constructor(inventory: Inventory, playerLevel: number = 1) {
    this.inventory = inventory;
    this.playerLevel = playerLevel;
    this.equipped = { weapon: null, armor: null, shield: null };
    this.craftedItems = new Map();
    this.loadFromStorage();
  }

  // --- Player Level ---

  getPlayerLevel(): number {
    return this.playerLevel;
  }

  setPlayerLevel(level: number): void {
    this.playerLevel = Math.max(1, level);
    this.notifyChange();
  }

  // --- Crafting ---

  /**
   * Check whether the player can craft a specific piece of gear.
   * Returns an object with the result and, on failure, a human-readable reason.
   */
  canCraft(gearId: string): { ok: boolean; reason?: string } {
    const def = GEAR_DEFS[gearId];
    if (!def) {
      return { ok: false, reason: 'Unknown gear.' };
    }

    if (this.craftedItems.has(gearId)) {
      return { ok: false, reason: `${def.name} has already been crafted.` };
    }

    if (this.playerLevel < def.levelRequired) {
      return {
        ok: false,
        reason: `Requires level ${def.levelRequired} (current: ${this.playerLevel}).`,
      };
    }

    for (const [resource, amount] of Object.entries(def.cost) as [ResourceType, number][]) {
      if (!this.inventory.has(resource, amount)) {
        const have = this.inventory.get(resource);
        return {
          ok: false,
          reason: `Not enough ${resource} (need ${amount}, have ${have}).`,
        };
      }
    }

    return { ok: true };
  }

  /**
   * Craft a piece of gear, consuming resources from the inventory.
   * Returns true on success. On failure returns false (check `canCraft` for reason).
   */
  craft(gearId: string): boolean {
    const check = this.canCraft(gearId);
    if (!check.ok) return false;

    const def = GEAR_DEFS[gearId];

    // Deduct resources
    for (const [resource, amount] of Object.entries(def.cost) as [ResourceType, number][]) {
      this.inventory.remove(resource, amount);
    }

    this.craftedItems.set(gearId, {
      gearId,
      craftedAt: Date.now(),
    });

    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /** Returns true if the player has already crafted this gear. */
  hasCrafted(gearId: string): boolean {
    return this.craftedItems.has(gearId);
  }

  /** Get all crafted items. */
  getCraftedItems(): CraftedItem[] {
    return Array.from(this.craftedItems.values());
  }

  // --- Equipping ---

  /**
   * Equip a previously crafted piece of gear into its slot.
   * Automatically unequips whatever was in that slot before.
   * Returns true on success.
   */
  equip(gearId: string): boolean {
    const def = GEAR_DEFS[gearId];
    if (!def) return false;

    if (!this.craftedItems.has(gearId)) return false;

    if (this.playerLevel < def.levelRequired) return false;

    // Unequip current item in this slot (if any)
    this.equipped[def.slot] = gearId;

    this.saveToStorage();
    this.notifyChange();
    return true;
  }

  /**
   * Unequip the gear in the given slot.
   * Returns the gear id that was unequipped, or null if the slot was empty.
   */
  unequip(slot: EquipmentSlot): string | null {
    const prev = this.equipped[slot];
    if (!prev) return null;

    this.equipped[slot] = null;
    this.saveToStorage();
    this.notifyChange();
    return prev;
  }

  /** Get what is currently equipped in a given slot. */
  getEquipped(slot: EquipmentSlot): GearDef | null {
    const gearId = this.equipped[slot];
    if (!gearId) return null;
    return GEAR_DEFS[gearId] ?? null;
  }

  /** Get the full equipped loadout. */
  getLoadout(): EquippedGear {
    return { ...this.equipped };
  }

  // --- Stats ---

  /** Compute the combined stats of all currently equipped gear. */
  getCombinedStats(): GearStats {
    const stats: GearStats = { damage: 0, defense: 0, speed: 1.0 };

    for (const slot of ['weapon', 'armor', 'shield'] as EquipmentSlot[]) {
      const def = this.getEquipped(slot);
      if (!def) continue;

      stats.damage += def.stats.damage;
      stats.defense += def.stats.defense;
      // Speed multipliers stack multiplicatively
      stats.speed *= def.stats.speed;
    }

    // Round speed to 2 decimal places to avoid floating-point drift
    stats.speed = Math.round(stats.speed * 100) / 100;

    return stats;
  }

  /** Get a formatted summary of all equipped gear and combined stats. */
  getLoadoutSummary(): string {
    const lines: string[] = [];

    for (const slot of ['weapon', 'armor', 'shield'] as EquipmentSlot[]) {
      const def = this.getEquipped(slot);
      const label = slot.charAt(0).toUpperCase() + slot.slice(1);
      if (def) {
        lines.push(`${label}: ${def.emoji} ${def.name} (T${def.tier})`);
      } else {
        lines.push(`${label}: —`);
      }
    }

    const stats = this.getCombinedStats();
    lines.push('');
    lines.push(`DMG: ${stats.damage}  DEF: ${stats.defense}  SPD: ${stats.speed}x`);

    return lines.join('\n');
  }

  // --- Abilities ---

  /** Get the special abilities of all equipped gear. */
  getEquippedAbilities(): { gear: GearDef; ability: SpecialAbility }[] {
    const abilities: { gear: GearDef; ability: SpecialAbility }[] = [];

    for (const slot of ['weapon', 'armor', 'shield'] as EquipmentSlot[]) {
      const def = this.getEquipped(slot);
      if (def) {
        abilities.push({ gear: def, ability: def.ability });
      }
    }

    return abilities;
  }

  // --- Persistence ---

  private saveToStorage(): void {
    try {
      const equipData = JSON.stringify(this.equipped);
      localStorage.setItem(STORAGE_KEY_EQUIPMENT, equipData);

      const craftedData = JSON.stringify(Array.from(this.craftedItems.entries()));
      localStorage.setItem(STORAGE_KEY_CRAFTED, craftedData);
    } catch {
      // localStorage may be unavailable (SSR, private browsing quota, etc.)
    }
  }

  private loadFromStorage(): void {
    try {
      const equipRaw = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
      if (equipRaw) {
        const parsed = JSON.parse(equipRaw) as Partial<EquippedGear>;
        // Validate that equipped items still exist in GEAR_DEFS
        for (const slot of ['weapon', 'armor', 'shield'] as EquipmentSlot[]) {
          const gearId = parsed[slot];
          if (gearId && GEAR_DEFS[gearId]) {
            this.equipped[slot] = gearId;
          }
        }
      }

      const craftedRaw = localStorage.getItem(STORAGE_KEY_CRAFTED);
      if (craftedRaw) {
        const entries = JSON.parse(craftedRaw) as [string, CraftedItem][];
        for (const [key, value] of entries) {
          // Only restore items that still exist in GEAR_DEFS
          if (GEAR_DEFS[key]) {
            this.craftedItems.set(key, value);
          }
        }
      }
    } catch {
      // Corrupted or unavailable storage — start fresh
    }
  }

  /** Clear all persisted data (useful for account reset). */
  resetAll(): void {
    this.equipped = { weapon: null, armor: null, shield: null };
    this.craftedItems.clear();
    this.saveToStorage();
    this.notifyChange();
  }

  // --- Change Subscription ---

  /** Subscribe to changes in equipment or crafted items. */
  onChange(callback: () => void): void {
    this.onChangeCallbacks.push(callback);
  }

  /** Remove a previously registered change callback. */
  offChange(callback: () => void): void {
    this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback);
  }

  private notifyChange(): void {
    for (const callback of this.onChangeCallbacks) {
      callback();
    }
  }
}

// Resource types that can be collected
export type ResourceType = 'wood' | 'stone' | 'fish' | 'gem' | 'shell' | 'herb';

// Resource definitions with emoji and display name
export const RESOURCE_INFO: Record<ResourceType, { emoji: string; name: string }> = {
  wood: { emoji: '🪵', name: 'Wood' },
  stone: { emoji: '🪨', name: 'Stone' },
  fish: { emoji: '🐟', name: 'Fish' },
  gem: { emoji: '💎', name: 'Gem' },
  shell: { emoji: '🐚', name: 'Shell' },
  herb: { emoji: '🌿', name: 'Herb' },
};

// Map source emojis to resource types
export const EMOJI_TO_RESOURCE: Record<string, ResourceType> = {
  // Trees → Wood
  '🌲': 'wood', '🌳': 'wood', '🌴': 'wood', '🌵': 'wood',
  '🎋': 'wood', '🎍': 'wood', '🪴': 'wood',
  // Herbs
  '🌿': 'herb', '🍀': 'herb', '☘️': 'herb', '🍃': 'herb',
  '🌱': 'herb', '🌾': 'herb',
  // Fish
  '🐟': 'fish', '🐠': 'fish', '🐡': 'fish', '🦈': 'fish',
  '🐳': 'fish', '🐋': 'fish', '🐬': 'fish', '🦭': 'fish',
  '🦑': 'fish', '🐙': 'fish', '🦞': 'fish', '🦀': 'fish', '🦐': 'fish',
  // Shells (sand/beach)
  '🐚': 'shell', '🏖️': 'shell',
  // Rocks/Gems
  '🪨': 'stone', '⛏️': 'stone',
  '💎': 'gem', '💍': 'gem',
};

export class Inventory {
  private items: Map<ResourceType, number> = new Map();
  private maxStack = 999;
  private onChangeCallbacks: (() => void)[] = [];

  constructor() {
    // Initialize all resource types to 0
    for (const type of Object.keys(RESOURCE_INFO) as ResourceType[]) {
      this.items.set(type, 0);
    }
  }

  // Add resource to inventory
  add(type: ResourceType, amount: number = 1): boolean {
    const current = this.items.get(type) || 0;
    const newAmount = Math.min(current + amount, this.maxStack);
    this.items.set(type, newAmount);
    this.notifyChange();
    return true;
  }

  // Remove resource from inventory
  remove(type: ResourceType, amount: number = 1): boolean {
    const current = this.items.get(type) || 0;
    if (current < amount) return false;
    this.items.set(type, current - amount);
    this.notifyChange();
    return true;
  }

  // Get count of a resource
  get(type: ResourceType): number {
    return this.items.get(type) || 0;
  }

  // Get all items
  getAll(): Map<ResourceType, number> {
    return new Map(this.items);
  }

  // Check if has enough of a resource
  has(type: ResourceType, amount: number = 1): boolean {
    return (this.items.get(type) || 0) >= amount;
  }

  // Get total items count
  getTotalCount(): number {
    let total = 0;
    for (const count of this.items.values()) {
      total += count;
    }
    return total;
  }

  // Subscribe to inventory changes
  onChange(callback: () => void): void {
    this.onChangeCallbacks.push(callback);
  }

  private notifyChange(): void {
    for (const callback of this.onChangeCallbacks) {
      callback();
    }
  }
}


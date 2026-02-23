import { Inventory, ResourceType } from './Inventory';
import { BUILDING_DEFS, BuildingDef } from './BuildingManager';

export class CraftingSystem {
  private inventory: Inventory;
  private selectedBuilding: string | null = null;
  private onSelectCallback: ((buildingType: string | null) => void) | null = null;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
  }

  // Check if player can afford a building
  canCraft(buildingType: string): boolean {
    const def = BUILDING_DEFS[buildingType];
    if (!def) return false;

    for (const [resource, amount] of Object.entries(def.cost)) {
      if (!this.inventory.has(resource as ResourceType, amount as number)) {
        return false;
      }
    }
    return true;
  }

  // Consume resources for crafting
  craft(buildingType: string): boolean {
    if (!this.canCraft(buildingType)) return false;

    const def = BUILDING_DEFS[buildingType];
    for (const [resource, amount] of Object.entries(def.cost)) {
      this.inventory.remove(resource as ResourceType, amount as number);
    }

    return true;
  }

  // Get all available building types with their craftability
  getAvailableBuildings(): { type: string; def: BuildingDef; canCraft: boolean }[] {
    return Object.entries(BUILDING_DEFS).map(([type, def]) => ({
      type,
      def,
      canCraft: this.canCraft(type),
    }));
  }

  // Select a building type to place
  selectBuilding(buildingType: string | null): void {
    this.selectedBuilding = buildingType;
    if (this.onSelectCallback) {
      this.onSelectCallback(buildingType);
    }
  }

  getSelectedBuilding(): string | null {
    return this.selectedBuilding;
  }

  onSelect(callback: (buildingType: string | null) => void): void {
    this.onSelectCallback = callback;
  }
}


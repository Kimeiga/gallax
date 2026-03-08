// Resource production system - buildings generate resources over time
import { ResourceType } from './Inventory';

export interface ProductionBuilding {
  buildingId: string;
  buildingType: string;
  resourceType: ResourceType;
  productionRate: number; // resources per hour
  lastCollected: number; // timestamp
  accumulatedResources: number;
}

export class ResourceProductionSystem {
  private buildings: Map<string, ProductionBuilding> = new Map();
  private readonly MAX_ACCUMULATION_HOURS = 8; // Max 8 hours of production

  // Production rates for different building types (resources per hour)
  private readonly PRODUCTION_RATES: Record<string, { resource: ResourceType; rate: number }> = {
    farm: { resource: 'wood', rate: 10 },
    shop: { resource: 'gem', rate: 5 },
    dock: { resource: 'fish', rate: 8 },
    tower: { resource: 'stone', rate: 6 },
  };

  constructor() {
    this.loadBuildings();
    this.startProductionLoop();
  }

  private async loadBuildings(): Promise<void> {
    // Check if cache is still valid
    const isValid = await this.validateCache();
    if (!isValid) {
      console.log('🔄 Cache invalidated, clearing production buildings');
      localStorage.removeItem('gallax_production_buildings');
      localStorage.removeItem('gallax_buildings_version');
      return;
    }

    const saved = localStorage.getItem('gallax_production_buildings');
    if (saved) {
      const data = JSON.parse(saved);
      this.buildings = new Map(Object.entries(data));
    }
  }

  private async validateCache(): Promise<boolean> {
    try {
      const response = await fetch('/api/game-version');
      const { buildings_version } = await response.json();

      const cachedVersion = localStorage.getItem('gallax_buildings_version');

      if (cachedVersion !== buildings_version) {
        // Version mismatch - cache is invalid
        localStorage.setItem('gallax_buildings_version', buildings_version);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Failed to validate cache:', err);
      return true; // On error, keep cache to avoid data loss
    }
  }

  private saveBuildings(): void {
    const data = Object.fromEntries(this.buildings);
    localStorage.setItem('gallax_production_buildings', JSON.stringify(data));
  }

  registerBuilding(buildingId: string, buildingType: string): void {
    const productionInfo = this.PRODUCTION_RATES[buildingType];
    if (!productionInfo) return; // Building doesn't produce resources

    const building: ProductionBuilding = {
      buildingId,
      buildingType,
      resourceType: productionInfo.resource,
      productionRate: productionInfo.rate,
      lastCollected: Date.now(),
      accumulatedResources: 0,
    };

    this.buildings.set(buildingId, building);
    this.saveBuildings();
  }

  private updateProduction(): void {
    const now = Date.now();
    
    this.buildings.forEach((building) => {
      const hoursSinceLastCollect = (now - building.lastCollected) / (1000 * 60 * 60);
      const maxHours = Math.min(hoursSinceLastCollect, this.MAX_ACCUMULATION_HOURS);
      const produced = building.productionRate * maxHours;
      
      building.accumulatedResources = Math.floor(produced);
    });
  }

  collectResources(buildingId: string): { resource: ResourceType; amount: number } | null {
    const building = this.buildings.get(buildingId);
    if (!building) return null;

    this.updateProduction();

    const amount = building.accumulatedResources;
    if (amount === 0) return null;

    building.accumulatedResources = 0;
    building.lastCollected = Date.now();
    this.saveBuildings();

    return {
      resource: building.resourceType,
      amount,
    };
  }

  getAccumulatedResources(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    this.updateProduction();
    return building.accumulatedResources;
  }

  getAllProducingBuildings(): ProductionBuilding[] {
    this.updateProduction();
    return Array.from(this.buildings.values());
  }

  private startProductionLoop(): void {
    // Update production every minute
    setInterval(() => {
      this.updateProduction();
    }, 60000);
  }

  getTotalProduction(): Map<ResourceType, number> {
    const totals = new Map<ResourceType, number>();
    
    this.buildings.forEach((building) => {
      const current = totals.get(building.resourceType) || 0;
      totals.set(building.resourceType, current + building.accumulatedResources);
    });

    return totals;
  }
}

export const resourceProductionSystem = new ResourceProductionSystem();


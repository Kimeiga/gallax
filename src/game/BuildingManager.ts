import { Application, Text, TextStyle } from 'pixi.js';
import { MapManager } from '../map/MapManager';
import { NetworkBuilding } from '../network/NetworkManager';

// Building definitions with emojis and crafting costs
export interface BuildingDef {
  emoji: string;
  name: string;
  cost: { wood?: number; stone?: number; fish?: number; gem?: number; shell?: number; herb?: number };
}

export const BUILDING_DEFS: Record<string, BuildingDef> = {
  house: {
    emoji: '🏠',
    name: 'House',
    cost: {}, // Free for testing
  },
  farm: {
    emoji: '🌾',
    name: 'Farm',
    cost: {}, // Free for testing
  },
  shop: {
    emoji: '🏪',
    name: 'Shop',
    cost: {}, // Free for testing
  },
  dock: {
    emoji: '⚓',
    name: 'Dock',
    cost: {}, // Free for testing
  },
  tower: {
    emoji: '🗼',
    name: 'Tower',
    cost: {}, // Free for testing
  },
};

interface PlacedBuilding {
  id: string;
  type: string;
  text: Text;
  lng: number;
  lat: number;
  ownerId: string;
  rotation: number; // Rotation in radians
}

export class BuildingManager {
  private buildings: Map<string, PlacedBuilding> = new Map();
  private mapManager: MapManager;
  private app: Application;
  private readonly baseZoom = 16;

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  addBuilding(building: NetworkBuilding): void {
    if (this.buildings.has(building.id)) return;

    const def = BUILDING_DEFS[building.type];
    if (!def) return;

    const style = new TextStyle({
      fontSize: 32,
      align: 'center',
    });

    const text = new Text({ text: def.emoji, style });
    text.anchor.set(0.5, 0.5); // Center anchor for proper rotation

    this.app.stage.addChild(text);

    const placed: PlacedBuilding = {
      id: building.id,
      type: building.type,
      text,
      lng: building.lng,
      lat: building.lat,
      ownerId: building.ownerId,
      rotation: building.rotation || 0,
    };

    this.buildings.set(building.id, placed);
    this.updateBuildingPosition(placed);
  }

  removeBuilding(buildingId: string): void {
    const building = this.buildings.get(buildingId);
    if (building) {
      building.text.destroy();
      this.buildings.delete(buildingId);
    }
  }

  // Update building rotation
  rotateBuilding(buildingId: string, rotation: number): void {
    const building = this.buildings.get(buildingId);
    if (building) {
      building.rotation = rotation;
      building.text.rotation = rotation;
    }
  }

  // Get building at screen position (for click detection)
  getBuildingAtPosition(screenX: number, screenY: number): PlacedBuilding | null {
    for (const building of this.buildings.values()) {
      const bounds = building.text.getBounds();
      if (
        screenX >= bounds.x &&
        screenX <= bounds.x + bounds.width &&
        screenY >= bounds.y &&
        screenY <= bounds.y + bounds.height
      ) {
        return building;
      }
    }
    return null;
  }

  private updateBuildingPosition(building: PlacedBuilding): void {
    const screenPos = this.mapManager.project({ lng: building.lng, lat: building.lat });
    building.text.x = Math.round(screenPos.x);
    building.text.y = Math.round(screenPos.y);

    // Scale based on zoom
    const zoom = this.mapManager.getZoom();
    const scale = Math.pow(2, zoom - this.baseZoom) * 1.5;
    building.text.scale.set(scale);

    // Apply rotation
    building.text.rotation = building.rotation;
  }

  updateAllPositions(): void {
    for (const building of this.buildings.values()) {
      this.updateBuildingPosition(building);
    }
  }

  getBuildings(): Map<string, PlacedBuilding> {
    return this.buildings;
  }
}


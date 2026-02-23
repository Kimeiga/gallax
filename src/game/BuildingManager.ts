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
    cost: { wood: 10, stone: 5 },
  },
  farm: {
    emoji: '🌾',
    name: 'Farm',
    cost: { wood: 5, herb: 3 },
  },
  shop: {
    emoji: '🏪',
    name: 'Shop',
    cost: { wood: 8, stone: 8, gem: 2 },
  },
  dock: {
    emoji: '⚓',
    name: 'Dock',
    cost: { wood: 15, fish: 5, shell: 3 },
  },
  tower: {
    emoji: '🗼',
    name: 'Tower',
    cost: { stone: 20, gem: 5 },
  },
};

interface PlacedBuilding {
  id: string;
  type: string;
  text: Text;
  lng: number;
  lat: number;
  ownerId: string;
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
    text.anchor.set(0.5, 1);

    this.app.stage.addChild(text);

    const placed: PlacedBuilding = {
      id: building.id,
      type: building.type,
      text,
      lng: building.lng,
      lat: building.lat,
      ownerId: building.ownerId,
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

  private updateBuildingPosition(building: PlacedBuilding): void {
    const screenPos = this.mapManager.project({ lng: building.lng, lat: building.lat });
    building.text.x = Math.round(screenPos.x);
    building.text.y = Math.round(screenPos.y);

    // Scale based on zoom
    const zoom = this.mapManager.getZoom();
    const scale = Math.pow(2, zoom - this.baseZoom) * 1.5;
    building.text.scale.set(scale);
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


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
  // Free Home (one per player)
  my_home: { emoji: '🏡', name: 'My Home', cost: {} },

  // Starter Buildings
  tent: { emoji: '⛺', name: 'Tent', cost: { wood: 2, herb: 1 } },
  hut: { emoji: '🛖', name: 'Hut', cost: { wood: 3 } },
  campfire: { emoji: '🔥', name: 'Campfire', cost: { wood: 3 } },
  flag: { emoji: '🚩', name: 'Flag', cost: { herb: 1, wood: 1 } },

  // Basic Buildings
  house: { emoji: '🏠', name: 'House', cost: { wood: 5, stone: 3 } },
  house_garden: { emoji: '🏡', name: 'Garden House', cost: { wood: 6, stone: 3, herb: 2 } },
  farm: { emoji: '🌾', name: 'Farm', cost: { wood: 4, herb: 3 } },
  shop: { emoji: '🏪', name: 'Shop', cost: { wood: 6, stone: 4 } },

  // Water Buildings
  dock: { emoji: '⚓', name: 'Dock', cost: { wood: 5, fish: 3, shell: 2 } },
  lighthouse: { emoji: '🗼', name: 'Lighthouse', cost: { stone: 6, gem: 3 } },
  sailboat: { emoji: '⛵', name: 'Sailboat', cost: { wood: 8, shell: 3 } },

  // Civic Buildings
  school: { emoji: '🏫', name: 'School', cost: { stone: 8, wood: 6, herb: 2 } },
  hospital: { emoji: '🏥', name: 'Hospital', cost: { stone: 10, herb: 5, gem: 2 } },
  bank: { emoji: '🏦', name: 'Bank', cost: { stone: 12, gem: 5 } },
  factory: { emoji: '🏭', name: 'Factory', cost: { stone: 8, gem: 2 } },

  // Cultural Buildings
  shrine: { emoji: '⛩️', name: 'Shrine', cost: { stone: 8, wood: 8, gem: 4 } },
  fountain: { emoji: '⛲', name: 'Fountain', cost: { stone: 6, shell: 4, gem: 2 } },
  stadium: { emoji: '🏟️', name: 'Stadium', cost: { stone: 15, wood: 10 } },
  ferris_wheel: { emoji: '🎡', name: 'Ferris Wheel', cost: { stone: 10, gem: 5, wood: 8 } },
  circus: { emoji: '🎪', name: 'Circus Tent', cost: { wood: 8, herb: 4 } },

  // Decorative
  planted_tree: { emoji: '🌳', name: 'Planted Tree', cost: { herb: 2 } },
  cherry_blossom: { emoji: '🌸', name: 'Cherry Blossom', cost: { herb: 3, gem: 1 } },
  lantern: { emoji: '🏮', name: 'Lantern', cost: { wood: 1, gem: 1 } },
  windchime: { emoji: '🎐', name: 'Wind Chime', cost: { shell: 2, gem: 1 } },
  carp_streamer: { emoji: '🎏', name: 'Carp Streamer', cost: { fish: 2, herb: 2 } },

  // Luxury Buildings
  castle: { emoji: '🏰', name: 'Castle', cost: { stone: 20, wood: 15, gem: 8 } },
  hotel: { emoji: '🏨', name: 'Hotel', cost: { stone: 15, wood: 10, gem: 5 } },
  department_store: { emoji: '🏬', name: 'Department Store', cost: { stone: 12, wood: 8, gem: 4 } },

  // Special/Rare
  rocket: { emoji: '🚀', name: 'Rocket', cost: { gem: 15, stone: 10 } },
  monument: { emoji: '🗽', name: 'Monument', cost: { stone: 25, gem: 10 } },
  moai: { emoji: '🗿', name: 'Moai', cost: { stone: 20, gem: 8 } },
};

interface PlacedBuilding {
  id: string;
  type: string;
  text: Text;
  nameTag?: Text;
  lng: number;
  lat: number;
  ownerId: string;
  ownerName?: string;
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
    console.log(`🏗️ BuildingManager.addBuilding: id=${building.id} type=${building.type} at ${building.lng},${building.lat}`);
    if (this.buildings.has(building.id)) {
      console.log(`🏗️ Building ${building.id} already exists, skipping`);
      return;
    }

    const def = BUILDING_DEFS[building.type];
    if (!def) {
      console.error(`🏗️ Unknown building type: ${building.type}`);
      return;
    }

    const style = new TextStyle({
      fontSize: 32,
      align: 'center',
    });

    const text = new Text({ text: def.emoji, style });
    text.anchor.set(0.5, 0.5); // Center anchor for proper rotation

    this.app.stage.addChild(text);

    // Add name tag for home buildings
    let nameTag: Text | undefined;
    if (building.type === 'my_home') {
      const ownerName = building.ownerName || 'Someone';
      const nameStyle = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      });
      nameTag = new Text({ text: `${ownerName}'s Home`, style: nameStyle });
      nameTag.anchor.set(0.5, 1);
      this.app.stage.addChild(nameTag);
    }

    const placed: PlacedBuilding = {
      id: building.id,
      type: building.type,
      text,
      nameTag,
      lng: building.lng,
      lat: building.lat,
      ownerId: building.ownerId,
      ownerName: building.ownerName,
      rotation: building.rotation || 0,
    };

    this.buildings.set(building.id, placed);
    this.updateBuildingPosition(placed);

    // Restore saved emoji and tint for homes
    if (building.type === 'my_home') {
      const savedEmoji = localStorage.getItem(`gallax_home_emoji_${building.id}`);
      if (savedEmoji) text.text = savedEmoji;
      const savedTint = localStorage.getItem(`gallax_home_tint_${building.id}`);
      if (savedTint) {
        if (savedTint.startsWith('#')) {
          text.tint = parseInt(savedTint.slice(1), 16);
        } else {
          // Legacy numeric index format
          const hueToTint = [0xffffff, 0xff9999, 0xffff99, 0x99ff99, 0x99ffff, 0x9999ff];
          text.tint = hueToTint[parseInt(savedTint)] || 0xffffff;
        }
      }
    }

    console.log(`🏗️ Building rendered! emoji=${def.emoji} total=${this.buildings.size}`);
  }

  // Update the name tag on all buildings owned by a player (e.g. after rename)
  updateOwnerName(ownerId: string, newName: string): void {
    for (const building of this.buildings.values()) {
      if (building.ownerId === ownerId && building.nameTag) {
        building.ownerName = newName;
        building.nameTag.text = `${newName}'s Home`;
      }
    }
  }

  removeBuilding(buildingId: string): void {
    const building = this.buildings.get(buildingId);
    if (building) {
      building.text.destroy();
      if (building.nameTag) building.nameTag.destroy();
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

  // Move building to new location
  moveBuilding(buildingId: string, lng: number, lat: number): void {
    const building = this.buildings.get(buildingId);
    if (building) {
      building.lng = lng;
      building.lat = lat;
      this.updateBuildingPosition(building);
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

    // Apply rotation, accounting for map bearing
    const mapBearing = this.mapManager.getBearing() * (Math.PI / 180);
    building.text.rotation = building.rotation - mapBearing;

    // Position name tag above building
    if (building.nameTag) {
      building.nameTag.x = Math.round(screenPos.x);
      building.nameTag.y = Math.round(screenPos.y) - (18 * scale);
      const nameScale = Math.max(0.5, Math.min(1.0, scale * 0.6));
      building.nameTag.scale.set(nameScale);
    }
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


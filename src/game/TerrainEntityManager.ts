import { Application, Text, TextStyle } from 'pixi.js';
import type { MapboxGeoJSONFeature } from 'mapbox-gl';
import { MapManager } from '../map/MapManager';

// Emoji sets for different terrain types
const EMOJIS = {
  // Landuse types
  cemetery: ['🪦', '⚰️', '👻', '💀', '🦇', '🕯️'],
  sand: ['🐚', '🦀', '🏖️', '🐢', '🦞', '🪸'],
  rock: ['🪨', '�ite', '💎', '⛏️', '🔶', '🔷'],
  hospital: ['🏥', '💊', '💉', '🩺', '❤️‍🩹', '🚑'],
  school: ['🏫', '📚', '✏️', '🎓', '📖', '🎒'],
  parking: ['🚗', '🚙', '🚕', '🏍️', '🚲', '🛵'],
  glacier: ['🧊', '❄️', '🏔️', '⛄', '🐧', '🦭'],
  wetland: ['🐸', '🦆', '🦢', '🪷', '🌾', '🦩'],
  // POI types
  restaurant: ['🍽️', '🍕', '🍔', '🌮', '🍜', '🍣'],
  cafe: ['☕', '🧋', '🍩', '🥐', '🧁', '🍪'],
  bar: ['🍺', '🍻', '🍷', '🥂', '🍸', '🥃'],
  shop: ['🛒', '🛍️', '💰', '🏪', '🎁', '📦'],
  museum: ['🏛️', '🖼️', '🗿', '🎨', '🏺', '📜'],
  park_poi: ['🎡', '🎢', '🎠', '⛲', '🌷', '🎪'],
  // Transit
  bus_stop: ['🚌', '🚏', '🎫'],
  train_station: ['🚂', '🚃', '🚉', '🎫'],
  airport: ['✈️', '🛫', '🛬', '🧳'],
  // Rail (moving)
  rail: ['🚂', '🚃', '🚄', '🚅', '🚆', '🚇'],
};

class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
  pick<T>(array: T[]): T { return array[Math.floor(this.next() * array.length)]; }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export interface TerrainEntity {
  id: string;
  cellId: string; // The cell this entity belongs to
  type: string;
  emoji: string;
  text: Text;
  lng: number;
  lat: number;
  vx?: number;
  vy?: number;
  isMoving: boolean;
  seed: number;
  nextDirectionChange?: number;
  // Rail path following
  railPath?: [number, number][]; // Array of [lng, lat] coordinates
  pathIndex?: number; // Current position on path
  pathDirection?: 1 | -1; // 1 = forward, -1 = backward
  pathProgress?: number; // Progress between current and next point (0-1)
}

export class TerrainEntityManager {
  private entities: Map<string, TerrainEntity> = new Map();
  private mapManager: MapManager;
  private app: Application;
  private spawnedCells: Set<string> = new Set();
  private readonly baseZoom = 16;
  private readonly moveSpeed = 0.000005;

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  spawnEntitiesInView(): void {
    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const cellSize = 0.003;

    for (let lng = Math.floor(sw.lng / cellSize) * cellSize; lng < ne.lng; lng += cellSize) {
      for (let lat = Math.floor(sw.lat / cellSize) * cellSize; lat < ne.lat; lat += cellSize) {
        const cellId = `terrain-${lng.toFixed(4)},${lat.toFixed(4)}`;
        if (this.spawnedCells.has(cellId)) continue;
        this.spawnedCells.add(cellId);

        const seed = hashString(cellId);
        const rng = new SeededRandom(seed);
        const centerLng = lng + cellSize / 2;
        const centerLat = lat + cellSize / 2;

        // Check what terrain is at this cell center
        const terrainType = this.getTerrainType(centerLng, centerLat);
        if (terrainType && EMOJIS[terrainType as keyof typeof EMOJIS]) {
          const entityLng = rng.range(lng, lng + cellSize);
          const entityLat = rng.range(lat, lat + cellSize);
          this.spawnEntity(entityLng, entityLat, terrainType, rng, cellId);
          if (terrainType === 'rail') {
            console.log('🚂 Spawned train at:', entityLng, entityLat);
          }
        }
      }
    }

    // Also spawn POIs
    this.spawnPOIsInView();

    // Also try to spawn rail entities by querying rail lines directly
    this.spawnRailEntities();
  }

  private spawnRailEntities(): void {
    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = map.project(bounds.getSouthWest());
    const ne = map.project(bounds.getNorthEast());

    // Query for rail features
    const railFeatures = map.queryRenderedFeatures([sw, ne]);

    for (const f of railFeatures as MapboxGeoJSONFeature[]) {
      const sourceLayer = f.sourceLayer || '';
      const landClass = f.properties?.class || '';

      // Check if this is a rail feature
      const isRail = sourceLayer === 'road' &&
        (landClass === 'major_rail' || landClass === 'minor_rail' || landClass === 'service_rail');

      if (!isRail) continue;

      // Get coordinates from the geometry
      const geometry = f.geometry as any;
      if (!geometry || !geometry.coordinates) continue;

      // Extract the path from the geometry
      let path: [number, number][] = [];
      if (geometry.type === 'LineString' && geometry.coordinates.length >= 2) {
        path = geometry.coordinates.map((c: number[]) => [c[0], c[1]] as [number, number]);
      } else if (geometry.type === 'MultiLineString' && geometry.coordinates.length > 0) {
        // Use the longest line segment
        let longestLine = geometry.coordinates[0];
        for (const line of geometry.coordinates) {
          if (line.length > longestLine.length) longestLine = line;
        }
        path = longestLine.map((c: number[]) => [c[0], c[1]] as [number, number]);
      }

      if (path.length < 2) continue;

      // Use the first point of the path as the spawn location
      const lng = path[0][0];
      const lat = path[0][1];

      // Create unique ID based on the path geometry
      const pathKey = `${path[0][0].toFixed(5)}-${path[0][1].toFixed(5)}-${path.length}`;
      const id = `rail-${pathKey}`;

      if (this.entities.has(id) || this.spawnedCells.has(id)) continue;
      this.spawnedCells.add(id);

      const rng = new SeededRandom(hashString(id));
      this.spawnRailTrain(lng, lat, path, rng, id); // id serves as cellId for rail trains
      console.log('🚂 Spawned train on rail path with', path.length, 'points');
    }
  }

  private spawnRailTrain(lng: number, lat: number, path: [number, number][], rng: SeededRandom, cellId: string): void {
    if (this.entities.has(cellId)) return;

    const emoji = rng.pick(EMOJIS.rail);
    const style = new TextStyle({ fontSize: 22 });
    const text = new Text({ text: emoji, style });
    text.anchor.set(0.5, 0.5);
    this.app.stage.addChild(text);

    const entity: TerrainEntity = {
      id: cellId,
      cellId,
      type: 'rail',
      emoji,
      text,
      lng,
      lat,
      isMoving: true,
      seed: hashString(cellId),
      railPath: path,
      pathIndex: 0,
      pathDirection: 1,
      pathProgress: 0,
    };

    this.entities.set(cellId, entity);
    this.updateEntityPosition(entity);
  }

  private getTerrainType(lng: number, lat: number): string | null {
    const map = this.mapManager.getMap();
    const point = this.mapManager.project({ lng, lat });
    const features = map.queryRenderedFeatures([point.x, point.y]);

    for (const f of features as MapboxGeoJSONFeature[]) {
      const sourceLayer = f.sourceLayer || '';
      const layerId = f.layer?.id || '';
      const landClass = f.properties?.class;

      // Check landuse classes
      if (sourceLayer === 'landuse') {
        if (landClass === 'cemetery') return 'cemetery';
        if (landClass === 'sand') return 'sand';
        if (landClass === 'rock') return 'rock';
        if (landClass === 'hospital') return 'hospital';
        if (landClass === 'school') return 'school';
        if (landClass === 'parking') return 'parking';
        if (landClass === 'glacier') return 'glacier';
      }

      // Check landuse_overlay
      if (sourceLayer === 'landuse_overlay' && landClass === 'wetland') return 'wetland';

      // Check rail - Mapbox uses major_rail, minor_rail, service_rail classes
      if (sourceLayer === 'road') {
        if (landClass === 'major_rail' || landClass === 'minor_rail' || landClass === 'service_rail') {
          return 'rail';
        }
      }

      // Also check transit layer
      if (sourceLayer === 'transit' || layerId.includes('rail') || layerId.includes('transit')) {
        return 'rail';
      }
    }
    return null;
  }

  // Get a random train entity for following
  getRandomTrain(): { lng: number; lat: number } | null {
    const trains = Array.from(this.entities.values()).filter(e => e.type === 'rail');
    if (trains.length === 0) return null;
    const train = trains[Math.floor(Math.random() * trains.length)];
    return { lng: train.lng, lat: train.lat };
  }

  // Get train being followed (for continuous tracking)
  getTrainPosition(id: string): { lng: number; lat: number } | null {
    const entity = this.entities.get(id);
    if (!entity || entity.type !== 'rail') return null;
    return { lng: entity.lng, lat: entity.lat };
  }

  // Get all trains for UI
  getTrainCount(): number {
    return Array.from(this.entities.values()).filter(e => e.type === 'rail').length;
  }

  private spawnPOIsInView(): void {
    const map = this.mapManager.getMap();
    // Query entire visible viewport for POIs
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = map.project(bounds.getSouthWest());
    const ne = map.project(bounds.getNorthEast());
    const features = map.queryRenderedFeatures([sw, ne], {
      layers: ['poi-label', 'transit-label', 'airport-label']
    });

    for (const f of features as MapboxGeoJSONFeature[]) {
      const coords = (f.geometry as any).coordinates;
      if (!coords || coords.length < 2) continue;

      const lng = coords[0];
      const lat = coords[1];
      const id = `poi-${lng.toFixed(6)}-${lat.toFixed(6)}`;

      if (this.entities.has(id)) continue;

      const maki = f.properties?.maki || '';
      const type = f.properties?.type || '';
      let poiType: string | null = null;

      if (maki.includes('restaurant') || maki.includes('fast-food')) poiType = 'restaurant';
      else if (maki.includes('cafe') || maki.includes('coffee')) poiType = 'cafe';
      else if (maki.includes('bar') || maki.includes('beer')) poiType = 'bar';
      else if (maki.includes('shop') || maki.includes('grocery')) poiType = 'shop';
      else if (maki.includes('museum') || maki.includes('art')) poiType = 'museum';
      else if (maki.includes('park') || maki.includes('playground')) poiType = 'park_poi';
      else if (maki.includes('bus')) poiType = 'bus_stop';
      else if (maki.includes('rail') || type.includes('station')) poiType = 'train_station';
      else if (maki.includes('airport') || maki.includes('airfield')) poiType = 'airport';

      if (poiType && EMOJIS[poiType as keyof typeof EMOJIS]) {
        const rng = new SeededRandom(hashString(id));
        this.spawnEntity(lng, lat, poiType, rng, id); // POIs use their own id as cellId
      }
    }
  }

  private spawnEntity(lng: number, lat: number, type: string, rng: SeededRandom, cellId: string): void {
    const id = `terrain-${type}-${lng.toFixed(6)}-${lat.toFixed(6)}`;
    if (this.entities.has(id)) return;

    const emojiSet = EMOJIS[type as keyof typeof EMOJIS];
    if (!emojiSet) return;

    const emoji = rng.pick(emojiSet);
    const isMoving = type === 'rail';
    const fontSize = type === 'rail' ? 20 : (type.includes('stop') || type.includes('station') ? 16 : 14);

    const style = new TextStyle({ fontSize });
    const text = new Text({ text: emoji, style });
    text.anchor.set(0.5, 0.5);
    this.app.stage.addChild(text);

    const entity: TerrainEntity = {
      id,
      cellId,
      type,
      emoji,
      text,
      lng,
      lat,
      isMoving,
      seed: hashString(id),
    };

    if (isMoving) {
      const angle = rng.range(0, Math.PI * 2);
      entity.vx = Math.cos(angle) * this.moveSpeed;
      entity.vy = Math.sin(angle) * this.moveSpeed;
      entity.nextDirectionChange = Date.now() + rng.range(3000, 6000);
    }

    this.entities.set(id, entity);
    this.updateEntityPosition(entity);
  }

  private updateEntityPosition(entity: TerrainEntity): void {
    const pos = this.mapManager.project({ lng: entity.lng, lat: entity.lat });
    entity.text.x = pos.x;
    entity.text.y = pos.y;
    const zoom = this.mapManager.getZoom();
    const scale = Math.pow(2, zoom - this.baseZoom);
    entity.text.scale.set(scale);
  }

  update(deltaTime: number): void {
    for (const entity of this.entities.values()) {
      if (!entity.isMoving) continue;

      // Check if this is a rail entity with a path
      if (entity.type === 'rail' && entity.railPath && entity.railPath.length >= 2) {
        this.updateRailTrain(entity, deltaTime);
      } else if (entity.vx !== undefined && entity.vy !== undefined) {
        // Random walk for non-rail entities
        const now = Date.now();
        if (now >= (entity.nextDirectionChange || 0)) {
          this.changeDirection(entity, now);
        }
        entity.lng += entity.vx * deltaTime;
        entity.lat += entity.vy * deltaTime;
      }

      this.updateEntityPosition(entity);
    }
  }

  private updateRailTrain(entity: TerrainEntity, deltaTime: number): void {
    if (!entity.railPath || entity.pathIndex === undefined ||
        entity.pathDirection === undefined || entity.pathProgress === undefined) return;

    const path = entity.railPath;
    const speed = 0.0003; // Speed along the path (progress per frame)

    // Move along the path
    entity.pathProgress += speed * deltaTime * entity.pathDirection;

    // Check if we need to move to next segment
    while (entity.pathProgress >= 1 || entity.pathProgress < 0) {
      if (entity.pathProgress >= 1) {
        entity.pathProgress -= 1;
        entity.pathIndex += 1;

        // If we reached the end, reverse direction
        if (entity.pathIndex >= path.length - 1) {
          entity.pathIndex = path.length - 1;
          entity.pathDirection = -1;
          entity.pathProgress = 0;
        }
      } else if (entity.pathProgress < 0) {
        entity.pathProgress += 1;
        entity.pathIndex -= 1;

        // If we reached the start, reverse direction
        if (entity.pathIndex <= 0) {
          entity.pathIndex = 0;
          entity.pathDirection = 1;
          entity.pathProgress = 0;
        }
      }
    }

    // Interpolate position between current and next point
    const currentIdx = entity.pathIndex;
    const nextIdx = Math.min(currentIdx + 1, path.length - 1);
    const t = entity.pathProgress;

    const p1 = path[currentIdx];
    const p2 = path[nextIdx];

    entity.lng = p1[0] + (p2[0] - p1[0]) * t;
    entity.lat = p1[1] + (p2[1] - p1[1]) * t;

    // Flip emoji based on direction
    if (entity.pathDirection === -1) {
      entity.text.scale.x = -Math.abs(entity.text.scale.x);
    } else {
      entity.text.scale.x = Math.abs(entity.text.scale.x);
    }
  }

  private changeDirection(entity: TerrainEntity, now: number): void {
    const rng = new SeededRandom(entity.seed + Math.floor(now / 1000));
    const angle = rng.range(0, Math.PI * 2);
    entity.vx = Math.cos(angle) * this.moveSpeed;
    entity.vy = Math.sin(angle) * this.moveSpeed;
    entity.nextDirectionChange = now + rng.range(3000, 6000);
  }

  updateAllPositions(): void {
    for (const entity of this.entities.values()) {
      this.updateEntityPosition(entity);
    }
  }

  cullDistantEntities(): void {
    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const margin = 0.01;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Track which cells have entities removed
    const cellsWithRemovals = new Set<string>();

    for (const [id, entity] of this.entities) {
      if (entity.lng < sw.lng - margin || entity.lng > ne.lng + margin ||
          entity.lat < sw.lat - margin || entity.lat > ne.lat + margin) {
        entity.text.destroy();
        this.entities.delete(id);
        cellsWithRemovals.add(entity.cellId);
      }
    }

    // Remove cells from spawnedCells if no entities remain in that cell
    // This allows deterministic respawning when the user pans back
    for (const cellId of cellsWithRemovals) {
      const hasEntitiesInCell = Array.from(this.entities.values()).some(e => e.cellId === cellId);
      if (!hasEntitiesInCell) {
        this.spawnedCells.delete(cellId);
      }
    }
  }

  // Get collectible entities (exclude moving vehicles like trains)
  getCollectibleEntities(): Map<string, TerrainEntity> {
    const collectible = new Map<string, TerrainEntity>();
    for (const [id, entity] of this.entities) {
      // Exclude trains and other vehicles
      if (!entity.isMoving) {
        collectible.set(id, entity);
      }
    }
    return collectible;
  }

  // Remove a specific entity by ID
  removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.text.destroy();
      this.entities.delete(id);
    }
  }
}

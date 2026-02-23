import { Application, Text, TextStyle } from 'pixi.js';
import type { MapboxGeoJSONFeature } from 'mapbox-gl';
import { MapManager } from '../map/MapManager';

// Water creature and vehicle emojis
const FISH_EMOJIS = ['🐟', '🐠', '🐡', '🦈', '🐳', '🐋', '🐬', '🦭', '🦑', '🐙', '🦞', '🦀', '🦐'];
const BOAT_EMOJIS = ['⛵', '🚤', '🛥️', '⛴️', '🚢', '🛶', '🚣'];

// Seeded PRNG for deterministic behavior
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export interface WaterEntity {
  id: string;
  cellId: string; // The cell this entity belongs to
  type: 'fish' | 'boat';
  emoji: string;
  text: Text;
  lng: number;
  lat: number;
  vx: number;
  vy: number;
  seed: number;
  nextDirectionChange: number;
}

export class WaterEntityManager {
  private entities: Map<string, WaterEntity> = new Map();
  private mapManager: MapManager;
  private app: Application;
  private spawnedAreas: Set<string> = new Set();

  private readonly baseZoom = 16;
  private readonly moveSpeed = 0.000006;
  private readonly ENTITIES_PER_AREA = 2;
  private readonly DIRECTION_CHANGE_INTERVAL = 4000; // ms

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
    const cellSize = 0.003; // ~300m cells for water

    for (let lng = Math.floor(sw.lng / cellSize) * cellSize; lng < ne.lng; lng += cellSize) {
      for (let lat = Math.floor(sw.lat / cellSize) * cellSize; lat < ne.lat; lat += cellSize) {
        const cellId = `water-${lng.toFixed(4)},${lat.toFixed(4)}`;

        if (this.spawnedAreas.has(cellId)) continue;
        this.spawnedAreas.add(cellId);

        const seed = hashString(cellId);
        const rng = new SeededRandom(seed);

        for (let i = 0; i < this.ENTITIES_PER_AREA; i++) {
          const entityLng = rng.range(lng, lng + cellSize);
          const entityLat = rng.range(lat, lat + cellSize);

          if (this.isWater(entityLng, entityLat)) {
            this.spawnEntity(entityLng, entityLat, rng, cellId);
          }
        }
      }
    }
  }

  private isWater(lng: number, lat: number): boolean {
    const map = this.mapManager.getMap();
    const screenPoint = this.mapManager.project({ lng, lat });
    const features = map.queryRenderedFeatures([screenPoint.x, screenPoint.y]);

    return features.some((f: MapboxGeoJSONFeature) => {
      const sourceLayer = f.sourceLayer || '';
      const layerId = f.layer?.id || '';
      return sourceLayer === 'water' || layerId.includes('water');
    });
  }

  private spawnEntity(lng: number, lat: number, rng: SeededRandom, cellId: string): void {
    const id = `water-entity-${lng.toFixed(6)}-${lat.toFixed(6)}`;
    if (this.entities.has(id)) return;

    // 70% fish, 30% boats
    const isFish = rng.next() < 0.7;
    const type = isFish ? 'fish' : 'boat';
    const emoji = isFish ? rng.pick(FISH_EMOJIS) : rng.pick(BOAT_EMOJIS);

    const style = new TextStyle({ fontSize: isFish ? 14 : 18 });
    const text = new Text({ text: emoji, style });
    text.anchor.set(0.5, 0.5);

    this.app.stage.addChild(text);

    const angle = rng.range(0, Math.PI * 2);
    const entity: WaterEntity = {
      id,
      cellId,
      type,
      emoji,
      text,
      lng,
      lat,
      vx: Math.cos(angle) * this.moveSpeed,
      vy: Math.sin(angle) * this.moveSpeed,
      seed: hashString(id),
      nextDirectionChange: Date.now() + rng.range(2000, this.DIRECTION_CHANGE_INTERVAL)
    };

    this.entities.set(id, entity);
    this.updateEntityPosition(entity);
  }

  private updateEntityPosition(entity: WaterEntity): void {
    const pos = this.mapManager.project({ lng: entity.lng, lat: entity.lat });
    entity.text.x = pos.x;
    entity.text.y = pos.y;

    // Scale with zoom
    const zoom = this.mapManager.getZoom();
    const scale = Math.pow(2, zoom - this.baseZoom);
    entity.text.scale.set(scale);
  }

  update(deltaTime: number): void {
    const now = Date.now();

    for (const entity of this.entities.values()) {
      if (now >= entity.nextDirectionChange) {
        this.changeDirection(entity, now);
      }

      const newLng = entity.lng + entity.vx * deltaTime;
      const newLat = entity.lat + entity.vy * deltaTime;

      // Check if new position is still water
      if (this.isWater(newLng, newLat)) {
        entity.lng = newLng;
        entity.lat = newLat;
      } else {
        // Hit land, change direction
        this.changeDirection(entity, now);
      }

      this.updateEntityPosition(entity);
    }
  }

  private changeDirection(entity: WaterEntity, now: number): void {
    const rng = new SeededRandom(entity.seed + Math.floor(now / 1000));
    const angle = rng.range(0, Math.PI * 2);
    entity.vx = Math.cos(angle) * this.moveSpeed;
    entity.vy = Math.sin(angle) * this.moveSpeed;
    entity.nextDirectionChange = now + rng.range(2000, this.DIRECTION_CHANGE_INTERVAL);
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

    const margin = 0.005;
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

    // Remove cells from spawnedAreas if no entities remain in that cell
    // This allows deterministic respawning when the user pans back
    for (const cellId of cellsWithRemovals) {
      const hasEntitiesInCell = Array.from(this.entities.values()).some(e => e.cellId === cellId);
      if (!hasEntitiesInCell) {
        this.spawnedAreas.delete(cellId);
      }
    }
  }

  // Get all entities for tap detection
  getEntities(): Map<string, WaterEntity> {
    return this.entities;
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

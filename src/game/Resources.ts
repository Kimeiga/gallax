import { Application, Text, TextStyle } from 'pixi.js';
import mapboxgl from 'mapbox-gl';
import { MapManager } from '../map/MapManager';

// Tree and vegetation emojis
const TREE_EMOJIS = ['🌲', '🌳', '🌴', '🌵', '🌿', '🍀', '🌱', '🪴', '🎋', '🎍', '☘️', '🍃', '🌾'];

// Seeded PRNG - same seed = same "random" numbers for all clients
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Simple but effective PRNG (Mulberry32)
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Generate number in range
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Pick random item from array
  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

// Create a deterministic seed from a string (polygon ID or coordinates)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export interface Resource {
  id: string;
  cellId: string; // The cell this resource belongs to
  type: 'tree' | 'fish' | 'rock';
  emoji: string;
  lng: number;
  lat: number;
  text: Text;
}

export class ResourceManager {
  private resources: Map<string, Resource> = new Map();
  private mapManager: MapManager;
  private app: Application;
  
  // Scaling
  private readonly baseZoom = 16;
  private readonly baseScale = 1;

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  private readonly GREEN_CLASSES = ['park', 'grass', 'wood', 'scrub', 'pitch', 'garden', 'meadow', 'forest'];
  private seededAreas: Set<string> = new Set(); // Track areas we've already seeded
  private readonly TREES_PER_FEATURE = 15; // Base trees to spawn per green polygon
  private readonly TREE_DENSITY = 200000; // Trees per square degree (roughly)

  // Spawn trees in all visible green areas
  spawnTreesInView(): void {
    const map = this.mapManager.getMap();

    // Query all visible green space features
    const greenFeatures = map.queryRenderedFeatures(undefined, {
      layers: ['landuse'] // Query the landuse style layer
    }).filter((f: mapboxgl.MapboxGeoJSONFeature) => {
      const landClass = f.properties?.class;
      return this.GREEN_CLASSES.includes(landClass);
    });

    let spawned = 0;

    for (const feature of greenFeatures) {
      // Create a deterministic ID from the polygon's geometry
      // This ensures ALL clients generate the same ID for the same polygon
      const geometry = feature.geometry;
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;

      const bbox = this.getBoundingBox(geometry);
      if (!bbox) continue;

      // Create a stable ID from the bounding box (same polygon = same bbox = same ID)
      const featureId = `${bbox.minLng.toFixed(6)},${bbox.minLat.toFixed(6)},${bbox.maxLng.toFixed(6)},${bbox.maxLat.toFixed(6)}`;

      if (this.seededAreas.has(featureId)) continue;
      this.seededAreas.add(featureId);

      // Create a seeded RNG from the feature ID - ALL clients get same seed!
      const seed = hashString(featureId);
      const rng = new SeededRandom(seed);

      // Spawn trees within this polygon's bounds - scale by area
      const areaBasedCount = Math.ceil(bbox.area * this.TREE_DENSITY);
      const treesToSpawn = Math.max(3, Math.min(this.TREES_PER_FEATURE, areaBasedCount));
      const attemptsPerTree = 3;

      let spawnedInFeature = 0;
      for (let i = 0; i < treesToSpawn * attemptsPerTree && spawnedInFeature < treesToSpawn; i++) {
        // Use seeded RNG instead of Math.random()!
        const lng = rng.range(bbox.minLng, bbox.maxLng);
        const lat = rng.range(bbox.minLat, bbox.maxLat);

        // Point check via map query - check ALL features at this point
        const screenPoint = this.mapManager.project({ lng, lat });
        const allFeaturesAtPoint = map.queryRenderedFeatures([screenPoint.x, screenPoint.y]);

        // Check if point is blocked by water or buildings
        const isBlocked = allFeaturesAtPoint.some((f: mapboxgl.MapboxGeoJSONFeature) => {
          const layerId = f.layer?.id || '';
          const sourceLayer = f.sourceLayer || '';

          // Check for water
          if (sourceLayer === 'water' || layerId.includes('water')) {
            return true;
          }

          // Check for buildings
          if (sourceLayer === 'building' || layerId.includes('building')) {
            return true;
          }

          return false;
        });

        // Check if point is in green space
        const isInGreen = allFeaturesAtPoint.some((f: mapboxgl.MapboxGeoJSONFeature) => {
          const sourceLayer = f.sourceLayer || '';
          if (sourceLayer === 'landuse') {
            return this.GREEN_CLASSES.includes(f.properties?.class);
          }
          return false;
        });

        if (isInGreen && !isBlocked) {
          this.spawnTreeWithEmoji(lng, lat, rng.pick(TREE_EMOJIS), featureId);
          spawned++;
          spawnedInFeature++;
        }
      }
    }

    if (spawned > 0) {
      console.log(`Spawned ${spawned} trees in ${greenFeatures.length} green areas`);
    }
  }

  private getBoundingBox(geometry: GeoJSON.Geometry): { minLng: number; maxLng: number; minLat: number; maxLat: number; area: number } | null {
    let coords: number[][][] = [];

    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates;
    } else if (geometry.type === 'MultiPolygon') {
      coords = geometry.coordinates.flat();
    } else {
      return null;
    }

    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const ring of coords) {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }

    const area = (maxLng - minLng) * (maxLat - minLat);
    return { minLng, maxLng, minLat, maxLat, area };
  }

  private spawnTreeWithEmoji(lng: number, lat: number, emoji: string, cellId: string): void {
    const id = `tree-${lng.toFixed(6)}-${lat.toFixed(6)}`;

    // Don't spawn duplicates
    if (this.resources.has(id)) return;

    const style = new TextStyle({
      fontSize: 16, // Smaller trees
    });

    const text = new Text({ text: emoji, style });
    text.anchor.set(0.5, 1);

    this.app.stage.addChild(text);

    const resource: Resource = {
      id,
      cellId,
      type: 'tree',
      emoji,
      lng,
      lat,
      text
    };

    this.resources.set(id, resource);
    this.updateResourcePosition(resource);
  }

  private updateResourcePosition(resource: Resource): void {
    const screenPos = this.mapManager.project({ lng: resource.lng, lat: resource.lat });
    resource.text.x = Math.round(screenPos.x);
    resource.text.y = Math.round(screenPos.y);

    // Scale based on zoom
    const zoom = this.mapManager.getZoom();
    const scale = this.baseScale * Math.pow(2, zoom - this.baseZoom);
    resource.text.scale.set(scale);
  }

  updateAllPositions(): void {
    this.resources.forEach(resource => {
      this.updateResourcePosition(resource);
    });
  }

  // Remove resources that are too far from view
  cullDistantResources(): void {
    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const padding = 0.01; // degrees
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Track which cells have resources removed
    const cellsWithRemovals = new Set<string>();

    this.resources.forEach((resource, id) => {
      if (resource.lng < sw.lng - padding || resource.lng > ne.lng + padding ||
          resource.lat < sw.lat - padding || resource.lat > ne.lat + padding) {
        resource.text.destroy();
        this.resources.delete(id);
        cellsWithRemovals.add(resource.cellId);
      }
    });

    // Remove cells from seededAreas if no resources remain in that cell
    // This allows deterministic respawning when the user pans back
    for (const cellId of cellsWithRemovals) {
      const hasResourcesInCell = Array.from(this.resources.values()).some(r => r.cellId === cellId);
      if (!hasResourcesInCell) {
        this.seededAreas.delete(cellId);
      }
    }
  }

  getResourceCount(): number {
    return this.resources.size;
  }

  // Get all resources for tap detection
  getResources(): Map<string, Resource> {
    return this.resources;
  }

  // Remove a specific resource by ID
  removeResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      resource.text.destroy();
      this.resources.delete(id);
    }
  }
}


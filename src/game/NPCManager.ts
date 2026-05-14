import { Application, Sprite, Assets, Texture } from 'pixi.js';
import type { MapboxGeoJSONFeature } from 'mapbox-gl';
import { MapManager } from '../map/MapManager';
import { getPerformanceManager } from './PerformanceManager';

// Seeded PRNG for deterministic NPC behavior
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

export interface NPC {
  id: string;
  cellId: string; // The cell this NPC belongs to
  sprite: Sprite;
  lng: number;
  lat: number;
  vx: number; // current velocity in lng
  vy: number; // current velocity in lat
  tvx: number; // target velocity in lng (smooth transition)
  tvy: number; // target velocity in lat
  seed: number;
  nextDirectionChange: number; // timestamp
  frozen: boolean; // Whether this NPC is frozen (in dialogue)
}

export type NPCClickCallback = (npc: NPC) => void;

export class NPCManager {
  private npcs: Map<string, NPC> = new Map();
  private mapManager: MapManager;
  private app: Application;
  private textures: Texture[] = [];
  private spawnedAreas: Set<string> = new Set();
  private onNPCClickCallback: NPCClickCallback | null = null;

  private readonly baseZoom = 16;
  private readonly baseScale = 0.75; // Same size as player
  private readonly moveSpeed = 0.000008; // Slower than player
  private readonly NPCS_PER_AREA = 2; // Slightly reduced density
  private readonly DIRECTION_CHANGE_INTERVAL = 3000; // ms

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  // Set callback for when NPC is clicked
  onNPCClick(callback: NPCClickCallback): void {
    this.onNPCClickCallback = callback;
  }

  async loadTextures(): Promise<void> {
    // Preload a subset of sprites for NPCs
    const spriteCount = 20; // Load 20 different NPC sprites
    for (let i = 1; i <= spriteCount; i++) {
      try {
        const texture = await Assets.load(`/sprites/${i}.png`);
        texture.source.scaleMode = 'nearest';
        this.textures.push(texture);
      } catch (e) {
        console.warn(`Failed to load sprite ${i}`);
      }
    }
    console.log(`Loaded ${this.textures.length} NPC textures`);
  }

  spawnNPCsInView(): void {
    if (this.textures.length === 0) return;

    const performanceManager = getPerformanceManager();

    // Check if we've hit entity limit
    if (!performanceManager.canSpawnNPC(this.npcs.size)) return;

    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    // Create grid cells for spawning
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const cellSize = 0.002; // ~200m cells

    for (let lng = Math.floor(sw.lng / cellSize) * cellSize; lng < ne.lng; lng += cellSize) {
      for (let lat = Math.floor(sw.lat / cellSize) * cellSize; lat < ne.lat; lat += cellSize) {
        // Check limit again during spawning
        if (!performanceManager.canSpawnNPC(this.npcs.size)) return;

        const cellId = `${lng.toFixed(4)},${lat.toFixed(4)}`;

        if (this.spawnedAreas.has(cellId)) continue;
        this.spawnedAreas.add(cellId);

        const seed = hashString(cellId);
        const rng = new SeededRandom(seed);

        for (let i = 0; i < this.NPCS_PER_AREA; i++) {
          if (!performanceManager.canSpawnNPC(this.npcs.size)) break;

          const npcLng = rng.range(lng, lng + cellSize);
          const npcLat = rng.range(lat, lat + cellSize);

          if (this.isValidSpawnPoint(npcLng, npcLat)) {
            this.spawnNPC(npcLng, npcLat, rng, cellId);
          }
        }
      }
    }
  }

  private isValidSpawnPoint(lng: number, lat: number): boolean {
    const map = this.mapManager.getMap();
    const screenPoint = this.mapManager.project({ lng, lat });
    const features = map.queryRenderedFeatures([screenPoint.x, screenPoint.y]);

    // Check for blocking layers
    const isBlocked = features.some((f: MapboxGeoJSONFeature) => {
      const sourceLayer = f.sourceLayer || '';
      const layerId = f.layer?.id || '';
      return sourceLayer === 'water' || layerId.includes('water') ||
             sourceLayer === 'building' || layerId.includes('building');
    });

    // Check for walkable areas (roads or green spaces)
    const isWalkable = features.some((f: MapboxGeoJSONFeature) => {
      const sourceLayer = f.sourceLayer || '';
      return sourceLayer === 'road' || sourceLayer === 'landuse';
    });

    return isWalkable && !isBlocked;
  }

  private spawnNPC(lng: number, lat: number, rng: SeededRandom, cellId: string): void {
    const id = `npc-${lng.toFixed(6)}-${lat.toFixed(6)}`;
    if (this.npcs.has(id)) return;

    const textureIndex = Math.floor(rng.next() * this.textures.length);
    const sprite = new Sprite(this.textures[textureIndex]);
    sprite.anchor.set(0.5, 1);
    sprite.roundPixels = true;

    // Make sprite interactive
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    this.app.stage.addChild(sprite);

    // Random initial direction
    const angle = rng.range(0, Math.PI * 2);

    const npc: NPC = {
      id,
      cellId,
      sprite,
      lng,
      lat,
      vx: Math.cos(angle) * this.moveSpeed,
      vy: Math.sin(angle) * this.moveSpeed,
      tvx: Math.cos(angle) * this.moveSpeed,
      tvy: Math.sin(angle) * this.moveSpeed,
      seed: hashString(id),
      nextDirectionChange: Date.now() + rng.range(1000, this.DIRECTION_CHANGE_INTERVAL),
      frozen: false
    };

    // Add click handler
    sprite.on('pointerdown', () => {
      if (this.onNPCClickCallback) {
        this.onNPCClickCallback(npc);
      }
    });

    this.npcs.set(id, npc);
    this.updateNPCPosition(npc);
  }

  private updateNPCPosition(npc: NPC): void {
    const pos = this.mapManager.project({ lng: npc.lng, lat: npc.lat });
    npc.sprite.x = pos.x;
    npc.sprite.y = pos.y;

    // Scale with zoom
    const zoom = this.mapManager.getZoom();
    const scale = this.baseScale * Math.pow(2, zoom - this.baseZoom);
    npc.sprite.scale.set(scale);
  }

  update(deltaTime: number): void {
    const now = Date.now();

    for (const npc of this.npcs.values()) {
      // Skip frozen NPCs (in dialogue)
      if (npc.frozen) {
        this.updateNPCPosition(npc); // Still update visual position for zoom/pan
        continue;
      }

      // Check if it's time to change direction
      if (now >= npc.nextDirectionChange) {
        this.changeDirection(npc, now);
      }

      // Smoothly lerp velocity toward target (no instant direction changes)
      const lerpFactor = 0.05;
      npc.vx += (npc.tvx - npc.vx) * lerpFactor;
      npc.vy += (npc.tvy - npc.vy) * lerpFactor;

      // Flip sprite based on current velocity
      if (Math.abs(npc.vx) > 0.0000001) {
        npc.sprite.scale.x = npc.vx < 0 ? -Math.abs(npc.sprite.scale.x) : Math.abs(npc.sprite.scale.x);
      }

      // Calculate new position
      const newLng = npc.lng + npc.vx * deltaTime;
      const newLat = npc.lat + npc.vy * deltaTime;

      // Check if new position is valid
      if (this.isValidSpawnPoint(newLng, newLat)) {
        npc.lng = newLng;
        npc.lat = newLat;
      } else {
        // Hit obstacle, reverse target direction
        npc.tvx = -npc.tvx;
        npc.tvy = -npc.tvy;
      }

      this.updateNPCPosition(npc);
    }
  }

  private changeDirection(npc: NPC, now: number): void {
    const rng = new SeededRandom(npc.seed + Math.floor(now / 1000));
    const angle = rng.range(0, Math.PI * 2);
    // Set target velocity (actual velocity lerps toward this)
    npc.tvx = Math.cos(angle) * this.moveSpeed;
    npc.tvy = Math.sin(angle) * this.moveSpeed;
    npc.nextDirectionChange = now + rng.range(2000, this.DIRECTION_CHANGE_INTERVAL);
  }

  updateAllPositions(): void {
    for (const npc of this.npcs.values()) {
      this.updateNPCPosition(npc);
    }
  }

  cullDistantNPCs(): void {
    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const margin = 0.005; // Buffer zone
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Track which cells have NPCs removed
    const cellsWithRemovals = new Set<string>();

    for (const [id, npc] of this.npcs) {
      if (npc.lng < sw.lng - margin || npc.lng > ne.lng + margin ||
          npc.lat < sw.lat - margin || npc.lat > ne.lat + margin) {
        npc.sprite.destroy();
        this.npcs.delete(id);
        cellsWithRemovals.add(npc.cellId);
      }
    }

    // Remove cells from spawnedAreas if no NPCs remain in that cell
    // This allows deterministic respawning when the user pans back
    for (const cellId of cellsWithRemovals) {
      const hasNPCsInCell = Array.from(this.npcs.values()).some(npc => npc.cellId === cellId);
      if (!hasNPCsInCell) {
        this.spawnedAreas.delete(cellId);
      }
    }
  }

  // Toggle visibility of all NPCs (performance optimization)
  setVisible(visible: boolean): void {
    for (const npc of this.npcs.values()) {
      npc.sprite.visible = visible;
    }
  }

  // Get current NPC count
  getCount(): number {
    return this.npcs.size;
  }

  // Find NPC at screen position (for click detection)
  findNPCAtPoint(screenX: number, screenY: number): NPC | null {
    const hitRadius = 30; // pixels

    for (const npc of this.npcs.values()) {
      const dx = npc.sprite.x - screenX;
      const dy = npc.sprite.y - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius) {
        return npc;
      }
    }

    return null;
  }

  // Get all NPCs
  getAllNPCs(): Map<string, NPC> {
    return this.npcs;
  }

  // Freeze an NPC (stop movement during dialogue)
  freezeNPC(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.frozen = true;
      npc.vx = 0;
      npc.vy = 0;
    }
  }

  // Unfreeze an NPC (resume movement after dialogue)
  unfreezeNPC(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.frozen = false;
      // Give them a new random direction
      this.changeDirection(npc, Date.now());
    }
  }

  // Get NPC by ID
  getNPC(npcId: string): NPC | undefined {
    return this.npcs.get(npcId);
  }
}


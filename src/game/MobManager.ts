import { Application, Text, TextStyle, Graphics } from 'pixi.js';
import type { MapboxGeoJSONFeature } from 'mapbox-gl';
import { MapManager } from '../map/MapManager';
import { getPerformanceManager } from './PerformanceManager';

// Seeded PRNG for deterministic mob behavior
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

// Terrain type for spawn filtering
type TerrainType = 'land' | 'water' | 'any';

// Rarity affects spawn weight
type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 25,
  rare: 10,
  legendary: 2,
};

// Loot table entry
export interface LootEntry {
  emoji: string;
  name: string;
  chance: number; // 0-1
  min: number;
  max: number;
}

// Mob type definition
export interface MobDefinition {
  emoji: string;
  name: string;
  hp: number;
  damage: number;
  defense: number;
  speed: number; // multiplier on base moveSpeed
  xpReward: number;
  loot: LootEntry[];
  terrain: TerrainType;
  aggroRadius: number; // in lng/lat units
  rarity: Rarity;
}

export const MOB_DEFINITIONS: MobDefinition[] = [
  {
    emoji: '🐀',
    name: 'Rat',
    hp: 10,
    damage: 2,
    defense: 0,
    speed: 1.2,
    xpReward: 5,
    loot: [
      { emoji: '🥩', name: 'Raw Meat', chance: 0.5, min: 1, max: 1 },
      { emoji: '🧶', name: 'Rat Tail', chance: 0.2, min: 1, max: 1 },
    ],
    terrain: 'land',
    aggroRadius: 0.0003,
    rarity: 'common',
  },
  {
    emoji: '🕷️',
    name: 'Spider',
    hp: 15,
    damage: 4,
    defense: 1,
    speed: 1.0,
    xpReward: 8,
    loot: [
      { emoji: '🕸️', name: 'Spider Silk', chance: 0.6, min: 1, max: 2 },
      { emoji: '🧪', name: 'Venom Sac', chance: 0.15, min: 1, max: 1 },
    ],
    terrain: 'land',
    aggroRadius: 0.0004,
    rarity: 'common',
  },
  {
    emoji: '🐺',
    name: 'Wolf',
    hp: 30,
    damage: 8,
    defense: 3,
    speed: 1.5,
    xpReward: 20,
    loot: [
      { emoji: '🥩', name: 'Raw Meat', chance: 0.7, min: 1, max: 2 },
      { emoji: '🦴', name: 'Bone', chance: 0.4, min: 1, max: 1 },
      { emoji: '🐾', name: 'Wolf Pelt', chance: 0.25, min: 1, max: 1 },
    ],
    terrain: 'land',
    aggroRadius: 0.0006,
    rarity: 'uncommon',
  },
  {
    emoji: '🐍',
    name: 'Snake',
    hp: 20,
    damage: 6,
    defense: 1,
    speed: 0.9,
    xpReward: 15,
    loot: [
      { emoji: '🧪', name: 'Venom Sac', chance: 0.5, min: 1, max: 1 },
      { emoji: '🐍', name: 'Snake Skin', chance: 0.3, min: 1, max: 1 },
    ],
    terrain: 'land',
    aggroRadius: 0.0003,
    rarity: 'uncommon',
  },
  {
    emoji: '🦇',
    name: 'Bat',
    hp: 12,
    damage: 3,
    defense: 0,
    speed: 2.0,
    xpReward: 6,
    loot: [
      { emoji: '🪶', name: 'Bat Wing', chance: 0.4, min: 1, max: 2 },
    ],
    terrain: 'any',
    aggroRadius: 0.0005,
    rarity: 'common',
  },
  {
    emoji: '🐻',
    name: 'Bear',
    hp: 80,
    damage: 15,
    defense: 8,
    speed: 0.8,
    xpReward: 50,
    loot: [
      { emoji: '🥩', name: 'Raw Meat', chance: 0.9, min: 2, max: 4 },
      { emoji: '🐾', name: 'Bear Pelt', chance: 0.4, min: 1, max: 1 },
      { emoji: '🍯', name: 'Honey', chance: 0.2, min: 1, max: 1 },
    ],
    terrain: 'land',
    aggroRadius: 0.0005,
    rarity: 'rare',
  },
  {
    emoji: '🦈',
    name: 'Shark',
    hp: 45,
    damage: 12,
    defense: 4,
    speed: 1.6,
    xpReward: 30,
    loot: [
      { emoji: '🦷', name: 'Shark Tooth', chance: 0.5, min: 1, max: 2 },
      { emoji: '🥩', name: 'Raw Meat', chance: 0.6, min: 2, max: 3 },
    ],
    terrain: 'water',
    aggroRadius: 0.0008,
    rarity: 'uncommon',
  },
  {
    emoji: '🐙',
    name: 'Octopus',
    hp: 50,
    damage: 10,
    defense: 5,
    speed: 0.7,
    xpReward: 40,
    loot: [
      { emoji: '🖋️', name: 'Ink Sac', chance: 0.6, min: 1, max: 2 },
      { emoji: '🦑', name: 'Tentacle', chance: 0.3, min: 1, max: 1 },
    ],
    terrain: 'water',
    aggroRadius: 0.0005,
    rarity: 'rare',
  },
  {
    emoji: '👻',
    name: 'Ghost',
    hp: 35,
    damage: 9,
    defense: 2,
    speed: 1.3,
    xpReward: 35,
    loot: [
      { emoji: '💀', name: 'Ectoplasm', chance: 0.5, min: 1, max: 1 },
      { emoji: '🔮', name: 'Spirit Orb', chance: 0.1, min: 1, max: 1 },
    ],
    terrain: 'any',
    aggroRadius: 0.0007,
    rarity: 'rare',
  },
  {
    emoji: '🐉',
    name: 'Dragon',
    hp: 200,
    damage: 30,
    defense: 15,
    speed: 1.0,
    xpReward: 200,
    loot: [
      { emoji: '🔥', name: 'Dragon Scale', chance: 0.8, min: 1, max: 3 },
      { emoji: '💎', name: 'Dragon Gem', chance: 0.1, min: 1, max: 1 },
      { emoji: '🥩', name: 'Dragon Meat', chance: 0.6, min: 3, max: 5 },
    ],
    terrain: 'land',
    aggroRadius: 0.001,
    rarity: 'legendary',
  },
  {
    emoji: '💀',
    name: 'Skeleton',
    hp: 25,
    damage: 7,
    defense: 2,
    speed: 0.9,
    xpReward: 18,
    loot: [
      { emoji: '🦴', name: 'Bone', chance: 0.7, min: 1, max: 3 },
      { emoji: '🏹', name: 'Arrow', chance: 0.3, min: 1, max: 5 },
    ],
    terrain: 'land',
    aggroRadius: 0.0006,
    rarity: 'uncommon',
  },
  {
    emoji: '🧟',
    name: 'Zombie',
    hp: 20,
    damage: 5,
    defense: 2,
    speed: 0.5,
    xpReward: 7,
    loot: [
      { emoji: '🥩', name: 'Rotten Flesh', chance: 0.8, min: 1, max: 2 },
      { emoji: '🧠', name: 'Brain', chance: 0.05, min: 1, max: 1 },
    ],
    terrain: 'land',
    aggroRadius: 0.0004,
    rarity: 'common',
  },
];

// Runtime mob instance
export interface Mob {
  id: string;
  cellId: string;
  definition: MobDefinition;
  sprite: Text;
  healthBar: Graphics;
  lng: number;
  lat: number;
  vx: number;
  vy: number;
  tvx: number; // target velocity (smooth transitions)
  tvy: number;
  seed: number;
  nextDirectionChange: number;
  currentHp: number;
  aggroed: boolean;
}

export type MobClickCallback = (mob: Mob) => void;

export class MobManager {
  private mobs: Map<string, Mob> = new Map();
  private mapManager: MapManager;
  private app: Application;
  private spawnedAreas: Set<string> = new Set();
  private onMobClickCallback: MobClickCallback | null = null;
  private onMobReachPlayerCallback: ((mob: Mob) => void) | null = null;
  private readonly COMBAT_DISTANCE = 0.00008; // Distance at which mob engages combat (~8m)

  private readonly baseZoom = 16;
  private readonly baseScale = 0.75;
  private readonly moveSpeed = 0.000006;
  private readonly MOBS_PER_AREA = 1; // Reduced: enemies should be somewhat rare
  private readonly DIRECTION_CHANGE_INTERVAL = 3000;
  private readonly HEALTH_BAR_WIDTH = 20;
  private readonly HEALTH_BAR_HEIGHT = 3;

  // Player position for aggro checks (set externally)
  private playerLng = 0;
  private playerLat = 0;

  constructor(mapManager: MapManager, app: Application) {
    this.mapManager = mapManager;
    this.app = app;
  }

  // Set callback for when a mob is clicked
  onMobClick(callback: MobClickCallback): void {
    this.onMobClickCallback = callback;
  }

  // Set callback for when an aggroed mob reaches the player
  onMobReachPlayer(callback: (mob: Mob) => void): void {
    this.onMobReachPlayerCallback = callback;
  }

  // Update the player position for aggro calculations
  setPlayerPosition(lng: number, lat: number): void {
    this.playerLng = lng;
    this.playerLat = lat;
  }

  spawnMobsInView(): void {
    const performanceManager = getPerformanceManager();

    // Reuse the NPC limit to cap mobs as well
    if (!performanceManager.canSpawnNPC(this.mobs.size)) return;

    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const cellSize = 0.002; // ~200m cells, same as NPCs

    for (let lng = Math.floor(sw.lng / cellSize) * cellSize; lng < ne.lng; lng += cellSize) {
      for (let lat = Math.floor(sw.lat / cellSize) * cellSize; lat < ne.lat; lat += cellSize) {
        if (!performanceManager.canSpawnNPC(this.mobs.size)) return;

        const cellId = `mob-${lng.toFixed(4)},${lat.toFixed(4)}`;

        if (this.spawnedAreas.has(cellId)) continue;
        this.spawnedAreas.add(cellId);

        const seed = hashString(cellId);
        const rng = new SeededRandom(seed);

        for (let i = 0; i < this.MOBS_PER_AREA; i++) {
          if (!performanceManager.canSpawnNPC(this.mobs.size)) break;

          const mobLng = rng.range(lng, lng + cellSize);
          const mobLat = rng.range(lat, lat + cellSize);

          const isWater = this.isWater(mobLng, mobLat);
          const isLand = this.isLandSpawnPoint(mobLng, mobLat);

          // Pick a mob definition based on terrain and rarity
          const definition = this.pickMobDefinition(rng, isWater, isLand);
          if (!definition) continue;

          // Validate terrain: land mobs need walkable land, water mobs need water
          if (definition.terrain === 'land' && !isLand) continue;
          if (definition.terrain === 'water' && !isWater) continue;
          if (definition.terrain === 'any' && !isLand && !isWater) continue;

          this.spawnMob(mobLng, mobLat, rng, cellId, definition);
        }
      }
    }
  }

  private isWater(lng: number, lat: number): boolean {
    const map = this.mapManager.getMap();
    const point = map.project([lng, lat]);

    try {
      const features = map.queryRenderedFeatures(point, {
        layers: ['water', 'waterway'],
      });
      return features.length > 0;
    } catch {
      return false;
    }
  }

  private isLandSpawnPoint(lng: number, lat: number): boolean {
    const map = this.mapManager.getMap();
    const screenPoint = this.mapManager.project({ lng, lat });
    const features = map.queryRenderedFeatures([screenPoint.x, screenPoint.y]);

    const isBlocked = features.some((f: MapboxGeoJSONFeature) => {
      const sourceLayer = f.sourceLayer || '';
      const layerId = f.layer?.id || '';
      return sourceLayer === 'water' || layerId.includes('water') ||
             sourceLayer === 'building' || layerId.includes('building');
    });

    const isWalkable = features.some((f: MapboxGeoJSONFeature) => {
      const sourceLayer = f.sourceLayer || '';
      return sourceLayer === 'road' || sourceLayer === 'landuse';
    });

    return isWalkable && !isBlocked;
  }

  private pickMobDefinition(rng: SeededRandom, isWater: boolean, isLand: boolean): MobDefinition | null {
    // Filter definitions to those valid for this terrain
    const candidates = MOB_DEFINITIONS.filter((def) => {
      if (def.terrain === 'land') return isLand;
      if (def.terrain === 'water') return isWater;
      return isLand || isWater; // 'any'
    });

    if (candidates.length === 0) return null;

    // Weighted random selection based on rarity
    const totalWeight = candidates.reduce((sum, def) => sum + RARITY_WEIGHTS[def.rarity], 0);
    let roll = rng.next() * totalWeight;

    for (const def of candidates) {
      roll -= RARITY_WEIGHTS[def.rarity];
      if (roll <= 0) return def;
    }

    return candidates[candidates.length - 1];
  }

  private spawnMob(lng: number, lat: number, rng: SeededRandom, cellId: string, definition: MobDefinition): void {
    const id = `mob-${lng.toFixed(6)}-${lat.toFixed(6)}`;
    if (this.mobs.has(id)) return;

    // Create emoji text sprite
    const style = new TextStyle({
      fontSize: 28,
    });
    const sprite = new Text({ text: definition.emoji, style });
    sprite.anchor.set(0.5, 1);

    // Make sprite interactive
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    // Create health bar
    const healthBar = new Graphics();
    this.drawHealthBar(healthBar, 1.0);

    this.app.stage.addChild(sprite);
    this.app.stage.addChild(healthBar);

    // Random initial direction
    const angle = rng.range(0, Math.PI * 2);

    const mob: Mob = {
      id,
      cellId,
      definition,
      sprite,
      healthBar,
      lng,
      lat,
      vx: Math.cos(angle) * this.moveSpeed * definition.speed,
      vy: Math.sin(angle) * this.moveSpeed * definition.speed,
      tvx: Math.cos(angle) * this.moveSpeed * definition.speed,
      tvy: Math.sin(angle) * this.moveSpeed * definition.speed,
      seed: hashString(id),
      nextDirectionChange: Date.now() + rng.range(1000, this.DIRECTION_CHANGE_INTERVAL),
      currentHp: definition.hp,
      aggroed: false,
    };

    // Add click handler
    sprite.on('pointerdown', () => {
      if (this.onMobClickCallback) {
        this.onMobClickCallback(mob);
      }
    });

    this.mobs.set(id, mob);
    this.updateMobPosition(mob);
  }

  private drawHealthBar(gfx: Graphics, hpPercent: number): void {
    gfx.clear();

    // Background (dark red)
    gfx.rect(
      -this.HEALTH_BAR_WIDTH / 2,
      0,
      this.HEALTH_BAR_WIDTH,
      this.HEALTH_BAR_HEIGHT,
    );
    gfx.fill({ color: 0x440000 });

    // Foreground (green -> yellow -> red based on HP)
    const barWidth = this.HEALTH_BAR_WIDTH * Math.max(0, Math.min(1, hpPercent));
    let color = 0x00cc00; // green
    if (hpPercent < 0.25) {
      color = 0xcc0000; // red
    } else if (hpPercent < 0.5) {
      color = 0xcccc00; // yellow
    }

    if (barWidth > 0) {
      gfx.rect(
        -this.HEALTH_BAR_WIDTH / 2,
        0,
        barWidth,
        this.HEALTH_BAR_HEIGHT,
      );
      gfx.fill({ color });
    }
  }

  private updateMobPosition(mob: Mob): void {
    const pos = this.mapManager.project({ lng: mob.lng, lat: mob.lat });
    mob.sprite.x = pos.x;
    mob.sprite.y = pos.y;

    // Scale with zoom
    const zoom = this.mapManager.getZoom();
    const scale = this.baseScale * Math.pow(2, zoom - this.baseZoom);
    mob.sprite.scale.set(scale);

    // Position health bar below the sprite
    mob.healthBar.x = pos.x;
    mob.healthBar.y = pos.y + 4;
    mob.healthBar.scale.set(scale);
  }

  update(deltaTime: number): void {
    const now = Date.now();

    for (const mob of this.mobs.values()) {
      // Check aggro: is the player within aggroRadius?
      const dxPlayer = this.playerLng - mob.lng;
      const dyPlayer = this.playerLat - mob.lat;
      const distToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);

      if (mob.aggroed && distToPlayer <= mob.definition.aggroRadius) {
        // Check if mob reached combat distance
        if (distToPlayer <= this.COMBAT_DISTANCE && this.onMobReachPlayerCallback) {
          this.onMobReachPlayerCallback(mob);
          mob.vx = 0;
          mob.vy = 0;
          this.updateMobPosition(mob);
          continue;
        }

        // Chase player (only if already aggroed by being attacked)
        const speed = this.moveSpeed * mob.definition.speed;
        if (distToPlayer > 0.000001) {
          mob.vx = (dxPlayer / distToPlayer) * speed;
          mob.vy = (dyPlayer / distToPlayer) * speed;
        }
      } else {
        // Random wandering
        if (mob.aggroed) {
          // Just left aggro range, pick a new random direction
          mob.aggroed = false;
          this.changeDirection(mob, now);
        }

        if (now >= mob.nextDirectionChange) {
          this.changeDirection(mob, now);
        }
      }

      // Smoothly lerp velocity toward target for smooth turns (unless aggroed = instant chase)
      if (!mob.aggroed) {
        const lerpFactor = 0.05;
        mob.vx += (mob.tvx - mob.vx) * lerpFactor;
        mob.vy += (mob.tvy - mob.vy) * lerpFactor;
      }

      // Flip sprite based on velocity
      if (Math.abs(mob.vx) > 0.0000001) {
        mob.sprite.scale.x = mob.vx < 0 ? -Math.abs(mob.sprite.scale.x) : Math.abs(mob.sprite.scale.x);
      }

      // Calculate new position
      const newLng = mob.lng + mob.vx * deltaTime;
      const newLat = mob.lat + mob.vy * deltaTime;

      const canMove = this.canMobMoveTo(mob, newLng, newLat);

      if (canMove) {
        mob.lng = newLng;
        mob.lat = newLat;
      } else if (!mob.aggroed) {
        mob.tvx = -mob.tvx;
        mob.tvy = -mob.tvy;
      }

      this.updateMobPosition(mob);
    }
  }

  private canMobMoveTo(mob: Mob, lng: number, lat: number): boolean {
    if (mob.definition.terrain === 'water') {
      return this.isWater(lng, lat);
    }
    if (mob.definition.terrain === 'land') {
      return this.isLandSpawnPoint(lng, lat);
    }
    // 'any' terrain can go anywhere that's not a building
    return this.isLandSpawnPoint(lng, lat) || this.isWater(lng, lat);
  }

  private changeDirection(mob: Mob, now: number): void {
    const rng = new SeededRandom(mob.seed + Math.floor(now / 1000));
    const angle = rng.range(0, Math.PI * 2);
    const speed = this.moveSpeed * mob.definition.speed;
    // Set target velocity (actual lerps toward this for smooth turns)
    mob.tvx = Math.cos(angle) * speed;
    mob.tvy = Math.sin(angle) * speed;
    mob.nextDirectionChange = now + rng.range(2000, this.DIRECTION_CHANGE_INTERVAL);
  }

  updateAllPositions(): void {
    for (const mob of this.mobs.values()) {
      this.updateMobPosition(mob);
    }
  }

  cullDistantMobs(): void {
    const map = this.mapManager.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;

    const margin = 0.005;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const cellsWithRemovals = new Set<string>();

    for (const [id, mob] of this.mobs) {
      if (mob.lng < sw.lng - margin || mob.lng > ne.lng + margin ||
          mob.lat < sw.lat - margin || mob.lat > ne.lat + margin) {
        mob.sprite.destroy();
        mob.healthBar.destroy();
        this.mobs.delete(id);
        cellsWithRemovals.add(mob.cellId);
      }
    }

    // Remove cells from spawnedAreas if no mobs remain so they can respawn deterministically
    for (const cellId of cellsWithRemovals) {
      const hasMobsInCell = Array.from(this.mobs.values()).some(m => m.cellId === cellId);
      if (!hasMobsInCell) {
        this.spawnedAreas.delete(cellId);
      }
    }
  }

  // Toggle visibility of all mobs
  setVisible(visible: boolean): void {
    for (const mob of this.mobs.values()) {
      mob.sprite.visible = visible;
      mob.healthBar.visible = visible;
    }
  }

  getCount(): number {
    return this.mobs.size;
  }

  // Find mob at screen position (for click detection)
  findMobAtPoint(screenX: number, screenY: number): Mob | null {
    const hitRadius = 30;

    for (const mob of this.mobs.values()) {
      const dx = mob.sprite.x - screenX;
      const dy = mob.sprite.y - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius) {
        return mob;
      }
    }

    return null;
  }

  // Aggro a mob (make it hostile toward the player)
  aggroMob(mobId: string): void {
    const mob = this.mobs.get(mobId);
    if (mob) mob.aggroed = true;
  }

  // Deal damage to a mob, returns true if the mob is killed
  damageMob(mobId: string, amount: number): boolean {
    const mob = this.mobs.get(mobId);
    if (!mob) return false;

    // Getting hit makes the mob aggro
    mob.aggroed = true;

    const effectiveDamage = Math.max(1, amount - mob.definition.defense);
    mob.currentHp -= effectiveDamage;

    // Update health bar
    const hpPercent = mob.currentHp / mob.definition.hp;
    this.drawHealthBar(mob.healthBar, hpPercent);

    if (mob.currentHp <= 0) {
      this.removeMob(mobId);
      return true;
    }

    return false;
  }

  // Roll loot drops for a killed mob
  rollLoot(definition: MobDefinition, rng?: SeededRandom): LootEntry[] {
    const random = rng || new SeededRandom(Date.now());
    const drops: LootEntry[] = [];

    for (const entry of definition.loot) {
      if (random.next() <= entry.chance) {
        drops.push({
          ...entry,
          min: Math.floor(random.range(entry.min, entry.max + 1)),
          max: Math.floor(random.range(entry.min, entry.max + 1)),
        });
      }
    }

    return drops;
  }

  private removeMob(mobId: string): void {
    const mob = this.mobs.get(mobId);
    if (!mob) return;

    mob.sprite.destroy();
    mob.healthBar.destroy();
    this.mobs.delete(mobId);
  }

  // Get all mobs
  getAllMobs(): Map<string, Mob> {
    return this.mobs;
  }

  // Get mob by ID
  getMob(mobId: string): Mob | undefined {
    return this.mobs.get(mobId);
  }
}

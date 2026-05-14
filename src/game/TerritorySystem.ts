// Territory System — H3 hexagonal grid, pure logic, no DOM dependencies
import { latLngToCell, cellToLatLng, cellToBoundary, gridDisk, gridDistance, gridPathCells, isValidCell } from 'h3-js';

export const H3_RESOLUTION = 10; // ~66m edge length, ~half a city block

export type TerrainType = 'park' | 'water' | 'urban' | 'road';

export interface TerritoryCell {
  h3Index: string;
  ownerId: string;
  ownerName?: string;
  color: string;
  claimedAt: number;
  lastVisited: number;
  terrain?: TerrainType;
}

export interface ClaimResult {
  success: boolean;
  reason?: string;
  cellsClaimed?: string[];
  cellsLost?: string[];
}

export interface TerritoryStats {
  totalCells: number;
  maxCells: number;
  canClaim: boolean;
  remainingCells: number;
}

// Capacity per level
const BASE_TERRITORY = 5;
const TERRITORY_PER_LEVEL = 5;

// Claim timing (ms)
export const CLAIM_TIME_UNCLAIMED = 1000;
export const CLAIM_TIME_ENEMY = 3000;
export const CLAIM_RADIUS = 2; // hex steps (~130m at res 10)

// Decay
export const DECAY_THRESHOLD_MS = 48 * 60 * 60 * 1000;
export const DECAY_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Player color palette — deterministic from player ID
const TERRITORY_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F0B27A', '#82E0AA', '#F1948A', '#AED6F1', '#D7BDE2',
  '#A3E4D7', '#FAD7A0', '#A9CCE3', '#D5F5E3', '#FADBD8',
];

export function playerColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(i)) | 0;
  }
  return TERRITORY_COLORS[Math.abs(hash) % TERRITORY_COLORS.length];
}

export function maxTerritoryCells(level: number): number {
  return BASE_TERRITORY + (level * TERRITORY_PER_LEVEL);
}

// ─── Coordinate helpers ──────────────────────────────────────────────────────

export function lngLatToH3(lng: number, lat: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

export function h3ToLngLat(h3Index: string): { lng: number; lat: number } {
  const [lat, lng] = cellToLatLng(h3Index);
  return { lng, lat };
}

export function h3ToBoundary(h3Index: string): { lng: number; lat: number }[] {
  return cellToBoundary(h3Index).map(([lat, lng]) => ({ lng, lat }));
}

export function h3Neighbors(h3Index: string): string[] {
  return gridDisk(h3Index, 1).filter(h => h !== h3Index);
}

// ─── TerritorySystem ─────────────────────────────────────────────────────────

export class TerritorySystem {
  private cells: Map<string, TerritoryCell> = new Map();
  private ownerCounts: Map<string, number> = new Map();
  private claimProgress: { h3Index: string; startTime: number; targetTime: number } | null = null;

  private onCellChanged: ((cell: TerritoryCell | null, h3Index: string) => void) | null = null;
  private onClaimProgress: ((progress: number, h3Index: string) => void) | null = null;

  setOnCellChanged(cb: (cell: TerritoryCell | null, h3Index: string) => void): void {
    this.onCellChanged = cb;
  }

  setOnClaimProgress(cb: (progress: number, h3Index: string) => void): void {
    this.onClaimProgress = cb;
  }

  // ─── Bulk load ──────────────────────────────────────────────────────────

  loadCells(cells: TerritoryCell[]): void {
    this.cells.clear();
    this.ownerCounts.clear();
    for (const cell of cells) this.setCell(cell, false);
  }

  // ─── Core operations ────────────────────────────────────────────────────

  getCell(h3Index: string): TerritoryCell | null {
    return this.cells.get(h3Index) || null;
  }

  getAllCells(): TerritoryCell[] {
    return Array.from(this.cells.values());
  }

  getCellCount(ownerId: string): number {
    return this.ownerCounts.get(ownerId) || 0;
  }

  getStats(ownerId: string, level: number): TerritoryStats {
    const totalCells = this.getCellCount(ownerId);
    const max = maxTerritoryCells(level);
    return { totalCells, maxCells: max, canClaim: totalCells < max, remainingCells: max - totalCells };
  }

  setCell(cell: TerritoryCell, notify = true): void {
    const existing = this.cells.get(cell.h3Index);
    if (existing && existing.ownerId) {
      const count = this.ownerCounts.get(existing.ownerId) || 0;
      this.ownerCounts.set(existing.ownerId, Math.max(0, count - 1));
    }
    this.cells.set(cell.h3Index, cell);
    const newCount = this.ownerCounts.get(cell.ownerId) || 0;
    this.ownerCounts.set(cell.ownerId, newCount + 1);
    if (notify && this.onCellChanged) this.onCellChanged(cell, cell.h3Index);
  }

  removeCell(h3Index: string, notify = true): void {
    const existing = this.cells.get(h3Index);
    if (!existing) return;
    const count = this.ownerCounts.get(existing.ownerId) || 0;
    this.ownerCounts.set(existing.ownerId, Math.max(0, count - 1));
    this.cells.delete(h3Index);
    if (notify && this.onCellChanged) this.onCellChanged(null, h3Index);
  }

  // ─── Claiming ───────────────────────────────────────────────────────────

  canClaim(
    h3Index: string,
    playerId: string, playerLevel: number,
    playerH3: string,
  ): { canClaim: boolean; reason?: string; claimTime: number } {
    const dist = gridDistance(h3Index, playerH3);
    if (dist > CLAIM_RADIUS) {
      return { canClaim: false, reason: 'Too far away', claimTime: 0 };
    }
    const stats = this.getStats(playerId, playerLevel);
    if (!stats.canClaim) {
      return { canClaim: false, reason: `Territory full (${stats.maxCells} max at level ${playerLevel})`, claimTime: 0 };
    }
    const existing = this.getCell(h3Index);
    if (existing && existing.ownerId === playerId) {
      return { canClaim: false, reason: 'Already yours', claimTime: 0 };
    }
    const claimTime = existing ? CLAIM_TIME_ENEMY : CLAIM_TIME_UNCLAIMED;
    return { canClaim: true, claimTime };
  }

  claimCell(
    h3Index: string,
    playerId: string, playerName: string,
    color?: string,
  ): ClaimResult {
    const now = Date.now();
    const territoryColor = color || playerColor(playerId);
    const existing = this.getCell(h3Index);
    const cellsLost = existing && existing.ownerId !== playerId ? [h3Index] : undefined;
    this.setCell({
      h3Index,
      ownerId: playerId,
      ownerName: playerName,
      color: territoryColor,
      claimedAt: now,
      lastVisited: now,
    });
    return { success: true, cellsClaimed: [h3Index], cellsLost };
  }

  // ─── Claim progress (hold-to-claim) ─────────────────────────────────────

  startClaim(h3Index: string, claimTime: number): void {
    this.claimProgress = { h3Index, startTime: Date.now(), targetTime: claimTime };
  }

  updateClaim(): { complete: boolean; progress: number; h3Index: string } | null {
    if (!this.claimProgress) return null;
    const elapsed = Date.now() - this.claimProgress.startTime;
    const progress = Math.min(1, elapsed / this.claimProgress.targetTime);
    if (this.onClaimProgress) this.onClaimProgress(progress, this.claimProgress.h3Index);
    if (progress >= 1) {
      const { h3Index } = this.claimProgress;
      this.claimProgress = null;
      return { complete: true, progress: 1, h3Index };
    }
    return { complete: false, progress, h3Index: this.claimProgress.h3Index };
  }

  cancelClaim(): void { this.claimProgress = null; }
  isClaimInProgress(): boolean { return this.claimProgress !== null; }

  // ─── Decay ──────────────────────────────────────────────────────────────

  processDecay(now?: number): { h3Index: string; ownerId: string }[] {
    const t = now || Date.now();
    const threshold = t - DECAY_THRESHOLD_MS;
    const toRemove: { h3Index: string; ownerId: string }[] = [];
    for (const cell of this.cells.values()) {
      if (cell.lastVisited < threshold && this.isEdgeCell(cell.h3Index, cell.ownerId)) {
        toRemove.push({ h3Index: cell.h3Index, ownerId: cell.ownerId });
      }
    }
    for (const { h3Index } of toRemove) this.removeCell(h3Index);
    return toRemove;
  }

  touchNearby(playerH3: string, playerId: string, radius = 2): void {
    const now = Date.now();
    for (const h of gridDisk(playerH3, radius)) {
      const cell = this.cells.get(h);
      if (cell && cell.ownerId === playerId) cell.lastVisited = now;
    }
  }

  // ─── Spatial queries ────────────────────────────────────────────────────

  /** Get all cells (simple iteration — the cell map is typically small) */
  getVisibleCells(): TerritoryCell[] {
    return Array.from(this.cells.values());
  }

  getPlayerCells(playerId: string): TerritoryCell[] {
    return Array.from(this.cells.values()).filter(c => c.ownerId === playerId);
  }

  isEdgeCell(h3Index: string, ownerId: string): boolean {
    for (const n of h3Neighbors(h3Index)) {
      const neighbor = this.cells.get(n);
      if (!neighbor || neighbor.ownerId !== ownerId) return true;
    }
    return false;
  }

  isInTerritory(h3Index: string, playerId: string): boolean {
    const cell = this.cells.get(h3Index);
    return cell !== null && cell !== undefined && cell.ownerId === playerId;
  }

  isLngLatInTerritory(lng: number, lat: number, playerId: string): boolean {
    return this.isInTerritory(lngLatToH3(lng, lat), playerId);
  }

  getTerritoryOwnerAt(h3Index: string): { ownerId: string; ownerName?: string; color: string } | null {
    const cell = this.cells.get(h3Index);
    if (!cell) return null;
    return { ownerId: cell.ownerId, ownerName: cell.ownerName, color: cell.color };
  }

  // ─── Production ─────────────────────────────────────────────────────────

  getProductionRates(playerId: string): Record<string, number> {
    const cells = this.getPlayerCells(playerId);
    if (cells.length === 0) return {};
    const rates: Record<string, number> = { wood: 0, stone: 0, fish: 0, herb: 0, gem: 0, shell: 0 };
    for (const cell of cells) {
      switch (cell.terrain || 'urban') {
        case 'park':  rates.wood += 2; rates.herb += 1; break;
        case 'water': rates.fish += 2; rates.shell += 0.5; break;
        case 'urban': rates.stone += 1; rates.gem += 0.2; break;
        case 'road':  rates.stone += 0.5; break;
      }
    }
    const bonus = this.getContiguityMultiplier(playerId);
    for (const key of Object.keys(rates)) {
      rates[key] = Math.floor(rates[key] * bonus * 100) / 100;
    }
    return rates;
  }

  calculateAccumulatedResources(
    playerId: string, lastCollectedAt: number, now?: number, maxHours = 12,
  ): { resources: Record<string, number>; hoursElapsed: number } {
    const t = now || Date.now();
    const hoursElapsed = Math.min((t - lastCollectedAt) / (1000 * 60 * 60), maxHours);
    if (hoursElapsed < 0.01) return { resources: {}, hoursElapsed: 0 };
    const rates = this.getProductionRates(playerId);
    const resources: Record<string, number> = {};
    for (const [key, rate] of Object.entries(rates)) {
      const amount = Math.floor(rate * hoursElapsed);
      if (amount > 0) resources[key] = amount;
    }
    return { resources, hoursElapsed };
  }

  // ─── Contiguity ─────────────────────────────────────────────────────────

  getContiguityMultiplier(playerId: string): number {
    const cells = this.getPlayerCells(playerId);
    if (cells.length === 0) return 1;
    return 1 + (this.getLargestConnectedBlob(playerId) / cells.length * 0.5);
  }

  getLargestConnectedBlob(playerId: string): number {
    const playerCells = new Set<string>();
    for (const cell of this.cells.values()) {
      if (cell.ownerId === playerId) playerCells.add(cell.h3Index);
    }
    const visited = new Set<string>();
    let largest = 0;
    for (const h of playerCells) {
      if (visited.has(h)) continue;
      const queue = [h];
      let blobSize = 0;
      while (queue.length > 0) {
        const current = queue.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        blobSize++;
        for (const n of h3Neighbors(current)) {
          if (playerCells.has(n) && !visited.has(n)) queue.push(n);
        }
      }
      largest = Math.max(largest, blobSize);
    }
    return largest;
  }

  // ─── Debug / testing ────────────────────────────────────────────────────

  debug(): { totalCells: number; owners: Record<string, number> } {
    const owners: Record<string, number> = {};
    for (const [id, count] of this.ownerCounts) owners[id] = count;
    return { totalCells: this.cells.size, owners };
  }

  clear(): void {
    this.cells.clear();
    this.ownerCounts.clear();
  }
}

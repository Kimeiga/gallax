import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gridDisk } from 'h3-js';
import {
  TerritorySystem,
  CLAIM_TIME_UNCLAIMED,
  CLAIM_TIME_ENEMY,
  CLAIM_RADIUS,
  DECAY_THRESHOLD_MS,
  maxTerritoryCells,
  playerColor,
  lngLatToH3,
  h3ToLngLat,
  h3Neighbors,
} from '../game/TerritorySystem';

const P1 = 'player-1';
const P2 = 'player-2';
const RED = '#ff0000';
const BLUE = '#0000ff';

// NYC center — gives us deterministic H3 cells for testing
const CENTER = lngLatToH3(-73.985, 40.748);
// Adjacent cells via gridDisk
const NEARBY = gridDisk(CENTER, 3); // center + 3 rings
const ADJ1 = NEARBY[1]; // first neighbor
const ADJ2 = NEARBY[2]; // second neighbor
const FAR = lngLatToH3(-74.1, 40.85); // far away cell

function makeSystem() { return new TerritorySystem(); }

// ─── playerColor ──────────────────────────────────────────────────────────────

describe('playerColor', () => {
  it('returns a hex color string', () => {
    expect(playerColor(P1)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it('is deterministic', () => {
    expect(playerColor(P1)).toBe(playerColor(P1));
  });
  it('varies across different ids', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(playerColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});

// ─── maxTerritoryCells ─────────────────────────────────────────────────────────

describe('maxTerritoryCells', () => {
  it('grows with level', () => {
    expect(maxTerritoryCells(2)).toBeGreaterThan(maxTerritoryCells(1));
    expect(maxTerritoryCells(10)).toBeGreaterThan(maxTerritoryCells(5));
  });
});

// ─── coordinate helpers ────────────────────────────────────────────────────────

describe('lngLatToH3 / h3ToLngLat', () => {
  it('round-trips approximately', () => {
    const lng = -73.985, lat = 40.748;
    const h3 = lngLatToH3(lng, lat);
    const back = h3ToLngLat(h3);
    expect(back.lng).toBeCloseTo(lng, 2);
    expect(back.lat).toBeCloseTo(lat, 2);
  });
  it('returns a valid H3 index', () => {
    expect(CENTER).toMatch(/^[0-9a-f]+$/);
    expect(CENTER.length).toBeGreaterThanOrEqual(15);
  });
});

describe('h3Neighbors', () => {
  it('returns exactly 6 neighbors', () => {
    expect(h3Neighbors(CENTER)).toHaveLength(6);
  });
  it('does not include the center', () => {
    expect(h3Neighbors(CENTER)).not.toContain(CENTER);
  });
});

// ─── claimCell ─────────────────────────────────────────────────────────────────

describe('TerritorySystem.claimCell', () => {
  let ts: TerritorySystem;
  beforeEach(() => { ts = makeSystem(); });

  it('stores the claimed cell', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    const cell = ts.getCell(CENTER);
    expect(cell).not.toBeNull();
    expect(cell!.ownerId).toBe(P1);
    expect(cell!.ownerName).toBe('Alice');
    expect(cell!.color).toBe(RED);
  });

  it('increments owner count', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.claimCell(ADJ1, P1, 'Alice', RED);
    expect(ts.getCellCount(P1)).toBe(2);
  });

  it('transfers ownership when enemy claims', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.claimCell(CENTER, P2, 'Bob', BLUE);
    expect(ts.getCell(CENTER)!.ownerId).toBe(P2);
    expect(ts.getCellCount(P1)).toBe(0);
    expect(ts.getCellCount(P2)).toBe(1);
  });

  it('fires onCellChanged callback', () => {
    const cb = vi.fn();
    ts.setOnCellChanged(cb);
    ts.claimCell(CENTER, P1, 'Alice', RED);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ h3Index: CENTER, ownerId: P1 }), CENTER);
  });

  it('returns cellsLost when overwriting enemy cell', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    const result = ts.claimCell(CENTER, P2, 'Bob', BLUE);
    expect(result.cellsLost).toEqual([CENTER]);
  });

  it('returns no cellsLost for unclaimed cell', () => {
    const result = ts.claimCell(CENTER, P1, 'Alice', RED);
    expect(result.cellsLost).toBeUndefined();
  });
});

// ─── removeCell ────────────────────────────────────────────────────────────────

describe('TerritorySystem.removeCell', () => {
  let ts: TerritorySystem;
  beforeEach(() => { ts = makeSystem(); });

  it('removes the cell', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.removeCell(CENTER);
    expect(ts.getCell(CENTER)).toBeNull();
  });

  it('decrements owner count', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.claimCell(ADJ1, P1, 'Alice', RED);
    ts.removeCell(CENTER);
    expect(ts.getCellCount(P1)).toBe(1);
  });

  it('is a no-op on unclaimed cell', () => {
    expect(() => ts.removeCell(CENTER)).not.toThrow();
  });

  it('fires onCellChanged with null', () => {
    const cb = vi.fn();
    ts.setOnCellChanged(cb);
    ts.claimCell(CENTER, P1, 'Alice', RED);
    cb.mockClear();
    ts.removeCell(CENTER);
    expect(cb).toHaveBeenCalledWith(null, CENTER);
  });
});

// ─── getStats ──────────────────────────────────────────────────────────────────

describe('TerritorySystem.getStats', () => {
  let ts: TerritorySystem;
  beforeEach(() => { ts = makeSystem(); });

  it('shows 0 cells initially', () => {
    const stats = ts.getStats(P1, 1);
    expect(stats.totalCells).toBe(0);
    expect(stats.canClaim).toBe(true);
  });

  it('canClaim becomes false at capacity', () => {
    const max = maxTerritoryCells(1);
    const disk = gridDisk(CENTER, 5); // enough cells
    for (let i = 0; i < max; i++) {
      ts.claimCell(disk[i], P1, 'Alice', RED);
    }
    expect(ts.getStats(P1, 1).canClaim).toBe(false);
  });

  it('higher level allows more cells', () => {
    expect(ts.getStats(P1, 5).maxCells).toBeGreaterThan(ts.getStats(P1, 1).maxCells);
  });
});

// ─── canClaim ──────────────────────────────────────────────────────────────────

describe('TerritorySystem.canClaim', () => {
  let ts: TerritorySystem;
  beforeEach(() => { ts = makeSystem(); });

  it('allows claiming unclaimed cell within radius', () => {
    const result = ts.canClaim(CENTER, P1, 1, CENTER);
    expect(result.canClaim).toBe(true);
    expect(result.claimTime).toBe(CLAIM_TIME_UNCLAIMED);
  });

  it('rejects cells beyond CLAIM_RADIUS', () => {
    const result = ts.canClaim(FAR, P1, 1, CENTER);
    expect(result.canClaim).toBe(false);
    expect(result.reason).toMatch(/too far/i);
  });

  it('returns enemy claim time for enemy territory', () => {
    ts.claimCell(ADJ1, P2, 'Bob', BLUE);
    const result = ts.canClaim(ADJ1, P1, 1, CENTER);
    expect(result.canClaim).toBe(true);
    expect(result.claimTime).toBe(CLAIM_TIME_ENEMY);
  });

  it('rejects own cell with "Already yours"', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    const result = ts.canClaim(CENTER, P1, 1, CENTER);
    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('Already yours');
  });

  it('rejects when at capacity', () => {
    const max = maxTerritoryCells(1);
    const disk = gridDisk(CENTER, 5);
    for (let i = 0; i < max; i++) ts.claimCell(disk[i], P1, 'Alice', RED);
    // Try to claim one more (use a cell not in the disk)
    const newCell = gridDisk(CENTER, 6).find(h => !disk.includes(h))!;
    const result = ts.canClaim(newCell, P1, 1, newCell);
    expect(result.canClaim).toBe(false);
    expect(result.reason).toMatch(/full/i);
  });
});

// ─── claim progress ────────────────────────────────────────────────────────────

describe('TerritorySystem claim progress', () => {
  let ts: TerritorySystem;
  beforeEach(() => { ts = makeSystem(); });

  it('startClaim sets progress in motion', () => {
    ts.startClaim(CENTER, 1000);
    expect(ts.isClaimInProgress()).toBe(true);
  });

  it('cancelClaim stops progress', () => {
    ts.startClaim(CENTER, 1000);
    ts.cancelClaim();
    expect(ts.isClaimInProgress()).toBe(false);
  });

  it('updateClaim returns incomplete immediately', () => {
    ts.startClaim(CENTER, 1000);
    const result = ts.updateClaim();
    expect(result!.complete).toBe(false);
  });

  it('updateClaim returns complete when time is up', () => {
    vi.useFakeTimers();
    ts.startClaim(CENTER, 1000);
    vi.advanceTimersByTime(1001);
    const result = ts.updateClaim();
    expect(result!.complete).toBe(true);
    expect(result!.h3Index).toBe(CENTER);
    expect(ts.isClaimInProgress()).toBe(false);
    vi.useRealTimers();
  });
});

// ─── getTerritoryOwnerAt ────────────────────────────────────────────────────────

describe('TerritorySystem.getTerritoryOwnerAt', () => {
  let ts: TerritorySystem;
  beforeEach(() => { ts = makeSystem(); });

  it('returns null for unclaimed cell', () => {
    expect(ts.getTerritoryOwnerAt(CENTER)).toBeNull();
  });

  it('returns owner info for claimed cell', () => {
    ts.claimCell(CENTER, P1, 'Alice', RED);
    const owner = ts.getTerritoryOwnerAt(CENTER);
    expect(owner!.ownerId).toBe(P1);
    expect(owner!.ownerName).toBe('Alice');
    expect(owner!.color).toBe(RED);
  });
});

// ─── loadCells ─────────────────────────────────────────────────────────────────

describe('TerritorySystem.loadCells', () => {
  it('replaces all existing cells', () => {
    const ts = makeSystem();
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.loadCells([
      { h3Index: ADJ1, ownerId: P2, ownerName: 'Bob', color: BLUE, claimedAt: Date.now(), lastVisited: Date.now() },
    ]);
    expect(ts.getCell(CENTER)).toBeNull();
    expect(ts.getCell(ADJ1)?.ownerId).toBe(P2);
    expect(ts.getCellCount(P1)).toBe(0);
    expect(ts.getCellCount(P2)).toBe(1);
  });
});

// ─── decay ─────────────────────────────────────────────────────────────────────

describe('TerritorySystem decay', () => {
  it('decays edge cells not visited beyond threshold', () => {
    vi.useFakeTimers();
    const ts = makeSystem();
    const staleTime = Date.now() - DECAY_THRESHOLD_MS - 1000;
    ts.loadCells([
      { h3Index: CENTER, ownerId: P1, color: RED, claimedAt: staleTime, lastVisited: staleTime },
    ]);
    ts.processDecay();
    expect(ts.getCell(CENTER)).toBeNull();
    vi.useRealTimers();
  });

  it('does not decay recently visited cells', () => {
    const ts = makeSystem();
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.processDecay();
    expect(ts.getCell(CENTER)).not.toBeNull();
  });
});

// ─── connected blobs ───────────────────────────────────────────────────────────

describe('TerritorySystem.getLargestConnectedBlob', () => {
  it('counts connected hexes', () => {
    const ts = makeSystem();
    const neighbors = h3Neighbors(CENTER);
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.claimCell(neighbors[0], P1, 'Alice', RED);
    ts.claimCell(neighbors[1], P1, 'Alice', RED);
    expect(ts.getLargestConnectedBlob(P1)).toBe(3);
  });

  it('returns largest of disconnected blobs', () => {
    const ts = makeSystem();
    // Blob 1: center + 1 neighbor
    ts.claimCell(CENTER, P1, 'Alice', RED);
    ts.claimCell(h3Neighbors(CENTER)[0], P1, 'Alice', RED);
    // Blob 2: far away single cell
    ts.claimCell(FAR, P1, 'Alice', RED);
    expect(ts.getLargestConnectedBlob(P1)).toBe(2);
  });
});

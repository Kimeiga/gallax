import { describe, it, expect, vi, beforeEach } from 'vitest';

// BuildingManager imports pixi.js at the top level — mock it so pure data (BUILDING_DEFS) loads fine
vi.mock('pixi.js', () => ({
  Application: vi.fn(),
  Text: vi.fn().mockImplementation(() => ({
    anchor: { set: vi.fn() },
    position: { x: 0, y: 0 },
    text: '',
    destroy: vi.fn(),
  })),
  TextStyle: vi.fn(),
}));

// Also mock MapManager (imported by BuildingManager) to avoid chained DOM deps
vi.mock('../map/MapManager', () => ({ MapManager: vi.fn() }));
vi.mock('../network/NetworkManager', () => ({}));

import { Inventory } from '../game/Inventory';
import { CraftingSystem } from '../game/Crafting';
import { BUILDING_DEFS } from '../game/BuildingManager';

function makeSystem(wood = 0, stone = 0, fish = 0, gem = 0, shell = 0, herb = 0) {
  const inv = new Inventory();
  if (wood)  inv.add('wood', wood);
  if (stone) inv.add('stone', stone);
  if (fish)  inv.add('fish', fish);
  if (gem)   inv.add('gem', gem);
  if (shell) inv.add('shell', shell);
  if (herb)  inv.add('herb', herb);
  return { inv, cs: new CraftingSystem(inv) };
}

// ─── canCraft ──────────────────────────────────────────────────────────────────

describe('CraftingSystem.canCraft', () => {
  it('returns false for unknown building type', () => {
    const { cs } = makeSystem();
    expect(cs.canCraft('unknown_building')).toBe(false);
  });

  it('returns true for free buildings (my_home has no cost)', () => {
    const { cs } = makeSystem();
    expect(cs.canCraft('my_home')).toBe(true);
  });

  it('returns false when missing resources', () => {
    const { cs } = makeSystem(); // empty inventory
    expect(cs.canCraft('tent')).toBe(false); // requires wood:2, herb:1
  });

  it('returns true when exactly meeting cost', () => {
    const tent = BUILDING_DEFS['tent'].cost;
    const { cs } = makeSystem(tent.wood, 0, 0, 0, 0, tent.herb);
    expect(cs.canCraft('tent')).toBe(true);
  });

  it('returns true with surplus resources', () => {
    const { cs } = makeSystem(10, 10, 10, 10, 10, 10);
    expect(cs.canCraft('tent')).toBe(true);
  });

  it('returns false when one resource is 1 short', () => {
    const tent = BUILDING_DEFS['tent'].cost; // wood:2, herb:1
    const { cs } = makeSystem(tent.wood! - 1, 0, 0, 0, 0, tent.herb);
    expect(cs.canCraft('tent')).toBe(false);
  });
});

// ─── craft ─────────────────────────────────────────────────────────────────────

describe('CraftingSystem.craft', () => {
  it('returns false and does not consume resources when cannot afford', () => {
    const { inv, cs } = makeSystem();
    const before = inv.getTotalCount();
    const result = cs.craft('house'); // requires wood:5, stone:3
    expect(result).toBe(false);
    expect(inv.getTotalCount()).toBe(before);
  });

  it('consumes exact cost on success', () => {
    const { inv, cs } = makeSystem(5, 3); // house: wood:5, stone:3
    expect(cs.craft('house')).toBe(true);
    expect(inv.get('wood')).toBe(0);
    expect(inv.get('stone')).toBe(0);
  });

  it('only deducts cost — leaves surplus', () => {
    const { inv, cs } = makeSystem(10, 10);
    cs.craft('house'); // costs wood:5, stone:3
    expect(inv.get('wood')).toBe(5);
    expect(inv.get('stone')).toBe(7);
  });

  it('allows crafting twice with sufficient resources', () => {
    const { inv, cs } = makeSystem(10, 6); // two houses: 10 wood, 6 stone
    expect(cs.craft('house')).toBe(true);
    expect(cs.craft('house')).toBe(true);
    expect(inv.get('wood')).toBe(0);
    expect(inv.get('stone')).toBe(0);
  });

  it('fails second craft when resources depleted', () => {
    const { cs } = makeSystem(5, 3); // exactly one house
    expect(cs.craft('house')).toBe(true);
    expect(cs.craft('house')).toBe(false);
  });
});

// ─── getAvailableBuildings ─────────────────────────────────────────────────────

describe('CraftingSystem.getAvailableBuildings', () => {
  it('returns all building types', () => {
    const { cs } = makeSystem();
    const available = cs.getAvailableBuildings();
    expect(available.length).toBe(Object.keys(BUILDING_DEFS).length);
  });

  it('marks craftable buildings correctly', () => {
    const { cs } = makeSystem(999, 999, 999, 999, 999, 999);
    const available = cs.getAvailableBuildings();
    expect(available.every(b => b.canCraft)).toBe(true);
  });

  it('marks all as uncraftable with empty inventory', () => {
    const { cs } = makeSystem();
    const available = cs.getAvailableBuildings();
    // my_home is free (no cost), everything else requires resources
    const costBuildings = available.filter(b => Object.keys(b.def.cost).length > 0);
    expect(costBuildings.every(b => !b.canCraft)).toBe(true);
  });
});

// ─── selectBuilding ────────────────────────────────────────────────────────────

describe('CraftingSystem.selectBuilding', () => {
  it('stores selected building', () => {
    const { cs } = makeSystem();
    cs.selectBuilding('tent');
    expect(cs.getSelectedBuilding()).toBe('tent');
  });

  it('clears selection when passed null', () => {
    const { cs } = makeSystem();
    cs.selectBuilding('tent');
    cs.selectBuilding(null);
    expect(cs.getSelectedBuilding()).toBeNull();
  });

  it('fires onSelect callback', () => {
    const { cs } = makeSystem();
    const cb = vi.fn();
    cs.onSelect(cb);
    cs.selectBuilding('house');
    expect(cb).toHaveBeenCalledWith('house');
  });
});

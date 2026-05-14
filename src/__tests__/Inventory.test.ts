import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Inventory } from '../game/Inventory';

function make() {
  return new Inventory();
}

describe('Inventory.add', () => {
  it('starts at 0 for every resource', () => {
    const inv = make();
    expect(inv.get('wood')).toBe(0);
    expect(inv.get('gem')).toBe(0);
  });

  it('increments count', () => {
    const inv = make();
    inv.add('wood', 3);
    expect(inv.get('wood')).toBe(3);
  });

  it('defaults amount to 1', () => {
    const inv = make();
    inv.add('stone');
    expect(inv.get('stone')).toBe(1);
  });

  it('caps at 999 (maxStack)', () => {
    const inv = make();
    inv.add('fish', 999);
    inv.add('fish', 5);
    expect(inv.get('fish')).toBe(999);
  });

  it('fires onChange', () => {
    const inv = make();
    const cb = vi.fn();
    inv.onChange(cb);
    inv.add('herb', 2);
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe('Inventory.remove', () => {
  it('decrements count', () => {
    const inv = make();
    inv.add('wood', 5);
    const ok = inv.remove('wood', 3);
    expect(ok).toBe(true);
    expect(inv.get('wood')).toBe(2);
  });

  it('returns false when insufficient', () => {
    const inv = make();
    inv.add('wood', 2);
    const ok = inv.remove('wood', 5);
    expect(ok).toBe(false);
    expect(inv.get('wood')).toBe(2); // unchanged
  });

  it('allows removing exact amount', () => {
    const inv = make();
    inv.add('shell', 4);
    expect(inv.remove('shell', 4)).toBe(true);
    expect(inv.get('shell')).toBe(0);
  });

  it('fires onChange on successful remove', () => {
    const inv = make();
    inv.add('gem', 3);
    const cb = vi.fn();
    inv.onChange(cb);
    inv.remove('gem', 1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not fire onChange on failed remove', () => {
    const inv = make();
    const cb = vi.fn();
    inv.onChange(cb);
    inv.remove('gem', 1); // nothing to remove
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('Inventory.has', () => {
  it('returns true when sufficient', () => {
    const inv = make();
    inv.add('wood', 5);
    expect(inv.has('wood', 5)).toBe(true);
    expect(inv.has('wood', 3)).toBe(true);
  });

  it('returns false when insufficient', () => {
    const inv = make();
    inv.add('wood', 2);
    expect(inv.has('wood', 3)).toBe(false);
  });

  it('defaults amount to 1', () => {
    const inv = make();
    expect(inv.has('stone')).toBe(false);
    inv.add('stone');
    expect(inv.has('stone')).toBe(true);
  });
});

describe('Inventory.getTotalCount', () => {
  it('sums all resources', () => {
    const inv = make();
    inv.add('wood', 3);
    inv.add('stone', 2);
    inv.add('gem', 1);
    expect(inv.getTotalCount()).toBe(6);
  });

  it('is 0 initially', () => {
    expect(make().getTotalCount()).toBe(0);
  });
});

describe('Inventory.getAll', () => {
  it('returns a copy, not the internal map', () => {
    const inv = make();
    inv.add('wood', 5);
    const all = inv.getAll();
    all.set('wood', 0);
    expect(inv.get('wood')).toBe(5); // original unchanged
  });
});

describe('Inventory.onChange', () => {
  it('supports multiple listeners', () => {
    const inv = make();
    const a = vi.fn(), b = vi.fn();
    inv.onChange(a);
    inv.onChange(b);
    inv.add('wood');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});

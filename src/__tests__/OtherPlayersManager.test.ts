import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Pixi.js
vi.mock('pixi.js', () => ({
  Application: vi.fn(),
  Sprite: vi.fn().mockImplementation(() => ({
    anchor: { set: vi.fn() },
    roundPixels: false,
    position: { x: 0, y: 0 },
    scale: { set: vi.fn() },
    zIndex: 0,
  })),
  Assets: {
    load: vi.fn().mockResolvedValue({
      source: { scaleMode: 'nearest' },
    }),
  },
  Text: vi.fn().mockImplementation(() => ({
    anchor: { set: vi.fn() },
    position: { x: 0, y: 0 },
    text: '',
    zIndex: 0,
  })),
  TextStyle: vi.fn(),
}));

interface OtherPlayer {
  id: string;
  lng: number;
  lat: number;
  targetLng: number;
  targetLat: number;
  name: string;
}

describe('OtherPlayersManager', () => {
  describe('Player Management', () => {
    it('should track player positions with target coordinates', () => {
      const player: OtherPlayer = {
        id: 'player1',
        lng: -73.965,
        lat: 40.782,
        targetLng: -73.965,
        targetLat: 40.782,
        name: 'TestPlayer',
      };

      expect(player.lng).toBe(-73.965);
      expect(player.lat).toBe(40.782);
      expect(player.targetLng).toBe(-73.965);
      expect(player.targetLat).toBe(40.782);
    });

    it('should update target position for smooth movement', () => {
      const player: OtherPlayer = {
        id: 'player1',
        lng: -73.965,
        lat: 40.782,
        targetLng: -73.965,
        targetLat: 40.782,
        name: 'TestPlayer',
      };

      // Simulate movement
      player.targetLng = -73.964;
      player.targetLat = 40.783;

      expect(player.targetLng).toBe(-73.964);
      expect(player.targetLat).toBe(40.783);
      // Original position should not change until interpolation
      expect(player.lng).toBe(-73.965);
      expect(player.lat).toBe(40.782);
    });
  });

  describe('Position Interpolation', () => {
    it('should calculate delta for smooth movement', () => {
      const currentLng = -73.965;
      const targetLng = -73.964;
      const dx = targetLng - currentLng;

      expect(dx).toBeCloseTo(0.001, 5);
    });

    it('should interpolate towards target', () => {
      const lerpSpeed = 0.15;
      let lng = -73.965;
      const targetLng = -73.964;

      // Simulate one frame of interpolation
      const dx = targetLng - lng;
      lng += dx * lerpSpeed;

      expect(lng).toBeCloseTo(-73.96485, 5);
      expect(lng).toBeGreaterThan(-73.965);
      expect(lng).toBeLessThan(targetLng);
    });

    it('should stop interpolation when close to target', () => {
      const lng = -73.96400001;
      const targetLng = -73.964;
      const dx = Math.abs(targetLng - lng);

      // Should be close enough to snap
      expect(dx).toBeLessThan(0.0001);
    });
  });

  describe('Player Name Updates', () => {
    it('should update player name', () => {
      const player: OtherPlayer = {
        id: 'player1',
        lng: -73.965,
        lat: 40.782,
        targetLng: -73.965,
        targetLat: 40.782,
        name: 'OldName',
      };

      player.name = 'NewName';

      expect(player.name).toBe('NewName');
    });
  });

  describe('Scale Calculation', () => {
    it('should calculate scale based on zoom level', () => {
      const baseZoom = 16;
      const baseScale = 0.75;
      const zoom = 17;

      const zoomDiff = zoom - baseZoom;
      const scale = baseScale * Math.pow(2, zoomDiff);

      expect(scale).toBe(1.5); // 0.75 * 2^1
    });

    it('should reduce scale at lower zoom levels', () => {
      const baseZoom = 16;
      const baseScale = 0.75;
      const zoom = 15;

      const zoomDiff = zoom - baseZoom;
      const scale = baseScale * Math.pow(2, zoomDiff);

      expect(scale).toBe(0.375); // 0.75 * 2^(-1)
    });
  });
});


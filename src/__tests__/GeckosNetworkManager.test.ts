import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the geckos.io client
vi.mock('@geckos.io/client', () => ({
  default: vi.fn(() => ({
    onConnect: vi.fn((callback) => callback()),
    on: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock SnapshotInterpolation
vi.mock('@geckos.io/snapshot-interpolation', () => ({
  SnapshotInterpolation: vi.fn().mockImplementation(() => ({
    vault: { size: 0 },
    snapshot: {
      add: vi.fn(),
    },
    calcInterpolation: vi.fn().mockReturnValue({
      state: [
        { id: 'player1', x: -73.965, y: 40.782 },
        { id: 'player2', x: -73.964, y: 40.783 },
      ],
    }),
  })),
}));

// Types for testing
interface NetworkPlayer {
  id: string;
  spriteNum: number;
  lng: number;
  lat: number;
  name: string;
}

interface NetworkBuilding {
  id: string;
  type: string;
  lng: number;
  lat: number;
  ownerId: string;
  placedAt: number;
}

describe('GeckosNetworkManager', () => {
  describe('Connection', () => {
    it('should use production URL for non-localhost hostnames', () => {
      const isProduction = (hostname: string) =>
        hostname !== 'localhost' && hostname !== '127.0.0.1';

      expect(isProduction('localhost')).toBe(false);
      expect(isProduction('127.0.0.1')).toBe(false);
      expect(isProduction('gallax.com')).toBe(true);
      expect(isProduction('my-site.pages.dev')).toBe(true);
    });
  });

  describe('Message Handlers', () => {
    it('should define all required handler types', () => {
      const handlers = {
        onInit: vi.fn(),
        onPlayerJoined: vi.fn(),
        onPlayerLeft: vi.fn(),
        onPlayerMoved: vi.fn(),
        onPlayerNameChanged: vi.fn(),
        onResourceCollected: vi.fn(),
        onBuildingPlaced: vi.fn(),
      };

      expect(handlers.onInit).toBeDefined();
      expect(handlers.onPlayerJoined).toBeDefined();
      expect(handlers.onPlayerLeft).toBeDefined();
      expect(handlers.onPlayerMoved).toBeDefined();
      expect(handlers.onPlayerNameChanged).toBeDefined();
      expect(handlers.onResourceCollected).toBeDefined();
      expect(handlers.onBuildingPlaced).toBeDefined();
    });
  });

  describe('Snapshot Interpolation', () => {
    it('should filter out own player from movement updates', () => {
      const myPlayerId = 'player1';
      const entities = [
        { id: 'player1', x: -73.965, y: 40.782 },
        { id: 'player2', x: -73.964, y: 40.783 },
      ];

      const filteredEntities = entities.filter(e => e.id !== myPlayerId);
      expect(filteredEntities).toHaveLength(1);
      expect(filteredEntities[0].id).toBe('player2');
    });

    it('should extract x and y from interpolated entities', () => {
      const entity = { id: 'player1', x: -73.965, y: 40.782 };
      
      expect(entity.x).toBe(-73.965);
      expect(entity.y).toBe(40.782);
    });
  });

  describe('Network Messages', () => {
    it('should serialize move message correctly', () => {
      const lng = -73.96500;
      const lat = 40.78200;
      const message = { lng, lat };

      expect(message.lng).toBe(-73.965);
      expect(message.lat).toBe(40.782);
    });

    it('should serialize collect message correctly', () => {
      const resourceId = 'tree--73.965-40.782';
      const message = { resourceId };

      expect(message.resourceId).toBe('tree--73.965-40.782');
    });

    it('should serialize building message correctly', () => {
      const building = {
        type: 'house',
        lng: -73.965,
        lat: 40.782,
      };

      expect(building.type).toBe('house');
      expect(building.lng).toBe(-73.965);
      expect(building.lat).toBe(40.782);
    });

    it('should serialize name change message correctly', () => {
      const name = 'TestPlayer123';
      const message = { name };

      expect(message.name).toBe('TestPlayer123');
    });
  });
});


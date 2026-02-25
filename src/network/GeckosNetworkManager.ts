// Geckos.io network manager for low-latency multiplayer
import geckos, { ClientChannel, Data } from '@geckos.io/client';
import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation';

// Define Entity type for snapshot interpolation
interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface NetworkPlayer {
  id: string;
  spriteNum: number;
  lng: number;
  lat: number;
  name: string;
}

export interface NetworkBuilding {
  id: string;
  type: string;
  lng: number;
  lat: number;
  ownerId: string;
  placedAt: number;
}

export type MessageHandler = {
  onInit: (playerId: string, players: NetworkPlayer[], collectedResources: string[], buildings: NetworkBuilding[]) => void;
  onPlayerJoined: (player: NetworkPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerMoved: (playerId: string, lng: number, lat: number) => void;
  onPlayerNameChanged: (playerId: string, name: string) => void;
  onResourceCollected: (resourceId: string, playerId: string) => void;
  onBuildingPlaced: (building: NetworkBuilding) => void;
  onSnapshot?: (snapshot: unknown) => void;
};

const SNAPSHOT_RATE = 15;

export class GeckosNetworkManager {
  private channel: ClientChannel | null = null;
  private handlers: MessageHandler | null = null;
  private playerId: string | null = null;
  private serverUrl: string;
  private SI: SnapshotInterpolation;
  private connected = false;

  constructor(serverUrl?: string) {
    this.SI = new SnapshotInterpolation(SNAPSHOT_RATE);

    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else {
      // Production: Vultr VPS in Chicago
      const isProduction = window.location.hostname !== 'localhost' &&
                           window.location.hostname !== '127.0.0.1';
      if (isProduction) {
        this.serverUrl = 'http://207.148.15.120:3000';
      } else {
        this.serverUrl = 'http://localhost:3000';
      }
    }
    console.log(`🦎 Geckos URL: ${this.serverUrl}`);
  }

  connect(handlers: MessageHandler): Promise<void> {
    this.handlers = handlers;

    return new Promise((resolve, reject) => {
      // For Vultr VPS, we use port 3000 directly (no reverse proxy)
      // Parse the URL to extract host and port
      const url = new URL(this.serverUrl);
      const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 3000);

      this.channel = geckos({
        url: `${url.protocol}//${url.hostname}`,
        port: port,
        // Use Open Relay TURN servers (free) + Google STUN servers
        // TURN servers relay traffic when UDP is blocked (common behind firewalls)
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.relay.metered.ca:80' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:80?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turns:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ]
      });

      console.log(`🦎 Connecting to ${this.serverUrl}...`);

      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        console.error('🦎 Connection timeout after 30 seconds');
        console.log('🦎 WebRTC may be blocked by firewall or TURN server not working');
        reject(new Error('Connection timeout'));
      }, 30000);

      this.channel.onConnect((error) => {
        clearTimeout(connectionTimeout);
        console.log('🦎 onConnect callback fired', { hasError: !!error });
        if (error) {
          console.error('🦎 Connection error:', error);
          console.error('🦎 Error details:', {
            message: (error as Error).message,
            name: (error as Error).name,
          });
          reject(error);
          return;
        }
        console.log('🦎 Connected to geckos.io server!');
        console.log('🦎 Channel ID:', this.channel?.id);
        this.connected = true;
        this.setupListeners();
        resolve();
      });

      this.channel.onDisconnect(() => {
        console.log('🦎 Disconnected from server');
        this.connected = false;
      });

      // Log raw events if available
      if (this.channel.onRaw) {
        this.channel.onRaw((data) => {
          console.log('🦎 Raw message received:', data);
        });
      }
    });
  }

  private setupListeners() {
    if (!this.channel || !this.handlers) return;

    this.channel.on('init', (data: Data) => {
      const msg = data as { playerId: string; players: NetworkPlayer[]; collectedResources: string[]; buildings: NetworkBuilding[] };
      this.playerId = msg.playerId;
      this.handlers!.onInit(msg.playerId, msg.players, msg.collectedResources, msg.buildings);
    });

    this.channel.on('player_joined', (data: Data) => {
      const msg = data as { player: NetworkPlayer };
      this.handlers!.onPlayerJoined(msg.player);
    });

    this.channel.on('player_left', (data: Data) => {
      const msg = data as { playerId: string };
      this.handlers!.onPlayerLeft(msg.playerId);
    });

    this.channel.on('player_name_changed', (data: Data) => {
      const msg = data as { playerId: string; name: string };
      this.handlers!.onPlayerNameChanged(msg.playerId, msg.name);
    });

    this.channel.on('resource_collected', (data: Data) => {
      const msg = data as { resourceId: string; playerId: string };
      this.handlers!.onResourceCollected(msg.resourceId, msg.playerId);
    });

    this.channel.on('building_placed', (data: Data) => {
      const msg = data as { building: NetworkBuilding };
      this.handlers!.onBuildingPlaced(msg.building);
    });

    // Snapshot interpolation for smooth movement
    this.channel.on('snapshot', (data: Data) => {
      const snapshot = data as unknown;
      this.SI.snapshot.add(snapshot as Parameters<typeof this.SI.snapshot.add>[0]);

      // Extract interpolated positions and update players
      const interpolated = this.SI.calcInterpolation('x y');
      if (interpolated?.state) {
        const entities = interpolated.state as unknown as Entity[];
        for (const entity of entities) {
          // Don't update our own position
          if (entity.id !== this.playerId) {
            this.handlers!.onPlayerMoved(entity.id, entity.x, entity.y);
          }
        }
      }

      if (this.handlers!.onSnapshot) {
        this.handlers!.onSnapshot(snapshot);
      }
    });
  }

  // Get interpolated positions from snapshot buffer
  getInterpolatedState(): Entity[] | null {
    const snapshot = this.SI.calcInterpolation('x y');
    if (!snapshot?.state) return null;
    // Cast to our Entity type
    return snapshot.state as unknown as Entity[];
  }

  join(lng: number, lat: number, spriteNum: number, name?: string) {
    this.channel?.emit('join', { lng, lat, spriteNum, name }, { reliable: true });
  }

  move(lng: number, lat: number) {
    this.channel?.emit('move', { lng, lat }, { reliable: false });
  }

  collectResource(resourceId: string) {
    this.channel?.emit('collect', { resourceId }, { reliable: true });
  }

  placeBuilding(buildingType: string, lng: number, lat: number) {
    this.channel?.emit('place_building', { buildingType, lng, lat }, { reliable: true });
  }

  setName(name: string) {
    this.channel?.emit('set_name', { name }, { reliable: true });
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    this.channel?.close();
    this.connected = false;
  }
}


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
  rotation: number; // Rotation in radians
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

// Input record for client-side prediction
interface InputRecord {
  seq: number;           // Sequence number
  timestamp: number;     // When input was applied
  inputX: number;        // Input direction X
  inputY: number;        // Input direction Y
  deltaTime: number;     // Delta time when applied
  predictedLng: number;  // Predicted position after applying
  predictedLat: number;
}

// Position correction callback type
export type PositionCorrectionCallback = (lng: number, lat: number, inputsToReapply: InputRecord[]) => void;

export type MessageHandler = {
  onInit: (playerId: string, players: NetworkPlayer[], collectedResources: string[], buildings: NetworkBuilding[]) => void;
  onPlayerJoined: (player: NetworkPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerMoved: (playerId: string, lng: number, lat: number) => void;
  onPlayerNameChanged: (playerId: string, name: string) => void;
  onResourceCollected: (resourceId: string, playerId: string) => void;
  onBuildingPlaced: (building: NetworkBuilding) => void;
  onBuildingRotated?: (buildingId: string, rotation: number) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onSnapshot?: (snapshot: unknown) => void;
  onPositionCorrection?: PositionCorrectionCallback;
};

const SNAPSHOT_RATE = 15;
const INPUT_BUFFER_SIZE = 128; // Keep last N inputs for reconciliation
const POSITION_TOLERANCE = 0.000005; // ~0.5 meters - threshold for correction

export class GeckosNetworkManager {
  private channel: ClientChannel | null = null;
  private handlers: MessageHandler | null = null;
  private playerId: string | null = null;
  private serverUrl: string;
  private SI: SnapshotInterpolation;
  private connected = false;

  // Client-side prediction state
  private inputSequence = 0;
  private inputBuffer: InputRecord[] = [];
  private lastAcknowledgedSeq = -1;
  private serverPosition: { lng: number; lat: number } | null = null;

  constructor(serverUrl?: string) {
    this.SI = new SnapshotInterpolation(SNAPSHOT_RATE);

    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else {
      // Production: Use game.kimu.nyc with proper SSL
      const isProduction = window.location.hostname !== 'localhost' &&
                           window.location.hostname !== '127.0.0.1';
      if (isProduction) {
        // Custom domain with Let's Encrypt SSL via Caddy
        this.serverUrl = 'https://game.kimu.nyc';
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

    this.channel.on('building_rotated', (data: Data) => {
      const msg = data as { buildingId: string; rotation: number };
      if (this.handlers!.onBuildingRotated) {
        this.handlers!.onBuildingRotated(msg.buildingId, msg.rotation);
      }
    });

    // Chat messages
    this.channel.on('chat_message', (data: Data) => {
      const msg = data as ChatMessage;
      if (this.handlers!.onChatMessage) {
        this.handlers!.onChatMessage(msg);
      }
    });

    // Position acknowledgment for client-side prediction reconciliation
    this.channel.on('position_ack', (data: Data) => {
      const msg = data as { lng: number; lat: number; seq: number };
      this.handlePositionAck(msg.lng, msg.lat, msg.seq);
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

  // Record input and send move with sequence number for prediction
  move(lng: number, lat: number, inputX: number, inputY: number, deltaTime: number) {
    const seq = this.inputSequence++;

    // Record input for potential reconciliation
    const inputRecord: InputRecord = {
      seq,
      timestamp: Date.now(),
      inputX,
      inputY,
      deltaTime,
      predictedLng: lng,
      predictedLat: lat,
    };

    // Add to buffer, remove old entries
    this.inputBuffer.push(inputRecord);
    if (this.inputBuffer.length > INPUT_BUFFER_SIZE) {
      this.inputBuffer.shift();
    }

    // Send to server with sequence number
    this.channel?.emit('move', { lng, lat, seq }, { reliable: false });
  }

  // Handle server position acknowledgment and perform reconciliation
  handlePositionAck(serverLng: number, serverLat: number, lastProcessedSeq: number) {
    this.serverPosition = { lng: serverLng, lat: serverLat };

    // Find the acknowledged input in our buffer
    const ackIndex = this.inputBuffer.findIndex(input => input.seq === lastProcessedSeq);

    if (ackIndex === -1) {
      // Server is acknowledging a sequence we already cleared - just update position
      this.lastAcknowledgedSeq = lastProcessedSeq;
      return;
    }

    // Get our predicted position at the time of the acknowledged input
    const ackedInput = this.inputBuffer[ackIndex];

    // Calculate position difference
    const dx = Math.abs(serverLng - ackedInput.predictedLng);
    const dy = Math.abs(serverLat - ackedInput.predictedLat);
    const positionDiff = Math.sqrt(dx * dx + dy * dy);

    // Remove all inputs up to and including the acknowledged one
    const inputsToReapply = this.inputBuffer.slice(ackIndex + 1);
    this.inputBuffer = inputsToReapply;
    this.lastAcknowledgedSeq = lastProcessedSeq;

    // If position differs beyond tolerance, we need to reconcile
    if (positionDiff > POSITION_TOLERANCE) {
      console.log(`🔄 Reconciling: diff=${positionDiff.toFixed(8)}, reapply=${inputsToReapply.length} inputs`);

      // Notify Game.ts to correct position and re-apply inputs
      if (this.handlers?.onPositionCorrection) {
        this.handlers.onPositionCorrection(serverLng, serverLat, inputsToReapply);
      }
    }
  }

  collectResource(resourceId: string) {
    this.channel?.emit('collect', { resourceId }, { reliable: true });
  }

  placeBuilding(buildingType: string, lng: number, lat: number) {
    this.channel?.emit('place_building', { buildingType, lng, lat }, { reliable: true });
  }

  rotateBuilding(buildingId: string, rotation: number) {
    this.channel?.emit('rotate_building', { buildingId, rotation }, { reliable: true });
  }

  setName(name: string) {
    this.channel?.emit('set_name', { name }, { reliable: true });
  }

  sendChat(message: string) {
    this.channel?.emit('chat', { message }, { reliable: true });
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

